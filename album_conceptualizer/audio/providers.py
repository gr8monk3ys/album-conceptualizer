"""Text-to-music providers behind one interface.

Deliberately provider-agnostic. The product's value is the album-coherent
brief, not any one vendor's model, and hosted music models change often
enough that binding the app to one is a liability. Adding a provider means
implementing `MusicProvider` and registering it in `_REGISTRY` -- nothing in
the API layer changes.

Content policy is the provider's to enforce and we do not attempt to
second-guess it here. What this module DOES guarantee is that the prompt is
assembled from the user's own album fields (see `prompt.py`) -- the app never
synthesises "in the style of <named artist>" on the user's behalf.
"""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from typing import Protocol

import httpx


logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_SECONDS = 300
_POLL_INTERVAL_SECONDS = 2.0


class ProviderNotConfiguredError(RuntimeError):
    """No usable provider. Raised with an actionable message, never a bare 500.

    Separate from ProviderRequestError because the two need opposite
    responses: this one is the operator's to fix and will fail identically
    forever, so it must never be retried.
    """


class ProviderRequestError(RuntimeError):
    """The provider was reachable but the request failed.

    Carries `retryable` so the caller can distinguish a rate limit or a 5xx
    (worth another attempt) from a rejected prompt (never worth retrying).
    """

    def __init__(self, message: str, *, retryable: bool = False) -> None:
        super().__init__(message)
        self.retryable = retryable


@dataclass(frozen=True)
class GenerationRequest:
    prompt: str
    duration_seconds: int = 30
    negative_prompt: str = ""
    seed: int | None = None


@dataclass(frozen=True)
class GenerationResult:
    """A finished render, delivered one of two ways.

    Providers split on this and callers must handle both:

    `audio_url` -- the provider hosts the file (Replicate). These URLs
    commonly EXPIRE, so anything that needs the audio to outlive the
    provider's retention must copy it rather than store the URL as durable.

    `audio_bytes` -- the provider returned the audio inline (Hugging Face
    Inference). Nothing hosts it but us, so it MUST be persisted before the
    result is handed back, or the render is lost the moment the job ends.

    Exactly one is set. `content_type` describes the bytes when present;
    models differ (MusicGen returns WAV, others FLAC or MP3) and guessing
    from the model name produces files players refuse to open.
    """

    provider: str
    model: str
    duration_seconds: int
    prompt: str
    audio_url: str = ""
    audio_bytes: bytes | None = None
    content_type: str = ""
    seed: int | None = None
    raw: dict | None = None

    def __post_init__(self) -> None:
        if not self.audio_url and not self.audio_bytes:
            raise ValueError("GenerationResult needs either audio_url or audio_bytes.")


class MusicProvider(Protocol):
    name: str

    def generate(self, request: GenerationRequest) -> GenerationResult: ...


class ReplicateProvider:
    """Replicate-hosted text-to-music (MusicGen, Stable Audio, and friends).

    Replicate is a reasonable default because one token reaches many models,
    so switching model is config rather than code. The prediction API is
    poll-based: create, then poll until terminal.
    """

    name = "replicate"

    def __init__(
        self,
        api_token: str,
        model: str,
        *,
        timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
        client: httpx.Client | None = None,
    ) -> None:
        if not api_token:
            raise ProviderNotConfiguredError(
                "REPLICATE_API_TOKEN is not set. Create a token at "
                "https://replicate.com/account/api-tokens and set it in the "
                "engine environment."
            )
        self._token = api_token
        self._model = model
        self._timeout = timeout_seconds
        self._client = client

    def _http(self) -> httpx.Client:
        return self._client or httpx.Client(timeout=30.0)

    def generate(self, request: GenerationRequest) -> GenerationResult:
        payload_input: dict[str, object] = {
            "prompt": request.prompt,
            "duration": request.duration_seconds,
        }
        if request.negative_prompt:
            payload_input["negative_prompt"] = request.negative_prompt
        if request.seed is not None:
            payload_input["seed"] = request.seed

        client = self._http()
        headers = {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
        }
        try:
            created = client.post(
                "https://api.replicate.com/v1/predictions",
                headers=headers,
                json={"version": self._model, "input": payload_input},
            )
        except httpx.HTTPError as exc:
            raise ProviderRequestError(f"could not reach Replicate: {exc}", retryable=True) from exc

        if created.status_code == 401:
            # An invalid token will never succeed on retry, so it is a
            # configuration failure rather than a transient request failure.
            raise ProviderNotConfiguredError("Replicate rejected the API token (401).")
        if created.status_code in (429, 502, 503, 504):
            raise ProviderRequestError(
                f"Replicate is unavailable ({created.status_code}).", retryable=True
            )
        if created.status_code >= 400:
            raise ProviderRequestError(
                f"Replicate rejected the request ({created.status_code}): {created.text[:300]}"
            )

        prediction = created.json()
        return self._await_prediction(client, headers, prediction, request)

    def _await_prediction(
        self,
        client: httpx.Client,
        headers: dict[str, str],
        prediction: dict,
        request: GenerationRequest,
    ) -> GenerationResult:
        deadline = time.monotonic() + self._timeout
        poll_url = (prediction.get("urls") or {}).get("get")

        while True:
            status = prediction.get("status")
            if status == "succeeded":
                return self._to_result(prediction, request)
            if status in ("failed", "canceled"):
                detail = prediction.get("error") or status
                raise ProviderRequestError(f"Replicate generation {status}: {detail}")
            if not poll_url:
                raise ProviderRequestError("Replicate response had no polling URL.")
            if time.monotonic() >= deadline:
                # Say how long was actually waited. "Timed out" alone sends
                # the reader looking for a hang that is really just a slow
                # model plus a too-tight ceiling.
                raise ProviderRequestError(
                    f"Replicate did not finish within {self._timeout}s (last status: {status}).",
                    retryable=True,
                )
            time.sleep(_POLL_INTERVAL_SECONDS)
            try:
                polled = client.get(poll_url, headers=headers)
            except httpx.HTTPError as exc:
                raise ProviderRequestError(
                    f"lost contact with Replicate while polling: {exc}", retryable=True
                ) from exc
            if polled.status_code >= 400:
                raise ProviderRequestError(
                    f"Replicate polling failed ({polled.status_code}).", retryable=True
                )
            prediction = polled.json()

    def _to_result(self, prediction: dict, request: GenerationRequest) -> GenerationResult:
        output = prediction.get("output")
        # Models disagree on output shape: MusicGen returns a bare URL string,
        # others return a list. Treating a list as a URL yields a "successful"
        # render whose audio_url is "['https://...']".
        if isinstance(output, list):
            output = next((item for item in output if isinstance(item, str)), None)
        if not isinstance(output, str) or not output:
            raise ProviderRequestError("Replicate returned no audio URL.")
        return GenerationResult(
            audio_url=output,
            provider=self.name,
            model=self._model,
            duration_seconds=request.duration_seconds,
            prompt=request.prompt,
            seed=request.seed,
            raw={"id": prediction.get("id"), "metrics": prediction.get("metrics")},
        )


class HuggingFaceProvider:
    """Hugging Face Inference. Free tier, no card, token required.

    The cheap way in: a token costs nothing and needs no payment method,
    unlike Replicate. The trade is throughput and cold starts, not quality --
    facebook/musicgen-small is the same family, one size down.

    Two behaviours here that are not optional to handle:

    * The response is the audio ITSELF, not a URL. Nothing hosts it but us,
      so a caller that does not persist the bytes loses the render.
    * A model that is not warm answers 503 with an `estimated_time`. That is
      a cold start, not a failure, and it resolves on its own -- so it is
      reported as retryable with the wait the API itself suggested.
    """

    name = "huggingface"

    # Anonymous inference was removed; router.huggingface.co is where the old
    # api-inference.huggingface.co host now points, and the old name no
    # longer resolves on its own.
    BASE_URL = "https://router.huggingface.co/hf-inference/models"

    def __init__(
        self,
        api_token: str,
        model: str,
        *,
        timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
        client: httpx.Client | None = None,
    ) -> None:
        if not api_token:
            raise ProviderNotConfiguredError(
                "HUGGINGFACE_API_TOKEN is not set. Create a free token (no "
                "payment method needed) at https://huggingface.co/settings/tokens"
            )
        self._token = api_token
        self._model = model
        self._timeout = timeout_seconds
        self._client = client

    def _http(self) -> httpx.Client:
        return self._client or httpx.Client(timeout=float(self._timeout))

    def generate(self, request: GenerationRequest) -> GenerationResult:
        client = self._http()
        try:
            response = client.post(
                f"{self.BASE_URL}/{self._model}",
                headers={
                    "Authorization": f"Bearer {self._token}",
                    "Content-Type": "application/json",
                },
                json={"inputs": request.prompt},
            )
        except httpx.HTTPError as exc:
            raise ProviderRequestError(
                f"could not reach Hugging Face: {exc}", retryable=True
            ) from exc

        if response.status_code in (401, 403):
            # An expired or wrong-scope token fails identically forever, so
            # this is configuration, never a retry. Worth naming explicitly:
            # a stale CLI OAuth token in ~/.cache/huggingface/token looks like
            # a token and is not one.
            raise ProviderNotConfiguredError(
                "Hugging Face rejected the token "
                f"({response.status_code}). Create a fresh one at "
                "https://huggingface.co/settings/tokens -- note that an "
                "expired `huggingface-cli login` OAuth token will also fail here."
            )
        if response.status_code == 503:
            raise ProviderRequestError(
                f"Model {self._model} is loading{self._loading_hint(response)}. "
                "This is a cold start, not a failure -- try again shortly.",
                retryable=True,
            )
        if response.status_code == 429:
            raise ProviderRequestError(
                "Hugging Face rate limit reached on the free tier.", retryable=True
            )
        if response.status_code >= 500:
            raise ProviderRequestError(
                f"Hugging Face is unavailable ({response.status_code}).", retryable=True
            )
        if response.status_code >= 400:
            raise ProviderRequestError(
                f"Hugging Face rejected the request ({response.status_code}): {response.text[:300]}"
            )

        content_type = (response.headers.get("content-type") or "").split(";")[0].strip()
        body = response.content
        # A JSON body on a 200 means an error the API chose not to signal in
        # the status line. Writing that to a .wav yields a file that plays as
        # silence and a bug report about "empty audio".
        if content_type.startswith("application/json") or body[:1] in (b"{", b"["):
            raise ProviderRequestError(
                f"Hugging Face returned JSON, not audio: {body[:300].decode(errors='replace')}"
            )
        if not body:
            raise ProviderRequestError("Hugging Face returned an empty response.")

        return GenerationResult(
            provider=self.name,
            model=self._model,
            # Reported, not requested: the hosted Inference API gives no
            # duration control for MusicGen, so claiming the caller's value
            # would be a lie. What comes back is the model's own default.
            duration_seconds=request.duration_seconds,
            prompt=request.prompt,
            audio_bytes=body,
            content_type=content_type or "audio/wav",
            seed=request.seed,
            raw={"bytes": len(body)},
        )

    @staticmethod
    def _loading_hint(response: httpx.Response) -> str:
        try:
            eta = response.json().get("estimated_time")
        except Exception:
            return ""
        return f" (about {int(float(eta))}s)" if eta else ""


class UnconfiguredProvider:
    """Stands in when nothing is configured, and says exactly what to do.

    Present so the feature degrades to a clear 503 with instructions instead
    of an import error or an empty 500 -- the app still builds, boots and
    serves every other route without a music provider.
    """

    name = "unconfigured"

    def generate(self, request: GenerationRequest) -> GenerationResult:
        raise ProviderNotConfiguredError(
            "No music provider is configured. Set MUSIC_PROVIDER=replicate and "
            "REPLICATE_API_TOKEN in the engine environment, or leave it unset "
            "to keep in-app rendering disabled."
        )


_REGISTRY: dict[str, str] = {"replicate": "replicate", "huggingface": "huggingface"}

# musicgen-small: the free tier's practical choice. Same family as the
# Replicate default, one size down, and it fits in the free tier's limits.
DEFAULT_HUGGINGFACE_MODEL = "facebook/musicgen-small"

# MusicGen-large. Pinned by version digest: Replicate models are mutable by
# tag, and an unpinned model silently changes what every render sounds like.
DEFAULT_REPLICATE_MODEL = "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb"


def get_provider(
    *,
    provider_name: str | None = None,
    api_token: str | None = None,
    model: str | None = None,
    client: httpx.Client | None = None,
) -> MusicProvider:
    """Resolve the configured provider. Never raises for a missing token.

    Returns `UnconfiguredProvider` rather than raising so that importing the
    API module, building the app and serving unrelated routes all work on an
    installation that has no music provider. The error surfaces at generate
    time, where it can be turned into a 503 the caller understands.
    """
    name = (provider_name or os.environ.get("MUSIC_PROVIDER") or "").strip().lower()
    if not name:
        return UnconfiguredProvider()
    if name not in _REGISTRY:
        raise ProviderNotConfiguredError(
            f"Unknown MUSIC_PROVIDER {name!r}. Supported: {', '.join(sorted(_REGISTRY))}."
        )

    if name == "huggingface":
        # HF_TOKEN is what the huggingface libraries themselves read, so it is
        # accepted too rather than forcing a second copy of the same secret.
        token = (
            api_token or os.environ.get("HUGGINGFACE_API_TOKEN") or os.environ.get("HF_TOKEN") or ""
        )
        if not token:
            return UnconfiguredProvider()
        return HuggingFaceProvider(
            token,
            model or os.environ.get("MUSIC_MODEL") or DEFAULT_HUGGINGFACE_MODEL,
            client=client,
        )

    token = api_token or os.environ.get("REPLICATE_API_TOKEN") or ""
    if not token:
        return UnconfiguredProvider()
    return ReplicateProvider(
        token,
        model or os.environ.get("MUSIC_MODEL") or DEFAULT_REPLICATE_MODEL,
        client=client,
    )

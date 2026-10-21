"""Optional laya-backed query routing for :class:`UnifiedRetriever`.

laya is a small text decision model served over HTTP (``POST {url}/v1/systemone``).
When it is configured, ``UnifiedRetriever`` asks it a single ``choice`` question --
which retriever fits this query? -- instead of counting keywords.

The keyword classifier stays the default and the fallback: laya is skipped when no
URL is configured, and its answer is ignored on any error, timeout, unexpected
response, unknown label, or a confidence below ``min_confidence``.

Plain HTTP via ``httpx`` on purpose: no laya package and no PyTorch dependency.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from typing import TYPE_CHECKING, Any

import httpx


if TYPE_CHECKING:
    from album_conceptualizer.config import Settings

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_SECONDS = 4.0
DEFAULT_MIN_CONFIDENCE = 0.6
RETRY_DELAY_SECONDS = 1.0

RETRIEVER_CRITERIA: dict[str, str] = {
    "lyrics": "lyrical ideas, imagery, wording, rhymes, or the mood and feel of song lyrics",
    "music_theory": "chords, progressions, keys, scales, harmony, rhythm, tempo, or melody",
    "narrative": "story, concept, characters, themes, arcs, or the structure of an album",
}


class LayaQueryRouter:
    """Classify a retrieval query into one of the retriever names via laya."""

    def __init__(
        self,
        url: str,
        api_key: str | None = None,
        *,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        min_confidence: float = DEFAULT_MIN_CONFIDENCE,
        client: httpx.Client | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self.endpoint = url.rstrip("/") + "/v1/systemone"
        self.api_key = api_key or None
        self.timeout = timeout
        self.min_confidence = min_confidence
        self._client = client
        self._sleep = sleep

    def _post(self, payload: dict[str, Any]) -> httpx.Response:
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        if self._client is not None:
            return self._client.post(
                self.endpoint, json=payload, headers=headers, timeout=self.timeout
            )
        return httpx.post(self.endpoint, json=payload, headers=headers, timeout=self.timeout)

    def _ask(self, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            response = self._post(payload)
        except httpx.ConnectError:
            # A freshly started laya pod can refuse connections for a few seconds.
            self._sleep(RETRY_DELAY_SECONDS)
            response = self._post(payload)
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict):
            raise ValueError("laya response is not an object")
        return data

    def classify(self, query: str) -> str | None:
        """Return a retriever name, or None when laya has no confident opinion."""
        payload = {
            "state": query,
            "questions": {
                "retriever": {
                    "type": "choice",
                    "instructions": (
                        "Which knowledge base best answers this songwriting / "
                        "concept-album research query?"
                    ),
                    "criteria": RETRIEVER_CRITERIA,
                }
            },
        }
        try:
            answer = self._ask(payload)["answers"]["retriever"]
            choice = answer["choice"]
            probabilities = answer.get("probabilities") or {}
            confidence = probabilities.get(choice, answer.get("answer_confidence"))
            confidence = float(confidence)
        except Exception as exc:  # any failure = no opinion; keyword routing takes over
            logger.warning("laya_route_unavailable", extra={"error": str(exc)})
            return None

        if choice not in RETRIEVER_CRITERIA:
            logger.warning("laya_route_unknown_label", extra={"choice": choice})
            return None
        if not confidence >= self.min_confidence:
            logger.debug(
                "laya_route_low_confidence",
                extra={"choice": choice, "confidence": confidence},
            )
            return None
        return str(choice)


def router_from_settings(settings: Settings | None = None) -> LayaQueryRouter | None:
    """Build a router when a laya URL is configured; None (integration off) otherwise."""
    if settings is None:
        from album_conceptualizer.config import get_settings

        settings = get_settings()
    url = (settings.laya_url or "").strip()
    if not url:
        return None
    return LayaQueryRouter(
        url,
        settings.laya_api_key,
        min_confidence=settings.laya_min_confidence,
    )

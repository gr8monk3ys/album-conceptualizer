"""Tests for the optional laya query router (laya is always mocked; no network)."""

import json
from unittest.mock import MagicMock

import httpx
import pytest

from album_conceptualizer.config import Settings
from album_conceptualizer.rag.laya_router import (
    RETRIEVER_CRITERIA,
    LayaQueryRouter,
    router_from_settings,
)
from album_conceptualizer.rag.retriever import UnifiedRetriever


def _answer(choice: str, p: float) -> dict:
    probabilities = {label: (p if label == choice else (1 - p) / 2) for label in RETRIEVER_CRITERIA}
    return {
        "answers": {
            "retriever": {
                "choice": choice,
                "probabilities": probabilities,
                "confidence": 0.5,
                "answer_confidence": p,
            }
        }
    }


def _router(handler, **kwargs) -> LayaQueryRouter:
    client = httpx.Client(transport=httpx.MockTransport(handler))
    return LayaQueryRouter(
        "http://laya.test:8000/", "secret", client=client, sleep=lambda _s: None, **kwargs
    )


def _unified(router) -> UnifiedRetriever:
    return UnifiedRetriever(MagicMock(), MagicMock(), laya_router=router)


# --- LayaQueryRouter ------------------------------------------------------------------------


def test_sends_choice_question_with_bearer_and_returns_label():
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers.get("Authorization")
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json=_answer("narrative", 0.82))

    assert _router(handler).classify("a story about a lighthouse keeper") == "narrative"
    assert seen["url"] == "http://laya.test:8000/v1/systemone"
    assert seen["auth"] == "Bearer secret"
    question = seen["body"]["questions"]["retriever"]
    assert question["type"] == "choice"
    assert set(question["criteria"]) == {"lyrics", "music_theory", "narrative"}
    assert seen["body"]["state"] == "a story about a lighthouse keeper"


def test_low_confidence_is_no_opinion():
    router = _router(lambda _r: httpx.Response(200, json=_answer("lyrics", 0.45)))
    assert router.classify("anything") is None


def test_min_confidence_is_configurable():
    router = _router(
        lambda _r: httpx.Response(200, json=_answer("lyrics", 0.45)), min_confidence=0.4
    )
    assert router.classify("anything") == "lyrics"


def test_retries_once_on_connection_refused():
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(1)
        if len(calls) == 1:
            raise httpx.ConnectError("connection refused", request=request)
        return httpx.Response(200, json=_answer("music_theory", 0.9))

    assert _router(handler).classify("ii-V-I in F") == "music_theory"
    assert len(calls) == 2


def _raise_timeout(request: httpx.Request) -> httpx.Response:
    raise httpx.ReadTimeout("slow", request=request)


def _raise_refused(request: httpx.Request) -> httpx.Response:
    raise httpx.ConnectError("refused", request=request)


@pytest.mark.parametrize(
    "handler",
    [
        _raise_timeout,
        _raise_refused,  # still refused after the one retry
        lambda _r: httpx.Response(422, json={"detail": "bad question"}),
        lambda _r: httpx.Response(200, json={"detail": "oops"}),
        lambda _r: httpx.Response(200, text="not json"),
        lambda _r: httpx.Response(200, json=[1, 2]),
        lambda _r: httpx.Response(200, json=_answer("jazz", 0.99)),
        lambda _r: httpx.Response(
            200, json={"answers": {"retriever": {"choice": "lyrics", "probabilities": {}}}}
        ),
    ],
)
def test_errors_and_odd_answers_are_no_opinion(handler):
    assert _router(handler).classify("query") is None


def test_default_client_uses_httpx_post(monkeypatch):
    captured = {}

    def fake_post(url, **kwargs):
        captured.update(url=url, **kwargs)
        return httpx.Response(200, json=_answer("lyrics", 0.7), request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "post", fake_post)
    router = LayaQueryRouter("http://laya.test", None, timeout=3.0)
    assert router.classify("rainy night imagery") == "lyrics"
    assert captured["timeout"] == 3.0
    assert captured["headers"] == {}


# --- settings wiring ------------------------------------------------------------------------


def test_router_from_settings_off_without_url(monkeypatch):
    for name in ("LAYA_URL", "ALBUM_CONCEPTUALIZER_LAYA_URL"):
        monkeypatch.delenv(name, raising=False)
    assert router_from_settings(Settings(_env_file=None)) is None
    assert router_from_settings(Settings(_env_file=None, LAYA_URL="  ")) is None


def test_router_from_settings_accepts_plain_and_prefixed_env(monkeypatch):
    for name in ("ALBUM_CONCEPTUALIZER_LAYA_URL", "ALBUM_CONCEPTUALIZER_LAYA_MIN_CONFIDENCE"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("LAYA_URL", "http://plain")
    monkeypatch.setenv("LAYA_API_KEY", "k1")
    router = router_from_settings(Settings(_env_file=None))
    assert router is not None
    assert router.endpoint == "http://plain/v1/systemone"
    assert router.api_key == "k1"
    assert router.min_confidence == 0.6

    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_LAYA_URL", "http://prefixed/")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_LAYA_MIN_CONFIDENCE", "0.75")
    router = router_from_settings(Settings(_env_file=None))
    assert router is not None
    assert router.endpoint == "http://prefixed/v1/systemone"
    assert router.min_confidence == 0.75


def test_unified_retriever_builds_router_from_settings_by_default(monkeypatch):
    import album_conceptualizer.rag.retriever as retriever_module

    sentinel = MagicMock()
    monkeypatch.setattr(retriever_module, "router_from_settings", lambda: sentinel)
    assert UnifiedRetriever(MagicMock(), MagicMock()).laya_router is sentinel


# --- UnifiedRetriever routing ---------------------------------------------------------------


def test_classify_uses_laya_when_confident():
    router = MagicMock()
    router.classify.return_value = "narrative"
    # Keywords alone would say music_theory ("chord", "progression").
    assert (
        _unified(router)._classify_query("chord progression for the villain's arc") == "narrative"
    )


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("chord progression in D minor", "music_theory"),
        ("story arc for the second act", "narrative"),
        ("rainy night imagery", "lyrics"),
    ],
)
def test_classify_falls_back_to_keywords_when_laya_has_no_opinion(query, expected):
    router = MagicMock()
    router.classify.return_value = None
    assert _unified(router)._classify_query(query) == expected


def test_classify_uses_keywords_when_unconfigured():
    unified = _unified(None)
    assert unified.laya_router is None
    assert unified._classify_query("chord progression in D minor") == "music_theory"


def test_auto_retrieve_routes_to_laya_choice():
    router = MagicMock()
    router.classify.return_value = "narrative"
    unified = _unified(router)
    unified.narrative_retriever = MagicMock()
    unified.narrative_retriever.retrieve.return_value = ["doc"]
    assert unified.retrieve("anything", top_k=2) == ["doc"]
    unified.narrative_retriever.retrieve.assert_called_once_with("anything", top_k=2)


def test_explicit_retriever_type_skips_laya():
    router = MagicMock()
    unified = _unified(router)
    unified.lyrics_retriever = MagicMock()
    unified.retrieve("q", retriever_type="lyrics")
    router.classify.assert_not_called()

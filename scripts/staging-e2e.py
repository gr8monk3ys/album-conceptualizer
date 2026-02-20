#!/usr/bin/env python3
"""Run end-to-end API smoke flow against a staging (or local) deployment."""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import time
from typing import Any

import httpx


def fail(message: str) -> int:
    """Print a standardized failure message and return failing exit code."""
    print(f"[FAIL] {message}")
    return 1


def request_json(
    client: httpx.Client,
    method: str,
    url: str,
    *,
    expected_status: int,
    **kwargs: Any,
) -> dict[str, Any] | list[Any] | None:
    """Perform an HTTP request and parse JSON when expected status matches."""
    response = client.request(method, url, **kwargs)
    if response.status_code != expected_status:
        print(f"[HTTP {response.status_code}] {method} {url}")
        body = response.text.strip()
        print(body or "<empty>")
        return None
    if not response.content:
        return {}
    return response.json()


def normalize_base_url(base_url: str) -> str:
    """Normalize base URL so callers can pass either host root or /api(/v1) URL."""
    normalized = base_url.rstrip("/")
    for suffix in ("/api/v1", "/api"):
        if normalized.endswith(suffix):
            normalized = normalized[: -len(suffix)]
    return normalized


def build_stripe_signature(payload: bytes, secret: str) -> str:
    """Build Stripe-compatible webhook signature for test payloads."""
    timestamp = str(int(time.time()))
    signed_payload = f"{timestamp}.".encode("utf-8") + payload
    digest = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={digest}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base-url",
        default=os.getenv("ALBUM_CONCEPTUALIZER_BASE_URL", "http://localhost:8000"),
        help=(
            "API base URL. Accepts host root or URLs ending with /api or /api/v1 "
            "(default: %(default)s)."
        ),
    )
    parser.add_argument(
        "--api-key",
        default=os.getenv("ALBUM_CONCEPTUALIZER_API_KEY"),
        help="API key for protected endpoints",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=25.0,
        help="HTTP timeout in seconds (default: %(default)s)",
    )
    parser.add_argument(
        "--insecure",
        action="store_true",
        help="Disable TLS certificate verification (useful for local self-signed HTTPS).",
    )
    parser.add_argument(
        "--verify-billing-checkout",
        action="store_true",
        help="Verify Stripe checkout-session creation endpoint.",
    )
    parser.add_argument(
        "--verify-billing-webhook",
        action="store_true",
        help="Verify Stripe webhook signature handling using a signed noop event.",
    )
    parser.add_argument(
        "--stripe-webhook-secret",
        default=(
            os.getenv("ALBUM_CONCEPTUALIZER_STRIPE_WEBHOOK_SECRET")
            or os.getenv("STRIPE_WEBHOOK_SECRET")
        ),
        help=(
            "Stripe webhook secret used for --verify-billing-webhook. "
            "Defaults to ALBUM_CONCEPTUALIZER_STRIPE_WEBHOOK_SECRET/STRIPE_WEBHOOK_SECRET."
        ),
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.api_key:
        return fail("Missing API key. Set --api-key or ALBUM_CONCEPTUALIZER_API_KEY.")

    base_url = normalize_base_url(args.base_url)
    headers = {"X-API-Key": args.api_key}
    created_album_id: str | None = None

    with httpx.Client(
        timeout=args.timeout,
        follow_redirects=True,
        verify=not args.insecure,
    ) as client:
        print("[STEP] Health check")
        health = request_json(client, "GET", f"{base_url}/api/v1/health", expected_status=200)
        if health is None:
            return fail("Health endpoint failed.")

        print("[STEP] Create album")
        created_album = request_json(
            client,
            "POST",
            f"{base_url}/api/v1/albums",
            expected_status=201,
            headers=headers,
            json={
                "title": "E2E Launch Run",
                "artist": "Staging Bot",
                "concept_summary": "A controlled end-to-end launch rehearsal.",
                "primary_genre": "Synth Pop",
                "central_themes": ["migration", "recovery", "momentum"],
            },
        )
        if not isinstance(created_album, dict):
            return fail("Album creation failed.")
        created_album_id = str(created_album["id"])

        print("[STEP] Create songs")
        song_payloads = [
            {
                "title": "Boot Sequence",
                "track_number": 1,
                "narrative_summary": "System awakens to a broken city map.",
                "sections": [
                    {
                        "section_type": "verse",
                        "order": 1,
                        "lyrics": "Cold lights and checkpoints",
                        "chord_progression": ["C", "G", "Am", "F"],
                    },
                    {
                        "section_type": "chorus",
                        "order": 2,
                        "lyrics": "Restart me now",
                        "chord_progression": ["F", "G", "C", "Am"],
                    },
                ],
            },
            {
                "title": "Signal Return",
                "track_number": 2,
                "narrative_summary": "The first human voice cuts through static.",
                "sections": [
                    {
                        "section_type": "verse",
                        "order": 1,
                        "lyrics": "Call signs in thunder",
                        "chord_progression": ["Dm", "Bb", "F", "C"],
                    }
                ],
            },
        ]
        for song in song_payloads:
            song_resp = request_json(
                client,
                "POST",
                f"{base_url}/api/v1/albums/{created_album_id}/songs",
                expected_status=201,
                headers=headers,
                json=song,
            )
            if not isinstance(song_resp, dict):
                return fail("Song creation failed.")

        print("[STEP] Seed album bible")
        bible = request_json(
            client,
            "PUT",
            f"{base_url}/api/v1/albums/{created_album_id}/bible",
            expected_status=200,
            headers=headers,
            json={
                "logline": "A fractured signal guides survivors into a shared future.",
                "synopsis": "Each song marks a station in a distributed recovery narrative.",
                "setting": "Rainline district",
            },
        )
        if not isinstance(bible, dict):
            return fail("Bible update failed.")

        print("[STEP] Exercise experience endpoints")
        experience_calls = [
            ("GET", f"{base_url}/api/v1/experience/prompt-packs", 200, None),
            ("GET", f"{base_url}/api/v1/experience/templates", 200, None),
            (
                "POST",
                f"{base_url}/api/v1/experience/style-capture",
                200,
                {
                    "reference_tracks": [
                        {
                            "title": "Ref A",
                            "tempo": 124,
                            "key": "C major",
                            "chord_progression": ["C", "G", "Am", "F"],
                            "mood_tags": ["cinematic"],
                        },
                        {
                            "title": "Ref B",
                            "tempo": 132,
                            "key": "G major",
                            "chord_progression": ["G", "D", "Em", "C"],
                            "mood_tags": ["energetic"],
                        },
                    ]
                },
            ),
            (
                "POST",
                f"{base_url}/api/v1/experience/reference-analyzer",
                200,
                {
                    "album_goal": "High-retention hook architecture",
                    "target_track_count": 6,
                    "desired_energy_curve": "wave",
                    "reference_tracks": [
                        {
                            "title": "Ref A",
                            "tempo": 124,
                            "key": "C major",
                            "chord_progression": ["C", "G", "Am", "F"],
                            "mood_tags": ["cinematic", "hooky"],
                            "production_tags": ["wide drums"],
                        },
                        {
                            "title": "Ref B",
                            "tempo": 132,
                            "key": "G major",
                            "chord_progression": ["G", "D", "Em", "C"],
                            "mood_tags": ["energetic"],
                            "production_tags": ["bass-forward"],
                        },
                    ],
                },
            ),
            (
                "POST",
                f"{base_url}/api/v1/albums/{created_album_id}/experience/jam-mode",
                200,
                {"pack_id": "festival-ready", "focus": "live-first hooks"},
            ),
            (
                "GET",
                f"{base_url}/api/v1/albums/{created_album_id}/experience/timeline-board",
                200,
                None,
            ),
            (
                "GET",
                f"{base_url}/api/v1/albums/{created_album_id}/experience/progress-coach",
                200,
                None,
            ),
            (
                "GET",
                f"{base_url}/api/v1/albums/{created_album_id}/experience/release-kit",
                200,
                None,
            ),
            (
                "GET",
                f"{base_url}/api/v1/albums/{created_album_id}/experience/release-campaign",
                200,
                None,
            ),
            (
                "POST",
                f"{base_url}/api/v1/albums/{created_album_id}/experience/audio-preview",
                200,
                {"track_numbers": [1, 2], "bars_per_chord": 1.5},
            ),
        ]
        for method, url, status_code, payload in experience_calls:
            result = request_json(
                client,
                method,
                url,
                expected_status=status_code,
                headers=headers,
                json=payload,
            )
            if result is None:
                return fail(f"Experience endpoint failed: {method} {url}")

        print("[STEP] Apply a template pack")
        template_apply = request_json(
            client,
            "POST",
            f"{base_url}/api/v1/albums/{created_album_id}/experience/templates/neon-city-arc/apply",
            expected_status=200,
            headers=headers,
            json={"mode": "merge", "add_tracks": True},
        )
        if not isinstance(template_apply, dict):
            return fail("Template apply endpoint failed.")

        print("[STEP] Exercise collaboration rooms")
        room = request_json(
            client,
            "POST",
            f"{base_url}/api/v1/albums/{created_album_id}/experience/collab-rooms",
            expected_status=200,
            headers=headers,
            json={
                "name": "Night Session",
                "host_alias": "staging-host",
                "focus": "hook rewrites",
                "visibility": "team",
            },
        )
        if not isinstance(room, dict):
            return fail("Collab room creation failed.")
        room_id = str(room["id"])

        join_resp = request_json(
            client,
            "POST",
            f"{base_url}/api/v1/albums/{created_album_id}/experience/collab-rooms/{room_id}/join",
            expected_status=200,
            headers=headers,
            json={"alias": "staging-guest", "role": "writer"},
        )
        if not isinstance(join_resp, dict):
            return fail("Collab room join failed.")

        comment_resp = request_json(
            client,
            "POST",
            f"{base_url}/api/v1/albums/{created_album_id}/experience/collab-rooms/{room_id}/comments",
            expected_status=200,
            headers=headers,
            json={
                "alias": "staging-guest",
                "message": "Hook variation #2 feels strongest.",
                "track_number": 1,
            },
        )
        if not isinstance(comment_resp, dict):
            return fail("Collab room comment failed.")

        snapshot_resp = request_json(
            client,
            "POST",
            f"{base_url}/api/v1/albums/{created_album_id}/experience/collab-rooms/{room_id}/snapshots",
            expected_status=200,
            headers=headers,
            json={"alias": "staging-host", "summary": "Locked chorus motifs for tracks 1 and 2."},
        )
        if not isinstance(snapshot_resp, dict):
            return fail("Collab room snapshot failed.")

        board_item = request_json(
            client,
            "POST",
            f"{base_url}/api/v1/albums/{created_album_id}/experience/collab-rooms/{room_id}/board-items",
            expected_status=200,
            headers=headers,
            json={"alias": "staging-host", "title": "Open with dry drums", "track_number": 1},
        )
        if not isinstance(board_item, dict):
            return fail("Collab room board-item creation failed.")
        board_items = board_item.get("board_items")
        if not isinstance(board_items, list) or not board_items:
            return fail("Collab room board-items payload is empty.")
        board_item_id = str(board_items[0]["id"])

        board_vote = request_json(
            client,
            "POST",
            (
                f"{base_url}/api/v1/albums/{created_album_id}/experience/collab-rooms/"
                f"{room_id}/board-items/{board_item_id}/vote"
            ),
            expected_status=200,
            headers=headers,
            json={"alias": "staging-guest", "value": 1},
        )
        if not isinstance(board_vote, dict):
            return fail("Collab room board-item vote failed.")

        room_list = request_json(
            client,
            "GET",
            f"{base_url}/api/v1/albums/{created_album_id}/experience/collab-rooms",
            expected_status=200,
            headers=headers,
        )
        if not isinstance(room_list, list) or not room_list:
            return fail("Collab room list failed.")

        print("[STEP] Exercise challenge mode and scorecard")
        weekly = request_json(
            client,
            "GET",
            f"{base_url}/api/v1/experience/challenges/weekly",
            expected_status=200,
            headers=headers,
        )
        if not isinstance(weekly, dict):
            return fail("Weekly challenge endpoint failed.")
        challenge_id = str((weekly.get("challenge") or {}).get("id"))
        if not challenge_id:
            return fail("Weekly challenge payload missing challenge id.")

        run_payload = request_json(
            client,
            "POST",
            f"{base_url}/api/v1/albums/{created_album_id}/experience/challenges/{challenge_id}/run",
            expected_status=200,
            headers=headers,
            params=[("track_numbers", "1"), ("track_numbers", "2")],
        )
        if not isinstance(run_payload, dict):
            return fail("Challenge run endpoint failed.")

        completion = request_json(
            client,
            "POST",
            f"{base_url}/api/v1/experience/challenges/{challenge_id}/complete",
            expected_status=200,
            headers=headers,
            json={
                "completed_tracks": [1, 2],
                "minutes_spent": 45,
                "quality_rating": 4,
                "notes": "Strong momentum in final pass.",
            },
        )
        if not isinstance(completion, dict) or completion.get("total_points", 0) <= 0:
            return fail("Challenge completion endpoint failed.")

        scorecard = request_json(
            client,
            "GET",
            f"{base_url}/api/v1/experience/challenges/scorecard",
            expected_status=200,
            headers=headers,
        )
        if not isinstance(scorecard, dict):
            return fail("Challenge scorecard endpoint failed.")

        leaderboard = request_json(
            client,
            "GET",
            f"{base_url}/api/v1/experience/challenges/leaderboard",
            expected_status=200,
            headers=headers,
        )
        if not isinstance(leaderboard, dict):
            return fail("Challenge leaderboard endpoint failed.")

        print("[STEP] Exercise creator memory and release-kit bundle")
        memory_profile = request_json(
            client,
            "POST",
            f"{base_url}/api/v1/experience/creator-memory/preferences",
            expected_status=200,
            headers=headers,
            json={
                "display_name": "staging-creator",
                "preferred_genres": ["alt pop", "indie electronic"],
                "preferred_themes": ["identity", "recovery"],
                "preferred_moods": ["cinematic"],
                "workflow_preferences": ["45-minute focused sprint"],
                "goals": ["ship one polished hook per day"],
            },
        )
        if not isinstance(memory_profile, dict):
            return fail("Creator memory preference endpoint failed.")

        memory_event = request_json(
            client,
            "POST",
            f"{base_url}/api/v1/experience/creator-memory/events",
            expected_status=200,
            headers=headers,
            json={
                "event_type": "session-win",
                "label": "Locked chorus for track 1",
                "album_id": created_album_id,
                "metadata": {"session_type": "hook-pass"},
            },
        )
        if not isinstance(memory_event, dict):
            return fail("Creator memory event endpoint failed.")

        personalized = request_json(
            client,
            "GET",
            (
                f"{base_url}/api/v1/albums/{created_album_id}/experience/"
                "creator-memory/recommendations"
            ),
            expected_status=200,
            headers=headers,
        )
        if not isinstance(personalized, dict):
            return fail("Creator memory recommendations endpoint failed.")

        release_export = request_json(
            client,
            "POST",
            f"{base_url}/api/v1/albums/{created_album_id}/experience/release-kit/export",
            expected_status=200,
            headers=headers,
            json={
                "platform": "spotify",
                "duration_days": 10,
                "include_campaign_csv": True,
                "include_json_manifest": True,
            },
        )
        if not isinstance(release_export, dict) or not release_export.get("zip_path"):
            return fail("Release-kit export endpoint failed.")

        print("[STEP] Exercise remix battle mode")
        battle = request_json(
            client,
            "POST",
            f"{base_url}/api/v1/albums/{created_album_id}/experience/remix-battles",
            expected_status=200,
            headers=headers,
            json={
                "alias": "staging-host",
                "title": "Neon Hook Battle",
                "prompt": "Remix track 1 into a higher-energy late-night version.",
            },
        )
        if not isinstance(battle, dict):
            return fail("Remix battle creation failed.")
        battle_id = str(battle["id"])

        submission = request_json(
            client,
            "POST",
            f"{base_url}/api/v1/albums/{created_album_id}/experience/remix-battles/{battle_id}/submissions",
            expected_status=200,
            headers=headers,
            json={
                "alias": "staging-guest",
                "title": "Pulse Runner",
                "concept": "Pushsynth bass and vocal chop counterpoint.",
                "preview_hook": "I run on neon static.",
            },
        )
        if not isinstance(submission, dict):
            return fail("Remix battle submission failed.")
        submissions = submission.get("submissions")
        if not isinstance(submissions, list) or not submissions:
            return fail("Remix battle submission payload is empty.")
        submission_id = str(submissions[0]["id"])

        voted = request_json(
            client,
            "POST",
            (
                f"{base_url}/api/v1/albums/{created_album_id}/experience/remix-battles/"
                f"{battle_id}/submissions/{submission_id}/vote"
            ),
            expected_status=200,
            headers=headers,
            json={"alias": "staging-host", "score": 5},
        )
        if not isinstance(voted, dict):
            return fail("Remix battle vote failed.")

        share_slug = str(voted.get("share_slug") or "")
        if not share_slug:
            return fail("Remix battle missing share_slug.")
        public_page = request_json(
            client,
            "GET",
            f"{base_url}/api/v1/experience/remix-battles/share/{share_slug}",
            expected_status=200,
            headers=headers,
        )
        if not isinstance(public_page, dict):
            return fail("Remix battle public page failed.")

        closed = request_json(
            client,
            "POST",
            f"{base_url}/api/v1/albums/{created_album_id}/experience/remix-battles/{battle_id}/close",
            expected_status=200,
            headers=headers,
            json={"alias": "staging-host"},
        )
        if not isinstance(closed, dict) or closed.get("status") != "closed":
            return fail("Remix battle close failed.")

        print("[STEP] Exercise DAW handoff pack")
        daw_handoff = request_json(
            client,
            "POST",
            f"{base_url}/api/v1/albums/{created_album_id}/experience/daw-handoff",
            expected_status=200,
            headers=headers,
            json={
                "daw_targets": ["ableton", "logic"],
                "include_midi_guides": True,
                "bpm_strategy": "median",
            },
        )
        if not isinstance(daw_handoff, dict) or not daw_handoff.get("zip_path"):
            return fail("DAW handoff endpoint failed.")

        print("[STEP] Exercise export endpoint")
        chordpro = client.get(
            f"{base_url}/api/v1/export/album/{created_album_id}/chordpro",
            headers=headers,
        )
        if chordpro.status_code != 200 or "{title:" not in chordpro.text:
            return fail("ChordPro export failed.")

        print("[STEP] Check billing status endpoint")
        billing_status = request_json(
            client,
            "GET",
            f"{base_url}/api/v1/billing/subscription",
            expected_status=200,
            headers=headers,
        )
        if billing_status is None:
            return fail("Billing status endpoint failed.")

        if args.verify_billing_checkout:
            print("[STEP] Verify billing checkout-session creation")
            checkout = request_json(
                client,
                "POST",
                f"{base_url}/api/v1/billing/checkout-session",
                expected_status=200,
                headers=headers,
                json={"plan": "pro", "quantity": 1},
            )
            if not isinstance(checkout, dict):
                return fail("Billing checkout-session endpoint failed.")
            session_id = str(checkout.get("session_id") or "").strip()
            checkout_url = str(checkout.get("url") or "").strip()
            if not session_id or not checkout_url:
                return fail("Billing checkout-session missing session_id/url.")
            if "stripe.com" not in checkout_url:
                return fail("Billing checkout URL does not look like Stripe-hosted checkout.")

        if args.verify_billing_webhook:
            print("[STEP] Verify billing webhook signature handling")
            secret = (args.stripe_webhook_secret or "").strip()
            if not secret:
                return fail("Missing Stripe webhook secret for webhook verification.")

            webhook_payload = {
                "id": "evt_e2e_signature_probe",
                "object": "event",
                "api_version": "2024-10-28.acacia",
                "created": int(time.time()),
                "type": "payment_intent.succeeded",
                "data": {"object": {"id": "pi_e2e_signature_probe", "object": "payment_intent"}},
            }
            payload_bytes = json.dumps(webhook_payload, separators=(",", ":")).encode("utf-8")
            signature = build_stripe_signature(payload_bytes, secret)

            # First ensure unsigned payload is rejected.
            unsigned = client.post(
                f"{base_url}/api/v1/billing/webhook",
                headers={"content-type": "application/json"},
                content=payload_bytes,
            )
            if unsigned.status_code != 400:
                return fail(
                    f"Billing webhook should reject unsigned payloads (got {unsigned.status_code})."
                )

            signed = request_json(
                client,
                "POST",
                f"{base_url}/api/v1/billing/webhook",
                expected_status=200,
                headers={
                    "content-type": "application/json",
                    "stripe-signature": signature,
                },
                content=payload_bytes,
            )
            if not isinstance(signed, dict) or not signed.get("received"):
                return fail("Billing webhook signed event acknowledgement failed.")

        print("[PASS] E2E staging flow completed successfully.")

    if created_album_id:
        # Best-effort cleanup outside main flow so success can still be reported.
        try:
            with httpx.Client(
                timeout=args.timeout,
                follow_redirects=True,
                verify=not args.insecure,
            ) as cleanup_client:
                cleanup_client.delete(
                    f"{base_url}/api/v1/albums/{created_album_id}",
                    headers=headers,
                )
        except Exception as exc:
            print(f"[WARN] Cleanup request failed: {exc}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

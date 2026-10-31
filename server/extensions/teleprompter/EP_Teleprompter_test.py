# SPDX-License-Identifier: AGPL-3.0-or-later
"""The teleprompter extension against a real server: scripts with their word
count and stale-save rules, folders, one settings record per user, team sharing
and every paid feature refused (402) on the free plan, a pro subscriber's
recording stored, read back and deleted with its video, captions served once a
take is transcribed, clear refusals when no AI is configured, and one user's
scripts invisible to another."""

import secrets
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from zephyrex.lib.Environment import env
from zephyrex.testing.factories import create_user

from zephyreader_app import create

PRO_PRICE = "price_test_pro"
VIDEO = b"\x1aE\xdf\xa3" + secrets.token_bytes(2048)


@pytest.fixture(scope="module")
def server() -> Iterator[TestClient]:
    with pytest.MonkeyPatch.context() as patch:
        patch.setenv("ENTITLEMENT_PRO_PLAN_IDS", PRO_PRICE)
        yield TestClient(create())


@pytest.fixture(scope="module")
def free_user(server: TestClient) -> Any:
    return create_user(server)


@pytest.fixture(scope="module")
def other_user(server: TestClient) -> Any:
    return create_user(server)


@pytest.fixture(scope="module")
def store(server: TestClient) -> Path:
    """The deployment's recording store: a local-disk cloud instance."""
    from zephyrex.logic.BLL_Providers import (
        ProviderInstanceManager,
        ProviderInstanceSettingManager,
        ProviderManager,
    )

    registry = _registry(server)
    root_id = env("ROOT_ID")
    directory = Path(str(env("CLOUD_LOCAL_DIRECTORY")))
    record = ProviderManager(model_registry=registry, requester_id=root_id).get(name="local_disk")
    instance = ProviderInstanceManager(model_registry=registry, requester_id=root_id).create(
        name=f"test-store-{secrets.token_hex(4)}", provider_id=record.id, scope="root"
    )
    ProviderInstanceSettingManager(model_registry=registry, requester_id=root_id).create(
        provider_instance_id=instance.id, key="directory", value=str(directory)
    )
    return directory


@pytest.fixture(scope="module")
def pro_user(server: TestClient) -> Any:
    """A user with an active subscription to the pro plan."""
    from zephyrex.extensions.payment.BLL_Payment import PaymentSubscriptionManager

    user = create_user(server)
    PaymentSubscriptionManager(model_registry=_registry(server), requester_id=env("ROOT_ID")).create(
        user_id=user.id,
        provider="stripe",
        provider_instance_id=str(uuid.uuid4()),
        external_id=f"sub_{uuid.uuid4().hex}",
        plan_id=PRO_PRICE,
        status="active",
        active=True,
        refreshed_at=datetime.now(UTC),
    )
    return user


def _registry(server: TestClient) -> Any:
    """The app's model registry (TestClient types its app as any ASGI app)."""
    app = server.app
    assert isinstance(app, FastAPI)
    return app.state.model_registry


def _headers(user: Any, **extra: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {user.jwt}", **extra}


def _create(server: TestClient, user: Any, resource: str, **fields: Any) -> Any:
    response = server.post(f"/v1/{resource}", json={resource: fields}, headers=_headers(user))
    assert response.status_code == 201, response.text
    return response


class TestScripts:
    def test_create_list_update_with_word_count_and_stale_saves(self, server: TestClient, free_user: Any) -> None:
        created = _create(server, free_user, "script", title="Keynote", content="Good evening [smile] everyone")
        script = created.json()["script"]
        assert script["word_count"] == 4
        assert created.headers["ETag"]

        listed = server.get("/v1/script", headers=_headers(free_user)).json()["scripts"]
        assert [s["id"] for s in listed] == [script["id"]]

        url = f"/v1/script/{script['id']}"
        no_version = server.put(url, json={"script": {"content": "Hi"}}, headers=_headers(free_user))
        assert no_version.status_code == 428
        fresh = server.put(
            url,
            json={"script": {"content": "Hello there friends", "word_count": 99}},
            headers=_headers(free_user, **{"If-Match": created.headers["ETag"]}),
        )
        assert fresh.status_code == 200, fresh.text
        assert fresh.json()["script"]["word_count"] == 3
        stale = server.put(
            url,
            json={"script": {"content": "Overwrite"}},
            headers=_headers(free_user, **{"If-Match": created.headers["ETag"]}),
        )
        assert stale.status_code == 412

    def test_a_script_files_in_a_folder(self, server: TestClient, free_user: Any) -> None:
        folder = _create(server, free_user, "script_folder", name="Talks").json()["script_folder"]
        script = _create(server, free_user, "script", title="Opening", script_folder_id=folder["id"]).json()["script"]
        assert script["script_folder_id"] == folder["id"]

    def test_another_user_cannot_see_or_change_a_script(
        self, server: TestClient, free_user: Any, other_user: Any
    ) -> None:
        created = _create(server, free_user, "script", title="Private")
        script_id = created.json()["script"]["id"]
        assert server.get(f"/v1/script/{script_id}", headers=_headers(other_user)).status_code in (403, 404)
        assert all(
            s["id"] != script_id for s in server.get("/v1/script", headers=_headers(other_user)).json()["scripts"]
        )
        changed = server.put(
            f"/v1/script/{script_id}",
            json={"script": {"title": "Mine now"}},
            headers=_headers(other_user, **{"If-Match": created.headers["ETag"]}),
        )
        assert changed.status_code in (403, 404)

    def test_team_sharing_needs_the_team_plan(self, server: TestClient, free_user: Any) -> None:
        refused = server.post(
            "/v1/script",
            json={"script": {"title": "Shared", "team_id": str(uuid.uuid4())}},
            headers=_headers(free_user),
        )
        assert refused.status_code == 402, refused.text
        assert refused.json()["detail"]["feature"] == "team_sharing"


class TestPreferences:
    def test_one_settings_record_per_user(self, server: TestClient, other_user: Any) -> None:
        created = _create(server, other_user, "prompter_preference", settings={"font_size": 48, "mirror": "none"})
        assert created.json()["prompter_preference"]["settings"] == {"font_size": 48, "mirror": "none"}
        again = server.post(
            "/v1/prompter_preference",
            json={"prompter_preference": {"settings": {}}},
            headers=_headers(other_user),
        )
        assert again.status_code == 409


class TestPaidFeaturesOnTheFreePlan:
    @pytest.mark.parametrize(
        "method, path, body, feature",
        [
            ("post", "/v1/recording", {"recording": {"title": "Take", "mime_type": "video/webm"}}, "cloud_recordings"),
            ("post", "/v1/teleprompter/ai", {"action": "shorten", "content": "Hello"}, "ai_writer"),
        ],
    )
    def test_refused_with_402(
        self, server: TestClient, free_user: Any, method: Any, path: Any, body: Any, feature: Any
    ) -> None:
        response = getattr(server, method)(path, json=body, headers=_headers(free_user))
        assert response.status_code == 402, response.text
        assert response.json()["detail"]["feature"] == feature

    def test_server_voice_refused_with_402(self, server: TestClient, free_user: Any) -> None:
        response = server.post(
            "/v1/teleprompter/transcribe",
            content=b"OggS",
            headers=_headers(free_user, **{"Content-Type": "audio/ogg"}),
        )
        assert response.status_code == 402
        assert response.json()["detail"]["feature"] == "server_voice"


class TestRecordings:
    def test_store_read_caption_and_delete_with_the_video(self, server: TestClient, pro_user: Any, store: Path) -> None:
        created = _create(server, pro_user, "recording", title="Take 1", mime_type="video/webm;codecs=vp9")
        recording = created.json()["recording"]
        assert recording["mime_type"] == "video/webm"
        url = f"/v1/recording/{recording['id']}"

        put = server.put(
            f"{url}/content",
            content=VIDEO,
            headers=_headers(pro_user, **{"Content-Type": "video/webm", "If-Match": created.headers["ETag"]}),
        )
        assert put.status_code == 200, put.text
        stored = put.json()["recording"]
        assert stored["size_bytes"] == len(VIDEO)
        assert stored["storage_provider"] == "local_disk"
        assert (store / stored["storage_path"]).read_bytes() == VIDEO

        # A client cannot write what the server keeps (where the video is, its size, captions).
        forged = server.put(
            url,
            json={"recording": {"title": "Take 1b", "size_bytes": 1, "storage_path": "../elsewhere"}},
            headers=_headers(pro_user, **{"If-Match": put.headers["ETag"]}),
        )
        assert forged.status_code == 200, forged.text
        assert forged.json()["recording"]["title"] == "Take 1b"
        assert forged.json()["recording"]["size_bytes"] == len(VIDEO)
        assert forged.json()["recording"]["storage_path"] == stored["storage_path"]

        read = server.get(f"{url}/content", headers=_headers(pro_user))
        assert read.status_code == 200
        assert read.content == VIDEO
        assert read.headers["content-type"] == "video/webm"

        # No captions until transcribed; with no AI configured, transcribing says so (not a 500).
        assert server.get(f"{url}/captions", headers=_headers(pro_user)).status_code == 404
        unconfigured = server.post(f"{url}/captions", json={}, headers=_headers(pro_user))
        assert unconfigured.status_code == 503, unconfigured.text

        # Resolves only at runtime, through the extensions namespace path.
        from zephyrex.extensions.teleprompter.BLL_Teleprompter import RecordingManager  # type: ignore[import-not-found]

        RecordingManager(requester_id=env("ROOT_ID"), model_registry=_registry(server)).keep(
            recording["id"],
            transcript="Good evening.",
            caption_segments=[{"start": 0.0, "end": 1.5, "text": "Good evening."}],
        )
        vtt = server.get(f"{url}/captions", params={"format": "vtt"}, headers=_headers(pro_user))
        assert vtt.status_code == 200
        assert vtt.text == "WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.500\nGood evening.\n"
        assert vtt.headers["content-type"].startswith("text/vtt")

        current = server.get(url, headers=_headers(pro_user))
        deleted = server.delete(url, headers=_headers(pro_user, **{"If-Match": current.headers["ETag"]}))
        assert deleted.status_code == 200, deleted.text
        assert not (store / stored["storage_path"]).exists()
        assert server.get(url, headers=_headers(pro_user)).status_code == 404

    def test_an_unsupported_video_type_is_refused(self, server: TestClient, pro_user: Any) -> None:
        refused = server.post(
            "/v1/recording",
            json={"recording": {"title": "Take", "mime_type": "image/png"}},
            headers=_headers(pro_user),
        )
        assert refused.status_code == 415


class TestAi:
    def test_a_retone_needs_a_tone_and_no_configured_ai_is_503(self, server: TestClient, pro_user: Any) -> None:
        missing = server.post(
            "/v1/teleprompter/ai", json={"action": "retone", "content": "Hello"}, headers=_headers(pro_user)
        )
        assert missing.status_code == 422
        unconfigured = server.post(
            "/v1/teleprompter/ai", json={"action": "shorten", "content": "Hello"}, headers=_headers(pro_user)
        )
        assert unconfigured.status_code == 503, unconfigured.text

    def test_a_clip_of_the_wrong_type_is_refused(self, server: TestClient, pro_user: Any) -> None:
        refused = server.post(
            "/v1/teleprompter/transcribe",
            content=b"text",
            headers=_headers(pro_user, **{"Content-Type": "text/plain"}),
        )
        assert refused.status_code == 415


def test_the_framework_routes_zephyreader_uses_are_mounted(server: TestClient, free_user: Any) -> None:
    assert server.get("/v1/live/prompter/devices", headers=_headers(free_user)).json() == {"devices": []}
    assert server.get("/v1/cloud/google_drive/files", headers=_headers(free_user)).status_code == 409
    plans = server.get("/v1/entitlement", headers=_headers(free_user))
    assert plans.status_code == 200, plans.text
    assert plans.json()["plan"] == "free"

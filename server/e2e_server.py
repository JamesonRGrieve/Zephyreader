# SPDX-License-Identifier: AGPL-3.0-or-later
"""The SaaS server for the end-to-end suite (client/playwright.config.ts starts it).

It boots the real app on a throwaway database and file store, and configures what a
deployment's operator would: Google sign-in pointed at the suite's test OpenID provider,
a local-disk store for recordings, and the pro plan's price. One person is a pro
subscriber already (their email is PRO_EMAIL); everyone else signs up on the free plan.
Every person still signs in through the browser, at the test provider.

    uv run python e2e_server.py --port 47101 --idp http://127.0.0.1:47100 --client http://127.0.0.1:47103
"""

from __future__ import annotations

import argparse
import os
import secrets
import tempfile
import uuid
from datetime import UTC, datetime

from cryptography.fernet import Fernet

PRO_EMAIL = "pro@e2e.test"
PRO_PRICE = "price_e2e_pro"
IDP_CLIENT_ID = "zephyreader-e2e"
IDP_CLIENT_SECRET = "zephyreader-e2e-secret"
GOOGLE_SCOPES = "openid email profile https://www.googleapis.com/auth/drive.readonly"


def configure_environment(port: int, idp: str, client: str) -> None:
    scratch = tempfile.mkdtemp(prefix="zephyreader-e2e-server-", dir=os.environ.get("E2E_SCRATCH"))
    os.environ.update(
        {
            "DATABASE_TYPE": "sqlite",
            "DATABASE_NAME": "e2e",
            "DATABASE_PATH": scratch,
            "SEED_DATA": "true",
            "JWT_SECRET": secrets.token_urlsafe(48),
            "FRAMEWORK_FERNET_KEY": Fernet.generate_key().decode(),
            "APP_URI": client,
            "APP_CORS_ALLOWED_ORIGINS": client,
            "TRUSTED_PROXIES": "127.0.0.1/32,::1/128",
            "EGRESS_ALLOWED_HOSTS": "127.0.0.1",
            "CLOUD_LOCAL_DIRECTORY": os.path.join(scratch, "store"),
            "ENTITLEMENT_PRO_PLAN_IDS": PRO_PRICE,
            "ZEPHYREADER_SERVER_PORT": str(port),
        }
    )
    os.environ.setdefault("TEST_IDP_ISSUER", idp)


def seed(app: object) -> None:
    from fastapi.testclient import TestClient
    from zephyrex.extensions.payment.BLL_Payment import PaymentSubscriptionManager
    from zephyrex.lib.Environment import env
    from zephyrex.logic.BLL_Providers import (
        ProviderInstanceManager,
        ProviderInstanceSettingManager,
        ProviderManager,
    )
    from zephyrex.testing.factories import create_user

    registry = app.state.model_registry  # type: ignore[attr-defined]
    root = str(env("ROOT_ID"))
    providers = ProviderManager(model_registry=registry, requester_id=root)
    instances = ProviderInstanceManager(model_registry=registry, requester_id=root)
    settings = ProviderInstanceSettingManager(model_registry=registry, requester_id=root)

    def instance(provider: str, name: str, values: dict[str, str]) -> None:
        created = instances.create(name=name, provider_id=providers.get(name=provider).id, scope="root")
        for key, value in values.items():
            settings.create(provider_instance_id=created.id, key=key, value=value)

    instance(
        "oauth_google",
        "google",
        {
            "client_id": IDP_CLIENT_ID,
            "client_secret": IDP_CLIENT_SECRET,
            "issuer": os.environ["TEST_IDP_ISSUER"],
            "scopes": GOOGLE_SCOPES,
            "offline": "true",
            "redirect_uris": f"{os.environ['APP_URI']}/user/close/google",
        },
    )
    instance("local_disk", "e2e-store", {"directory": os.environ["CLOUD_LOCAL_DIRECTORY"]})

    pro = create_user(TestClient(app), email=PRO_EMAIL)  # type: ignore[arg-type,no-untyped-call]
    PaymentSubscriptionManager(model_registry=registry, requester_id=root).create(
        user_id=pro.id,
        provider="square",
        provider_instance_id=str(uuid.uuid4()),
        external_id=f"sub_{uuid.uuid4().hex}",
        plan_id=PRO_PRICE,
        status="active",
        active=True,
        refreshed_at=datetime.now(UTC),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--idp", required=True)
    parser.add_argument("--client", required=True)
    args = parser.parse_args()
    configure_environment(args.port, args.idp, args.client)

    import uvicorn

    from zephyreader_app import API_ROOT_PATH, create

    app = create()
    seed(app)
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="warning", root_path=API_ROOT_PATH)


if __name__ == "__main__":
    main()

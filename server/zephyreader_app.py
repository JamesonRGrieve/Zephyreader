# SPDX-License-Identifier: AGPL-3.0-or-later
"""Zephyreader's SaaS backend: a consumer app built on the Zephyrex framework.

All infrastructure (auth, DB, REST, GraphQL, migrations, payments, AI) comes
from the framework; this project adds only the teleprompter extension. The
client (../client, built with ZEPHYREADER_VARIANT=saas) proxies /api/v1/* here.

    uv run python zephyreader_app.py                                    # boot with uvicorn
    uv run python -c "from zephyreader_app import create; create()"    # programmatic
"""

from __future__ import annotations

import os

from fastapi import FastAPI

os.environ.setdefault("APP_NAME", "Zephyreader")
os.environ.setdefault("DATABASE_TYPE", "sqlite")
os.environ.setdefault("DATABASE_NAME", "zephyreader")
os.environ.setdefault("SEED_DATA", "true")
# Development only; every deployment sets its own from OpenBao.
os.environ.setdefault("JWT_SECRET", "dev-only-change-in-production-32chars!")
# Freemium: a lapsed subscription drops a user back to the free features; it never locks
# them out of their account, which is what payment's login check would do.
os.environ.setdefault("DISABLE_SUBSCRIPTION_VALIDATION", "true")
# The client proxies /api/v1 here and the proxy rewrites Host, so the server recognises the
# browser's sign-in writes as same-site only by the public origin: the dev client's here, the
# deployment's public origin in production (set in its environment).
os.environ.setdefault("APP_CORS_ALLOWED_ORIGINS", "http://localhost:6969")
# Every browser request arrives through the client's proxy, so the visitor's address (for rate
# limits and lockouts) comes from X-Forwarded-For only when the peer is that proxy: this host in
# development, the client container's address in production. Without it every visitor shares
# one rate-limit bucket.
os.environ.setdefault("TRUSTED_PROXIES", "127.0.0.1/32,::1/128")

# From the framework: auth_session for sign-in sessions, auth_invitations for inviting teammates,
# oauth_consumer for signing in with
# Google (whose token also reads the user's Google Docs), cloud for those Docs and for storing
# recordings, live_sync for one window driving the others and phone remotes, ai for the script
# writer, captions and server speech recognition, payment for subscriptions and entitlements for
# what a plan unlocks; teleprompter (this repo) adds what only a teleprompter needs.
EXTENSIONS = "auth_session,auth_invitations,oauth_consumer,cloud,live_sync,ai,payment,entitlements,teleprompter"
EXTENSIONS_PATH = "./extensions"
# ZEPHYREADER_SERVER_PORT moves it, e.g. for the end-to-end suite beside a dev server.
SERVER_PORT = int(os.environ.get("ZEPHYREADER_SERVER_PORT", "6970"))
# The client proxies its same-origin /api/v1/* to this server's /v1/* (client/next.config.js,
# server.baseUrl '/api'), stripping the prefix: the ASGI root path, so cookies the server
# scopes to a path (oauth_consumer's sign-in binding cookie) carry the path browsers call.
API_ROOT_PATH = "/api"


def create() -> FastAPI:
    """Return a FastAPI app instance for testing or ASGI mounting."""
    from zephyrex import instance, set_extensions_root

    set_extensions_root(EXTENSIONS_PATH)
    app = instance(extensions=EXTENSIONS)
    if not isinstance(app, FastAPI):
        raise TypeError(f"zephyrex.instance() returned {type(app).__name__}, expected FastAPI")
    return app


if __name__ == "__main__":
    from zephyrex import run

    run(extensions=EXTENSIONS, extensions_path=EXTENSIONS_PATH, port=SERVER_PORT, root_path=API_ROOT_PATH)

# SPDX-License-Identifier: AGPL-3.0-or-later
"""Test configuration for the Zephyreader server.

Prepends ``./extensions`` to the ``zephyrex.extensions`` namespace path so
``from zephyrex.extensions.teleprompter... import ...`` resolves to this repo.
"""

import os
import tempfile
from pathlib import Path

from cryptography.fernet import Fernet

_extensions_dir = Path(__file__).resolve().parent / "extensions"

os.environ.setdefault("EXTENSIONS_PATH", str(_extensions_dir))
os.environ.setdefault("DATABASE_TYPE", "sqlite")
# One database per xdist worker: each worker boots its own app and seeds it.
os.environ.setdefault("DATABASE_NAME", f"test_zephyreader_{os.environ.get('PYTEST_XDIST_WORKER', 'main')}")
os.environ.setdefault("DATABASE_PATH", tempfile.mkdtemp(prefix="zephyreader-db-"))
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-32-bytes-or-more-aaaaaa")
os.environ.setdefault("SEED_DATA", "true")
# oauth_consumer needs a key to encrypt stored client secrets; a throwaway one per run.
os.environ.setdefault("FRAMEWORK_FERNET_KEY", Fernet.generate_key().decode())
# Recordings go to a throwaway local-disk store.
os.environ.setdefault("CLOUD_LOCAL_DIRECTORY", tempfile.mkdtemp(prefix="zephyreader-store-"))

import zephyrex.extensions  # noqa: E402

if str(_extensions_dir) not in zephyrex.extensions.__path__:
    zephyrex.extensions.__path__ = [str(_extensions_dir), *zephyrex.extensions.__path__]

import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_rate_limit_counts_between_tests() -> None:
    """Each test starts with no requests counted against the framework's rate limits.

    Every test drives the app from the same test-client address, so sign-ins and other
    requests counted by earlier tests would throttle later ones (sign-in allows 10 a
    minute). As server-framework's own conftest does.
    """
    from zephyrex.lib.InboundSecurity import reset_rate_limit_counts

    reset_rate_limit_counts()

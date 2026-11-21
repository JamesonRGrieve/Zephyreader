# SPDX-License-Identifier: AGPL-3.0-or-later
"""The teleprompter's migrations, run the way production runs them: the app boots on a fresh
database (conftest's temp DATABASE_PATH), the framework runs the extension's migrations, and what
they build is exactly what the models declare. server-framework builds any table that has no
migration straight from the models (create_unmigrated_extension_tables), so without this check the
tests pass while a production database has no migration history for a table. Adopted from
zephyrex-vtt's rpg_systems Migration_test (Framework App Standards)."""

import glob
import importlib.util
import os
import sqlite3
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from zephyreader_app import create

EXTENSION = "teleprompter"
VERSIONS = Path(__file__).resolve().parent / "migrations" / "versions"


def _migrated_tables() -> set[str]:
    """Every table the extension's migrations create (each version lists its own in TABLES)."""
    tables: set[str] = set()
    for path in sorted(VERSIONS.glob("*.py")):
        spec = importlib.util.spec_from_file_location(f"teleprompter_migration_{path.stem}", path)
        assert spec is not None and spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        tables |= set(getattr(module, "TABLES", ()))
    return tables


@pytest.fixture(scope="module")
def models() -> Iterator[Any]:
    """The app's model metadata: the tables the models declare."""
    app = create()
    with TestClient(app):
        pass
    yield app.state.model_registry.DB.manager.Base.metadata


@pytest.fixture(scope="module")
def database(models: Any) -> Iterator[sqlite3.Connection]:
    name = os.environ["DATABASE_NAME"]
    files = glob.glob(os.path.join(os.environ["DATABASE_PATH"], f"{name}*.db"))
    assert files, f"no database file for {name} in {os.environ['DATABASE_PATH']}"
    connection = sqlite3.connect(files[0])
    yield connection
    connection.close()


def owned(models: Any) -> list[Any]:
    return [table for table in models.sorted_tables if table.info.get("extension") == EXTENSION]


def test_the_extension_ships_its_migrations() -> None:
    assert sorted(VERSIONS.glob("*.py")), "no migrations: every table would come from the create_all fallback"


def test_every_table_the_models_declare_is_built_by_a_migration(models: Any) -> None:
    declared = {table.name for table in owned(models)}
    assert declared, "no teleprompter tables found in the model metadata"
    assert declared == _migrated_tables(), declared ^ _migrated_tables()


def test_the_migrated_schema_is_what_the_models_declare(models: Any, database: sqlite3.Connection) -> None:
    for table in owned(models):
        migrated = {row[1]: bool(row[3]) for row in database.execute(f"PRAGMA table_info({table.name})")}
        declared = {column.name: not column.nullable for column in table.columns}
        assert migrated == declared, (
            table.name,
            {
                k: (declared.get(k), migrated.get(k))
                for k in set(declared) | set(migrated)
                if declared.get(k) != migrated.get(k)
            },
        )
        keys = {(row[3], row[2]) for row in database.execute(f"PRAGMA foreign_key_list({table.name})")}
        wanted = {(fk.parent.name, fk.column.table.name) for fk in table.foreign_keys}
        assert keys == wanted, (table.name, keys ^ wanted)

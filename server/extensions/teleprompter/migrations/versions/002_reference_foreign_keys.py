# SPDX-License-Identifier: AGPL-3.0-or-later
"""The two references 001 left as plain columns: a script's folder and a recording's script.
The models declare both as foreign keys (``ScriptFolderModel.Reference.Optional`` and
``ScriptModel.Reference.Optional``), so a database the models built has them and a migrated one
didn't (found by Migration_test). Each is added only where it is missing, so a database whose
tables came from the models is left as it is. Batch mode, so SQLite rebuilds the table to add it."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "002_teleprompter_reference_fks"
down_revision: str | None = "001_teleprompter_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (table, column, referenced table), named as PostgreSQL names an unnamed one.
REFERENCES = (
    ("scripts", "script_folder_id", "script_folders"),
    ("recordings", "script_id", "scripts"),
)
TABLES: tuple[str, ...] = ()


def _name(table: str, column: str) -> str:
    return f"{table}_{column}_fkey"


def _has_key(table: str, column: str, target: str) -> bool:
    keys = sa.inspect(op.get_bind()).get_foreign_keys(table)
    return any(key["constrained_columns"] == [column] and key["referred_table"] == target for key in keys)


def upgrade() -> None:
    for table, column, target in REFERENCES:
        if _has_key(table, column, target):
            continue
        with op.batch_alter_table(table) as batch:
            batch.create_foreign_key(_name(table, column), target, [column], ["id"])


def downgrade() -> None:
    for table, column, target in reversed(REFERENCES):
        if not _has_key(table, column, target):
            continue
        with op.batch_alter_table(table) as batch:
            batch.drop_constraint(_name(table, column), type_="foreignkey")

# SPDX-License-Identifier: AGPL-3.0-or-later
"""Initial migration for teleprompter: owns the ``script_folders``, ``scripts``,
``prompter_preferences`` and ``recordings`` tables."""

from collections.abc import Sequence
from typing import Any

import sqlalchemy as sa
from alembic import op

revision: str = "001_teleprompter_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = ("ext_teleprompter",)
depends_on: str | Sequence[str] | None = None

TABLE_INFO = {"extension": "teleprompter"}
TABLES = ("recordings", "prompter_preferences", "scripts", "script_folders")


def _has_table(name: str) -> bool:
    return bool(sa.inspect(op.get_bind()).has_table(name))


def _record_columns() -> list[sa.Column[Any]]:
    return [
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("created_by_user_id", sa.String(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("updated_by_user_id", sa.String(), nullable=True),
        sa.Column("deleted_by_user_id", sa.String(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
    ]


def _owner_columns() -> list[sa.Column[Any]]:
    return [
        sa.Column(
            "team_id",
            sa.String(),
            sa.ForeignKey("teams.id"),
            nullable=True,
            comment="Optional foreign key to TeamModel",
        ),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id"),
            nullable=True,
            comment="Optional foreign key to UserModel",
        ),
    ]


def _create(name: str, comment: str, *columns: sa.Column[Any]) -> None:
    if _has_table(name):
        return
    op.create_table(
        name,
        *columns,
        *_record_columns(),
        sa.PrimaryKeyConstraint("id"),
        comment=comment,
        info=TABLE_INFO,
    )
    op.create_index(f"ix_{name}_deleted_at", name, ["deleted_at"])
    op.create_index(f"ix_{name}_created_by_user_id", name, ["created_by_user_id"])


def upgrade() -> None:
    _create(
        "script_folders",
        "Folders scripts are filed in",
        *_owner_columns(),
        sa.Column("name", sa.String(), nullable=False, comment="Folder name"),
    )
    _create(
        "scripts",
        "Teleprompter scripts",
        *_owner_columns(),
        sa.Column(
            "script_folder_id",
            sa.String(),
            nullable=True,
            comment="The ID of the related script folder",
        ),
        sa.Column("title", sa.String(), nullable=False, comment="Title"),
        sa.Column(
            "content",
            sa.Text(),
            nullable=False,
            comment="The script (Markdown; [brackets] are cue notes)",
        ),
        sa.Column("starred", sa.Boolean(), nullable=False, comment="Starred in the library"),
        sa.Column(
            "word_count",
            sa.Integer(),
            nullable=False,
            comment="Words in the content (kept by the server)",
        ),
        sa.Column(
            "source_provider",
            sa.String(),
            nullable=True,
            comment="Where it was imported from (google_drive, file)",
        ),
        sa.Column("source_path", sa.String(), nullable=True, comment="The source's id or name there"),
    )
    _create(
        "prompter_preferences",
        "Each user's prompter settings",
        sa.Column("settings", sa.JSON(), nullable=False, comment="Display and scroll settings"),
    )
    _create(
        "recordings",
        "Recorded takes and their captions",
        sa.Column("script_id", sa.String(), nullable=True, comment="The ID of the related script"),
        sa.Column("title", sa.String(), nullable=False, comment="Title"),
        sa.Column(
            "mime_type",
            sa.String(),
            nullable=False,
            comment="The video's type (video/webm, video/mp4, ...)",
        ),
        sa.Column("duration_seconds", sa.Float(), nullable=True, comment="Length of the take"),
        sa.Column(
            "size_bytes",
            sa.Integer(),
            nullable=False,
            comment="Size of the stored video (kept by the server)",
        ),
        sa.Column(
            "storage_provider",
            sa.String(),
            nullable=True,
            comment="The cloud provider holding the video",
        ),
        sa.Column("storage_path", sa.String(), nullable=True, comment="Its path there"),
        sa.Column("transcript", sa.Text(), nullable=True, comment="What was said, once captioned"),
        sa.Column(
            "caption_segments",
            sa.JSON(),
            nullable=True,
            comment="Timed segments, once captioned",
        ),
    )


def downgrade() -> None:
    for name in TABLES:
        op.drop_index(f"ix_{name}_created_by_user_id", table_name=name)
        op.drop_index(f"ix_{name}_deleted_at", table_name=name)
        op.drop_table(name)

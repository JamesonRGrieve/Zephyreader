# SPDX-License-Identifier: AGPL-3.0-or-later
"""Zephyreader's knowledge shared with the client: record limits, the paid feature
ids, the AI writer's actions and the media types takes and voice clips may be.

They live once, in contract/teleprompter.json at the repository root, which the
self-hosted lite API and the front end read too (client/src/contract.ts), so the
two back ends cannot drift apart. This module reads it; nothing here restates it.
"""

import json
from pathlib import Path
from typing import Any

# server/extensions/teleprompter/Contract.py → the repository root, three levels up.
CONTRACT_PATH = Path(__file__).resolve().parents[3] / "contract" / "teleprompter.json"

CONTRACT: dict[str, Any] = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
LIMITS: dict[str, int] = CONTRACT["limits"]
PAID_FEATURES: dict[str, str] = CONTRACT["paid_features"]
AI_ACTIONS: tuple[str, ...] = tuple(CONTRACT["ai_actions"])
RECORDING_MEDIA_TYPES: tuple[str, ...] = tuple(CONTRACT["recording_media_types"])
CLIP_MEDIA_TYPES: tuple[str, ...] = tuple(CONTRACT["clip_media_types"])

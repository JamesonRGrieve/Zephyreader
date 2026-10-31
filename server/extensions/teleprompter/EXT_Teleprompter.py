# SPDX-License-Identifier: AGPL-3.0-or-later
"""teleprompter extension definition."""

from typing import ClassVar

from zephyrex.extensions.AbstractExtensionProvider import AbstractStaticExtension

# Registers Zephyreader's plans as the extension loads.
# It resolves only at runtime, through the extensions namespace path.
from zephyrex.extensions.teleprompter import Catalogue  # type: ignore[import-not-found]  # noqa: F401
from zephyrex.lib.Dependencies import Dependencies, EXT_Dependency


class TeleprompterExtension(AbstractStaticExtension):
    name: ClassVar[str] = "teleprompter"
    version: ClassVar[str] = "0.0.1"
    description: ClassVar[str] = (
        "Teleprompter scripts, folders, prompter settings, recordings with captions, AI writing and voice"
    )
    dependencies: ClassVar[Dependencies] = Dependencies(
        [
            EXT_Dependency(
                name="entitlements",
                friendly_name="Entitlements",
                reason="What a plan unlocks",
                optional=False,
                semver=None,
            ),
            EXT_Dependency(
                name="cloud",
                friendly_name="Cloud storage",
                reason="Where recordings are stored",
                optional=False,
                semver=None,
            ),
            EXT_Dependency(
                name="ai",
                friendly_name="AI",
                reason="The script writer, captions and server speech recognition",
                optional=False,
                semver=None,
            ),
        ]
    )

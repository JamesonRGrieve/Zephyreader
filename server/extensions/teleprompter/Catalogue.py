# SPDX-License-Identifier: AGPL-3.0-or-later
"""What Zephyreader sells: the features a plan unlocks, and the plans.

Importing this registers the plans with the framework's entitlements.

The plans are provisional (operator to set names, prices and limits; the Stripe
prices that buy each are deployment configuration, ENTITLEMENT_<PLAN>_PLAN_IDS).
The free plan is everything the self-hosted lite variant does for one person:
the editor and library, every display and scroll mode, voice-follow in the
browser, remote control, local recording. Paid plans add what needs the server:
the AI writer, captions, cloud recordings, server speech recognition and,
on the team plan, sharing scripts with a team.
"""

from zephyrex.extensions.entitlements.Plans import Plan, register_plan

AI_WRITER = "ai_writer"
CAPTIONS = "captions"
CLOUD_RECORDINGS = "cloud_recordings"
SERVER_VOICE = "server_voice"
TEAM_SHARING = "team_sharing"

# Megabytes of recordings a plan may keep in the cloud.
RECORDING_MEGABYTES = "recording_megabytes"

PRO_FEATURES = frozenset({AI_WRITER, CAPTIONS, CLOUD_RECORDINGS, SERVER_VOICE})
PRO_RECORDING_MEGABYTES = 10 * 1024
TEAM_RECORDING_MEGABYTES = 50 * 1024
TEAM_SEATS = 5

FREE = Plan(name="free", rank=0, features=frozenset(), limits={RECORDING_MEGABYTES: 0})
PRO = Plan(name="pro", rank=1, features=PRO_FEATURES, limits={RECORDING_MEGABYTES: PRO_RECORDING_MEGABYTES})
TEAM = Plan(
    name="team",
    rank=2,
    features=PRO_FEATURES | {TEAM_SHARING},
    limits={RECORDING_MEGABYTES: TEAM_RECORDING_MEGABYTES},
    seats=TEAM_SEATS,
)

for _plan in (FREE, PRO, TEAM):
    register_plan(_plan)

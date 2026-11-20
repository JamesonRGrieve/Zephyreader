# Zephyreader design

What Zephyreader is, who it is for, how it is built on the Zephyrex frameworks, and the bar it
is held to. The feature list and the HTTP contract both editions answer are in
[FEATURES.md](FEATURES.md); how a build reaches the server is in
[../deploy/README.md](../deploy/README.md).

## Who it is for

People who speak to a camera, a room or a call and want to look up, not down:

- **Presenters and speakers** reading a talk, a keynote or a wedding toast from a laptop,
  tablet or a beam-splitter rig.
- **Video creators** recording to camera, often alone, who want the script to follow their
  voice and a take they can download or keep.
- **People on video calls** who want their notes floating over the call, not in another
  window.
- **Small teams** (a producer and the talent, a comms team) who share scripts and drive one
  prompter from another device.
- **Self-hosters** who want all of the single-person features on their own machine, with no
  account anywhere else and no request to another site.

## Two editions, one front end

| | Lite | SaaS |
|---|---|---|
| Who | One person, self-hosted | Anyone, at zephyreader.com |
| Back end | The Next.js app's own API routes (`client/src/app/api/**/route.lite.ts`) on SQLite through Prisma | The Zephyrex server framework (`server/`, Python) on PostgreSQL |
| Features | Every single-user feature | All of them, plus teams, cloud recordings, AI, server speech recognition and plans |
| Build | `ZEPHYREADER_VARIANT=lite` (the default) | `ZEPHYREADER_VARIANT=saas`: the lite routes are left out and `/api/v1` is proxied to the server |

The UI never asks which edition it is in. It reads `GET /v1/extension` and shows a feature
only when the back end lists the extension that serves it (`client/src/features/capabilities.ts`).
Lite answers with none of the SaaS-only extensions, so their features simply don't appear.

## Architecture on the frameworks

- **client-framework (`zephyrex`, `@zephyrex/*`)**: the app shell, auth middleware, the API
  client with ETag/If-Match guarded writes, SWR hooks, theme tokens and every UI primitive
  (dialogs, toasts, `LoadProblem`, `SkeletonRows`, `ChoiceChip`, `deferWithUndo`). Zephyreader
  adds only what is unique to a teleprompter: the editor, the prompter surface, the voice-follow
  engines, remotes and recording.
- **auth, dynamic-form, zod2gql**: sign-in UI and session helpers, forms, and schema tooling,
  at the commits `deploy/frameworks.env` pins.
- **server-framework**: the SaaS back end. It supplies users, teams, sessions, Google sign-in
  (`oauth_consumer`), real-time device sync (`live_sync`), Google Drive (`cloud`), AI and speech
  (`ai`), plans (`entitlements`) and payment (Square). Zephyreader adds one extension,
  `server/extensions/teleprompter`: scripts, folders, prompter preferences and recordings.
- **One contract.** `contract/teleprompter.json` holds the paths, status codes, limits and
  record shapes both back ends answer, and `contract/word-count-cases.json` holds the logic both
  compute. The lite routes copy the framework's API and never the other way round. Each side
  loads the contract, and `client/src/contract.test.ts` and `client/e2e/contract.spec.ts` hold
  both back ends to it.
- **Anything two apps would each copy belongs in a framework package.** `live_sync`, `cloud`'s
  local object store and the per-route body cap came from Zephyreader's needs and went into
  server-framework. `@zephyrex/lite`, which lifts the lite record API, is in progress.

### The prompter

- **Scrolling** is constant-speed, timed to a target length, or voice-following. Voice-follow
  has three engines: an in-browser Whisper model served from the app's own origin (private,
  offline; pinned by commit and SHA-256 in `client/scripts/fetch-voice-model.mjs`), the
  browser's speech API, and SaaS server recognition.
- **Devices** join a per-user live channel over server-sent events. One main display drives
  any number of followers, and a phone can act as the remote.
- **Recording** captures the camera (and optionally the screen) with the prompter on screen.
  Lite downloads the take; SaaS can keep it in a cloud library, with captions.

### Hosting

The SaaS edition is deployed by Forgejo Actions to `prod-zephyreader` (a container on the
backup host, PUB_SITES VLAN, PostgreSQL in the container), as in Cule. The server binds
loopback only, and the client proxies `/api` to it. **It stays fully disabled until a network
security audit passes** (operator, 2026-11-04). The units are modelled stopped and the edge has
no route.

## Standards

Zephyreader meets the shared bar for every Zephyrex framework app: **Zephyrex SOP → Production
Environment → Services → Zephyrex Framework App Standards** (Nextcloud collective page 31657).
That covers testing (both editions, e2e on production builds, axe at WCAG 2.1 AA, the visual
audit, Storybook play tests), UX (four states on every data view, undoable deletes, inline
write problems, purpose-built inputs, framework tokens only), supply chain (pinned revisions
and hashes) and the runner gates. What Zephyreader has adopted and what is still open is
tracked on its Deck card (Zephyrex board, card 185).

## Proposed, not confirmed

Ideas Zephyreader could grow into. **None of these is built or scheduled until the operator
confirms it.** Size is rough: S is a day or less, M a few days, L a week or more.

| Idea | Value to the user | Size | Depends on |
|---|---|---|---|
| **Rehearsal report** | After a run-through, see your pace per section, where you sped up or stalled, and how long the real thing will take | M | Voice-follow timing (F16), which every engine already reports |
| **Script history** | Get back yesterday's version after a bad edit, or compare two drafts | M | A revision table in the `teleprompter` extension and in lite's Prisma schema; contract entries |
| **Producer's live edit** | A producer fixes a line on their laptop and the talent's prompter updates mid-read without losing its place | L | `live_sync`; merging an edit into a moving scroll position |
| **Two-speaker scripts** | Co-hosts get their own colour and cues, and each one's prompter can show only their lines | M | Editor markup for speakers; follower displays (F21) |
| **Reading aids** | A dyslexia-friendly font, wider letter and word spacing, a tinted reading ruler | S | Self-hosted font files; display settings |
| **Readability check** | Before recording, flag long sentences, hard-to-say runs and sections that read too long | S | Client only, both editions |
| **Open the script when the meeting starts** | Pick a calendar event once, and the right script opens and floats over the call when it begins | M | server-framework `calendar` (`e3725c7f`) and the delegated Google token (`21e2335f`); SaaS only |
| **Review link** | Send a read-only link to a script for someone without an account to read and comment on | M | A share token and permission model in the framework; SaaS only |
| **Slide sync** | Cue marks in the script turn the slides in Google Slides or a presenter remote, so one click moves both | M | A Slides scope on the `cloud` Google provider; or a keyboard relay for local decks |
| **Scripts as files** | Lite keeps each script as a Markdown file in a folder the person chooses, so their own sync tool (Nextcloud, Git) carries them | M | The browser's File System Access API (Chromium only), with a fallback to the database |

# Features and the shared contract

Zephyreader ships two variants from one front end (see `../AGENTS.md`):

- **Lite**: self-hosted, Next.js only. Every single-user feature.
- **SaaS**: the same UI backed by the zephyrex server framework (`server/`). Feature
  parity with the popular SaaS teleprompters, plus teams, cloud recordings, AI,
  server speech recognition and plans.

The UI never asks which variant it runs in. It reads `GET /v1/extension` and turns a
feature on when the backend lists the extension that serves it, so a feature the lite
backend doesn't provide simply doesn't appear.

## Parity matrix

The reference set is Speakflow, PromptSmart Pro, Teleprompter.com, BIGVU, Teleprompter
Premium, Video Teleprompter and VoicePrompter (surveyed 2026-10-31). "Seen in" lists
where the feature is a selling point, not every product that has it.

| # | Feature | Seen in | Lite | SaaS |
|---|---|---|---|---|
| **Scripts** |
| F1 | Script editor: rich text (bold, italic, colour highlight), cue notes that never show on the prompter, autosave with stale-save detection | all | ✓ | ✓ |
| F2 | Script library: folders, search, sort, star, duplicate, delete | Speakflow, Teleprompter.com | ✓ | ✓ |
| F3 | Import: Google Docs; files (.txt, .md, .docx, .pdf, .rtf) | Teleprompter Premium, PromptSmart | ✓ | ✓ |
| F4 | Export a script (.txt, .md) | Teleprompter Premium | ✓ | ✓ |
| F5 | Share scripts with a team, with roles | Speakflow, Teleprompter.com | – | ✓ |
| **Display** |
| F6 | Font size, family, line height, side margins, alignment, all caps | all | ✓ | ✓ |
| F7 | Colour themes (text and background), high contrast | all | ✓ | ✓ |
| F8 | Mirror horizontally and vertically (beam-splitter rigs) | all | ✓ | ✓ |
| F9 | Eye-line marker and highlighted reading line | PromptSmart, Teleprompter Premium | ✓ | ✓ |
| F10 | Countdown before the scroll starts | Teleprompter.com, BIGVU | ✓ | ✓ |
| F11 | Progress, elapsed and remaining time, words-per-minute estimate | Speakflow, Teleprompter Premium | ✓ | ✓ |
| F12 | Full screen and keep-screen-awake | all | ✓ | ✓ |
| F13 | Display preferences saved per user | Speakflow | ✓ | ✓ |
| **Scrolling** |
| F14 | Constant-speed auto-scroll, adjustable live | all | ✓ | ✓ |
| F15 | Timed scroll: fit the script to a target duration | Teleprompter.com | ✓ | ✓ |
| F16 | Voice-follow scroll, tracking forward and back, pausing when you pause | PromptSmart, Speakflow, VoicePrompter, Teleprompter.com | ✓ | ✓ |
| F16a | ↳ engine: in-browser local model (private, offline) | PromptSmart (offline) | ✓ | ✓ |
| F16b | ↳ engine: browser speech API | Speakflow | ✓ | ✓ |
| F16c | ↳ engine: on-prem server speech recognition | — | – | ✓ |
| F17 | Jump to start, previous/next cue mark, rewind | Teleprompter Premium | ✓ | ✓ |
| **Control** |
| F18 | Keyboard shortcuts | all | ✓ | ✓ |
| F19 | Hardware remotes: Bluetooth page-turners, foot pedals, media keys, game controllers, remappable | Video Teleprompter | ✓ | ✓ |
| F20 | Remote control from another device (phone drives the prompter) | Speakflow, PromptSmart, Teleprompter.com | ✓ | ✓ |
| F21 | Follower displays mirroring the main window | Teleprompter Pro, Teleprompter.com | ✓ | ✓ |
| F22 | Floating prompter over a video call (picture-in-picture) | Speakflow, VoicePrompter | ✓ | ✓ |
| **Recording** |
| F23 | Record camera (and optionally screen) with the prompter on screen; pick camera, microphone, resolution; download | Speakflow, BIGVU, Teleprompter.com | ✓ | ✓ |
| F24 | Cloud recordings library, with plan quotas | Speakflow, BIGVU, Teleprompter.com | – | ✓ |
| **AI** |
| F25 | Script writer and rewriter: generate, shorten, lengthen, change tone | BIGVU, Teleprompter.com | – | ✓ |
| F26 | Captions and transcripts for recordings (SRT, VTT) | BIGVU, Teleprompter.com | – | ✓ |
| F27 | Translate a script | BIGVU | – | ✓ |
| **Accounts** |
| F28 | Sign in with Google | — | ✓ | ✓ |
| F29 | Plans: free tier, paid features, lapsed subscription falls back to free | Speakflow, BIGVU | – | ✓ |
| F30 | Installable app, works offline once loaded | VoicePrompter | ✓ | ✓ |
| F31 | Waitlist for accounts and paid plans, into Zephyrex's CRM; closed sign-up leads there | — | – | ✓ |

Out of scope unless the operator asks: live streaming to social platforms (BIGVU,
Teleprompter.com) and a video editor (BIGVU).

## The contract

Both backends answer the same HTTP API under `/api/v1` (the browser's view; the
framework serves it at `/v1`). It is the framework's API: the lite handlers copy the
framework's paths, bodies and status codes, never the other way round. A lite handler
exists only where the lite UI calls it.

Common rules, from the framework:

- **Session**: the HttpOnly `zx_session` cookie, or `Authorization: Bearer`. No session
  is `401`.
- **CSRF**: a cookie-authenticated unsafe request echoes the `zx_csrf` cookie in
  `X-CSRF-Token` (`csrfHeaders()` from `@zephyrex/auth`), otherwise `403`.
- **Records**: a single record answers `{ "<resource>": {...} }` with an `ETag`;
  a list answers `{ "<resources>": [...] }`. Create is `POST` with `{ "<resource>": {...} }`
  and answers `201`.
- **Stale saves**: `PUT`/`PATCH`/`DELETE` need `If-Match` (`428` without it, `412`
  when stale). A `W/` prefix and the quotes aren't part of the version.
- **Plans**: a feature the caller's plan doesn't include is `402` with
  `{ "detail": { "feature", "upgrade_to" } }`; a limit is `402` with
  `{ "detail": { "limit", "allowed", "upgrade_to" } }`.
- **Errors**: `{ "detail": { "message": "...", "code"?: "...", "errors"?: [...] } }`.
  Another user's record is `403` or `404`, as the framework answers.

| Path | Methods | Lite | SaaS (who serves it) |
|---|---|---|---|
| `/v1/user`, `/v1/user/logout`, `/v1/team`, `/v1/extension`, `/v1/auth/oauth/*` | as the framework | ✓ | framework core, `auth_session`, `oauth_consumer` |
| `/v1/script`, `/v1/script/{id}` | CRUD | ✓ | `teleprompter` (server/) |
| `/v1/script_folder`, `/v1/script_folder/{id}` | CRUD | ✓ | `teleprompter` |
| `/v1/prompter_preference`, `/v1/prompter_preference/{id}` | CRUD, one record per user (a second create is `409`) | ✓ | `teleprompter` |
| `/v1/live/{channel}`, `/v1/live/{channel}/events`, `/v1/live/{channel}/devices` | POST; GET (server-sent events); GET | ✓ | `live_sync` (framework) |
| `/v1/cloud/google_drive/files`, `/v1/cloud/google_drive/file` | GET | ✓ | `cloud` (framework, delegated Google Drive provider) |
| `/v1/recording`, `/v1/recording/{id}` | CRUD (DELETE also deletes the video) | – | `teleprompter` + `cloud` |
| `/v1/recording/{id}/content` | PUT (the video as the body), GET | – | `teleprompter` + `cloud` |
| `/v1/recording/{id}/captions` | POST (transcribe), GET `?format=vtt\|srt` | – | `teleprompter` + `ai` |
| `/v1/teleprompter/ai` | POST `{action, content, tone?, language?}` | – | `teleprompter` + `ai` |
| `/v1/teleprompter/transcribe` | POST (an audio clip as the body) | – | `teleprompter` + `ai` |
| `/v1/entitlement`, `/v1/payment/*` | as the framework | – | `entitlements`, `payment` |

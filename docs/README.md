# Zephyreader

OpenTeleprompt: present a Google Doc (or a Nextcloud document) as a teleprompter,
with one "main" window driving the scroll position of any number of follower
windows over server-sent events.

It is a Next.js app built on the Zephyrex client framework. There is no separate
backend: the Next API routes under `src/app/api/v1` implement the slice of the
server-framework API the app needs (auth, user, sessions) with the same paths,
payloads and error bodies, so the framework's client works against it unchanged.

## Running it

Requires Node 24+ and pnpm. The Zephyrex packages (`zephyrex`, `@zephyrex/auth`,
`@jgrieve/forms`, `zod2gql`) aren't on a registry yet, so `client-framework`, `auth`,
`dynamic-form` and `zod2gql` must be checked out beside this repo with their
`dist/` built (`pnpm compile` in each); pnpm installs them as injected copies.
pnpm keeps those copies as they were at install time, so after rebuilding a
sibling's `dist/` run `pnpm refresh:zephyrex` to pick up the change.

```sh
cp .env.example .env              # fill in the Google client, JWT_SECRET, OAUTH_TOKEN_ENCRYPTION_KEY
pnpm install
pnpm prisma migrate deploy        # creates the SQLite database
pnpm dev                          # http://localhost:6969
```

## Container

`client/Containerfile` builds an OCI image with Podman, from `client/`. The four
sibling packages and the repository's `contract/` (the knowledge the app shares with
the SaaS server) go in as named build contexts; the packages are compiled inside the
image. The header of the file has the full build and run commands.

```sh
CONTEXTS="--build-context zod2gql=../../zod2gql --build-context dynamic-form=../../dynamic-form \
  --build-context auth=../../auth --build-context client-framework=../../client-framework \
  --build-context contract=../contract"
podman build -t zephyreader $CONTEXTS .
podman build --target migrate -t zephyreader-migrate $CONTEXTS .
```

The runtime image is Next's standalone server running as `node`, with the
SQLite database on a `/data` volume. Secrets come from `--env-file` at run time;
`.containerignore` keeps `.env` files out of the build.

## Sign-in

Google sign-in is OAuth 2.0 authorization code with PKCE, per the OAuth 2.0
Security BCP (RFC 9700) and OpenID Connect:

1. `POST /api/v1/auth/oauth/authorize {provider: "google"}` returns
   `{authorize_url, state}` and sets an HttpOnly binding cookie. The state, PKCE
   verifier and OIDC nonce are stored single-use for 10 minutes.
2. Google redirects back with `code` and `state`.
3. `POST /api/v1/auth/oauth/callback {provider, code, state}` checks the state
   against the binding cookie, exchanges the code server-side, verifies the ID
   token against Google's keys, and returns
   `{session_key, user_id, grant_type, expires_at, token}`.

Accounts are keyed on Google's subject ID. A first sign-in creates an account
only for a verified email (`OAUTH_ALLOW_SIGNUP=false` turns that off). Google's
access and refresh tokens are stored AES-256-GCM encrypted and refreshed as
they expire.

API requests authenticate with `Authorization: Bearer <token>`. Every request
re-checks the session, so revoking one takes effect immediately.

## Checks

```sh
pnpm test         # vitest, against a real migrated SQLite database
pnpm lint
pnpm typecheck
pnpm test:e2e     # playwright; builds and serves the app
```

Wrap full builds in `/home/jameson/Source/mem-queuer/memq run -m 10 -- pnpm build`.

## License

AGPL-3.0-or-later. See [LICENSE](../LICENSE).

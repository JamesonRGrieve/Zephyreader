# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Podman/Buildah image for Zephyreader (OCI format; no Docker-only instructions).
#
# The Zephyrex packages (zephyrex, @zephyrex/auth, @jgrieve/forms, zod2gql) are not
# on a registry yet, so they install as injected `file:` copies of the sibling
# checkouts' compiled dist/ (pnpm-workspace.yaml overrides). The siblings come in
# as named build contexts, laid out beside the app exactly as on disk, and are
# compiled leaf-first because each injected install copies the dist/ of the ones
# before it:
#
#   podman build -f Containerfile -t zephyreader \
#     --build-context zod2gql=../zod2gql \
#     --build-context dynamic-form=../dynamic-form \
#     --build-context auth=../auth \
#     --build-context client-framework=../client-framework \
#     --build-arg APP_URI=https://prompt.example.com .
#
# Wrap the build in memq on shared machines:
#   /home/jameson/Source/mem-queuer/memq run -m 12 -- podman build ...
#
# Run (the SQLite database lives on a volume; migrate once per schema change):
#   podman volume create zephyreader-data
#   podman run --rm -v zephyreader-data:/data --env-file .env localhost/zephyreader-migrate
#   podman run -d -p 6969:6969 -v zephyreader-data:/data --env-file .env \
#     --health-cmd 'node -e "fetch(\"http://127.0.0.1:6969/api/v1/alive\").then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"' \
#     localhost/zephyreader
# (build the migrate image with `--target migrate -t zephyreader-migrate`). Secrets
# (JWT_SECRET, GOOGLE_CLIENT_SECRET, OAUTH_TOKEN_ENCRYPTION_KEY) are supplied at run
# time only; .containerignore keeps .env files out of the build context.

ARG NODE_IMAGE=docker.io/library/node:24-bookworm-slim
ARG PNPM_VERSION=11.1.1
# Public origin; the build inlines it and the runtime auth middleware reads it.
ARG APP_URI=http://localhost:6969
# Auth UI root; empty means ${APP_URI}/user.
ARG AUTH_URI=

FROM ${NODE_IMAGE} AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
RUN npm install --global --no-fund --no-audit "pnpm@${PNPM_VERSION}"
WORKDIR /src

# ---- sibling packages: build each dist/ where the `file:../<name>` overrides expect ----
FROM base AS siblings
COPY --from=zod2gql --exclude=node_modules --exclude=dist --exclude=.git . /src/zod2gql/
RUN cd /src/zod2gql && pnpm install --frozen-lockfile && pnpm run compile
COPY --from=dynamic-form --exclude=node_modules --exclude=dist --exclude=.git \
     --exclude=storybook-static . /src/dynamic-form/
RUN cd /src/dynamic-form && pnpm install --frozen-lockfile && pnpm run compile
COPY --from=auth --exclude=node_modules --exclude=dist --exclude=.git \
     --exclude=storybook-static . /src/auth/
RUN cd /src/auth && pnpm install --frozen-lockfile && pnpm run compile
COPY --from=client-framework --exclude=node_modules --exclude=dist --exclude=.next --exclude=.git \
     --exclude=storybook-static --exclude=test-results --exclude=playwright-report \
     . /src/client-framework/
RUN cd /src/client-framework && pnpm install --frozen-lockfile && pnpm run compile

# ---- app dependencies (cached until the manifest or lockfile changes) ----
FROM siblings AS deps
WORKDIR /src/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM deps AS builder
# Public URLs are inlined into the client bundle at build time (next.config.js `env`).
ARG APP_NAME="Open Teleprompt"
ARG APP_DESCRIPTION="An open source teleprompting software."
ARG APP_URI
ARG AUTH_URI
# API prefix; empty means ${APP_URI}/api.
ARG API_URI=
ARG DEFAULT_THEME_MODE=dark
ENV APP_NAME=${APP_NAME} \
    APP_DESCRIPTION=${APP_DESCRIPTION} \
    APP_URI=${APP_URI} \
    AUTH_URI=${AUTH_URI} \
    API_URI=${API_URI} \
    DEFAULT_THEME_MODE=${DEFAULT_THEME_MODE} \
    NEXT_OUTPUT_STANDALONE=1
COPY . .
RUN pnpm run build

# ---- one-off schema migration (`podman build --target migrate`) ----
FROM builder AS migrate
ENV DATABASE_URL=file:/data/zephyreader.db
VOLUME /data
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# ---- runtime: the traced standalone server only, as a non-root user ----
FROM ${NODE_IMAGE} AS runner
ARG APP_URI
ARG AUTH_URI
# The @zephyrex/auth middleware reads APP_URI, AUTH_URI and PRIVATE_ROUTES from the
# live environment on every request; default them to the build's values so the
# image runs as built (override with --env-file / -e).
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=6969 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/data/zephyreader.db \
    APP_URI=${APP_URI} \
    AUTH_URI=${AUTH_URI:-${APP_URI}/user} \
    PRIVATE_ROUTES=/settings,/team
WORKDIR /srv/app
# The injected packages live in the app's own node_modules, so the standalone
# output (traced from the app root) already carries them.
COPY --from=builder --chown=node:node /src/app/.next/standalone /srv/app/
COPY --from=builder --chown=node:node /src/app/.next/static /srv/app/.next/static
COPY --from=builder --chown=node:node /src/app/public /srv/app/public
COPY --from=builder --chown=node:node /src/app/server-wrapper.js /srv/app/server-wrapper.js
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 6969
CMD ["node", "server-wrapper.js"]

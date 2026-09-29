# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Podman/Buildah image for Zephyreader (OCI format; no Docker-only instructions).
#
# The Zephyrex framework and zod2gql are linked sibling checkouts
# (`link:../client-framework`, `link:../zod2gql`), so they are passed in as named
# build contexts and laid out as siblings of the app, exactly as on disk:
#
#   podman build -f Containerfile -t zephyreader \
#     --build-context client-framework=../client-framework \
#     --build-context zod2gql=../zod2gql \
#     --build-arg APP_URI=https://prompt.example.com .
#
# Wrap the build in memq on shared machines (it transpiles the framework source):
#   /home/jameson/Source/mem-queuer/memq run -m 16 -- podman build ...
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

FROM ${NODE_IMAGE} AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
RUN npm install --global --no-fund --no-audit "pnpm@${PNPM_VERSION}"
WORKDIR /src

# ---- linked siblings: install and build them where `link:../<name>` expects ----
FROM base AS siblings
COPY --from=zod2gql --exclude=node_modules --exclude=dist --exclude=.git . /src/zod2gql/
COPY --from=client-framework --exclude=node_modules --exclude=.next --exclude=.git \
     --exclude=storybook-static --exclude=test-results --exclude=playwright-report \
     . /src/client-framework/
RUN cd /src/zod2gql && pnpm install --frozen-lockfile && pnpm run compile
RUN cd /src/client-framework && pnpm install --frozen-lockfile --ignore-scripts

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
ARG APP_URI=http://localhost:6969
ARG AUTH_WEB=
ARG AUTH_SERVER=
ARG DEFAULT_THEME_MODE=dark
ENV APP_NAME=${APP_NAME} \
    APP_DESCRIPTION=${APP_DESCRIPTION} \
    APP_URI=${APP_URI} \
    AUTH_WEB=${AUTH_WEB} \
    AUTH_SERVER=${AUTH_SERVER} \
    DEFAULT_THEME_MODE=${DEFAULT_THEME_MODE} \
    NEXT_OUTPUT_STANDALONE=1 \
    NEXT_OUTPUT_TRACING_ROOT=/src
COPY . .
RUN pnpm run build

# ---- one-off schema migration (`podman build --target migrate`) ----
FROM builder AS migrate
ENV DATABASE_URL=file:/data/zephyreader.db
VOLUME /data
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# ---- runtime: the traced standalone server only, as a non-root user ----
FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=6969 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/data/zephyreader.db
WORKDIR /srv/app
# Standalone output nests the app under its path relative to the tracing root (/src).
COPY --from=builder --chown=node:node /src/app/.next/standalone /srv/
COPY --from=builder --chown=node:node /src/app/.next/static /srv/app/.next/static
COPY --from=builder --chown=node:node /src/app/public /srv/app/public
COPY --from=builder --chown=node:node /src/app/server-wrapper.js /srv/app/server-wrapper.js
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 6969
CMD ["node", "server-wrapper.js"]

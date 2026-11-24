#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Builds the client bundle that runs at /srv/zephyreader/client on prod-zephyreader: the
# Next.js standalone server, minified JavaScript only (no TypeScript, no source maps), plus
# the voice-follow model it serves from its own origin. The framework packages are compiled
# from their checkouts first (compile-frameworks.sh), because Zephyreader installs them from
# there.
# Usage: deploy/build-client.sh <root laid out by fetch-frameworks.sh> <out>
# The deployment's build-time settings come from the environment (deploy/deploy.env in CI).
set -euo pipefail

root=$(realpath -m "$1")
out=$(realpath -m "$2")
client="$root/Zephyreader/client"
: "${ZEPHYREADER_VARIANT:?}" "${APP_URI:?}" "${ZEPHYREADER_SERVER_URI:?}"
export CI=true NEXT_TELEMETRY_DISABLED=1
export pnpm_config_verify_deps_before_run=false pnpm_config_manage_package_manager_versions=false

"$(dirname "$0")/compile-frameworks.sh" "$root"

cd "$client"
pnpm install --frozen-lockfile
pnpm run fetch:voice-model
pnpm exec prisma generate
NODE_ENV=production NEXT_OUTPUT_STANDALONE=1 NEXT_DIST_DIR=.next-deploy ./node_modules/.bin/next build

# The standalone output is traced from the repository root (the build reads ../contract), so
# the server sits in its client/ directory, as in the container image.
rm -rf "$out"
mkdir -p "$out"
cp -a .next-deploy/standalone/. "$out/"
mkdir -p "$out/client/.next-deploy"
cp -a .next-deploy/static "$out/client/.next-deploy/static"
cp -a public "$out/client/public"
# Read from the working directory at request time by /docs/privacy.
mkdir -p "$out/client/src"
cp -a src/content "$out/client/src/content"
cp -a server-wrapper.js "$out/client/server-wrapper.js"
find "$out" -path "*/.next-deploy/*" -name "*.map" -delete
echo "client bundle: $(du -shL "$out" | cut -f1)"

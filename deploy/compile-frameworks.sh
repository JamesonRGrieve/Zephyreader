#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Compiles the framework packages Zephyreader's client installs, from the checkouts that
# fetch-frameworks.sh laid out, in dependency order: zod2gql, dynamic-form and auth, then the
# client-framework packages the client's pnpm-workspace.yaml overrides name (zephyrex first, as
# the others build on it; the workspace root's `compile` would build every package).
# Used by build-client.sh (the deploy) and by the release candidate's gate (scripts/gate.sh).
# Usage: deploy/compile-frameworks.sh <root laid out by fetch-frameworks.sh>
set -euo pipefail

root=$(realpath -m "$1")
client="$root/Zephyreader/client"
export pnpm_config_verify_deps_before_run=false pnpm_config_manage_package_manager_versions=false

for library in zod2gql dynamic-form auth; do
  (cd "$root/$library" && pnpm install --frozen-lockfile && pnpm run compile)
done
packages=$(grep -oE 'client-framework/packages/[a-z0-9-]+' "$client/pnpm-workspace.yaml" | sed 's#.*/##' | sort -u)
(
  cd "$root/client-framework"
  pnpm install --frozen-lockfile
  for package in zephyrex $(printf '%s\n' $packages | grep -vx zephyrex); do
    echo "compiling @zephyrex/$package"
    (cd "packages/$package" && pnpm run compile)
  done
)

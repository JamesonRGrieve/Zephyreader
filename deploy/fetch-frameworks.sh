#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Lays out a build workspace the way Zephyreader's path dependencies expect:
#   <root>/Zephyreader    this repository (copied)
#   <root>/<framework>    each framework at the commit deploy/frameworks.env pins
# Usage: deploy/fetch-frameworks.sh <root>
set -euo pipefail

root=$(realpath -m "$1")
repo=$(cd "$(dirname "$0")/.." && pwd)
# shellcheck source=frameworks.env
source "$repo/deploy/frameworks.env"

mkdir -p "$root"
rm -rf "$root/Zephyreader"
# A copy, not a link: pnpm and uv resolve the ../../ paths from where the files really are.
cp -a "$repo" "$root/Zephyreader"

fetch() {
  local name=$1 url=$2 ref=$3
  rm -rf "${root:?}/$name"
  git init -q "$root/$name"
  git -C "$root/$name" fetch -q --depth 1 "$url" "$ref"
  git -C "$root/$name" checkout -q FETCH_HEAD
  # A pin is a full commit SHA. Anything else (a branch, a short or mistyped SHA, a server
  # answering with another commit) is refused here, before a build can use it.
  local head
  head=$(git -C "$root/$name" rev-parse HEAD)
  if [ "$head" != "$ref" ]; then
    echo "$name: pinned $ref but fetched $head" >&2
    exit 1
  fi
  echo "$name at $head"
}

fetch server-framework https://github.com/JamesonRGrieve/ServerFramework.git "$SERVER_FRAMEWORK_REF"
fetch client-framework https://github.com/JamesonRGrieve/ClientFramework.git "$CLIENT_FRAMEWORK_REF"
fetch auth https://github.com/JamesonRGrieve/auth.git "$AUTH_REF"
fetch dynamic-form https://github.com/JamesonRGrieve/dynamic-form.git "$DYNAMIC_FORM_REF"
fetch zod2gql https://github.com/JamesonRGrieve/zod2gql.git "$ZOD2GQL_REF"

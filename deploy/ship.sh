#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Puts built bundles on prod-zephyreader. Never touches /etc/zephyreader/*.env: the pipeline
# owns those.
#
# Until launch it only places them. The operator keeps Zephyreader fully disabled until a
# network security audit passes (2026-11-04): zephyreader-server and zephyreader-client are
# modelled disabled and stopped, and nothing here starts them. Launch adds the restart and
# health check per part, with the previous bundle restored when a part does not come up
# (SOP: Zephyrex Framework SaaS Launch).
#
# Usage: deploy/ship.sh <server bundle> <client bundle>
# Environment: ZEPHYREADER_DEPLOY_HOST, ZEPHYREADER_DEPLOY_USER, ZEPHYREADER_DEPLOY_KEY
#              (private key), ZEPHYREADER_DEPLOY_KNOWN_HOSTS (the pinned host key line).
set -euo pipefail

server=$(realpath "$1")
client=$(realpath "$2")
: "${ZEPHYREADER_DEPLOY_HOST:?}" "${ZEPHYREADER_DEPLOY_USER:?}" "${ZEPHYREADER_DEPLOY_KEY:?}" "${ZEPHYREADER_DEPLOY_KNOWN_HOSTS:?}"

secrets=$(mktemp -d)
trap 'rm -rf "$secrets"' EXIT
umask 077
printf '%s\n' "$ZEPHYREADER_DEPLOY_KEY" > "$secrets/key"
printf '%s\n' "$ZEPHYREADER_DEPLOY_KNOWN_HOSTS" > "$secrets/known_hosts"
ssh_opts=(-i "$secrets/key" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes
  -o "UserKnownHostsFile=$secrets/known_hosts" -o ConnectTimeout=15)
target="$ZEPHYREADER_DEPLOY_USER@$ZEPHYREADER_DEPLOY_HOST"

# Fail fast, before anything changes, if prod-zephyreader cannot be reached at all.
if ! ssh "${ssh_opts[@]}" "$target" true; then
  echo "cannot reach $target over ssh; prod is unchanged" >&2
  exit 1
fi
remote() { ssh "${ssh_opts[@]}" "$target" "$@"; }
sync() { rsync -a --delete -e "ssh ${ssh_opts[*]}" "$1/" "$target:$2/"; }

# Place one part, keeping what was there as <dir>.previous for a rollback.
place() {
  local bundle=$1 dir=$2
  remote "if [ -d $dir ]; then rsync -a --delete $dir/ $dir.previous/; fi"
  sync "$bundle" "$dir"
  echo "$dir: placed"
}

place "$server" /srv/zephyreader/server
place "$client" /srv/zephyreader/client
echo "placed; zephyreader-server and zephyreader-client stay stopped until launch"

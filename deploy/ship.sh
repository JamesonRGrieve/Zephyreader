#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Puts built bundles on prod-zephyreader. Never touches /etc/zephyreader/*.env: the pipeline
# owns those.
#
# It places them and try-restarts the units, which starts nothing that is stopped: the pipeline
# owns enabling them (framework_app_enabled). Push to deploy, internal only: the domain is on the
# internal HAProxy with the public route staged for a one-click go-live (operator, 2026-11-24, via
# Chief of Staff and Infra Architect); no public edge until the network security audit of
# 2026-11-04's rule. Launch adds a health check per part, with the previous bundle restored when a
# part does not come up (SOP: Zephyrex Framework SaaS Launch).
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
# Restart what runs: a no-op while the units are stopped (until the pipeline enables them), and
# the new bundles take effect on every deploy after. The deploy user's sudoers rule allows exactly
# try-restart for these two units, one unit per command, by full path; -n fails at once instead of
# asking for a terminal.
for unit in zephyreader-server zephyreader-client; do
  remote "sudo -n /usr/bin/systemctl try-restart $unit"
done
# An enabled unit must be running after the restart: that fails the deploy. One not yet enabled
# (the first deploy, before the pipeline enables it) is only placed, never checked.
for unit in zephyreader-server zephyreader-client; do
  if remote "systemctl is-enabled --quiet $unit"; then
    # Still activating right after the restart counts as up; failed or inactive fails the deploy.
    state=$(remote "systemctl is-active $unit" || true)
    case $state in
      active | activating) ;;
      *) echo "$unit is enabled but $state after the restart" >&2; exit 1 ;;
    esac
    echo "$unit: running"
  else
    echo "$unit: not enabled yet; placed only"
  fi
done

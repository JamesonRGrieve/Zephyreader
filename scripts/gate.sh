#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Zephyreader's full gate (adopted from chronos scripts/gate.sh, 2026-11-24) on a build runner or in
# Forgejo CI (.forgejo/workflows/ci.yml), as a gate on a copy with its own caches (SOP *Zephyrex
# Framework App Standards* → Gates). It runs against the shipped copy of this repository and
# the frameworks at their pins, never the shared NFS tree: nothing it installs relinks a shared
# node_modules, and removing the job directory leaves the runner as it was.
#
#   On the desktop, ship the tracked and new files (never ignored ones such as .env or builds):
#     git ls-files -co --exclude-standard -z | tar --null -T - -cf - \
#       | ssh <runner> 'rm -rf <job> && mkdir -p <job>/src && tar -xf - -C <job>/src'
#   On the runner:
#     <job>/src/scripts/gate.sh <job> [step,step,...]
#
# Each step logs to <job>/logs/<step>.log and is summarised in <job>/logs/summary; the gate
# keeps going past a failure, so one run reports every failure, and exits non-zero if any
# step failed. The toolchain is the runner's own (Node 24.17, pnpm 11.1.1, uv and CPython
# 3.11.15 under ~/.local, the desktop's versions); every store, cache and TMPDIR is the job's.
set -uo pipefail

job=$(realpath -m "${1:?usage: scripts/gate.sh <job-dir> [steps]}")
steps=${2:-all}
src="$job/src"
ws="$job/ws"
logs="$job/logs"
# @swc/core (the Storybook test-runner's compiler) copies its native addon into a cache, and refuses
# a cache root any of whose parents another user can write; the runner's ~/.cache is 775. So the
# job dir and the swc cache are both 0700 (2026-11-20, 58133).
mkdir -p "$(dirname "$job")"
mkdir -p -m 700 "$job"
chmod 700 "$job"
mkdir -p "$logs" "$job/tmp" "$job/cache"
mkdir -p -m 700 "$job/swc-cache"

export PATH="$HOME/.local/bin:$HOME/.local/node24/bin:$PATH"
export CI=1 NEXT_TELEMETRY_DISABLED=1 TMPDIR="$job/tmp" XDG_CACHE_HOME="$job/cache"
export npm_config_store_dir="$job/pnpm-store" UV_CACHE_DIR="$job/uv-cache"
# uv links an installed python3.X into ~/.local/bin unless told otherwise: keep it in the job.
export UV_PYTHON_BIN_DIR="$job/bin"
export pnpm_config_verify_deps_before_run=false pnpm_config_manage_package_manager_versions=false
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
export E2E_SCRATCH="$job/tmp" SWC_NATIVE_BINDING_CACHE="$job/swc-cache"

# Runner time is granted, not taken: every step runs at nice 19 on exactly the cores the slot
# manager named in this job's BUILD GRANTED, passed as GATE_CORES (e.g. "15,17,18,19"; 2 to 4 of
# them). Each must be one this box lets us use (/sys/fs/cgroup/cpuset.cpus.effective, never nproc:
# 58133's set is sparse and changes), and other jobs hold the rest, so nothing here picks cores
# itself (SOP *Zephyrex Framework App Standards* → Gates; Session 1 Manager, 2026-11-20).
cpuset_file=/sys/fs/cgroup/cpuset.cpus.effective
cores=${GATE_CORES:-}
if [[ -z $cores ]]; then
  echo "GATE_CORES is required: the cores named in this job's BUILD GRANTED" >&2
  exit 2
fi
# sysfs files report size 0, so test the content, never -s (Remembron, 2026-11-20). A rootless
# podman job container (Forgejo CI) can't read the file: there the cores this process may run on
# (its affinity, which the container's cpuset bounds) are the allowed set (Remembron, 2026-11-24).
allowed=$(cat "$cpuset_file" 2>/dev/null)
if [[ -z $allowed ]]; then
  allowed=$(python3 -c 'import os; print(",".join(map(str, sorted(os.sched_getaffinity(0)))))') || exit 2
  echo "no readable $cpuset_file: checking GATE_CORES against this process's affinity ($allowed)" >&2
fi
core_count=$(python3 -c '
import sys
allowed = set()
for part in sys.argv[2].strip().split(","):
    low, _, high = part.partition("-")
    allowed.update(range(int(low), int(high or low) + 1))
try:
    asked = [int(core) for core in sys.argv[1].split(",")]
except ValueError:
    sys.exit(f"GATE_CORES {sys.argv[1]!r} is not a comma-separated list of core numbers")
if len(set(asked)) != len(asked):
    sys.exit(f"GATE_CORES {sys.argv[1]!r} names a core twice")
outside = [core for core in asked if core not in allowed]
if outside:
    sys.exit(f"GATE_CORES {outside} are not among this runner\x27s cores {sys.argv[2].strip()}")
if not 2 <= len(asked) <= 4:
    sys.exit(f"GATE_CORES names {len(asked)} cores; a job gets 2 to 4")
print(len(asked))
' "$cores" "$allowed") || exit 2
# Workers never outnumber the granted cores (Playwright runs one worker anyway: the lite
# edition's single database; see playwright.config.ts).
export VITEST_MAX_WORKERS=$core_count
echo "cores: $cores ($core_count, of $allowed)" > "$logs/cores"
# Pin once, here: the script re-runs itself at nice 19 on those cores, so every step and child
# inherits them. taskset can't run a shell function, and most steps are functions (exit 127,
# "failed to execute client": Remembron, 2026-11-20).
if [[ -z ${GATE_PINNED:-} ]]; then
  export GATE_PINNED=1 GATE_CORES
  exec nice -n 19 taskset -c "$cores" bash "$0" "$@"
fi

: > "$logs/summary"
failed=0
step() {
  local name=$1
  shift
  case ",$steps," in *",all,"* | *",$name,"*) ;; *) return 0 ;; esac
  echo "== $name: start $(date -u +%FT%TZ)" >> "$logs/summary"
  # No step reads stdin: vitest would swallow the rest of a script fed on stdin (bash -s).
  # The exit status is taken as a value, never from an `if` condition: bash ignores `set -e` inside
  # one, subshells included, so a step relying on it would pass on its last command alone (found
  # by the Wiki, 2026-11-20). This script has no `set -e`; every step function exits on failure.
  ("$@") < /dev/null > "$logs/$name.log" 2>&1
  local rc=$?
  if [[ $rc -eq 0 ]]; then
    echo "PASS $name" >> "$logs/summary"
  else
    echo "FAIL $name (exit $rc)" >> "$logs/summary"
    failed=1
    # Every later step needs these: stop, so the summary names the cause, not a cascade.
    case $name in pinned | layout | frameworks | install)
      echo "== stopped: $name is needed by every later step" >> "$logs/summary"
      exit 1
      ;;
    esac
  fi
}
client() { cd "$ws/Zephyreader/client" && "$@"; }
server() { cd "$ws/Zephyreader/server" && "$@"; }

# ESLint judged from its JSON report, never its exit code or a text formatter alone: a run that
# never linted (a dropped formatter, a crash before output) otherwise looks green. No report, or
# one that doesn't parse, fails loudly; any error or warning fails.
lint() (
  report="$job/tmp/eslint.json"
  rm -f "$report"
  client ./node_modules/.bin/eslint . --format json --output-file "$report"
  node -e '
    const fs = require("node:fs");
    const file = process.argv[1];
    if (!fs.existsSync(file)) { console.error(`ESLint wrote no report at ${file}: it never linted`); process.exit(1); }
    let results;
    try { results = JSON.parse(fs.readFileSync(file, "utf8")); }
    catch (error) { console.error(`ESLint report ${file} does not parse: ${error.message}`); process.exit(1); }
    if (!Array.isArray(results) || results.length === 0) { console.error("ESLint linted no files"); process.exit(1); }
    let problems = 0;
    for (const result of results) {
      for (const message of result.messages) {
        problems += 1;
        console.log(`${result.filePath}:${message.line}:${message.column} ${message.ruleId ?? "fatal"} ${message.message}`);
      }
    }
    console.log(`${results.length} files linted, ${problems} problems`);
    process.exit(problems === 0 ? 0 : 1);
  ' "$report"
)

# The framework's ratchets (zephyrex/gates) against Zephyreader's baselines in client/, as the commit
# hook runs them (.githooks/pre-commit).
ratchets() (
  client ./node_modules/.bin/zephyrex-gates check
)

# Playwright once per argument set in E2E_RUNS (separated by ';'), e.g. every lite test and only
# the SaaS visitor pages: "--project=lite --project=lite-phone;--project=saas --grep visitor".
# Unset, one run of everything. Fails if any run fails, after running them all.
e2e_runs() (
  status=0
  IFS=';' read -r -a runs <<< "${E2E_RUNS:-}"
  [[ ${#runs[@]} -gt 0 ]] || runs=('')
  for args in "${runs[@]}"; do
    echo "== playwright test $args"
    # shellcheck disable=SC2086
    client env ZEPHYREADER_E2E_PREBUILT=1 ./node_modules/.bin/playwright test $args || status=1
  done
  exit "$status"
)

# Builds both editions for e2e with no time limit, before any server starts: a Playwright webServer
# that builds inside its startup timeout ran past it on a loaded runner and no test ran (16
# Worldviews, 2026-11-20). playwright.config.ts then only starts these builds
# (ZEPHYREADER_E2E_PREBUILT). Each is built with the environment that config gives its build: the
# server URI and the app's URI are baked in, and a build made without them proxies the SaaS
# edition to the default port.
# The ports are playwright.config.ts's: 48000 + 10 × ZEPHYREADER_E2E_LANE (default 1).
e2e_build() (
  base=$((48000 + 10 * ${ZEPHYREADER_E2E_LANE:-1}))
  shared=(NEXT_TELEMETRY_DISABLED=1 ZEPHYREADER_E2E_BUILD=1 GOOGLE_ISSUER=http://127.0.0.1:$base)
  client env "${shared[@]}" ZEPHYREADER_VARIANT=lite NEXT_DIST_DIR=.next-e2e-lite PORT=$((base + 2)) \
    APP_URI=http://127.0.0.1:$((base + 2)) ./node_modules/.bin/next build || exit 1
  client env "${shared[@]}" ZEPHYREADER_VARIANT=saas NEXT_DIST_DIR=.next-e2e-saas PORT=$((base + 3)) \
    APP_URI=http://127.0.0.1:$((base + 3)) ZEPHYREADER_SERVER_URI=http://127.0.0.1:$((base + 1)) \
    ./node_modules/.bin/next build
)

# Serves the static Storybook on loopback for the length of the test-runner: on a port the OS says is
# free (another job may hold any fixed one), in its own process group, which an EXIT trap kills whole,
# so a timeout or interrupt never leaves a server running that a later job (anyone's) would test
# against. A leftover from this script's first form held 46006 for hours on 58133 (2026-11-20).
storybook_test() (
  port=$(python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')
  setsid python3 -m http.server "$port" --bind 127.0.0.1 --directory "$ws/Zephyreader/client/storybook-static" \
    > "$logs/storybook-http.log" 2>&1 < /dev/null &
  http=$!
  trap 'kill -- "-$http" 2>/dev/null' EXIT
  timeout 30 bash -c "until (exec 3<>/dev/tcp/127.0.0.1/$port) 2>/dev/null; do sleep 0.2; done" || {
    echo "the static Storybook server never came up" >&2
    exit 1
  }
  # It must be serving this job's own build, not another job's server that answered the port.
  static="$ws/Zephyreader/client/storybook-static"
  if ! curl -fsS "http://127.0.0.1:$port/index.json" | cmp -s - "$static/index.json"; then
    echo "the server on $port is not serving this build's index.json" >&2
    exit 1
  fi
  # Warm it: the first suite after a fresh static serve fails on navigation retries and visibility
  # timeouts while later runs pass (Zephyreader, 2026-11-20), so open one real story first.
  client node -e '
    const { chromium } = require("@playwright/test");
    const index = require(process.argv[2]);
    const story = Object.values(index.entries).find((entry) => entry.type === "story");
    (async () => {
      const browser = await chromium.launch();
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${process.argv[1]}/iframe.html?id=${story.id}&viewMode=story`);
      await page.waitForSelector("#storybook-root > *", { timeout: 120000 });
      await browser.close();
    })().catch((error) => { console.error(error); process.exit(1); });
  ' "$port" "$static/index.json" || {
    echo "the Storybook warm-up failed, so the suites would run cold" >&2
    exit 1
  }
  # STORY_FILES (space-separated path patterns) runs only those stories' files: a targeted
  # re-check before a release candidate, never the whole suite (operator, 2026-11-20).
  # shellcheck disable=SC2086
  client ./node_modules/.bin/test-storybook --url "http://127.0.0.1:$port" --maxWorkers="$core_count" ${STORY_FILES:-}
)

# The pin reached the steps: this step's own process runs on exactly GATE_CORES, at nice 19.
pinned() {
  python3 -c '
import os, sys
want = {int(core) for core in sys.argv[1].split(",")}
have = os.sched_getaffinity(0)
niceness = os.nice(0)
print(f"affinity {sorted(have)}, nice {niceness}")
sys.exit(0 if have == want and niceness >= 19 else 1)
' "$cores"
}

step pinned pinned
step layout "$src/deploy/fetch-frameworks.sh" "$ws"
step frameworks "$src/deploy/compile-frameworks.sh" "$ws"
# The server suite first: it needs only the frameworks. The SaaS e2e needs uvsync too.
step uvsync server uv sync --frozen
step pytest server .venv/bin/python -m pytest -q
step mypy server .venv/bin/mypy .
step ruff server bash -c '.venv/bin/ruff check . && .venv/bin/ruff format --check .'
# LOCKFILE=update regenerates pnpm-lock.yaml in this copy (a new dependency); it is then copied back
# by hand from the runner. Otherwise the lockfile must already match.
if [[ ${LOCKFILE:-} == update ]]; then
  step install client pnpm install --no-frozen-lockfile
else
  step install client pnpm install --frozen-lockfile
fi
# GATE_INSTALL_BROWSERS=1 (Forgejo CI's fresh container) installs Playwright's Chromium and its
# system libraries for the stories and e2e; the build runners already have them.
if [[ ${GATE_INSTALL_BROWSERS:-} == 1 ]]; then
  step browsers client ./node_modules/.bin/playwright install --with-deps chromium
fi
step prisma client ./node_modules/.bin/prisma generate
step format client ./node_modules/.bin/prettier --check .
step typecheck client ./node_modules/.bin/tsc --noEmit
step lint lint
step ratchets ratchets
# VITEST_RELATED (space-separated client paths) runs only the tests related to those files: a
# targeted check before a release candidate (operator, 2026-11-20).
# shellcheck disable=SC2086
if [[ -n ${VITEST_RELATED:-} ]]; then
  step vitest client ./node_modules/.bin/vitest related --run $VITEST_RELATED
else
  step vitest client ./node_modules/.bin/vitest run
fi
step storybook client ./node_modules/.bin/storybook build -o storybook-static --quiet
step sbtest storybook_test
# Both editions; the SaaS project boots server/e2e_server.py, so uvsync comes first.
step e2ebuild e2e_build
step e2e e2e_runs

echo "== done $(date -u +%FT%TZ)" >> "$logs/summary"
exit "$failed"

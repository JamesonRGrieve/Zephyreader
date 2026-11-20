#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Builds the server bundle that runs at /srv/zephyreader/server on prod-zephyreader:
#   python/    a standalone CPython (python-build-standalone): the CT's own Python is never used
#   venv/      the locked dependencies, the framework installed as an ordinary package
#   app/       zephyreader_app.py and Zephyreader's extensions
#   contract/  the shared contract (Contract.py reads it three levels above itself)
# Usage: deploy/build-server.sh <root laid out by fetch-frameworks.sh> <out>
set -euo pipefail

# The standalone CPython, pinned to one archive and its SHA-256 (python-build-standalone release
# 20260510, the build uv itself resolves for 3.11.15). The hash is the release's published
# SHA256SUMS (checked 2026-11-20). A mismatch is refused; bumping Python means updating all three.
PYTHON_RELEASE=20260510
PYTHON_ARCHIVE="cpython-3.11.15+${PYTHON_RELEASE}-x86_64-unknown-linux-gnu-install_only_stripped.tar.gz"
PYTHON_SHA256=171dffd8c0f66e8a0725364a7428015b22fc18dd298b24f541392e17dd0e561f
PYTHON_URL="https://github.com/astral-sh/python-build-standalone/releases/download/${PYTHON_RELEASE}/${PYTHON_ARCHIVE/+/%2B}"
# Where the bundle lives on the CT: the venv's pyvenv.cfg names its Python by this path.
INSTALL_DIR=/srv/zephyreader/server

root=$(realpath -m "$1")
out=$(realpath -m "$2")
repo="$root/Zephyreader"
server="$repo/server"

rm -rf "$out"
mkdir -p "$out"
archive="$out/.python.tar.gz"
curl -fsSL --retry 3 -o "$archive" "$PYTHON_URL"
if ! echo "$PYTHON_SHA256  $archive" | sha256sum --check --status; then
  echo "CPython archive does not match its pinned SHA-256: $(sha256sum "$archive" | cut -d' ' -f1)" >&2
  exit 1
fi
tar -xzf "$archive" -C "$out" # unpacks to $out/python
rm -f "$archive"

uv venv --relocatable --python "$out/python/bin/python3.11" "$out/venv"
(cd "$server" && UV_PROJECT_ENVIRONMENT="$out/venv" uv sync --frozen --no-dev --no-editable --no-install-project --python "$out/venv/bin/python")
# The venv finds its Python relative to itself, and records where that Python will be on the CT.
ln -sfn ../../python/bin/python3.11 "$out/venv/bin/python"
sed -i "s#^home = .*#home = $INSTALL_DIR/python/bin#" "$out/venv/pyvenv.cfg"

mkdir -p "$out/app"
cp "$server/zephyreader_app.py" "$out/app/"
cp -a "$server/extensions" "$out/app/extensions"
cp -a "$repo/contract" "$out/contract"
find "$out" -name "__pycache__" -prune -exec rm -rf {} +
find "$out/app" -name "*_test.py" -delete
echo "server bundle: $(du -sh "$out" | cut -f1)"

#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Builds the server bundle that runs at /srv/zephyreader/server on prod-zephyreader:
#   python/    a standalone CPython (python-build-standalone): the CT's own Python is never used
#   venv/      the locked dependencies, the framework installed as an ordinary package
#   app/       zephyreader_app.py and Zephyreader's extensions
#   contract/  the shared contract (Contract.py reads it three levels above itself)
# Usage: deploy/build-server.sh <root laid out by fetch-frameworks.sh> <out>
set -euo pipefail

PYTHON_VERSION=3.11.15
# Where the bundle lives on the CT: the venv's pyvenv.cfg names its Python by this path.
INSTALL_DIR=/srv/zephyreader/server

root=$(realpath -m "$1")
out=$(realpath -m "$2")
repo="$root/Zephyreader"
server="$repo/server"

rm -rf "$out"
mkdir -p "$out"
uv python install "$PYTHON_VERSION"
cp -a "$(dirname "$(dirname "$(uv python find "$PYTHON_VERSION")")")" "$out/python"

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

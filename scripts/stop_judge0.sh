#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$ROOT_DIR/.judge0"
VERSION="${JUDGE0_VERSION:-1.13.1}"
INSTALL_DIR="$STATE_DIR/judge0-v${VERSION}"

if [[ ! -d "$INSTALL_DIR" ]]; then
  echo "No Judge0 installation found at $INSTALL_DIR"
  exit 1
fi

pushd "$INSTALL_DIR" >/dev/null
docker compose down
popd >/dev/null

echo "Judge0 CE stopped."
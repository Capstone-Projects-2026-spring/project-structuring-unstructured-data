#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$ROOT_DIR/.judge0"
VERSION="${JUDGE0_VERSION:-1.13.1}"
PORT="${JUDGE0_PORT:-2358}"
ARCHIVE_NAME="judge0-v${VERSION}.zip"
ARCHIVE_PATH="$STATE_DIR/$ARCHIVE_NAME"
RELEASE_URL="https://github.com/judge0/judge0/releases/download/v${VERSION}/${ARCHIVE_NAME}"
INSTALL_DIR="$STATE_DIR/judge0-v${VERSION}"
CONF_FILE="$INSTALL_DIR/judge0.conf"

if [[ "$(uname -m)" == "arm64" && -z "${DOCKER_DEFAULT_PLATFORM:-}" ]]; then
  export DOCKER_DEFAULT_PLATFORM="linux/amd64"
fi

if curl -fsS "http://localhost:${PORT}/about" >/dev/null 2>&1; then
  echo "Judge0 is already running at http://localhost:${PORT}"
  exit 0
fi

if lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port ${PORT} is already in use, but it does not look like Judge0."
  echo "Stop the process using that port or set JUDGE0_PORT to a different host port before retrying."
  exit 1
fi

replace_or_append_conf() {
  local file="$1"
  local key="$2"
  local value="$3"

  if grep -q "^${key}=" "$file"; then
    perl -0pi -e "s/^${key}=.*$/${key}=${value}/m" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

mkdir -p "$STATE_DIR"

if [[ ! -d "$INSTALL_DIR" ]]; then
  echo "Downloading Judge0 CE v${VERSION}..."
  curl -fsSL "$RELEASE_URL" -o "$ARCHIVE_PATH"
  unzip -q -o "$ARCHIVE_PATH" -d "$STATE_DIR"
fi

if [[ -f "$CONF_FILE" ]]; then
  replace_or_append_conf "$CONF_FILE" "REDIS_PASSWORD" "${JUDGE0_REDIS_PASSWORD:-$(openssl rand -hex 16)}"
  replace_or_append_conf "$CONF_FILE" "POSTGRES_PASSWORD" "${JUDGE0_POSTGRES_PASSWORD:-$(openssl rand -hex 16)}"
fi

pushd "$INSTALL_DIR" >/dev/null
docker compose up -d db redis
echo "Waiting for Judge0 dependencies to initialize..."
sleep 10
JUDGE0_PORT="$PORT" docker compose up -d
popd >/dev/null

echo "Judge0 CE should be available at http://localhost:${PORT}"
echo "Set JUDGE0_URL=http://localhost:${PORT} in backend/.env before starting the backend."
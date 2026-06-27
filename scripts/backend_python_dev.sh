#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PYTHON_BIN="${CAN_LOG_VIEWER_PYTHON:-$REPO_ROOT/.venv/bin/python}"

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "backend python is not executable: $PYTHON_BIN" >&2
  echo "Set CAN_LOG_VIEWER_PYTHON or create the project venv first." >&2
  exit 127
fi

cd "$REPO_ROOT"
exec "$PYTHON_BIN" -m backend "$@"

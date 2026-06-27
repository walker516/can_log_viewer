#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

export CAN_LOG_VIEWER_PYTHON="${CAN_LOG_VIEWER_PYTHON:-$REPO_ROOT/.venv/bin/python}"
export CAN_LOG_VIEWER_BACKEND="$REPO_ROOT/scripts/backend_python_dev.sh"

if [[ ! -x "$CAN_LOG_VIEWER_PYTHON" ]]; then
  echo "backend python is not executable: $CAN_LOG_VIEWER_PYTHON" >&2
  echo "Create the venv with: python3 -m venv .venv && .venv/bin/python -m pip install -e \".[dev]\"" >&2
  exit 127
fi

echo "Using Python backend shim: $CAN_LOG_VIEWER_BACKEND"
echo "Using Python interpreter: $CAN_LOG_VIEWER_PYTHON"
echo "This bypasses the PyInstaller sidecar during Tauri dev."

cd "$REPO_ROOT"
exec npm run tauri -- dev "$@"

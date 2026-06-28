# Architecture

## Overview

The app is a local desktop CAN log viewer with a strict frontend/backend split.

- Desktop shell: Tauri
- Frontend: React + TypeScript
- Tauri layer: Rust commands, file dialogs, backend process execution, app data
  paths, PNG output path ownership
- Backend: Python CLI
- CAN log reader: python-can
- DBC decoder: cantools
- Cache format: parquet, with query helpers for selected signals and visible
  ranges
- Backend packaging: PyInstaller executable, wired as a Tauri sidecar

## Frontend Responsibilities

- Open Log UI.
- Signal search and selection.
- Lightweight Recent signal display backed by localStorage.
- Timeline rendering.
- Range selection, cursor placement, lane reorder, and lane delete interactions.
- Temporary per-lane reference line state and rendering.
- Render the timeline PNG bytes.

The frontend does not:

- decode logs directly
- read parquet directly
- build cache paths
- build export paths
- choose PNG destination
- expose DBC selection

## Tauri/Rust Responsibilities

Tauri commands bridge the frontend to local system capabilities:

- `decode_log`: normalize the selected log path, create/reuse cache, run backend
  `decode` if needed, then run `inspect`
- `inspect_cache`: development/helper command for inspecting a cache path
- `query_cache`: run backend `query`
- `export_timeline_png`: save rendered PNG bytes under app-managed
  `exports/png`

The Rust layer owns:

- backend discovery and process execution
- app data root resolution
- decode cache path calculation
- PNG export directory, filename sanitization, timestamp, and collision suffix

## Backend Responsibilities

The Python backend exposes a stable CLI:

```sh
python -m backend decode --log <log> --out <cache>
python -m backend inspect --cache <cache>
python -m backend query --cache <cache> --signals Speed,Gear --start 0 --end 10 --max-points-per-signal 5000
```

The packaged executable keeps the same interface:

```sh
can-log-viewer-backend decode --log <log> --out <cache>
can-log-viewer-backend inspect --cache <cache>
can-log-viewer-backend query --cache <cache> --signals Speed,Gear --start 0 --end 10 --max-points-per-signal 5000
```

The backend:

- reads BLF / ASC / CSV logs
- loads the fixed bundled `backend/resources/default.dbc`
- decodes frames into signal rows
- writes `meta.json`, `decoded_signals.parquet`, `signal_index.json`,
  `warnings.json`
- returns JSON for inspect/query
- returns structured warnings and summary counts

There is no DBC picker UI and no `--dbc` CLI option.

## Data Model

Decoded signal rows preserve:

| Field | Description |
| --- | --- |
| `session_time` | Time on the analysis timeline |
| `source_time` | Original timestamp from the log |
| `source_file` | Original source log path/name |
| `channel` | CAN channel |
| `can_id` | CAN arbitration ID |
| `message_name` | DBC message name |
| `signal_name` | DBC signal name |
| `value` | Decoded physical value |
| `raw_value` | Raw signal value if available |
| `unit` | Signal unit |
| `enum_label` | Enum label if available |

Signal index entries include signal name, message name, CAN ID, unit,
value/plot type, sample count, and first/last session time.

## App-managed Paths

All app-managed output lives under one root resolved by the Tauri/Rust layer.

Resolution order:

1. `CAN_LOG_VIEWER_APP_DATA_ROOT`, if set
2. Tauri's OS app data directory

Conceptual OS locations:

- Windows: `%LOCALAPPDATA%/<app-name>/`
- macOS: `~/Library/Application Support/<app-name>/`
- Linux: Tauri app data / XDG data directory equivalent

Layout:

```text
<app_data_root>/
  cache/
    logs/
      <hash>/
        meta.json
        decoded_signals.parquet
        signal_index.json
        warnings.json
  exports/
    png/
      <log_basename>_<YYYYMMDD_HHMMSS>_timeline.png
```

Cache and exports share a root but have different lifetimes:

- Cache is internal, regenerable data.
- PNG exports are user-facing artifacts and are not automatically deleted.

Old repo-root cache/export artifacts are not migrated automatically.

## Backend Discovery

The Tauri/Rust layer discovers the backend in this order:

1. `CAN_LOG_VIEWER_BACKEND`, if set
2. bundled Tauri sidecar executable
3. debug/dev builds only: `CAN_LOG_VIEWER_PYTHON`
4. debug/dev builds only: `python3`, then `python`

Packaged/release builds do not fall back to user-installed Python. End users
should not need Python, a venv, or backend dependencies.

Executable candidates receive backend CLI arguments directly. Python fallback
uses `python -m backend ...` and runs with the repository root as working
directory for local development.

Development caveat: the bundled sidecar is intentionally ahead of
`CAN_LOG_VIEWER_PYTHON` in the discovery order. If Tauri has copied
`can-log-viewer-backend` into `src-tauri/target/debug/`, a dev run with
`CAN_LOG_VIEWER_PYTHON=.venv/bin/python` may still use the sidecar. This is
correct for sidecar smoke coverage, but PyInstaller onefile startup can make
decode/inspect/query feel slower than the Python module fallback because every
backend call starts a new process. To force executable testing, use
`CAN_LOG_VIEWER_BACKEND`. For normal macOS/Linux/WSL development with the
Python module backend, use `scripts/dev_tauri_python.sh`; it points
`CAN_LOG_VIEWER_BACKEND` at a small shim that runs
`CAN_LOG_VIEWER_PYTHON -m backend`.

## Backend Executable and Sidecar

`scripts/build_backend_executable.py` builds the backend with PyInstaller.

Outputs:

```text
dist-python/backend/can-log-viewer-backend
dist-python/backend/can-log-viewer-backend-<target-triple>
```

On Windows the executable has `.exe`.

The target-triple copy is used by Tauri `bundle.externalBin`. The fixed
`default.dbc` is included as PyInstaller data and remains resolved through the
backend's resource loading path.

## Current Packaging Status

Implemented:

- PyInstaller backend executable prototype.
- Tauri sidecar wiring.
- Tauri app data root for cache/export.

Remaining:

- Windows packaged smoke without user-installed Python.
- Windows installer packaging.
- macOS packaging.
- Linux packaging.
- CI.

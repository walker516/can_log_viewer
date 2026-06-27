# CAN Log Viewer

Local desktop tool for offline CAN log analysis.

The app opens BLF / ASC / CSV CAN logs, decodes frames with the bundled fixed
DBC, and displays selected signals as vertically stacked timeline lanes.

It is not a real-time player. Playback controls, playback speed, real-time
cursor movement, DBC selection UI, and `--dbc` are intentionally out of scope.

## Features

- Open `.blf`, `.asc`, and `.csv` logs.
- Decode with bundled `backend/resources/default.dbc`.
- Create/reuse internal decode cache.
- Search by signal name, message name, and CAN ID.
- Display up to 5 selected signals as stacked timeline lanes.
- Range selection by dragging on the plot.
- Fit All by double-click or toolbar icon.
- Persistent cursor bar with per-lane cursor values.
- Point hover tooltip without file paths.
- Lane reorder by lane header drag.
- Signal removal by dragging a lane header to the temporary trash drop zone.
- Recent signal shortcut in the Signals pane, showing signal names only.
- Warning summary for decode/open issues.
- PNG export of the timeline only, with no save dialog.

## Current Status

Core viewer features are implemented. The project is now in packaging smoke /
distribution verification.

Implemented packaging pieces:

- PyInstaller backend executable prototype.
- Tauri sidecar wiring.
- Tauri app data directory for cache and PNG exports.

Remaining:

- Windows packaged smoke without user-installed Python.
- Windows installer packaging.
- macOS packaging.
- Linux packaging.
- CI.

## Project Layout

```text
backend/                    Python backend CLI
backend/resources/default.dbc
src/                        React + TypeScript frontend
src-tauri/                  Tauri/Rust desktop shell
scripts/generate_sample_blf.py
scripts/build_backend_executable.py
docs/
```

## Backend CLI

The backend uses the fixed bundled DBC. There is no `--dbc` option.

Create a Python environment:

macOS / Linux / WSL:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -e ".[dev]"
```

Windows PowerShell:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
```

Generate a synthetic BLF sample:

```sh
.venv/bin/python scripts/generate_sample_blf.py --out samples/sample.blf
```

Decode / inspect / query:

```sh
.venv/bin/python -m backend decode --log samples/sample.blf --out cache/sample
.venv/bin/python -m backend inspect --cache cache/sample
.venv/bin/python -m backend query --cache cache/sample --signals Speed,Gear --start 0 --end 10 --max-points-per-signal 5000
```

Cache output:

```text
meta.json
decoded_signals.parquet
signal_index.json
warnings.json
```

CSV input requires:

- `timestamp`
- `can_id`
- `data`

Optional CSV columns:

- `channel`
- `is_extended_id`
- `dlc`

## Frontend / Tauri Development

Prerequisites:

- Node.js and npm
- Rust toolchain
- Python venv with backend dependencies
- macOS: Xcode Command Line Tools may be required
- Linux: WebKitGTK / Tauri system dependencies may be required
- WSL: frontend build works, but desktop windows require a GUI environment or
  running Tauri on the host OS

Install frontend dependencies:

```sh
npm install
```

Build frontend:

```sh
npm run build
```

Run Tauri dev:

macOS / Linux / WSL:

```sh
scripts/dev_tauri_python.sh
```

This script sets `CAN_LOG_VIEWER_BACKEND` to a small Python backend shim, so
Tauri dev uses `.venv/bin/python -m backend` even when a PyInstaller sidecar
exists in `src-tauri/target/debug/`.

Windows PowerShell:

```powershell
$env:CAN_LOG_VIEWER_PYTHON = ".venv\Scripts\python.exe"
npm run tauri -- dev
```

Then choose `samples/sample.blf` with Open Log.

## App Data, Cache, and PNG Exports

App-managed output lives under Tauri's app data directory.

Conceptual locations:

- Windows: `%LOCALAPPDATA%/<app-name>/`
- macOS: `~/Library/Application Support/<app-name>/`
- Linux: Tauri app data / XDG data directory equivalent

Layout:

```text
<app_data_root>/
  cache/logs/<hash>/
  exports/png/
```

Cache is internal and regenerable. PNG exports are user-facing artifacts and are
not automatically deleted.

Override app data root for repeatable development checks:

macOS / Linux / WSL:

```sh
CAN_LOG_VIEWER_APP_DATA_ROOT="$PWD/.app-data" scripts/dev_tauri_python.sh
```

Windows PowerShell:

```powershell
$env:CAN_LOG_VIEWER_APP_DATA_ROOT = "$PWD\.app-data"
$env:CAN_LOG_VIEWER_PYTHON = ".venv\Scripts\python.exe"
npm run tauri -- dev
```

Relative override paths are resolved against the Tauri process working
directory. The directory is created if missing.

PNG export:

- no save dialog
- writes to `app_data_root()/exports/png/`
- filename:
  `<log_basename_without_ext>_<YYYYMMDD_HHMMSS>_timeline.png`
- collision suffixes `_001`, `_002`, ... are used
- existing files are never overwritten

The PNG contains only the timeline area. It excludes the Topbar, Signals pane,
Recent section, hover tooltip, and trash drop zone.

## Backend Executable

Build the PyInstaller backend executable:

```sh
.venv/bin/python scripts/build_backend_executable.py --clean
```

Output:

```text
dist-python/backend/can-log-viewer-backend
dist-python/backend/can-log-viewer-backend-<target-triple>
```

On Windows:

```text
dist-python\backend\can-log-viewer-backend.exe
dist-python\backend\can-log-viewer-backend-<target-triple>.exe
```

The target-triple copy is used by Tauri sidecar bundling. The executable keeps
the same CLI as `python -m backend` and bundles `default.dbc`.

Direct executable smoke:

```sh
dist-python/backend/can-log-viewer-backend decode --log samples/sample.blf --out /tmp/can_log_viewer_exe_cache
dist-python/backend/can-log-viewer-backend inspect --cache /tmp/can_log_viewer_exe_cache
dist-python/backend/can-log-viewer-backend query --cache /tmp/can_log_viewer_exe_cache --signals Speed,Gear --start 0 --end 10 --max-points-per-signal 5000
```

## Backend Discovery

Tauri discovers the backend in this order:

1. `CAN_LOG_VIEWER_BACKEND`, if set
2. bundled sidecar backend executable
3. debug/dev builds only: `CAN_LOG_VIEWER_PYTHON`
4. debug/dev builds only: `python3`, then `python`

Packaged/release builds do not fall back to user-installed Python.

Development note: if a sidecar executable already exists under
`src-tauri/target/debug/` or is otherwise discoverable by Tauri, it is used
before `CAN_LOG_VIEWER_PYTHON`. That means
`CAN_LOG_VIEWER_PYTHON=.venv/bin/python npm run tauri -- dev` can still run the
PyInstaller sidecar instead of `python -m backend`. PyInstaller onefile startup
can be noticeably slower because each backend command starts a separate process
and may pay executable extraction/startup cost. Use `scripts/dev_tauri_python.sh`
for normal macOS/Linux/WSL development when you want the Python module backend.
Use `CAN_LOG_VIEWER_BACKEND` when you want to explicitly test a backend
executable.

Force a backend executable in development:

```sh
CAN_LOG_VIEWER_BACKEND=dist-python/backend/can-log-viewer-backend npm run tauri -- dev
```

## Windows Packaged Smoke

This is the current next verification task. It is not completed yet.

Minimal plan:

1. Unset `CAN_LOG_VIEWER_BACKEND`, `CAN_LOG_VIEWER_PYTHON`, and
   `CAN_LOG_VIEWER_APP_DATA_ROOT`.
2. Build the backend executable:
   `.\.venv\Scripts\python.exe scripts\build_backend_executable.py --clean`
3. Build the Tauri release app:
   `npm run tauri -- build`
4. Start the generated release/bundle app directly.
5. Open `samples\sample.blf`.
6. Select `Speed` and `Gear`.
7. Confirm timeline/query/cursor/range/Fit All work.
8. Confirm Recent shows the selected signal names.
9. Export PNG.
10. Confirm cache and PNG were written under `%LOCALAPPDATA%/<app-name>/`.
11. Confirm repo-root `cache/` and `exports/` were not newly written.
12. Confirm the app works without Python on PATH.

Installer smoke comes after this passes.

## Tests

```sh
npm run build
npm run test:web
.venv/bin/python -m pytest -q
cd src-tauri && cargo check
```

## Documentation

- [Use cases](docs/use_cases.md) — authoritative product spec
- [Requirements](docs/requirements.md)
- [Architecture](docs/architecture.md)
- [UI Policy](docs/ui_policy.md)
- [Task Plan](docs/task_plan.md)

## Out of Scope

- DBC selection UI or `--dbc`.
- Save View, view metadata persistence, or session restore.
- Session history ring buffer.
- Decode cache LRU cleanup.
- Playback, playback speed, real-time cursor movement.
- PDF / CSV / JSON export.
- Lane-height drag resizing.
- Complex dashboard, cloud upload, authentication, heavy branding.

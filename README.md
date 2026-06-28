# CAN Log Viewer

Local desktop app for offline CAN log analysis.

It opens BLF / ASC / CSV logs, decodes frames with the bundled fixed
`backend/resources/default.dbc`, and displays selected signals as stacked
timeline lanes. It is not a real-time player.

Core interactions include signal search, signal/Recent click-to-toggle,
timeline range selection, Fit All, cursor inspection, lane reorder/delete,
optional per-lane reference lines, optional value transition markers, and PNG
export.

## Status

Core viewer features are implemented. Current focus is Windows packaged smoke:
release app + bundled backend sidecar + no user-installed Python + app data
cache/export verification.

## Setup

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -e ".[dev]"
npm install
```

Windows PowerShell:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
npm install
```

## Development

Generate a sample log:

```sh
.venv/bin/python scripts/generate_sample_blf.py --out samples/sample.blf
```

Run the app in development on macOS / Linux / WSL:

```sh
scripts/dev_tauri_python.sh
```

This uses `.venv/bin/python -m backend` even if a PyInstaller sidecar exists in
`src-tauri/target/debug/`.

Windows PowerShell:

```powershell
$env:CAN_LOG_VIEWER_PYTHON = ".venv\Scripts\python.exe"
npm run tauri -- dev
```

Build/check:

```sh
npm run build
npm run test:web
.venv/bin/python -m pytest -q
cd src-tauri && cargo check
```

## Backend CLI

```sh
.venv/bin/python -m backend decode --log samples/sample.blf --out cache/sample
.venv/bin/python -m backend inspect --cache cache/sample
.venv/bin/python -m backend query --cache cache/sample --signals Speed,Gear --start 0 --end 10 --max-points-per-signal 5000
```

## Backend Executable

```sh
.venv/bin/python scripts/build_backend_executable.py --clean
```

Outputs are written under `dist-python/backend/`. The target-triple copy is used
by Tauri sidecar bundling.

## Runtime Paths

Cache and PNG exports are app-managed:

```text
<app_data_root>/
  cache/logs/<hash>/
  exports/png/
```

Opened logs and saved PNGs are tracked internally by absolute path. The UI keeps
display text short by showing only basenames and filename-only export status.

Use this for repeatable local checks:

```sh
CAN_LOG_VIEWER_APP_DATA_ROOT="$PWD/.app-data" scripts/dev_tauri_python.sh
```

## Backend Discovery

Tauri uses:

1. `CAN_LOG_VIEWER_BACKEND`
2. bundled sidecar backend executable
3. debug/dev only: `CAN_LOG_VIEWER_PYTHON`
4. debug/dev only: `python3`, then `python`

Packaged/release builds do not fall back to user-installed Python.

Because the sidecar is before `CAN_LOG_VIEWER_PYTHON`, normal macOS/Linux/WSL
development should use `scripts/dev_tauri_python.sh` when the Python module
backend is desired.

## Documentation

- [Use cases](docs/use_cases.md)
- [Architecture](docs/architecture.md)
- [Task Plan](docs/task_plan.md)

# CAN Log Viewer

Local desktop tool for offline CAN log analysis.

The app reads BLF / ASC / CSV CAN logs and DBC files, decodes CAN frames into signals, and displays selected signals as vertically stacked timeline lanes.

This repository currently contains a Python backend prototype and a minimal Tauri + React frontend skeleton.

## Purpose

The primary use case is comparing multiple decoded CAN signals over time by zooming, panning, and selecting ranges on a timeline.

The tool is not a real-time player. It should not include playback controls, playback speed controls, or a moving real-time cursor.

## Target Workflow

1. Open one or more CAN log files and DBC files.
2. Search signals by signal name, message name, or CAN ID.
3. Select signals from search results.
4. Inspect selected signals in vertically stacked timeline lanes.
5. Zoom, pan, and select ranges with mouse interactions.
6. Export the current timeline view as PNG.

## Target Platform

- Primary distribution target: Windows executable
- Local desktop use only
- If a Python backend is used, it must be packaged as an executable and bundled with the app
- End users must not be required to install Python manually

## Preferred Stack

- Desktop shell: Tauri
- Frontend: React + TypeScript
- Backend: Python
- CAN log reader: python-can
- DBC decoder: cantools
- Cache: parquet + duckdb
- Timeline rendering: uPlot or Plotly.js

## Product Constraints

- Do not implement real-time playback.
- Do not implement playback speed controls.
- Do not add unnecessary toolbar buttons.
- Keep visible top-level actions minimal, ideally Open and Export.
- Save View should be automatic, not a manual primary action.
- Avoid heavy branding or product-name work.
- Keep the UI modern, simple, and focused on offline timeline inspection.

## Data Requirements

Decoded data must preserve both analysis time and original source timing:

- `session_time`: time on the concatenated analysis timeline
- `source_time`: original timestamp in the source log
- `source_file`: original log file path or name

When multiple logs are concatenated, source timing information must not be overwritten.

## Cache Requirements

History and decode cache are separate:

- History stores viewed sessions, selected signals, visible ranges, export history, and thumbnails.
- History uses a count-based ring buffer.
- Decode cache stores decoded parquet / duckdb data.
- Decode cache uses capacity-based LRU deletion.

## Documentation

- [Requirements](docs/requirements.md)
- [Architecture](docs/architecture.md)
- [UI Policy](docs/ui_policy.md)
- [Task Plan](docs/task_plan.md)

## Backend Prototype

Phase 1 provides a CLI-only Python backend prototype. It uses the fixed bundled DBC at `backend/resources/default.dbc`; there is intentionally no `--dbc` option yet.

Create and install backend dependencies in a Python virtual environment:

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

Decode a log:

```sh
.venv/bin/python -m backend decode --log sample.blf --out cache/sample
```

The command accepts `.blf`, `.asc`, and `.csv` logs. Repeat `--log` to append multiple logs into one `session_time` timeline.

Output:

```text
cache/sample/
  meta.json
  decoded_signals.parquet
  signal_index.json
  warnings.json
```

Generate a synthetic BLF sample that matches `backend/resources/default.dbc`:

```sh
.venv/bin/python scripts/generate_sample_blf.py --out samples/sample.blf
.venv/bin/python -m backend decode --log samples/sample.blf --out cache/sample
```

Then inspect or query the generated sample cache:

```sh
.venv/bin/python -m backend inspect --cache cache/sample
.venv/bin/python -m backend query --cache cache/sample --signals Speed,Gear --start 0 --end 10
```

Inspect a decoded cache:

```sh
.venv/bin/python -m backend inspect --cache cache/sample
```

Query selected signals for a visible `session_time` range:

```sh
.venv/bin/python -m backend query --cache cache/sample --signals Speed,Gear --start 10 --end 20
```

Optionally apply simple per-signal downsampling:

```sh
.venv/bin/python -m backend query --cache cache/sample --signals Speed --start 10 --end 20 --max-points-per-signal 5000
```

CSV prototype input requires these columns:

- `timestamp`
- `can_id`
- `data`

Optional CSV columns:

- `channel`
- `is_extended_id`
- `dlc`

Run tests:

```sh
.venv/bin/python -m pytest
```

## Frontend Skeleton

Phase 2 provides a minimal Tauri + React + TypeScript skeleton that opens a CAN log file, creates or reuses an internal decoded cache, and calls the backend query CLI through Tauri commands.

Development prerequisites:

- Node.js and npm
- Rust toolchain with `cargo` and `rustc`
- Python virtual environment with backend dependencies installed
- macOS: Xcode Command Line Tools may be required
- Linux: WebKitGTK and Tauri system dependencies may be required by the distro
- WSL: frontend build works in WSL, but desktop app windows generally require a Linux GUI environment or running Tauri on the host OS

On macOS, use toolchains and dependencies that match the machine architecture. Apple Silicon and Intel environments should not share native dependency directories.

Install frontend dependencies:

```sh
npm install
```

Build the frontend:

```sh
npm run build
```

Run the Tauri app in development:

```sh
npm run tauri -- dev
```

If Rust is missing, Tauri reports errors similar to:

```text
rustc: not installed
Cargo: not installed
Rust toolchain: couldn't be detected
```

Install Rust with rustup before running Tauri:

```sh
rustup default stable
```

The Tauri commands call the backend CLI. In development, set the Python interpreter explicitly so the app does not depend on an activated shell:

macOS / Linux / WSL:

```sh
CAN_LOG_VIEWER_PYTHON=.venv/bin/python npm run tauri -- dev
```

Windows PowerShell:

```powershell
$env:CAN_LOG_VIEWER_PYTHON = ".venv\Scripts\python.exe"
npm run tauri -- dev
```

If `CAN_LOG_VIEWER_PYTHON` is not set, the app tries `python3` and then `python`. The backend process runs with the repository root as its working directory.

For future packaging, `CAN_LOG_VIEWER_BACKEND` can point to a bundled backend executable instead of running `python -m backend`. Packaging is not implemented yet.

The current frontend flow is:

1. Open a `.blf`, `.asc`, or `.csv` CAN log file.
2. Decode the log through `python3 -m backend decode --log <log> --out <cache>`.
3. Reuse the internal cache on later opens when the same log path, size, and modified time match.
4. Inspect signals through `python3 -m backend inspect --cache <cache>`.
5. Search signals by signal name, message name, or CAN ID.
6. Select signals from the list.
7. Select a visible `session_time` range by dragging on the timeline. Double-click the timeline or use Fit All to return to the full range.
8. Query selected signals through `python3 -m backend query --cache <cache> --signals <signals> --start <start> --end <end> --max-points-per-signal 5000`.
9. Export the currently visible timeline area as PNG with Export.

After Open Log, the top bar shows only the opened log basename, for example `sample.blf`. It does not show the full path, cache path, signal count, or time range.

PNG Export currently saves only the timeline area. The Signals pane, top toolbar, and opened filename are not included in the image. The export includes the current visible range, selected lanes, points, time axis, grid, and cursor bar.

Not implemented yet:

- Save View
- PDF export
- CSV export
- Playback controls
9. Render selected signals as simple vertically stacked timeline lanes.

For local UI testing without a real BLF, generate and open the sample log:

```sh
.venv/bin/python scripts/generate_sample_blf.py --out samples/sample.blf
CAN_LOG_VIEWER_PYTHON=.venv/bin/python npm run tauri -- dev
```

Then choose `samples/sample.blf` from Open Log. The app writes an internal cache under `cache/logs/<hash>` and proceeds to signal search and timeline display.

Current frontend limitations:

- Opens one log file at a time.
- Does not expose DBC selection.
- Does not implement PNG export.
- Does not implement Save View or history.
- Does not implement playback, playback speed, or real-time cursor UI.

Planned distribution targets:

- Windows: exe
- macOS: .app or .dmg
- Linux: package format to be decided

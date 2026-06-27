# CAN Log Viewer

Local desktop tool for offline CAN log analysis.

The app reads BLF / ASC / CSV CAN logs and DBC files, decodes CAN frames into signals, and displays selected signals as vertically stacked timeline lanes.

This repository contains a Python backend (CAN log decoding, caching, and querying) and a Tauri + React + TypeScript desktop frontend (search-first signal selection and an interactive stacked-lane timeline with PNG export).

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

## Backend

The Python backend exposes a CLI (`decode`, `inspect`, `query`) used by the desktop app. It uses the fixed bundled DBC at `backend/resources/default.dbc`; there is intentionally no `--dbc` option.

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

## Frontend

A Tauri + React + TypeScript desktop app that opens a CAN log file, creates or reuses an internal decoded cache, and calls the backend CLI through Tauri commands. It provides search-first signal selection and an interactive stacked-lane timeline.

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

On macOS, if `cargo`/`rustc` are installed via rustup but not on the current shell's `PATH`, add them before running Tauri:

```sh
export PATH="$HOME/.cargo/bin:$PATH"
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

1. Open a `.blf`, `.asc`, or `.csv` CAN log file. Decoding uses the fixed bundled `default.dbc`; there is no DBC picker.
2. The app creates or reuses an internal decode cache (same log path, size, and modified time → reuse). The user never chooses the cache directory.
3. Search signals by signal name, message name, or CAN ID, and click results to add them (up to 5 displayed signals).
4. Inspect signals as vertically stacked lanes: points on a shared `session_time` (seconds) axis with grid lines.
5. Select a visible range by dragging on the plot area. Double-click the timeline, or the Fit All toolbar icon, returns to the full range.
6. Click the plot to place the persistent cursor bar; each lane shows that signal's value at the cursor time in the lane's top-right (enum label preferred, else value + unit, `-` if none before the cursor).
7. Hover a point for a tooltip (signal name, session_time, value, enum label, unit — no file path).
8. Reorder lanes by dragging a lane header; remove a signal by dragging its header onto the trash drop zone that appears during the drag.
9. Export the timeline as PNG with the Export toolbar icon (see below).

The backend is reached through Tauri commands (`decode_log`, `inspect_cache`, `query_cache`, `export_timeline_png`), which run the backend CLI; range queries request only the selected signals and visible range with `--max-points-per-signal 5000`.

The top bar shows Open Log, the opened log basename (for example `sample.blf`), a discreet warning/status area, and the Fit All and Export icon buttons on the right. It does not show the full path, cache path, signal count, or time range.

### PNG Export

Export is a single toolbar icon click — there is **no save dialog**. The PNG is written into the app-managed export directory `app_data_root()/exports/png/` (in development, `<repo root>/exports/png/`; the same `app_data_root()` that holds the decode cache). The file name is `<log_basename_without_ext>_<YYYYMMDD_HHMMSS>_timeline.png` (falling back to `timeline_<YYYYMMDD_HHMMSS>.png` when the basename is unavailable); unsafe characters are replaced and same-name collisions get a `_001`, `_002`, … suffix so existing files are never overwritten. On success the status shows `Exported <file name>` (not the full path).

The image contains only the timeline area: lanes, points, the time axis, grid, cursor bar, per-lane cursor values, and the current lane order. It excludes the top bar, Signals pane, hover tooltip, and the trash drop zone.

For local UI testing without a real BLF, generate and open the sample log:

```sh
.venv/bin/python scripts/generate_sample_blf.py --out samples/sample.blf
CAN_LOG_VIEWER_PYTHON=.venv/bin/python npm run tauri -- dev
```

Then choose `samples/sample.blf` from Open Log. The app writes an internal cache under `cache/logs/<hash>` and proceeds to signal search and timeline display.

Not implemented (intentionally out of scope for now):

- Opens one log file at a time.
- No DBC selection UI and no `--dbc` CLI option (fixed `default.dbc`).
- No Save View, view-metadata save, session restore, or history.
- No history/cache ring buffer or decode-cache LRU cleanup.
- No PDF or CSV export.
- No playback, playback speed, or real-time cursor UI.
- No lane-height drag resizing.
- Signal-selection history (re-suggesting recently used signals) is a planned Should item, not yet implemented.

Planned distribution targets:

- Windows: exe
- macOS: .app or .dmg
- Linux: package format to be decided

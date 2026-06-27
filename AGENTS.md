# AGENTS.md

## Project Goal

This project builds a local desktop CAN log visualization app.

The app reads BLF / ASC / CSV CAN logs and DBC files, decodes CAN frames into signals, and visualizes selected signals as vertically stacked timeline lanes.

The primary use case is offline log analysis, not real-time playback.

## Important Product Decisions

- Do not implement real-time playback.
- Do not implement playback speed controls.
- Do not implement real-time cursor movement.
- Do not add unnecessary toolbar buttons.
- Keep the UI modern but simple.
- The main user flow is:
  1. Open log and DBC files
  2. Search signals
  3. Select signals
  4. Inspect timeline by zooming/panning/selecting range
  5. Export the current view as PNG

## UI Policy

- Always minimize visible buttons.
- The top-level UI should have only essential actions: Open Log, plus Fit All and
  Export as right-side toolbar icon buttons.
- Save View is out of scope; do not add it. If view persistence is ever added it
  must be automatic, not a button.
- Use mouse interactions for range selection (plot-area drag) and cursor (plot
  click); double-click or the Fit All icon resets to full range.
- Signal selection is add-only by clicking search results; selected state is
  shown by list highlight (no selected-signal tag list, no × icon).
- Signal removal and lane reordering are done on the timeline (lane header drag →
  trash drop zone shown only during the drag), not in the Signals pane.
- Cursor-position values are shown per lane (top-right), not in a Topbar list.
- Advanced options should be hidden behind context menu, drawer, or settings.
- No brand-heavy title or product naming is needed.

## Architecture Policy

Preferred architecture:

- Desktop shell: Tauri
- Frontend: React + TypeScript
- Backend: Python
- CAN log reader: python-can
- DBC decoder: cantools
- Cache: parquet + duckdb
- Timeline rendering: uPlot or Plotly.js

Keep backend and frontend responsibilities separated.

Frontend:

- File selection UI
- Signal search UI
- Timeline rendering
- PNG export
- View state management

Backend:

- Read BLF / ASC / CSV
- Load DBC
- Decode CAN messages into signals
- Build signal index
- Persist parquet / duckdb cache
- Serve range queries by selected signal and time range
- Downsample on backend if the number of points is too large

## Data Model Requirements

The decoded data must preserve both:

- `session_time`: time on the concatenated analysis timeline
- `source_time`: original timestamp in the source log
- `source_file`: original log file path or name

Do not overwrite source timing information when concatenating logs.

## Cache Policy

Separate history and decode cache.

History:

- Stores viewed sessions, selected signals, visible ranges, export history, and thumbnails.
- Use count-based ring buffer.

Decode cache:

- Stores decoded parquet / duckdb data.
- Use capacity-based LRU deletion.

## Distribution Policy

- Target Windows executable distribution.
- If a Python backend is used, package it as an executable and bundle it with the app.
- End users must not be required to install Python manually.

## Coding Guidelines

- Keep modules small and focused.
- Avoid premature abstraction.
- Prefer explicit data models.
- Do not hide parsing errors silently; return structured warnings.
- Do not load entire huge logs into the frontend.
- Frontend should request only selected signals and visible time range.
- Downsample on backend if the number of points is too large.

## Required Reading Before Coding

- `docs/use_cases.md` — authoritative spec baseline (wins when docs disagree).
- `docs/task_plan.md` — done / next / out of scope; check before any change.
- `README.md`
- `docs/requirements.md`
- `docs/architecture.md`
- `docs/ui_policy.md`

## Do Not Implement Yet

Unless explicitly requested, do not implement:

- Real-time playback
- Playback speed
- CAN bus transmission
- Online device connection
- Complex dashboard layout
- Heavy project branding
- Cloud upload
- User authentication
- DBC selection UI or a `--dbc` CLI option (the bundled `default.dbc` is fixed)
- Save View, view-metadata save, or session restore
- Session history / cache ring buffer, or decode-cache LRU cleanup
- PDF / CSV / JSON export
- Lane-height drag resizing
- Signal selection history (UC-04) — planned later/Should; do not mix in unprompted

## Path and Export Guardrails (already shipped)

- PNG export has no save dialog and writes to `app_data_root()/exports/png/`.
  Do not revert it to a save dialog or to Downloads. The frontend passes only the
  rendered bytes and the log basename; the Tauri/Rust layer owns the path and
  file name. Cache and exports both derive from a single `app_data_root()`.
- Cache is internal and not user-selectable.
- Do not increase always-visible UI information.

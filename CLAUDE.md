# CLAUDE.md

## Role

Assist with development of a local desktop CAN log visualization tool.

Optimize for maintainability, small steps, explicit data models, and clear
frontend/backend boundaries.

## Required Reading

Before implementation work, read:

- `docs/use_cases.md` — authoritative specification baseline
- `docs/task_plan.md` — current status and next task
- `README.md`
- `docs/architecture.md`
- `AGENTS.md`

When documents disagree, `docs/use_cases.md` wins.

## Product Intent

This is an offline CAN log analysis viewer.

It opens BLF / ASC / CSV logs, decodes frames with the bundled fixed DBC, and
displays selected signals in vertically stacked timeline lanes.

It is not a real-time player.

## Current Implementation

Implemented:

- Open Log for `.blf`, `.asc`, `.csv`
- bundled `default.dbc` decode
- internal decode cache
- signal search and selection
- toggle selection from the Signals list and Recent
- max 5 signal timeline display
- plot range selection
- Fit All
- persistent cursor bar
- per-lane cursor values
- hover tooltip
- lane reorder
- trash drop zone delete during lane header drag
- Recent signal shortcut in the Signals pane
- optional draggable per-lane reference line
- warning summary
- PNG export without save dialog
- Tauri app data root for cache/export
- PyInstaller backend executable prototype
- Tauri sidecar wiring

Current remaining focus:

- Windows packaged smoke
- installer packaging
- macOS packaging
- Linux packaging
- CI

## Architecture Direction

Frontend:

- file selection UI
- signal search and selection
- Recent signal shortcut
- timeline rendering and interactions
- PNG byte rendering
- in-memory view state

Tauri/Rust:

- command bridge
- backend discovery and execution
- app data root resolution
- cache path ownership
- PNG export path and filename ownership

Backend:

- BLF / ASC / CSV reading
- bundled DBC loading
- frame decode
- signal index
- parquet cache
- selected-signal/time-range query
- downsampling
- structured warnings

Backend discovery order:

1. `CAN_LOG_VIEWER_BACKEND`
2. bundled sidecar backend executable
3. debug/dev only: `CAN_LOG_VIEWER_PYTHON`
4. debug/dev only: `python3`, then `python`

Release/packaged builds must not fall back to user-installed Python.

## UI Guardrails

- Do not increase always-visible UI information.
- Topbar remains Open Log, basename, discreet warning/status, Fit All icon,
  Export icon.
- Do not show full path, cache path, signal count, time range, or cursor value
  list in the Topbar.
- Selected state is signal-list highlight only.
- Do not restore selected-signal tags.
- Recent shows signal name only.
- Signal rows and Recent items toggle selection; do not add remove buttons.
- Signal removal and lane reorder live on the timeline.
- Reference lines are optional lane-local aids set by the lower-left lane
  handle and cleared by double-clicking that handle. Do not persist them.
- Per-lane cursor values stay in lane top-right.
- PNG export has no save dialog and writes to `app_data_root()/exports/png/`.

## Data Rules

Decoded signal rows must preserve:

- `session_time`
- `source_time`
- `source_file`
- `channel`
- `can_id`
- `message_name`
- `signal_name`
- `value`
- `raw_value`
- `unit`
- `enum_label`

The frontend must not load huge decoded datasets. It should request only
selected signals and the visible time range.

## Do Not Implement Unless Explicitly Requested

- Real-time playback.
- Playback speed controls.
- Real-time cursor movement.
- CAN transmission or online connection.
- DBC selection UI.
- `--dbc` CLI option.
- Save View.
- View metadata persistence.
- Session restore.
- Session history ring buffer.
- Decode cache LRU cleanup.
- PDF / CSV / JSON export.
- Lane-height drag resizing.
- Selected-signal tag UI.
- Always-visible remove icons.
- PNG save dialog or Downloads export.
- Complex dashboard, cloud upload, authentication, heavy branding.

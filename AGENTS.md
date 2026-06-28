# AGENTS.md

## Project Goal

This project builds a local desktop CAN log visualization app.

The app opens BLF / ASC / CSV CAN logs, decodes CAN frames with the bundled
fixed DBC, and visualizes selected signals as vertically stacked timeline lanes.

The primary use case is offline log analysis, not real-time playback.

## Required Reading Before Changes

Read these before coding or changing docs:

- `docs/use_cases.md` — authoritative specification baseline
- `docs/task_plan.md` — current status, current task, out of scope
- `README.md`
- `docs/architecture.md`

When documents disagree, `docs/use_cases.md` wins. Follow the current task in
`docs/task_plan.md` and do not widen scope unprompted.

## Current Architecture

- Desktop shell: Tauri
- Frontend: React + TypeScript
- Backend: Python CLI
- Backend packaging: PyInstaller executable wired as a Tauri sidecar
- CAN log reader: python-can
- DBC decoder: cantools
- Cache: app-managed parquet cache
- PNG exports: app-managed `exports/png`

Backend discovery order:

1. `CAN_LOG_VIEWER_BACKEND`, if set
2. bundled sidecar backend executable
3. debug/dev builds only: `CAN_LOG_VIEWER_PYTHON`
4. debug/dev builds only: `python3`, then `python`

Release/packaged builds must not fall back to user-installed Python.

## App-managed Paths

Cache and PNG exports derive from one Tauri/Rust-owned app data root.

- Default root: Tauri OS app data directory
- Development override: `CAN_LOG_VIEWER_APP_DATA_ROOT`
- Cache: `app_data_root()/cache/logs/<hash>/`
- PNG exports: `app_data_root()/exports/png/`

The frontend must not construct cache/export paths. PNG export has no save
dialog and must not be moved to Downloads.

## UI Policy

- Keep visible controls minimal.
- Topbar should remain: Open Log, log basename, discreet warning/status, Fit All
  icon, Export icon.
- Signal rows and Recent items toggle selection: click once to show the lane,
  click again to remove it. Recent history entries remain after toggle-off.
- Selected state is shown by list highlight.
- Do not restore selected-signal tags.
- Recent signals are a small Signals pane shortcut and show signal name only.
- Signal removal and lane reorder happen on the timeline:
  lane header drag, with a temporary trash drop zone for removal.
- Cursor-position values are shown per lane, not in the Topbar.
- Range selection is plot-area drag.
- Cursor placement is plot-area click.
- Fit All is timeline double-click or toolbar icon.
- Optional per-lane reference lines are set by dragging the small lower-left
  lane handle and cleared by double-clicking that handle. Do not add buttons,
  menus, popovers, or persistence for this feature unless explicitly requested.

## Data Requirements

Decoded signal data must preserve:

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

The frontend should request only selected signals and the visible time range.

## Do Not Implement Unless Explicitly Requested

- Real-time playback.
- Playback speed controls.
- Real-time cursor movement.
- CAN bus transmission or online device connection.
- Complex dashboard layout.
- Heavy branding.
- Cloud upload.
- User authentication.
- DBC selection UI.
- `--dbc` CLI option.
- Save View, view metadata persistence, or session restore.
- Session history ring buffer.
- Decode cache LRU cleanup.
- PDF / CSV / JSON export.
- Lane-height drag resizing.
- Selected-signal tag UI.
- Always-visible per-lane remove icons.
- PNG save dialog or Downloads export.

## Current Packaging Focus

Core viewer features are implemented. The current remaining work is packaging
verification, starting with Windows packaged smoke:

- release app starts
- bundled sidecar backend is used
- Python is not required
- app data cache/export paths are used
- Open Log, query, Recent, timeline, and PNG export work

Installer packaging, macOS packaging, Linux packaging, and CI are later tasks.

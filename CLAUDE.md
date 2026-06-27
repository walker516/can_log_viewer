# CLAUDE.md

## Role

You are assisting with implementation of a local desktop CAN log visualization tool.

Optimize for maintainability, small steps, explicit data models, and clear boundaries between frontend and backend.

## Required Reading

Before implementation work, read:

- `docs/use_cases.md` — the authoritative specification baseline. When docs
  disagree, `use_cases.md` wins.
- `docs/task_plan.md` — what is done, what is next, what is out of scope. Check
  it (and `use_cases.md`) before starting any change.
- `README.md`
- `docs/requirements.md`
- `docs/architecture.md`
- `docs/ui_policy.md`
- `AGENTS.md`

## Product Intent

This is an offline CAN log analysis viewer.

It reads BLF / ASC / CSV CAN logs and DBC files, decodes CAN frames into signals, and displays selected signals in vertically stacked timeline lanes.

The app is not a real-time player. Do not add playback controls unless explicitly requested.

## Required UX Direction

The UI must be modern but simple.

Important:

- Minimize visible buttons.
- Keep primary visible actions limited to Open and Export.
- Do not add a large toolbar.
- Do not add playback UI.
- Do not add speed controls.
- Do not add real-time cursor movement.
- Use search-first signal selection.
- Use tags for selected signals.
- Use mouse operations for zoom, pan, and range selection.
- Use auto-save for view state.
- Put advanced controls in a context menu, drawer, or settings.
- Avoid product-name or brand-heavy screens.

## Technical Direction

Preferred stack:

- Tauri
- React
- TypeScript
- Python backend
- python-can
- cantools
- parquet
- duckdb
- uPlot or Plotly.js

If a different stack is proposed, explain the tradeoff before changing direction.

## Responsibility Boundaries

Frontend:

- File selection UI
- Signal search UI (add-only; selected state shown by list highlight)
- Timeline rendering, lane reorder/delete, and per-lane cursor values
- PNG export (renders the timeline; the Tauri/Rust layer owns the output path)
- View state management (in-memory; no persistence)

Backend:

- Read BLF / ASC / CSV
- Load DBC
- Decode CAN messages into signals
- Build signal index
- Persist parquet / duckdb cache
- Serve range queries by selected signal and visible time range
- Downsample when point counts are too large

Do not load entire huge logs into the frontend.

## Data Rules

Decoded signal data must include:

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
- `enum_label` when available

Multiple logs must be concatenated using `session_time` while preserving original `source_time` and `source_file`.

## Cache Rules

Separate history and decode cache. (Status: the decode cache is implemented;
history, the ring buffer, and LRU cleanup are planned and not implemented yet —
do not add them unprompted.)

History (planned, not implemented):

- Stores viewed sessions, selected signals, visible ranges, export history, and thumbnails.
- Uses a count-based ring buffer.

Decode cache:

- Stores decoded parquet / duckdb data under `app_data_root()/cache/`.
- Capacity-based LRU deletion is planned (not implemented).

## Error Handling

Parsing failures should be reported as structured warnings with enough context:

- Source file
- Timestamp if available
- CAN ID if available
- Reason

Do not silently discard large classes of errors without a summary.

## Packaging Goal

Final target is Windows exe distribution.

If Python backend is used, package it as an executable and bundle it with the desktop app. Users must not be required to install Python manually.

## Do Not Implement Unless Explicitly Requested

- Real-time playback
- Playback speed controls
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
- A Start/End numeric range input, or any always-on cursor/value list in the
  Topbar or above the timeline

## Current Implementation Guardrails

These reflect decisions already shipped; do not silently revert them.

- `docs/use_cases.md` is the spec baseline; confirm against it and
  `docs/task_plan.md` before implementing. Do not exaggerate done vs not-done.
- Do not increase always-visible UI information. Selected state is shown by
  signal-list highlight only — no sidebar selected-signal tag list or × button.
- Signal removal and lane reordering live on the timeline (lane header drag →
  trash drop zone). Do not re-add removal/reorder controls to the Signals pane.
- Per-lane cursor values stay in each lane's top-right; do not move them to a
  Topbar/overview list.
- PNG export has no save dialog and writes to `app_data_root()/exports/png/`.
  Do not change it back to a save dialog or to Downloads. The frontend passes
  bytes + log basename only; the Tauri/Rust layer owns the path and file name.
- Cache and exports both derive from a single `app_data_root()`; keep that one
  decision point. Cache is internal and not user-selectable.
- Signal selection history (UC-04) is a planned later/Should task and is NOT
  implemented. Do not mix it into unrelated changes unprompted.

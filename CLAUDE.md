# CLAUDE.md

## Role

You are assisting with implementation of a local desktop CAN log visualization tool.

Optimize for maintainability, small steps, explicit data models, and clear boundaries between frontend and backend.

## Required Reading

Before implementation work, read:

- `README.md`
- `docs/requirements.md`
- `docs/architecture.md`
- `docs/ui_policy.md`
- `docs/task_plan.md`
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
- Signal search UI
- Selected signal tags
- Timeline rendering
- PNG export
- View state management

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

Separate history and decode cache.

History:

- Stores viewed sessions, selected signals, visible ranges, export history, and thumbnails.
- Uses a count-based ring buffer.

Decode cache:

- Stores decoded parquet / duckdb data.
- Uses capacity-based LRU deletion.

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

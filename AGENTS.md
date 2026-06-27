# AGENTS.md

## Project Goal

This project builds a local desktop CAN log visualization app.

The app reads BLF / ASC / CSV CAN logs and DBC files, decodes CAN frames into signals, and visualizes selected signals as vertically stacked timeline lanes.

The primary use case is offline log analysis, not real-time playback.

## Important Product Decisions

- Do not implement real-time playback.
- Do not implement playback speed controls.
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
- The top-level UI should have only essential actions such as Open and Export.
- Save view should be automatic, not a primary button.
- Use mouse interactions for zoom, pan, and range selection.
- Signal selection should be done by clicking search results.
- Signal removal should be done through selected signal tags.
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
- Persist parquet cache
- Serve range queries by selected signal and time range

## Data Model Requirements

The decoded data must preserve both:

- session_time: time on the concatenated analysis timeline
- source_time: original timestamp in the source log
- source_file: original log file path or name

Do not overwrite source timing information when concatenating logs.

## Cache Policy

Separate history and decode cache.

History:
- Stores viewed sessions, selected signals, visible ranges, export history, and thumbnails.
- Use count-based ring buffer.

Decode cache:
- Stores decoded parquet / duckdb data.
- Use capacity-based LRU deletion.

## Coding Guidelines

- Keep modules small and focused.
- Avoid premature abstraction.
- Prefer explicit data models.
- Do not hide parsing errors silently; return structured warnings.
- Do not load entire huge logs into the frontend.
- Frontend should request only selected signals and visible time range.
- Downsample on backend if the number of points is too large.

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
# Requirements

## Purpose

Build a local desktop app for offline CAN log visualization.

The app reads BLF / ASC / CSV CAN logs and DBC files, decodes CAN frames into signals based on the DBC, and visualizes selected signals as vertically stacked timeline lanes.

The primary goal is comparing multiple signals over time by zooming, panning, and selecting ranges.

Real-time playback is not required.

## Supported Inputs

- BLF CAN logs
- ASC CAN logs
- CSV CAN logs
- DBC files

CSV support should be explicit about expected columns when implemented. Parsing errors must be returned as warnings instead of being hidden silently.

## Functional Requirements

### File Loading

- Select one or more local CAN log files.
- Select one or more DBC files.
- Accept BLF / ASC / CSV logs.
- Accept DBC databases.
- Reuse decode cache after initial decode when inputs are unchanged.

### Log Concatenation

- Concatenate multiple logs into a single analysis timeline.
- Use `session_time` for the concatenated timeline.
- Preserve `source_time` from the original log.
- Preserve `source_file` from the original log.
- Do not overwrite source timing information during concatenation.

Initial implementation should prefer append-style concatenation unless a later task explicitly requires source-time alignment.

### Signal Decode

- Decode CAN frames into signal rows using DBC definitions.
- Preserve message name, signal name, CAN ID, channel, unit, raw value, physical value, and enum label when available.
- Build a searchable signal index.
- Return structured warnings for unknown messages, malformed frames, unsupported CSV rows, and decode errors.
- Summarize warning counts so large logs do not flood the UI.

### Signal Search and Selection

- Search by signal name.
- Search by message name.
- Search by CAN ID.
- Add signals by clicking search results (add-only; selected state shown by list
  highlight, not a tag list).
- Remove signals on the timeline (lane header drag → trash drop zone), not in the
  Signals pane.
- Showing recently selected signals as a re-selection aid is planned (UC-04, not
  implemented yet).

### Timeline View

- Display selected signals as vertically stacked lanes.
- Use one lane per selected signal.
- Render continuous numeric values as line plots.
- Render boolean, state, and enum-like values as step plots.
- Support mouse-based zoom, pan, and range selection.
- Request only the selected signals and visible time range from the backend.
- Downsample on the backend when the number of points is too large.
- Do not load entire huge logs into the frontend.

### Export

- Export the current visible timeline as PNG.
- Export uses the current visible range and selected signals.
- Export without a save dialog: write to the app-managed `app_data_root()/exports/png/`
  directory (the user does not choose the destination; never Downloads).
- Use a deterministic file name from the log basename plus timestamp, with
  collision suffixes and no overwriting.
- Saving export metadata (visible range / selected signals) is deferred (tied to
  the out-of-scope Save View / view-state work).

### History (planned, not implemented)

- Automatically save viewed sessions.
- Store selected signals, visible ranges, export history, and thumbnails when available.
- Restore recent sessions.
- Use a count-based ring buffer.
- Do not require a manual Save View button.

### Decode Cache

- Cache decoded parquet / duckdb data under the app-managed `app_data_root()` (the
  user does not select the location).
- Store cache separately from history.
- Make cache entries identifiable by source logs, DBCs, parser options, and relevant file metadata.
- Capacity-based LRU deletion is planned (not implemented yet).

## Non-Requirements

Do not implement unless explicitly requested:

- Real-time playback
- Playback speed changes
- Real-time cursor movement
- CAN bus transmission
- Online device connection
- Complex dashboard layout
- Heavy product branding
- Cloud upload
- User authentication
- Large always-visible toolbars

## Distribution Requirements

- Primary distribution target is Windows exe.
- If the backend uses Python, package the backend as an executable.
- Bundle the backend executable with the desktop app.
- End users must not be required to install Python manually.

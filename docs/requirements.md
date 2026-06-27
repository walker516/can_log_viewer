# Requirements

## Purpose

Build a local desktop app for offline CAN log analysis.

The app opens BLF / ASC / CSV CAN logs, decodes CAN frames with the bundled fixed
DBC, and visualizes selected signals as vertically stacked timeline lanes.

The product is an offline viewer, not a real-time player.

## Functional Requirements

### Log Loading and Decode

- Open one local `.blf`, `.asc`, or `.csv` log file from the UI.
- Use the bundled `backend/resources/default.dbc`.
- Do not expose a DBC picker or a `--dbc` CLI option.
- Decode CAN frames into signal rows.
- Preserve `session_time`, `source_time`, `source_file`, `channel`, `can_id`,
  `message_name`, `signal_name`, `value`, `raw_value`, `unit`, and
  `enum_label` when available.
- Return structured warnings for unknown messages, malformed frames,
  unsupported CSV rows, decode errors, empty logs, and read errors.
- Show a concise warning summary in the UI.

### Decode Cache

- Store decoded cache internally under `app_data_root()/cache/logs/<hash>/`.
- Reuse cache when the opened log path, size, and modified time match.
- Do not let users choose the cache directory.
- Cache is regenerable internal data.
- Capacity-based cache cleanup is not implemented yet.

### Signal Search and Selection

- Search by signal name, message name, and CAN ID.
- Add signals by clicking search results.
- Show selected state by highlighting rows in the Signals list.
- Do not show selected-signal tags.
- Display at most 5 signals at a time.
- Reject the 6th selection with a light warning.
- Remove signals on the timeline by lane header drag to the temporary trash
  drop zone.
- Reorder signals by dragging lane headers.

### Recent Signals

- Store recently selected signals in frontend localStorage under
  `can_log_viewer.recent_signals.v1`.
- Keep up to 10 items.
- Show only signal names in the Recent section.
- Filter Recent to signals that exist in the currently opened log.
- Treat this as a lightweight selection shortcut only; it is not session
  history, cache history, view restore, or Save View.

### Timeline View

- Render selected signals as vertically stacked lanes.
- Use point display for all signal types.
- Share one `session_time` x-axis with grid lines across lanes.
- Support plot-area drag for visible range selection.
- Support Fit All by timeline double-click and toolbar icon.
- Support a persistent cursor bar by plot click.
- Show cursor-position value per lane in the lane top-right.
- Show hover tooltip for point details without source file/path data.
- Query only selected signals and the visible time range from the backend.
- Downsample in the backend when point counts exceed the requested limit.

### PNG Export

- Export only the current timeline area as PNG.
- Include lanes, points, time axis, grid, cursor bar, per-lane cursor values,
  current lane order, and selection overlay if visible.
- Exclude Topbar, Signals pane, Recent section, hover tooltip, and trash drop
  zone.
- Do not show a save dialog.
- Save to `app_data_root()/exports/png/`.
- Use `<log_basename_without_ext>_<YYYYMMDD_HHMMSS>_timeline.png`.
- Add `_001`, `_002`, ... suffixes on name collision; never overwrite.

## Distribution Requirements

- Primary distribution target is Windows.
- Package the Python backend as an executable and bundle it with the Tauri app.
- End users must not be required to install Python, a venv, or backend
  dependencies.
- Release/packaged builds must not fall back to user-installed Python.
- Current remaining work is Windows packaged smoke, then installer packaging.

## Non-Requirements

Do not implement now:

- Real-time playback.
- Playback speed controls.
- Real-time cursor movement.
- CAN bus transmission or online device connection.
- DBC selection UI or `--dbc`.
- Save View, session restore, or view metadata persistence.
- Session history ring buffer.
- Decode cache LRU cleanup.
- PDF / CSV / JSON export.
- Lane-height drag resizing.
- Complex dashboard layout, heavy branding, cloud upload, or authentication.

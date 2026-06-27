# Use Cases

This file is the authoritative product specification baseline.

## Purpose

The app is a local offline CAN log viewer. It opens BLF / ASC / CSV logs,
decodes frames with the bundled fixed DBC, and shows selected signals as
stacked timeline lanes for visual comparison.

The app is not a real-time player and does not transmit CAN messages.

## UI Principles

- Main flow starts with `Open Log`.
- Cache is internal and not user-selectable.
- Keep visible controls minimal.
- Use timeline interactions for range selection, cursor placement, lane reorder,
  and signal removal.
- Show only the log basename, not full paths or cache paths.
- Do not show Start / End input boxes.
- Do not show selected-signal tags.
- Do not show cursor values in the Topbar; show them per lane.

Visible top-level controls:

- Open Log
- Fit All icon
- Export icon

## UC-01: Open a CAN Log

User opens a `.blf`, `.asc`, or `.csv` log with `Open Log`.

The app:

- validates the extension
- creates or reuses an internal decode cache
- decodes with `backend/resources/default.dbc`
- inspects the cache
- displays the signal list
- shows only the opened log basename

No DBC picker, `--dbc` option, cache picker, full path, or cache path is exposed.

## UC-02: Search Signals

User searches signals in the Signals pane.

Search fields:

- signal name
- message name
- CAN ID

The Signals pane is fixed width. Search and Recent remain at the top; the
signal list scrolls internally.

## UC-03: Select Signals for Timeline Display

User clicks a signal row to add it to the timeline.

Rules:

- selected rows are highlighted in the signal list
- maximum 5 displayed signals
- 6th selection is rejected with a light warning
- no selected-signal tag list
- no remove icon in the Signals pane

Signals are removed from the timeline via UC-16.

## UC-04: Recent Signal Selection History

The Signals pane includes a lightweight Recent section.

Behavior:

- store recently selected signals in frontend localStorage
- key: `can_log_viewer.recent_signals.v1`
- maximum 10 items
- display signal name only
- filter to signals present in the currently opened log
- clicking a Recent item reselects that signal
- selected state is shown consistently with signal list highlighting

Stored data may include signal name, message name, CAN ID, unit,
`last_selected_at`, and `selection_count`, but only signal name is shown.

This is not session history, cache history, view restore, or Save View.

## UC-05: Inspect the Timeline

Selected signals are shown as stacked lanes.

Timeline behavior:

- one signal per lane
- point display for all signal types
- shared `session_time` x-axis in seconds
- grid lines across lanes
- lane-local y-scale
- empty lane state when no data is in range

The frontend requests only selected signals and the visible time range.

## UC-06: Select a Visible Range

User drags on the plot area to choose a time range.

The app:

- shows a translucent selection overlay while dragging
- updates the visible range on drag end
- queries the backend for the selected signals in that range
- keeps cursor time in range, moving it to range start if needed

Start / End numeric inputs are not shown.

## UC-07: Fit All

User returns to the full log range by:

- double-clicking the timeline, or
- pressing the Fit All toolbar icon

If the cursor is outside the restored range, it moves to the range start.

## UC-08: Persistent Cursor Bar

The timeline shows a persistent vertical cursor bar.

Behavior:

- initial position is `0s` or the visible range start
- plot-area click moves the cursor
- cursor remains visible when not hovering
- cursor spans all lanes
- no cursor time label above the bar
- no Topbar cursor/value list

Each lane shows that signal's value at the cursor time in its top-right.
If there is no exact timestamp, use the latest value before the cursor
hold-last-value style. If no earlier value exists, show `-`.

## UC-09: Hover Point Tooltip

Hovering a point may show:

- signal name
- session_time
- value
- enum label
- unit

Tooltip must not show source file, full path, or cache path.

## UC-10: Collapse Signals Pane

User can collapse and reopen the Signals pane.

Selection, query results, cursor, lane order, and timeline state remain.

## UC-11: Export Timeline PNG

User presses the Export toolbar icon.

Behavior:

- no save dialog
- save automatically under `app_data_root()/exports/png/`
- export timeline area only
- filename:
  `<log_basename_without_ext>_<YYYYMMDD_HHMMSS>_timeline.png`
- sanitize unsafe filename characters
- append `_001`, `_002`, ... on collision
- never overwrite existing files
- status shows only the saved file name

PNG includes:

- timeline lanes
- points
- time axis
- grid
- cursor bar
- per-lane cursor values
- current lane order
- selection overlay if visible

PNG excludes:

- Topbar
- Open Log / Fit All / Export controls
- opened log basename display
- warning/status text
- Signals pane
- Recent section
- hover tooltip
- trash drop zone

Only PNG export is supported.

## UC-12: Show Opened Log Name

After Open Log, the UI shows only the log basename, for example:

```text
sample.blf
```

It does not show full path, cache path, signal count, or time range.

## UC-13: Reuse Decode Cache

The app generates a cache key from log path, file size, and modified time.

If the cache contains the required files and matches the opened log, decode is
skipped and inspect/query use the existing cache.

Cache is internal and regenerable. Cache LRU cleanup is not implemented.

## UC-14: Show Decode and Open Errors

Errors and warnings are surfaced without freezing the app.

Examples:

- unsupported log type
- CSV missing columns
- malformed CSV row
- unknown message
- decode error
- empty log
- log read error
- backend executable start failure
- invalid backend JSON

Warnings are summarized discreetly in the Topbar when present.

## UC-15: Generate Development Sample Log

Developers can generate a synthetic BLF matching the bundled DBC:

```sh
.venv/bin/python scripts/generate_sample_blf.py --out samples/sample.blf
```

The sample supports backend tests and UI smoke checks. It is not exposed in the
app UI.

## UC-16: Reorder and Remove Timeline Lanes

User drags a lane header.

Behavior:

- dropping on another lane reorders lanes
- a trash drop zone appears only during lane header drag
- dropping on the trash zone removes that signal from the timeline
- dropping elsewhere makes no change

Plot-area drag remains range selection. Plot-area click remains cursor
placement. Lane-height drag resizing is out of scope.

## Out of Scope

- Real-time playback.
- Playback speed controls.
- Real-time cursor movement.
- CAN transmission or online device connection.
- DBC selection UI.
- `--dbc` CLI option.
- Save View.
- View metadata persistence.
- Session restore.
- Session history ring buffer.
- Decode cache LRU cleanup.
- PDF / CSV / JSON export.
- Lane-height drag resizing.
- Advanced multi-log alignment or manual time offset.
- Cloud upload, authentication, complex dashboard, heavy branding.

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

Internally, the opened log path is kept as an absolute path. The full path is
not shown in the main UI.

## UC-02: Search Signals

User searches signals in the Signals pane.

Search fields:

- signal name
- message name
- CAN ID

The Signals pane is fixed width. Search and Recent remain at the top; the
signal list scrolls internally.

## UC-03: Toggle Signals for Timeline Display

User clicks a signal row to show or hide it in the timeline.

Rules:

- unselected signal click adds a lane
- selected signal click removes that lane
- selected rows are highlighted in the signal list
- maximum 5 displayed signals
- 6th addition is rejected with a light warning
- removal never triggers the maximum-count warning
- no selected-signal tag list
- no remove icon in the Signals pane
- signal identity is `message_name + signal_name + can_id`

Signals may also be removed from the timeline via UC-16.

## UC-04: Recent Signal Selection History

The Signals pane includes a lightweight Recent section.

Behavior:

- store recently selected signals in frontend localStorage
- key: `can_log_viewer.recent_signals.v1`
- maximum 10 items
- display signal name only
- filter to signals present in the currently opened log
- clicking a Recent item uses the same toggle behavior as the signal list
- selected state is shown consistently with signal list highlighting
- toggle-off removes the lane but does not delete the Recent history entry

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
- return the absolute saved PNG path internally
- status shows only the saved file name

PNG includes:

- timeline lanes
- points
- time axis
- grid
- cursor bar
- per-lane cursor values
- current lane order
- optional reference lines and labels
- visible value transition markers
- selection overlay if visible

PNG excludes:

- Topbar
- Open Log / Fit All / Export controls
- opened log basename display
- warning/status text
- Signals pane
- Recent section
- hover tooltip
- value transition marker hover tooltip
- trash drop zone

Only PNG export is supported.

## UC-12: Show Opened Log Name

After Open Log, the UI shows only the log basename, for example:

```text
sample.blf
```

It does not show full path, cache path, signal count, or time range.

The full opened-log path may be kept in frontend state for internal commands
and future copy/open actions, but it is not shown as persistent UI text.

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

## UC-17: Optional Per-lane Reference Line

User may set one temporary horizontal reference line per numeric lane.

Behavior:

- default state shows no reference line
- a small lower-left lane handle is visible for numeric lanes
- dragging the handle sets or updates the reference value
- double-clicking the handle clears that lane's reference line and label
- enum-valued signals snap to available enum values
- reference lines are temporary frontend state and are not saved
- reference line and label are included in PNG export
- the handle is operation UI and is excluded from PNG export

No button, menu, popover, input, localStorage persistence, or multiple reference
lines are implemented.

## UC-18: Optional Value Transition Markers

User may show temporary value transition markers on selected timeline lanes to
find state changes during CAN debug.

Scope:

- v1 targets signals with `enum_label` values.
- enum and bool-like signals are the intended use case.
- continuous numeric signals are out of scope for v1.
- numeric threshold detection is a separate future feature.
- complex condition builders are out of scope for v1.

Behavior:

- marker state is lane-local and defaults to off
- marker on/off state is keyed by signal identity:
  `message_name + signal_name + can_id`
- enabling markers on a lane shows small markers at value transition points
- disabling markers hides markers for that lane
- lane reorder preserves marker state with the signal identity
- removing a signal from the timeline clears that signal's marker state
- marker on/off state is temporary frontend state and is not saved

Transition detection:

- transitions are detected in the frontend from the visible/query-result points
- points are evaluated in ascending `session_time` order
- the first valid point establishes the previous value and is not marked
- a transition is marked when the current valid point differs from the previous
  valid point
- `enum_label` is preferred for display when present; otherwise use the decoded
  value
- null or non-finite values do not create transition markers

Marker interaction:

- hovering a marker shows the signal name, `session_time`, and `old -> new`
  transition
- marker hover tooltip is not included in PNG export
- clicking a marker moves the persistent cursor bar to that marker's
  `session_time`
- plot-area drag remains range selection
- plot-area click outside markers remains cursor placement
- lane header drag remains lane reorder / trash delete

PNG export:

- visible markers are included in PNG export
- marker hover tooltip is excluded from PNG export

Accuracy note:

- frontend-only detection can miss short transitions if the backend query has
  downsampled them out of the visible/query-result points
- if exact transition detection is required, a future backend
  transition-preserving query or event query is needed

## Out of Scope

Do not implement unless explicitly requested:

- real-time playback, playback speed, or real-time cursor movement
- CAN transmission or online device connection
- DBC selection UI or `--dbc`
- Save View, view metadata persistence, or session restore
- session history ring buffer
- decode-cache LRU cleanup
- PDF / CSV / JSON export
- lane-height drag resizing
- advanced multi-log alignment or manual time offset
- cloud upload, authentication, complex dashboard, or heavy branding

# UI Policy

## Direction

The UI is a focused offline timeline viewer. It should feel modern and clear,
but it must not grow into a large dashboard or real-time player.

Keep visible buttons and always-visible information minimal.

## Main Flow

1. Open Log.
2. Search signals.
3. Select up to 5 signals.
4. Inspect the timeline by click, drag, hover, lane reorder, and Fit All.
5. Export the current timeline as PNG.

## Topbar

The Topbar contains only:

- Open Log
- opened log basename
- discreet warning/status text
- Fit All icon button
- Export icon button

Do not add:

- full path
- cache path
- signal count
- time range
- cursor value list
- Save View
- playback controls
- zoom button cluster

## Signals Pane

- Fixed width.
- Collapsible.
- Search box and Recent section stay above the list.
- Signal list scrolls internally.
- Selected signals are shown by row highlight.
- No selected-signal tag UI.
- No per-row remove icon for selected signals.
- Recent shows signal name only, up to 10 entries.
- Recent is a lightweight local selection shortcut, not session history.

## Timeline

Timeline interactions:

- plot drag: range selection
- plot click: move persistent cursor bar
- double click: Fit All
- lane header drag: reorder lanes
- lane header drag to temporary trash drop zone: remove signal
- point hover: tooltip

Timeline display:

- maximum 5 signals
- one signal per lane
- point display
- shared `session_time` axis
- grid lines
- per-lane cursor value in each lane's top-right

Do not show cursor values in the Topbar or above the timeline.

## PNG Export

Export is PNG only and uses the Export icon.

- No save dialog.
- Save to `app_data_root()/exports/png/`.
- The Tauri/Rust layer owns the output directory and filename.
- Status shows the saved file name only.

PNG includes timeline content only:

- lanes
- points
- axis
- grid
- cursor bar
- per-lane cursor values
- current lane order
- visible selection overlay

PNG excludes:

- Topbar
- Signals pane
- Recent section
- hover tooltip
- trash drop zone

## Out of Scope UI

Do not add unless explicitly requested:

- playback controls
- playback speed
- real-time cursor movement
- DBC picker
- Save View
- session restore UI
- PDF / CSV / JSON export UI
- lane-height drag resizing
- large settings or dashboard surfaces

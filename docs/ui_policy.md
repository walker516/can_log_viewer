# UI Policy

## Basic Direction

The UI should be modern but simple.

This is not a CANalyzer clone with many toolbars. It is an offline timeline analysis viewer.

## Main Flow

The main flow should be:

1. Open logs and DBC
2. Search signal
3. Select signal
4. Inspect timeline
5. Export PNG

## Button Policy

Visible top-level buttons should be minimal.

Preferred visible buttons:

- Open
- Export

Do not add top-level buttons for:

- Save View
- Play
- Pause
- Speed
- Zoom In
- Zoom Out
- Reset Zoom
- Cache Clear
- History Save

Those actions should be automatic, mouse-based, hidden in context menus, or placed in settings if needed.

## Layout

Preferred layout:

- Left: signal search and selected signals
- Center: timeline lanes
- Top of timeline: overview mini map
- Optional right drawer: signal details

## Signal Selection

- Search results can be clicked to add or remove signals
- Selected signals are shown as tags
- Tags have a small × for removal
- Selected signal lanes can be reordered by drag and drop

## Timeline Interaction

- Mouse wheel: zoom
- Drag: pan
- Range drag: select range
- Double click: fit or reset
- Context menu: advanced actions

## Export

Export should default to:

- PNG
- Current visible range
- Current selected signals

Advanced export options can be hidden in the export dialog.

## History

History should be automatic.

Do not require the user to press Save View.

## Naming

Do not spend time on product naming or branding.

Use neutral labels such as:

- Log Viewer
- CAN Log Viewer
- Timeline
- Signals
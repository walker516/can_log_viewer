# UI Policy

## Basic Direction

The UI should be modern, simple, and optimized for offline timeline inspection.

This is not a real-time player and not a full CANalyzer-style workspace. Avoid complex dashboards, dense toolbars, and brand-heavy screens.

## Main Flow

1. Open logs and DBC files.
2. Search signals.
3. Select signals.
4. Inspect the timeline.
5. Export the current timeline as PNG.

## Top-Level Actions

Visible top-level actions should be minimal.

Preferred visible actions:

- Open
- Export

Avoid top-level buttons for:

- Save View
- Play
- Pause
- Speed
- Real-time cursor
- Zoom In
- Zoom Out
- Reset Zoom
- Cache Clear
- History Save

These actions should be automatic, mouse-based, hidden in context menus, or placed in settings if needed.

## Layout

Preferred layout:

- Left: signal search and selected signal tags
- Center: vertically stacked timeline lanes
- Top of timeline area: optional overview / range mini map
- Optional right drawer: signal details or warnings

Do not make the first screen a marketing or landing page. The first screen should be the usable analysis workspace.

## Signal Selection

- Search results can be clicked to add signals.
- Selected signals are shown as tags.
- Tags provide the removal affordance.
- Selected signal lanes may be reordered by drag and drop when implemented.
- Do not use a large always-visible signal management toolbar.

## Timeline Interaction

Preferred interactions:

- Mouse wheel: zoom
- Drag: pan
- Range drag: select range
- Double click: fit or reset if needed
- Context menu: advanced actions

Do not add playback controls or playback speed controls.

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

- CAN Log Viewer
- Timeline
- Signals
- History
- Warnings

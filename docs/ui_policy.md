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

The current Topbar holds: Open Log (left); the opened log basename; a discreet
warning/status area; and the Fit All and Export icon buttons on the right. Fit
All and Export are icon-only (labelled via tooltip/aria-label). Topbar items are
vertically centered. Do not increase the always-visible information here.

Preferred visible actions:

- Open
- Export
- Fit All (right-side icon)

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

- Left: fixed-width Signals pane (search + result list; the list scrolls).
- Center: vertically stacked timeline lanes.
- The Signals pane and the timeline share the same top edge / height; no empty
  band above the timeline.

Do not make the first screen a marketing or landing page. The first screen should be the usable analysis workspace.

## Signal Selection

- Search results are clicked to add signals (add-only; the 5-signal cap applies).
- The selected state is shown by highlighting rows in the signal list. There is
  no selected-signal tag list and no always-visible × remove icon.
- Removal and reordering of displayed signals are done on the timeline, not in
  the Signals pane (see Timeline Interaction).
- Do not use a large always-visible signal management toolbar.

## Timeline Interaction

Preferred interactions:

- Plot-area drag: select a visible range (translucent overlay).
- Plot-area click: place the persistent cursor bar.
- Double click: Fit All (also available as the right-side toolbar icon).
- Lane header drag: reorder lanes.
- Lane header drag → trash drop zone (shown only during the drag): remove a
  signal. Do not show a per-lane remove icon at all times.
- Each lane shows the cursor-position value in its top-right; do not show a
  combined cursor/value list in the Topbar or above the timeline.
- There is no Start/End numeric input; range is set by dragging.

Do not add playback controls or playback speed controls.

## Export

Export is a single right-side toolbar icon (PNG, current visible range, current
selected signals).

- No save dialog. The PNG is written to the app-managed `exports/png/` directory;
  the user does not choose the destination and it is never saved to Downloads.
- Success is reported as a short status (the saved file name only — not the full
  path).

## History

History is not implemented and is out of scope for now.

Do not add a Save View button; if view persistence is ever added it must be
automatic, not a manual action.

## Naming

Do not spend time on product naming or branding.

Use neutral labels such as:

- CAN Log Viewer
- Timeline
- Signals
- History
- Warnings

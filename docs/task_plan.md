# Task Plan

This file tracks current project status. `docs/use_cases.md` is the
authoritative product specification; when documents disagree, use cases win.

## Current Status

Core viewer functionality is implemented:

- Open `.blf`, `.asc`, and `.csv` logs.
- Decode with the bundled fixed `backend/resources/default.dbc`.
- Create and reuse internal decode cache under the Tauri app data directory.
- Search signals by signal name, message name, and CAN ID.
- Toggle up to 5 signals for stacked timeline display from the signal list or
  Recent.
- Show point-based timeline lanes with a shared `session_time` axis and grid.
- Select a visible range by dragging on the plot area.
- Fit All by timeline double-click or the toolbar icon.
- Show a persistent cursor bar and per-lane cursor values.
- Show point hover tooltip without source file/path information.
- Reorder lanes by lane header drag.
- Remove signals by dropping a dragged lane header on the temporary trash zone.
- Show lightweight Recent signals in the Signals pane.
- Show optional draggable per-lane reference lines.
- Show decode/open warning summary discreetly.
- Export the current timeline as PNG with no save dialog.
- Store PNG exports under `app_data_root()/exports/png/`.
- Resolve `app_data_root()` through Tauri's app data directory, with
  `CAN_LOG_VIEWER_APP_DATA_ROOT` as a development override.
- Build a PyInstaller backend executable prototype.
- Wire the backend executable as a Tauri sidecar.

Verification baseline:

- `npm run build`
- `npm run test:web`
- `.venv/bin/python -m pytest -q`
- `cargo check` in `src-tauri`
- Backend executable direct smoke with `samples/sample.blf`

## Current Task

Windows packaged smoke.

Confirm a release/bundled app can run without user-installed Python:

- app starts from the packaged/release output
- bundled backend sidecar is used when `CAN_LOG_VIEWER_BACKEND` is unset
- Python fallback is not used in release builds
- `samples/sample.blf` opens and decodes
- `Speed` / `Gear` can be selected and queried
- Recent signal history works
- PNG export writes to app data `exports/png`
- decode cache writes to app data `cache/logs/<hash>`
- repo-root `cache/` and `exports/` are not newly written

## Next

Installer packaging plan / Windows installer smoke.

## Later

- macOS packaging smoke.
- Linux packaging smoke.
- CI for backend, frontend, Rust, and packaging checks.
- Optional decode cache cleanup policy.
- Optional full packaging release documentation.

## Out of Scope

Do not implement unless explicitly requested:

- Save View or view metadata persistence.
- Session restore.
- Session history ring buffer.
- Decode-cache LRU cleanup.
- DBC selection UI.
- `--dbc` CLI option.
- Real-time playback, playback speed, or real-time cursor movement.
- PDF / CSV / JSON export.
- Lane-height drag resizing.
- Advanced multi-log time alignment or manual offset.
- Cloud upload, user authentication, complex dashboard, heavy branding.

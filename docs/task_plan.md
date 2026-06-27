# Task Plan

This plan tracks implementation against `docs/use_cases.md`, which is the
authoritative specification. It is organized so the current state is obvious:

- **Completed** — done and verified.
- **Current status** — where the project is right now.
- **Next recommended tasks** — the next small, in-scope steps.
- **Later tasks** — in scope eventually, but deliberately deferred.
- **Out of scope** — must not be implemented now.

Standing constraints (from `docs/use_cases.md` and the UI policy):

- Do not let users choose the cache directory; cache is internal.
- Do not add a DBC selection UI.
- Do not add a `--dbc` CLI option.
- Do not add playback / playback-speed / real-time cursor UI.
- Do not add a Save View action.
- Do not add history or cache ring buffers yet.
- Do not increase the amount of always-visible UI information.

---

## Completed

### Project preparation

- `README.md`, `AGENTS.md`, `CLAUDE.md`.
- `docs/requirements.md`, `docs/architecture.md`, `docs/ui_policy.md`,
  `docs/use_cases.md`, `docs/task_plan.md`.
- `.gitignore`, `.editorconfig`.

### Backend (decode / cache / query)

- Python backend package with python-can, cantools, pyarrow/parquet.
- Fixed bundled DBC loading from `backend/resources/default.dbc`
  (no `--dbc` option, resolved independently of the current directory).
- BLF / ASC reading via python-can; CSV reading with an explicit column format.
- Frame-to-signal decode preserving `session_time`, `source_time`,
  `source_file`, `channel`, `can_id`, `message_name`, `signal_name`, `value`,
  `raw_value`, `unit`, `enum_label`.
- Append-style concatenation across multiple logs on one `session_time` line.
- `decoded_signals.parquet` and `signal_index.json` generation.
- Structured warnings with summary counts (`warnings.json`).
- CLI: `decode`, `inspect`, `query` (with `--max-points-per-signal` downsample).
- Decode cache directory output (`meta.json` / parquet / index / warnings).
- Focused tests over small synthetic data. (UC-13, UC-14, UC-15 backend side.)

### Development sample log (UC-15)

- `scripts/generate_sample_blf.py` produces `samples/sample.blf` matching the
  bundled DBC; used for manual checks and regression tests. CLI/script only,
  not exposed in the app UI.

### Frontend / integration

- Tauri + React + TypeScript app wired to the backend CLI via Tauri commands.
- Open Log for `.blf` / `.asc` / `.csv`; internal decode cache create/reuse by
  log path + size + modified time; inspect after decode. (UC-01, UC-13.)
- Signal search by signal name / message name / CAN ID. (UC-02.)
- Add-only signal selection from the list; the selected state is shown by list
  highlight only — there is no sidebar selected-signal tag list or × button
  (removal lives on the timeline). (UC-02, UC-03, UC-16.)
- Timeline: one lane per signal, point display, shared `session_time` x-axis
  with grid. (UC-03, UC-05.)
- Maximum 5 displayed signals; a 6th selection is rejected with a light
  warning. (UC-03.)
- Mouse range selection on the plot area with a translucent overlay. (UC-06.)
- Fit All via timeline double-click and the Fit All toolbar icon. (UC-07.)
- Persistent cursor bar spanning all lanes; each lane shows that signal's value
  at the cursor time in its top-right (hold-last-value, enum label preferred);
  no top/Topbar value readout. (UC-08.)
- Hover tooltip showing signal name / session_time / value / enum_label / unit,
  and intentionally not source_file or any path. (UC-09.)
- Signals pane is fixed width with internal list scroll, and is collapsible
  without losing selection or query results. (UC-02, UC-10.)
- Opened log shown as basename only (no path, cache path, count, or range).
  (UC-12.)
- Decode/open errors surface as a concise status message without freezing the
  app. (UC-14.)

### Timeline interaction, toolbar, and layout

- Lane reorder by dragging a lane header (pointer-based, works in the WebKit
  WebView); plot-area drag stays range selection, plot-area click stays cursor
  placement. (UC-16.)
- Signal removal by dragging a lane header onto the trash drop zone that appears
  only during the drag (excluded from the PNG). (UC-16.)
- Fit All and Export are right-side toolbar icon buttons; the old in-timeline
  Fit All row is gone and the timeline body fills the panel.
- Topbar items vertically centered; Signals pane and timeline share the same top
  edge / height with no empty space above the timeline.
- Discreet decode warning summary (counts by code) near the status, shown only
  when there are warnings. (UC-14 / requirements warning summary.)
- PNG Export via the toolbar icon with **no save dialog**: written to
  `app_data_root()/exports/png/` (same app-managed root as the decode cache) as
  `<log_basename_without_ext>_<YYYYMMDD_HHMMSS>_timeline.png` (sanitized,
  collision-suffixed `_001`…, never overwriting); status shows the saved file
  name. The image contains the timeline, points, axis, grid, cursor bar,
  per-lane cursor values, and current lane order, and excludes the Topbar,
  Signals pane, hover tooltip, and trash zone. (UC-11.)

### Structure hardening (refactor)

- Frontend split by responsibility: `App.tsx` reduced to a thin composition
  layer; feature hooks under `src/hooks/`; pure helpers under `src/lib/`;
  presentational components under `src/components/` with co-located CSS;
  monolithic `styles.css` split into `styles/base.css` + per-component CSS.
  No UI/behavior changes.
- Backend responsibility split and looser coupling: DBC access (`dbc.py`),
  cache layout/IO (`cache.py`), reader registry (`readers.py`), decode
  orchestration (`decoder.py`), read-side queries (`cache_query.py`), thin CLI
  (`cli.py`). `decode_logs` takes injectable seams (DBC loader, DBC resolver,
  log reader) with production defaults, enabling tests without real
  cantools/python-can. CLI compatibility preserved.

---

## Current status

All Must use cases (UC-01, 02, 03, 05, 06, 07, 08, 09, 10, 11, 16) and the Should
use cases UC-12, UC-13 are implemented, plus UC-14 (errors + discreet warning
summary) and UC-15 (dev sample). Lane reorder/delete, per-lane cursor values,
toolbar icon layout, dialog-less PNG export to `app_data_root()/exports/png/`,
and the Topbar/timeline layout/alignment fixes are done. The codebase has been
refactored for maintainability and testability.

Verification baseline: `npm run build` passes; `python -m pytest -q` passes;
`npm run test:web` (Node built-in runner) passes; `cargo check` on `src-tauri`
compiles; `samples/sample.blf` decodes, inspects, and queries (Speed line /
Gear step) through the backend CLI. Frontend interaction use cases still rely on
manual Tauri verification.

Not yet done: UC-04 signal selection history (Should), and everything under
Later tasks / Out of scope.

---

## Next recommended tasks

Small, in-scope steps, roughly in order. Do not batch these into one large change.

1. **Cross-platform Tauri smoke check.** Manually verify the interaction use
   cases (UC-06/07/08/09/10/11/16, per-lane cursor values, dialog-less PNG
   export, Topbar/timeline alignment) on the dev build. On macOS, if cargo is not
   on PATH, run `export PATH="$HOME/.cargo/bin:$PATH"` first.

2. **UC-04 signal selection history (Should).** Show recently selected signals
   discreetly inside the Signals pane (e.g. up to 10 recent), re-selectable.
   Store signal name / message name / CAN ID / unit / last-selected time /
   selection count. This is a lightweight UI aid and must be kept distinct from
   the out-of-scope session history ring buffer. Keep its storage internal; do
   not expose its location or add management UI.

---

## Later tasks

In scope eventually, but deferred until the above are stable.

- **Cache location review before packaging.** Decode cache currently lives under
  the repository (`cache/logs/<hash>`). For distribution it should move to the
  OS local app data directory per `docs/architecture.md`. This touches the Rust
  cache-key/reuse logic and should be done as part of packaging, not before.
- **Export image stabilization (if needed).** PNG export clones the timeline DOM
  and inlines computed styles; revisit only if CSS changes cause rendering
  regressions.
- **Packaging (Windows primary; macOS / Linux).** Package the Python backend as
  an executable (PyInstaller or equivalent), bundle it with the Tauri app, build
  the Windows exe/installer, and verify the app runs without a manually installed
  Python. Document release steps.

---

## Out of scope

Must not be implemented now (per `docs/use_cases.md` "現時点で対象外" and the
standing constraints). Listed here so they are not pulled in accidentally with
adjacent work.

- Save View action and view-metadata persistence on export.
- Session history restore.
- Count-based session history ring buffer.
- Capacity-based decode cache LRU cleanup.
- DBC selection UI and `--dbc` CLI option.
- Real-time playback, playback speed, real-time cursor movement.
- PDF / CSV / JSON export.
- Advanced multi-log merge (e.g. source-time alignment, manual time offset).
- Cloud upload, user authentication, complex dashboard, heavy branding,
  large always-visible toolbars.

Note: the **session history ring buffer** (out of scope) is different from the
**UC-04 signal selection history** (a Next recommended task). Do not conflate
them.

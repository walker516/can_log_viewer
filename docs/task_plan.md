# Task Plan

## Phase 0: Development Preparation

Goal: establish project direction before implementation.

Tasks:

- Add `README.md`.
- Add `AGENTS.md`.
- Add `CLAUDE.md`.
- Add `docs/requirements.md`.
- Add `docs/architecture.md`.
- Add `docs/ui_policy.md`.
- Add `docs/task_plan.md`.
- Add `.gitignore`.
- Add `.editorconfig`.

Done criteria:

- Product requirements, architecture direction, UI policy, and AI coding instructions are documented.
- No application implementation code has been added.

## Phase 1: Backend Prototype

Goal: decode BLF / ASC / CSV plus DBC into normalized signal data.

Tasks:

- Create Python backend project.
- Add python-can.
- Add cantools.
- Add pandas / pyarrow / duckdb or equivalent data tooling.
- Implement DBC loading.
- Implement BLF reading.
- Implement ASC reading.
- Define CSV input format and implement CSV reading.
- Implement frame-to-signal decode.
- Preserve `session_time`, `source_time`, and `source_file`.
- Generate `decoded_signals` data.
- Generate `signal_index`.
- Write parquet / duckdb decode cache.
- Return structured warnings.
- Add focused tests with small synthetic data.

Done criteria:

- Given a DBC and small CAN logs, the backend produces decoded signal cache and a signal index.

## Phase 2: Frontend Prototype

Goal: display cached signals in a stacked timeline.

Tasks:

- Create Tauri + React + TypeScript app.
- Implement Open dialog skeleton.
- Implement signal search panel.
- Implement selected signal tags.
- Implement timeline lane component.
- Implement range query call to backend.
- Render line and step signals.
- Implement mouse-based zoom and pan.
- Avoid playback controls and unnecessary toolbar buttons.

Done criteria:

- User can open cached decoded data, select signals, and view timeline lanes.

## Phase 3: Integration

Goal: connect file open, decode, cache, and timeline view.

Tasks:

- Connect frontend Open flow to backend decode.
- Store decode cache in app local data directory.
- Query selected signals and visible range from cache.
- Add loading states.
- Add warning summary.
- Add automatic view state save.
- Add basic history restore.

Done criteria:

- User can open log and DBC files and view selected signals without manual backend commands.

## Phase 4: Export, History, and Cache Management

Goal: support PNG export and automatic session/cache lifecycle.

Tasks:

- Implement PNG export for the current timeline.
- Save view metadata with PNG export.
- Store session history.
- Add count-based history ring buffer.
- Add capacity-based decode cache LRU cleanup.
- Add cache metadata and cache hit validation.

Done criteria:

- User can export the current timeline as PNG.
- Recent views can be restored.
- Old history and decode cache entries are cleaned automatically.

## Phase 5: Packaging

Goal: Windows exe distribution.

Tasks:

- Package Python backend as an executable.
- Bundle backend executable with the Tauri app.
- Build Windows exe or installer.
- Verify the app works without manually installed Python.
- Document release packaging steps.

Done criteria:

- App can be distributed and launched on Windows without requiring users to install Python.

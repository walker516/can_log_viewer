# Task Plan

## Phase 0: Project Setup

- Add README.md
- Add AGENTS.md
- Add CLAUDE.md
- Add requirements document
- Add architecture document
- Add UI policy document
- Add .gitignore
- Add .editorconfig

## Phase 1: Backend Prototype

Goal: decode BLF / ASC + DBC into normalized signal data.

Tasks:

- Create Python backend project
- Add python-can
- Add cantools
- Add pandas / pyarrow / duckdb
- Implement DBC loading
- Implement BLF reading
- Implement ASC reading
- Implement frame-to-signal decode
- Implement decoded signal dataframe
- Implement signal index generation
- Write parquet cache
- Add unit tests with small synthetic data

Done criteria:

- Given a DBC and a small CAN log, decoded_signals.parquet and signal_index.json are generated.

## Phase 2: Frontend Prototype

Goal: display cached signals in a stacked timeline.

Tasks:

- Create Tauri + React + TypeScript app
- Implement Open dialog skeleton
- Implement signal search panel
- Implement selected signal tags
- Implement timeline lane component
- Implement range query call to backend
- Render line and step signals
- Implement zoom / pan

Done criteria:

- User can open cached decoded data, select signals, and view timeline lanes.

## Phase 3: Integration

Goal: connect file open, decode, cache, and timeline view.

Tasks:

- Connect frontend Open flow to backend decode
- Store cache in app local data directory
- Query selected signal and range from cache
- Add loading and warning summary
- Add automatic view state save
- Add basic history restore

Done criteria:

- User can open log + DBC and view selected signals without manual backend commands.

## Phase 4: Export and History

Goal: support PNG export and automatic session history.

Tasks:

- Implement PNG export
- Save view JSON with PNG
- Store session history
- Add history ring buffer
- Add cache LRU cleanup

Done criteria:

- User can export current timeline as PNG and later restore the same view.

## Phase 5: Packaging

Goal: Windows exe distribution.

Tasks:

- Package Python backend as exe
- Bundle backend with Tauri app
- Build Windows exe
- Verify app works without manually installed Python
- Add release notes

Done criteria:

- App can be distributed as a zip or installer and launched on Windows.
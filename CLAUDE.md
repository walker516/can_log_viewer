# CLAUDE.md

## Role

You are assisting with implementation of a local desktop CAN log visualization tool.

Optimize for maintainability, small steps, and clear boundaries between frontend and backend.

## Product Intent

This is an offline log analysis viewer.

It reads CAN log files and DBC files, decodes signals, and displays selected signals in a vertically stacked timeline.

The app is not a real-time player. Do not add playback controls unless explicitly requested.

## Required UX Direction

The UI must be modern but simple.

Important:
- Minimize buttons.
- Keep the primary visible actions limited to Open and Export.
- Do not add a large toolbar.
- Do not add playback UI.
- Do not add speed controls.
- Use search-first signal selection.
- Use tags for selected signals.
- Use mouse operations for zoom / pan / range selection.
- Use auto-save for view state.
- Put advanced controls in a context menu, drawer, or settings.

## Technical Direction

Preferred stack:

- Tauri
- React
- TypeScript
- Python backend
- python-can
- cantools
- parquet
- duckdb
- uPlot or Plotly.js

If a different stack is proposed, explain the tradeoff before changing.

## Development Rules

Before coding:
- Read docs/requirements.md
- Read docs/architecture.md
- Read docs/ui_policy.md
- Read docs/task_plan.md

When coding:
- Make small commits.
- Keep frontend and backend decoupled.
- Add minimal tests for parsing and data transformation.
- Avoid mock-heavy architecture unless needed.
- Do not add features outside the current task.

## Data Rules

Decoded signal data must include:

- session_time
- source_time
- source_file
- channel
- can_id
- message_name
- signal_name
- value
- raw_value
- unit
- enum_label when available

Multiple logs must be concatenated using session_time while preserving original source_time.

## Error Handling

Parsing failures should be reported as warnings with enough context:

- source file
- timestamp if available
- CAN ID if available
- reason

Do not silently discard large classes of errors without a summary.

## Packaging Goal

Final target is Windows exe distribution.

If Python backend is used, do not require users to install Python manually. Package the backend as an executable and bundle it with the desktop app.
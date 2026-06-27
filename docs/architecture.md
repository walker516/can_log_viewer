# Architecture

## Overview

The app is a local desktop application with a clear split between frontend and backend responsibilities.

Preferred stack:

- Desktop shell: Tauri
- Frontend: React + TypeScript
- Backend: Python
- CAN log reader: python-can
- DBC decoder: cantools
- Cache: parquet + duckdb
- Timeline rendering: uPlot or Plotly.js

The frontend owns interaction and rendering. The backend owns parsing, decoding, caching, querying, and downsampling.

## Component Responsibilities

### Frontend

Responsibilities:

- File selection UI
- Signal search UI (add-only; selected state shown by signal-list highlight)
- Timeline rendering, per-lane cursor values, lane reorder, and lane delete via
  the trash drop zone
- Range selection (plot-area drag) and cursor placement (plot click)
- PNG export rendering (the Tauri/Rust layer owns the output path and file name)
- In-memory view state (no persistence; view auto-save / history are not
  implemented)

The frontend must request only the selected signals and visible time range. It must not load entire large decoded datasets.

### Backend

Responsibilities:

- Read BLF / ASC / CSV logs.
- Load the fixed bundled DBC (`backend/resources/default.dbc`). DBC selection is
  intentionally not exposed: there is no DBC picker UI and no `--dbc` CLI option.
- Decode CAN frames into signal rows.
- Build signal index.
- Persist raw frame and decoded signal cache.
- Query selected signals by visible time range.
- Downsample results when point counts exceed frontend limits.
- Return structured warnings and decode statistics.

The frontend never builds output paths itself. For PNG export it passes only the
rendered bytes and the opened log's name to the Tauri layer, which owns the
output directory and file name (see App-managed paths).

## Data Model

### raw_frames

| Field | Description |
| --- | --- |
| `session_time` | Concatenated analysis time |
| `source_time` | Original log timestamp |
| `source_file` | Source log file path or name |
| `channel` | CAN channel |
| `can_id` | CAN arbitration ID |
| `is_extended_id` | Extended ID flag |
| `dlc` | Data length |
| `data_hex` | Raw payload |

### decoded_signals

| Field | Description |
| --- | --- |
| `session_time` | Concatenated analysis time |
| `source_time` | Original log timestamp |
| `source_file` | Source log file path or name |
| `channel` | CAN channel |
| `can_id` | CAN arbitration ID |
| `message_name` | DBC message name |
| `signal_name` | DBC signal name |
| `value` | Decoded physical value |
| `raw_value` | Raw signal value if available |
| `unit` | Signal unit |
| `enum_label` | Enum label if available |

### signal_index

| Field | Description |
| --- | --- |
| `signal_name` | Signal name |
| `message_name` | Message name |
| `can_id` | CAN ID |
| `unit` | Unit |
| `value_type` | `numeric`, `enum`, `bool`, or similar |
| `plot_type` | `line` or `step` |
| `sample_count` | Available sample count when known |
| `first_session_time` | First available analysis time |
| `last_session_time` | Last available analysis time |

## Log Concatenation

Initial merge mode is append.

Example:

- `log_A`: source time `0.0s` to `120.0s`
- `log_B`: source time `0.0s` to `90.0s`

Result:

- `log_A` session time: `0.0s` to `120.0s`
- `log_B` session time: `120.0s` to `210.0s`

The original `source_time` and `source_file` values must be preserved.

## App-managed paths

All app-managed output lives under a single writable root, `app_data_root()`,
decided in one place in the Tauri/Rust layer. Both the decode cache and PNG
exports derive from it, so moving the root (for distribution) moves them
together without relying on the (possibly read-only) executable directory.

- Current (development): `app_data_root()` is the repository root.
- Target (distribution): an OS app-data / writable working directory. Only the
  one `app_data_root()` function changes; cache and exports follow.

Current layout:

```text
<app_data_root()>/
  cache/
    logs/
      <cache_key>/
        meta.json
        decoded_signals.parquet
        signal_index.json
        warnings.json
  exports/
    png/
      <log_basename>_<YYYYMMDD_HHMMSS>_timeline.png
```

Lifetimes differ by purpose:

- **Decode cache** (`cache/`) is internal, regenerable data keyed by source log
  metadata; the user never selects its location. Capacity-based LRU cleanup is a
  later task (not yet implemented).
- **PNG exports** (`exports/png/`) are user-facing artifacts; they are written
  without a save dialog and kept (collision-suffixed, never overwritten), not
  garbage-collected.

## Cache Layout (target)

The fuller target layout below is aspirational for packaging; history and the
ring buffer / LRU are not implemented yet (see Out of scope in the task plan).
Use the OS-specific local app data directory.

Example on Windows:

```text
%LOCALAPPDATA%/<app>/
  history/
    sessions.json
    thumbnails/
  decode-cache/
    <cache_key>/
      meta.json
      raw_frames.parquet
      decoded_signals.parquet
      signal_index.json
      query.duckdb
  exports/
```

History and decode cache are intentionally separate.

History (planned, not implemented):

- Stores viewed sessions, selected signals, visible ranges, export history, and thumbnails.
- Uses a count-based ring buffer.

Decode cache:

- Stores decoded parquet / duckdb data.
- Capacity-based LRU deletion is planned (not implemented).

## Query Flow

1. Frontend sends selected signal identifiers and visible `session_time` range.
2. Backend queries parquet / duckdb cache.
3. Backend downsamples when the point count is too high.
4. Backend returns lane data plus warning and statistics metadata.
5. Frontend renders timeline lanes.

## Warning Flow

Parsing and decode issues should be returned as structured warnings:

- Source file
- Timestamp if available
- CAN ID if available
- Message or signal name if available
- Warning code
- Human-readable reason
- Count for repeated warnings

Warnings should be visible without blocking successful partial analysis.

## Packaging

Target is Windows exe distribution.

If the backend is Python, package it as an executable with PyInstaller or an equivalent tool. Users must not be required to manually install Python.

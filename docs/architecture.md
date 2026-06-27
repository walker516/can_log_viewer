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
- Signal search UI
- Selected signal tags
- Timeline rendering
- Zoom, pan, and range selection
- PNG export of the current view
- View state auto-save
- History display and restore

The frontend must request only the selected signals and visible time range. It must not load entire large decoded datasets.

### Backend

Responsibilities:

- Read BLF / ASC / CSV logs.
- Load DBC files.
- Decode CAN frames into signal rows.
- Build signal index.
- Persist raw frame and decoded signal cache.
- Query selected signals by visible time range.
- Downsample results when point counts exceed frontend limits.
- Return structured warnings and decode statistics.

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

## Cache Layout

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

History:

- Stores viewed sessions, selected signals, visible ranges, export history, and thumbnails.
- Uses a count-based ring buffer.

Decode cache:

- Stores decoded parquet / duckdb data.
- Uses capacity-based LRU deletion.

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

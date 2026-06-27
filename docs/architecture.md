# Architecture

## Overview

The app is a local desktop application with a frontend and backend.

Preferred stack:

- Desktop shell: Tauri
- Frontend: React + TypeScript
- Backend: Python
- CAN log reader: python-can
- DBC decoder: cantools
- Cache: parquet + duckdb
- Timeline: uPlot or Plotly.js

## Component Responsibilities

### Frontend

Responsibilities:

- File selection UI
- Signal search UI
- Selected signal list
- Timeline rendering
- Zoom / pan / range selection
- PNG export
- View state auto-save
- History display and restore

The frontend must not load entire decoded datasets for large logs.

### Backend

Responsibilities:

- Read .blf / .asc / .csv
- Load .dbc
- Decode CAN frames into signal rows
- Build signal index
- Write cache
- Query selected signals by visible time range
- Downsample if needed
- Return warnings and decode statistics

## Data Tables

### raw_frames

| Field | Description |
|---|---|
| session_time | concatenated analysis time |
| source_time | original log timestamp |
| source_file | source log file |
| channel | CAN channel |
| can_id | CAN arbitration ID |
| is_extended_id | extended ID flag |
| dlc | data length |
| data_hex | raw payload |

### decoded_signals

| Field | Description |
|---|---|
| session_time | concatenated analysis time |
| source_time | original log timestamp |
| source_file | source log file |
| channel | CAN channel |
| can_id | CAN arbitration ID |
| message_name | DBC message name |
| signal_name | DBC signal name |
| value | decoded physical value |
| raw_value | raw signal value if available |
| unit | signal unit |
| enum_label | enum label if available |

### signal_index

| Field | Description |
|---|---|
| signal_name | signal name |
| message_name | message name |
| can_id | CAN ID |
| unit | unit |
| value_type | numeric / enum / bool |
| plot_type | line / step |

## Log Concatenation

MVP merge mode is append.

Example:

- log_A: 0.0s - 120.0s
- log_B: 0.0s - 90.0s

Result:

- log_A session_time: 0.0s - 120.0s
- log_B session_time: 120.0s - 210.0s

The original source_time must be preserved.

## Cache Layout

Use OS-specific local app data directory.

Example on Windows:

```text
%LOCALAPPDATA%/<app>/
  cache/
    <log_hash>/
      meta.json
      raw_frames.parquet
      decoded_signals.parquet
      signal_index.json
  history/
    sessions.json
  exports/
````

## Query Flow

1. Frontend sends selected signals and visible range.
2. Backend queries parquet / duckdb.
3. Backend downsamples when needed.
4. Frontend renders timeline lanes.

## Packaging

Target is Windows exe distribution.

If the backend is Python, package it as an executable with PyInstaller or equivalent. Users must not be required to manually install Python.

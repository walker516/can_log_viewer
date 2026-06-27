from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Callable, ContextManager

import pyarrow as pa
import pyarrow.parquet as pq

from . import __version__
from .cache import write_json
from .dbc import Database, load_dbc, resolve_dbc_path, signal_definitions
from .readers import CanFrame, read_log
from .warnings import WarningCollector

# Collaborators are injected with module-level defaults so production code stays
# a one-liner while tests can pass fakes (no cantools / python-can required).
DatabaseLoader = Callable[[Path], Database]
DbcResolver = Callable[[Path | None], ContextManager[Path]]
LogReader = Callable[[Path, float, WarningCollector], "tuple[list[CanFrame], float]"]


@dataclass(frozen=True)
class DecodeRequest:
    log_paths: list[Path]
    out_dir: Path
    dbc_path: Path | None = None


def decode_logs(
    request: DecodeRequest,
    *,
    load_database: DatabaseLoader = load_dbc,
    resolve_dbc: DbcResolver = resolve_dbc_path,
    read_log_file: LogReader = read_log,
) -> dict[str, Any]:
    """Decode one or more logs into a cache directory and return its metadata."""

    warnings = WarningCollector()
    out_dir = request.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    with resolve_dbc(request.dbc_path) as dbc_path:
        try:
            database = load_database(dbc_path)
        except Exception as exc:
            # A DBC failure is fatal, but still record why before re-raising.
            warnings.add(code="dbc_load_error", source_file=str(dbc_path), reason=str(exc))
            write_json(out_dir / "warnings.json", warnings.to_dict())
            raise

        frames = _read_all_logs(request.log_paths, read_log_file, warnings)

        decoded_rows: list[dict[str, Any]] = []
        for frame in frames:
            decoded_rows.extend(_decode_frame(database, frame, warnings))

        _write_decoded_parquet(out_dir / "decoded_signals.parquet", decoded_rows)
        signal_index = _build_signal_index(database, decoded_rows)
        write_json(out_dir / "signal_index.json", signal_index)

        warning_payload = warnings.to_dict()
        write_json(out_dir / "warnings.json", warning_payload)

        meta = {
            "backend_version": __version__,
            "created_at": datetime.now(UTC).isoformat(),
            "dbc": str(dbc_path),
            "logs": [str(path) for path in request.log_paths],
            "frame_count": len(frames),
            "decoded_signal_count": len(decoded_rows),
            "signal_count": len(signal_index),
            "warning_count": warning_payload["summary"]["total"],
            "outputs": {
                "decoded_signals": "decoded_signals.parquet",
                "signal_index": "signal_index.json",
                "warnings": "warnings.json",
            },
        }
        write_json(out_dir / "meta.json", meta)
        return meta


def _read_all_logs(log_paths: list[Path], read_log_file: LogReader, warnings: WarningCollector) -> list[CanFrame]:
    """Concatenate logs onto one session_time timeline via the running offset."""

    frames: list[CanFrame] = []
    session_offset = 0.0
    for log_path in log_paths:
        log_frames, session_offset = read_log_file(log_path, session_offset, warnings)
        frames.extend(log_frames)
    return frames


def _decode_frame(database: Database, frame: CanFrame, warnings: WarningCollector) -> list[dict[str, Any]]:
    try:
        message = database.get_message_by_frame_id(frame.can_id)
    except KeyError:
        warnings.add(
            code="unknown_message",
            source_file=frame.source_file,
            source_time=frame.source_time,
            can_id=frame.can_id,
            reason="CAN ID not found in DBC",
        )
        return []

    try:
        physical_values = message.decode(frame.data, decode_choices=True, scaling=True)
        raw_values = message.decode(frame.data, decode_choices=False, scaling=False)
    except Exception as exc:
        warnings.add(
            code="decode_error",
            source_file=frame.source_file,
            source_time=frame.source_time,
            can_id=frame.can_id,
            message_name=message.name,
            reason=str(exc),
        )
        return []

    rows: list[dict[str, Any]] = []
    for signal in message.signals:
        if signal.name not in physical_values:
            continue
        value, enum_label = _split_value_and_label(physical_values[signal.name])
        raw_value = raw_values.get(signal.name)
        rows.append(
            {
                "session_time": frame.session_time,
                "source_time": frame.source_time,
                "source_file": frame.source_file,
                "channel": frame.channel,
                "can_id": frame.can_id,
                "message_name": message.name,
                "signal_name": signal.name,
                "value": value,
                "raw_value": _to_float_or_none(raw_value),
                "unit": signal.unit,
                "enum_label": enum_label,
            }
        )
    return rows


def _split_value_and_label(value: Any) -> tuple[float | None, str | None]:
    # cantools returns a NamedSignalValue (has .value/.name) for enum choices.
    if hasattr(value, "value") and hasattr(value, "name"):
        return _to_float_or_none(value.value), str(value.name)
    if isinstance(value, str):
        return None, value
    return _to_float_or_none(value), None


def _to_float_or_none(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _build_signal_index(database: Database, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[tuple[int, str], dict[str, Any]] = {}
    for row in rows:
        key = (int(row["can_id"]), str(row["signal_name"]))
        item = grouped.setdefault(
            key,
            {
                "signal_name": row["signal_name"],
                "message_name": row["message_name"],
                "can_id": row["can_id"],
                "unit": row["unit"],
                "value_type": "numeric",
                "plot_type": "line",
                "sample_count": 0,
                "first_session_time": row["session_time"],
                "last_session_time": row["session_time"],
            },
        )
        item["sample_count"] += 1
        item["first_session_time"] = min(item["first_session_time"], row["session_time"])
        item["last_session_time"] = max(item["last_session_time"], row["session_time"])
        # Decoded enum labels imply a step-plotted enum signal.
        if row.get("enum_label") is not None:
            item["value_type"] = "enum"
            item["plot_type"] = "step"

    # Promote signals to enum/bool from the DBC definition even if no label was
    # seen in the decoded rows.
    definitions = signal_definitions(database)
    for key, item in grouped.items():
        definition = definitions.get(key)
        if definition and definition.get("choices"):
            item["value_type"] = "enum"
            item["plot_type"] = "step"
        elif definition and definition.get("is_bool"):
            item["value_type"] = "bool"
            item["plot_type"] = "step"

    return sorted(grouped.values(), key=lambda item: (item["message_name"], item["signal_name"]))


def _write_decoded_parquet(path: Path, rows: list[dict[str, Any]]) -> None:
    schema = pa.schema(
        [
            ("session_time", pa.float64()),
            ("source_time", pa.float64()),
            ("source_file", pa.string()),
            ("channel", pa.string()),
            ("can_id", pa.int64()),
            ("message_name", pa.string()),
            ("signal_name", pa.string()),
            ("value", pa.float64()),
            ("raw_value", pa.float64()),
            ("unit", pa.string()),
            ("enum_label", pa.string()),
        ]
    )
    table = (
        pa.Table.from_pylist(rows, schema=schema)
        if rows
        else pa.Table.from_arrays([pa.array([], type=field.type) for field in schema], schema=schema)
    )
    pq.write_table(table, path)

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import can

from .warnings import WarningCollector


@dataclass(frozen=True)
class CanFrame:
    session_time: float
    source_time: float
    source_file: str
    channel: str | None
    can_id: int
    is_extended_id: bool
    dlc: int
    data: bytes


# A format reader turns a single log file into frames, given the running session
# offset used to concatenate multiple logs onto one session_time timeline.
FormatReader = Callable[[Path, float, WarningCollector], list[CanFrame]]


def read_log(path: Path, session_offset: float, warnings: WarningCollector) -> tuple[list[CanFrame], float]:
    """Read one log file and return its frames plus the next session offset.

    Dispatch is by extension through `_READERS`; unsupported types are reported
    as a warning rather than raising, so a batch of logs keeps going.
    """

    reader = _READERS.get(path.suffix.lower())
    if reader is None:
        warnings.add(code="unsupported_log_type", source_file=str(path), reason=f"Unsupported log extension: {path.suffix}")
        return [], session_offset

    frames = reader(path, session_offset, warnings)
    if not frames:
        return frames, session_offset

    duration = max(frame.session_time for frame in frames) - session_offset
    return frames, session_offset + max(duration, 0.0)


def _read_python_can(path: Path, session_offset: float, warnings: WarningCollector) -> list[CanFrame]:
    messages: list[can.Message] = []
    try:
        with can.LogReader(str(path)) as reader:
            messages = list(reader)
    except Exception as exc:
        warnings.add(code="log_read_error", source_file=str(path), reason=str(exc))
        return []

    if not messages:
        warnings.add(code="empty_log", source_file=str(path), reason="No CAN frames were read from the log")
        return []

    first_time = float(messages[0].timestamp or 0.0)
    frames: list[CanFrame] = []
    for msg in messages:
        try:
            source_time = float(msg.timestamp or 0.0)
            data = bytes(msg.data)
            frames.append(
                CanFrame(
                    session_time=session_offset + source_time - first_time,
                    source_time=source_time,
                    source_file=str(path),
                    channel=str(msg.channel) if msg.channel is not None else None,
                    can_id=int(msg.arbitration_id),
                    is_extended_id=bool(msg.is_extended_id),
                    dlc=int(msg.dlc),
                    data=data,
                )
            )
        except Exception as exc:
            warnings.add(code="malformed_frame", source_file=str(path), reason=str(exc))
    return frames


def _read_csv(path: Path, session_offset: float, warnings: WarningCollector) -> list[CanFrame]:
    frames: list[CanFrame] = []
    first_time: float | None = None
    row_seen = False
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as file:
            reader = csv.DictReader(file)
            required = {"timestamp", "can_id", "data"}
            missing = required - set(reader.fieldnames or [])
            if missing:
                warnings.add(code="csv_missing_columns", source_file=str(path), reason=f"Missing columns: {', '.join(sorted(missing))}")
                return []
            for row_number, row in enumerate(reader, start=2):
                row_seen = True
                try:
                    source_time = float(row["timestamp"])
                    if first_time is None:
                        first_time = source_time
                    data = bytes.fromhex(row["data"].replace(" ", ""))
                    can_id = int(row["can_id"], 0)
                    frames.append(
                        CanFrame(
                            session_time=session_offset + source_time - first_time,
                            source_time=source_time,
                            source_file=str(path),
                            channel=row.get("channel") or None,
                            can_id=can_id,
                            is_extended_id=_parse_bool(row.get("is_extended_id")),
                            dlc=int(row["dlc"]) if row.get("dlc") else len(data),
                            data=data,
                        )
                    )
                except Exception as exc:
                    warnings.add(code="malformed_csv_row", source_file=str(path), reason=f"row {row_number}: {exc}")
    except Exception as exc:
        warnings.add(code="log_read_error", source_file=str(path), reason=str(exc))
    if not row_seen:
        warnings.add(code="empty_log", source_file=str(path), reason="No CAN frames were read from the log")
    return frames


def _parse_bool(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "y", "extended"}


# Extension -> reader. python-can handles the binary/text bus formats.
_READERS: dict[str, FormatReader] = {
    ".csv": _read_csv,
    ".blf": _read_python_can,
    ".asc": _read_python_can,
}

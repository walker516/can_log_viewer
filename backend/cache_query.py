"""Read-side cache access: the inspect and query commands.

Cache layout/validation lives in `cache.py`; this module is the query logic on
top of it. `CacheError` is re-exported for callers that import it from here.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pyarrow.compute as pc
import pyarrow.parquet as pq

from .cache import CacheError, CachePaths, open_cache, read_json

__all__ = ["CacheError", "inspect_cache", "query_cache"]


def inspect_cache(cache_dir: Path) -> dict[str, Any]:
    paths = open_cache(cache_dir)
    meta = read_json(paths.meta)
    signal_index = read_json(paths.signal_index)
    warnings = read_json(paths.warnings)

    table = pq.read_table(paths.decoded_signals, columns=["session_time", "source_file"])
    time_range = _time_range(table.column("session_time").to_pylist()) if table.num_rows else [None, None]
    source_files = sorted({value for value in table.column("source_file").to_pylist() if value is not None})

    return {
        "cache": str(cache_dir),
        "meta": meta,
        "time_range": time_range,
        "source_files": source_files,
        "signal_count": len(signal_index),
        "signals": [_public_signal(item) for item in signal_index],
        "warnings": warnings.get("summary", {}).get("by_code", {}),
    }


def query_cache(
    cache_dir: Path,
    signal_names: list[str],
    start: float,
    end: float,
    max_points_per_signal: int | None = None,
) -> dict[str, Any]:
    paths = open_cache(cache_dir)
    if end < start:
        raise CacheError("--end must be greater than or equal to --start")
    if max_points_per_signal is not None and max_points_per_signal < 1:
        raise CacheError("--max-points-per-signal must be greater than 0")

    requested = _dedupe(signal_names)
    signal_index = read_json(paths.signal_index)
    available = {item["signal_name"] for item in signal_index}
    missing = [signal for signal in requested if signal not in available]

    result: dict[str, list[dict[str, Any]]] = {signal: [] for signal in requested}
    present = [signal for signal in requested if signal in available]
    if present:
        _fill_signal_points(paths, present, start, end, result)

    if max_points_per_signal is not None:
        result = {signal: _downsample_points(points, max_points_per_signal) for signal, points in result.items()}

    return {
        "cache": str(cache_dir),
        "time_range": [start, end],
        "signals": result,
        "missing_signals": missing,
    }


def _fill_signal_points(
    paths: CachePaths,
    present: list[str],
    start: float,
    end: float,
    result: dict[str, list[dict[str, Any]]],
) -> None:
    """Read the visible window for the present signals into `result` in place."""

    table = pq.read_table(
        paths.decoded_signals,
        columns=["session_time", "source_time", "source_file", "signal_name", "value", "enum_label"],
        filters=[
            ("signal_name", "in", present),
            ("session_time", ">=", start),
            ("session_time", "<=", end),
        ],
    )
    if not table.num_rows:
        return

    order = pc.sort_indices(table, sort_keys=[("signal_name", "ascending"), ("session_time", "ascending")])
    table = pc.take(table, order)
    for row in table.to_pylist():
        result[row["signal_name"]].append(
            {
                "session_time": row["session_time"],
                "source_time": row["source_time"],
                "source_file": row["source_file"],
                "value": row["value"],
                "enum_label": row["enum_label"],
            }
        )


def _public_signal(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "signal_name": item["signal_name"],
        "message_name": item["message_name"],
        "can_id": f"0x{int(item['can_id']):X}",
        "unit": item.get("unit") or "",
        "plot_type": item["plot_type"],
        "value_type": item["value_type"],
    }


def _time_range(values: list[float]) -> list[float]:
    return [min(values), max(values)]


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        normalized = value.strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            result.append(normalized)
    return result


# Even stride sampling that always keeps the first and last points.
def _downsample_points(points: list[dict[str, Any]], max_points: int) -> list[dict[str, Any]]:
    if len(points) <= max_points:
        return points
    if max_points == 1:
        return [points[0]]
    last_index = len(points) - 1
    selected: list[dict[str, Any]] = []
    for index in range(max_points):
        source_index = round(index * last_index / (max_points - 1))
        selected.append(points[source_index])
    return selected

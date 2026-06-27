"""Decode-cache layout and IO, shared by the inspect and query commands."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


class CacheError(Exception):
    pass


@dataclass(frozen=True)
class CachePaths:
    cache_dir: Path
    meta: Path
    decoded_signals: Path
    signal_index: Path
    warnings: Path


def cache_paths(cache_dir: Path) -> CachePaths:
    return CachePaths(
        cache_dir=cache_dir,
        meta=cache_dir / "meta.json",
        decoded_signals=cache_dir / "decoded_signals.parquet",
        signal_index=cache_dir / "signal_index.json",
        warnings=cache_dir / "warnings.json",
    )


def open_cache(cache_dir: Path) -> CachePaths:
    """Validate a cache directory and return its resolved file paths."""

    if not cache_dir.exists():
        raise CacheError(f"Cache path does not exist: {cache_dir}")
    if not cache_dir.is_dir():
        raise CacheError(f"Cache path is not a directory: {cache_dir}")

    paths = cache_paths(cache_dir)
    required = [paths.meta, paths.decoded_signals, paths.signal_index, paths.warnings]
    missing = [path.name for path in required if not path.exists()]
    if missing:
        raise CacheError(f"Cache is missing required file(s): {', '.join(missing)}")
    return paths


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise CacheError(f"Failed to read {path.name}: {exc}") from exc


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")

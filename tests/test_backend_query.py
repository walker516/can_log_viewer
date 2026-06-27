from __future__ import annotations

import json
from pathlib import Path

import pytest

from backend.cache_query import CacheError, inspect_cache, query_cache
from backend.cli import main


def _make_cache(tmp_path: Path) -> tuple[Path, Path]:
    log_path = tmp_path / "sample.csv"
    out_dir = tmp_path / "cache" / "sample"
    log_path.write_text(
        "\n".join(
            [
                "timestamp,can_id,data,channel,is_extended_id",
                "0.0,0x100,E803030000000000,can0,false",
                "0.5,0x100,D007010000000000,can0,false",
                "1.0,0x100,2C01040000000000,can0,false",
                "1.5,0x100,F401030000000000,can0,false",
                "2.0,0x999,0000000000000000,can0,false",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    assert main(["decode", "--log", str(log_path), "--out", str(out_dir)]) == 0
    return out_dir, log_path


def test_inspect_returns_expected_schema(tmp_path: Path) -> None:
    cache_dir, log_path = _make_cache(tmp_path)

    result = inspect_cache(cache_dir)

    assert set(result) == {"cache", "meta", "time_range", "source_files", "signal_count", "signals", "warnings"}
    assert result["cache"] == str(cache_dir)
    assert result["time_range"] == [0.0, 1.5]
    assert result["source_files"] == [str(log_path)]
    assert result["signal_count"] == 10
    assert result["warnings"] == {"unknown_message": 1}
    signals = {item["signal_name"]: item for item in result["signals"]}
    assert signals["Gear"]["plot_type"] == "step"
    assert signals["Speed"] == {
        "signal_name": "Speed",
        "message_name": "VehicleStatus",
        "can_id": "0x100",
        "unit": "km/h",
        "plot_type": "line",
        "value_type": "numeric",
    }


def test_inspect_cli_prints_json(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    cache_dir, _ = _make_cache(tmp_path)
    capsys.readouterr()

    assert main(["inspect", "--cache", str(cache_dir)]) == 0

    payload = json.loads(capsys.readouterr().out)
    assert payload["cache"] == str(cache_dir)
    assert payload["signal_count"] == 10


def test_query_filters_by_signal_and_time_range(tmp_path: Path) -> None:
    cache_dir, log_path = _make_cache(tmp_path)

    result = query_cache(cache_dir, ["Speed", "Gear"], 0.4, 1.1)

    assert result["time_range"] == [0.4, 1.1]
    assert result["missing_signals"] == []
    assert [point["session_time"] for point in result["signals"]["Speed"]] == [0.5, 1.0]
    assert [point["value"] for point in result["signals"]["Speed"]] == [200.0, 30.0]
    assert result["signals"]["Gear"][0] == {
        "session_time": 0.5,
        "source_time": 0.5,
        "source_file": str(log_path),
        "value": 1.0,
        "enum_label": "R",
    }


def test_query_cli_prints_json(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    cache_dir, _ = _make_cache(tmp_path)
    capsys.readouterr()

    assert main(["query", "--cache", str(cache_dir), "--signals", "Speed", "--start", "0", "--end", "1"]) == 0

    payload = json.loads(capsys.readouterr().out)
    assert list(payload["signals"]) == ["Speed"]
    assert len(payload["signals"]["Speed"]) == 3


def test_query_reports_missing_signal_without_failing(tmp_path: Path) -> None:
    cache_dir, _ = _make_cache(tmp_path)

    result = query_cache(cache_dir, ["Speed", "NoSuchSignal"], 0.0, 1.0)

    assert result["missing_signals"] == ["NoSuchSignal"]
    assert result["signals"]["NoSuchSignal"] == []
    assert len(result["signals"]["Speed"]) == 3


def test_query_empty_range_returns_empty_arrays(tmp_path: Path) -> None:
    cache_dir, _ = _make_cache(tmp_path)

    result = query_cache(cache_dir, ["Speed", "Gear"], 10.0, 20.0)

    assert result["missing_signals"] == []
    assert result["signals"] == {"Speed": [], "Gear": []}


def test_query_broken_cache_path_fails_clearly(tmp_path: Path) -> None:
    with pytest.raises(CacheError, match="Cache path does not exist"):
        query_cache(tmp_path / "missing-cache", ["Speed"], 0.0, 1.0)


def test_query_missing_cache_file_fails_clearly(tmp_path: Path) -> None:
    cache_dir = tmp_path / "cache" / "broken"
    cache_dir.mkdir(parents=True)
    (cache_dir / "meta.json").write_text("{}\n", encoding="utf-8")

    with pytest.raises(CacheError, match="Cache is missing required file"):
        inspect_cache(cache_dir)


def test_query_max_points_per_signal_downsamples(tmp_path: Path) -> None:
    cache_dir, _ = _make_cache(tmp_path)

    result = query_cache(cache_dir, ["Speed"], 0.0, 2.0, max_points_per_signal=2)

    points = result["signals"]["Speed"]
    assert len(points) == 2
    assert points[0]["session_time"] == 0.0
    assert points[-1]["session_time"] == 1.5

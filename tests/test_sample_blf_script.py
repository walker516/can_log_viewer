from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from backend.cache_query import query_cache


def test_generate_sample_blf_script_creates_decodable_cache(tmp_path: Path) -> None:
    blf_path = tmp_path / "sample.blf"
    cache_dir = tmp_path / "cache" / "sample"

    generated = subprocess.run(
        [sys.executable, "scripts/generate_sample_blf.py", "--out", str(blf_path), "--duration", "120", "--period", "0.2"],
        check=True,
        cwd=Path(__file__).resolve().parents[1],
        text=True,
        capture_output=True,
    )
    assert "wrote" in generated.stdout
    assert blf_path.exists()

    decoded = subprocess.run(
        [sys.executable, "-m", "backend", "decode", "--log", str(blf_path), "--out", str(cache_dir)],
        check=True,
        cwd=Path(__file__).resolve().parents[1],
        text=True,
        capture_output=True,
    )
    meta = json.loads(decoded.stdout)
    assert meta["frame_count"] > 10
    assert meta["decoded_signal_count"] > meta["frame_count"]
    assert meta["signal_count"] >= 40
    assert meta["warning_count"] == 0

    signal_index = json.loads((cache_dir / "signal_index.json").read_text(encoding="utf-8"))
    names = {item["signal_name"] for item in signal_index}
    representative = {
        "BumpDetected",
        "LiftDetected",
        "WorkMotorLock",
        "WheelMotorLock",
        "SlopeAngle",
        "RTKStatus",
        "ReferenceAreaId",
        "EKFPosCovX",
        "DRDistance",
        "PathPlanType",
        "OutsidePathGuardState",
        "PathPointIndex",
        "ParallelProgressStep",
        "RestoredPathPointValid",
        "UnknownObstacleIslandCount",
        "PathFollowerState",
        "TargetVelocity",
        "ActualAngularVelocity",
        "RemainDistance",
        "CrossTrackError",
        "Speed",
        "Gear",
    }
    assert representative.issubset(names)

    queried = query_cache(cache_dir, sorted(representative), 0, 120, max_points_per_signal=2000)
    assert queried["missing_signals"] == []
    for signal_name in representative:
        assert queried["signals"][signal_name], signal_name

    for step_signal in ["BumpDetected", "RTKStatus", "PathPlanType", "PathFollowerState", "Gear"]:
        values = {point["value"] for point in queried["signals"][step_signal]}
        assert len(values) > 1, step_signal

    for line_signal in ["SlopeAngle", "EKFPosCovX", "DRDistance", "RemainDistance", "CrossTrackError", "Speed"]:
        values = {point["value"] for point in queried["signals"][line_signal]}
        assert len(values) > 1, line_signal

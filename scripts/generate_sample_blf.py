#!/usr/bin/env python3
from __future__ import annotations

import argparse
import math
import sys
from importlib import resources
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import can
import cantools


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate a synthetic BLF log matching backend/resources/default.dbc.")
    parser.add_argument("--out", default="samples/sample.blf", help="Output BLF path.")
    parser.add_argument("--duration", type=float, default=120.0, help="Duration in seconds.")
    parser.add_argument("--period", type=float, default=0.1, help="Frame period in seconds.")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    database = load_default_database()
    messages = list(database.messages)
    if not messages:
        raise RuntimeError("default.dbc does not contain any messages")

    frame_count = max(1, int(args.duration / args.period) + 1)
    with can.BLFWriter(out_path) as writer:
        for index in range(frame_count):
            timestamp = round(index * args.period, 6)
            for message in messages:
                payload = message.encode(sample_values(message, timestamp))
                writer.on_message_received(
                    can.Message(
                        timestamp=timestamp,
                        arbitration_id=message.frame_id,
                        is_extended_id=False,
                        channel=1,
                        dlc=len(payload),
                        data=payload,
                    )
                )

    print(f"wrote {frame_count * len(messages)} frames to {out_path}")
    return 0


def load_default_database() -> cantools.database.Database:
    resource = resources.files("backend.resources").joinpath("default.dbc")
    with resources.as_file(resource) as path:
        return cantools.database.load_file(str(Path(path)))


def sample_values(message, timestamp: float) -> dict[str, float | int]:
    return {signal.name: value_for_signal(signal, timestamp) for signal in message.signals}


def value_for_signal(signal, t: float) -> float | int:
    name = signal.name
    value = SCENARIOS.get(name)
    if value is not None:
        return clamp_to_signal(signal, value(t))
    return default_value(signal, t)


def default_value(signal, t: float) -> float | int:
    if signal.choices:
        choices = sorted(int(value) for value in signal.choices)
        return choices[int(t // 15) % len(choices)]
    if signal.length == 1:
        return int(t // 10) % 2
    minimum = float(signal.minimum if signal.minimum is not None else 0.0)
    maximum = float(signal.maximum if signal.maximum is not None else min(250.0, (2**min(signal.length, 16)) - 1))
    center = minimum + (maximum - minimum) * 0.45
    amplitude = (maximum - minimum) * 0.18
    return min(maximum, max(minimum, center + amplitude * math.sin(t / 8.0)))


def clamp_to_signal(signal, value: float | int) -> float | int:
    minimum = signal.minimum
    maximum = signal.maximum
    if minimum is not None:
        value = max(float(minimum), float(value))
    if maximum is not None:
        value = min(float(maximum), float(value))
    if signal.scale == 1 and signal.offset == 0:
        return int(round(value))
    return round(float(value), 3)


def pulse(t: float, start: float, end: float) -> int:
    return int(start <= t < end)


def segment(t: float, ranges: list[tuple[float, float, int]], default: int = 0) -> int:
    for start, end, value in ranges:
        if start <= t < end:
            return value
    return default


def ramp(t: float, start: float, end: float, low: float, high: float) -> float:
    if t <= start:
        return low
    if t >= end:
        return high
    ratio = (t - start) / (end - start)
    return low + (high - low) * ratio


SCENARIOS = {
    "Speed": lambda t: max(0.0, 1.2 + 0.4 * math.sin(t / 6.0) - 0.8 * pulse(t, 25, 30) - 0.6 * pulse(t, 85, 95)),
    "Gear": lambda t: segment(t, [(0, 110, 3), (110, 120.1, 2)], 3),
    "WirelessSystemState": lambda t: segment(t, [(15, 25, 2), (25, 35, 3), (35, 55, 4), (95, 110, 5)], 1),
    "WorkState": lambda t: segment(t, [(15, 25, 2), (25, 35, 3), (35, 55, 4), (110, 120.1, 5)], 1),
    "BumpDetected": lambda t: pulse(t, 15, 25),
    "LiftDetected": lambda t: pulse(t, 25, 35),
    "WorkMotorLock": lambda t: pulse(t, 35, 45),
    "WheelMotorLock": lambda t: pulse(t, 45, 55),
    "SlopeDetected": lambda t: pulse(t, 60, 68),
    "RetryRunCommand": lambda t: pulse(t, 88, 90),
    "AvoidanceState": lambda t: segment(t, [(15, 18, 1), (18, 25, 2), (25, 35, 3), (35, 45, 4), (55, 70, 5), (70, 85, 6)], 0),
    "ObstacleType": lambda t: segment(t, [(15, 25, 1), (25, 35, 2), (35, 45, 3), (45, 55, 4), (55, 70, 5), (70, 85, 6)], 0),
    "AvoidanceRequest": lambda t: segment(t, [(15, 25, 1), (35, 45, 1), (70, 85, 1)], 0),
    "AvoidanceResult": lambda t: segment(t, [(15, 24, 1), (24, 25, 2), (35, 44, 1), (44, 45, 3), (70, 82, 1), (82, 85, 2)], 0),
    "BaseSystemEvent": lambda t: segment(t, [(15, 17, 1), (25, 30, 2), (35, 40, 3), (45, 50, 4), (60, 68, 5), (70, 85, 6)], 0),
    "ErrorCode": lambda t: segment(t, [(35, 45, 10), (45, 55, 20), (63, 68, 30)], 0),
    "UnknownObstacleState": lambda t: segment(t, [(70, 75, 1), (75, 78, 2), (78, 82, 3), (82, 85, 4)], 0),
    "UnknownObstacleIslandCount": lambda t: 0 if t < 70 else 1 if t < 82 else 2,
    "CreateUnknownObstacleIslandRequest": lambda t: pulse(t, 75, 78),
    "CreateUnknownObstacleIslandResult": lambda t: segment(t, [(78, 82, 1), (82, 85, 2)], 0),
    "UncalibratedAvoidanceActive": lambda t: pulse(t, 70, 76),
    "SlopeAngle": lambda t: 6 + ramp(t, 55, 63, 0, 24) - ramp(t, 63, 70, 0, 18),
    "LocalizationMode": lambda t: segment(t, [(40, 60, 3)], 2),
    "FusionMode": lambda t: segment(t, [(40, 60, 3)], 2),
    "RTKStatus": lambda t: segment(t, [(0, 40, 3), (40, 80, 2), (80, 120.1, 3)], 3),
    "GNSSFixType": lambda t: segment(t, [(0, 40, 4), (40, 80, 3), (80, 120.1, 4)], 4),
    "ReferenceAreaId": lambda t: 1 if t < 30 else 2,
    "ReferencePathId": lambda t: 10 if t < 30 else 11,
    "ReferenceUpdateCounter": lambda t: 1 + int(t >= 30) + int(t >= 80),
    "SetNewReferenceReason": lambda t: segment(t, [(30, 35, 2), (95, 100, 3)], 0),
    "IsInArea": lambda t: 0 if 60 <= t < 70 else 1,
    "PositionAccuracyState": lambda t: segment(t, [(70, 75, 1), (75, 80, 2)], 0),
    "CurrentAreaId": lambda t: segment(t, [(60, 70, 3)], 2 if t >= 30 else 1),
    "ReferenceValid": lambda t: 0 if 30 <= t < 33 else 1,
    "PositionX": lambda t: 0.8 * t + 0.8 * math.sin(t / 4),
    "PositionY": lambda t: 2.0 * math.sin(t / 12) + 0.2 * t,
    "Heading": lambda t: (t * 2.4 + 20 * pulse(t, 40, 50)) % 360,
    "YawRate": lambda t: 0.08 * math.sin(t / 3) + 0.65 * pulse(t, 40, 50),
    "GNSSVelCov": lambda t: 0.05 + 0.7 * pulse(t, 40, 80),
    "EKFPosCovX": lambda t: 0.2 + ramp(t, 40, 60, 0, 6) - ramp(t, 80, 100, 0, 5.5),
    "EKFPosCovY": lambda t: 0.3 + ramp(t, 40, 60, 0, 7) - ramp(t, 80, 100, 0, 6.5),
    "EKFHeadingCov": lambda t: 0.02 + ramp(t, 40, 60, 0, 0.6) - ramp(t, 80, 100, 0, 0.55),
    "DRDistance": lambda t: max(0, t - 40) * pulse(t, 40, 80),
    "NearestAreaId": lambda t: 2 if t >= 30 else 1,
    "PathPlanType": lambda t: segment(t, [(0, 35, 5), (35, 45, 4), (45, 95, 5), (95, 110, 3), (110, 120.1, 1)], 5),
    "PathPlanState": lambda t: segment(t, [(35, 45, 3), (110, 120.1, 4)], 2),
    "PathPlanResult": lambda t: segment(t, [(85, 95, 2), (95, 120.1, 1)], 1),
    "AreaId": lambda t: 2 if t >= 30 else 1,
    "DestinationAreaId": lambda t: 3 if 60 <= t < 70 else 2,
    "GoalAreaId": lambda t: 2,
    "CurrentInArea": lambda t: 0 if 25 <= t < 35 or 60 <= t < 70 else 1,
    "GoalInArea": lambda t: 0 if 60 <= t < 65 else 1,
    "PathId": lambda t: 11 if t >= 30 else 10,
    "PathPointIndex": lambda t: min(180, int(t * 1.4)),
    "IsFinalPoint": lambda t: int(t >= 110),
    "IsPathPlanDone": lambda t: int(t >= 114),
    "ReplanReason": lambda t: segment(t, [(35, 45, 1), (70, 85, 2), (45, 55, 3)], 0),
    "PathPointX": lambda t: 1.1 * t,
    "PathPointY": lambda t: 8 * math.sin(t / 10),
    "OutsidePathGuardState": lambda t: segment(t, [(25, 30, 1), (30, 35, 4), (35, 40, 2), (40, 45, 3)], 0),
    "OutsidePathGuardAction": lambda t: segment(t, [(25, 35, 1), (35, 45, 3)], 0),
    "ParallelProgressStep": lambda t: min(120, int(t / 2)),
    "WorkProgressStep": lambda t: min(115, int(t / 2.2)),
    "ParallelProgressStepDiffUnknownObstacle": lambda t: 4 if 70 <= t < 85 else 0,
    "RestoredPathPointValid": lambda t: pulse(t, 45, 55),
    "RestoreAreaId": lambda t: 2 if 45 <= t < 55 else 0,
    "PPSHintState": lambda t: segment(t, [(35, 45, 3), (45, 55, 1), (55, 70, 2)], 0),
    "PPSReachedFlag": lambda t: pulse(t, 55, 70),
    "PathFollowerState": lambda t: segment(t, [(40, 50, 2), (85, 95, 3), (95, 100, 4), (110, 120.1, 5)], 1),
    "StopReason": lambda t: segment(t, [(85, 95, 1), (110, 120.1, 3)], 0),
    "TurnDirection": lambda t: segment(t, [(40, 45, 1), (45, 50, 2)], 0),
    "CurrentPathId": lambda t: 11 if t >= 30 else 10,
    "TargetPathPointIndex": lambda t: min(180, int(t * 1.4 + 3)),
    "PathWidth": lambda t: 3.0 if t < 70 else 2.2,
    "PassageRandomOffset": lambda t: -0.25 if 70 <= t < 85 else 0.15,
    "RemainAngle": lambda t: 90 * pulse(t, 40, 50),
    "TargetVelocity": lambda t: 1.4 - 0.9 * pulse(t, 85, 95),
    "ActualVelocity": lambda t: 1.35 - 0.85 * pulse(t, 85, 95) + 0.08 * math.sin(t / 2),
    "TargetAngularVelocity": lambda t: 0.75 * pulse(t, 40, 50),
    "ActualAngularVelocity": lambda t: 0.68 * pulse(t, 40, 50) + 0.05 * math.sin(t),
    "RemainDistance": lambda t: max(0, 140 - t * 1.1),
    "HeadingError": lambda t: 0.15 * math.sin(t / 2) + 1.1 * pulse(t, 30, 40),
    "TargetPointX": lambda t: 1.15 * t + 2,
    "TargetPointY": lambda t: 8 * math.sin((t + 3) / 10),
    "CurrentPointX": lambda t: 1.1 * t,
    "CurrentPointY": lambda t: 8 * math.sin(t / 10) + 0.8 * pulse(t, 30, 40),
    "CrossTrackError": lambda t: 0.1 * math.sin(t / 3) + 1.4 * pulse(t, 30, 40),
}


if __name__ == "__main__":
    raise SystemExit(main())

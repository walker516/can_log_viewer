import assert from "node:assert/strict";
import { test } from "node:test";
import {
  enumLabelForValue,
  enumReferenceCandidates,
  nearestReferenceCandidate,
  pointStats,
  valueToY,
  yToValue
} from "../../src/lib/timeline.ts";
import { signalReferenceKey } from "../../src/hooks/useReferenceLines.ts";
import type { SignalIndexItem, TimelinePoint } from "../../src/types.ts";

const point = (value: number | null, enumLabel: string | null = null): TimelinePoint => ({
  session_time: 0,
  source_time: 0,
  source_file: "sample.blf",
  value,
  enum_label: enumLabel
});

test("pointStats ignores null and non-finite values", () => {
  assert.deepEqual(pointStats([point(null), point(10), point(Number.NaN), point(30)]), { min: 10, max: 30 });
});

test("valueToY maps larger values higher in the lane", () => {
  const low = valueToY(10, { min: 10, max: 30 });
  const high = valueToY(30, { min: 10, max: 30 });
  assert.ok(high < low);
});

test("yToValue maps dragged y positions back into the visible value range", () => {
  const stats = { min: 10, max: 30 };
  assert.equal(yToValue(valueToY(20, stats), stats), 20);
  assert.equal(yToValue(-100, stats), 30);
  assert.equal(yToValue(500, stats), 10);
});

test("enumReferenceCandidates uses values that have enum labels", () => {
  assert.deepEqual(enumReferenceCandidates([point(2, "R"), point(1, "D"), point(2, "R"), point(3)]), [1, 2]);
});

test("nearestReferenceCandidate snaps to the closest enum candidate", () => {
  assert.equal(nearestReferenceCandidate(2.37, [0, 1, 2, 3, 4]), 2);
  assert.equal(nearestReferenceCandidate(2.63, [0, 1, 2, 3, 4]), 3);
});

test("nearestReferenceCandidate leaves continuous values unchanged without candidates", () => {
  assert.equal(nearestReferenceCandidate(12.34, []), 12.34);
});

test("enumLabelForValue returns the label for snapped reference values", () => {
  assert.equal(enumLabelForValue([point(1, "D"), point(2, "R")], 2), "R");
  assert.equal(enumLabelForValue([point(1, "D"), point(2, "R")], 3), null);
});

test("signalReferenceKey uses message, signal, and CAN ID", () => {
  const signal: SignalIndexItem = {
    signal_name: "Speed",
    message_name: "VehicleStatus",
    can_id: "0x100",
    unit: "km/h",
    plot_type: "line",
    value_type: "numeric"
  };
  assert.equal(signalReferenceKey(signal), "VehicleStatus::Speed::0x100");
});

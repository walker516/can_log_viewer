import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildValueTransitions,
  enumLabelForValue,
  enumReferenceCandidates,
  isTransitionMarkerEligible,
  nearestReferenceCandidate,
  pointStats,
  valueToY,
  yToValue
} from "../../src/lib/timeline.ts";
import { signalReferenceKey } from "../../src/hooks/useReferenceLines.ts";
import { signalKey } from "../../src/lib/signalIdentity.ts";
import type { SignalIndexItem, TimelinePoint } from "../../src/types.ts";

const point = (value: number | null, enumLabel: string | null = null, sessionTime: number = 0): TimelinePoint => ({
  session_time: sessionTime,
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

test("buildValueTransitions detects enum-labeled old to new transitions", () => {
  const transitions = buildValueTransitions([point(0, "P", 0), point(1, "D", 1), point(2, "R", 2)]);
  assert.deepEqual(
    transitions.map((transition) => ({
      time: transition.session_time,
      oldValue: transition.oldValue,
      oldLabel: transition.oldLabel,
      newValue: transition.newValue,
      newLabel: transition.newLabel
    })),
    [
      { time: 1, oldValue: 0, oldLabel: "P", newValue: 1, newLabel: "D" },
      { time: 2, oldValue: 1, oldLabel: "D", newValue: 2, newLabel: "R" }
    ]
  );
});

test("buildValueTransitions does not mark the first valid point", () => {
  assert.deepEqual(buildValueTransitions([point(3, "D", 5)]), []);
});

test("buildValueTransitions ignores repeated values and labels", () => {
  assert.deepEqual(buildValueTransitions([point(1, "D", 0), point(1, "D", 1), point(1, "D", 2)]), []);
});

test("buildValueTransitions skips null and non-finite values", () => {
  const transitions = buildValueTransitions([
    point(null, null, 0),
    point(0, "OFF", 1),
    point(Number.NaN, "bad", 2),
    point(Number.POSITIVE_INFINITY, "bad", 3),
    point(1, "ON", 4)
  ]);
  assert.equal(transitions.length, 1);
  assert.equal(transitions[0].oldLabel, "OFF");
  assert.equal(transitions[0].newLabel, "ON");
});

test("isTransitionMarkerEligible excludes continuous numeric signals", () => {
  const numeric: SignalIndexItem = {
    signal_name: "Speed",
    message_name: "VehicleStatus",
    can_id: "0x100",
    unit: "km/h",
    plot_type: "line",
    value_type: "numeric"
  };
  const gear: SignalIndexItem = {
    signal_name: "Gear",
    message_name: "VehicleStatus",
    can_id: "0x100",
    unit: "",
    plot_type: "step",
    value_type: "enum"
  };
  assert.equal(isTransitionMarkerEligible(numeric, [point(1, "D")]), false);
  assert.equal(isTransitionMarkerEligible(gear, [point(1, "D")]), true);
});

test("transition marker state can use the signal identity key", () => {
  const signal: SignalIndexItem = {
    signal_name: "Gear",
    message_name: "VehicleStatus",
    can_id: "0x100",
    unit: "",
    plot_type: "step",
    value_type: "enum"
  };
  const markers: Record<string, boolean> = { [signalKey(signal)]: true };
  assert.equal(markers["VehicleStatus::Gear::0x100"], true);
});

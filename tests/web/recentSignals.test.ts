// Run with:
//   node --experimental-strip-types --test tests/web/recentSignals.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addRecentSignal,
  filterRecentSignalsForCurrentLog,
  loadRecentSignals,
  MAX_RECENT_SIGNALS,
  RECENT_SIGNALS_STORAGE_KEY,
  saveRecentSignals,
  type RecentSignal
} from "../../src/lib/recentSignals.ts";
import { sameSignal, signalKey } from "../../src/lib/signalIdentity.ts";
import type { SignalIndexItem } from "../../src/types.ts";

class MemoryStorage {
  values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const signal = (name: string, message = "Msg", canId = "0x100", unit = "km/h") => ({
  signal_name: name,
  message_name: message,
  can_id: canId,
  unit
});

const signalIndex = (name: string, message = "Msg", canId = "0x100", unit = "km/h"): SignalIndexItem => ({
  ...signal(name, message, canId, unit),
  plot_type: "line",
  value_type: "numeric"
});

test("addRecentSignal inserts a new entry at the front", () => {
  const result = addRecentSignal([], signal("Speed"), 1000);
  assert.equal(result.length, 1);
  assert.equal(result[0].signal_name, "Speed");
  assert.equal(result[0].selection_count, 1);
  assert.equal(result[0].last_selected_at, 1000);
});

test("addRecentSignal deduplicates by signal_name, message_name, and can_id", () => {
  let list: RecentSignal[] = addRecentSignal([], signal("Speed", "VehicleStatus", "0x100"), 1000);
  list = addRecentSignal(list, signal("Gear", "VehicleStatus", "0x100"), 2000);
  list = addRecentSignal(list, signal("Speed", "VehicleStatus", "0x100"), 3000);

  assert.deepEqual(
    list.map((item) => item.signal_name),
    ["Speed", "Gear"]
  );
  assert.equal(list[0].selection_count, 2);
  assert.equal(list[0].last_selected_at, 3000);

  list = addRecentSignal(list, signal("Speed", "OtherMessage", "0x200"), 4000);
  assert.equal(list.length, 3, "same signal_name in a different message/CAN ID is distinct");
});

test("addRecentSignal caps the list at MAX_RECENT_SIGNALS", () => {
  let list: RecentSignal[] = [];
  for (let index = 0; index < MAX_RECENT_SIGNALS + 2; index += 1) {
    list = addRecentSignal(list, signal(`S${index}`), index);
  }
  assert.equal(list.length, MAX_RECENT_SIGNALS);
  assert.equal(list[0].signal_name, `S${MAX_RECENT_SIGNALS + 1}`);
  assert.ok(!list.some((item) => item.signal_name === "S0"));
  assert.ok(!list.some((item) => item.signal_name === "S1"));
});

test("filterRecentSignalsForCurrentLog excludes signals not present in current log", () => {
  const recent = [
    addRecentSignal([], signal("Speed", "VehicleStatus", "0x100"), 1000)[0],
    addRecentSignal([], signal("Missing", "Other", "0x999"), 2000)[0]
  ];
  const result = filterRecentSignalsForCurrentLog(recent, [signalIndex("Speed", "VehicleStatus", "0x100")]);
  assert.deepEqual(
    result.map((item) => item.signal_name),
    ["Speed"]
  );
});

test("signal identity uses message_name, signal_name, and can_id", () => {
  const speed = signal("Speed", "VehicleStatus", "0x100");
  assert.equal(signalKey(speed), "VehicleStatus::Speed::0x100");
  assert.equal(sameSignal(speed, signal("Speed", "VehicleStatus", "0x100")), true);
  assert.equal(sameSignal(speed, signal("Speed", "OtherStatus", "0x100")), false);
  assert.equal(sameSignal(speed, signal("Speed", "VehicleStatus", "0x101")), false);
  assert.equal(sameSignal({ ...speed, can_id: 256 }, signal("Speed", "VehicleStatus", "256")), true);
});

test("loadRecentSignals returns an empty list for broken JSON", () => {
  const storage = new MemoryStorage();
  storage.setItem(RECENT_SIGNALS_STORAGE_KEY, "{not json");
  assert.deepEqual(loadRecentSignals(storage), []);
});

test("loadRecentSignals and saveRecentSignals use versioned localStorage key", () => {
  const storage = new MemoryStorage();
  const list = addRecentSignal([], signal("Speed"), 1000);
  saveRecentSignals(list, storage);

  assert.ok(storage.getItem(RECENT_SIGNALS_STORAGE_KEY));
  assert.deepEqual(loadRecentSignals(storage), list);
});

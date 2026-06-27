// Unit tests for the recent-signals pure logic. Run with Node's built-in test
// runner and TypeScript type-stripping (no extra dependencies):
//   node --experimental-strip-types --test tests/web/recentSignals.test.ts
// Kept outside src/ so the production `tsc` build does not type-check it.
import assert from "node:assert/strict";
import { test } from "node:test";
import { addRecent, MAX_RECENT_SIGNALS, type RecentSignal } from "../../src/lib/recentSignals.ts";

const sig = (name: string) => ({ signal_name: name, message_name: "Msg", can_id: "0x100", unit: "km/h" });

test("addRecent inserts a new entry at the front with count 1", () => {
  const result = addRecent([], sig("Speed"), 1000);
  assert.equal(result.length, 1);
  assert.equal(result[0].signal_name, "Speed");
  assert.equal(result[0].count, 1);
  assert.equal(result[0].last_selected, 1000);
});

test("addRecent dedups, increments count, refreshes time, and moves to front", () => {
  let list: RecentSignal[] = addRecent([], sig("Speed"), 1000);
  list = addRecent(list, sig("Gear"), 2000);
  list = addRecent(list, sig("Speed"), 3000);

  assert.deepEqual(
    list.map((item) => item.signal_name),
    ["Speed", "Gear"]
  );
  assert.equal(list.length, 2, "no duplicate entries");
  assert.equal(list[0].count, 2);
  assert.equal(list[0].last_selected, 3000);
});

test("addRecent caps the list at MAX_RECENT_SIGNALS, dropping the oldest", () => {
  let list: RecentSignal[] = [];
  for (let i = 0; i < MAX_RECENT_SIGNALS + 2; i += 1) {
    list = addRecent(list, sig(`S${i}`), i);
  }
  assert.equal(list.length, MAX_RECENT_SIGNALS);
  // Newest first; the two oldest (S0, S1) have been dropped.
  assert.equal(list[0].signal_name, `S${MAX_RECENT_SIGNALS + 1}`);
  assert.ok(!list.some((item) => item.signal_name === "S0"));
  assert.ok(!list.some((item) => item.signal_name === "S1"));
});

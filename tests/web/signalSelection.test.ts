// Run with:
//   node --experimental-strip-types --test tests/web/signalSelection.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { signalKey } from "../../src/lib/signalIdentity.ts";
import { toggleSelectedSignals, type SelectableSignal, type SelectedSignal } from "../../src/hooks/useSignalSelection.ts";

const signal = (name: string, message = "Msg", canId = "0x100", unit = ""): SelectableSignal => ({
  signal_name: name,
  message_name: message,
  can_id: canId,
  unit
});

const selected = (item: SelectableSignal): SelectedSignal => ({
  ...item,
  key: signalKey(item)
});

test("toggleSelectedSignals adds an unselected signal", () => {
  const speed = signal("Speed");
  const result = toggleSelectedSignals([], speed, 5);

  assert.equal(result.added, true);
  assert.equal(result.removed, false);
  assert.equal(result.limited, false);
  assert.deepEqual(result.next, [selected(speed)]);
});

test("toggleSelectedSignals removes a selected signal without touching history data", () => {
  const heading = signal("Heading", "LocalizationStatus", "0x201");
  const result = toggleSelectedSignals([selected(heading)], heading, 5);

  assert.equal(result.added, false);
  assert.equal(result.removed, true);
  assert.equal(result.limited, false);
  assert.deepEqual(result.next, []);
});

test("toggleSelectedSignals uses full signal identity", () => {
  const speedA = signal("Speed", "VehicleStatus", "0x100");
  const speedB = signal("Speed", "OtherStatus", "0x200");
  const result = toggleSelectedSignals([selected(speedA)], speedB, 5);

  assert.equal(result.added, true);
  assert.equal(result.next.length, 2);
});

test("toggleSelectedSignals applies the display limit only when adding", () => {
  const current = [0, 1, 2, 3, 4].map((index) => selected(signal(`S${index}`)));
  const limited = toggleSelectedSignals(current, signal("Extra"), 5);
  const removed = toggleSelectedSignals(current, signal("S0"), 5);

  assert.equal(limited.limited, true);
  assert.equal(limited.next.length, 5);
  assert.equal(removed.removed, true);
  assert.equal(removed.next.length, 4);
});

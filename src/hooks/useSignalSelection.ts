import { useCallback, useEffect, useMemo, useState } from "react";
import type { SignalIndexItem } from "../types";
import { MAX_DISPLAY_SIGNALS } from "../lib/constants.ts";
import { signalKey, type SignalIdentity } from "../lib/signalIdentity.ts";

export type SelectableSignal = Pick<SignalIndexItem, "signal_name" | "message_name" | "can_id" | "unit">;

export interface SelectedSignal extends SelectableSignal {
  key: string;
}

export interface SignalSelection {
  selectedSignals: SelectedSignal[];
  selectedSignalNames: string[];
  toggleSignal: (signal: SelectableSignal) => void;
  removeSignal: (signalKey: string) => void;
  reorderSignal: (signalKey: string, targetSignalKey: string) => void;
  isSelected: (signal: SignalIdentity) => boolean;
}

export interface ToggleSelectionResult {
  next: SelectedSignal[];
  added: boolean;
  removed: boolean;
  limited: boolean;
}

export function toggleSelectedSignals(
  current: SelectedSignal[],
  signal: SelectableSignal,
  maxSignals: number = MAX_DISPLAY_SIGNALS
): ToggleSelectionResult {
  const key = signalKey(signal);
  if (current.some((item) => item.key === key)) {
    return { next: current.filter((item) => item.key !== key), added: false, removed: true, limited: false };
  }
  if (current.length >= maxSignals) {
    return { next: current, added: false, removed: false, limited: true };
  }
  return { next: [...current, { ...signal, key }], added: true, removed: false, limited: false };
}

// Owns the set of selected signals and their display order. `resetKey` is the
// active cache path: when a different log is opened the selection clears.
// The sidebar toggles selection; removal/reordering are also driven from the
// timeline via lane header drag.
export function useSignalSelection(resetKey: string, onLimit: () => void): SignalSelection {
  const [selectedSignals, setSelectedSignals] = useState<SelectedSignal[]>([]);

  useEffect(() => {
    setSelectedSignals([]);
  }, [resetKey]);

  const removeSignal = useCallback((key: string) => {
    setSelectedSignals((current) => current.filter((signal) => signal.key !== key));
  }, []);

  const toggleSignal = useCallback(
    (signal: SelectableSignal) => {
      setSelectedSignals((current) => {
        const result = toggleSelectedSignals(current, signal);
        if (result.limited) {
          onLimit();
        }
        return result.next;
      });
    },
    [onLimit]
  );

  // Reordering driven by timeline lane-header drag.
  const reorderSignal = useCallback((key: string, targetKey: string) => {
    if (key === targetKey) {
      return;
    }
    setSelectedSignals((current) => {
      const from = current.findIndex((signal) => signal.key === key);
      const to = current.findIndex((signal) => signal.key === targetKey);
      if (from < 0 || to < 0) {
        return current;
      }
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  const selectedSignalNames = useMemo(() => selectedSignals.map((signal) => signal.signal_name), [selectedSignals]);

  const isSelected = useCallback(
    (signal: SignalIdentity) => {
      const key = signalKey(signal);
      return selectedSignals.some((item) => item.key === key);
    },
    [selectedSignals]
  );

  return { selectedSignals, selectedSignalNames, toggleSignal, removeSignal, reorderSignal, isSelected };
}

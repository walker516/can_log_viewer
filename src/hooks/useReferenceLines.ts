import { useCallback, useEffect, useMemo, useState } from "react";
import type { SignalIndexItem } from "../types";
import { signalKey, type SignalIdentity } from "../lib/signalIdentity.ts";

export interface ReferenceLine {
  value: number;
}

export type ReferenceLineMap = Record<string, ReferenceLine>;

export function signalReferenceKey(signal: SignalIdentity | undefined): string {
  if (!signal) {
    return "";
  }
  return signalKey(signal);
}

export interface ReferenceLines {
  references: ReferenceLineMap;
  setReference: (signal: SignalIndexItem, value: number) => void;
  clearReference: (signal: SignalIndexItem) => void;
}

// Owns temporary per-signal reference lines. The state is intentionally not
// persisted: references are an analysis aid for the current view, not Save View
// or session restore.
export function useReferenceLines(selectedSignals: SignalIdentity[]): ReferenceLines {
  const [references, setReferences] = useState<ReferenceLineMap>({});

  const activeKeys = useMemo(
    () => new Set(selectedSignals.map((signal) => signalReferenceKey(signal)).filter((key) => key.length > 0)),
    [selectedSignals]
  );

  useEffect(() => {
    setReferences((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([key]) => activeKeys.has(key)));
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [activeKeys]);

  const setReference = useCallback((signal: SignalIndexItem, value: number) => {
    const key = signalReferenceKey(signal);
    if (!key || !Number.isFinite(value)) {
      return;
    }
    setReferences((current) => ({ ...current, [key]: { value } }));
  }, []);

  const clearReference = useCallback((signal: SignalIndexItem) => {
    const key = signalReferenceKey(signal);
    setReferences((current) => {
      if (!key || !(key in current)) {
        return current;
      }
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  return { references, setReference, clearReference };
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { signalKey, type SignalIdentity } from "../lib/signalIdentity.ts";

export type TransitionMarkerMap = Record<string, boolean>;

export interface TransitionMarkers {
  markers: TransitionMarkerMap;
  toggleMarkers: (signalKey: string) => void;
}

// Owns temporary per-signal transition marker visibility. Like reference lines,
// marker state is an analysis aid for the current view and is not persisted.
export function useTransitionMarkers(selectedSignals: SignalIdentity[]): TransitionMarkers {
  const [markers, setMarkers] = useState<TransitionMarkerMap>({});

  const activeKeys = useMemo(
    () => new Set(selectedSignals.map((signal) => signalKey(signal)).filter((key) => key.length > 0)),
    [selectedSignals]
  );

  useEffect(() => {
    setMarkers((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([key]) => activeKeys.has(key)));
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [activeKeys]);

  const toggleMarkers = useCallback((key: string) => {
    if (!key) {
      return;
    }
    setMarkers((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  return { markers, toggleMarkers };
}

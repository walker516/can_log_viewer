import { useCallback, useEffect, useState } from "react";
import { MAX_DISPLAY_SIGNALS } from "../lib/constants";

export interface SignalSelection {
  selectedSignals: string[];
  draggedSignal: string | null;
  setDraggedSignal: (signalName: string | null) => void;
  toggleSignal: (signalName: string) => void;
  removeSignal: (signalName: string) => void;
  reorderSignal: (signalName: string, targetSignalName: string) => void;
}

// Owns the set of selected signals and their display order. `resetKey` is the
// active cache path: when a different log is opened the selection clears.
export function useSignalSelection(resetKey: string, onLimit: () => void): SignalSelection {
  const [selectedSignals, setSelectedSignals] = useState<string[]>([]);
  const [draggedSignal, setDraggedSignal] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSignals([]);
  }, [resetKey]);

  const toggleSignal = useCallback(
    (signalName: string) => {
      setSelectedSignals((current) => {
        if (current.includes(signalName)) {
          return current.filter((name) => name !== signalName);
        }
        if (current.length >= MAX_DISPLAY_SIGNALS) {
          onLimit();
          return current;
        }
        return [...current, signalName];
      });
    },
    [onLimit]
  );

  const removeSignal = useCallback((signalName: string) => {
    setSelectedSignals((current) => current.filter((name) => name !== signalName));
  }, []);

  // Drag-and-drop reordering shared by the sidebar tags and the timeline lanes.
  const reorderSignal = useCallback((signalName: string, targetSignalName: string) => {
    if (signalName === targetSignalName) {
      return;
    }
    setSelectedSignals((current) => {
      const from = current.indexOf(signalName);
      const to = current.indexOf(targetSignalName);
      if (from < 0 || to < 0) {
        return current;
      }
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  return { selectedSignals, draggedSignal, setDraggedSignal, toggleSignal, removeSignal, reorderSignal };
}

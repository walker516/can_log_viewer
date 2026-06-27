import { useCallback, useState } from "react";
import type { SignalIndexItem } from "../types";
import { addRecentSignal, loadRecentSignals, saveRecentSignals, type RecentSignal } from "../lib/recentSignals";

type SignalLike = Pick<SignalIndexItem, "signal_name" | "message_name" | "can_id" | "unit">;

export interface RecentSignals {
  recent: RecentSignal[];
  record: (signal: SignalLike) => void;
}

// Persists the recently selected signals in localStorage. Loaded once on mount;
// the store is global (not per log), and relevance to the current log is handled
// by the consumer filtering against the available signals.
export function useRecentSignals(): RecentSignals {
  const [recent, setRecent] = useState<RecentSignal[]>(() => loadRecentSignals());

  const record = useCallback((signal: SignalLike) => {
    setRecent((current) => {
      const next = addRecentSignal(current, signal);
      saveRecentSignals(next);
      return next;
    });
  }, []);

  return { recent, record };
}

import type { SignalIndexItem } from "../types";

// A signal-selection helper only: this is the list of recently selected signals
// used to re-select without searching. It is NOT session history, view restore,
// or a cache ring buffer — it stores no ranges, cursor, cache, or files.
export interface RecentSignal {
  signal_name: string;
  message_name: string;
  can_id: string;
  unit: string;
  last_selected: number; // epoch ms
  count: number;
}

export const MAX_RECENT_SIGNALS = 10;
const STORAGE_KEY = "can-log-viewer:recent-signals";

// Just the identity/metadata fields; a SignalIndexItem satisfies this.
type SignalLike = Pick<SignalIndexItem, "signal_name" | "message_name" | "can_id" | "unit">;

// Pure: record a selection. Existing entry is moved to the front with an
// incremented count and refreshed timestamp; the list is newest-first and
// capped at MAX_RECENT_SIGNALS (oldest drop off the end).
export function addRecent(list: RecentSignal[], signal: SignalLike, now: number = Date.now()): RecentSignal[] {
  const existing = list.find((item) => item.signal_name === signal.signal_name);
  const updated: RecentSignal = {
    signal_name: signal.signal_name,
    message_name: signal.message_name,
    can_id: signal.can_id,
    unit: signal.unit,
    last_selected: now,
    count: (existing?.count ?? 0) + 1
  };
  const rest = list.filter((item) => item.signal_name !== signal.signal_name);
  return [updated, ...rest].slice(0, MAX_RECENT_SIGNALS);
}

function isValidEntry(value: unknown): value is RecentSignal {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.signal_name === "string" &&
    typeof entry.message_name === "string" &&
    typeof entry.can_id === "string" &&
    typeof entry.unit === "string" &&
    typeof entry.last_selected === "number" &&
    typeof entry.count === "number"
  );
}

// Tolerant load: never throws. Missing, non-JSON, or malformed storage all
// yield an empty list so a corrupt value can never break the app.
export function loadRecent(): RecentSignal[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isValidEntry).slice(0, MAX_RECENT_SIGNALS);
  } catch {
    return [];
  }
}

export function saveRecent(list: RecentSignal[]): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Ignore quota / unavailable storage: the recent list is a non-critical aid.
  }
}

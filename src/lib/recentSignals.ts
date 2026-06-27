import type { SignalIndexItem } from "../types";

export interface RecentSignal {
  signal_name: string;
  message_name: string;
  can_id: string;
  unit: string;
  last_selected_at: number;
  selection_count: number;
}

export const MAX_RECENT_SIGNALS = 10;
export const RECENT_SIGNALS_STORAGE_KEY = "can_log_viewer.recent_signals.v1";

type SignalIdentity = Pick<SignalIndexItem, "signal_name" | "message_name" | "can_id">;
type SignalLike = Pick<SignalIndexItem, "signal_name" | "message_name" | "can_id" | "unit">;

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export function addRecentSignal(list: RecentSignal[], signal: SignalLike, now: number = Date.now()): RecentSignal[] {
  const existing = list.find((item) => sameSignal(item, signal));
  const updated: RecentSignal = {
    signal_name: signal.signal_name,
    message_name: signal.message_name,
    can_id: signal.can_id,
    unit: signal.unit,
    last_selected_at: now,
    selection_count: (existing?.selection_count ?? 0) + 1
  };
  const rest = list.filter((item) => !sameSignal(item, signal));
  return [updated, ...rest]
    .sort((left, right) => right.last_selected_at - left.last_selected_at)
    .slice(0, MAX_RECENT_SIGNALS);
}

export function filterRecentSignalsForCurrentLog(recent: RecentSignal[], signals: SignalIndexItem[]): RecentSignal[] {
  return recent.filter((item) => signals.some((signal) => sameSignal(item, signal))).slice(0, MAX_RECENT_SIGNALS);
}

export function loadRecentSignals(storage: StorageLike | null = browserStorage()): RecentSignal[] {
  if (!storage) {
    return [];
  }
  try {
    const raw = storage.getItem(RECENT_SIGNALS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isValidRecentSignal).sort((left, right) => right.last_selected_at - left.last_selected_at).slice(0, MAX_RECENT_SIGNALS);
  } catch {
    return [];
  }
}

export function saveRecentSignals(list: RecentSignal[], storage: StorageLike | null = browserStorage()): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(RECENT_SIGNALS_STORAGE_KEY, JSON.stringify(list.slice(0, MAX_RECENT_SIGNALS)));
  } catch {
    // Recent signals are a lightweight UI aid; unavailable/quota-limited storage
    // must not break log analysis.
  }
}

function sameSignal(left: SignalIdentity, right: SignalIdentity): boolean {
  return left.signal_name === right.signal_name && left.message_name === right.message_name && left.can_id === right.can_id;
}

function isValidRecentSignal(value: unknown): value is RecentSignal {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item.signal_name === "string" &&
    typeof item.message_name === "string" &&
    typeof item.can_id === "string" &&
    typeof item.unit === "string" &&
    typeof item.last_selected_at === "number" &&
    typeof item.selection_count === "number"
  );
}

function browserStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

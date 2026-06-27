import { useMemo, useState } from "react";
import type { SignalIndexItem } from "../types";
import type { SignalSelection } from "../hooks/useSignalSelection";
import type { RecentSignals } from "../hooks/useRecentSignals";
import { MAX_DISPLAY_SIGNALS } from "../lib/constants";
import { filterRecentSignalsForCurrentLog } from "../lib/recentSignals";
import "./SignalSidebar.css";

interface SignalSidebarProps {
  signals: SignalIndexItem[];
  selection: SignalSelection;
  recent: RecentSignals;
}

// Identity/metadata needed to add a signal (both list rows and recent entries
// satisfy this).
type AddableSignal = Pick<SignalIndexItem, "signal_name" | "message_name" | "can_id" | "unit">;

// Add-only, search-first signal pane: fixed width with an internal list scroll,
// a search box, a Recent helper, and the filtered result list. Removal and
// reordering of selected signals live on the timeline, not here.
export function SignalSidebar({ signals, selection, recent }: SignalSidebarProps) {
  const [open, setOpen] = useState(true);
  const [search, setSearch] = useState("");

  // Match the search term against signal name, message name, or CAN id.
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return signals;
    }
    return signals.filter((signal) =>
      [signal.signal_name, signal.message_name, signal.can_id].some((value) => value.toLowerCase().includes(term))
    );
  }, [signals, search]);

  // Only show recent entries that exist in the currently opened log.
  const recentForLog = useMemo(() => {
    return filterRecentSignalsForCurrentLog(recent.recent, signals);
  }, [signals, recent.recent]);

  if (!open) {
    return (
      <button className="sidebar-tab" type="button" onClick={() => setOpen(true)} aria-label="Open signals">
        <span>›</span>
        <span>Signals {selection.selectedSignals.length ? `(${selection.selectedSignals.length})` : ""}</span>
      </button>
    );
  }

  const { selectedSignals, selectSignal } = selection;

  // The sidebar only adds signals; removal and reordering live on the timeline
  // (lane header drag → trash drop zone). Clicking a signal selects it (no-op if
  // already selected; the 5-signal cap is enforced in selectSignal), and a real
  // addition is recorded in Recent.
  const addSignal = (item: AddableSignal) => {
    const willAdd = !selectedSignals.includes(item.signal_name) && selectedSignals.length < MAX_DISPLAY_SIGNALS;
    selectSignal(item.signal_name);
    if (willAdd) {
      recent.record(item);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span>Signals</span>
        <button className="pane-toggle" type="button" onClick={() => setOpen(false)} aria-label="Collapse signals">
          ‹
        </button>
      </div>

      <div className="search-block">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search signals"
          aria-label="Search signals"
        />
      </div>

      {recentForLog.length > 0 ? (
        <div className="recent-block">
          <div className="recent-head">Recent</div>
          <div className="recent-list" aria-label="Recently selected signals">
            {recentForLog.map((item) => {
              const selected = selectedSignals.includes(item.signal_name);
              return (
                <button
                  key={`${item.can_id}:${item.message_name}:${item.signal_name}`}
                  className={`recent-item ${selected ? "selected" : ""}`}
                  type="button"
                  onClick={() => addSignal(item)}
                  title={item.signal_name}
                >
                  <span className="recent-name">{item.signal_name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="signal-list">
        {filtered.map((signal) => {
          const selected = selectedSignals.includes(signal.signal_name);
          return (
            <button
              key={`${signal.can_id}:${signal.signal_name}`}
              className={`signal-row ${selected ? "selected" : ""}`}
              type="button"
              onClick={() => addSignal(signal)}
            >
              <span className="signal-name">{signal.signal_name}</span>
              <span className="signal-meta">
                {signal.message_name} / {signal.can_id}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

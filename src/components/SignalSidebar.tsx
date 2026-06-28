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

// Search-first signal pane: fixed width with an internal list scroll, a Recent
// helper, and the filtered result list. Signal clicks toggle selection; lane
// reordering and drag-to-trash removal also live on the timeline.
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

  // Signal list and Recent use the same selection logic. A real addition is
  // recorded in Recent; a toggle-off only clears selected state and leaves the
  // lightweight history entry intact.
  const toggleSignal = (item: AddableSignal) => {
    const willAdd = !selection.isSelected(item) && selection.selectedSignals.length < MAX_DISPLAY_SIGNALS;
    selection.toggleSignal(item);
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
              const selected = selection.isSelected(item);
              return (
                <button
                  key={`${item.can_id}:${item.message_name}:${item.signal_name}`}
                  className={`recent-item ${selected ? "selected" : ""}`}
                  type="button"
                  onClick={() => toggleSignal(item)}
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
          const selected = selection.isSelected(signal);
          return (
            <button
              key={`${signal.can_id}:${signal.message_name}:${signal.signal_name}`}
              className={`signal-row ${selected ? "selected" : ""}`}
              type="button"
              onClick={() => toggleSignal(signal)}
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

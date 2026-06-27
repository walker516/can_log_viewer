import { useMemo, useState } from "react";
import type { SignalIndexItem } from "../types";
import type { SignalSelection } from "../hooks/useSignalSelection";
import "./SignalSidebar.css";

interface SignalSidebarProps {
  signals: SignalIndexItem[];
  selection: SignalSelection;
}

// Search-first signal selection: fixed-width pane with an internal scroll,
// a search box, selected-signal tags, and the filtered result list.
export function SignalSidebar({ signals, selection }: SignalSidebarProps) {
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

  if (!open) {
    return (
      <button className="sidebar-tab" type="button" onClick={() => setOpen(true)} aria-label="Open signals">
        <span>›</span>
        <span>Signals {selection.selectedSignals.length ? `(${selection.selectedSignals.length})` : ""}</span>
      </button>
    );
  }

  const { selectedSignals, draggedSignal, setDraggedSignal, toggleSignal, removeSignal, reorderSignal } = selection;

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

      <div className="selected-tags" aria-label="Selected signals">
        {selectedSignals.map((name) => (
          <button
            key={name}
            className="signal-tag"
            type="button"
            draggable
            onClick={() => removeSignal(name)}
            onDragStart={() => setDraggedSignal(name)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedSignal) {
                reorderSignal(draggedSignal, name);
              }
              setDraggedSignal(null);
            }}
            onDragEnd={() => setDraggedSignal(null)}
            title="Remove signal"
          >
            <span>{name}</span>
            <span aria-hidden="true">x</span>
          </button>
        ))}
      </div>

      <div className="signal-list">
        {filtered.map((signal) => {
          const selected = selectedSignals.includes(signal.signal_name);
          return (
            <button
              key={`${signal.can_id}:${signal.signal_name}`}
              className={`signal-row ${selected ? "selected" : ""}`}
              type="button"
              onClick={() => toggleSignal(signal.signal_name)}
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

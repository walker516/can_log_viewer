import { useCallback, useEffect, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import type { QueryResponse, SignalIndexItem } from "../types";
import type { TimelineView } from "../hooks/useTimelineView";
import type { SignalSelection } from "../hooks/useSignalSelection";
import { LANE_GAP, MAX_DISPLAY_SIGNALS, TIMELINE_VERTICAL_PADDING, TIME_AXIS_HEIGHT } from "../lib/constants";
import { formatTime } from "../lib/timeline";
import { TimelineLane } from "./TimelineLane";
import "./Timeline.css";

interface TimelineProps {
  timelineRef: RefObject<HTMLDivElement | null>;
  view: TimelineView;
  selection: SignalSelection;
  signalByName: Map<string, SignalIndexItem>;
  query: QueryResponse | null;
}

// Timeline panel: a thin bar above the plotting area that shows the missing-
// signal note and, while a lane header is being dragged, a trash drop zone for
// removing a signal. Lanes share the remaining height evenly.
export function Timeline({ timelineRef, view, selection, signalByName, query }: TimelineProps) {
  const bodyHeight = useBodyHeight(timelineRef);
  const { selectedSignals, reorderSignal, removeSignal } = selection;

  // Pointer-based lane drag (HTML5 drag-and-drop does not work in the WebKit
  // WebView). `drag` is the signal being dragged; the drop target is resolved
  // from the element under the pointer during the move.
  const [drag, setDrag] = useState<string | null>(null);
  const [overTrash, setOverTrash] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const laneCount = Math.min(selectedSignals.length, MAX_DISPLAY_SIGNALS);
  const laneHeight = computeLaneHeight(bodyHeight, laneCount);
  const isDraggingLane = drag !== null;

  // Self-contained pointer drag: window listeners are wired on header pointerdown
  // and torn down on up/cancel. A small movement threshold means a plain header
  // click never starts a drag (no trash-zone flicker, no accidental reorder).
  const handleHeaderPointerDown = useCallback(
    (signalName: string, event: ReactPointerEvent) => {
      // Keep the gesture off the plot area so it never starts a range selection
      // or moves the cursor; preventDefault avoids text selection while dragging.
      event.stopPropagation();
      event.preventDefault();

      const startX = event.clientX;
      const startY = event.clientY;
      let active = false;
      let trashHit = false;
      let targetHit: string | null = null;

      const onMove = (move: PointerEvent) => {
        if (!active) {
          if (Math.hypot(move.clientX - startX, move.clientY - startY) < 5) {
            return;
          }
          active = true;
          setDrag(signalName);
        }
        const element = document.elementFromPoint(move.clientX, move.clientY);
        trashHit = Boolean(element?.closest(".trash-zone"));
        const laneElement = element?.closest("[data-lane-signal]") as HTMLElement | null;
        const target = trashHit ? null : laneElement?.dataset.laneSignal ?? null;
        targetHit = target && target !== signalName ? target : null;
        setOverTrash(trashHit);
        setDropTarget(targetHit);
      };
      const cleanup = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        setDrag(null);
        setOverTrash(false);
        setDropTarget(null);
      };
      const onUp = () => {
        if (active) {
          if (trashHit) {
            removeSignal(signalName);
          } else if (targetHit) {
            reorderSignal(signalName, targetHit);
          }
        }
        cleanup();
      };
      const onCancel = () => cleanup();

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    },
    [removeSignal, reorderSignal]
  );

  const hasMissing = Boolean(query?.missing_signals.length);

  return (
    <section className="timeline-panel">
      {/* No standalone header row: the timeline body fills the panel so its top
          aligns with the Signals pane. The trash zone and missing-signal note
          float over the plot (and are stripped from the PNG via export-exclude),
          so they take no permanent vertical space. */}
      <div
        className="timeline-body"
        ref={timelineRef}
        onPointerDown={view.onPointerDown}
        onPointerMove={view.onPointerMove}
        onPointerUp={view.onPointerUp}
        onPointerCancel={view.onPointerCancel}
        onDoubleClick={view.fitAll}
      >
        <TimeAxis ticks={view.ticks} start={view.start} end={view.end} hasRange={view.hasRange} />
        {view.hasRange ? <div className="time-cursor" style={{ left: view.cursorLeft }} /> : null}
        {view.dragSelection ? <SelectionOverlay startX={view.dragSelection.startX} endX={view.dragSelection.endX} /> : null}
        {isDraggingLane || hasMissing ? (
          <div className="timeline-overlay export-exclude">
            {isDraggingLane ? (
              <div className={`trash-zone ${overTrash ? "over" : ""}`}>
                <TrashIcon />
                <span>Drop here to remove</span>
              </div>
            ) : (
              <span className="inline-warning">Missing: {query?.missing_signals.join(", ")}</span>
            )}
          </div>
        ) : null}
        <div className="timeline-lanes" style={{ gap: LANE_GAP }}>
          {selectedSignals.length === 0 ? (
            <div className="empty-state">Select up to {MAX_DISPLAY_SIGNALS} signals.</div>
          ) : (
            selectedSignals.map((signalName) => (
              <TimelineLane
                key={signalName}
                signal={signalByName.get(signalName)}
                points={query?.signals[signalName] ?? []}
                start={view.start}
                end={view.end}
                cursorTime={view.cursorTime}
                ticks={view.ticks}
                laneHeight={laneHeight}
                isDragged={drag === signalName}
                isDropTarget={dropTarget === signalName}
                onHeaderPointerDown={handleHeaderPointerDown}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function TimeAxis({ ticks, start, end, hasRange }: { ticks: number[]; start: number; end: number; hasRange: boolean }) {
  if (!hasRange) {
    return <div className="time-axis" />;
  }
  return (
    <div className="time-axis">
      {ticks.map((tick) => (
        <div key={tick} className="time-tick" style={{ left: `${((tick - start) / (end - start)) * 100}%` }}>
          <span>{formatTime(tick)}s</span>
        </div>
      ))}
    </div>
  );
}

function SelectionOverlay({ startX, endX }: { startX: number; endX: number }) {
  const left = Math.min(startX, endX);
  const width = Math.abs(endX - startX);
  return <div className="selection-overlay" style={{ left, width }} />;
}

function TrashIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 4h11M6 4V2.5h4V4M5 4l.5 9h5l.5-9M6.5 6.5v4M9.5 6.5v4" />
    </svg>
  );
}

// Track the timeline body height so lanes can divide it evenly as it resizes.
function useBodyHeight(ref: RefObject<HTMLDivElement | null>): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const update = () => setHeight(element.clientHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return height;
}

function computeLaneHeight(bodyHeight: number, laneCount: number): number {
  if (laneCount <= 0) {
    return 0;
  }
  const available =
    bodyHeight - TIME_AXIS_HEIGHT - TIMELINE_VERTICAL_PADDING - Math.max(0, laneCount - 1) * LANE_GAP;
  return Math.max(0, available / laneCount);
}

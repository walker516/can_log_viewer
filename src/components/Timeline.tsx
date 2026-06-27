import { useEffect, useState } from "react";
import type { RefObject } from "react";
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
  hasInspect: boolean;
}

// Timeline panel: a thin range bar (Fit All + missing-signal note) over the
// plotting area. Lanes share the remaining height evenly.
export function Timeline({ timelineRef, view, selection, signalByName, query, hasInspect }: TimelineProps) {
  const bodyHeight = useBodyHeight(timelineRef);
  const { selectedSignals, draggedSignal, setDraggedSignal, reorderSignal } = selection;

  const laneCount = Math.min(selectedSignals.length, MAX_DISPLAY_SIGNALS);
  const laneHeight = computeLaneHeight(bodyHeight, laneCount);

  const handleDrop = (target: string) => {
    if (draggedSignal) {
      reorderSignal(draggedSignal, target);
    }
    setDraggedSignal(null);
  };

  return (
    <section className="timeline-panel">
      <div className="range-bar">
        <div className="range-actions">
          <button className="text-action" type="button" onClick={view.fitAll} disabled={!hasInspect}>
            Fit All
          </button>
          {query?.missing_signals.length ? (
            <span className="inline-warning">Missing: {query.missing_signals.join(", ")}</span>
          ) : null}
        </div>
      </div>

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
                ticks={view.ticks}
                laneHeight={laneHeight}
                isDragged={draggedSignal === signalName}
                onDragStart={setDraggedSignal}
                onDropSignal={handleDrop}
                onDragEnd={() => setDraggedSignal(null)}
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

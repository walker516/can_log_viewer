import { useCallback, useEffect, useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { buildTimeTicks, clamp } from "../lib/timeline";

// Minimum horizontal drag (px) that counts as a range selection rather than a
// click that just moves the cursor bar.
const RANGE_SELECT_THRESHOLD = 6;

export interface DragSelection {
  startX: number;
  endX: number;
}

export interface TimelineView {
  start: number;
  end: number;
  cursorTime: number;
  dragSelection: DragSelection | null;
  ticks: number[];
  hasRange: boolean;
  cursorLeft: string;
  fitAll: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: () => void;
}

// Owns the visible time window (start/end), the cursor bar, and mouse range
// selection. The full data range comes from the opened log; whenever it changes
// the view resets to show everything (Fit All on load).
export function useTimelineView(
  fullRange: [number | null, number | null],
  timelineRef: RefObject<HTMLDivElement | null>
): TimelineView {
  const [fullStart, fullEnd] = fullRange;
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [cursorTime, setCursorTime] = useState(0);
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(null);

  useEffect(() => {
    setStart(fullStart ?? 0);
    setEnd(fullEnd ?? 0);
    setCursorTime(typeof fullStart === "number" ? fullStart : 0);
    // Depend on the numeric bounds, not the array, which is recreated each render.
  }, [fullStart, fullEnd]);

  const hasRange = Number.isFinite(start) && Number.isFinite(end) && end > start;

  const ticks = useMemo(() => (hasRange ? buildTimeTicks(start, end) : []), [hasRange, start, end]);

  const cursorLeft = hasRange ? `${((clamp(cursorTime, start, end) - start) / (end - start)) * 100}%` : "0%";

  const pointerX = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): number | null => {
      const rect = timelineRef.current?.getBoundingClientRect();
      if (!rect) {
        return null;
      }
      return clamp(event.clientX - rect.left, 0, rect.width);
    },
    [timelineRef]
  );

  const xToTime = useCallback(
    (x: number): number => {
      const width = timelineRef.current?.getBoundingClientRect().width ?? 1;
      return start + (x / width) * (end - start);
    },
    [timelineRef, start, end]
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!hasRange) {
        return;
      }
      const x = pointerX(event);
      if (x === null) {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragSelection({ startX: x, endX: x });
    },
    [hasRange, pointerX]
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      setDragSelection((current) => {
        if (!current) {
          return current;
        }
        const x = pointerX(event);
        return x === null ? current : { ...current, endX: x };
      });
    },
    [pointerX]
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragSelection || !hasRange) {
        setDragSelection(null);
        return;
      }
      const x = pointerX(event) ?? dragSelection.endX;
      const minX = Math.min(dragSelection.startX, x);
      const maxX = Math.max(dragSelection.startX, x);
      setDragSelection(null);
      // A short drag is treated as a click: move the cursor instead of zooming.
      if (maxX - minX < RANGE_SELECT_THRESHOLD) {
        setCursorTime(clamp(xToTime(x), start, end));
        return;
      }
      const nextStart = xToTime(minX);
      const nextEnd = xToTime(maxX);
      setStart(nextStart);
      setEnd(nextEnd);
      setCursorTime((current) => (current < nextStart || current > nextEnd ? nextStart : current));
    },
    [dragSelection, hasRange, pointerX, xToTime, start, end]
  );

  const onPointerCancel = useCallback(() => setDragSelection(null), []);

  const fitAll = useCallback(() => {
    if (typeof fullStart === "number" && typeof fullEnd === "number" && fullEnd > fullStart) {
      setStart(fullStart);
      setEnd(fullEnd);
      setCursorTime((current) => (current < fullStart || current > fullEnd ? fullStart : current));
    }
  }, [fullStart, fullEnd]);

  return {
    start,
    end,
    cursorTime,
    dragSelection,
    ticks,
    hasRange,
    cursorLeft,
    fitAll,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel
  };
}

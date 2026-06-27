import { useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { SignalIndexItem, TimelinePoint } from "../types";
import {
  buildPath,
  buildPointMarks,
  formatCursorValue,
  formatTime,
  formatValue,
  nearestPoint,
  pointAtOrBefore,
  pointStats,
  PLOT_WIDTH
} from "../lib/timeline";
import "./TimelineLane.css";

interface TimelineLaneProps {
  signal: SignalIndexItem | undefined;
  points: TimelinePoint[];
  start: number;
  end: number;
  cursorTime: number;
  ticks: number[];
  laneHeight: number;
  isDragged: boolean;
  isDropTarget: boolean;
  onHeaderPointerDown: (signalName: string, event: ReactPointerEvent) => void;
}

// One stacked signal lane: header plus a point plot. Lanes are draggable to
// reorder. The SVG uses a fixed viewBox stretched to the lane size.
export function TimelineLane({
  signal,
  points,
  start,
  end,
  cursorTime,
  ticks,
  laneHeight,
  isDragged,
  isDropTarget,
  onHeaderPointerDown
}: TimelineLaneProps) {
  const [hover, setHover] = useState<{ point: TimelinePoint; x: number; y: number } | null>(null);
  const label = signal?.signal_name ?? "Unknown";
  const stats = pointStats(points);
  const path = buildPath(points, start, end, signal?.plot_type ?? "line", stats);
  const pointMarks = buildPointMarks(points, start, end, stats);
  // Held value at the cursor time, shown in the lane's top-right. Derived from
  // cursorTime (not hover) so hovering never replaces it.
  const cursorValue = formatCursorValue(pointAtOrBefore(points, cursorTime), signal?.unit ?? "");

  return (
    <div
      // data-lane-signal lets the pointer-drag hit-test find this lane as a drop
      // target via document.elementFromPoint.
      data-lane-signal={label}
      className={`lane ${isDragged ? "dragging" : ""} ${isDropTarget ? "drop-target" : ""}`}
      style={{ height: laneHeight }}
    >
      <div
        className="lane-header"
        title="Drag to reorder; drop on the trash to remove"
        onPointerDown={(event) => onHeaderPointerDown(label, event)}
      >
        <div className="lane-header-info">
          <div className="lane-title">{label}</div>
          <div className="lane-meta">
            {signal?.message_name ?? ""} {signal?.unit ? `/ ${signal.unit}` : ""} ·{" "}
            {stats ? `${formatValue(stats.min)}-${formatValue(stats.max)}` : "no range"}
          </div>
        </div>
        <div className="lane-cursor-value" title={cursorValue}>
          {cursorValue}
        </div>
      </div>
      <svg
        className="lane-plot"
        viewBox={`0 0 ${PLOT_WIDTH} 120`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label} timeline`}
        onPointerMove={(event) => {
          const point = nearestPoint(points, event.currentTarget, event.clientX, start, end);
          setHover(point ? { point, x: event.clientX, y: event.clientY } : null);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <line x1="0" x2={PLOT_WIDTH} y1="96" y2="96" className="plot-axis" />
        {ticks.map((tick) => {
          const x = ((tick - start) / (end - start)) * PLOT_WIDTH;
          return <line key={tick} x1={x} x2={x} y1="0" y2="120" className="plot-grid" />;
        })}
        {path ? <path d={path} className={signal?.plot_type === "step" ? "plot-line step" : "plot-line"} /> : null}
        {pointMarks.map((point, index) => (
          <circle key={`${point.x}:${point.y}:${index}`} cx={point.x} cy={point.y} r="3.2" className="plot-point" />
        ))}
        {!path ? (
          <text x={PLOT_WIDTH / 2} y="66" className="plot-empty" textAnchor="middle">
            No data in range
          </text>
        ) : null}
      </svg>
      {hover ? <PointTooltip signal={signal} hover={hover} /> : null}
    </div>
  );
}

// Tooltip intentionally omits source_file / path per UI policy.
function PointTooltip({
  signal,
  hover
}: {
  signal: SignalIndexItem | undefined;
  hover: { point: TimelinePoint; x: number; y: number };
}) {
  const value = hover.point.enum_label
    ? `${formatValue(hover.point.value)} (${hover.point.enum_label})`
    : formatValue(hover.point.value);
  const unit = signal?.unit ? ` ${signal.unit}` : "";
  return (
    <div className="point-tooltip" style={{ left: hover.x + 10, top: hover.y + 10 }}>
      <div>{signal?.signal_name ?? "Unknown"}</div>
      <div>t: {formatTime(hover.point.session_time)}s</div>
      <div>
        value: {value}
        {unit}
      </div>
    </div>
  );
}

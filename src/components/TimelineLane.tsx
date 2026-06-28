import { useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import type { SignalIndexItem, TimelinePoint } from "../types";
import type { ReferenceLine } from "../hooks/useReferenceLines";
import {
  buildValueTransitions,
  buildPath,
  buildPointMarks,
  clamp,
  enumLabelForValue,
  enumReferenceCandidates,
  formatCursorValue,
  formatTime,
  formatTransitionValue,
  formatValue,
  isTransitionMarkerEligible,
  nearestPoint,
  nearestReferenceCandidate,
  pointAtOrBefore,
  pointStats,
  PLOT_WIDTH,
  type ValueTransition,
  valueToY,
  yToValue
} from "../lib/timeline";
import "./TimelineLane.css";

interface TimelineLaneProps {
  laneId: string;
  signal: SignalIndexItem | undefined;
  points: TimelinePoint[];
  start: number;
  end: number;
  cursorTime: number;
  ticks: number[];
  laneHeight: number;
  isDragged: boolean;
  isDropTarget: boolean;
  onHeaderPointerDown: (laneId: string, event: ReactPointerEvent) => void;
  reference: ReferenceLine | null;
  onSetReference: (signal: SignalIndexItem, value: number) => void;
  onClearReference: (signal: SignalIndexItem) => void;
  markersEnabled: boolean;
  onToggleMarkers: (laneId: string) => void;
  onMoveCursor: (time: number) => void;
}

// One stacked signal lane: header plus a point plot. Lanes are draggable to
// reorder. The SVG uses a fixed viewBox stretched to the lane size.
export function TimelineLane({
  laneId,
  signal,
  points,
  start,
  end,
  cursorTime,
  ticks,
  laneHeight,
  isDragged,
  isDropTarget,
  onHeaderPointerDown,
  reference,
  onSetReference,
  onClearReference,
  markersEnabled,
  onToggleMarkers,
  onMoveCursor
}: TimelineLaneProps) {
  const plotRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<{ point: TimelinePoint; x: number; y: number } | null>(null);
  const [transitionHover, setTransitionHover] = useState<{
    transition: ValueTransition;
    x: number;
    y: number;
  } | null>(null);
  const label = signal?.signal_name ?? "Unknown";
  const stats = pointStats(points);
  const path = buildPath(points, start, end, signal?.plot_type ?? "line", stats);
  const pointMarks = buildPointMarks(points, start, end, stats);
  const canShowTransitionMarkers = isTransitionMarkerEligible(signal, points);
  const transitions = useMemo(
    () => (markersEnabled && canShowTransitionMarkers ? buildValueTransitions(points) : []),
    [markersEnabled, canShowTransitionMarkers, points]
  );
  // Held value at the cursor time, shown in the lane's top-right. Derived from
  // cursorTime (not hover) so hovering never replaces it.
  const cursorValue = formatCursorValue(pointAtOrBefore(points, cursorTime), signal?.unit ?? "");
  const hasNumericPoints = points.some((point) => point.value !== null && Number.isFinite(point.value));
  const snapCandidates = enumReferenceCandidates(points);
  const canDragReference = Boolean(
    signal && hasNumericPoints && stats && (signal.value_type === "numeric" || snapCandidates.length > 0)
  );
  const referenceVisible =
    Boolean(reference && stats) && reference!.value >= stats!.min && reference!.value <= stats!.max;
  const referenceLabel = reference
    ? formatReferenceLabel(reference.value, signal?.unit ?? "", enumLabelForValue(points, reference.value))
    : "";
  const referenceY = reference && stats ? valueToY(reference.value, stats) : 0;

  function startReferenceDrag(event: ReactPointerEvent) {
    if (!signal || !stats || !plotRef.current) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    if (event.detail >= 2) {
      onClearReference(signal);
      return;
    }

    const startY = event.clientY;
    let active = false;

    const updateReference = (clientY: number) => {
      const rect = plotRef.current?.getBoundingClientRect();
      if (!rect || rect.height <= 0) {
        return;
      }
      const svgY = clamp(((clientY - rect.top) / rect.height) * 120, 20, 100);
      const value = yToValue(svgY, stats);
      onSetReference(signal, nearestReferenceCandidate(value, snapCandidates));
    };

    const onMove = (move: PointerEvent) => {
      move.preventDefault();
      if (!active) {
        if (Math.abs(move.clientY - startY) < 2) {
          return;
        }
        active = true;
      }
      updateReference(move.clientY);
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
    const onUp = (up: PointerEvent) => {
      if (active) {
        updateReference(up.clientY);
      }
      cleanup();
    };
    const onCancel = () => cleanup();

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  }

  function clearReferenceFromHandle(event: ReactMouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    if (signal) {
      onClearReference(signal);
    }
  }

  return (
    <div
      // data-lane-signal lets the pointer-drag hit-test find this lane as a drop
      // target via document.elementFromPoint.
      data-lane-signal={laneId}
      className={`lane ${isDragged ? "dragging" : ""} ${isDropTarget ? "drop-target" : ""}`}
      style={{ height: laneHeight }}
    >
      <div
        className="lane-header"
        title="Drag to reorder; drop on the trash to remove"
        onPointerDown={(event) => onHeaderPointerDown(laneId, event)}
      >
        <div className="lane-header-info">
          <div className="lane-title">{label}</div>
          <div className="lane-meta">
            {signal?.message_name ?? ""} {signal?.unit ? `/ ${signal.unit}` : ""} ·{" "}
            {stats ? `${formatValue(stats.min)}-${formatValue(stats.max)}` : "no range"}
          </div>
        </div>
        <div className="lane-header-controls">
          {canShowTransitionMarkers ? (
            <button
              type="button"
              className={`marker-toggle ${markersEnabled ? "active" : ""}`}
              title={markersEnabled ? "Hide transition markers" : "Show transition markers"}
              aria-label={markersEnabled ? "Hide transition markers" : "Show transition markers"}
              aria-pressed={markersEnabled}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                onToggleMarkers(laneId);
              }}
            >
              <MarkerToggleIcon />
            </button>
          ) : null}
          <div className="lane-cursor-value" title={cursorValue}>
            {cursorValue}
          </div>
        </div>
      </div>
      <svg
        ref={plotRef}
        className="lane-plot"
        viewBox={`0 0 ${PLOT_WIDTH} 120`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label} timeline`}
        onPointerMove={(event) => {
          const point = nearestPoint(points, event.currentTarget, event.clientX, start, end);
          setHover(point ? { point, x: event.clientX, y: event.clientY } : null);
        }}
        onPointerLeave={() => {
          setHover(null);
          setTransitionHover(null);
        }}
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
        {transitions.map((transition, index) => (
          <TransitionMarker
            key={`${transition.session_time}:${transition.oldValue}:${transition.newValue}:${index}`}
            transition={transition}
            start={start}
            end={end}
            onHover={setTransitionHover}
            onMoveCursor={onMoveCursor}
          />
        ))}
        {reference && referenceVisible ? <ReferenceLineMark y={referenceY} label={referenceLabel} /> : null}
        {!path ? (
          <text x={PLOT_WIDTH / 2} y="66" className="plot-empty" textAnchor="middle">
            No data in range
          </text>
        ) : null}
      </svg>
      {canDragReference ? (
        <div
          className={`reference-handle export-exclude ${reference ? "active" : ""}`}
          title={reference ? `Reference: ${referenceLabel}` : "Drag to set reference line"}
          role="slider"
          aria-label="Reference line"
          aria-valuetext={referenceLabel || "unset"}
          onPointerDown={startReferenceDrag}
          onDoubleClick={clearReferenceFromHandle}
        />
      ) : null}
      {transitionHover ? (
        <TransitionTooltip signal={signal} hover={transitionHover} />
      ) : hover ? (
        <PointTooltip signal={signal} hover={hover} />
      ) : null}
    </div>
  );
}

function formatReferenceLabel(value: number, unit: string, enumLabel: string | null): string {
  if (enumLabel) {
    return enumLabel;
  }
  return unit ? `${formatValue(value)} ${unit}` : formatValue(value);
}

function ReferenceLineMark({ y, label }: { y: number; label: string }) {
  const lineY = clamp(y, 14, 106);
  const labelY = clamp(lineY - 8, 16, 104);
  return (
    <g className="reference-line-mark">
      <line x1="0" x2={PLOT_WIDTH} y1={lineY} y2={lineY} className="reference-line" />
      <text x="28" y={labelY} className="reference-label" textAnchor="start">
        {label}
      </text>
    </g>
  );
}

function TransitionMarker({
  transition,
  start,
  end,
  onHover,
  onMoveCursor
}: {
  transition: ValueTransition;
  start: number;
  end: number;
  onHover: (hover: { transition: ValueTransition; x: number; y: number } | null) => void;
  onMoveCursor: (time: number) => void;
}) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }
  const x = clamp(((transition.session_time - start) / (end - start)) * PLOT_WIDTH, 0, PLOT_WIDTH);
  return (
    <g
      className="transition-marker"
      onPointerMove={(event) => {
        event.stopPropagation();
        onHover({ transition, x: event.clientX, y: event.clientY });
      }}
      onPointerLeave={() => onHover(null)}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        onMoveCursor(transition.session_time);
      }}
    >
      <rect x={x - 6} y="0" width="12" height="120" className="transition-marker-hit" />
      <line x1={x} x2={x} y1="18" y2="104" className="transition-marker-line" />
      <path d={`M ${x} 13 L ${x + 5} 18 L ${x} 23 L ${x - 5} 18 Z`} className="transition-marker-dot" />
    </g>
  );
}

function MarkerToggleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3v10M13 3v10M3 8h3.5M9.5 8H13" />
      <path d="M8 5l2.5 3L8 11 5.5 8 8 5Z" />
    </svg>
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

function TransitionTooltip({
  signal,
  hover
}: {
  signal: SignalIndexItem | undefined;
  hover: { transition: ValueTransition; x: number; y: number };
}) {
  const oldText = formatTransitionValue(hover.transition.oldValue, hover.transition.oldLabel);
  const newText = formatTransitionValue(hover.transition.newValue, hover.transition.newLabel);
  return (
    <div className="point-tooltip transition-tooltip" style={{ left: hover.x + 10, top: hover.y + 10 }}>
      <div>{signal?.signal_name ?? "Unknown"}</div>
      <div>t: {formatTime(hover.transition.session_time)}s</div>
      <div>
        transition: {oldText} -&gt; {newText}
      </div>
    </div>
  );
}

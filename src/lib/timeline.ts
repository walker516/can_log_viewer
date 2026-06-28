import type { SignalIndexItem, TimelinePoint } from "../types";

// Internal coordinate space used by every lane plot. The lane SVG keeps a fixed
// viewBox and is stretched with preserveAspectRatio="none", so all geometry is
// computed against this constant 1000x120 box regardless of the rendered size.
export const PLOT_WIDTH = 1000;

export interface ValueRange {
  min: number;
  max: number;
}

export interface PlotPoint {
  x: number;
  y: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatValue(value: number | null): string {
  if (value === null) {
    return "null";
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

// Time labels stay short by dropping precision as the magnitude grows; the axis
// only needs to stay readable, not exact.
export function formatTime(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0";
  }
  if (Math.abs(value) >= 100) {
    return value.toFixed(0);
  }
  if (Math.abs(value) >= 10) {
    return value.toFixed(1).replace(/\.0$/, "");
  }
  return value.toFixed(2).replace(/\.?0+$/, "");
}

// Choose "nice" 1/2/5 * 10^n tick steps so the axis lands on round numbers.
export function buildTimeTicks(start: number, end: number): number[] {
  const span = end - start;
  if (span <= 0) {
    return [];
  }
  const targetCount = 6;
  const rawStep = span / targetCount;
  const power = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / power;
  const multiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = multiplier * power;
  const first = Math.ceil(start / step) * step;
  const ticks: number[] = [];
  for (let tick = first; tick <= end + step * 0.001; tick += step) {
    ticks.push(Number(tick.toFixed(6)));
  }
  return ticks;
}

export function pointStats(points: TimelinePoint[]): ValueRange | null {
  const values = points
    .map((point) => point.value)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  if (values.length === 0) {
    return null;
  }
  return { min: Math.min(...values), max: Math.max(...values) };
}

// Map a value onto the lane's vertical band, leaving padding at top and bottom.
export function valueToY(value: number, stats: ValueRange): number {
  const span = stats.max - stats.min || 1;
  return clamp(100 - ((value - stats.min) / span) * 80, 12, 108);
}

// Inverse of the normal in-range mapping used by valueToY. Dragging the
// reference handle clamps to the visible data range so the reference line stays
// within the lane without changing the y-scale.
export function yToValue(y: number, stats: ValueRange): number {
  if (stats.max === stats.min) {
    return stats.min;
  }
  const clampedY = clamp(y, 20, 100);
  const span = stats.max - stats.min;
  return clamp(stats.min + ((100 - clampedY) / 80) * span, stats.min, stats.max);
}

export function enumReferenceCandidates(points: TimelinePoint[]): number[] {
  const values = new Set<number>();
  points.forEach((point) => {
    if (point.enum_label && point.value !== null && Number.isFinite(point.value)) {
      values.add(point.value);
    }
  });
  return [...values].sort((left, right) => left - right);
}

export function nearestReferenceCandidate(value: number, candidates: number[]): number {
  if (candidates.length === 0) {
    return value;
  }
  return candidates.reduce((best, candidate) =>
    Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best
  );
}

export function enumLabelForValue(points: TimelinePoint[], value: number): string | null {
  return (
    points.find(
      (point) => point.enum_label && point.value !== null && Number.isFinite(point.value) && point.value === value
    )?.enum_label ?? null
  );
}

function toX(time: number, start: number, end: number): number {
  return clamp(((time - start) / (end - start)) * PLOT_WIDTH, 0, PLOT_WIDTH);
}

export function buildPath(
  points: TimelinePoint[],
  start: number,
  end: number,
  plotType: SignalIndexItem["plot_type"],
  stats: ValueRange | null
): string {
  const drawable = points.filter((point) => point.value !== null && Number.isFinite(point.value));
  if (!stats || drawable.length === 0 || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return "";
  }

  let path = "";
  drawable.forEach((point, index) => {
    const x = toX(point.session_time, start, end);
    const y = valueToY(point.value as number, stats);
    if (index === 0) {
      path += `M ${x} ${y}`;
      return;
    }
    if (plotType === "step") {
      // Hold the previous value until the new sample's time, then step.
      const previousY = valueToY(drawable[index - 1].value as number, stats);
      path += ` L ${x} ${previousY} L ${x} ${y}`;
    } else {
      path += ` L ${x} ${y}`;
    }
  });
  return path;
}

export function buildPointMarks(
  points: TimelinePoint[],
  start: number,
  end: number,
  stats: ValueRange | null
): PlotPoint[] {
  if (!stats || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return [];
  }
  return points
    .filter((point) => point.value !== null && Number.isFinite(point.value))
    .map((point) => ({ x: toX(point.session_time, start, end), y: valueToY(point.value as number, stats) }));
}

// Hold-last-value lookup for the cursor: the last sample at or before `time`.
// Points are sorted ascending by session_time (the query returns them sorted),
// so a binary search finds the held value. Returns null when nothing precedes
// the cursor in the available data.
export function pointAtOrBefore(points: TimelinePoint[], time: number): TimelinePoint | null {
  let lo = 0;
  let hi = points.length - 1;
  let result: TimelinePoint | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].session_time <= time) {
      result = points[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

// Format the cursor's held value for a lane: enum label takes priority, then a
// numeric value with its unit; "-" when there is no value before the cursor.
export function formatCursorValue(point: TimelinePoint | null, unit: string): string {
  if (!point) {
    return "-";
  }
  if (point.enum_label) {
    return point.enum_label;
  }
  if (point.value === null || !Number.isFinite(point.value)) {
    return "-";
  }
  return unit ? `${formatValue(point.value)} ${unit}` : formatValue(point.value);
}

// Find the sample closest in time to the pointer's horizontal position.
export function nearestPoint(
  points: TimelinePoint[],
  svg: SVGSVGElement,
  clientX: number,
  start: number,
  end: number
): TimelinePoint | null {
  if (points.length === 0 || end <= start) {
    return null;
  }
  const rect = svg.getBoundingClientRect();
  const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
  const time = start + ratio * (end - start);
  let best: TimelinePoint | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const point of points) {
    const distance = Math.abs(point.session_time - time);
    if (distance < bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return best;
}

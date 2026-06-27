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
function toY(value: number, stats: ValueRange): number {
  const span = stats.max - stats.min || 1;
  return clamp(100 - ((value - stats.min) / span) * 80, 12, 108);
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
    const y = toY(point.value as number, stats);
    if (index === 0) {
      path += `M ${x} ${y}`;
      return;
    }
    if (plotType === "step") {
      // Hold the previous value until the new sample's time, then step.
      const previousY = toY(drawable[index - 1].value as number, stats);
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
    .map((point) => ({ x: toX(point.session_time, start, end), y: toY(point.value as number, stats) }));
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

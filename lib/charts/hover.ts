/** Hover and keyboard helpers for the line chart's crosshair tooltip (dataviz: an HTML chart ships a hover layer). Pure. */
import { fmt, type ChartPoint } from './scale';

/** Index of the point nearest an x position in percent of the plot width, for n points spread evenly from 0 to 100. */
export function nearestIndex(xPct: number, count: number): number {
  if (count <= 1) return 0;
  const i = Math.round((Math.min(100, Math.max(0, xPct)) * (count - 1)) / 100);
  return Math.min(count - 1, Math.max(0, i));
}
/** `Q3 ’26 · 23 days`, or `Q1 ’26 · Hidden (n < 11)` for a suppressed point; the note rides along when present. */
export function tooltipText(point: ChartPoint, unit = ''): string {
  const value = point.value == null ? 'Hidden (n < 11)' : fmt(point.value, unit);
  return `${point.label} · ${value}${point.note ? ` · ${point.note}` : ''}`;
}
/** Where a key starts from when nothing is active: before the first point for a forward key, after the last for a backward one, so the first press lands on an end. */
export function startIndex(active: number | null, key: string, count: number): number {
  if (active != null) return active;
  return key === 'ArrowLeft' || key === 'ArrowDown' ? count : -1;
}
/** Next index for an arrow key, clamped; other keys leave it unchanged. */
export function stepIndex(current: number, key: string, count: number): number {
  if (key === 'ArrowRight' || key === 'ArrowUp') return Math.min(count - 1, current + 1);
  if (key === 'ArrowLeft' || key === 'ArrowDown') return Math.max(0, current - 1);
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return current;
}

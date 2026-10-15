/** Pure helpers for `ExplainLayer` (DS-11a): what a target's data attributes say, where the one card goes, and the sentence the live region reads. */
import { asOfNote } from '@/lib/dashboard/cards';
import type { Term } from './glossary';

export type Box = { left: number; top: number; width: number; height: number };
export type TargetData = { term?: string; value?: string; source?: string; asof?: string; hidden?: string };
export const CARD_WIDTH = 320;
const GAP = 4;

/** Card top-left relative to the layer: under the target, left-aligned, kept inside the layer's width; above the target when it would run past the bottom. */
export function cardPosition(target: Box, layer: Box, cardHeight = 0): { left: number; top: number } {
  const left = Math.max(0, Math.min(target.left - layer.left, layer.width - CARD_WIDTH));
  const below = target.top - layer.top + target.height + GAP;
  const top = cardHeight && below + cardHeight > layer.height ? Math.max(0, target.top - layer.top - GAP - cardHeight) : below;
  return { left, top };
}

/** One sentence for the polite live region: title, value, source, as-of and the hidden reason, only the parts present. */
export function liveText(t: Term, d: TargetData): string {
  const parts = [t.title, d.value, d.source, d.asof && asOfNote(d.asof), d.hidden].filter((p): p is string => Boolean(p));
  return parts.join(' · ');
}

/** Next target index for a key; -1 means no change. Forward keys from nowhere land on the first target, backward keys on the last. */
export function nextTarget(current: number, key: string, count: number): number {
  if (count === 0) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowRight' || key === 'ArrowDown') return current < 0 ? 0 : Math.min(count - 1, current + 1);
  if (key === 'ArrowLeft' || key === 'ArrowUp') return current < 0 ? count - 1 : Math.max(0, current - 1);
  return -1;
}

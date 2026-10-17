// F-504d: the 0–100 fit score as a decision word (go/no-go: eligibility gate → weighted fit → band). Pure. Edges come from the approved
// `match_config.params`: `band_strong` (default 75) and `band_look` (default the digest threshold). A blocker or floor cap is always Pass, with its stored reason.
import { DEFAULT_EVAL_THRESHOLD } from './eval';
import type { Component } from './score';

export type BandKey = 'strong' | 'look' | 'pass';
export type FitBand = { key: BandKey; label: string; cap: 'blocker' | 'floor' | null; reason: string | null };
export const BAND_LABEL: Record<BandKey, string> = { strong: 'Strong fit', look: 'Worth a look', pass: 'Pass' };
export const DEFAULT_BAND_STRONG = 75;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** `params.digest_threshold`, else the eval threshold, else 60 (docs/GRANT_MATCHING.md: the digest threshold). */
export function digestThreshold(params: unknown): number {
  const p = (params ?? {}) as { digest_threshold?: unknown; eval_threshold?: unknown };
  for (const v of [p.digest_threshold, p.eval_threshold]) if (num(v)) return v;
  return DEFAULT_EVAL_THRESHOLD;
}

/** The two edges: score ≥ strong is Strong fit, ≥ look is Worth a look. */
export function bandEdges(params: unknown): { strong: number; look: number } {
  const p = (params ?? {}) as { band_strong?: unknown; band_look?: unknown };
  return { strong: num(p.band_strong) ? p.band_strong : DEFAULT_BAND_STRONG, look: num(p.band_look) ? p.band_look : digestThreshold(params) };
}

export function fitBand(score: number, params: unknown, components: Pick<Component, 'key' | 'reason'>[] = []): FitBand {
  const cap = components.find((c) => c.key === 'blocker_cap' || c.key === 'floor_cap');
  if (cap) return { key: 'pass', label: BAND_LABEL.pass, cap: cap.key === 'blocker_cap' ? 'blocker' : 'floor', reason: cap.reason };
  const { strong, look } = bandEdges(params), key: BandKey = score >= strong ? 'strong' : score >= look ? 'look' : 'pass';
  return { key, label: BAND_LABEL[key], cap: null, reason: null };
}

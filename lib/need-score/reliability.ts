/** F-210c low-reliability flags read back from stored need_score.components. Pure; no imports beyond types. */
import type { NeedComponent } from './compute';

export type ReliabilityFlag = { code: string; value: number; cv: number; vintage: string; source_id: string | null; ingest_run_id: string | null };
/** A flag with the input's label and its source's display name, ready for a marker. */
export type ShownFlag = ReliabilityFlag & { label: string; source: string };

export const LOW_RELIABILITY = {
  id: 'low_reliability',
  title: 'Low reliability',
  plain: "The Census margin of error for this input is wide next to the estimate, so this county's score leans on a noisy number. The county is still scored; read it with care.",
} as const;

/** Components marked `low_reliability: true` with a stored CV, in input order. */
export function reliabilityFlags(components: Record<string, NeedComponent> | null | undefined): ReliabilityFlag[] {
  return Object.entries(components ?? {}).flatMap(([code, c]) => (c.low_reliability === true && typeof c.cv === 'number'
    ? [{ code, value: Number(c.value), cv: c.cv, vintage: c.vintage, source_id: c.source_id ?? null, ingest_run_id: c.ingest_run_id ?? null }] : []));
}

/** Explain-card rows: the input, its CV, the value, and the stored source row it came from. */
export function flagRows(f: ShownFlag): [string, string][] {
  return [['Input', f.label], ['CV', `${f.cv.toFixed(1)}%`], ['Value', String(f.value)], ['Source row', `${f.source} ${f.vintage}`], ['Ingest run', f.ingest_run_id ?? 'Not recorded']];
}

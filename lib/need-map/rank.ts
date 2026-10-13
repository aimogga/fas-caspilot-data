export type Scored = { fips: string; score: number | null };

export class NeedRank {
  /** Rank 1 = highest score. Counties without a score get no rank; ties share a rank. */
  static rank(rows: Scored[]): Map<string, number> {
    const ranked = rows.filter((r) => r.score !== null);
    ranked.sort((a, b) => (b.score as number) - (a.score as number));
    const out = new Map<string, number>();
    ranked.forEach((r, i) => {
      const prev = ranked[i - 1];
      const tied = prev !== undefined && prev.score === r.score;
      out.set(r.fips, tied ? (out.get(prev.fips) as number) : i + 1);
    });
    return out;
  }
}

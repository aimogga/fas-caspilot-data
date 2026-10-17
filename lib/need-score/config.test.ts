import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NeedScore } from './compute';

/** Guards the need_score_config migrations: each weights JSON must parse and sum to 1 (D-025/D-026). */
const migrations: Record<string, string> = {
  'v1-poverty-uninsured': 'supabase/migrations/20261013180000_f210_need_score_v1_config.sql',
  'v2-draft-five-input': 'supabase/migrations/20261013200000_f210_need_score_v2_draft_config.sql',
  'v1.1-poverty-uninsured-capped': 'supabase/migrations/20261017000020_f210c_need_score_params.sql',
};

describe('need_score_config migrations', () => {
  for (const [version, file] of Object.entries(migrations)) {
    it(`${file} inserts ${version} with weights that sum to 1`, () => {
      const sql = readFileSync(file, 'utf8');
      expect(sql).toContain(`'${version}'`);
      const json = /'(\{[^']+\})'/.exec(sql)?.[1];
      expect(json).toBeDefined();
      const weights = JSON.parse(json as string) as Record<string, number>;
      expect(() => NeedScore.validate(weights)).not.toThrow();
      expect(Math.abs(NeedScore.sum(weights) - 1)).toBeLessThan(1e-6);
    });
  }

  it('F-210c adds params with a {} default and inserts v1.1 unapproved with z_cap 3 and cv_flag_pct 30', () => {
    const sql = readFileSync(migrations['v1.1-poverty-uninsured-capped'] as string, 'utf8');
    expect(sql).toMatch(/ALTER TABLE need_score_config ADD COLUMN params jsonb NOT NULL DEFAULT '\{\}'::jsonb;/);
    expect(sql).not.toMatch(/POLICY|ROW LEVEL SECURITY|approved_by\s*[,)]/i);
    const [weights, params] = [...sql.matchAll(/'(\{[^']+\})'/g)].map((m) => JSON.parse(m[1] as string));
    expect(weights).toEqual({ poverty_rate: 0.5, uninsured_rate: 0.5 });
    expect(params).toEqual({ z_cap: 3, cv_flag_pct: 30 });
    expect(() => NeedScore.validateParams(params)).not.toThrow();
  });
});

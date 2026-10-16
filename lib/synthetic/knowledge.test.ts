import { describe, expect, it } from 'vitest';
import { checkKnowledge } from '../knowledge/guard';
import { SYNTH_ORG } from './generate';
import { KNOWLEDGE, knowledgeSql } from './knowledge';

describe('synthetic org_knowledge', () => {
  it('seeds 4 fictional rows for the synthetic org that pass the privacy guard', () => {
    expect(KNOWLEDGE).toHaveLength(4);
    for (const k of KNOWLEDGE) expect([k.org_id, /fictional/i.test(k.title), checkKnowledge(k)]).toEqual([SYNTH_ORG, true, { ok: true }]);
    expect(knowledgeSql()).toMatch(/^INSERT INTO org_knowledge \([^)]*\) VALUES\n[\s\S]*ON CONFLICT \(id\) DO NOTHING;\n$/);
  });
});

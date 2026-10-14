import { describe, expect, it } from 'vitest';
import { ALLOWED, INTAKE_ENTITIES, INTAKE_SCHEMA, TEMPLATE_HEADERS, isIntakeEntity } from './schema';

const FORBIDDEN = ['clinical', 'note', 'diagnos', 'substance', 'drug', 'alcohol', 'document', 'zip', 'address', 'tract', 'ssn', 'birth', 'dob', 'name'];

describe('intake schema', () => {
  it('template headers equal the schema keys for every entity', () => {
    for (const e of INTAKE_ENTITIES) expect(TEMPLATE_HEADERS[e]).toEqual(INTAKE_SCHEMA[e].fields.map((f) => f.key));
  });
  it('contains no forbidden field (privacy golden rule 5)', () => {
    for (const e of INTAKE_ENTITIES) {
      for (const f of INTAKE_SCHEMA[e].fields) {
        const text = `${f.key} ${f.label}`.toLowerCase();
        for (const w of FORBIDDEN) expect(text, `${e}.${f.key} contains "${w}"`).not.toContain(w);
      }
    }
  });
  it('every enum field has allowed values and date-order rules name real date columns', () => {
    for (const e of INTAKE_ENTITIES) {
      const byKey = Object.fromEntries(INTAKE_SCHEMA[e].fields.map((f) => [f.key, f]));
      for (const f of INTAKE_SCHEMA[e].fields) if (f.type === 'enum') expect(f.values?.length).toBeGreaterThan(0);
      for (const [a, b] of INTAKE_SCHEMA[e].dateOrder) expect([byKey[a]?.type, byKey[b]?.type]).toEqual(['date', 'date']);
    }
    expect(ALLOWED.measure_code).toEqual(['PHQ-9', 'GAD-7', 'OQ-45', 'YOQ']);
    expect(isIntakeEntity('case')).toBe(true);
    expect(isIntakeEntity('provider')).toBe(false);
  });
});

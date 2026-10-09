import { describe, expect, it } from 'vitest';
import { assertLocalSupabase, localPgEnv } from './local-pg';

const API = 'http://127.0.0.1:54321';
const B = 'postgresql://postgres:postgres@127.0.0.1:54322';
const OK = `${B}/postgres`;

describe('assertLocalSupabase', () => {
  it('accepts the local URL', () => {
    expect(assertLocalSupabase(API, OK, {})).toEqual({
      host: '127.0.0.1', port: '54322', user: 'postgres', database: 'postgres', password: 'postgres',
    });
    expect(assertLocalSupabase('http://LOCALHOST:54321', OK.replace('127.0.0.1', 'LOCALHOST'), {}).host).toBe('localhost');
  });
  it.each([
    [API, `${OK}?host=evil`], [API, `${OK}?hostaddr=192.0.2.1`], [API, `${OK}?service=x`], [API, `${OK}#frag`],
    [API, 'postgresql://postgres:postgres@example.test:54322/postgres'], ['http://example.test:54321', OK],
    [API, `${B}/host=qa-evil.invalid`], [API, `${B}/hostaddr=192.0.2.1`],
    [API, `${B}/postgresql:%2F%2Fqa-evil.invalid%2Fpostgres`],
    [API, `${B}/dbname%3Dpostgres%20host%3Dqa-evil.invalid`],
  ])('rejects %s %s', (api, db) => { expect(() => assertLocalSupabase(api, db, {})).toThrow(); });
  it.each(['PGHOST', 'PGHOSTADDR', 'PGSERVICE'])('rejects env %s', (k) => {
    expect(() => assertLocalSupabase(API, OK, { [k]: 'x' })).toThrow();
  });
  it('localPgEnv sets PGPASSWORD and drops libpq host overrides', () => {
    const env = localPgEnv(assertLocalSupabase(API, OK, {}), {
      PGHOST: 'x', PGHOSTADDR: 'y', PGSERVICE: 'z', PGOPTIONS: 'w', KEEP: '1',
    });
    expect(env.PGPASSWORD).toBe('postgres');
    expect(env.KEEP).toBe('1');
    expect(env.PGHOST ?? env.PGHOSTADDR ?? env.PGSERVICE ?? env.PGOPTIONS).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { assertLocalSupabase } from './local-pg';

const API = 'http://127.0.0.1:54321';
const OK = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

describe('assertLocalSupabase', () => {
  it('accepts the local URL', () => {
    expect(assertLocalSupabase(API, OK, {})).toEqual({
      host: '127.0.0.1', port: '54322', user: 'postgres', database: 'postgres', password: 'postgres',
    });
  });
  it.each([
    ['?host=evil', `${OK}?host=evil`],
    ['?hostaddr=', `${OK}?hostaddr=192.0.2.1`],
    ['?service=', `${OK}?service=x`],
    ['#fragment', `${OK}#frag`],
    ['non-loopback', 'postgresql://postgres:postgres@example.test:54322/postgres'],
  ])('rejects %s', (_n, db) => {
    expect(() => assertLocalSupabase(API, db, {})).toThrow();
  });
  it.each(['PGHOST', 'PGHOSTADDR', 'PGSERVICE'])('rejects env %s', (k) => {
    expect(() => assertLocalSupabase(API, OK, { [k]: 'x' })).toThrow();
  });
});

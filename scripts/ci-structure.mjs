export function parseYaml(text) {
  const L = text.split(/\n/);
  let i = 0;
  const id = s => (s.match(/^ */) || [''])[0].length;
  const skip = () => { while (i < L.length && /^\s*(#.*)?$/.test(L[i])) i++; };
  const unq = s => /^['"]/.test(s) ? s.slice(1, -1) : s === 'true' ? true : s === 'false' ? false : /^-?\d+$/.test(s) ? +s : s.startsWith('[') && s.endsWith(']') ? s.slice(1, -1).split(',').map(x => unq(x.trim())) : s;
  function val(ind, rest) {
    if (rest === '|' || rest === '>') {
      const b = [];
      while (i < L.length) {
        const x = L[i];
        if (x.trim() === '') { b.push(''); i++; continue; }
        if (id(x) <= ind) break;
        b.push(x.slice(ind + 2)); i++;
      }
      return b.join('\n').replace(/\n+$/, '');
    }
    if (rest) return unq(rest);
    skip();
    return i < L.length && id(L[i]) > ind ? blk(id(L[i])) : null;
  }
  const blk = ind => { skip(); return i >= L.length ? null : /^\s*- /.test(L[i]) ? seq(ind) : map(ind); };
  function map(ind) {
    const o = {};
    for (;;) {
      skip();
      if (i >= L.length || id(L[i]) !== ind || /^\s*- /.test(L[i])) break;
      const body = L[i++].slice(ind).replace(/\s+#.*$/, ''), c = body.indexOf(':');
      o[body.slice(0, c).trim()] = val(ind, body.slice(c + 1).trim());
    }
    return o;
  }
  function seq(ind) {
    const a = [];
    for (;;) {
      skip();
      if (i >= L.length || id(L[i]) !== ind || !/^\s*- /.test(L[i])) break;
      const after = L[i++].slice(ind + 2);
      if (!after) { a.push(blk(ind + 2)); continue; }
      if (/^[A-Za-z0-9_-]+:/.test(after)) { L[--i] = ' '.repeat(ind + 2) + after; a.push(map(ind + 2)); }
      else a.push(unq(after));
    }
    return a;
  }
  return map(0);
}
const CHECKS = [['lint', /lint/i, 'pnpm lint'], ['typecheck', /typecheck/i, 'pnpm typecheck'], ['unit', /unit/i, 'pnpm test'], ['db', /database/i, 'pnpm test:db'], ['e2e', /e2e/i, 'pnpm test:e2e'], ['secret-scan', /secret scan/i, 'node scripts/nightly-audit.mjs --secrets-only']];
const has = (o, k) => o != null && Object.hasOwn(o, k);
export function assertCi(doc) {
  const jobs = doc?.jobs;
  if (!jobs?.ci || !jobs['secret-scan']) throw new Error('missing jobs');
  for (const n of ['ci', 'secret-scan']) if (has(jobs[n], 'if') || has(jobs[n], 'continue-on-error')) throw new Error(`${n} gated`);
  const seen = {};
  for (const n of ['ci', 'secret-scan']) {
    for (const step of jobs[n].steps || []) {
      const spec = CHECKS.find(([, re]) => re.test(step.name || ''));
      if (!spec) continue;
      if (has(step, 'if') || has(step, 'continue-on-error')) throw new Error(`${spec[0]} gated`);
      if (step.run !== spec[2]) throw new Error(`${spec[0]} run`);
      seen[spec[0]] = true;
    }
  }
  for (const [id] of CHECKS) if (!seen[id]) throw new Error(`missing ${id}`);
}

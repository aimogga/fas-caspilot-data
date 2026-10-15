// design-shots: signs in through the JSON login API and saves before/after screenshots for one design packet (DS-xx).
// Usage (pnpm shots): node scripts/design-shots.mjs --id DS-10a --tag before|after --role staff|admin|board --route /staff
//   [--base http://127.0.0.1:3000] [--widths 375,1024,1440] [--hover "<css>"] [--focus "<css>"] [--print] [--pdf] [--dark]
// Writes docs/design/reviews/<id>/<tag>/<route-slug>-<width>[-<variant>].png and appends one row per shot to <id>/manifest.json.
// The sign-in password comes from DESIGN_SHOTS_PASSWORD; the synthetic seed password is used only against 127.0.0.1 / localhost.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, request } from '@playwright/test';

export const ROOT = 'docs/design/reviews';
export const ROLES = ['staff', 'admin', 'board'];
export const LOCAL_HOSTS = ['127.0.0.1', 'localhost'];
export const PRINT_WIDTH = 816;
/** The hover/focus face of the explain kit (components/trust/explain.tsx): the HoverCard or Popover body, or the Hint tooltip. */
export const FACE = '[data-slot=explain-content]:visible, [role=tooltip]:visible';
const SEED_PASSWORD = 'testpass123';
const VALUES = ['id', 'tag', 'role', 'route', 'base', 'widths', 'hover', 'focus'];
const FLAGS = ['print', 'pdf', 'dark'];

/** `--key value` pairs and `--flag` switches into options; every check lives here so main() only runs. */
export function parseArgs(argv) {
  const o = { base: 'http://127.0.0.1:3000', widths: '375,1024,1440', hover: '', focus: '', print: false, pdf: false, dark: false };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i].startsWith('--') ? argv[i].slice(2) : '';
    if (FLAGS.includes(key)) o[key] = true;
    else if (!VALUES.includes(key) || argv[i + 1] === undefined || argv[i + 1].startsWith('--')) throw new Error(`unexpected or incomplete argument ${argv[i]}`);
    else o[key] = argv[++i];
  }
  for (const k of ['id', 'tag', 'role', 'route']) if (!o[k]) throw new Error(`--${k} is required`);
  if (!/^[A-Za-z0-9._-]+$/.test(o.id)) throw new Error('--id may use letters, digits, dot, dash and underscore only');
  if (!['before', 'after'].includes(o.tag)) throw new Error('--tag must be before or after');
  if (!ROLES.includes(o.role)) throw new Error(`--role must be one of ${ROLES.join(', ')}`);
  o.widths = String(o.widths).split(',').map(Number);
  if (o.widths.some((w) => !Number.isInteger(w) || w < 320)) throw new Error('--widths must be whole numbers of at least 320');
  o.route = o.route.startsWith('/') ? o.route : `/${o.route}`;
  o.base = o.base.replace(/\/+$/, '');
  return o;
}

/** Route to file stem: no leading slash; `/`, `?` and `=` become `-`; the root is `home`. */
export function slug(route) {
  return String(route).replace(/^\/+/, '').replace(/[/?=]/g, '-') || 'home';
}

/** `<slug>-<width>.png` for the base shot, `<slug>-<width>-<variant>.png` for hover, focus, print and dark. */
export function fileName(route, width, variant = 'base') {
  return `${slug(route)}-${width}${variant && variant !== 'base' ? `-${variant}` : ''}.png`;
}

/** The synthetic seed accounts (lib/synthetic): staff@, admin@ and board@example.test. */
export function emailFor(role) {
  if (!ROLES.includes(role)) throw new Error(`unknown role ${role}`);
  return `${role}@example.test`;
}

/** DESIGN_SHOTS_PASSWORD when set; the seed password only for a local app; otherwise a plain error that echoes no value. */
export function passwordFor(host, env = process.env) {
  if (env.DESIGN_SHOTS_PASSWORD) return env.DESIGN_SHOTS_PASSWORD;
  if (LOCAL_HOSTS.includes(host)) return SEED_PASSWORD;
  throw new Error(`DESIGN_SHOTS_PASSWORD is not set and ${host} is not a local host`);
}

/** After a hover or focus, wait for the face (HoverCard openDelay 150 ms, Tooltip delay) and let it settle; a plain element with no face gets a short fixed wait instead. Never throws. */
export async function waitForFace(page, { timeout = 5_000, settle = 250, fallback = 500 } = {}) {
  const shown = await page.waitForSelector(FACE, { state: 'visible', timeout }).then(() => true, () => false);
  await page.waitForTimeout(shown ? settle : fallback);
  return shown;
}

function readManifest(file) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf-8')) : [];
}

/** One signed-in context per width: load the route once, wait for the page shell and fonts, then save each variant in order (hover and focus wait for the face first). */
async function capture(browser, state, o, width, variants, save) {
  const context = await browser.newContext({ storageState: state, reducedMotion: 'reduce', viewport: { width, height: 900 } });
  context.setDefaultTimeout(90_000);
  const page = await context.newPage();
  await page.goto(o.base + o.route);
  await page.waitForSelector('[data-slot=page]');
  await page.evaluate(() => document.fonts.ready.then(() => true));
  for (const variant of variants) {
    if (variant === 'hover') {
      await page.hover(o.hover);
      await waitForFace(page);
    }
    if (variant === 'focus') {
      await page.mouse.move(0, 0);
      await page.focus(o.focus);
      await waitForFace(page);
    }
    if (variant === 'print') await page.emulateMedia({ media: 'print' });
    if (variant === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark'));
    const file = await save(page, width, variant);
    if (variant === 'print' && o.pdf) await page.pdf({ path: file.replace(/\.png$/, '.pdf'), format: 'Letter' });
  }
  await context.close();
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const o = parseArgs(argv);
  const host = new URL(o.base).hostname;
  const password = passwordFor(host, env);
  const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  const dir = path.join(ROOT, o.id);
  const manifestFile = path.join(dir, 'manifest.json');
  const rows = [];
  mkdirSync(path.join(dir, o.tag), { recursive: true });
  const api = await request.newContext({ baseURL: o.base });
  const login = await api.post('/api/auth/login', { data: { email: emailFor(o.role), password } });
  if (!login.ok()) throw new Error(`sign-in as ${o.role} at ${host} failed with HTTP ${login.status()}`);
  const state = await api.storageState();
  await api.dispose();
  const save = async (page, width, variant) => {
    const file = path.join(dir, o.tag, fileName(o.route, width, variant));
    await page.screenshot({ path: file, fullPage: width === 375 || variant === 'print' });
    rows.push({ id: o.id, tag: o.tag, route: o.route, width, variant, host, sha, at: new Date().toISOString() });
    console.log(`wrote ${file}`);
    return file;
  };
  const variants = ['base', o.hover && 'hover', o.focus && 'focus', o.dark && 'dark'].filter(Boolean);
  const browser = await chromium.launch();
  try {
    for (const width of o.widths) await capture(browser, state, o, width, variants, save);
    if (o.print) await capture(browser, state, o, PRINT_WIDTH, ['print'], save);
  } finally {
    await browser.close();
    if (rows.length) writeFileSync(manifestFile, `${JSON.stringify([...readManifest(manifestFile), ...rows], null, 2)}\n`);
  }
  return rows;
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().then(
    (rows) => console.log(`${rows.length} shot(s) saved under ${ROOT}; run pnpm review-page to rebuild index.html`),
    (e) => { console.error(`design-shots: ${e.message}`); process.exit(1); },
  );
}

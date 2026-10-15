import { describe, expect, it } from 'vitest';
import { FACE, LOCAL_HOSTS, emailFor, fileName, main, parseArgs, passwordFor, slug, waitForFace } from './design-shots.mjs';

const base = ['--id', 'DS-10a', '--tag', 'before', '--role', 'staff', '--route', '/staff'];

describe('parseArgs', () => {
  it('fills the defaults and parses widths, selectors, flags, a bare route and a trailing slash on the base', () => {
    expect(parseArgs(base)).toEqual({ id: 'DS-10a', tag: 'before', role: 'staff', route: '/staff', base: 'http://127.0.0.1:3000', widths: [375, 1024, 1440], hover: '', focus: '', print: false, pdf: false, dark: false });
    const o = parseArgs([...base, '--base', 'https://preview.example.test/', '--widths', '375,1024', '--hover', 'a[href="/dashboard"]', '--focus', '#email', '--print', '--pdf', '--dark']);
    expect(o).toMatchObject({ base: 'https://preview.example.test', widths: [375, 1024], hover: 'a[href="/dashboard"]', focus: '#email', print: true, pdf: true, dark: true });
    expect(parseArgs([...base.slice(0, 6), '--route', 'board']).route).toBe('/board');
  });

  it('rejects missing keys, a bad tag, role, id or width, and unknown or valueless arguments', () => {
    expect(() => parseArgs(base.slice(0, 6))).toThrow('--route is required');
    expect(() => parseArgs([...base.slice(0, 2), '--tag', 'during', ...base.slice(4)])).toThrow('--tag must be before or after');
    expect(() => parseArgs([...base.slice(0, 4), '--role', 'root', ...base.slice(6)])).toThrow('--role must be one of staff, admin, board');
    expect(() => parseArgs(['--id', '../etc', ...base.slice(2)])).toThrow('--id may use');
    expect(() => parseArgs([...base, '--widths', '375,wide'])).toThrow('--widths must be whole numbers');
    expect(() => parseArgs([...base, '--nope', '1'])).toThrow('unexpected or incomplete argument --nope');
    expect(() => parseArgs([...base, '--hover'])).toThrow('unexpected or incomplete argument --hover');
  });
});

describe('slug and fileName', () => {
  it('drops the leading slash, turns / ? = into dashes and calls the root home', () => {
    expect(slug('/staff')).toBe('staff');
    expect(slug('/need-map?county=49035')).toBe('need-map-county-49035');
    expect(slug('/admin/uploads/new')).toBe('admin-uploads-new');
    expect(slug('/')).toBe('home');
    expect(slug('')).toBe('home');
  });

  it('adds the width, then a variant suffix for everything but the base shot', () => {
    expect(fileName('/staff', 375)).toBe('staff-375.png');
    expect(fileName('/staff', 1024, 'base')).toBe('staff-1024.png');
    expect(fileName('/need-map?county=49035', 1440, 'hover')).toBe('need-map-county-49035-1440-hover.png');
    expect(fileName('/board', 816, 'print')).toBe('board-816-print.png');
  });
});

describe('emailFor', () => {
  it('maps every role to its synthetic seed account and rejects anything else', () => {
    expect(['staff', 'admin', 'board'].map(emailFor)).toEqual(['staff@example.test', 'admin@example.test', 'board@example.test']);
    expect(() => emailFor('root')).toThrow('unknown role root');
  });
});

describe('waitForFace', () => {
  /** A page stub: waitForSelector resolves or rejects (a Playwright timeout), waitForTimeout records the ms it was asked for. */
  const fakePage = (faceAppears) => {
    const calls = [];
    return {
      calls,
      waitForSelector: (selector, opts) => {
        calls.push(['waitForSelector', selector, opts]);
        return faceAppears ? Promise.resolve({}) : Promise.reject(new Error('Timeout 5000ms exceeded'));
      },
      waitForTimeout: (ms) => {
        calls.push(['waitForTimeout', ms]);
        return Promise.resolve();
      },
    };
  };

  it('waits for the explain face or a tooltip to be visible with a 5 s cap, then settles briefly', async () => {
    const page = fakePage(true);
    await expect(waitForFace(page)).resolves.toBe(true);
    expect(FACE).toBe('[data-slot=explain-content]:visible, [role=tooltip]:visible');
    expect(page.calls).toEqual([['waitForSelector', FACE, { state: 'visible', timeout: 5000 }], ['waitForTimeout', 250]]);
  });

  it('falls back to a short fixed wait, without throwing, when the hovered element opens no face', async () => {
    const page = fakePage(false);
    await expect(waitForFace(page)).resolves.toBe(false);
    expect(page.calls[1]).toEqual(['waitForTimeout', 500]);
    const custom = fakePage(false);
    await waitForFace(custom, { timeout: 1000, fallback: 50 });
    expect(custom.calls).toEqual([['waitForSelector', FACE, { state: 'visible', timeout: 1000 }], ['waitForTimeout', 50]]);
  });
});

describe('passwordFor', () => {
  it('prefers DESIGN_SHOTS_PASSWORD, uses the seed password only for local hosts, and otherwise throws without echoing a value', () => {
    expect(passwordFor('fas-caspilot-data.vercel.app', { DESIGN_SHOTS_PASSWORD: 'from-env' })).toBe('from-env');
    expect(passwordFor('127.0.0.1', { DESIGN_SHOTS_PASSWORD: 'from-env' })).toBe('from-env');
    for (const host of LOCAL_HOSTS) expect(passwordFor(host, {})).toBe('testpass123');
    expect(passwordFor('localhost', { DESIGN_SHOTS_PASSWORD: '' })).toBe('testpass123');
    let err;
    try {
      passwordFor('fas-caspilot-data.vercel.app', { OTHER: 'value' });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('DESIGN_SHOTS_PASSWORD is not set and fas-caspilot-data.vercel.app is not a local host');
    expect(err.message).not.toMatch(/testpass|value/);
  });

  it('stops main() before any browser or network work when a remote base has no password', async () => {
    await expect(main([...base, '--base', 'https://fas-caspilot-data.vercel.app'], {})).rejects.toThrow('DESIGN_SHOTS_PASSWORD is not set');
  });
});

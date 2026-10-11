import { describe, expect, it } from 'vitest';
import { JOBS, args, bf2017Checks, childEnv, desk, evidenceDir, keyState, main, pick, planMarkdown, preflight } from './bf2017-desk.mjs';

const SECRET = 'sb_secret_do_not_print_0123456789';

describe("lane W's desktop jobs", () => {
  it('has a script for every job the workflow offers', async () => {
    const { readFileSync, existsSync } = await import('node:fs');
    const yml = readFileSync(new URL('../../.github/workflows/bf2017-desktop.yml', import.meta.url), 'utf8');
    expect(yml).toMatch(/runs-on: \[self-hosted, gpu\]/);
    for (const j of JOBS) {
      expect(yml).toContain(j);
      expect(existsSync(new URL(`./bf2017-${j}.mjs`, import.meta.url))).toBe(true);
    }
    expect(evidenceDir('gate')).toBe('docs/superpowers/evidence/bf2017-picture/gate');
    expect(evidenceDir('atlases')).toBe('docs/superpowers/evidence/bf2017-picture/w/atlases');
  });

  it("reads the command line: --dry, --only words, --limit, --no-pr, --out", () => {
    expect(args(['--dry', '--only', 'Hoth, endor', '--limit', '3', '--out', '/tmp/x'])).toEqual({ dry: true, only: ['hoth', 'endor'], limit: 3, noPr: false, out: '/tmp/x' });
    expect(args([])).toEqual({ dry: false, only: [], limit: 0, noPr: false, out: null });
    const items = ['hoth/a', 'endor/b', 'naboo/c', 'hoth/d'].map((name) => ({ name }));
    expect(pick(items, { only: ['hoth'], limit: 1 })).toEqual([{ name: 'hoth/a' }]);
    expect(pick(items, {})).toHaveLength(4);
  });

  it('finds the export where the runner says, its tools beside it', () => {
    const d = desk({ BF2_EXPORT: '/x/BF2_Extract', PYTHON: 'py' });
    expect(d.web).toMatch(/BF2_Extract[\\/]web$/);
    expect(d.tool).toMatch(/BF2_Extract[\\/]tool$/);
    expect(d.python).toBe('py');
  });

  it('says whether the keys are there, never what they are', () => {
    const env = { SUPABASE_URL: 'https://abcdefgh.supabase.co', SUPABASE_SERVICE_KEY: SECRET };
    expect(keyState(env)).toEqual({ url: true, key: true, project: 'abcdefgh' });
    expect(keyState({})).toEqual({ url: false, key: false, project: null });
    const checks = preflight([{ name: 'keys', keys: true, fix: 'set them' }], env);
    const md = planMarkdown('x', { dry: true, items: [], checks });
    expect(md).not.toContain(SECRET);
    expect(md).toContain('key set');
    // (a child gets the key under both names the scripts read)
    expect(childEnv(env)).toMatchObject({ SUPA_KEY: SECRET, SUPABASE_SERVICE_KEY: SECRET });
    expect(childEnv({ SUPA_KEY: 'k' }).SUPABASE_SERVICE_KEY).toBe('k');
  });

  it('checks files, commands and keys, each with its fix when missing', () => {
    const io = { exists: (f) => f === '/there', which: (c) => c === 'texconv' };
    const c = preflight([{ name: 'a', file: '/there' }, { name: 'b', file: '/gone', fix: 'make it' }, { name: 'c', cmd: 'texconv' }, { name: 'd', cmd: 'toktx', fix: 'install it' }], {}, io);
    expect(c.map((x) => x.ok)).toEqual([true, false, true, false]);
    expect(c[1].fix).toBe('make it');
    expect(c[0].fix).toBeUndefined();
  });

  it("gives the doctor every tool and file the jobs need", () => {
    const names = bf2017Checks({ BF2_EXPORT: '/none' }, { exists: () => false, which: () => false }).map((c) => c.name);
    for (const want of ['ktx2_encode', 'upload_supabase', 'bf2export', 'texconv', 'toktx', 'ffmpeg', "bucket's keys", 'Chrome', 'shaderdepots']) expect(names.join(' | ')).toContain(want);
  });

  it('writes the plan as a table, cut at forty rows', () => {
    const items = Array.from({ length: 45 }, (_, i) => ({ name: `t${i}`, size: '1×1' }));
    const md = planMarkdown('textures', { dry: true, items, checks: [], notes: ['a note'], columns: ['name', 'size'] });
    expect(md).toMatch(/^## bf2017 textures \(dry run: nothing made\)/);
    expect(md).toContain('- a note');
    expect(md).toContain('45 items.');
    expect(md).toContain('| … 5 more |');
  });
  it('stops a real run before anything is made when the machine lacks a need', async () => {
    let made = false;
    const spec = { job: 'x', title: 'x', needs: () => [{ name: 'the export', file: '/no/such/export', fix: 'set BF2_EXPORT' }], plan: async () => ({ items: [] }), run: async () => (made = true) };
    await expect(main(spec, [], {})).rejects.toThrow(/missing on this machine: the export/);
    expect(made).toBe(false);
  });
});

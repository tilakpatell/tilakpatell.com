import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { plan, putAll, stateLines } from './bucket-put.mjs';
import { ENDPOINT } from './lib/bucket.mjs';

const dirs = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
function tree(files) {
  const d = mkdtempSync(join(tmpdir(), 'bucket-put-'));
  dirs.push(d);
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(d, path, '..'), { recursive: true });
    writeFileSync(join(d, path), body);
  }
  return d;
}
// a pool over a bucket kept in a Map: a HEAD says its size, a PUT stores it
function fakePool(stored = {}, { refuse = [] } = {}) {
  const asked = [];
  return {
    asked,
    stored,
    run: async (job) => {
      const key = decodeURIComponent(job.url.slice(`${ENDPOINT}/bf2017-assets/`.length));
      asked.push([job.method, key, job.fetch, job.headers?.['content-type']]);
      if (job.method === 'HEAD') return key in stored ? { status: 'fetched', headers: new Headers({ 'content-length': String(stored[key]) }) } : { status: 'missing' };
      if (refuse.includes(key)) return { status: 'failed', error: 'HTTP 403' };
      stored[key] = job.body.length;
      return { status: 'fetched', headers: new Headers() };
    },
  };
}
const signs = async () => new Response(null);

describe('the plan', () => {
  it('puts the prefix before each path, as the export lists them (a Windows path too), blank lines dropped', () => {
    expect(plan(['textures/a.ktx2', 'textures\\b.ktx2\r', '', '/maps/c.png'], 'web/')).toEqual([
      { path: 'textures/a.ktx2', key: 'web/textures/a.ktx2' },
      { path: 'textures/b.ktx2', key: 'web/textures/b.ktx2' },
      { path: 'maps/c.png', key: 'web/maps/c.png' },
    ]);
  });

  it("reads the record's paths, its first column", () => {
    expect(stateLines('web/a.ktx2\t10\nweb/b.ktx2\t20\n')).toEqual(new Set(['web/a.ktx2', 'web/b.ktx2']));
  });
});

describe('putAll', () => {
  it('sends what R2 lacks or holds at another size, skips what it holds, signs each, and records what is there', async () => {
    const root = tree({ 'textures/a.ktx2': 'aaaa', 'textures/b.ktx2': 'bb', 'textures/c.png': 'ccc' });
    const pool = fakePool({ 'web/textures/b.ktx2': 2, 'web/textures/c.png': 1 });
    const r = await putAll({ root, items: plan(['textures/a.ktx2', 'textures/b.ktx2', 'textures/c.png', 'textures/gone.ktx2'], 'web/'), pool, fetch: signs, bucket: 'bf2017-assets', log: () => {} });
    expect(r).toMatchObject({ sent: 2, there: 1 });
    expect(r.failed).toEqual([{ path: 'textures/gone.ktx2', error: 'not on disk' }]);
    expect(r.lines.sort()).toEqual(['web/textures/a.ktx2\t4', 'web/textures/b.ktx2\t2', 'web/textures/c.png\t3']);
    expect(pool.asked.filter(([m]) => m === 'PUT').map(([, k, , type]) => [k, type])).toEqual([
      ['web/textures/a.ktx2', 'image/ktx2'],
      ['web/textures/c.png', 'image/png'],
    ]);
    expect(pool.asked.every(([, , fetch]) => fetch === signs)).toBe(true);
  });

  it('leaves a refused file out of the record, and says so', async () => {
    const root = tree({ 'a.ktx2': 'a' });
    const said = [];
    const r = await putAll({ root, items: plan(['a.ktx2'], 'web/'), pool: fakePool({}, { refuse: ['web/a.ktx2'] }), fetch: signs, bucket: 'bf2017-assets', log: (s) => said.push(s) });
    expect(r.failed).toEqual([{ path: 'a.ktx2', error: 'HTTP 403' }]);
    expect(r.lines).toEqual([]);
    expect(said.join('\n')).toMatch(/failed web\/a\.ktx2/);
  });
});

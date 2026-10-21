import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CACHE, ensureBucket, publish } from './assets-publish.mjs';
import { ENDPOINT } from './lib/bucket.mjs';

const dirs = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
function pub(files) {
  const d = mkdtempSync(join(tmpdir(), 'publish-'));
  dirs.push(d);
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(d, path, '..'), { recursive: true });
    writeFileSync(join(d, path), body);
  }
  return d;
}
// a pool that answers from the bucket it keeps, and writes down what it was asked
function fakePool(stored = {}, { refuse = [] } = {}) {
  const asked = [];
  return {
    asked,
    stored,
    run: async (job) => {
      asked.push([job.method, job.url, job.fetch]);
      const key = decodeURIComponent(job.url.split(/\/tilak-assets\//)[1]);
      if (job.method === 'HEAD') return key in stored ? { status: 'fetched', headers: new Headers({ 'content-length': String(stored[key]) }) } : { status: 'missing' };
      if (refuse.some((r) => key.includes(r))) return { status: 'failed', error: 'HTTP 413' };
      stored[key] = job.body.length;
      return { status: 'fetched', headers: new Headers(), cache: job.headers['cache-control'], type: job.headers['content-type'] };
    },
  };
}
const signs = async () => new Response(null);
const f = (path, hash, bytes) => ({ path, hash, bytes, from: 'x', tier: 'crew' });

describe('the publish', () => {
  it('sends what is new, skips a hash the bucket holds, and names in the manifest only what is up there', async () => {
    const publicDir = pub({ 'models/galaxy/crew/a.glb': 'aaaa', 'models/galaxy/crew/b.glb': 'bb', 'models/galaxy/crew/c.glb': 'ccc' });
    const pool = fakePool({ '222222222222/models/galaxy/crew/b.glb': 2 }, { refuse: ['c.glb'] });
    const manifest = { 'models/galaxy/crew/old.glb': { hash: '000000000000', bytes: 1, from: 'x', tier: 'crew' } };
    const r = await publish({ files: [f('models/galaxy/crew/a.glb', '111111111111', 4), f('models/galaxy/crew/b.glb', '222222222222', 2), f('models/galaxy/crew/c.glb', '333333333333', 3)], manifest, pool, fetch: signs, publicDir, log: () => {} });
    expect(r.sent).toBe(1);
    expect(r.there).toBe(1);
    expect(r.failed.map((x) => x.path)).toEqual(['models/galaxy/crew/c.glb']);
    expect(Object.keys(r.manifest).sort()).toEqual(['models/galaxy/crew/a.glb', 'models/galaxy/crew/b.glb', 'models/galaxy/crew/old.glb']);
    expect(pool.asked.filter(([m]) => m === 'PUT').map(([, u]) => u)).toEqual([`${ENDPOINT}/tilak-assets/111111111111/models/galaxy/crew/a.glb`, `${ENDPOINT}/tilak-assets/333333333333/models/galaxy/crew/c.glb`]);
    // (asked of R2 itself, signed, whether it is there: never the public domain, whose cache would keep a "not there")
    expect(pool.asked.filter(([m]) => m === 'HEAD').every(([, u, fetch]) => u.startsWith(`${ENDPOINT}/tilak-assets/`) && fetch === signs)).toBe(true);
    expect(pool.asked.every(([, , fetch]) => fetch === signs)).toBe(true);
  });

  it('uploads with a year’s cache and the right type', async () => {
    const publicDir = pub({ 'models/galaxy/crew/a.glb': 'aaaa' });
    let seen = null;
    const pool = { run: async (job) => (job.method === 'HEAD' ? { status: 'missing' } : ((seen = job.headers), { status: 'fetched' })) };
    await publish({ files: [f('models/galaxy/crew/a.glb', '111111111111', 4)], manifest: {}, pool, fetch: signs, publicDir, log: () => {} });
    expect(seen['cache-control']).toBe(CACHE);
    expect(CACHE).toMatch(/max-age=31536000/);
    expect(seen['content-type']).toBe('model/gltf-binary');
  });

  it('asks R2 the bucket is there, and says so when it isn’t', async () => {
    const calls = [];
    const fetch = async (url, init = {}) => (calls.push([init.method, url]), new Response(null, { status: 200 }));
    await ensureBucket('tilak-assets', fetch);
    expect(calls).toEqual([['HEAD', `${ENDPOINT}/tilak-assets`]]);
    await expect(ensureBucket('tilak-assets', async () => new Response(null, { status: 404 }))).rejects.toThrow(/isn't on R2/);
    await expect(ensureBucket('tilak-assets', async () => new Response(null, { status: 403 }))).rejects.toThrow(/HTTP 403/);
  });
});

describe('--only', () => {
  it('takes any of its comma-separated globs, a star crossing folders', async () => {
    const { onlyMatch } = await import('./assets-publish.mjs');
    const m = onlyMatch('models/galaxy/bf2017/crew/clone.glb,models/galaxy/bf2017/crew/rebel.glb');
    expect(m('models/galaxy/bf2017/crew/clone.glb')).toBe(true);
    expect(m('models/galaxy/bf2017/crew/rebel.glb')).toBe(true);
    expect(m('models/galaxy/bf2017/crew/clone.lod1.glb')).toBe(false);
    expect(onlyMatch('models/*.ultra.glb')('models/galaxy/bf2017/crew/luke.ultra.glb')).toBe(true);
  });
});

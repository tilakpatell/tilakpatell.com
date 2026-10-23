import { describe, expect, it } from 'vitest';
import { compare, mirror, plan, readList } from './assets-mirror.mjs';
import { ENDPOINT } from './lib/bucket.mjs';

const FROM = 'https://p.supabase.co/storage/v1/object/public/site-assets';
const signs = async () => new Response(null);

// a pool over two stores in Maps: R2 (by the signed fetch) and the public source
function fakePool({ r2 = {}, source = {}, refuse = [] } = {}) {
  const asked = [];
  return {
    asked,
    r2,
    run: async (job) => {
      const onR2 = job.url.startsWith(`${ENDPOINT}/`);
      const key = decodeURIComponent(onR2 ? job.url.slice(`${ENDPOINT}/tilak-assets/`.length) : job.url.slice(`${FROM}/`.length));
      asked.push([job.method ?? 'GET', onR2 ? 'r2' : 'source', key, job.fetch === signs, job.headers]);
      if (onR2 && job.method === 'HEAD') return key in r2 ? { status: 'fetched', headers: new Headers({ 'content-length': String(r2[key]) }) } : { status: 'missing', http: 404 };
      if (onR2) {
        if (refuse.includes(key)) return { status: 'failed', error: 'HTTP 403' };
        r2[key] = job.body.length;
        return { status: 'fetched', headers: new Headers() };
      }
      if (!(key in source)) return { status: 'missing', http: 404 };
      return { status: 'fetched', body: Buffer.alloc(source[key]), headers: new Headers({ 'content-type': key.endsWith('.ktx2') ? 'image/ktx2' : '' }) };
    },
  };
}

describe('the plan', () => {
  it('names each file the manifests give once, at `<hash>/<path>`, by key', () => {
    const galaxy = { 'models/b.glb': { hash: 'bbbbbbbbbbbb', bytes: 2 }, '/models/a.glb': { hash: 'aaaaaaaaaaaa', bytes: 1 } };
    const mirrorM = { 'models/a.glb': { hash: 'aaaaaaaaaaaa', bytes: 1 } };
    expect(plan([galaxy, mirrorM])).toEqual([
      { key: 'aaaaaaaaaaaa/models/a.glb', bytes: 1 },
      { key: 'bbbbbbbbbbbb/models/b.glb', bytes: 2 },
    ]);
  });
});

describe('mirror', () => {
  it('leaves what R2 holds at its size, fetches the rest and puts it signed, with its type and a year', async () => {
    const pool = fakePool({ r2: { 'aaaaaaaaaaaa/a.glb': 3, 'bbbbbbbbbbbb/b.glb': 1 }, source: { 'bbbbbbbbbbbb/b.glb': 2, 'cccccccccccc/c.ktx2': 4 } });
    const items = [
      { key: 'aaaaaaaaaaaa/a.glb', bytes: 3 },
      { key: 'bbbbbbbbbbbb/b.glb', bytes: 2 },
      { key: 'cccccccccccc/c.ktx2', bytes: 4 },
    ];
    const r = await mirror({ items, from: FROM, pool, fetch: signs, bucket: 'tilak-assets', log: () => {} });
    expect(r).toMatchObject({ sent: 2, there: 1, failed: [], bytes: 6 });
    const puts = pool.asked.filter(([m]) => m === 'PUT');
    expect(puts.map(([, , k, signed, h]) => [k, signed, h['content-type'], h['cache-control']])).toEqual([
      ['bbbbbbbbbbbb/b.glb', true, 'model/gltf-binary', 'public, max-age=31536000, immutable'],
      ['cccccccccccc/c.ktx2', true, 'image/ktx2', 'public, max-age=31536000, immutable'],
    ]);
    expect(pool.asked.filter(([, where]) => where === 'source').every(([m, , , signed]) => m === 'GET' && !signed)).toBe(true);
  });

  it('says a file missing at the source, one of another size, and one R2 refused, and puts none of them', async () => {
    const pool = fakePool({ source: { 'b/short.glb': 1, 'c/refused.glb': 2 }, refuse: ['c/refused.glb'] });
    const items = [
      { key: 'a/gone.glb', bytes: 1 },
      { key: 'b/short.glb', bytes: 5 },
      { key: 'c/refused.glb', bytes: 2 },
    ];
    const r = await mirror({ items, from: FROM, pool, fetch: signs, bucket: 'tilak-assets', log: () => {} });
    expect(r.sent).toBe(0);
    expect(r.failed).toEqual([
      { key: 'a/gone.glb', error: 'missing at the source (HTTP 404)' },
      { key: 'b/short.glb', error: '1 bytes at the source, the list says 5' },
      { key: 'c/refused.glb', error: 'HTTP 403' },
    ]);
    expect(Object.keys(pool.r2)).toEqual([]);
  });
});

describe('a list in place of the manifests', () => {
  it('reads key, bytes and an address of its own, each key once, by key', () => {
    const text = 'web/b.glb\t2\thttps://p.supabase.co/storage/v1/object/sign/bf2017-assets/web/b.glb?token=t\r\nweb/a.json\t0\n\nweb/b.glb\t2\thttps://x/again\n';
    expect(readList(text)).toEqual([
      { key: 'web/a.json', bytes: 0 },
      { key: 'web/b.glb', bytes: 2, url: 'https://x/again' },
    ]);
  });

  it('says which names R2 lacks and which it holds at another size', () => {
    const items = [{ key: 'a', bytes: 1 }, { key: 'b', bytes: 2 }, { key: 'c', bytes: 3 }];
    const held = new Map([['a', 1], ['b', 9], ['z', 4]]);
    expect(compare(items, held)).toEqual({ missing: [{ key: 'c', bytes: 3 }], other: [{ key: 'b', bytes: 2 }] });
  });

  it('fetches a file at its own address, puts it with no cache when told, and never asks for an empty one', async () => {
    const asked = [];
    const pool = {
      run: async (job) => {
        asked.push([job.method ?? 'GET', job.url, job.headers]);
        if (job.method === 'HEAD') return { status: 'missing', http: 404 };
        if (job.method === 'PUT') return { status: 'fetched', headers: new Headers() };
        return { status: 'fetched', body: Buffer.alloc(2), headers: new Headers({ 'content-type': 'model/gltf-binary' }) };
      },
    };
    const items = [{ key: 'web/a.json', bytes: 0 }, { key: 'web/b.glb', bytes: 2, url: 'https://signed.example/b?token=t' }];
    const r = await mirror({ items, pool, fetch: signs, bucket: 'bf2017-assets', cache: null, log: () => {} });
    expect(r).toMatchObject({ sent: 2, failed: [] });
    expect(asked.filter(([m]) => m === 'GET').map(([, u]) => u)).toEqual(['https://signed.example/b?token=t']);
    const puts = asked.filter(([m]) => m === 'PUT');
    expect(puts.map(([, u]) => u)).toEqual([`${ENDPOINT}/bf2017-assets/web/a.json`, `${ENDPOINT}/bf2017-assets/web/b.glb`]);
    expect(puts.every(([, , h]) => !('cache-control' in h))).toBe(true);
    expect(puts[1][2]['content-type']).toBe('model/gltf-binary');
  });
});

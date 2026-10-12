// public/sw.js itself, run in a bare context with a CacheStorage in memory:
// what it answers from an installed pack, and what it leaves alone.
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const CODE = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
const BASE = 'https://proj.supabase.co/storage/v1/object/public/assets';
const FAR = `${BASE}/aaaaaaaaaaaa/kit/crate.glb`;

function cachesOf(all) {
  return {
    keys: async () => Object.keys(all),
    open: async (name) => ({
      keys: async () => Object.keys(all[name]).map((url) => ({ url })),
      match: async (req) => {
        const body = all[name][typeof req === 'string' ? req : req.url];
        return body === undefined ? undefined : new Response(body);
      },
    }),
  };
}

// the worker, started with or without a base, and its caches read
async function worker(base) {
  const on = {};
  const where = `https://site.test/sw.js${base ? `?base=${encodeURIComponent(base)}` : ''}`;
  const self = { location: new URL(where), addEventListener: (type, fn) => (on[type] = fn), skipWaiting() {}, clients: { claim() {} } };
  const caches = cachesOf({
    'tp-pack-kit-v1': { [FAR]: 'crate from the pack', 'https://site.test/kit/house.glb': 'house from the pack', 'https://site.test/packs/kit.json?v=v1': '{}' },
  });
  const fetch = vi.fn(async (req) => {
    if (req === '/packs/index.json') return Response.json({ '/kit': { slug: 'kit', bytes: 1, v: 'v1' } });
    return new Response('from the network');
  });
  vm.runInNewContext(CODE, { self, caches, fetch, URL, Response, Map, Date, Promise, Object, console });
  const waits = [];
  on.message({ data: { type: 'tp-packs' }, waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
  // what the page's fetch of a URL gets: the worker's answer, or 'left alone'
  const ask = async (url) => {
    let answer = null;
    on.fetch({ request: new Request(url), respondWith: (p) => (answer = p) });
    return answer ? (await answer).text() : 'left alone';
  };
  return { ask, fetch };
}

describe('the service worker and the asset bucket', () => {
  it('answers an installed pack’s bucket file from its cache', async () => {
    const { ask } = await worker(BASE);
    expect(await ask(FAR)).toBe('crate from the pack');
  });

  it('answers the site’s path of that file from the same copy, after the visit fell back', async () => {
    const { ask } = await worker(BASE);
    expect(await ask('https://site.test/kit/crate.glb')).toBe('crate from the pack');
    expect(await ask('https://site.test/kit/house.glb')).toBe('house from the pack');
  });

  it('leaves alone every other bucket file, the project’s API and any other origin', async () => {
    const { ask, fetch } = await worker(BASE);
    expect(await ask(`${BASE}/bbbbbbbbbbbb/kit/other.glb`)).toBe('left alone');
    expect(await ask('https://proj.supabase.co/rest/v1/rpc/get_entities_in_bounding_box')).toBe('left alone');
    expect(await ask(`${FAR}?x=1`)).toBe('left alone');
    expect(await ask('https://elsewhere.test/kit/crate.glb')).toBe('left alone');
    expect(fetch.mock.calls.filter(([r]) => r !== '/packs/index.json')).toEqual([]);
  });

  it('without a base, touches no other origin, the bucket included', async () => {
    const { ask } = await worker('');
    expect(await ask(FAR)).toBe('left alone');
    expect(await ask('https://site.test/kit/house.glb')).toBe('house from the pack');
  });
});

// (lane N4) the played world's files, kept as fetched under a cap
describe('the service worker and the world being played', () => {
  const hothFile = (n) => `${BASE}/${String(n).padStart(12, 'a')}/models/galaxy/bf2017/levels/hoth/meshes/m${n}.glb`;
  const endorFile = `${BASE}/bbbbbbbbbbbb/models/galaxy/bf2017/levels/endor/meshes/tree.glb`;
  function playCaches() {
    const all = {};
    return {
      all,
      keys: async () => Object.keys(all),
      delete: async (name) => delete all[name],
      open: async (name) => {
        all[name] ??= {};
        return {
          keys: async () => Object.keys(all[name]).map((url) => ({ url })),
          match: async (req) => {
            const got = all[name]?.[typeof req === 'string' ? req : req.url];
            return got ? new Response(got.body, { headers: got.headers }) : undefined;
          },
          put: async (req, res) => {
            all[name][typeof req === 'string' ? req : req.url] = { body: await res.text(), headers: Object.fromEntries(res.headers) };
          },
        };
      },
    };
  }
  async function player({ sizes = {} } = {}) {
    const on = {};
    const self = { location: new URL(`https://site.test/sw.js?base=${encodeURIComponent(BASE)}`), addEventListener: (type, fn) => (on[type] = fn), skipWaiting() {}, clients: { claim() {} } };
    const caches = playCaches();
    const fetch = vi.fn(async (req) => {
      if (req === '/packs/index.json') return Response.json({});
      const url = typeof req === 'string' ? req : req.url;
      return new Response(`bytes of ${url.split('/').pop()}`, { headers: sizes[url] ? { 'content-length': String(sizes[url]) } : {} });
    });
    vm.runInNewContext(CODE, { self, caches, fetch, URL, Response, Map, Date, Promise, Object, JSON, Number, console });
    const settle = async (event) => {
      const waits = [];
      on.message({ ...event, waitUntil: (p) => waits.push(p) });
      await Promise.all(waits);
    };
    const ask = async (url) => {
      let answer = null;
      const waits = [];
      on.fetch({ request: new Request(url), respondWith: (p) => (answer = p), waitUntil: (p) => waits.push(p) });
      const text = answer ? await (await answer).text() : 'left alone';
      await Promise.all(waits);
      return text;
    };
    const asked = (url) => fetch.mock.calls.filter(([r]) => (typeof r === 'string' ? r : r.url) === url).length;
    return { ask, asked, caches, play: (world) => settle({ data: { type: 'tp-play', world } }) };
  }

  it('keeps the played world’s hashed files as they are fetched, and answers them from the cache after', async () => {
    const p = await player();
    await p.play('hoth');
    expect(await p.ask(hothFile(1))).toBe('bytes of m1.glb');
    expect(await p.ask(hothFile(1))).toBe('bytes of m1.glb');
    expect(p.asked(hothFile(1))).toBe(1);
    expect(Object.keys(p.caches.all)).toContain('tp-play-hoth');
  });

  it('keeps nothing of a world not being played, nor the site’s own (unhashed) paths', async () => {
    const p = await player();
    await p.play('hoth');
    await p.ask(endorFile);
    await p.ask('https://site.test/models/galaxy/bf2017/levels/hoth/far.bin');
    expect(p.caches.all['tp-play-endor']).toBeUndefined();
    expect(Object.keys(p.caches.all['tp-play-hoth'] ?? {})).toEqual([]);
  });

  it('takes a district’s world as its world', async () => {
    const p = await player();
    await p.play('endor/bunker');
    expect(await p.ask(endorFile)).toBe('bytes of tree.glb');
    expect(Object.keys(p.caches.all['tp-play-endor'])).toEqual([endorFile]);
  });

  it('lets the least recently played world go, whole, past 400 MB', async () => {
    const big = { [hothFile(1)]: 300e6, [endorFile]: 200e6 };
    const p = await player({ sizes: big });
    await p.play('hoth');
    await p.ask(hothFile(1));
    await p.play('endor');
    await p.ask(endorFile);
    expect(p.caches.all['tp-play-hoth']).toBeUndefined();
    expect(Object.keys(p.caches.all['tp-play-endor'])).toEqual([endorFile]);
  });

  it('keeps no more of one world than the cap holds', async () => {
    const p = await player({ sizes: { [hothFile(1)]: 350e6, [hothFile(2)]: 100e6 } });
    await p.play('hoth');
    await p.ask(hothFile(1));
    await p.ask(hothFile(2));
    expect(Object.keys(p.caches.all['tp-play-hoth'])).toEqual([hothFile(1)]);
  });
});

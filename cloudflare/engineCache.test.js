import { describe, expect, it } from 'vitest';
import { WORKER_SOURCE, cacheKeep, engineWorker, registerEngineCache } from './engineCache.js';

const ORIGIN = 'https://tilakpatell.com';

// a service worker's bones: its listeners, Cache Storage by name, the network counted
function worker(network = (url) => ({ status: 200, body: `bytes of ${url}` })) {
  const on = {};
  const stores = new Map();
  const asked = [];
  const response = (r) => ({ ...r, clone: () => ({ ...r }) });
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type, fn) => (on[type] = fn),
    skipWaiting: () => {},
    clients: { claim: async () => {} },
    fetch: async (request) => (asked.push(request.url), response(network(request.url))),
    caches: {
      open: async (name) => {
        if (!stores.has(name)) stores.set(name, new Map());
        const store = stores.get(name);
        return { match: async (r) => store.get(r.url) ?? null, put: async (r, res) => void store.set(r.url, res) };
      },
      keys: async () => [...stores.keys()],
      delete: async (name) => stores.delete(name),
    },
  };
  engineWorker(self, cacheKeep);
  // one fetch event: what respondWith was given, once the waitUntil work is done
  const get = async (path, { mode = 'cors', method = 'GET', headers = {} } = {}) => {
    let answer = null;
    const waits = [];
    const request = { url: ORIGIN + path, method, mode, headers: new Headers(headers) };
    on.fetch({ request, respondWith: (p) => (answer = p), waitUntil: (p) => waits.push(p) });
    const res = answer && (await answer);
    await Promise.all(waits);
    return res;
  };
  return { on, stores, asked, get };
}

describe('the engine’s build kept on the visitor’s disk', () => {
  it('keeps a build’s own files, not its page, the roots outside it, or the worker itself', () => {
    expect(cacheKeep('/battlefront/engine/main-da7a51b3/scene-t-1.pixels')).toEqual({ build: 'main-da7a51b3', path: 'scene-t-1.pixels' });
    expect(cacheKeep('/battlefront/engine/main-da7a51b3/runtime/world-play.mjs').path).toBe('runtime/world-play.mjs');
    for (const p of ['/battlefront/engine/main-da7a51b3/', '/battlefront/engine/main-da7a51b3/index.html', '/battlefront/engine/sw.js', '/ui/main.js', '/export/strings/English.json', '/battlefront/hoth'])
      expect(cacheKeep(p)).toBeNull();
  });

  it('answers a file from disk after the first time, asking the network once', async () => {
    const w = worker();
    const path = '/battlefront/engine/main-da7a51b3/scene-r-0.res';
    expect((await w.get(path)).body).toBe(`bytes of ${ORIGIN}${path}`);
    expect((await w.get(path)).body).toBe(`bytes of ${ORIGIN}${path}`);
    expect(w.asked).toEqual([ORIGIN + path]);
    expect([...w.stores.keys()]).toEqual(['tp-engine-main-da7a51b3']);
  });

  it('leaves the page, ranges, other methods, other roots and a failed answer alone', async () => {
    const w = worker((url) => ({ status: url.endsWith('missing.res') ? 404 : 200, body: 'x' }));
    expect(await w.get('/battlefront/engine/main-da7a51b3/', { mode: 'navigate' })).toBeNull();
    expect(await w.get('/battlefront/engine/main-da7a51b3/scene-r-0.res', { headers: { range: 'bytes=0-9' } })).toBeNull();
    expect(await w.get('/battlefront/engine/main-da7a51b3/scene-r-0.res', { method: 'HEAD' })).toBeNull();
    expect(await w.get('/export/movies/UI/Video/Tiles/LootBox.webm')).toBeNull();
    await w.get('/battlefront/engine/main-da7a51b3/missing.res');
    await w.get('/battlefront/engine/main-da7a51b3/missing.res');
    expect(w.asked).toHaveLength(2);
  });

  it('keeps one build: a newer one kept, the older ones go', async () => {
    const w = worker();
    await w.get('/battlefront/engine/main-da7a51b3/a.res');
    await w.get('/battlefront/engine/main-f675e260/a.res');
    expect([...w.stores.keys()]).toEqual(['tp-engine-main-f675e260']);
  });

  it('is registered by the page for its scope, the storage asked to be kept', async () => {
    const calls = [];
    registerEngineCache({ navigator: { serviceWorker: { register: async (...a) => calls.push(a) }, storage: { persist: async () => calls.push(['persist']) } } });
    await Promise.resolve();
    expect(calls).toEqual([['/battlefront/engine/sw.js', { scope: '/battlefront/engine/' }], ['persist']]);
    expect(() => registerEngineCache({ navigator: {} })).not.toThrow();
  });

  it('runs as the browser runs it, from its source text alone', async () => {
    const on = {};
    new Function('self', WORKER_SOURCE)({ location: { origin: ORIGIN }, addEventListener: (t, fn) => (on[t] = fn) });
    expect(Object.keys(on).sort()).toEqual(['activate', 'fetch', 'install']);
  });
});

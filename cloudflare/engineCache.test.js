import { describe, expect, it, vi } from 'vitest';
import { FILES, WORKER_SOURCE, cacheKeep, engineWorker, following, registerEngineCache, warmEngineBuild, warmOrder } from './engineCache.js';

const ORIGIN = 'https://tilakpatell.com';

// a service worker's bones: its listeners, Cache Storage by name, the network counted (the build's list apart)
const urlOf = (r) => (typeof r === 'string' ? r : r.url);
function worker(network = (url) => ({ status: 200, body: `bytes of ${url}` }), files = null) {
  const on = {};
  const stores = new Map();
  const asked = [];
  const response = (r) => ({ ...r, clone: () => ({ ...r }) });
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type, fn) => (on[type] = fn),
    skipWaiting: () => {},
    clients: { claim: async () => {} },
    fetch: async (request) => {
      const url = urlOf(request);
      if (url.endsWith('/' + FILES)) return files ? { status: 200, json: async () => ({ files }) } : { status: 404 };
      asked.push(url);
      return response(await network(url));
    },
    caches: {
      open: async (name) => {
        if (!stores.has(name)) stores.set(name, new Map());
        const store = stores.get(name);
        return { match: async (r) => store.get(urlOf(r)) ?? null, put: async (r, res) => void store.set(urlOf(r), res) };
      },
      keys: async () => [...stores.keys()],
      delete: async (name) => stores.delete(name),
    },
  };
  engineWorker(self, cacheKeep, following);
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
  return { on, stores, asked, get, self };
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

  it.each(['open', 'match'])('still loads an engine asset from the network when Cache Storage %s fails', async (operation) => {
    const w = worker();
    const unavailable = async () => { throw new Error('Cache Storage unavailable'); };
    w.self.caches.open = operation === 'open' ? unavailable : async () => ({ match: unavailable, put: unavailable });
    const path = '/battlefront/engine/main-da7a51b3/scene-r-0.res';
    for (let i = 0; i < 2; i++) expect((await w.get(path)).body).toBe(`bytes of ${ORIGIN}${path}`);
    expect(w.asked).toEqual([ORIGIN + path, ORIGIN + path]);
  });

  it('reports a failed warm without downloading a file it cannot cache', async () => {
    const w = worker();
    w.self.caches.open = async () => { throw new Error('Cache Storage unavailable'); };
    expect((await w.get('/battlefront/engine/main-da7a51b3/scene-r-0.res', { headers: { 'x-tp-warm': '1' } })).status).toBe(502);
    expect(w.asked).toEqual([]);
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

  it('reads the build’s numbered series, each file followed by the next few of its own', () => {
    const next = following(['scene.json', 'scene-t-0.dbx', 'scene-t-0.pixels', 'scene-t-1.dbx', 'scene-t-1.stored.pixels', 'scene-t-2.dbx', 'scene-t-2.pixels', 'scene-t-10.pixels', 'scene-terrain-tile-3_4.bfsw'], 2);
    expect(next.get('scene-t-0.dbx')).toEqual(['scene-t-1.dbx', 'scene-t-2.dbx']);
    // (a stored texture is a series of its own; a number's order, not its text's)
    expect(next.get('scene-t-0.pixels')).toEqual(['scene-t-2.pixels', 'scene-t-10.pixels']);
    expect(next.get('scene-t-1.stored.pixels')).toEqual([]);
    expect(next.has('scene.json')).toBe(false);
    expect(next.has('scene-terrain-tile-3_4.bfsw')).toBe(false);
  });

  it('fetches the next of a series onto the disk while the engine reads one, each once', async () => {
    const dir = '/battlefront/engine/main-da7a51b3/';
    const files = Array.from({ length: 12 }, (_, i) => `scene-m-${i}.res`);
    const w = worker(undefined, files);
    expect((await w.get(dir + 'scene-m-0.res')).body).toBe(`bytes of ${ORIGIN}${dir}scene-m-0.res`);
    expect(w.asked).toEqual(files.slice(0, 9).map((f) => ORIGIN + dir + f));
    // (the engine's next asks answered from the disk; each reads further ahead, nothing asked twice)
    for (const i of [1, 2, 3]) expect((await w.get(`${dir}scene-m-${i}.res`)).body).toBe(`bytes of ${ORIGIN}${dir}scene-m-${i}.res`);
    expect(w.asked).toEqual(files.map((f) => ORIGIN + dir + f));
  });

  it('has the engine wait for a file already on its way, rather than ask for it again', async () => {
    const dir = '/battlefront/engine/main-da7a51b3/';
    let release;
    const held = new Promise((r) => (release = r));
    const w = worker(async (url) => (url.endsWith('scene-p-1.dbx') && (await held), { status: 200, body: `bytes of ${url}` }), ['scene-p-0.dbx', 'scene-p-1.dbx']);
    const first = w.get(dir + 'scene-p-0.dbx');
    // (scene-p-1 read ahead with the first, its answer held; the engine asks for it meanwhile)
    while (!w.asked.some((u) => u.endsWith('scene-p-1.dbx'))) await new Promise((r) => setTimeout(r, 0));
    const second = w.get(dir + 'scene-p-1.dbx');
    release();
    await first;
    expect((await second).body).toBe(`bytes of ${ORIGIN}${dir}scene-p-1.dbx`);
    expect(w.asked.filter((u) => u.endsWith('scene-p-1.dbx'))).toHaveLength(1);
  });

  it('asks again for a dropped answer or a 503, and takes a 404 as the answer', async () => {
    vi.useFakeTimers();
    try {
      const dir = '/battlefront/engine/main-da7a51b3/';
      const tries = new Map();
      const w = worker((url) => {
        const n = (tries.get(url) ?? 0) + 1;
        tries.set(url, n);
        if (url.endsWith('flaky.res') && n === 1) throw new TypeError('Failed to fetch');
        if (url.endsWith('flaky.res') && n === 2) return { status: 503, body: 'Unavailable, try again' };
        if (url.endsWith('gone.res')) return { status: 404, body: 'Not found' };
        return { status: 200, body: `bytes of ${url}` };
      });
      const flaky = w.get(dir + 'flaky.res');
      await vi.runAllTimersAsync();
      expect((await flaky).body).toBe(`bytes of ${ORIGIN}${dir}flaky.res`);
      expect(tries.get(ORIGIN + dir + 'flaky.res')).toBe(3);
      const gone = w.get(dir + 'gone.res');
      await vi.runAllTimersAsync();
      expect((await gone).status).toBe(404);
      expect(tries.get(ORIGIN + dir + 'gone.res')).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('works as before without the build’s list', async () => {
    const w = worker();
    await w.get('/battlefront/engine/main-da7a51b3/scene-m-0.res');
    expect(w.asked).toEqual([ORIGIN + '/battlefront/engine/main-da7a51b3/scene-m-0.res']);
  });

  it('puts a warmed file on the disk and answers with no body, reading nothing ahead', async () => {
    const dir = '/battlefront/engine/main-da7a51b3/';
    const w = worker(undefined, ['scene-m-0.res', 'scene-m-1.res']);
    const warmed = await w.get(dir + 'scene-m-0.res', { headers: { 'x-tp-warm': '1' } });
    expect(warmed.status).toBe(204);
    expect(w.asked).toEqual([ORIGIN + dir + 'scene-m-0.res']);
    // (the engine's ask, after: the disk's)
    expect((await w.get(dir + 'scene-m-0.res')).body).toBe(`bytes of ${ORIGIN}${dir}scene-m-0.res`);
    expect(w.asked.filter((u) => u.endsWith('scene-m-0.res'))).toHaveLength(1);
  });

  it('orders a round’s files as the loader asks for them, the page’s own left out', () => {
    const paths = ['runtime/world-play.mjs', 'ui/main.js', 'index.html', 'scene-m-1.res', 'scene-collision.bfsw', 'scene-t-1.pixels', 'scene-t-10.dbx', 'scene-t-1.dbx', 'scene.json', 'system-0.xml', 'scene-tc-0.bin', 'scene-terrain-tiles.json', 'scene-terrain-tile-3_4.bfsw', 'scene-m-0.res', 'world-solutions.bin', 'programs.json'];
    expect(warmOrder(paths)).toEqual(['system-0.xml', 'scene.json', 'world-solutions.bin', 'scene-t-1.dbx', 'scene-t-1.pixels', 'scene-t-10.dbx', 'scene-m-0.res', 'scene-m-1.res', 'scene-tc-0.bin', 'scene-collision.bfsw', 'scene-terrain-tile-3_4.bfsw', 'scene-terrain-tiles.json']);
  });

  it('warms the round’s files once the front end shows and the worker answers, four at a time', async () => {
    const asked = [];
    let inFlight = 0;
    let most = 0;
    const observers = [];
    const classes = new Set();
    const files = Array.from({ length: 10 }, (_, i) => `scene-m-${i}.res`);
    const win = {
      navigator: { serviceWorker: { controller: {}, addEventListener: () => {} }, connection: {} },
      location: { pathname: '/battlefront/engine/main-da7a51b3/' },
      document: { body: { classList: { contains: (c) => classes.has(c) } } },
      MutationObserver: class {
        constructor(fn) {
          observers.push(fn);
        }
        observe() {}
      },
      fetch: async (url, init) => {
        if (url.endsWith('tp-files.json')) return { status: 200, json: async () => ({ files }) };
        asked.push([url, init?.headers?.['x-tp-warm']]);
        most = Math.max(most, ++inFlight);
        await new Promise((r) => setTimeout(r, 1));
        inFlight--;
        return { status: 204 };
      },
    };
    warmEngineBuild(win, warmOrder);
    await new Promise((r) => setTimeout(r, 5));
    expect(asked).toEqual([]);
    classes.add('play-menu');
    observers.forEach((fn) => fn());
    await new Promise((r) => setTimeout(r, 60));
    expect(asked.map(([u]) => u)).toEqual(files.map((f) => '/battlefront/engine/main-da7a51b3/' + f));
    expect(asked.every(([, warm]) => warm === '1')).toBe(true);
    expect(most).toBe(4);
    // (not on a connection that saves data)
    const before = asked.length;
    warmEngineBuild({ ...win, navigator: { ...win.navigator, connection: { saveData: true } } }, warmOrder);
    observers.at(-1)?.();
    await new Promise((r) => setTimeout(r, 10));
    expect(asked.length).toBe(before);
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

// The engine's build kept on the visitor's disk between visits (docs/decisions/2026-10-28-bf2web-pipeline.md): a
// service worker, scoped to /battlefront/engine/, that answers a build's file from Cache Storage once it has been
// fetched, so a second visit reads its 2.2 GB from disk, not the network. The browser's own HTTP cache would keep
// them too (a year, immutable) but drops what it likes when it's full, and a build is far bigger than most of what
// it holds. A build's files never change under its id, so a kept copy is always right; the cache is per build
// (tp-engine-<build>), and once another build is kept, inactive builds can be deleted. Open pages keep their own
// build caches, including older pages that finish loading across a deployment. Nothing else is touched: the
// page itself (it carries the way back, and is asked again each visit), the roots it asks for outside the build
// (/ui/, /export/, /ui-data/), a range, anything but GET. (bf2-web has an OPFS cache of its own, runtime/
// payload-cache.js, which its play page doesn't use yet; when it does, this can go.)
//
// And it reads ahead of the engine. bf2-web's loader asks for a round's files one at a time (tests/original-game-
// frame.mjs: `for (…) await fetch('scene-t-'+i+…)`), some 3,800 of them, so a round's load is mostly the wait for
// each answer to start. The build's files come in numbered series (scene-t-4.pixels, scene-t-5.pixels…; the Worker
// lists them at <build>/tp-files.json); asked for one, this fetches the next AHEAD of its series onto the disk
// while the engine reads it, and the engine's ask for one already on its way waits for it rather than asking again.
//
//   ENGINE_CACHE   cacheKeep(pathname) → { build, path } | null: whether a request is one this keeps
//   FILES   the build's list's name   following(paths, ahead) → Map(path → the next paths of its series)
//   engineWorker(self, keep, follow)   the service worker's side; the Worker serves it at /battlefront/engine/sw.js
//   registerEngineCache(win)   the page's side: registers it, and asks for the storage to be kept (persist)
//   warmOrder(paths)   warmEngineBuild(win, order)   the round's files put on the disk while the front end shows
//   WORKER_SOURCE   the script the Worker sends
//
// engineWorker, following, registerEngineCache, warmOrder and warmEngineBuild run as their source text, so none may
// reach outside itself.

import { sourceOf } from './source.js';

export const ENGINE_CACHE = 'tp-engine-';

export function cacheKeep(pathname) {
  const prefix = '/battlefront/engine/';
  if (!pathname.startsWith(prefix)) return null;
  const [build, ...rest] = pathname.slice(prefix.length).split('/');
  const path = rest.join('/');
  if (!build || !path || path === 'index.html' || !/^[A-Za-z0-9._-]+$/.test(build)) return null;
  return { build, path };
}

export const FILES = 'tp-files.json';
const AHEAD = 8;

// (a series: one name, a dash, a number, one ending, scene-t-12.stored.pixels among the scene-t-…stored.pixels)
export function following(paths, ahead = AHEAD) {
  const series = new Map();
  for (const path of paths) {
    const m = /^(.*-)(\d+)(\.[^/]+)$/.exec(path);
    if (!m) continue;
    const key = `${m[1]}#${m[3]}`;
    if (!series.has(key)) series.set(key, []);
    series.get(key).push([Number(m[2]), path]);
  }
  const next = new Map();
  for (const files of series.values()) {
    files.sort((a, b) => a[0] - b[0]);
    files.forEach(([, path], i) => next.set(path, files.slice(i + 1, i + 1 + ahead).map(([, p]) => p)));
  }
  return next;
}

export function engineWorker(self, keep, follow) {
  const NAME = 'tp-engine-';
  const LIST = 'tp-files.json';
  const WARM = 'x-tp-warm';
  const pruned = new Set();
  const lists = new Map();
  const onDisk = new Set();
  const coming = new Map();
  const same = { ignoreVary: true };
  // (the engine's loader asks again for nothing: a dropped answer, or the Worker's 503, is asked again here, after
  // half a second, then one and a half, then four; a 404 is the answer)
  const network = async (request) => {
    let last = null;
    for (const wait of [0, 500, 1500, 4000]) {
      if (wait) await new Promise((r) => setTimeout(r, wait));
      try {
        last = await self.fetch(request);
        if (last.status < 500) return last;
      } catch (error) {
        last = error;
      }
    }
    if (last instanceof Error || !last?.status) throw last;
    return last;
  };
  const prune = async (build) => {
    if (pruned.has(build)) return;
    // Another open page may still request an explicitly retained older build. Include uncontrolled windows,
    // too: activation/claim can be in progress. If clients cannot be listed, keep caches and retry another time.
    let clients;
    try {
      if (typeof self.clients?.matchAll !== 'function') return;
      clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (!Array.isArray(clients)) return;
    } catch { return; }
    const active = new Set([NAME + build]);
    for (const client of clients) {
      let url;
      try { url = new URL(client.url); } catch { return; }
      const pageBuild = url.origin === self.location.origin && /^\/battlefront\/engine\/([A-Za-z0-9._-]+)(?:\/|$)/.exec(url.pathname)?.[1];
      if (pageBuild) active.add(NAME + pageBuild);
    }
    for (const name of await self.caches.keys()) {
      if (!name.startsWith(NAME) || active.has(name)) continue;
      if (await self.caches.delete(name)) {
        const retired = name.slice(NAME.length);
        const prefix = `${self.location.origin}/battlefront/engine/${retired}/`;
        for (const url of onDisk) if (url.startsWith(prefix)) onDisk.delete(url);
        pruned.delete(retired);
      }
    }
    pruned.add(build);
  };
  // the build's series, once a worker's life (the list is a year under its build in the browser's own cache)
  const seriesOf = (build) => {
    if (!lists.has(build))
      lists.set(
        build,
        self
          .fetch(`${self.location.origin}/battlefront/engine/${build}/${LIST}`)
          .then((r) => (r.status === 200 ? r.json() : { files: [] }))
          .then((list) => follow(list.files ?? []))
          .catch(() => (lists.delete(build), new Map())),
      );
    return lists.get(build);
  };
  // a file fetched onto the disk, once: true when it's there
  const fill = (cache, build, url) => {
    if (onDisk.has(url)) return Promise.resolve(true);
    if (!coming.has(url))
      coming.set(
        url,
        (async () => {
          if (!(await cache.match(url, same))) {
            const response = await network(url);
            if (response.status !== 200) return false;
            await cache.put(url, response);
            await prune(build);
          }
          onDisk.add(url);
          return true;
        })()
          .catch(() => false)
          .finally(() => coming.delete(url)),
      );
    return coming.get(url);
  };
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
  self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET' || request.mode === 'navigate' || request.headers.has('range')) return;
    const url = new URL(request.url);
    const kept = url.origin === self.location.origin ? keep(url.pathname) : null;
    if (!kept) return;
    // (the page's own warming, warmEngineBuild: the file onto the disk, answered with no body, nothing read ahead)
    if (request.headers.get(WARM)) {
      event.respondWith(
        (async () => {
          try {
            const cache = await self.caches.open(NAME + kept.build);
            return new Response(null, { status: (await fill(cache, kept.build, url.href)) ? 204 : 502 });
          } catch {
            return new Response(null, { status: 502 });
          }
        })(),
      );
      return;
    }
    event.respondWith(
      (async () => {
        // Disk caching is optional: a denied or unavailable store must not turn a usable network response into
        // a failed engine load. Keep the existing network retries when the browser cannot open/read its cache.
        let cache;
        try {
          cache = await self.caches.open(NAME + kept.build);
        } catch {
          return network(request);
        }
        const dir = `${url.origin}/battlefront/engine/${kept.build}/`;
        event.waitUntil(
          seriesOf(kept.build)
            .then((next) => Promise.all((next.get(kept.path) ?? []).map((path) => fill(cache, kept.build, dir + path))))
            .catch(() => {}),
        );
        // (one already on its way: waited for, not asked again)
        if (coming.has(dir + kept.path)) await coming.get(dir + kept.path);
        let hit;
        try {
          hit = await cache.match(request, same);
        } catch {
          return network(request);
        }
        if (hit) return hit;
        const response = await network(request);
        if (response.status === 200)
          event.waitUntil(
            (async () => {
              await cache.put(request, response.clone());
              onDisk.add(dir + kept.path);
              await prune(kept.build);
            })().catch(() => {}),
          );
        return response;
      })(),
    );
  });
}

export function registerEngineCache(win) {
  const nav = win.navigator;
  if (!nav?.serviceWorker) return;
  nav.serviceWorker.register('/battlefront/engine/sw.js', { scope: '/battlefront/engine/' }).catch(() => {});
  // (a best-effort store can be cleared when the disk is short; asked, the browser may keep it)
  nav.storage?.persist?.().catch(() => {});
}

// The order bf2-web's loader asks for a round's files in (tests/original-game-frame.mjs: the system textures, the scene,
// its textures, partitions, mesh sets, terrain, Enlighten, collision, tiles, atlases, IES), each series by its number:
// the files a round reads, as it reads them, the page's own files (runtime/, ui/) left out.
export function warmOrder(paths) {
  const ranks = ['system-', 'scene.json', 'world-solutions', 'scene-t-', 'scene-p-', 'scene-m-', 'scene-tc-', 'scene-r-', 'scene-e-', 'scene-collision', 'scene-terrain-tile', 'scene-atlas-', 'scene-ies-'];
  const rankOf = (path) => {
    let best = -1;
    ranks.forEach((r, i) => {
      if (path.startsWith(r) && (best < 0 || r.length > ranks[best].length)) best = i;
    });
    return best;
  };
  return paths
    .filter((p) => !p.includes('/'))
    .map((path) => ({ path, rank: rankOf(path), n: Number(/-(\d+)[.]/.exec(path)?.[1] ?? 0) }))
    .filter((f) => f.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.n - b.n || (a.path < b.path ? -1 : 1))
    .map((f) => f.path);
}

// The page's side of the warming: once the front end shows (the body's play-menu) and the worker answers for the page,
// the round's files are asked for in the loader's order, four at a time, for the worker to put on the disk; the menu's
// time is the download's, and the round's own load then finds them there. Not on a connection that asks to save data.
export function warmEngineBuild(win, order) {
  const nav = win.navigator;
  if (!nav?.serviceWorker || nav.connection?.saveData || typeof win.fetch !== 'function') return;
  const doc = win.document;
  const dir = win.location.pathname.replace(/[^/]*$/, '');
  let started = false;
  const start = async () => {
    if (started || !doc.body.classList?.contains('play-menu')) return;
    started = true;
    if (!nav.serviceWorker.controller) await new Promise((r) => nav.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    const list = await win.fetch(dir + 'tp-files.json').then((r) => (r.status === 200 ? r.json() : { files: [] }));
    const files = order(list.files ?? []);
    let next = 0;
    const lane = async () => {
      while (next < files.length) {
        const path = files[next++];
        // (a 200 is a file sent whole, the worker not there: its bytes aren't wanted here)
        const r = await win.fetch(dir + path, { headers: { 'x-tp-warm': '1' } }).catch(() => null);
        if (r?.status === 200) r.body?.cancel?.().catch?.(() => {});
      }
    };
    await Promise.all([lane(), lane(), lane(), lane()]);
  };
  new win.MutationObserver(() => start().catch(() => {})).observe(doc.body, { attributes: true, attributeFilter: ['class'] });
  start().catch(() => {});
}

// (with the bundler's __name stood in for: source.js)
export const WORKER_SOURCE = sourceOf(`(${engineWorker})(self, ${cacheKeep}, (paths) => (${following})(paths, ${AHEAD}));`);

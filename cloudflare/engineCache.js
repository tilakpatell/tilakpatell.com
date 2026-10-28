// The engine's build kept on the visitor's disk between visits (docs/decisions/2026-10-28-bf2web-pipeline.md): a
// service worker, scoped to /battlefront/engine/, that answers a build's file from Cache Storage once it has been
// fetched, so a second visit reads its 2.2 GB from disk, not the network. The browser's own HTTP cache would keep
// them too (a year, immutable) but drops what it likes when it's full, and a build is far bigger than most of what
// it holds. A build's files never change under its id, so a kept copy is always right; the cache is per build
// (tp-engine-<build>), and once a newer build is kept the older ones are deleted. Nothing else is touched: the
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
//   WORKER_SOURCE   the script the Worker sends
//
// engineWorker, following and registerEngineCache run as their source text, so none may reach outside itself.

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
  const pruned = new Set();
  const lists = new Map();
  const onDisk = new Set();
  const coming = new Map();
  const same = { ignoreVary: true };
  const prune = async (build) => {
    if (pruned.has(build)) return;
    pruned.add(build);
    for (const name of await self.caches.keys()) if (name.startsWith(NAME) && name !== NAME + build) await self.caches.delete(name);
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
            const response = await self.fetch(url);
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
    event.respondWith(
      (async () => {
        const cache = await self.caches.open(NAME + kept.build);
        const dir = `${url.origin}/battlefront/engine/${kept.build}/`;
        event.waitUntil(
          seriesOf(kept.build)
            .then((next) => Promise.all((next.get(kept.path) ?? []).map((path) => fill(cache, kept.build, dir + path))))
            .catch(() => {}),
        );
        // (one already on its way: waited for, not asked again)
        if (coming.has(dir + kept.path)) await coming.get(dir + kept.path);
        const hit = await cache.match(request, same);
        if (hit) return hit;
        const response = await self.fetch(request);
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

// (with the bundler's __name stood in for: source.js)
export const WORKER_SOURCE = sourceOf(`(${engineWorker})(self, ${cacheKeep}, (paths) => (${following})(paths, ${AHEAD}));`);

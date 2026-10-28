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
//   ENGINE_CACHE   cacheKeep(pathname) → { build, path } | null: whether a request is one this keeps
//   engineWorker(self)   the service worker's side; the Worker serves it at /battlefront/engine/sw.js as its source
//   registerEngineCache(win)   the page's side: registers it, and asks for the storage to be kept (persist)
//   WORKER_SOURCE   the script the Worker sends
//
// engineWorker and registerEngineCache run as their source text, so neither may reach outside itself.

export const ENGINE_CACHE = 'tp-engine-';

export function cacheKeep(pathname) {
  const prefix = '/battlefront/engine/';
  if (!pathname.startsWith(prefix)) return null;
  const [build, ...rest] = pathname.slice(prefix.length).split('/');
  const path = rest.join('/');
  if (!build || !path || path === 'index.html' || !/^[A-Za-z0-9._-]+$/.test(build)) return null;
  return { build, path };
}

export function engineWorker(self, keep) {
  const NAME = 'tp-engine-';
  const pruned = new Set();
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
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await self.fetch(request);
        if (response.status === 200)
          event.waitUntil(
            (async () => {
              await cache.put(request, response.clone());
              if (pruned.has(kept.build)) return;
              pruned.add(kept.build);
              for (const name of await self.caches.keys()) if (name.startsWith(NAME) && name !== NAME + kept.build) await self.caches.delete(name);
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

export const WORKER_SOURCE = `(${engineWorker})(self, ${cacheKeep});\n`;

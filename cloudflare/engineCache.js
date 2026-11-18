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
    // The engine chooses mip byte ranges after selecting quality and view. Never warm the whole payload.
    if (/(^|\/)scene-t-\d+(?:\.stored)?\.pixels$/.test(path)) continue;
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

// limits (15 Nov, live r1073 boot hangs: nothing here had a time limit): a network ask that has not answered in `fetch` ms is
// aborted and asked again (the retries below); a demanded file waits for the ANSWER of its read-ahead already on its way at most
// `waitAhead` ms, then asks for itself. Once the read-ahead's answer has come, its download onto the disk is waited for whole,
// however long ([c5] on #1323: capping the whole download fetched healthy slow files twice; the hosted cold run's read-aheads
// took 3-6 s).
export function engineWorker(self, keep, follow, limits = { fetch: 15000, waitAhead: 20000 }) {
  const NAME = 'tp-engine-';
  const LIST = 'tp-files.json';
  const WARM = 'x-tp-warm';
  const pruned = new Set();
  const lists = new Map();
  const onDisk = new Set();
  const coming = new Map();
  // (a read-ahead's answer: resolved when its network ask has answered, or the file was on the disk already)
  const answered = new Map();
  const same = { ignoreVary: true };
  let writable = true;
  const put = async (cache, request, response) => {
    try {
      await cache.put(request, response);
      return true;
    } catch (error) {
      // A quota or disk error makes speculative downloads useless. Keep existing cache reads and demanded network
      // requests working, but stop trying to fill this worker's cache until a fresh worker can try again.
      // (Only those: a body cut on the way in (a TypeError, an AbortError) loses that one file, and the next is kept as
      // before; one dropped download used to stop every later fill for the worker's life, s-cdn 1075.)
      if (['QuotaExceededError', 'UnknownError', 'InvalidStateError'].includes(error?.name)) writable = false;
      return false;
    }
  };
  // (the engine's loader asks again for nothing: a dropped answer, or the Worker's 503, is asked again here, after
  // half a second, then one and a half, then four; a 404 is the answer)
  // (one network ask, aborted and failed when it has not answered in time: a stalled answer is then asked again like a dropped one)
  const timedFetch = (request) => {
    const control = typeof AbortController === 'function' ? new AbortController() : null;
    let timer;
    const late = new Promise((_, reject) => {
      timer = setTimeout(() => {
        try { control?.abort(); } catch { /* already settled */ }
        reject(new Error('engine-cache: no answer in ' + limits.fetch + ' ms'));
      }, limits.fetch);
    });
    return Promise.race([control ? self.fetch(request, { signal: control.signal }) : self.fetch(request), late]).finally(() => clearTimeout(timer));
  };
  // A body that sends no byte for `stall` ms while it is being read ends in an error, its download cancelled (18 Nov, live
  // r1075-f943c314, s-verify's cold boot: scene-frontend/scene.json's headers came through here at 24.4 s, its body never, Home
  // without its model past 77 s; the page's own limit is 120 s). The page's loader asks again on the error (fetchBytes), and
  // the next ask is a fresh download. Measured only while the body is read: a page busy elsewhere holds no timer.
  // guarded(response, keep): { answer, saved }: answer is the response with that body; saved resolves to the body's chunks once
  // it is whole when keep (or 'big' past KEEP_MAX, or null when it failed), so a demanded file goes on the disk from the bytes
  // the page got, with no tee (the page's copy no longer waits on the cache's). A body that is not a stream (the tests' fakes)
  // goes as it is, saved 'clone'.
  const STALL = {};
  const KEEP_MAX = 64 * 1048576;
  const stallMs = limits.stall ?? 10000;
  const guarded = (response, keep = false) => {
    const body = response?.body;
    if (!body || typeof body.getReader !== 'function' || typeof ReadableStream !== 'function')
      return { answer: response, saved: Promise.resolve(keep ? 'clone' : null) };
    const reader = body.getReader();
    let chunks = keep ? [] : null, size = 0, settle;
    const saved = new Promise((r) => (settle = r));
    const stream = new ReadableStream(
      {
        async pull(controller) {
          let timer;
          const late = new Promise((r) => (timer = setTimeout(() => r(STALL), stallMs)));
          let step;
          try {
            step = await Promise.race([reader.read(), late]);
          } catch (error) {
            clearTimeout(timer);
            settle(null);
            controller.error(error);
            return;
          }
          clearTimeout(timer);
          if (step === STALL) {
            reader.cancel().catch(() => {});
            settle(null);
            controller.error(new TypeError('engine-cache: no byte in ' + stallMs + ' ms'));
            return;
          }
          if (step.done) {
            settle(chunks ?? (keep ? 'big' : null));
            controller.close();
            return;
          }
          if (chunks) {
            size += step.value.byteLength;
            if (size > KEEP_MAX) chunks = null;
            else chunks.push(step.value);
          }
          controller.enqueue(step.value);
        },
        cancel(reason) {
          settle(null);
          return reader.cancel(reason);
        },
      },
      { highWaterMark: 0 },
    );
    // (the bytes are the decoded body: its encoding and the encoded length no longer describe them)
    const headers = new Headers(response.headers ?? undefined);
    headers.delete('content-length');
    headers.delete('content-encoding');
    return { answer: new Response(stream, { status: response.status, statusText: response.statusText, headers }), saved };
  };
  const network = async (request) => {
    let last = null;
    for (const wait of [0, 500, 1500, 4000]) {
      if (wait) await new Promise((r) => setTimeout(r, wait));
      try {
        last = await timedFetch(request);
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
    // Also reject warm requests from an older open page or a stale series list.
    if (/(^|\/)scene-t-\d+(?:\.stored)?\.pixels$/.test(new URL(url).pathname)) return Promise.resolve(true);
    if (onDisk.has(url)) return Promise.resolve(true);
    if (!writable) return Promise.resolve(false);
    if (!coming.has(url)) {
      let heard;
      answered.set(url, new Promise((r) => (heard = r)));
      coming.set(
        url,
        (async () => {
          if (!(await cache.match(url, same))) {
            const response = await network(url);
            heard();
            if (response.status !== 200) return false;
            // (a read-ahead's or a warm's body that stalls fails its put, so a demand waiting on it asks for itself)
            if (!(await put(cache, url, guarded(response).answer))) return false;
            await prune(build);
          }
          onDisk.add(url);
          return true;
        })()
          .catch(() => false)
          .finally(() => {
            heard();
            coming.delete(url);
            answered.delete(url);
          }),
      );
    }
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
        // (a read-ahead on its way is waited for, whole, once its answer has come; one whose answer has not come in time is
        // left to itself and the demand asks for itself)
        const ahead = coming.get(dir + kept.path);
        if (ahead) {
          let timer;
          const late = new Promise((r) => (timer = setTimeout(() => r('late'), limits.waitAhead)));
          const heard = await Promise.race([answered.get(dir + kept.path) ?? ahead, late]);
          clearTimeout(timer);
          if (heard !== 'late') await ahead;
        }
        let hit;
        try {
          hit = await cache.match(request, same);
        } catch {
          return network(request);
        }
        if (hit) return hit;
        const response = await network(request);
        const { answer, saved } = guarded(response, response.status === 200 && writable);
        event.waitUntil(
          (async () => {
            const chunks = await saved;
            if (chunks === null) return;
            // (past KEEP_MAX the bytes were not held: a fill puts it, from the browser's own cache as a rule)
            if (chunks === 'big') return void (await fill(cache, kept.build, dir + kept.path));
            const copy = chunks === 'clone' ? response.clone() : new Response(new Blob(chunks), { status: 200, headers: answer.headers });
            if (!(await put(cache, request, copy))) return;
            onDisk.add(dir + kept.path);
            await prune(kept.build);
          })().catch(() => {}),
        );
        return answer;
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

// The order bf2-web's loader asks for a round's files in (tests/original-game-frame.mjs: the engine's module and its
// program lists, the scene pack, the system textures, the scene, its textures, partitions, mesh sets, terrain, Enlighten,
// collision, tiles, atlases, IES), each series by its number: the files a round reads, as it reads them, the page's own
// files (runtime/, ui/) left out. skip: names the round will not read from the root (warmEngineBuild: the ones inside the
// scene pack, which the loader reads from scene-pack.bin, and the ones a lighting variant swaps, which the round reads from
// the variant's directory when that variant is rolled at PLAY).
export function warmOrder(paths, skip = new Set()) {
  const ranks = ['original-frame-graph.wasm', 'programs.json', 'compute-programs.json', 'cooked-programs.json', 'pipelines.json', 'compute-pipelines.json', 'scene-pack.json', 'scene-pack.bin', 'system-', 'scene.json', 'world-solutions', 'scene-t-', 'scene-p-', 'scene-m-', 'scene-tc-', 'scene-r-', 'scene-e-', 'scene-collision', 'scene-terrain-tile', 'scene-atlas-', 'scene-ies-'];
  const rankOf = (path) => {
    let best = -1;
    ranks.forEach((r, i) => {
      if (path.startsWith(r) && (best < 0 || r.length > ranks[best].length)) best = i;
    });
    return best;
  };
  return paths
    .filter((p) => !p.includes('/'))
    .filter((p) => !/^scene-t-\d+(?:\.stored)?\.pixels$/.test(p))
    .filter((p) => !skip.has(p))
    .map((path) => ({ path, rank: rankOf(path), n: Number(/-(\d+)[.]/.exec(path)?.[1] ?? 0) }))
    .filter((f) => f.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.n - b.n || (a.path < b.path ? -1 : 1))
    .map((f) => f.path);
}

// The page's side of the warming: once the front end shows (the body's play-menu) and the worker answers for the page,
// the round's files are asked for in the loader's order, four at a time, for the worker to put on the disk; the menu's
// time is the download's, and the round's own load then finds them there. Not on a connection that asks to save data.
// Only what every roll of the round reads: not the files packed in scene-pack.bin (the loader never asks for them one by
// one) and not the root's copy of a file a lighting variant swaps (scene-<name>/variant.json lists them; the variant is
// rolled at PLAY, so before it the root's copy is as likely wasted as read). A list that cannot be read skips nothing.
export function warmEngineBuild(win, order) {
  const nav = win.navigator;
  if (!nav?.serviceWorker || nav.connection?.saveData || typeof win.fetch !== 'function') return;
  const doc = win.document;
  const dir = win.location.pathname.replace(/[^/]*$/, '');
  let started = false;
  // (not before the menu is complete: the page adds 'play-menu-ready' once its menu scene's prewarm settles, ready, failed or timed out,
  // and the warm's four lanes no longer compete with it for the line; s-collection, staged 1075-c: 389-944 of the level's 1289 files
  // were fetched before the menu scene was ready. Without that class, as on a direct start, the warm begins 30 s after 'play-menu'.)
  const waitMs = win.__playWarmWaitMs ?? 30000;
  let capped = false, cap = null;
  const start = async () => {
    if (started || !doc.body.classList?.contains('play-menu')) return;
    if (!capped && !doc.body.classList.contains('play-menu-ready')) {
      cap ??= setTimeout(() => { capped = true; start().catch(() => {}); }, waitMs);
      return;
    }
    if (cap) clearTimeout(cap);
    started = true;
    if (!nav.serviceWorker.controller) await new Promise((r) => nav.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    const list = await win.fetch(dir + 'tp-files.json').then((r) => (r.status === 200 ? r.json() : { files: [] }));
    const all = list.files ?? [];
    const json = (path) => win.fetch(dir + path).then((r) => (r.status === 200 ? r.json() : null)).catch(() => null);
    const skip = new Set();
    const pack = all.includes('scene-pack.json') ? await json('scene-pack.json') : null;
    if (pack && typeof pack === 'object' && !Array.isArray(pack)) for (const name of Object.keys(pack)) skip.add(name);
    for (const path of all.filter((p) => /^scene-[A-Za-z0-9_-]+\/variant\.json$/.test(p))) {
      const variant = await json(path);
      if (Array.isArray(variant?.files)) for (const name of variant.files) if (typeof name === 'string') skip.add(name);
    }
    const files = order(all, skip);
    let next = 0, stopped = false;
    const lane = async () => {
      while (!stopped && next < files.length) {
        const path = files[next++];
        // (a 200 is a file sent whole, the worker not there: its bytes aren't wanted here)
        const r = await win.fetch(dir + path, { headers: { 'x-tp-warm': '1' } }).catch(() => null);
        if (r?.status === 200) r.body?.cancel?.().catch?.(() => {});
        // Only 204 confirms the bytes were cached. Stop every lane after a failed warm or absent worker instead
        // of fetching the rest of a multi-gigabyte build that cannot be kept. Already-started requests may finish.
        if (r?.status !== 204) stopped = true;
      }
    };
    await Promise.all([lane(), lane(), lane(), lane()]);
  };
  new win.MutationObserver(() => start().catch(() => {})).observe(doc.body, { attributes: true, attributeFilter: ['class'] });
  start().catch(() => {});
}

// (with the bundler's __name stood in for: source.js)
export const WORKER_SOURCE = sourceOf(`(${engineWorker})(self, ${cacheKeep}, (paths) => (${following})(paths, ${AHEAD}));`);

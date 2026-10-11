// The site's service worker, and all it does: a file of an installed world's
// pack (src/runtime/install.js put it in a tp-pack-<slug>-<v> cache) is
// answered from that cache, the network after. Nothing else is touched: no
// precache, no pages (navigations), no other origin, no sockets, no ranges,
// nothing the page asked to skip the cache for (the installer's own fetches),
// nothing under /packs/. A cache of a version the build no longer lists
// (/packs/index.json) is not served from, so a file changed on deploy is
// fetched new; a hashed bundle file (/assets/) never changes, so it is served
// from any. Unregistering it leaves the site as it was. Registered by
// src/lib/sw.js only once a world is installed.
//
// The asset bucket (VITE_ASSET_BASE, given in this script's URL as ?base=):
// a pack's file from there is cached under its bucket URL, and answered for
// that URL alone of the bucket's, never the project's API; its path is a
// content hash, so any cache holding it is current. The site's own path of
// that file (the page asks it after the bucket failed once) is answered from
// the same copy, under the pack's version like any other.
//
// The world being played (lane N4, the stream that feels like one): a
// `tp-play` message names it (src/lib/sw.js's playing), and the bucket's
// files of its level pack (`<hash>/models/galaxy/bf2017/levels/<world>/…`,
// hashed, so never stale) are kept as they are fetched in a
// tp-play-<world> cache and answered from it after. Worlds played before
// stay, under 400 MB in all: past it the least recently played goes whole,
// and the world being played keeps no more than the cap holds. The site's
// own paths of those files are not hashed and are never kept. Phones evict
// what a site keeps after a week unused, so the bucket's CDN is the real
// cache; this one makes a second visit on the same machine quick.

const PREFIX = 'tp-pack-';
const INDEX_TTL = 5 * 60 * 1000;
const POSSIBLE = /^\/(assets|models|textures|audio|hdri|hq|cc0|mc|n64|games|eagler|albuquerque|kit)\//;

const BASE = (new URL(self.location.href).searchParams.get('base') || '').replace(/\/+$/, '');

const PLAY = 'tp-play-';
const PLAY_META = 'tp-play-meta';
// _source: the GPU-first design's §4 N4, "a 400 MB cap with LRU"
const CAP = 400e6;
const LEVEL = /^\/[0-9a-f]{12}\/models\/galaxy\/bf2017\/levels\/([^/]+)\//;
let playing = null; // the world being played (a district's world: its first part)
let keeping = Promise.resolve(); // (one keep at a time: the sizes' ledger is read and written whole)

let files = null; // pathname, or a bucket URL → { name: cache name, key: what it is cached under }
let reading = null;
let current = null; // slug → v, from the build's index (null: not known yet)
let indexAt = 0;
let indexing = null;

const versionOf = (name) => {
  const rest = name.slice(PREFIX.length);
  const cut = rest.lastIndexOf('-');
  return { slug: rest.slice(0, cut), v: rest.slice(cut + 1) };
};

function readCaches() {
  reading ??= (async () => {
    const map = new Map();
    for (const name of (await caches.keys()).filter((n) => n.startsWith(PREFIX))) {
      for (const req of await (await caches.open(name)).keys()) {
        const url = new URL(req.url);
        if (BASE && req.url.startsWith(`${BASE}/`)) {
          map.set(req.url, { name, key: req.url, far: true });
          // (its path on the site: what follows the hash)
          const local = `/${req.url.slice(BASE.length + 1).replace(/^[^/]+\//, '')}`;
          if (!map.has(local)) map.set(local, { name, key: req.url });
        } else if (url.origin === self.location.origin && !url.pathname.startsWith('/packs/')) map.set(url.pathname, { name, key: null });
      }
    }
    files = map;
  })().finally(() => {
    reading = null;
  });
  return reading;
}

function readIndex() {
  if (indexing) return indexing;
  if (current && Date.now() - indexAt < INDEX_TTL) return Promise.resolve();
  indexing = fetch('/packs/index.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((index) => {
      if (!index) return;
      current = Object.fromEntries(Object.values(index).map((e) => [e.slug, e.v]));
      indexAt = Date.now();
    })
    .catch(() => {}) // (offline: what is installed is what there is)
    .finally(() => {
      indexing = null;
    });
  return indexing;
}

async function answer(request, path) {
  if (!files) await readCaches();
  const got = files.get(path);
  if (!got) return fetch(request);
  if (!got.far && !path.startsWith('/assets/')) {
    await readIndex();
    const { slug, v } = versionOf(got.name);
    if (current && current[slug] !== v) return fetch(request);
  }
  const hit = await (await caches.open(got.name)).match(got.key ?? request);
  return hit ?? fetch(request);
}

// a bucket URL's level world, or null
const levelOf = (url) => (BASE && url.startsWith(`${BASE}/`) ? (url.slice(BASE.length).match(LEVEL)?.[1] ?? null) : null);

async function ledger() {
  const hit = await (await caches.open(PLAY_META)).match('/ledger');
  return hit ? hit.json() : {};
}
const saveLedger = async (m) => (await caches.open(PLAY_META)).put('/ledger', new Response(JSON.stringify(m)));

// a fetched file of the world being played kept, and the cap held: the
// least recently played other worlds go whole, oldest first; what the
// world alone cannot fit is not kept
async function keep(world, url, res) {
  const size = Number(res.headers.get('content-length')) || (await res.clone().arrayBuffer()).byteLength;
  const m = await ledger();
  m[world] = { bytes: m[world]?.bytes ?? 0, at: m[world]?.at ?? Date.now() };
  let total = Object.values(m).reduce((s, w) => s + w.bytes, 0) + size;
  for (const w of Object.keys(m)
    .filter((k) => k !== world)
    .sort((a, b) => m[a].at - m[b].at)) {
    if (total <= CAP) break;
    await caches.delete(PLAY + w);
    total -= m[w].bytes;
    delete m[w];
  }
  if (total <= CAP) {
    await (await caches.open(PLAY + world)).put(url, res);
    m[world].bytes += size;
  }
  await saveLedger(m);
}

async function answerPlay(event, url, world) {
  const hit = await (await caches.open(PLAY + world)).match(url);
  if (hit) return hit;
  const res = await fetch(event.request);
  if (world === playing && res.ok && res.type !== 'opaque') {
    const copy = res.clone();
    keeping = keeping.then(() => keep(world, url, copy)).catch(() => {});
    event.waitUntil?.(keeping);
  }
  return res;
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// the installer says the caches changed; or the page says which world it plays
self.addEventListener('message', (event) => {
  if (event.data?.type === 'tp-play') {
    playing = String(event.data.world || '').split('/')[0] || null;
    if (!playing) return;
    const world = playing;
    keeping = keeping
      .then(async () => {
        const m = await ledger();
        m[world] = { bytes: m[world]?.bytes ?? 0, at: Date.now() };
        await saveLedger(m);
      })
      .catch(() => {});
    event.waitUntil?.(keeping);
    return;
  }
  if (event.data?.type !== 'tp-packs') return;
  current = null;
  event.waitUntil?.(Promise.all([readCaches(), readIndex()]));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.mode === 'navigate' || req.headers.has('range') || req.cache === 'no-store' || req.cache === 'no-cache' || req.cache === 'reload') return;
  const url = new URL(req.url);
  if (url.search) return;
  const key = url.origin === self.location.origin ? (POSSIBLE.test(url.pathname) ? url.pathname : null) : BASE && req.url.startsWith(`${BASE}/`) ? req.url : null;
  if (!key) return;
  // (a level file of the world being played: its own cache)
  const world = levelOf(req.url);
  if (world && world === playing) return event.respondWith(answerPlay(event, req.url, world));
  // once the caches are read, anything not in them is left alone
  if (files && !files.has(key)) return;
  event.respondWith(answer(req, key));
});

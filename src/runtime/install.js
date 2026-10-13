// A world's install: its pack (scripts/packs.mjs wrote /packs/<slug>.json at
// build: every file it fetches, with sizes and hashes) fetched into the Cache
// API under tp-pack-<slug>-<v>, a few files at a time, with progress in bytes
// and a time left from the running rate. What is already in the cache is
// skipped, so an install cut off part way resumes; a file with the same hash
// in an older version's cache is carried over, not fetched again. The pack's
// manifest goes in last, so a cache holds a whole install or is still going.
// A file from the asset bucket (its entry has `local`, its path on the site)
// is fetched across origins, from the site if the bucket fails, and cached
// under the bucket's URL. The service worker (public/sw.js) serves from these caches. The core is
// pure: fetch, caches and storage are passed in (installer() binds the
// browser's).
//
// createInstaller({ fetch, caches, storage, remember, concurrency, now, notify })
//   (prepare: before an install begins; notify(what): after one ends or a pack goes)
//   → { supported, pack(to), installed(to), install(to, { onProgress }), uninstall(to), list(), estimate() }

// (the bucket's state alone: lib/assetBase would bring the whole manifest onto every page)
import { WAIT_MS, isDown, markDown } from '../lib/assetDown';
import { workerSwitch } from '../lib/sw';

export const PREFIX = 'tp-pack-';
export const PERSIST_KEY = 'tp-worlds-persist';
export const cacheName = (slug, v) => `${PREFIX}${slug}-${v}`;
const markerOf = (slug, v) => `/packs/${slug}.json?v=${v}`;
const INDEX_TTL = 30000;
const TRIES = 3;

export function createInstaller({ fetch, caches, storage = null, remember = null, concurrency = 4, now = Date.now, notify = () => {}, prepare = () => {}, retryDelay = 800, bucket = { isDown, markDown }, wait = WAIT_MS }) {
  const supported = Boolean(fetch && caches);
  let index = null; // { at, promise }
  const running = new Map(); // to → promise

  const getIndex = () => {
    if (!supported) return Promise.resolve(null);
    if (index && now() - index.at < INDEX_TTL) return index.promise;
    const promise = Promise.resolve()
      .then(() => fetch('/packs/index.json', { cache: 'no-cache' }))
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    index = { at: now(), promise };
    promise.then((v) => {
      if (!v && index?.promise === promise) index = null; // (tried again next time)
    });
    return promise;
  };
  // the caches of one pack, by version
  const versions = async (slug) => (await caches.keys()).filter((n) => n.startsWith(`${PREFIX}${slug}-`)).map((n) => ({ name: n, v: n.slice(PREFIX.length + slug.length + 1) }));
  const stored = async (slug, v) => {
    const cache = await caches.open(cacheName(slug, v));
    const res = await cache.match(markerOf(slug, v));
    return res ? res.json() : null;
  };
  const whole = async (slug, v) => {
    const m = await stored(slug, v);
    if (!m) return null;
    // (a file of the site is listed by its path, one from the asset bucket by its whole URL)
    const keys = new Set((await (await caches.open(cacheName(slug, v))).keys()).flatMap((r) => [new URL(r.url, 'http://x').pathname, r.url]));
    return m.files.every((f) => keys.has(f.url)) ? { v, bytes: m.bytes } : null;
  };

  const pack = async (to) => (await getIndex())?.[to] ?? null;

  async function installed(to) {
    const entry = await pack(to);
    return entry ? whole(entry.slug, entry.v) : null;
  }

  const askPersist = () => {
    if (!storage?.persist || remember?.get(PERSIST_KEY)) return;
    remember?.set(PERSIST_KEY, 'asked');
    Promise.resolve()
      .then(() => storage.persist())
      .catch(() => {});
  };

  async function run(to, onProgress) {
    const entry = await pack(to);
    if (!entry) throw new Error(`no pack for ${to}`);
    const { slug, v } = entry;
    const res = await fetch(`/packs/${slug}.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`no manifest for ${to}`);
    const manifest = await res.json();
    askPersist();
    await Promise.resolve()
      .then(prepare)
      .catch(() => {});
    const cache = await caches.open(cacheName(slug, v));
    const older = (await versions(slug)).filter((x) => x.v !== v);
    // files an older install has with the same hash
    const carry = new Map();
    for (const o of older) {
      const m = await stored(slug, o.v).catch(() => null);
      for (const f of m?.files ?? []) if (!carry.has(`${f.url} ${f.hash}`)) carry.set(`${f.url} ${f.hash}`, o.name);
    }
    let done = 0;
    const todo = [];
    for (const f of manifest.files) {
      if (await cache.match(f.url)) {
        done += f.bytes;
        continue;
      }
      const from = carry.get(`${f.url} ${f.hash}`);
      const hit = from && (await (await caches.open(from)).match(f.url));
      if (hit) {
        await cache.put(f.url, hit);
        done += f.bytes;
      } else todo.push(f);
    }
    const total = manifest.bytes;
    const started = now();
    const startBytes = done;
    let left = todo.length;
    const tell = () => {
      const rate = (done - startBytes) / Math.max(1, now() - started); // bytes a ms
      onProgress?.({ done, total, files: manifest.files.length, left, eta: rate > 0 ? Math.ceil((total - done) / rate / 1000) : null });
    };
    tell();

    const fetchOne = async (f) => {
      let err = null;
      let triedBucket = false;
      for (let i = 0; i < TRIES; i++) {
        let got = 0;
        // (the bucket once a file, and not at all once it has failed this visit:
        // a blocked bucket costs one failed request, not one a file)
        // (a file only the bucket holds, `remoteOnly`, has no copy on the site
        // to fall to: asked of the bucket every try, with the usual waits)
        const remote = Boolean(f.local) && (f.remoteOnly || (!triedBucket && !bucket.isDown()));
        try {
          // a file from the asset bucket (f.local, its path here): asked across
          // origins with CORS, and of the site once the bucket has failed it;
          // the same bytes by hash, so kept under the bucket's URL either way
          let r;
          if (remote) {
            triedBucket = true;
            let timer = null;
            // (its answer, not its whole body, within the wait: a dropped host, not a big file)
            r = await Promise.race([fetch(f.url, { cache: 'no-cache', mode: 'cors' }), new Promise((_, no) => (timer = setTimeout(() => no(new Error('the asset base did not answer')), wait)))]).finally(() => clearTimeout(timer));
          } else r = await fetch(f.local ?? f.url, { cache: 'no-cache' });
          if (!r.ok) throw new Error(`${r.status}`);
          const chunks = [];
          if (r.body?.getReader) {
            const reader = r.body.getReader();
            for (;;) {
              const { done: end, value } = await reader.read();
              if (end) break;
              chunks.push(value);
              got += value.length;
              done += value.length;
              tell();
            }
          } else {
            const buf = new Uint8Array(await r.arrayBuffer());
            chunks.push(buf);
            got = buf.length;
            done += got;
          }
          // (a body short of the manifest's bytes, a connection cut or a CDN's
          // truncated object, is a failure to try again, never a half file kept)
          if (got < f.bytes) throw new Error(`short body: ${got} of ${f.bytes} bytes`);
          const headers = new Headers(r.headers);
          headers.delete('content-encoding');
          headers.delete('content-length');
          await cache.put(f.url, new Response(new Blob(chunks), { status: 200, headers }));
          done += f.bytes - got; // (to the manifest's count, whatever the wire said)
          left -= 1;
          tell();
          return;
        } catch (e) {
          done -= got;
          err = e;
          if (remote && !f.remoteOnly) {
            bucket.markDown();
            continue; // (straight to the site's copy)
          }
          if (retryDelay) await new Promise((r) => setTimeout(r, retryDelay * (i + 1)));
        }
      }
      const fail = new Error(`couldn't fetch ${f.url} (${err?.message ?? 'failed'})`);
      fail.url = f.url;
      throw fail;
    };

    // a few at a time; the first failure stops the rest from starting
    let next = 0;
    let failed = null;
    const lane = async () => {
      while (!failed && next < todo.length) {
        const f = todo[next++];
        try {
          await fetchOne(f);
        } catch (e) {
          failed ??= e;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, lane));
    if (failed) throw failed;
    await cache.put(markerOf(slug, v), new Response(JSON.stringify(manifest), { headers: { 'content-type': 'application/json' } }));
    for (const o of older) await caches.delete(o.name);
    notify('install');
    return { v, bytes: total };
  }

  return {
    supported,
    pack: (to) => pack(to),
    installed: (to) => (supported ? installed(to) : Promise.resolve(null)),
    install(to, { onProgress } = {}) {
      if (!supported) return Promise.reject(new Error('installs need the Cache API'));
      if (running.has(to)) return running.get(to);
      const p = run(to, onProgress).finally(() => running.delete(to));
      running.set(to, p);
      return p;
    },
    async uninstall(to) {
      if (!supported) return;
      const entry = await pack(to);
      const slug = entry?.slug ?? to.replace(/\//g, '-').replace(/^-/, '');
      for (const o of await versions(slug)) await caches.delete(o.name);
      notify('uninstall');
    },
    // what is installed, from the caches, against the index's versions (current: false is an older build's)
    async list() {
      if (!supported) return [];
      const idx = (await getIndex()) ?? {};
      const out = [];
      for (const [to, e] of Object.entries(idx)) {
        for (const o of await versions(e.slug)) {
          const m = await stored(e.slug, o.v).catch(() => null);
          if (m) out.push({ to, slug: e.slug, v: o.v, bytes: m.bytes, current: o.v === e.v });
        }
      }
      return out;
    },
    async estimate() {
      const e = await storage?.estimate?.().catch(() => null);
      return { used: e?.usage ?? 0, quota: e?.quota ?? 0 };
    },
  };
}

let one = null;
// the browser's installer, made once (null where there is no window)
export function installer() {
  if (one) return one;
  if (typeof window === 'undefined') return null;
  const nav = window.navigator;
  let caches = null;
  try {
    caches = window.caches ?? null;
  } catch {
    /* (an insecure context, or storage blocked) */
  }
  const remember = {
    get: (k) => {
      try {
        return window.localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set: (k, v) => {
      try {
        window.localStorage.setItem(k, v);
      } catch {
        /* storage unavailable */
      }
    },
  };
  one = createInstaller({
    fetch: window.fetch.bind(window),
    caches,
    storage: nav.storage ?? null,
    remember,
    // the service worker on before the first install, off after the last pack goes
    prepare: () => workerSwitch()?.need(),
    // and it reads the caches again
    notify: (what) => {
      nav.serviceWorker?.controller?.postMessage({ type: 'tp-packs' });
      if (what === 'uninstall') workerSwitch()?.tidy();
      window.dispatchEvent(new Event('tp:packs'));
    },
  });
  return one;
}

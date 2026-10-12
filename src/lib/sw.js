// The service worker's switch (public/sw.js serves installed worlds' packs).
// It is registered only for a visitor who has a world installed, or is
// installing one (src/runtime/install.js), and goes again with the last
// pack, so everyone else's visits are as they were. Never in development.
//
// (lane N4) and for a visitor playing a level world: playing(world) brings
// the worker up and tells it the world (a `tp-play` message), so it keeps
// that world's hashed pack files under its cap (public/sw.js); a visitor
// with a world kept so is brought back on the next visit too.
//
// createWorkerSwitch({ nav, caches, prod, base }) → { start(), need(), tidy(), playing(world) };
// (base: the asset bucket's URL, VITE_ASSET_BASE, told to the worker in its
// script's URL, so it may serve that bucket's files of an installed pack)
// registerWorker() is start() on the browser's.

const URL_ = '/sw.js';
const PREFIX = 'tp-pack-';
const PLAY = 'tp-play-';
// (with or without a base in its query)
const isOurs = (url) => Boolean(url) && new URL(url, 'http://x').pathname === URL_;

export function createWorkerSwitch({ nav, caches, prod, base = '' }) {
  const script = base ? `${URL_}?base=${encodeURIComponent(base)}` : URL_;
  let registering = null;
  const ok = () => prod && Boolean(nav?.serviceWorker);
  const any = async () => ((await caches?.keys().catch(() => [])) ?? []).some((n) => n.startsWith(PREFIX) || (n.startsWith(PLAY) && n !== `${PLAY}meta`));
  const need = () => {
    if (!ok()) return Promise.resolve(null);
    registering ??= nav.serviceWorker.register(script, { scope: '/' }).catch(() => {
      registering = null;
      return null;
    });
    return registering;
  };
  return {
    // at start: back on for a visitor with a world installed
    start: async () => (ok() && (await any()) ? need() : null),
    need,
    // (lane N4) the world being played, told to the worker once it is up
    async playing(world) {
      let reg = await need();
      if (!reg) return null;
      // (a worker registered just now is not active yet: told once it is)
      if (!nav.serviceWorker.controller && !reg.active && nav.serviceWorker.ready) reg = (await nav.serviceWorker.ready.catch(() => null)) ?? reg;
      const to = nav.serviceWorker.controller ?? reg.active ?? null;
      to?.postMessage?.({ type: 'tp-play', world });
      return reg;
    },
    // after an uninstall: off once nothing is installed
    async tidy() {
      if (!ok() || (await any())) return;
      registering = null;
      const regs = await nav.serviceWorker.getRegistrations?.().catch(() => []);
      for (const r of regs ?? []) if (isOurs((r.active ?? r.waiting ?? r.installing)?.scriptURL)) await r.unregister().catch(() => {});
    },
  };
}

let one = null;
export function workerSwitch() {
  if (one) return one;
  if (typeof window === 'undefined') return null;
  let caches = null;
  try {
    caches = window.caches ?? null;
  } catch {
    /* (storage blocked) */
  }
  one = createWorkerSwitch({ nav: window.navigator, caches, prod: import.meta.env.PROD, base: import.meta.env.VITE_ASSET_BASE ?? '' });
  return one;
}

export const registerWorker = () => workerSwitch()?.start() ?? Promise.resolve(null);

// (lane N4) the level world being played, told to the worker
export const playWorld = (world) => workerSwitch()?.playing(world) ?? Promise.resolve(null);

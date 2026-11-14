// The galaxy ships’ hulls for the hits, loaded beside their models: one small
// bin a kind (public/models/galaxy/hulls/, src/data/galaxyHulls.json says
// which exist), read by lib/combat/hulls.js. A kind’s hull is null until it
// has loaded and stays null if it never does (a 404, a bucket that is down, a
// bin that fails hullOf’s checks): that ship keeps today’s sphere, and the
// failure is logged once, never thrown. The Nebulon-B drawn from its close-up
// cut (models.js: a row with `hq: true`) has the hull of that cut, hq/nebulon;
// a hunter drawn as none of the galaxy’s cuts would be hunter/<kind>, asked
// for by that key (none since lane C2: the hunters’ Slave I is the galaxy’s).
//
// createHulls({ load, models }) → { want(kinds), get(kind) → Hull | null, dispose() }
//   load: loadBytes’s shape (path, { signal }) → Promise<ArrayBuffer>;
//   models: kind → row, the rows’ `hq` picking the key (models.js hands in MODELS)

import HULLS from '../../data/galaxyHulls.json';
import { loadBytes } from '../../lib/assetLoad';
import { halfTurn, hullOf } from '../../lib/combat/hulls';

// the game's hulls fitted to a model drawn tail first, the model turned nose
// first since (models.js's MODELS: the MC80 and the Nebulon-B, whose hulls
// are the bucket's): each turned half round with its model. (The site's own
// hulls of the Lucrehulk, the Arquitens and the close-up Nebulon-B are
// committed turned.)
export const TURNED = new Set(['moncal', 'nebulon']);

export function createHulls({ load = loadBytes, models = {} } = {}) {
  const keyOf = (kind) => (models[kind]?.hq ? `hq/${kind}` : kind);
  const made = new Map(); // key → Hull
  const asked = new Set(); // keys fetched (or being), failures too: once each
  const ctrl = new AbortController();

  const fetchKey = (key) => {
    asked.add(key);
    // (load may throw as well as reject: both are a failed fetch)
    let p;
    try {
      p = Promise.resolve(load(`/models/galaxy/hulls/${key}.bin`, { signal: ctrl.signal }));
    } catch (e) {
      p = Promise.reject(e);
    }
    p.then((bin) => {
      const read = hullOf(bin); // (throws on a malformed hull)
      const hull = TURNED.has(key) ? halfTurn(read) : read;
      if (!ctrl.signal.aborted) made.set(key, hull);
    }).catch((e) => {
      if (e?.name === 'AbortError' || ctrl.signal.aborted) return;
      console.warn(`galaxy hull ${key}: not loaded, the ship keeps its sphere (${e?.missing ? 'missing' : (e?.message ?? e)})`);
    });
  };

  return {
    want(kinds) {
      if (ctrl.signal.aborted) return;
      for (const kind of kinds) {
        const key = keyOf(kind);
        if (HULLS[key] && !asked.has(key)) fetchKey(key);
      }
    },
    get: (kind) => made.get(keyOf(kind)) ?? null,
    dispose() {
      ctrl.abort();
      made.clear();
    },
  };
}

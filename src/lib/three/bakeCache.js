// A floor bake kept between visits. The bake is the slow part of landing in
// a world, and for the same place, sun, tier and casters it comes out the
// same, so its mask is kept in IndexedDB and read back instead.
//
// Everything here fails quietly: no IndexedDB (Node, some private windows),
// a quota that's full, a blocked database all resolve null, and the caller
// bakes as it always did.

const DB = 'tp-bakes';
const STORE = 'masks';

// bumped whenever the bake itself changes, so old masks are never read back
export const BAKE_VERSION = 1;
// the most masks kept; the oldest go first
const KEEP = 24;
// the most bytes of masks kept, as well; the oldest go first
const KEEP_BYTES = 32 * 1024 * 1024;
// how long a lookup may hold the bake up before it's given up on
export const LOOKUP_MS = 400;

// FNV-1a over a string, as 8 hex digits
function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const r = (n, step) => Math.round(n / step) * step;
const nums = (a, step = 0.01) => (a ? Array.from(a, (v) => r(v, step).toFixed(2)).join(',') : '');

// What stands in the way of the light: each mesh's whole world matrix (to a
// hundredth, so a turn or a scale counts as well as a move), its vertex count,
// its box and whether it's shown, so anything added, swapped, moved, reshaped,
// hidden or shown gives another key.
function describeCasters(casters) {
  const parts = [];
  for (const root of casters ?? []) {
    root.updateMatrixWorld?.(true);
    root.traverse?.((o) => {
      if (!o.isMesh || !o.geometry) return;
      const g = o.geometry;
      const n = g.attributes?.position?.count ?? 0;
      if (!g.boundingBox && n) g.computeBoundingBox?.();
      const b = g.boundingBox;
      const box = b ? [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map((v) => r(v, 0.01).toFixed(2)).join(',') : '';
      const m = o.matrixWorld?.elements ? Array.from(o.matrixWorld.elements, (v) => r(v, 0.01).toFixed(2)).join(',') : '';
      // (hidden, it isn't drawn into the bake: one shown later is another mask)
      let shown = true;
      for (let x = o; x && shown; x = x.parent) shown = x.visible !== false;
      // (an instanced mesh is its count and where each instance stands)
      const inst = o.isInstancedMesh ? `*${o.count}#${fnv(nums(o.instanceMatrix?.array))}` : '';
      parts.push(`${n}[${box}]@${m}${inst}${shown ? '' : ':hidden'}`);
    });
  }
  return parts;
}


// The key for a bake, or null where the bake can't be told apart from
// another (no world or sun named): then nothing is cached. `area`, `range`
// and `params` (the tier's size and sample counts) are what the bake was
// asked for.
export function bakeKey({ world, place, sun, tier, casters, area = null, range = null, params = null } = {}) {
  if (!world || !sun) return null;
  const s = nums([sun.x, sun.y, sun.z]);
  const a = area ? nums([area.x0, area.z0, area.w, area.d]) : '';
  const p = params ? [params.size, params.sun, params.sky, params.shadow].join(':') : '';
  return `v${BAKE_VERSION}/${world}/${place ?? ''}/${tier ?? ''}/${s}/${a}/${nums(range)}/${p}/${fnv(describeCasters(casters).join('|'))}`;
}

// opens the database; null on any failure. A database that opens after the
// caller has stopped waiting is closed, never left held.
function open() {
  return new Promise((resolve) => {
    let done = false;
    const finish = (db) => {
      if (done) {
        db?.close();
        return;
      }
      done = true;
      resolve(db);
    };
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB) return finish(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        try {
          req.result.createObjectStore(STORE);
        } catch {
          // (already there)
        }
      };
      req.onsuccess = () => finish(req.result);
      req.onerror = () => finish(null);
      req.onblocked = () => finish(null);
    } catch {
      finish(null);
    }
  });
}

// { width, height, data } as it was put, or null (also when the database
// doesn't answer within LOOKUP_MS)
export async function getBake(key) {
  if (!key) return null;
  const opened = open();
  let timer = null;
  let late = false;
  const work = opened.then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(null);
        if (late) {
          db.close();
          return resolve(null);
        }
        const end = (v) => {
          try {
            db.close();
          } catch {
            // (closed already)
          }
          resolve(v);
        };
        try {
          const tx = db.transaction(STORE, 'readonly');
          const req = tx.objectStore(STORE).get(key);
          tx.onabort = () => end(null);
          tx.onerror = () => end(null);
          req.onsuccess = () => {
            const v = req.result;
            end(v && v.data && v.width && v.height ? v : null);
          };
          req.onerror = () => end(null);
        } catch {
          end(null);
        }
      }),
  );
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      late = true;
      resolve(null);
    }, LOOKUP_MS);
  });
  try {
    return await Promise.race([work, timeout]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// keeps the mask (and drops the oldest past KEEP); resolves true when it was
// written, false where it couldn't be
export async function putBake(key, { width, height, data } = {}) {
  if (!key || !data) return false;
  const db = await open();
  if (!db) return false;
  return new Promise((resolve) => {
    let ok = false;
    const end = () => {
      try {
        db.close();
      } catch {
        // (closed already)
      }
      resolve(ok);
    };
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.put({ width, height, data, at: Date.now() }, key);
      const seen = [];
      const cur = store.openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (c) {
          seen.push({ k: c.key, at: c.value?.at ?? 0, bytes: c.value?.data?.byteLength ?? 0 });
          c.continue();
          return;
        }
        seen.sort((x, y) => y.at - x.at);
        // (newest first; the one just put always stays)
        let bytes = 0;
        seen.forEach((e, i) => {
          bytes += e.bytes;
          if (i > 0 && (i >= KEEP || bytes > KEEP_BYTES)) store.delete(e.k);
        });
      };
      tx.oncomplete = () => {
        ok = true;
        end();
      };
      tx.onerror = tx.onabort = end;
    } catch {
      end();
    }
  });
}

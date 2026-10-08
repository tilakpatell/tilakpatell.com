// What the universe map fetches as the ship comes near, on a grid
// (lib/three/chunks): the planets' near maps and finer spheres
// (nearMaps.js's nearItems) and deep space's models (deepspace.js's
// `models`: the Citadel's). Each item sits in the cell of the map's XZ plane
// its middle is in. A cell whose nearest edge is within `near` of the
// camera, or of a point `ahead` of it along the way it's going, is built
// (its items fetched) and prepared (the scene's `prepare`: their pictures
// sent and their shaders made, a little at a time, with a fence after each)
// before anything in it is shown, so nothing new is sent or made in the
// frame it first appears. What's shown goes by the camera alone: a made
// cell is shown once its edge is within `near` of the camera and hidden
// (its planets back in their own maps) once it's past `far`; the grid lets
// it go past twice `far` (from the camera or the point ahead).
//
// Not everything is kept, as a world's props are: the near maps are big (a
// planet's -hq set 11 to 100 MB on the graphics chip, about 265 MB for all
// of them on high). So at most `max` cells holding a planet's near set (an
// item marked `heavy`) are held, two as before: a third, nearer than one
// held, has the furthest let go to make room; one further off than all of
// them waits till it's nearer than one of them (or one goes).
//
//   createNearGrid({ items, prepare, onReady, size, near, far, ahead, max })
//       → { update(at), settle(at, { alive, cap }), shown(), dispose() }
//   (each item: { id, at: [x, y, z], heavy?, build() → Promise<{ id, textures?, roots?, show(on), dispose() }> })
//   (`at` and the items' places are in the map's own space)

import { cellKey, cellOf, createChunks } from '../../lib/three/chunks';

const parse = (key) => key.split(',').map(Number);

// a cell is 1500 map units across (the planets with near maps are 10,000 or
// more apart, the Rick and Morty sector's moons 1000 to 3000). One is made
// once its edge is 1500 from the camera, or from the point 3000 ahead (so
// up to 4500 out on the way in: at the pulse drive's 300 a second, seconds
// to come, and the drive eases off on the way in anyway); shown from 1500
// of the camera, hidden past 2400, let go past 4800
export const GRID = { size: 1500, near: 1500, far: 2400, ahead: 3000, max: 2 };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function createNearGrid({ items = [], prepare = async () => {}, onReady = () => {}, size = GRID.size, near = GRID.near, far = GRID.far, ahead = GRID.ahead, max = GRID.max } = {}) {
  const byCell = new Map();
  for (const item of items) {
    const { ix, iz } = cellOf(item.at[0], item.at[2], size);
    const key = cellKey(ix, iz);
    if (!byCell.has(key)) byCell.set(key, []);
    byCell.get(key).push(item);
  }
  const handles = new Map(); // key → its cell's handle, from built till let go
  let busy = 0; // cells being built or prepared
  let started = 0; // builds begun, ever (settle: whether an update began one)
  let idle = null; // resolves when busy comes back to 0
  let gone = false;
  const last = { x: 0, z: 0, set: false };
  const heading = { x: 0, z: 0 };
  const deferred = new Set(); // heavy cells refused for want of room

  // how far the camera is from a cell's nearest edge (0 inside it)
  const camDist = (key) => {
    const [ix, iz] = parse(key);
    const dx = Math.max(ix * size - last.x, 0, last.x - (ix + 1) * size);
    const dz = Math.max(iz * size - last.z, 0, last.z - (iz + 1) * size);
    return Math.hypot(dx, dz);
  };
  const heavy = (key) => (byCell.get(key) ?? []).some((i) => i.heavy);
  // the furthest of the heavy cells held, if they're `max` already
  const full = () => {
    const held = [...handles.keys()].filter(heavy);
    if (held.length < max) return null;
    return held.reduce((a, b) => (camDist(a) >= camDist(b) ? a : b));
  };
  // Room for a heavy cell: the furthest held let go if this one's nearer;
  // false if it's the furthest.
  const makeRoom = (key) => {
    for (let worst = full(); worst; worst = full()) {
      if (camDist(worst) <= camDist(key)) return false;
      chunks.forget(worst);
      handles.get(worst)?.dispose(); // (one still being made: let go now all the same)
    }
    return true;
  };

  const settled = () => {
    if (busy > 0 || !idle) return;
    const done = idle.resolve;
    idle = null;
    done();
  };
  // a cell made (or given up on): once the grid has marked it, the scene
  // draws again, so the next update shows it
  const finish = () => {
    busy--;
    setTimeout(() => {
      settled();
      if (!gone) onReady();
    }, 0);
  };

  // A cell's items fetched. One that fails lets the rest go and fails the
  // cell, which the grid tries again a little later (three tries in all).
  async function build(key) {
    busy++;
    started++;
    try {
      if (heavy(key) && !makeRoom(key)) {
        deferred.add(key);
        throw new Error('no room for another near set');
      }
      deferred.delete(key);
      const list = byCell.get(key) ?? [];
      const got = await Promise.allSettled(list.map((item) => item.build()));
      const parts = got.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value);
      const failed = got.find((r) => r.status === 'rejected');
      if (failed) {
        for (const p of parts) p.dispose();
        throw failed.reason;
      }
      let on = false;
      let pending = true; // (counted in `busy` till prepared, or let go first)
      let dead = false;
      const handle = {
        parts,
        get on() {
          return on;
        },
        set(v) {
          if (v === on || dead) return;
          on = v;
          for (const p of parts) p.show(v);
        },
        done() {
          if (!pending) return;
          pending = false;
          finish();
        },
        dispose() {
          if (dead) return;
          if (handles.get(key) === handle) handles.delete(key);
          if (on) handle.set(false);
          dead = true;
          handle.done();
          for (const p of parts) {
            try {
              p.dispose();
            } catch {
              // (one that won't go is forgotten anyway)
            }
          }
        },
      };
      handles.set(key, handle);
      return handle;
    } catch (err) {
      finish();
      throw err;
    }
  }

  async function prep(handle) {
    try {
      if (!gone) await prepare(handle.parts);
    } finally {
      handle.done();
    }
  }

  const chunks = createChunks({ size, near, far, ahead, cells: [...byCell.keys()], build, prepare: prep });

  let calls = 0;
  function update(at) {
    calls++;
    if (gone || !byCell.size) return;
    if (last.set) {
      const dx = at.x - last.x;
      const dz = at.z - last.z;
      // (a jump, through a portal or out of a dive, says nothing of the way it's going)
      if (Math.hypot(dx, dz) < size) {
        heading.x = dx;
        heading.z = dz;
      } else heading.x = heading.z = 0;
    }
    last.x = at.x;
    last.z = at.z;
    last.set = true;
    chunks.update(at, heading);
    // shown by the camera's distance alone (the point ahead only says what to make)
    const ready = new Set(chunks.cells());
    for (const [key, h] of handles) {
      const d = camDist(key);
      const v = ready.has(key) && (d <= near || (h.on && d <= far));
      if (v !== h.on) h.set(v);
    }
    // a refused cell, once there's room for it or it's nearer than the
    // furthest held: made afresh (its tries back to none) when next wanted
    for (const key of deferred) {
      const worst = full();
      // (and one gone well out of range is forgotten too: nothing to wait for)
      if (!worst || camDist(key) < camDist(worst) || camDist(key) > 2 * far) {
        deferred.delete(key);
        chunks.forget(key);
      }
    }
  }

  // Behind the loading veil: every cell wanted where the camera is now made
  // and shown before the first frame, or `cap` ms, whichever comes first.
  async function settle(at, { alive = () => true, cap = 8000 } = {}) {
    const t0 = Date.now();
    for (;;) {
      if (gone || !alive()) return;
      const was = started;
      update(at);
      // (nothing begun and nothing in hand: all that's wanted is made, or failed)
      if (busy === 0 && started === was) return;
      const left = cap - (Date.now() - t0);
      if (left <= 0) return;
      if (busy === 0) {
        // (one begun and already over, refused or failed: the grid takes note, then the next)
        await wait(0);
        continue;
      }
      if (!idle) {
        let resolve;
        const promise = new Promise((r) => (resolve = r));
        idle = { promise, resolve };
      }
      let timer;
      await Promise.race([idle.promise, new Promise((r) => (timer = setTimeout(r, left)))]);
      clearTimeout(timer);
    }
  }

  return {
    update,
    settle,
    // (for a look from the console: what's busy, made and shown)
    debug: () => ({ calls, gone, cells: byCell.size, busy, made: chunks.cells(), shown: [...handles.entries()].filter(([, h]) => h.on).map(([k]) => k), last: { ...last } }),
    // the ids of the items being shown
    shown: () => [...handles.values()].filter((h) => h.on).flatMap((h) => h.parts.map((p) => p.id)),
    dispose() {
      gone = true;
      chunks.dispose();
      for (const h of [...handles.values()]) h.dispose();
      handles.clear();
    },
  };
}

// A planet's maps by how near it is. Every planet wears its standard maps
// from the start (planets.js's loadTextures: 1024 on a desktop), which is
// right across the map and soft up close: parked 2.4 radii out, a planet
// fills 600 pixels with a quarter of its surface, 256 texels of a 1024 map.
// So the planets the ship comes within six radii of get their near set
// (planets.js's nearSet: the -hq copies, and on ultra the -xl colour map,
// or the 8192 -8k where one has been baked: planetMaps.js's K8),
// and their finer sphere with it (nearGeometry); at most two at once, the
// furthest dropped (its textures disposed) when a third comes near. A set
// that arrives after the ship has gone on is never installed, only freed.
// Nothing changes on low or on a phone.
//
//   wanted(shipAt, planets, { near, hold, resident }) → ids within `near`
//       radii (or `hold` for one already resident), nearest first
//   evict(resident, wanted, max) → { keep, drop }
//   createNearMaps({ level, small, load, forget, resident, near, upload })
//   (`upload(textures) → Promise`: a set sent to the graphics chip a slice at a
//   time before it's put on, rather than all in the frame it's swapped in)
//       → { update(shipAt, planets), resident(), dispose() }
//   (each planet: { id, at | group, r | radius, nearSet(level), swapMaps(T2 | null), nearGeometry(on) })

import * as THREE from 'three';
import { forgetTexture, loadTexture } from '../../lib/three/textures';
import { detailLevel } from '../../lib/detail';
import { wrapRound } from './planetMaps';

const BASE = '/textures/universe/';
const NEAR = 6;
// (a planet already holding its set keeps it out to here, so the edge of
// the near range doesn't load and drop it over and over)
const HOLD = 1.25;

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function wanted(shipAt, planets, { near = NEAR, hold = near, resident = [] } = {}) {
  const held = new Set(resident);
  return planets
    .map((p) => ({ id: p.id, k: dist(shipAt, p.at) / p.r }))
    .filter(({ id, k }) => k <= (held.has(id) ? Math.max(near, hold) : near))
    .sort((a, b) => a.k - b.k)
    .map(({ id }) => id);
}

export function evict(resident, want, max) {
  const keep = want.slice(0, max);
  return { keep, drop: resident.filter((id) => !keep.includes(id)) };
}

const NONE = { update() {}, resident: () => [], dispose() {} };

export function createNearMaps({ level = detailLevel(), small = false, load = loadTexture, forget = forgetTexture, resident: max = 2, near = NEAR, upload = null } = {}) {
  if (level === 'low' || small) return NONE;
  // (DEV: off, to measure what they cost: scripts/universe-check.mjs --near off)
  if (import.meta.env?.DEV && globalThis.localStorage?.getItem('tp-near') === 'off') return NONE;
  // id → { planet, state: 'loading' | 'on', T2, urls }
  const sets = new Map();
  let gone = false;
  const v = new THREE.Vector3();
  const lists = new Map(); // planet → its near set (worked out once)

  // (a file a newer set for the same planet has asked for too stays: the
  // loader's cache hands both sets the one texture)
  const held = (url, s) => [...sets.values()].some((o) => o !== s && o.asked.has(url));
  const free = (s) => {
    for (const [name, t] of Object.entries(s.T2 ?? {})) {
      if (held(s.urls[name], s)) continue;
      t.dispose?.();
      forget(s.urls[name]);
    }
    s.T2 = null;
  };
  const drop = (id) => {
    const s = sets.get(id);
    sets.delete(id);
    if (s?.state !== 'on') return; // (one still loading is freed when it lands)
    s.planet.swapMaps?.(null);
    s.planet.nearGeometry?.(false);
    free(s);
  };
  // the first of a map's files that loads, or nothing
  const fetchOne = async (s, { name, file, fallback, colour }) => {
    for (const f of [file, fallback].filter(Boolean)) {
      s.asked.add(BASE + f);
      try {
        return { url: BASE + f, t: wrapRound(name, await load(BASE + f, { color: colour })) };
      } catch {
        // (the next file down, or the planet keeps its standard map)
      }
    }
    return null;
  };
  const start = (p, list) => {
    const s = { planet: p, state: 'loading', T2: {}, urls: {}, asked: new Set() };
    sets.set(p.id, s);
    Promise.all(list.map(async (m) => [m.name, await fetchOne(s, m)])).then(async (got) => {
      for (const [name, r] of got) {
        if (!r) continue;
        s.T2[name] = r.t;
        s.urls[name] = r.url;
      }
      if (upload && !gone && sets.get(p.id) === s) {
        try {
          await upload(Object.values(s.T2));
        } catch {
          // (they go up as they're drawn instead)
        }
      }
      // (gone on, dropped for a nearer one, or the scene's gone: never installed)
      if (gone || sets.get(p.id) !== s) return free(s);
      s.state = 'on';
      if (Object.keys(s.T2).length) p.swapMaps?.(s.T2);
      p.nearGeometry?.(true, level);
    });
  };

  return {
    update(shipAt, planets) {
      if (gone) return;
      const ps = [];
      for (const p of planets) {
        if (!lists.has(p)) lists.set(p, p.nearSet?.(level) ?? []);
        const list = lists.get(p);
        if (!list.length && !p.nearGeometry) continue;
        // (where it is in the world: a built planet's group, wherever the map's turned it)
        const c = p.at ?? p.group.getWorldPosition(v).toArray();
        ps.push({ id: p.id, at: c, r: p.r ?? p.radius, p, list });
      }
      const ship = Array.isArray(shipAt) ? shipAt : [shipAt.x, shipAt.y, shipAt.z];
      const want = wanted(ship, ps, { near, hold: near * HOLD, resident: [...sets.keys()] });
      const { keep, drop: out } = evict([...sets.keys()], want, max);
      for (const id of out) drop(id);
      for (const id of keep) {
        if (sets.has(id)) continue;
        const { p, list } = ps.find((q) => q.id === id);
        start(p, list);
      }
    },
    resident: () => [...sets.entries()].filter(([, s]) => s.state === 'on').map(([id]) => id),
    dispose() {
      gone = true;
      for (const id of [...sets.keys()]) drop(id);
    },
  };
}

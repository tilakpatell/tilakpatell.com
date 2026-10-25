// The sectors past the loaded 3×3, as star specks: every system in the
// ring of sectors two and three out (Chebyshev) is a point of light on the
// sky (farStars.js), one Points for them all, a little dimmer and a little
// bigger than a loaded sector's, so they read as the distant field. Sector
// (0, 0) is the authored map and is never one of them. The positions sit
// in a frame centred on the middle sector, moved to it relative to the
// floating origin, as sectors.js's do.
//
// It is the rim's field, made on the main thread, and it goes with the rim:
// once expanse.js asks the worker for the rings beyond (gen/job.js's
// beyondKeys and beyondJob) and draws them in the far layer, nothing calls
// this, and it and its tests go.
//
// beyondPlaces(universe, sx, sz, { inner = 1, outer = 3 }) → [{ id, at (map), r, color }]
//   every system in a sector inner < d ≤ outer from (sx, sz)
// createStarfield(parent, { skyFar = SKY_FAR })
//   → { rebuild(universe, sx, sz, at), update(camera, dt), reanchor(at), dispose(), size() }

import * as THREE from 'three';
import { SKY_FAR } from '../../universe/deepspace';
import { createFarStars } from '../../universe/farStars';
import { sectorCentre } from '../gen/grid';
import { makeSector } from '../gen/sector';

const SCALE = 1.5; // a far star's speck, of its size
const DIM = 0.7; // and its brightness
const KEEP = 128; // sectors remembered

const cache = new Map();
function sectorOf(universe, sx, sz) {
  const key = `${universe}:${sx},${sz}`;
  let s = cache.get(key);
  if (s) {
    cache.delete(key); // (to the back: the most recently used)
    cache.set(key, s);
    return s;
  }
  s = makeSector(universe, sx, sz);
  cache.set(key, s);
  if (cache.size > KEEP) cache.delete(cache.keys().next().value);
  return s;
}

const dim = (hex) => `#${new THREE.Color(hex).multiplyScalar(DIM).getHexString()}`;

export function beyondPlaces(universe, sx, sz, { inner = 1, outer = 3 } = {}) {
  const out = [];
  for (let dx = -outer; dx <= outer; dx++)
    for (let dz = -outer; dz <= outer; dz++) {
      const d = Math.max(Math.abs(dx), Math.abs(dz));
      const x = sx + dx;
      const z = sz + dz;
      if (d <= inner || (x === 0 && z === 0)) continue;
      for (const s of sectorOf(universe, x, z).systems) out.push({ id: s.id, at: s.at, r: s.star.size * SCALE, color: dim(s.star.color) });
    }
  return out;
}

export function createStarfield(parent, { skyFar = SKY_FAR } = {}) {
  const group = new THREE.Group();
  group.name = 'starfield';
  parent.add(group);
  let far = null;
  let n = 0;
  let centre = [0, 0, 0];
  const api = {
    rebuild(universe, sx, sz, at) {
      far?.dispose();
      centre = sectorCentre(sx, sz);
      const places = beyondPlaces(universe, sx, sz).map((p) => ({ ...p, at: [p.at[0] - centre[0], p.at[1] - centre[1], p.at[2] - centre[2]] }));
      n = places.length;
      far = createFarStars(group, { places, skyFar });
      api.reanchor(at);
    },
    update(camera, dt) {
      far?.update(camera, dt);
    },
    reanchor(at) {
      group.position.set(centre[0] - at[0], centre[1] - at[1], centre[2] - at[2]);
    },
    dispose() {
      far?.dispose();
      far = null;
      n = 0;
      group.removeFromParent();
    },
    size: () => n,
  };
  return api;
}

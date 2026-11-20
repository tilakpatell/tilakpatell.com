// The generated planets round the ship, for the nav map's marks (./genMarks.js):
// the scene's, through its where(). Pure (no React, DOM or three.js); it
// reaches the generator, so only the scene imports it.
//
// planetsAround(sectors, ship, t, { surveyed }) → [{ id, name, at, color, tags }]: the planets of the
//   loaded sectors within GEN_MARKS.range, the GEN_MARKS.most nearest first; color their own look's
//   swatch, tags their traits' (lib/space/traits.js), with 'surveyed' first for one in the log

import { orbitAt } from '../../expanse/shared/gen';
import { planetSwatch } from '../../../lib/space/planetLook.js';
import { planetTraits } from './cards';
import { GEN_MARKS } from './genMarks';

const traits = new Map(); // (by id: a planet's traits are its seed's, made once a visit; the last 2,048)
function tagsOf(p, sys) {
  let t = traits.get(p.id);
  if (!t) {
    t = planetTraits(p, sys).tags;
    if (traits.size >= 2048) traits.delete(traits.keys().next().value);
    traits.set(p.id, t);
  }
  return t;
}

export function planetsAround(sectors, ship, t = 0, { surveyed = null } = {}) {
  if (!ship || !Number.isFinite(ship.x)) return [];
  const r2 = GEN_MARKS.range * GEN_MARKS.range;
  const found = [];
  for (const s of sectors ?? []) {
    for (const sys of s.systems ?? []) {
      const dx = sys.at[0] - ship.x;
      const dy = sys.at[1] - ship.y;
      const dz = sys.at[2] - ship.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > r2) continue;
      for (const p of sys.planets ?? []) found.push({ p, sys, d2 });
    }
  }
  found.sort((a, b) => a.d2 - b.d2 || (a.p.id < b.p.id ? -1 : 1));
  return found.slice(0, GEN_MARKS.most).map(({ p, sys }) => {
    const tags = tagsOf(p, sys);
    return { id: p.id, name: p.name, at: p.centre ? orbitAt(p, t) : p.at, color: planetSwatch(p), tags: surveyed?.has?.(p.id) ? ['surveyed', ...tags] : tags };
  });
}

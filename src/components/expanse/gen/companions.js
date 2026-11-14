// Binary and trinary systems: a star's companions, from its own seed, so its
// planets are the same whether it has one or not. They go round inside the
// first planet's way: planetsOf puts the first planet at exactly three star
// sizes, so the room between the star and its first planet's whole extent is
// at most two star sizes, and a companion is small (0.12 to 0.3 of the star).
// Pure (no three.js).
//
// COMPANIONS = { one, two, size: [least, most] of the primary, gap }
// companionsOf(system) → [{ k, class, color, size, orbit, phase, revs, tilt }], each
//   whole sphere within [star size + gap, first planet's orbit − its extent − gap] of the
//   star's middle, so it keeps `gap` off its star and every planet at every t. Memoised by
//   the system's seed (the last 512), never its id, which a pocket universe shares.
// companionAt(c, system, t) → [x, y, z]: a circle round the star, tilted about x, on the
//   shared clock (a whole number of turns a cycle, as orbits.js's are)

import { extentOf } from './extent';
import { ORBIT_CYCLE, revsFor } from './orbits';
import { hash64, range, rngOf, weighted } from './seed';
import { STAR_CLASSES } from './tables';

export const COMPANIONS = Object.freeze({ one: 0.3, two: 0.08, size: [0.12, 0.3], gap: 4 });
const CLASSES = STAR_CLASSES.filter((c) => c.class !== 'O' && c.class !== 'B');
const TAU = 2 * Math.PI;

function make(system) {
  const rng = rngOf(hash64(system.seed, 'companions'));
  const u = rng();
  const want = u < COMPANIONS.two ? 2 : u < COMPANIONS.one + COMPANIONS.two ? 1 : 0;
  const drawn = [];
  for (let k = 0; k < want; k++) {
    const cls = weighted(rng, CLASSES);
    const size = Math.min(range(rng, ...COMPANIONS.size) * system.star.size, cls.size[1]);
    drawn.push({ k, class: cls.class, color: cls.color, size, phase: rng() * TAU, tilt: range(rng, -0.3, 0.3) });
  }
  if (!drawn.length) return [];
  const { gap } = COMPANIONS;
  const lo = system.star.size + gap;
  let hi = 3 * system.star.size - gap;
  if (system.planets.length) hi = Math.min(...system.planets.map((p) => p.orbit - extentOf(p))) - gap;
  const room = hi - lo;
  if (drawn.length === 2 && 2 * drawn[0].size + gap + 2 * drawn[1].size > room) drawn.length = 1;
  if (2 * drawn[0].size > room) return [];
  const [a, b] = drawn;
  const need = 2 * a.size + (b ? gap + 2 * b.size : 0);
  const slack = room - need;
  a.orbit = lo + a.size + rng() * (b ? slack / 2 : slack);
  if (b) {
    const least = a.orbit + a.size + gap + b.size;
    b.orbit = least + rng() * (hi - b.size - least);
  }
  return drawn.map((c) => ({ ...c, revs: revsFor(c.orbit) }));
}

const memo = new Map();
export function companionsOf(system) {
  const key = String(system.seed);
  let c = memo.get(key);
  if (!c) {
    c = make(system);
    if (memo.size >= 512) memo.delete(memo.keys().next().value);
    memo.set(key, c);
  }
  return c;
}

export function companionAt(c, system, t) {
  const f = t / ORBIT_CYCLE;
  const a = c.phase + TAU * c.revs * (f - Math.floor(f));
  const x = c.orbit * Math.cos(a);
  const z = c.orbit * Math.sin(a);
  const cs = Math.cos(c.tilt);
  const sn = Math.sin(c.tilt);
  return [system.at[0] + x, system.at[1] - z * sn, system.at[2] + z * cs];
}

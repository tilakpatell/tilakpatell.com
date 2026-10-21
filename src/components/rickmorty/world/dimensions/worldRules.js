// What a place's world record (./worlds.js) may say, checked against the
// place it's for: pure, for the tests.
//
// worldProblems(d, world, { tris, tasks, blocks }) → what's wrong, in words (none: [])
//   - every crowd kind is in the cast (or one of the Citadel's light
//     copies, `crowd:<name>`) and counted in `tris`;
//   - no copy of a place's hunters, lookouts or named people in its box:
//     a hunter's or a lookout's kind stands 7 m beyond the edge at least, a
//     named person's 30 m (a room's outside is behind its glass: any
//     distance for the first, 30 m still for the second);
//   - a walker's loop in the box keeps off everything there (outskirts.js's
//     loopProblems); a gathering in the box stands on a block that's there;
//   - a crowd is gated only on tasks there are;
//   - a window is in a room's wall, under its ceiling;
//   - no family's own vehicle as traffic or a set piece; a set piece at most twice
// blocksSight(laid, from, to) → whether a lot or a skyline tower stands in
//   the line from `from` to `to` ([x, y, z])

import { MESHY } from '../../portal/meshyCastCore';
import { loopProblems } from './outskirts';

const NEAR = { hunter: 7, named: 30 };
const FAMILY = ['jerry-ship', 'spacebeth-ship', 'cruiser', 'gotron', 'dirlycar', 'vindicators-ship'];
const SIDES = ['n', 'e', 's', 'w'];

const outOf = (A, x, z) => Math.hypot(Math.max(A.x0 - x, x - A.x1, 0), Math.max(A.z0 - z, z - A.z1, 0));

export function worldProblems(d, world, { tris = {}, tasks = [], blocks = [] } = {}) {
  const out = [];
  const A = d.area;
  const room = d.kind === 'room';
  const W = ([dx, dz]) => [d.centre.x + dx, d.centre.z + dz];
  // who the place's people are, and who hunts or watches
  const named = new Set(d.people.map((p) => p.who ?? p.id));
  const hunters = new Set([...d.people.filter((p) => p.ai?.hunt || p.ai?.lookout).map((p) => p.who ?? p.id), ...d.extras.filter((e) => e.ai?.hunt || e.ai?.lookout).map((e) => e.kind)]);

  const entries = [...(world.crowd?.walk ?? []).map((c) => ({ ...c, walk: true })), ...(world.crowd?.gather ?? [])];
  for (const c of entries) {
    const what = c.walk ? 'a walker' : 'a gathering';
    for (const k of c.kinds) {
      if (!k.startsWith('crowd:') && !MESHY[k]) out.push(`${what}: ${k} is not in the cast`);
      else if (!tris[k]) out.push(`${what}: ${k} has no triangles counted`);
    }
    // how far beyond the edge it stands (0: in the box)
    const away = c.walk ? (c.loop === 'street' ? 4 : 0) : outOf(A, ...W(c.at)) - (c.r ?? 0);
    for (const k of c.kinds) {
      const behindGlass = room && away > 0;
      if (hunters.has(k) && !behindGlass && away < NEAR.hunter) out.push(`${what}: ${k} hunts or watches here: never nearer than ${NEAR.hunter} m beyond the edge`);
      if (named.has(k) && away < NEAR.named) out.push(`${what}: ${k} is one of the place's people: never nearer than ${NEAR.named} m beyond the edge`);
    }
    if (c.walk && Array.isArray(c.loop)) for (const p of loopProblems(d, c.loop)) out.push(`${what}'s loop: ${p}`);
    if (!c.walk && away <= 0) {
      const b = blocks.find((o) => o.id === c.block);
      if (!c.block) out.push(`a gathering in the box stands on no block`);
      else if (!b) out.push(`a gathering's block ${c.block} isn't there`);
      else if (Math.abs(c.at[0] - b.dx) + (c.r ?? 0) > b.w / 2 + 1e-9 || Math.abs(c.at[1] - b.dz) + (c.r ?? 0) > b.d / 2 + 1e-9) out.push(`a gathering is off its block ${c.block}`);
    }
    for (const t of [c.until, c.after].filter(Boolean)) if (!tasks.includes(t)) out.push(`${what} is gated on ${t}, which is no task`);
  }

  for (const w of world.windows ?? []) {
    if (!room) {
      out.push('an outdoor place has no windows');
      continue;
    }
    if (!SIDES.includes(w.wall)) {
      out.push(`a window on ${w.wall}, which is no wall`);
      continue;
    }
    const half = (w.wall === 'n' || w.wall === 's' ? A.x1 - A.x0 : A.z1 - A.z0) / 2;
    if (w.from < -half || w.to > half || w.from >= w.to) out.push(`a window is off its wall ${w.wall}`);
    if (w.y0 < 0 || w.y0 + w.h > (d.ceiling ?? Infinity)) out.push(`a window goes through the ceiling`);
  }

  const family = (model) => FAMILY.find((f) => model?.includes(f));
  for (const f of world.fliers ?? []) if (family(f.model)) out.push(`${family(f.model)} is a family's own: never traffic`);
  for (const side of SIDES)
    for (const s of world.ring?.[side]?.sets ?? []) {
      if (family(s.model)) out.push(`${family(s.model)} is a family's own: never a set piece`);
      if ((s.n ?? 0) > 2) out.push(`${s.model}: a set piece stands at most twice`);
    }
  return out;
}

// does the segment from `from` to `to` pass through a building, below its top?
export function blocksSight(laid, from, to) {
  const things = [...laid.lots.map((l) => ({ ...l, top: l.y + l.h })), ...laid.skyline.map((s) => ({ ...s, top: s.h, turn: 0 }))];
  const steps = 200;
  for (const b of things) {
    const across = Math.abs(Math.sin(b.turn ?? 0)) > 0.5;
    const hw = (across ? b.d : b.w) / 2;
    const hd = (across ? b.w : b.d) / 2;
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const x = from[0] + (to[0] - from[0]) * k;
      const y = from[1] + (to[1] - from[1]) * k;
      const z = from[2] + (to[2] - from[2]) * k;
      if (Math.abs(x - b.x) <= hw && Math.abs(z - b.z) <= hd && y <= b.top) return true;
    }
  }
  return false;
}

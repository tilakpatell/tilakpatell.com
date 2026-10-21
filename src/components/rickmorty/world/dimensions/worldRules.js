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
//   - no family's own vehicle as traffic or a set piece; a set piece at most twice;
//   - a place's own piece one of the set pieces' models, off every spot but its own (`own`);
//   - a landmark of a style there is, beyond the edge (or outside a room's walls);
//   - props, scatter and the edge only the town's kit models (`q:<node>`)
// blocksSight(laid, from, to) → whether a lot or a skyline tower stands in
//   the line from `from` to `to` ([x, y, z])

import { MESHY } from '../../portal/meshyCastCore';
import { loopProblems } from './outskirts';
import { STYLES } from './lots';
import { QUATERNIUS } from './surround';

const NEAR = { hunter: 7, named: 30 };
const SKY = 20; // metres up: a landmark that high is over the box, not in it
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
      // (a block of the world's, or one of the place's own solids: a walkway, a stage)
      const own = d.solids.find((o) => o.id === c.block && o.w != null);
      const b = blocks.find((o) => o.id === c.block) ?? (own && { dx: own.x - d.centre.x, dz: own.z - d.centre.z, w: own.w, d: own.d });
      if (!c.block) out.push(`a gathering in the box stands on no block`);
      else if (!b) out.push(`a gathering's block ${c.block} isn't there`);
      else if (!footOn(c, b)) out.push(`a gathering is off its block ${c.block}`);
    }
    for (const t of [c.until, c.after].filter(Boolean)) if (!tasks.includes(t)) out.push(`${what} is gated on ${t}, which is no task`);
  }

  for (const st of world.stands ?? []) {
    // (a stand turns a quarter at a time to face what it watches: its footprint, and how far it is from the box)
    const face = st.face === 'hero' ? (world.hero ?? [0, 0]) : (st.face ?? [0, 0]);
    const across = Math.abs(Math.sin(Math.round(Math.atan2(face[0] - st.at[0], face[1] - st.at[1]) / (Math.PI / 2)) * (Math.PI / 2))) > 0.5;
    const [x, z] = W(st.at);
    const hx = (across ? st.d : st.w) / 2;
    const hz = (across ? st.w : st.d) / 2;
    const near = Math.hypot(Math.max(A.x0 - (x + hx), x - hx - A.x1, 0), Math.max(A.z0 - (z + hz), z - hz - A.z1, 0));
    if (!room && near < NEAR.hunter) out.push(`a stand stands within ${NEAR.hunter} m of the edge`);
    for (const k of st.kinds) {
      if (!k.startsWith('crowd:') && !MESHY[k]) out.push(`a stand: ${k} is not in the cast`);
      else if (!tris[k]) out.push(`a stand: ${k} has no triangles counted`);
      if (named.has(k) && near < NEAR.named) out.push(`a stand: ${k} is one of the place's people: never nearer than ${NEAR.named} m beyond the edge`);
    }
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

  for (const m of world.landmarks ?? []) {
    if (!STYLES.includes(m.style)) out.push(`a landmark's style ${m.style} is no style`);
    const [x, z] = W(m.at);
    const near = Math.hypot(Math.max(A.x0 - (x + m.w / 2), x - m.w / 2 - A.x1, 0), Math.max(A.z0 - (z + m.d / 2), z - m.d / 2 - A.z1, 0));
    // (one high in the sky is over everyone's head, wherever it is)
    if ((m.y ?? 0) < SKY && near < (room ? 1 : 8)) out.push(`a landmark stands within ${room ? 'the room' : '8 m of the edge'}`);
  }
  const kitModel = (m) => m?.startsWith('q:') && QUATERNIUS[m.slice(2)];
  for (const m of [...(world.scatter ?? []).map((o) => o.model), ...(world.forecourt?.props ?? []).map((o) => o.model), ...(world.edge?.models ?? [])]) if (!kitModel(m)) out.push(`${m} is none of the kit's models`);

  const family = (model) => FAMILY.find((f) => model?.includes(f));
  for (const f of world.fliers ?? []) if (family(f.model)) out.push(`${family(f.model)} is a family's own: never traffic`);
  for (const p of world.pieces ?? []) {
    if (!p.model?.startsWith('/models/c137/')) out.push(`${p.model}: a place's own piece is one of the set pieces' models`);
    else if (family(p.model)) out.push(`${family(p.model)} is a family's own: never a set piece`);
    // (a piece's footprint, a metre round at least, off every spot's reach)
    const [x, z] = W(p.at);
    const half = Math.max(1, Math.hypot(p.w ?? 0, p.d ?? 0) / 2);
    // (but its own: the siren by its pull, the car by its look)
    if (p.own && !d.hotspots.some((s) => s.id === p.own)) out.push(`a piece's own spot ${p.own} isn't there`);
    for (const s of d.hotspots) if (s.id !== p.own && Math.hypot(s.x - x, s.z - z) < (s.r ?? 1.4) + half) out.push(`a piece stands on the spot ${s.id}`);
  }
  for (const side of SIDES)
    for (const s of world.ring?.[side]?.sets ?? []) {
      if (family(s.model)) out.push(`${family(s.model)} is a family's own: never a set piece`);
      if ((s.n ?? 0) > 2) out.push(`${s.model}: a set piece stands at most twice`);
    }
  return out;
}

// does a gathering stand on its block: a disc inside it, or a row's two ends?
function footOn(c, b) {
  const inside = (x, z, pad) => Math.abs(x - b.dx) + pad <= b.w / 2 + 1e-9 && Math.abs(z - b.dz) + pad <= b.d / 2 + 1e-9;
  if (!c.row) return inside(c.at[0], c.at[1], c.r ?? 0);
  const face = Array.isArray(c.face) ? c.face : [0, 0];
  const a = Math.atan2(face[1] - c.at[1], face[0] - c.at[0]) + Math.PI / 2;
  const u = c.row / 2;
  return inside(c.at[0] + Math.cos(a) * u, c.at[1] + Math.sin(a) * u, 0) && inside(c.at[0] - Math.cos(a) * u, c.at[1] - Math.sin(a) * u, 0);
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

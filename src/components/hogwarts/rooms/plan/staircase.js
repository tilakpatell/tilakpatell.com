// The Grand Staircase’s plan (the design’s §4.4), in metres in the room’s
// own frame: the shaft’s floor in the middle at the origin, +y up, eight
// floors five metres apart, a landing on the west wall and one on the east
// on every floor (rules/staircases.js names them), each a stone platform
// with its doorway behind it. Landings alternate north and south of the
// middle floor by floor, so a stair up the same wall runs twelve metres
// along it and one swung across runs over the drop. Pure data, so the room
// (../staircase.js) and its tests read the same numbers.
//
//   SHAFT: the sizes
//   landingAt(id) → { at: [x, y, z], floor, side, rect: [x0, x1, z0, z1] (its platform), face (yaw out of its door) }
//   stairEnds(stair, end) → { from: [x, y, z], to: [x, y, z], yaw, run } the stair laid from its pivot to that landing
//   platforms() → [{ id, y, rect }] every floor the walk can stand on (galleries joining two landings among them)
//   areaOf(landingId) → the platform the walk is on at that landing (a gallery’s whole span where there is one)
//   spawnAt(landingId) → { at: [x, z], yaw }: where you stand arriving there, looking into the shaft
//   frameAt(frameId) → { at, ry, w, h }: where a portrait hangs (rules/portraits.js’s FRAMES)

import { GALLERIES, LANDINGS } from '../../rules/staircases';

export const SHAFT = {
  half: 12, // m from the middle to each wall
  floor: 5, // m between floors
  floors: 8,
  platform: { deep: 4, wide: 5 }, // m: out from the wall, along it
  zOff: 6, // m north or south of the middle a landing stands
  gallery: 3, // m wide: the walks across on the floors that have one
};

const sideX = (side) => (side === 'w' ? -1 : 1) * (SHAFT.half - SHAFT.platform.deep / 2);
const zOf = (floor) => (floor % 2 ? 1 : -1) * SHAFT.zOff;

export function landingAt(id) {
  const l = LANDINGS.find((x) => x.id === id);
  if (!l) return null;
  const x = sideX(l.side);
  const y = l.floor * SHAFT.floor;
  const z = zOf(l.floor);
  const { deep, wide } = SHAFT.platform;
  const rect = [x - deep / 2, x + deep / 2, z - wide / 2, z + wide / 2];
  // (out of its door is toward the shaft’s middle)
  return { id, at: [x, y, z], floor: l.floor, side: l.side, rect, face: l.side === 'w' ? Math.PI / 2 : -Math.PI / 2, name: l.name, doors: l.doors };
}

// the edge of a landing’s platform a stair leaves from or arrives at: the
// side facing where the stair goes (along the wall, or out over the drop).
// A stair leaves from the platform’s inner lane and arrives at its wall lane
// (across the drop, a little to one side and the other), so the one coming up
// and the one going on from the same end never meet.
const LANE = 1; // m either side of the platform’s middle
function edge(l, toward, leaving) {
  const [x0, x1, z0, z1] = l.rect;
  const [tx, , tz] = toward;
  const dx = tx - l.at[0];
  const dz = tz - l.at[2];
  const inward = l.side === 'w' ? 1 : -1;
  if (Math.abs(dz) >= Math.abs(dx) * 0.9) return [l.at[0] + inward * (leaving ? LANE : -LANE), l.at[1], dz > 0 ? z1 : z0];
  return [dx > 0 ? x1 : x0, l.at[1], l.at[2] + (leaving ? -1.2 : 1.2)];
}

export function stairEnds(stair, end = 'to') {
  const a = landingAt(stair.from);
  const b = landingAt(stair[end]);
  const from = edge(a, b.at, true);
  const to = edge(b, a.at, false);
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  return { from, to, yaw: Math.atan2(dx, dz), run: Math.hypot(dx, dz), rise: to[1] - from[1] };
}

export function platforms() {
  const out = LANDINGS.map((l) => {
    const p = landingAt(l.id);
    return { id: l.id, y: p.at[1], rect: p.rect };
  });
  for (const [a, b] of GALLERIES) {
    const pa = landingAt(a);
    const pb = landingAt(b);
    const z = pa.at[2];
    out.push({ id: `${a}-${b}`, y: pa.at[1], rect: [Math.min(pa.rect[0], pb.rect[0]), Math.max(pa.rect[1], pb.rect[1]), z - SHAFT.gallery / 2, z + SHAFT.gallery / 2] });
  }
  return out;
}

// the walk’s floor at a landing: its own platform, or with the gallery across where its floor has one
export function areaOf(id) {
  const p = landingAt(id);
  const g = GALLERIES.find((pair) => pair.includes(id));
  if (!g) return { y: p.at[1], rects: [p.rect], landings: [id] };
  const other = landingAt(g[0] === id ? g[1] : g[0]);
  const z = p.at[2];
  const bridge = [Math.min(p.rect[0], other.rect[0]), Math.max(p.rect[1], other.rect[1]), z - SHAFT.gallery / 2, z + SHAFT.gallery / 2];
  return { y: p.at[1], rects: [p.rect, other.rect, bridge], landings: [p.id, other.id] };
}

export function spawnAt(id) {
  const p = landingAt(id);
  // (a metre in from the door, looking out over the drop)
  return { at: [p.at[0] + (p.side === 'w' ? -0.8 : 0.8), p.at[2]], yaw: p.side === 'w' ? -Math.PI / 2 : Math.PI / 2 };
}

// the frames: either side of each landing’s doorway on its wall; the spare
// ‘-b’ frames a little further along
export function frameAt(frameId) {
  const [id, which] = frameId.split('-');
  const p = landingAt(id);
  if (!p) return null;
  const wallX = (p.side === 'w' ? -1 : 1) * (SHAFT.half - 0.08);
  const along = which === 'a' ? -2.6 : 3.4;
  return { at: [wallX, p.at[1] + 1.4, p.at[2] + along], ry: p.side === 'w' ? Math.PI / 2 : -Math.PI / 2, w: which === 'a' ? 1.1 : 0.9, h: which === 'a' ? 1.45 : 1.15 };
}

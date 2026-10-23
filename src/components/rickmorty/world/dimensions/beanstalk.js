// Fantasy World's climb (./rows1.js, the `climb` kind: ../games/climb.js),
// in the place's own metres (dx east, dz south of its middle), as ledges
// Morty stands on however high (`ledge: true`, ../rules.js): three Stair
// Goblins of growing size in a flight up the tavern's west side, each a
// flight of three treads cut to the model's own steps, with a landing
// between each two; a bridge shoot from the top goblin to the beanstalk; an
// outer ring of shoots round the stalk, one hop up each, clockwise on the map
// (east, south, west), then an inner ring back the other way; and the
// stalk's crown, level with the giants' cloud (./worlds.js's landmarks, here
// as CLOUD and CASTLE). Every ledge touches the next and rises 0.48 to 0.8 m
// above it, within a hop (CLIMB, 1.11 m), and none is in reach from any but
// the one before it, so the only way up is past every goblin. Each ledge is
// a column from the ground to its top (the walker's solids are), so the
// rings never pass over themselves. Pure and import-free (the row and the
// builder, ./fantasy.js, read it).
//
//   GOBLIN       the stair model's treads: [name, from, to (shares of its length from its back), top (a share of its height)]
//   CLOUD        the giants' cloud: a dome landmark whose drum's top is the crown's
//   CASTLE       the giants' castle on it, north of the crown
//   beanstalk() → { solids, stairs, path, spots, top }
//     solids: the ledges ({ id, dx, dz, w, d, turn?, top, ledge } or { id, dx, dz, r, top, ledge })
//       and the stalk's tip (no top: in the way at any height)
//     stairs: [{ id, steps: [low, mid, top], dx, dz, h, base, back, stump }]; path: the ledges bottom up
//     spots: the stairs' foot (goblins) and the giants, on the crown; top: the crown's height
//   BEANSTALK    the layout, made once

// stairgoblin's model, measured: 1.054 of its height long, its treads its height across,
// rising toward its back (the feet's strip, its last 0.16, is left open)
export const GOBLIN = Object.freeze({
  len: 1.054,
  wide: 1.0,
  treads: [
    ['low', 0.59, 0.84, 0.33],
    ['mid', 0.36, 0.59, 0.65],
    ['top', 0, 0.36, 1],
  ],
});

const STALK = { dx: -23, dz: -19 };
// a dome's drum is its height's 0.45 high (./lots.js): the crown is its top
export const CLOUD = Object.freeze({ at: [-23, -31.2], y: 20, w: 28, d: 22, h: 2 });
export const CASTLE = Object.freeze({ at: [-23, -34.5], y: 21.4, w: 10, d: 10, h: 22 });

const RISE = 0.8; // a hop up, shoot to shoot
const FLIGHT = -14.3; // the goblins' line, west of the tavern
const SIZES = [1.5, 1.9, 2.3]; // the goblins' heights, bottom up
const LANDINGS = [1.2, 1.3]; // each landing's half-depth, bottom up
const BRIDGE = 1.2; // the bridge shoot's half-depth
const CROWN = 1.8;
// each ring: [inner radius, outer radius, degrees between shoots], and how many
const OUTER = [3.8, 6.0, 23];
const INNER = [1.7, 3.9, 37];
const N_OUTER = 10;
const N_INNER = 5;
const FROM = -4; // the outer ring's first bearing (degrees, from east, south positive)
const BACK = 8; // the inner ring starts this far back round from the outer ring's last

const DEG = Math.PI / 180;
const r2 = (v) => +v.toFixed(2);
const r3 = (v) => +v.toFixed(3);

export function beanstalk() {
  const at = (rho, phi) => ({ dx: r3(STALK.dx + rho * Math.cos(phi * DEG)), dz: r3(STALK.dz + rho * Math.sin(phi * DEG)) });
  // the shoots' bearings: the outer ring clockwise on the map, then the inner back round
  const slots = [];
  for (let i = 0; i < N_OUTER; i++) slots.push({ phi: FROM + i * OUTER[2], ring: OUTER });
  const last = FROM + (N_OUTER - 1) * OUTER[2] - BACK;
  for (let i = 0; i < N_INNER; i++) slots.push({ phi: last - i * INNER[2], ring: INNER });
  for (const s of slots) Object.assign(s, at((s.ring[0] + s.ring[1]) / 2, s.phi));
  // the bridge: from just over the first shoot's outer edge to just past the top goblin's east side
  const west = STALK.dx + OUTER[1] * Math.cos(FROM * DEG) - 0.2;
  const east = FLIGHT + (GOBLIN.wide * SIZES[2]) / 2 + 0.05;
  const bridge = { dx: r3((west + east) / 2), dz: slots[0].dz, w: r3(east - west) };
  // the flight, from the bridge south: each goblin's back to the one below's landing
  const gob = [];
  const pads = [];
  let zn = bridge.dz + BRIDGE - 0.05; // the top goblin's back, just under the bridge's south rim
  for (let g = SIZES.length - 1; g >= 0; g--) {
    const h = SIZES[g];
    const D = GOBLIN.len * h;
    gob[g] = { id: `g${g + 1}`, h, D, W: r3(GOBLIN.wide * h), back: r3(zn) };
    if (g === 0) break;
    // the landing below: its north rim 0.2 m over this goblin's low tread, its south rim on the next one down's back
    const half = LANDINGS[g - 1];
    const lz = zn + GOBLIN.treads[0][2] * D - 0.2 + half;
    pads[g - 1] = { id: `landing-${g}`, dz: r3(lz), half };
    zn = lz + half - 0.05;
  }
  const solids = [];
  const path = [];
  const stairs = [];
  let y = 0;
  gob.forEach((G, g) => {
    const base = r3(y);
    const steps = GOBLIN.treads.map(([name, from, to, share]) => {
      const id = `${G.id}-${name}`;
      solids.push({ id, dx: FLIGHT, dz: r3(G.back + ((from + to) / 2) * G.D), w: G.W, d: r3((to - from) * G.D), top: r3(base + share * G.h), ledge: true });
      path.push(id);
      return id;
    });
    // (its stump, under an upper goblin, stops 2 cm short of the landing's top beside it: no two faces in one plane)
    stairs.push({ id: G.id, steps, dx: FLIGHT, dz: r3(G.back + G.D / 2), h: G.h, base, back: G.back, stump: base > 0 ? r3(base - 0.02) : 0 });
    y = base + G.h + RISE;
    const pad = pads[g];
    if (pad) {
      solids.push({ id: pad.id, dx: FLIGHT, dz: pad.dz, w: r3(Math.max(G.W, gob[g + 1].W) + 0.4), d: r3(2 * pad.half), top: r3(y), ledge: true });
      path.push(pad.id);
    }
  });
  solids.push({ id: 'shoot-1', dx: bridge.dx, dz: bridge.dz, w: bridge.w, d: r3(2 * BRIDGE), top: r3(y), ledge: true });
  path.push('shoot-1');
  slots.forEach((s, i) => {
    y += RISE;
    const [r0, r1, a] = s.ring;
    const id = `shoot-${i + 2}`;
    // turned so its width runs round the ring and its depth out from the stalk, wide enough at its outer edge to meet the next
    solids.push({ id, dx: s.dx, dz: s.dz, w: r3(2 * r1 * Math.sin((a * DEG) / 2) + 0.05), d: r3(r1 - r0), turn: r3(Math.atan2(Math.cos(s.phi * DEG), Math.sin(s.phi * DEG))), top: r3(y), ledge: true });
    path.push(id);
  });
  y += RISE;
  const top = r3(y);
  solids.push({ id: 'beanstalk', ...STALK, r: CROWN, top, ledge: true });
  path.push('beanstalk');
  solids.push({ id: 'beanstalk-tip', ...STALK, r: 0.5 });
  // the stairs' foot: a pace south-west of the bottom goblin's low tread
  const foot = { dx: r2(FLIGHT - 1.5), dz: r2(gob[0].back + gob[0].D + 0.9) };
  return { solids, stairs, path, spots: { goblins: foot, giants: { ...STALK, y: top } }, top };
}

export const BEANSTALK = beanstalk();

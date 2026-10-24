// Bird World's clay towers (./rows1.js, the `climb` kind with things to pick
// up: ../games/climb.js), in the place's own metres (dx east, dz south of its
// middle), as ledges Morty stands on however high (`ledge: true`,
// ../rules.js): round each tower a flight of clay drums, each a column from
// the ground a hop higher than the last, winding less than once round it to
// its top, where a crystal grows a metre off the trunk the tower's grown
// round. Three drums low on each flight are a crumbling stair (their beat the
// climb's: still, cracking, crumbling). Every drum overlaps the next and rises
// 0.8 m above it, within a hop (CLIMB, 1.11 m), and none is in reach from any
// but the one before it, so a top is only reached past its crumbling stair.
// Pure and import-free (the row and the builder, ./birdworld.js, read it).
//
//   TOWERS        each tower: where, its top's radius, how many drums, the ring
//                 they stand on, the degrees between them, the bearing of the
//                 first (from east, south positive), which way round, its stair
//   claytowers() → { solids, stairs, paths, spots }
//     solids: the drums ({ id, dx, dz, r, top, ledge }), each top
//       ({ id: 'tower-a' | 'tower-b', … }) and each trunk (no top: in the way at any height)
//     stairs: [{ id, steps: [drum ids, bottom first] }]; paths: each tower's ledges bottom up
//     spots: the crystal on each top ({ dx, dz, y })
//   CLAY_TOWERS   the layout, made once

export const TOWERS = Object.freeze([
  { id: 'tower-a', dx: -22, dz: -15, r: 2.0, drums: 9, ring: 2.85, step: 33, from: 40, turn: 1, stair: 'crumble-a', crystal: 'bcrystal-west' },
  { id: 'tower-b', dx: 20, dz: -17, r: 2.2, drums: 11, ring: 3.05, step: 30, from: 130, turn: -1, stair: 'crumble-b', crystal: 'bcrystal-east' },
]);

const RISE = 0.8; // a hop up, drum to drum
const DRUM = 0.9; // a drum's radius
const TRUNK = 0.4; // the tree a tower's grown round, up through its top
const OFF = 1.0; // a top's crystal, this far from the trunk's middle
const CRUMBLE = [3, 4, 5]; // the drums that crumble, bottom up

const DEG = Math.PI / 180;
const r3 = (v) => +v.toFixed(3);

export function claytowers() {
  const solids = [];
  const stairs = [];
  const paths = {};
  const spots = {};
  for (const t of TOWERS) {
    const at = (rho, phi) => ({ dx: r3(t.dx + rho * Math.cos(phi * DEG)), dz: r3(t.dz + rho * Math.sin(phi * DEG)) });
    const path = [];
    let last = t.from;
    for (let k = 1; k <= t.drums; k++) {
      last = t.from + t.turn * (k - 1) * t.step;
      const id = `${t.id}-${k}`;
      solids.push({ id, ...at(t.ring, last), r: DRUM, top: r3(RISE * k), ledge: true });
      path.push(id);
    }
    solids.push({ id: t.id, dx: t.dx, dz: t.dz, r: t.r, top: r3(RISE * (t.drums + 1)), ledge: true });
    solids.push({ id: `${t.id}-trunk`, dx: t.dx, dz: t.dz, r: TRUNK });
    paths[t.id] = [...path, t.id];
    stairs.push({ id: t.stair, steps: CRUMBLE.map((k) => `${t.id}-${k}`) });
    spots[t.crystal] = { ...at(OFF, last), y: r3(RISE * (t.drums + 1)) };
  }
  return { solids, stairs, paths, spots };
}

export const CLAY_TOWERS = claytowers();

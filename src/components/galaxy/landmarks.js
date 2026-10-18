// What the atlas marks between the systems: the nebulae, the black holes
// and the small galaxy circling ours, each in the grid square it gives
// (`grid`), as a place on the map in grid squares (`pos`) with a size
// (`r`, the same). The galaxy map draws them under the lanes with the
// regions, and names each where its name has room (MapSvg.jsx,
// HoloMap.jsx); a system near a nebula sees it in its sky, where it really
// is from there (skyLandmark, for sky.js). Pure data and numbers, tested in
// Node.
//
// kind   'nebula' (a cloud in `colors`), 'blackhole' (a dark heart and the
//        glow of what falls in) or 'galaxy' (a small spiral of its own)
// about  a line for its name's title

import { liftOf } from './systems';

export const LANDMARKS = [
  { id: 'maelstrom', name: 'The Akkadese Maelstrom', kind: 'nebula', grid: 'T-10', pos: [19.6, 9.75], r: 0.72, colors: ['#ff9a5c', '#a85ad6'], about: 'A storm of hot gas and rubble round the Maw, with Kessel at its edge: the Kessel Run threads it.' },
  { id: 'maw', name: 'The Maw', kind: 'blackhole', grid: 'T-10', pos: [19.75, 9.9], r: 0.16, colors: ['#ffb070'], about: 'A cluster of black holes inside the Maelstrom. The boldest smugglers cut the Kessel Run short past it.' },
  { id: 'kaliida', name: 'The Kaliida Nebula', kind: 'nebula', grid: 'O-17', pos: [14.9, 16.9], r: 0.55, colors: ['#e070c4', '#5a86e0'], about: 'A glowing cloud beyond Naboo, where great neebray drift among the gas.' },
  { id: 'ghost', name: 'The Ghost Nebula', kind: 'nebula', grid: 'P-10', pos: [15.6, 9.75], r: 0.42, colors: ['#cfe6ff', '#7e9ed6'], about: 'A pale, faint cloud in the Expansion Region, as thin as its name.' },
  { id: 'ivax', name: 'The Ivax Nebula', kind: 'nebula', grid: 'K-18', pos: [10.15, 17.8], r: 0.4, colors: ['#86c4ff', '#9a7ae0'], about: 'A cloud in the Anoat sector, near Hoth and Bespin.' },
  { id: 'endorgate', name: 'The Endor Gate', kind: 'blackhole', grid: 'H-16', pos: [7.05, 15.05], r: 0.14, colors: ['#9ad0ff'], about: 'A black hole by the Endor system, out in the Moddell sector.' },
  { id: 'starcave', name: 'The StarCave Nebula', kind: 'nebula', grid: 'U-8', pos: [20.35, 7.55], r: 0.48, colors: ['#ffd68a', '#e0784e'], about: 'A cloud of dust and young stars far out on the Rim, named for the hollow at its heart.' },
  { id: 'rata', name: 'The Rata Nebula', kind: 'nebula', grid: 'E-9', pos: [4.5, 8.6], r: 0.7, colors: ['#9ae4d0', '#5a6ec4'], about: 'A great cloud in the Unknown Regions, at the edge of what the charts know.' },
  { id: 'rishi', name: 'The Rishi Maze', kind: 'galaxy', grid: null, pos: [16.75, 19.85], r: 0.55, colors: ['#e8dcff', '#8a9ad8'], about: 'A small galaxy of its own, circling ours past the Outer Rim; Kamino lies just south of it, where the Jedi Archives lost it.' },
];

// A system's sky: the landmark nebula nearest it, if one's near enough to
// see, as sky.js's nebulae have them ({ dir, color, size }): the way to it
// from the system (a unit vector, +x east, +z south, up as far as the
// system's own height says, the nebulae sitting on the plane), its colour,
// and how wide it shows (radians), bigger the nearer, held to the sky's own
// range. Null where none is within SEEN squares.
export const SEEN = 4;
const SIZE = [0.18, 0.45]; // (sky.js's nebulae's)
export function skyLandmark(sys) {
  let best = null;
  for (const l of LANDMARKS) {
    if (l.kind !== 'nebula') continue;
    const d = Math.hypot(l.pos[0] - sys.pos[0], l.pos[1] - sys.pos[1]);
    if (d <= SEEN && (!best || d < best.d)) best = { l, d };
  }
  if (!best) return null;
  const { l, d } = best;
  const dx = l.pos[0] - sys.pos[0];
  const dy = -liftOf(sys);
  const dz = l.pos[1] - sys.pos[1];
  const len = Math.hypot(dx, dy, dz) || 1;
  // (inside one, its heart is overhead-ish: straight up when it's all round you)
  const dir = len < 1e-6 ? [0, 1, 0] : [dx / len, dy / len, dz / len];
  const size = Math.min(SIZE[1], Math.max(SIZE[0], Math.atan2(l.r * 2, Math.max(d, 0.01)) * 0.6));
  return { id: l.id, dir, color: l.colors[0], size };
}

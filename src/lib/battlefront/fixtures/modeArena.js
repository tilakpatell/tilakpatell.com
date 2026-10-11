// The other modes' arenas for the Node runner (assault.js's runAssault with
// a `mode`), until their maps have navgrids of their own: the level's map
// rulebook set into the rulebook as `maps[level]`, a plane fitted through
// that mode's two sides' spawns, crates scattered round its objectives from
// a fixed seed, the field bounded by the spawns and objectives (250 m round: room to flee) and walled at its edge.
// The sides are Hoth's Original-era soldiers (teams.json holds Hoth's
// alone); the players a side the game's information asset's count
// (UI/Data/GameModes/<id>'s NumberOfPlayers), Ewok Hunt's split by hand.
//
//   ARENAS: mode → { level, players }        modeArena(rb, mode) → { rulebook, nav, level, teams, bots }

import { seeded } from '../../seeded.js';
import { aiOf, teamsFor } from '../rulebook.js';
import { buildNav } from '../nav.js';
import { fitPlane } from './hothFlat.js';
import { modeFor } from '../modes/index.js';
import naboo from '../../../data/bf2017/maps/naboo.json';
import jabbaspalace from '../../../data/bf2017/maps/jabbaspalace.json';
import endor4 from '../../../data/bf2017/maps/endor.4.json';
import geonosis2 from '../../../data/bf2017/maps/geonosis.2.json';

// Strike on Theed (Naboo_01: the one usable map with its layer), Extraction on Jabba's palace
// (its checkpoints' times are wired), Ewok Hunt on Endor's night (Endor_04), Supremacy on Geonosis_02.
// Players: Domination 16, DominationExtraction 16, EwokHunt 20 (by hand: 15 troopers, 5 Ewoks), Mode1 40.
export const ARENAS = {
  strike: { level: 'naboo', rows: naboo.rows, bots: { 1: 8, 2: 8 } },
  extraction: { level: 'jabbaspalace', rows: jabbaspalace.rows, bots: { 1: 8, 2: 8 } },
  ewokHunt: { level: 'endor.4', rows: endor4.rows, bots: { 1: 5, 2: 15 } },
  supremacy: { level: 'geonosis.2', rows: geonosis2.rows, bots: { 1: 20, 2: 20 } },
};

const CRATES = 40;
const PAD = 250;

const cache = new Map();

export function modeArena(rb, mode) {
  const key = `${mode}`;
  if (cache.get(key)?.rb === rb) return cache.get(key).arena;
  const a = ARENAS[mode];
  const rulebook = { ...rb, maps: { ...rb.maps, [a.level]: { map: a.rows, stages: {} } } };
  const spawns = a.rows.spawns.filter((s) => s.mode === mode && (s.team === 1 || s.team === 2));
  const objectives = modeFor(mode)
    .create({ rulebook, level: a.level })
    .objectives.map((o) => o.at)
    .concat(mode === 'ewokHunt' ? modeFor(mode).create({ rulebook, level: a.level }).extractions : []);
  const plane = fitPlane(spawns.map((s) => s.at));
  const y = (x, z) => plane.a * x + plane.b * z + plane.c;
  // (the spawn areas' corners too: a deploy with no safe point lands on one)
  const areas = a.rows.polygons.filter((p) => p.mode === mode && (p.team === 1 || p.team === 2)).flatMap((p) => p.points);
  const xs = [...spawns.map((s) => s.at[0]), ...objectives.map((p) => p[0]), ...areas.map((p) => p[0])];
  const zs = [...spawns.map((s) => s.at[2]), ...objectives.map((p) => p[1]), ...areas.map((p) => p[1])];
  const bounds = { min: [Math.min(...xs) - PAD, Math.min(...zs) - PAD], max: [Math.max(...xs) + PAD, Math.max(...zs) + PAD] };
  const rand = seeded(2017);
  const solids = [];
  for (let i = 0; i < CRATES && objectives.length; i++) {
    const c = objectives[Math.floor(rand() * objectives.length)];
    const t = rand() * Math.PI * 2;
    const r = 8 + rand() * 30;
    const x = c[0] + Math.cos(t) * r;
    const z = c[1] + Math.sin(t) * r;
    solids.push({ at: [x, y(x, z) + 0.6, z], half: [0.6, 0.6, 0.6], yaw: rand() * Math.PI });
  }
  // (a wall on the field's outermost cells: past it there is no grid to walk, and nothing outside it to land on)
  const [x0, z0] = bounds.min.map((v) => v + 1);
  const [x1, z1] = bounds.max.map((v) => v - 1);
  // (in 16 m pieces, each at its own ground: the plane slopes)
  const wall = (x, z, hx, hz) => ({ at: [x, y(x, z) + 1, z], half: [hx, 1, hz], yaw: 0 });
  for (let x = x0; x < x1; x += 16) for (const z of [z0, z1]) solids.push(wall(Math.min(x + 8, x1 - 8), z, 8.5, 1));
  for (let z = z0; z < z1; z += 16) for (const x of [x0, x1]) solids.push(wall(x, Math.min(z + 8, z1 - 8), 1, 8.5));
  const nav = buildNav({ heightAt: y, bounds, cell: 2, solids, cover: aiOf(rb).cover.constants });
  const t = teamsFor(rb, 'hoth');
  const arena = { rulebook, nav, level: a.level, teams: { 1: t.light, 2: t.dark }, bots: a.bots };
  cache.set(key, { rb, arena });
  return arena;
}

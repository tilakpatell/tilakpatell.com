// The hero arenas and the Blast grounds, cut from the map rulebooks
// (src/data/bf2017/maps/<world>.json, lane 0's extractor) into one small
// file the surface's two modes read (src/data/bf2017/maps/arenas.json):
// the bundle carries a few kilobytes, not five 200 KB rulebooks. Every
// number is the rulebook's, in the level's own frame (metres, X and Z);
// missions/arenas.js puts them on a site. missions/arenas.test.js checks
// the cut against the rulebooks, so a re-extracted map that moves a spawn
// fails until this is run again.
//
//   node scripts/bf2017-arenas.mjs [--dry]
//
// Per world: hvv { volume, points, spawns: { light, dark, any } } and blast
// { volume, points, spawns: { light, dark, any } }, spawns as [x, z, yaw].
// Team 1 is the light side, team 2 the dark, team 0 either's respawn (a
// reading of the layers, `hand` in NOTES.md). A level whose Blast layer
// has no spawns (Endor_01: only its two Skirmish defend areas) takes each
// side's from its area's corners drawn halfway in, and the ground as the
// box round both.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAPS = join(ROOT, 'src/data/bf2017/maps');
export const WORLDS = ['hoth', 'endor', 'tatooine', 'geonosis', 'kashyyyk'];
const SIDE = { 1: 'light', 2: 'dark', 0: 'any' };
const r2 = (v) => Math.round(v * 100) / 100;

const centroid = (pts) => [pts.reduce((n, p) => n + p[0], 0) / pts.length, pts.reduce((n, p) => n + p[1], 0) / pts.length];
const box = (pts) => {
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
};

function spawnsOf(rows, mode) {
  const out = { light: [], dark: [], any: [] };
  // (every one, enabled or not: Geonosis_01's are all off in the data, the mode's graph turning them on)
  for (const s of rows.spawns.filter((s) => s.mode === mode)) out[SIDE[s.team] ?? 'any'].push([r2(s.at[0]), r2(s.at[2]), r2(s.yaw)]);
  return out;
}

export function cut(world, rows) {
  const shape = (mode) => rows.volumes.find((v) => v.mode === mode && v.kind === 'shape');
  const hv = shape('hvv');
  const hvv = { volume: hv.id, points: hv.points.map((p) => p.map(r2)), spawns: spawnsOf(rows, 'hvv') };
  const bv = shape('blast');
  let blast;
  if (bv) blast = { volume: bv.id, points: bv.points.map((p) => p.map(r2)), spawns: spawnsOf(rows, 'blast') };
  else {
    // (no ground and no spawns: the Skirmish defend areas, one a side)
    const areas = rows.volumes.filter((v) => v.mode === 'blast' && v.kind === 'defend');
    const inward = (v) => {
      const c = centroid(v.points);
      return v.points.map((p) => [r2((p[0] + c[0]) / 2), r2((p[1] + c[1]) / 2), 0]);
    };
    blast = { volume: areas.map((a) => a.id).join('+'), points: box(areas.flatMap((a) => a.points)).map((p) => p.map(r2)), spawns: { light: inward(areas[0]), dark: inward(areas[1]), any: [] }, derived: 'the two Skirmish defend areas: their box the ground, each one’s corners drawn halfway in a side’s spawns' };
  }
  return { level: rows.level, hvv, blast };
}

export function build() {
  const out = { about: 'The hero arenas (Heroes vs Villains) and the Blast grounds of the five ground levels the site lands on, cut from maps/<world>.json by scripts/bf2017-arenas.mjs. Level frame, metres; spawns [x, z, yaw]; light is team 1, dark team 2, any team 0.' };
  for (const w of WORLDS) out[w] = cut(w, JSON.parse(readFileSync(join(MAPS, `${w}.json`), 'utf8')).rows);
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const data = build();
  for (const w of WORLDS) {
    const { hvv, blast } = data[w];
    const n = (s) => `${s.light.length}/${s.dark.length}/${s.any.length}`;
    console.log(`${w.padEnd(9)} hvv ${hvv.volume} (${hvv.points.length} points, spawns ${n(hvv.spawns)})  blast ${blast.volume} (${blast.points.length} points, spawns ${n(blast.spawns)})`);
  }
  if (!process.argv.includes('--dry')) {
    writeFileSync(join(MAPS, 'arenas.json'), `${JSON.stringify(data)}\n`);
    console.log('wrote src/data/bf2017/maps/arenas.json');
  }
}

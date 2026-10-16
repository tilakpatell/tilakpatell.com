// The kinds that get an ultra cut: the twenty most-seen on the galaxy's
// surfaces, each with where its plain model came from and the command that
// makes its ultra cut. The rule (the quality modes design, §4 Lane C): every
// world's landmark (the hero kind it places; where it places several, the
// most placed), then the most-placed buildings and vehicles across all the
// worlds until there are twenty. Crates, coolers, people, troopers,
// creatures, foliage and rock are not buildings or vehicles, however many of
// them there are (the scattered ones are drawn instanced anyway).
//
//   node scripts/ultra/kinds.mjs            the twenty as a Markdown table, with their commands
//   node scripts/ultra/kinds.mjs --json     the same as JSON
//
// pick(counts, models, { n }) → [{ kind, placed, worlds, role }], the pure
// rule; sourceOf(kind, entry, lanes) → { source, lane, group }; commandFor(…)
// → the owner's command for its ultra cut. counts is scripts/ultra/counts.mjs's.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// not buildings or vehicles: the groups of crates and of people, and the
// scattered ground cover (named: nothing in an entry says "a tree")
const NOT_BUILT = new Set(['common', 'fill', 'people', 'battlefront']);
const GROUND_COVER = new Set(['palm', 'sorganfern', 'sorganfir', 'sorganbirch', 'glassshard', 'lavarock', 'dagoroots', 'dagocypress', 'dagoroot', 'mushroom', 'reed']);
export const isBuiltKind = (kind, entry) => Boolean(entry) && !NOT_BUILT.has(entry.group) && !GROUND_COVER.has(kind);

// The picks: every world's landmark first (its most-placed hero kind), then
// the rest of the buildings and vehicles by how many stand on all the worlds
// together, cut to n. A kind is listed once, with every world it stands on.
export function pick(counts, models, { n = 20 } = {}) {
  const total = {};
  const worlds = {};
  for (const [world, kinds] of Object.entries(counts))
    for (const [kind, c] of Object.entries(kinds)) {
      if (!isBuiltKind(kind, models[kind])) continue;
      total[kind] = (total[kind] ?? 0) + c;
      (worlds[kind] ??= []).push(world);
    }
  const landmarks = new Set();
  for (const kinds of Object.values(counts)) {
    const heroes = Object.entries(kinds).filter(([k]) => models[k]?.hero && isBuiltKind(k, models[k]));
    if (heroes.length) landmarks.add(heroes.sort((a, b) => b[1] - a[1])[0][0]);
  }
  const byCount = (a, b) => total[b] - total[a] || a.localeCompare(b);
  const rest = Object.keys(total).filter((k) => !landmarks.has(k)).sort(byCount);
  const chosen = [...[...landmarks].sort(byCount), ...rest].slice(0, n);
  return chosen.map((kind) => ({ kind, placed: total[kind], worlds: worlds[kind], role: landmarks.has(kind) ? 'landmark' : 'placed' }));
}

// A kind whose Meshy task is kept under another name where no lane has it
// under its own (the great wroshyr was lifted out of the picture of
// Kachirho, and its plain task is Kachirho's; its ultra remake is its own)
const TASK_NAMES = { wroshyrgreat: 'kachirho' };

// Where a kind's plain model came from: Meshy (made.js's `made: 'meshy'`,
// through one of the lanes, named by the tasks file that holds its task),
// Sketchfab (its entry's `uid`, brought in by group), or gen3d (none of the
// surface kinds yet: the site's made ships are the galaxy's, public/models/gen3d/).
export function sourceOf(kind, entry, lanes = {}) {
  if (entry?.made === 'meshy') {
    // (the last lane that has it wins, as a later lane's entry takes over an
    // earlier one's in scripts/meshy-galaxy-buildings.mjs)
    const laneOf = (task) => Object.entries(lanes).findLast(([, kinds]) => kinds.includes(task))?.[0] ?? null;
    const own = laneOf(kind);
    const task = own ? kind : (TASK_NAMES[kind] ?? kind);
    const lane = own ?? laneOf(task);
    return { source: 'meshy', lane, group: entry.group, ...(task !== kind && { task }) };
  }
  if (entry?.uid) return { source: 'sketchfab', lane: null, group: entry.group };
  if (entry?.url?.includes('/gen3d/')) return { source: 'gen3d', lane: null, group: entry.group };
  return { source: 'unknown', lane: null, group: entry?.group ?? null };
}

// The owner's command for the ultra cut (scripts/meshy-galaxy-buildings.mjs
// and scripts/sketchfab-surface.mjs, each with --ultra). A Meshy kind's
// `models --ultra` costs credits and `fetch --ultra` is free; the lane is its
// tasks file. A Meshy kind with no lane on record is fetched through the
// fill lane's file, where the filled worlds' landmarks went.
export function commandFor(kind, { source, lane, group, task = kind }) {
  if (source === 'meshy') {
    const tasks = lane ?? 'scripts/meshy-galaxy-buildings-fill-tasks.json';
    // (the ultra lane's remakes keep their lifts and raw models in a folder of their own)
    const env = `MESHY_TASKS=${tasks}${LANE_ENV[tasks] ? ` ${LANE_ENV[tasks]}` : ''}`;
    const made = `${env} node scripts/meshy-galaxy-buildings.mjs models --ultra ${task} && ${env} node scripts/meshy-galaxy-buildings.mjs fetch --ultra ${task}`;
    return task === kind ? made : `${made} && mv public/models/galaxy/surface/${task}.ultra.glb public/models/galaxy/surface/${kind}.ultra.glb`;
  }
  if (source === 'sketchfab') return `node scripts/sketchfab-surface.mjs ${group} --ultra ${kind}`;
  if (source === 'gen3d') return `node scripts/desktop/ask.mjs gen3d ${kind} --faces 300000 --options "tex: 8192  ultra: yes"`;
  return null;
}

// (in the order scripts/meshy-galaxy-buildings.mjs takes them over, the
// ultra lane's remakes last)
const LANES = ['meshy-galaxy-buildings', 'meshy-galaxy-buildings-fill', 'meshy-galaxy-buildings-back', 'meshy-galaxy-buildings-bases', 'meshy-galaxy-three', 'meshy-galaxy-library', 'meshy-galaxy-ultra'];
const LANE_ENV = { 'scripts/meshy-galaxy-ultra-tasks.json': 'MESHY_REVIEW=lab/meshy/ultra' };

// which Meshy tasks file holds each kind's task
const lanesIn = (dir = join(ROOT, 'scripts')) => Object.fromEntries(LANES.map((f) => [`scripts/${f}-tasks.json`, existsSync(join(dir, `${f}-tasks.json`)) ? Object.keys(JSON.parse(readFileSync(join(dir, `${f}-tasks.json`), 'utf8'))) : []]));

// the Meshy lanes' specs (each lane module's BUILDINGS; the first lane's are
// in the script itself, so Theed's halls are read off it), for a Meshy
// kind's tris and tex, which the catalogue doesn't carry
async function laneSpecs() {
  const specs = {};
  for (const f of LANES.slice(1)) Object.assign(specs, (await import(`../${f}.mjs`)).BUILDINGS);
  const src = readFileSync(join(ROOT, 'scripts', 'meshy-galaxy-buildings.mjs'), 'utf8');
  for (const [, kind, body] of src.matchAll(/^ {2}(\w+): \{\n((?: {4}.*\n)+?) {2}\},/gm)) {
    const tris = body.match(/tris: (\d+)/)?.[1];
    const tex = body.match(/tex: (\d+)/)?.[1];
    if (tris && !specs[kind]) specs[kind] = { tris: Number(tris), tex: Number(tex ?? 2048) };
  }
  return specs;
}

export const table = (rows) => [
  '| # | kind | role | placed | worlds | source | lane / group | high (tris, maps) | ultra cut (tris, maps) | command |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r, i) => `| ${i + 1} | \`${r.kind}\` | ${r.role} | ${r.placed} | ${r.worlds.join(', ')} | ${r.source} | ${r.lane ? r.lane.replace('scripts/', '').replace('-tasks.json', '') : r.group}${r.task ? ` (as \`${r.task}\`)` : ''} | ${r.tris ?? '?'}, ${r.tex ?? '?'} | ${r.ultra.tris}, ${r.ultra.tex} | \`${r.command}\` |`),
].join('\n');

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { createServer } = await import('vite');
  const counts = JSON.parse(execFileSync(process.execPath, [join(ROOT, 'scripts', 'ultra', 'counts.mjs')], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 24 }));
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', root: ROOT });
  try {
    const { SURFACE_MODELS } = await vite.ssrLoadModule('/src/components/galaxy/surface/catalog/index.js');
    const { ultraCut } = await vite.ssrLoadModule('/src/components/galaxy/surface/catalog/ultra.js');
    const lanes = lanesIn();
    const specs = await laneSpecs();
    const rows = pick(counts, SURFACE_MODELS).map((p) => {
      const entry = SURFACE_MODELS[p.kind];
      const src = sourceOf(p.kind, entry, lanes);
      // (a Meshy kind's tris and tex are its lane's spec, not the catalogue's)
      const spec = entry.tris ? entry : specs[src.task ?? p.kind] ?? {};
      const ultra = spec.tris ? ultraCut(spec) : { tris: '?', tex: 8192 };
      return { ...p, ...src, tris: spec.tris, tex: spec.tex, as: entry.as, ultra, command: commandFor(p.kind, src) };
    });
    console.log(process.argv.includes('--json') ? JSON.stringify(rows, null, 1) : table(rows));
  } finally {
    await vite.close();
  }
}

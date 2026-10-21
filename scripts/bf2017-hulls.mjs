// The galaxy's hulls (the hulls design §2.1): one shapes bin a kind,
// `public/models/galaxy/hulls/<kind>.bin` (version 2: its radius, its parts
// and their properties, the shapes), in the frame galaxy/models.js draws the
// kind in, and its row in src/data/galaxyHulls.json ({ source, bytes, parts,
// radius, from, … }). scripts/lib/bf2017-hulls.mjs says how each is made:
//
// - a game fighter: its flying asset's Havok shapes, each part's property
//   read from the asset's raw header (`--headers`: the exporter's resdump of
//   HavokPhysicsData, `bf2export.exe resdump --types HavokPhysicsData`,
//   findings/62 §7, copied to lab/, git-ignored);
// - a game capital: its kit's modules' shapes, the kit read from its space
//   level's map (`--maps`), every part of every module its own part, named
//   for its module, cut to a capital's budget (bf2017-hulls-budget.mjs's
//   capitalBudget: 4,000 bolt triangles, 256 solids, 120 KB) before it is
//   held to its drawing, and its contact to the uncut one's (a fighter flown
//   down lines through its bolts gets through no more often);
// - the Nebulon-B: its one asset's shapes, on the fleet's cut (within the budget as it is);
// - a ship the game never had, a hunter drawn as another model
//   (`hunter/<kind>`), and a kind whose game shapes miss its drawing
//   (SITE_OVER_GAME, measured each run): its drawn model simplified, one
//   part `hull` (the war's subsystems parts of their own where it has them).
//
// Each kind is measured against every cut it is drawn in (galaxy/models.js:
// the plain cut, a fighter's light cut on low and mid, a capital's ultra
// cut) and fails if its bolts' shapes (root 1) are off any cut's box by over
// 2 % of the length it is drawn at, or if a turn or a mirror fits the
// drawing better; a kind that fails is not written. The render GLBs come
// from public/, or where a file is published only, from the public bucket by
// its hash in src/data/galaxyAssets.json (no key), cached in
// scripts/.cache/hulls/.
//
// The game's .bins are published by hash (scripts/assets-publish.mjs), not
// committed: the 2026-10-10 assets decision; so is a site hull whose model is
// published only (its row's `publish`). A site hull made from a model in git
// is committed beside it.
//
//   node scripts/bf2017-hulls.mjs [--root <export web dir>] [--maps <dir>] [--headers <dir>] [--only <kind,…>] [--dry] [--fixture]
//
//   root      the export's web folder (default C:/Users/tilak/Downloads/BF2_Extract/web,
//             else lab/assets/bf2017/web: node scripts/bf2017-fetch.mjs --raw physics/…)
//   maps      the folder holding maps/levels/space/… as the bucket packs them (default
//             the export's web_opt, else lab/assets/bf2017/web: node scripts/bf2017-fetch.mjs
//             --folder 'maps/levels/space/sb_endor_01/*')
//   headers   resdump's HavokPhysicsData folder (default lab/assets/bf2017/resdump/res/HavokPhysicsData)
//   only      these kinds (default: every roster kind but the Death Stars, the close-up
//             Nebulon-B `hq/nebulon`, the hunters drawn as another model, and every
//             fighter and capital the game has)
//   dry       measure and say, write nothing
//   fixture   write the test fixtures too (scripts/fixtures/bf2017/physics/: the X-wing's
//             xwing-hull.bin and xwing-cuts.json; the Star Destroyer's, destroyer-hull.bin,
//             and destroyer-cuts.json, the cuts' boxes)

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { hullOf } from '../src/lib/combat/hulls.js';
import { packHull } from '../src/lib/physics/shapesBin.js';
import { parseArgs } from './lib/args.mjs';
import { assetBase } from './lib/bucket.mjs';
import { readMap } from './lib/bf2017-level.mjs';
import { physicsKey, readPhysicsGlb } from './lib/bf2017-physics.mjs';
import { SPACE, piecesOf } from './lib/bf2017-space.mjs';
import {
  AIR,
  CAPITAL_KITS,
  FIGHTER_PHYSICS,
  RENDER_MODEL,
  SITE_OVER_GAME,
  SITE_PROPERTY,
  assemble,
  bothRoots,
  boxOf,
  capitalKinds,
  cutsOf,
  drawnPoints,
  facing,
  fitShapes,
  frameOf,
  gameToGlb,
  headerFile,
  hunterCuts,
  kitShapes,
  majority,
  noseMatrix,
  offBy,
  partName,
  partProperties,
  readHeader,
  resOf,
  rosterKinds,
  sceneBox,
  wingEdge,
} from './lib/bf2017-hulls.mjs';
import { capitalBudget, passThrough, sinkIn } from './lib/bf2017-hulls-budget.mjs';
import { siteHull, subsystemParts } from './lib/bf2017-hulls-site.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT = 'C:/Users/tilak/Downloads/BF2_Extract/web';
const LAB = join(ROOT, 'lab/assets/bf2017/web');
const BASE = assetBase();
// _source: the hulls design §2.1 (a hull's box on its render cut's within 2 %)
const FIT = 0.02;
// a site hull's triangles: a fighter's, a capital's (the hulls design §2.1)
const BUDGET = { fighter: 600, capital: 4000 };
// _source: the hulls plan's Task 6 test (a bolt at a Star Destroyer's wing edge,
// 0.27 of its length off the centre line, meets its hull: Task 10's battle test)
const WING_EDGE = { destroyer: 0.27 };
// a test fixture's most bytes (the constraint's: game shapes committed as a
// fixture stay small)
const FIXTURE_BYTES = 200000;
const FIXTURES = join(ROOT, 'scripts/fixtures/bf2017/physics');
const DEATH_STARS = ['deathstar', 'deathstar2'];

const args = parseArgs(process.argv.slice(2));
const root = typeof args.root === 'string' ? args.root : existsSync(EXPORT) ? EXPORT : LAB;
const mapsDir = typeof args.maps === 'string' ? args.maps : [join(dirname(EXPORT), 'web_opt'), LAB].find((d) => existsSync(join(d, 'maps'))) ?? LAB;
const headers = typeof args.headers === 'string' ? args.headers : join(ROOT, 'lab/assets/bf2017/resdump/res/HavokPhysicsData');

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const manifest = JSON.parse(await readFile(join(ROOT, 'src/data/galaxyAssets.json'), 'utf8'));
// the fighter a cut capital's contact is tried with: the X-wing's hull (its committed fixture)
const FIGHTER = hullOf(await readFile(join(FIXTURES, 'xwing-hull.bin')));

// a render GLB's bytes: public/ where it is there, else the bucket's copy
const inPublic = (url) => existsSync(join(ROOT, 'public', url));
async function siteFile(url) {
  const site = url.replace(/^\//, '');
  const local = join(ROOT, 'public', site);
  if (existsSync(local)) return readFile(local);
  const cache = join(ROOT, 'scripts/.cache/hulls', site);
  if (existsSync(cache)) return readFile(cache);
  const entry = manifest[site];
  if (!entry) throw new Error(`${site}: neither in public/ nor in galaxyAssets.json`);
  const r = await fetch(`${BASE}/${entry.hash}/${site}`);
  if (!r.ok) throw new Error(`${r.status} ${site}`);
  const buf = Buffer.from(await r.arrayBuffer());
  await mkdir(dirname(cache), { recursive: true });
  await writeFile(cache, buf);
  return buf;
}
const docs = new Map();
const glbDoc = async (url) => docs.get(url) ?? docs.set(url, await io.readBinary(new Uint8Array(await siteFile(url)))).get(url);

// the export's own file, else lab's copy
const exportFile = (path) => [join(root, path), join(LAB, path)].find((f) => existsSync(f)) ?? null;

// a game LOD's geometry alone (the export's model GLBs name their maps as
// files beside them, which this has no use for)
async function geometryOf(file) {
  const raw = await readFile(file);
  const jsonLength = raw.readUInt32LE(12);
  const json = JSON.parse(raw.subarray(20, 20 + jsonLength).toString('utf8'));
  const bin = new Uint8Array(raw.subarray(28 + jsonLength, 28 + jsonLength + raw.readUInt32LE(20 + jsonLength)));
  for (const key of ['images', 'textures', 'samplers']) delete json[key];
  for (const m of json.materials ?? []) for (const key of Object.keys(m)) if (key !== 'name') delete m[key];
  const plain = (list) => (list ?? []).filter((e) => !/texture|basisu|webp|specular/i.test(e));
  json.extensionsUsed = plain(json.extensionsUsed);
  json.extensionsRequired = plain(json.extensionsRequired);
  delete json.buffers[0].uri;
  return io.readJSON({ json, resources: { '@glb.bin': bin } });
}

const jsonl = async (name) => {
  const file = exportFile(name);
  if (!file) throw new Error(`no ${name} under ${root} or ${LAB}`);
  return (await readFile(file, 'utf8'))
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
};
const models = new Map((await jsonl('models.jsonl')).map((row) => [row.name, row]));
let records = null; // physics.jsonl by res, read when a capital wants it

// A physics asset's shapes and its parts' properties (from its raw header),
// read once; null where the asset has none (a module drawn only)
const assets = new Map();
async function assetOf(res) {
  if (assets.has(res)) return assets.get(res);
  records ??= new Map((await jsonl('physics.jsonl')).filter((r) => r.status === 'ok' || !r.status).map((r) => [r.res, r]));
  const rec = records.get(res);
  let asset = null;
  if (rec) {
    const file = exportFile(rec.glb ?? `physics/${rec.name}.glb`);
    if (!file) throw new Error(`no ${rec.glb} under ${root} or ${LAB} (node scripts/bf2017-fetch.mjs --raw ${rec.glb})`);
    const header = join(headers, headerFile(res));
    if (!existsSync(header)) throw new Error(`no header ${headerFile(res)} in ${headers} (bf2export.exe resdump --types HavokPhysicsData)`);
    const properties = partProperties(readHeader(await readFile(header)), res);
    const { shapes, dropped } = await readPhysicsGlb(await readFile(file));
    if (dropped.length) throw new Error(`${rec.name} has leaves this can't read: ${dropped.map((d) => `${d.node} (${d.why})`).join(', ')}`);
    asset = { shapes, properties, name: rec.name };
  }
  assets.set(res, asset);
  return asset;
}

// a space level's pieces (bf2017-space.mjs's piecesOf), its map as the bucket packs it
const levels = new Map();
async function spaceOf(system) {
  if (levels.has(system)) return levels.get(system);
  const base = join(mapsDir, 'maps', SPACE[system].map);
  if (!existsSync(`${base}.bin`)) throw new Error(`no ${base}.bin (node scripts/bf2017-fetch.mjs --folder 'maps/${dirname(SPACE[system].map)}/*')`);
  const space = piecesOf(readMap(JSON.parse(await readFile(`${base}.json`, 'utf8')), await readFile(`${base}.bin`)), { system });
  levels.set(system, space);
  return space;
}

// src modules use Vite's extensionless imports: loaded through Vite
const { createServer } = await import('vite');
const vite = await createServer({ root: ROOT, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', logLevel: 'error' });
const failed = [];
try {
  const load = (path) => vite.ssrLoadModule(`/${path}`);
  const galaxy = await load('src/components/galaxy/models.js');
  const { MODELS: VEHICLES } = await load('src/components/galaxy/surface/catalog/bf2017-vehicles.js');
  const { SUBSYSTEMS } = await load('src/components/universe/wars.js');
  const { FLEET } = await import('./bf2017-fleet.mjs');
  const capitals = new Set(await capitalKinds({ load }));
  const hunters = hunterCuts(galaxy.HUNTER_GLB, galaxy);
  const roster = await rosterKinds({ load });
  const expected = [...roster.filter((k) => !DEATH_STARS.includes(k)), ...Object.keys(galaxy.HQ).map((k) => `hq/${k}`), ...hunters.map((h) => `hunter/${h.kind}`)];
  // (and the game's ships the roster doesn't fly yet: the Falcon, the N-1, the V-wing, the Hyena, the T-65)
  const only = typeof args.only === 'string' ? args.only.split(',') : [...new Set([...expected, ...Object.keys(FIGHTER_PHYSICS), ...Object.keys(CAPITAL_KITS)])];

  // the kind a key draws (`hq/nebulon` the Nebulon-B, `hunter/slave1` Slave I)
  const kindOf = (key) => key.split('/').pop();
  // the cuts a key is drawn in, the plain one first
  const cutsFor = (key) => {
    if (key.startsWith('hunter/')) {
      const h = hunters.find((x) => x.kind === kindOf(key));
      if (!h) throw new Error(`${key}: no hunter drawn as a model of its own (models.js HUNTER_GLB)`);
      return [{ url: h.url, nose: h.nose, plain: true }];
    }
    if (key.startsWith('hq/')) {
      const row = galaxy.HQ[kindOf(key)];
      if (!row) throw new Error(`${key}: no close-up row in models.js HQ`);
      return [{ url: row.url, nose: row.nose ?? 0, plain: true }];
    }
    return cutsOf(galaxy, key);
  };
  const fleetRow = (url) => FLEET.find(([file]) => `/models/galaxy/${file}.glb` === url);

  // the game model a render file was cut from: lane V's surface kind's, or
  // the fleet row's (its surface kind's, or the model it names)
  const modelOf = (kind, url) => {
    if (RENDER_MODEL[kind]) return RENDER_MODEL[kind];
    const surface = url.match(/^\/models\/galaxy\/surface\/([a-z0-9]+)(\.[a-z0-9]+)?\.glb$/);
    if (surface) return VEHICLES[surface[1]]?.from ?? null;
    const row = fleetRow(url);
    return row ? (row[3].kind ? VEHICLES[row[3].kind]?.from : row[3].name) : null;
  };

  // The game's frame into the plain cut's: its LOD0 box first (the brief's),
  // then each LOD's own as the export has it, for a cut lane V took from a
  // lower LOD (the light cuts the fleet's files are: the X-wing's LOD3, the
  // ARC-170's LOD4, whose outlines are not LOD0's). A file imported with
  // parts beside its model (the close-up Nebulon-B's engine block and
  // lights: the fleet row's `parts`) was stood on the box of them all.
  async function placed(doc, name, partsGlob = null) {
    const entry = models.get(name);
    if (!entry) throw new Error(`no ${name} in models.jsonl`);
    if (partsGlob) {
      const globs = partsGlob.split(',').map((g) => new RegExp(`^${`${dirname(name)}/${g}`.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`));
      const all = [entry, ...[...models.values()].filter((m) => globs.some((g) => g.test(m.name)))];
      const box = boxOf(all.map((m) => ({ kind: 'hull', points: [...m.min, ...m.max] })));
      return { matrix: gameToGlb(doc, box), lod: `0 with ${all.length - 1} parts`, box };
    }
    const tried = [];
    try {
      return { matrix: gameToGlb(doc, entry), lod: 0, box: { min: entry.min, max: entry.max } };
    } catch (e) {
      tried.push(`LOD0 ${e.message}`);
    }
    for (const lod of entry.lods ?? []) {
      const file = exportFile(lod.file);
      if (!file) continue;
      try {
        const box = sceneBox(await geometryOf(file));
        return { matrix: gameToGlb(doc, box), lod: lod.lod, box };
      } catch (e) {
        tried.push(`LOD${lod.lod} ${e.message}`);
      }
    }
    throw new Error(`no LOD of ${name} is its box:\n    ${tried.join('\n    ')}`);
  }

  // How a hull sits on its cuts: each cut's fit (root 1's box, the bolts'),
  // the worst, and which way round it fits the plain cut's drawing best
  async function measure(key, fitted, frame, cuts, { way = true } = {}) {
    // (bolts meet root 1 where there are two roots, findings/62 §5)
    const shot = fitted.filter((s) => s.root === 1).length ? fitted.filter((s) => s.root === 1) : fitted;
    const bolts = boxOf(shot);
    const fits = [];
    for (const cut of cuts) {
      const doc = await glbDoc(cut.url);
      fits.push({ ...cut, box: sceneBox(doc), ...offBy(bolts, cut === cuts[0] ? frame : frameOf(doc, cut.nose, kindOf(key))) });
    }
    // (a fit that isn't a number is the worst, and fails)
    const worst = fits.find((f) => Number.isNaN(f.off)) ?? fits.reduce((a, b) => (b.off > a.off ? b : a));
    // (the boxes can't see a hull turned half round or mirrored: its points
    // against the plain cut's vertices can)
    const facingOf = way ? facing(Float32Array.from(shot.flatMap((s) => [...s.points])), drawnPoints(await glbDoc(cuts[0].url), frame)) : null;
    return { fits, worst, way: facingOf };
  }

  // The game's hull of a key, in the frame its plain cut is drawn in:
  // { fitted, properties, names, frame, from, note }
  async function gameHull(key) {
    const kind = kindOf(key);
    const cuts = cutsFor(key);
    const plainDoc = await glbDoc(cuts[0].url);
    const frame = frameOf(plainDoc, cuts[0].nose, kind);
    const kit = CAPITAL_KITS[key];
    if (kit?.space) {
      const space = await spaceOf(kit.space);
      const model = space.models[kit.model];
      if (!model) throw new Error(`${kit.model}: no such model in ${kit.space}'s level`);
      const table = new Map();
      for (const part of model.parts) {
        const asset = await assetOf(physicsKey(part.file));
        if (asset) table.set(physicsKey(part.file), asset);
      }
      const made = kitShapes(space, kit.model, table);
      // (the kit was written in its anchor's frame, metres, under the fleet file's nose turn)
      const fitted = fitShapes(made.shapes, noseMatrix(plainDoc), frame);
      const note = `${kit.model}: ${model.parts.length - made.missing.length} of ${model.parts.length} modules' shapes${made.missing.length ? `, none for ${[...new Set(made.missing)].join(', ')}` : ''}`;
      return { fitted, properties: made.parts.map((p) => p.property), names: made.parts.map((p) => p.name), frame, cuts, from: `${SPACE[kit.space].map}#${kit.model}`, note };
    }
    const name = kit?.physics ?? (FIGHTER_PHYSICS[kind] ? `${AIR}/${FIGHTER_PHYSICS[kind]}` : null);
    if (!name) throw new Error(`${key}: the game has no physics for it`);
    const asset = await assetOf(resOf(name));
    if (!asset) throw new Error(`no ${name} in physics.jsonl`);
    const model = modelOf(kind, cuts[0].url);
    if (!model) throw new Error(`no game model named for ${cuts[0].url}`);
    const { matrix, lod } = await placed(plainDoc, model, fleetRow(cuts[0].url)?.[3].parts ?? null);
    const scale = Math.hypot(matrix[0], matrix[1], matrix[2]);
    // (a capital's one asset has one root: met both ways, as a kit's modules are)
    const shapes = kit ? bothRoots(asset.shapes) : asset.shapes;
    const note = `the game's ${model.split('/').pop()} LOD${lod}${Math.abs(scale - 1) < 1e-6 ? '' : ` × ${scale.toFixed(4)}`}`;
    // (a capital's parts named as a kit's modules' are; a fighter's part<N>)
    const names = kit ? asset.properties.map((_, i) => partName(name, i, asset.properties.length)) : null;
    return { fitted: fitShapes(shapes, matrix, frame), properties: asset.properties, names, frame, cuts, from: resOf(name), note };
  }

  // A site hull of a key: its plain cut simplified, its part's property
  // `property`, and the war's subsystems where it has them
  async function siteHullOf(key, property) {
    const kind = kindOf(key);
    const cuts = cutsFor(key);
    const doc = await glbDoc(cuts[0].url);
    const frame = frameOf(doc, cuts[0].nose, kind);
    const maxTris = BUDGET[capitals.has(kind) ? 'capital' : 'fighter'];
    const shapes = await siteHull(doc, kind, { maxTris, nose: cuts[0].nose });
    const subs = key.startsWith('hunter/') ? null : SUBSYSTEMS[kind];
    const extra = subs ? subsystemParts(subs, 1) : { parts: [], shapes: [] };
    // (the war's subsystems sit where the war puts them, which is not always
    // on the drawing: said, not held to the fit, which is the drawn hull's)
    const out = extra.shapes.length ? offBy(boxOf([...shapes, ...extra.shapes].filter((sh) => sh.root === 1)), frame) : null;
    const subsSaid = extra.shapes.length ? `the war's ${extra.parts.map((p) => p.name).join(', ')}${out.off > FIT ? `, reaching ${(out.off * 100).toFixed(2)} % past the drawing at ${out.face}` : ''}` : null;
    return { own: shapes, fitted: [...shapes, ...extra.shapes], properties: [property, ...extra.parts.map((p) => p.property)], names: ['hull', ...extra.parts.map((p) => p.name)], frame, cuts, from: cuts[0].url, tris: shapes[0].indices.length / 3, solids: shapes.length - 1, subsSaid };
  }

  const short = (url) => url.replace(/^\/models\/galaxy\//, '');
  const fitLine = (fits) => fits.map((f) => `${short(f.url)} ${(f.off * 100).toFixed(2)} % at ${f.face.split(' ').slice(0, 2).join(' ')}`).join(', ');
  const counted = (parts) => {
    const counts = new Map();
    for (const p of parts) counts.set(p.property, (counts.get(p.property) ?? 0) + 1);
    return [...counts].map(([p, n]) => `p${p} × ${n}`).join(', ');
  };

  const rows = {};
  const bins = {};
  for (const key of only) {
    const kind = kindOf(key);
    let made;
    try {
      const game = key.startsWith('hunter/') ? null : CAPITAL_KITS[key] || FIGHTER_PHYSICS[key] ? key : null;
      if (game && !SITE_OVER_GAME[key]) {
        // the game's shapes, held to every cut and to the drawing
        const g = await gameHull(key);
        if (g.properties.length > 256) throw new Error(`${g.properties.length} parts: a hull's parts are counted in a byte`);
        // (a capital's modules' shapes cut to a capital's budget, then held
        // to the drawing as they will be drawn: the fit and the facing are the cut hull's)
        const whole = assemble(g.fitted, g.properties, g.names);
        const { hull, said } = CAPITAL_KITS[key] ? await capitalBudget(whole) : { hull: whole, said: null };
        const m = await measure(key, hull.shapes, g.frame, g.cuts);
        if (!(m.worst.off <= FIT)) throw new Error(`off by ${(m.worst.off * 100).toFixed(2)} % on ${short(m.worst.url)} (${m.worst.face}); fit ${fitLine(m.fits)}`);
        if (m.way.better) throw new Error(`the hull fits the drawing better ${m.way.better.name} (chamfer ${m.way.better.chamfer.toFixed(4)} against ${m.way.placed.toFixed(4)} as placed): a turn or a mirror its frame doesn't know`);
        const bin = packHull(hull);
        const t0 = performance.now();
        const built = hullOf(bin);
        const ms = performance.now() - t0;
        if (WING_EDGE[key]) {
          const edges = wingEdge(built, WING_EDGE[key]);
          const out = edges.filter((e) => !e.inside);
          if (out.length) throw new Error(`a point ${WING_EDGE[key]} of its length out on its widest section is in no root 0 solid: ${out.map((e) => `${e.side} at ${e.at.map((v) => v.toFixed(4)).join(', ')}`).join('; ')}`);
        }
        // (a cut hull still keeps a fighter out where the game's shapes do:
        // the X-wing at a hundredth of the length flown down the lines through
        // the cut hull's bolts and none of its solids, through each hull; and
        // how deep a ship sinks into the bolts' surface before contact stops it)
        let contactSaid = '';
        if (hull !== whole) {
          const uncut = hullOf(packHull(whole));
          const pass = passThrough(built, uncut, FIGHTER);
          const sunk = [sinkIn(built), sinkIn(uncut)].map((v) => `${(v * 100).toFixed(1)} %`);
          contactSaid = `; a fighter through ${pass.cut} of ${pass.lines} lines (uncut ${pass.uncut}), sinking in ${sunk[0]} (uncut ${sunk[1]})`;
          if (pass.cut > pass.uncut) throw new Error(`the cut lets a fighter through on ${pass.cut} of ${pass.lines} lines where the game's shapes let it through on ${pass.uncut}`);
        }
        const next = m.way.ways.reduce((a, b) => (b.chamfer < a.chamfer ? b : a));
        // (a capital's cut: its bolts' triangles and its solids before and after, and its build)
        const out = said && [said.flat && `${said.flat} flat`, said.contained && `${said.contained} inside another`, said.greebles && `${said.greebles} greebles`].filter(Boolean).join(', ');
        const budget = said ? `; ${said.tris[0]} → ${said.tris[1]} bolt triangles${said.boxes ? ` (${said.boxes} parts a box)` : ''}, ${said.solids[0]} → ${said.solids[1]} solids${out ? ` (out: ${out}; ${said.merges} merged; at most ${said.points} points a solid)` : ''}, built in ${ms.toFixed(1)} ms${contactSaid}` : '';
        made = { hull, bin, row: { source: 'game', from: g.from }, say: `fit ${fitLine(m.fits)}; chamfer ${m.way.placed.toFixed(4)}, ${next.name} ${next.chamfer.toFixed(4)}; ${g.note}${budget}` };
      } else {
        // the site's hull of the drawn model, its property the game's where the game has the kind
        let property = SITE_PROPERTY[capitals.has(kind) ? 'capital' : 'fighter'];
        let gameSaid = null;
        let why = SITE_OVER_GAME[key] ?? null;
        if (SITE_OVER_GAME[key]) {
          const g = await gameHull(key);
          // (a capital's game shapes measured as they would be written, cut to
          // the budget; a kit of more parts than a byte counts can't be)
          let shapes = g.fitted;
          if (CAPITAL_KITS[key] && g.properties.length <= 256) shapes = (await capitalBudget(assemble(g.fitted, g.properties, g.names))).hull.shapes;
          const m = await measure(key, shapes, g.frame, g.cuts, { way: false });
          property = majority(g.properties);
          gameSaid = `${(m.worst.off * 100).toFixed(2)} % off at ${m.worst.face} on ${short(m.worst.url)}`;
          if (m.worst.off <= FIT) console.log(`${key}: the game's shapes fit now (${gameSaid}): take it out of SITE_OVER_GAME`);
        } else if (key.startsWith('hunter/') && FIGHTER_PHYSICS[kind]) {
          property = majority((await assetOf(resOf(`${AIR}/${FIGHTER_PHYSICS[kind]}`))).properties);
          why = `the hunters draw ${cutsFor(key)[0].url} (models.js HUNTER_GLB), not the galaxy's cut of the kind`;
        }
        const s = await siteHullOf(key, property);
        const m = await measure(key, s.own, s.frame, s.cuts, { way: false });
        if (!(m.worst.off <= FIT)) throw new Error(`the site hull is off by ${(m.worst.off * 100).toFixed(2)} % on ${short(m.worst.url)} (${m.worst.face}); fit ${fitLine(m.fits)}`);
        const hull = assemble(s.fitted, s.properties, s.names);
        made = {
          hull,
          bin: packHull(hull),
          row: { source: 'site', from: s.from, property, ...(why ? { why } : {}), ...(gameSaid ? { game: gameSaid } : {}), ...(inPublic(s.from) ? {} : { publish: true }) },
          say: `fit ${fitLine(m.fits)}; the site's ${short(s.from)}, ${s.tris} triangles and ${s.solids} solids${s.subsSaid ? `; ${s.subsSaid}` : ''}${gameSaid ? `; the game's shapes ${gameSaid}` : ''}`,
        };
      }
    } catch (e) {
      console.error(`${key}: ${e.message}`);
      failed.push(key);
      continue;
    }
    const { hull, bin, row, say } = made;
    const n = hull.parts.length;
    console.log(`${key} ${bin.byteLength} B, ${n} part${n === 1 ? '' : 's'}, radius ${hull.radius.toFixed(4)} (${counted(hull.parts)}; ${say})`);
    rows[key] = { source: row.source, bytes: bin.byteLength, parts: n, radius: Number(hull.radius.toFixed(4)), ...row };
    bins[key] = { hull, bin };
  }

  if (!args.dry) {
    for (const [key, { hull, bin }] of Object.entries(bins)) {
      const file = join(ROOT, 'public/models/galaxy/hulls', `${key}.bin`);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, new Uint8Array(bin));
      if (args.fixture && (key === 'xwing' || key === 'destroyer')) await writeFixture(key, hull, bin);
    }
    if (Object.keys(rows).length) {
      const file = join(ROOT, 'src/data/galaxyHulls.json');
      const all = existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : {};
      Object.assign(all, rows);
      const sorted = Object.fromEntries(Object.keys(all).sort().map((k) => [k, all[k]]));
      await writeFile(file, `${JSON.stringify(sorted, null, 2)}\n`);
    }
  }

  // The test fixtures: the X-wing's hull and the Star Destroyer's, each with
  // the boxes of the cuts it is drawn in
  async function writeFixture(key, hull, bin) {
    const round = (v) => Number(v.toFixed(6));
    const cuts = [];
    for (const cut of cutsFor(key)) {
      const box = sceneBox(await glbDoc(cut.url));
      cuts.push({ url: cut.url, nose: cut.nose, min: box.min.map(round), max: box.max.map(round) });
    }
    if (key === 'xwing') {
      await writeFile(join(FIXTURES, 'xwing-hull.bin'), new Uint8Array(bin));
      const { model, lod, box } = await (async () => {
        const name = modelOf('xwing', cuts[0].url);
        return { model: name, ...(await placed(await glbDoc(cuts[0].url), name)) };
      })();
      const fixture = {
        _source: `node scripts/bf2017-hulls.mjs --only xwing --fixture: each cut's box as galaxy/models.js's normalise measures it (every vertex through its node, in its GLB's frame), and the game box its plain cut was put on (${model} LOD${lod}: ${lod ? "measured from the export's file" : "models.jsonl's"})`,
        kind: 'xwing',
        game: { min: box.min.map(round), max: box.max.map(round) },
        cuts,
      };
      await writeFile(join(FIXTURES, 'xwing-cuts.json'), `${JSON.stringify(fixture, null, 2)}\n`);
      return;
    }
    // (the whole hull, cut to a capital's budget: a fixture is a few KB to a couple of hundred)
    if (bin.byteLength > FIXTURE_BYTES) throw new Error(`destroyer: its hull's ${bin.byteLength} bytes are over a fixture's ${FIXTURE_BYTES}`);
    await writeFile(join(FIXTURES, 'destroyer-hull.bin'), new Uint8Array(bin));
    const fixture = {
      _source: `node scripts/bf2017-hulls.mjs --only destroyer --fixture: the Star Destroyer's hull (${CAPITAL_KITS.destroyer.model}'s modules' shapes cut to a capital's budget, ${hull.parts.length} parts) as written, and each cut's box as galaxy/models.js's normalise measures it`,
      kind: 'destroyer',
      parts: hull.parts.length,
      cuts,
    };
    await writeFile(join(FIXTURES, 'destroyer-cuts.json'), `${JSON.stringify(fixture, null, 2)}\n`);
  }

  // what the galaxy flies and has no hull: none, or the run says which
  const have = existsSync(join(ROOT, 'src/data/galaxyHulls.json')) ? JSON.parse(await readFile(join(ROOT, 'src/data/galaxyHulls.json'), 'utf8')) : {};
  const missing = expected.filter((k) => !have[k] && !rows[k]);
  const written = Object.values(rows);
  if (failed.length) console.log(`failed: ${failed.join(', ')}`);
  if (missing.length) console.log(`no hull: ${missing.join(', ')}`);
  console.log(`hulls: ${written.length} kinds${args.dry ? ' (measured, none written)' : ''}, ${written.filter((r) => r.source === 'game').length} from the game, ${written.filter((r) => r.source === 'site').length} from the site's models, ${missing.length} missing`);
  if (missing.length) process.exitCode = 1;
} finally {
  await vite.close();
}
if (failed.length) process.exit(1);

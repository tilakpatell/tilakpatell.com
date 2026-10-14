// The galaxy's hulls (the hulls design §2.1): one shapes bin a kind,
// `public/models/galaxy/hulls/<kind>.bin` (version 2: its radius, its parts
// and their properties, the shapes), in the frame galaxy/models.js draws the
// kind in, and its row in src/data/galaxyHulls.json ({ source, bytes, parts,
// radius, from }). A game fighter's hull is its flying asset's Havok shapes
// (scripts/lib/bf2017-hulls.mjs, which says how), each part's property read
// from the asset's raw header (`--headers`: the exporter's resdump of
// HavokPhysicsData, `bf2export.exe resdump --types HavokPhysicsData`,
// findings/62 §7, copied to lab/, git-ignored).
//
// Each kind is measured against every cut it is drawn in (galaxy/models.js:
// the plain cut, a fighter's light cut on low and mid, a capital's ultra
// cut) and fails if its bolts' shapes (root 1) are off any cut's box by over
// 2 % of the length it is drawn at; a kind that fails is not written. The
// render GLBs come from public/, or where a file is published only, from the
// public bucket by its hash in src/data/galaxyAssets.json (no key), cached
// in scripts/.cache/hulls/.
//
// The game's .bins are published by hash (scripts/assets-publish.mjs), not
// committed: the 2026-10-10 assets decision.
//
//   node scripts/bf2017-hulls.mjs [--root <export web dir>] [--headers <dir>] [--only <kind,…>] [--dry] [--fixture]
//
//   root      the export's web folder (default C:/Users/tilak/Downloads/BF2_Extract/web,
//             else lab/assets/bf2017/web: node scripts/bf2017-fetch.mjs --raw physics/…)
//   headers   resdump's HavokPhysicsData folder (default lab/assets/bf2017/resdump/res/HavokPhysicsData)
//   dry       measure and say, write nothing
//   fixture   write the X-wing's test fixtures too (scripts/fixtures/bf2017/physics/:
//             xwing-hull.bin and xwing-cuts.json, the cuts' boxes the test fits it to)

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { packHull } from '../src/lib/physics/shapesBin.js';
import { parseArgs } from './lib/args.mjs';
import { readPhysicsGlb } from './lib/bf2017-physics.mjs';
import { AIR, FIGHTER_PHYSICS, RENDER_MODEL, assemble, boxOf, cutsOf, fitShapes, frameOf, gameToGlb, headerFile, offBy, partProperties, readHeader, resOf, rosterKinds, sceneBox } from './lib/bf2017-hulls.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT = 'C:/Users/tilak/Downloads/BF2_Extract/web';
const LAB = join(ROOT, 'lab/assets/bf2017/web');
const BASE =
  process.env.ASSET_BASE ?? process.env.VITE_ASSET_BASE ?? (process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL}/storage/v1/object/public/site-assets` : 'https://jzabcqboyemokwifmjmp.supabase.co/storage/v1/object/public/site-assets');
// _source: the hulls design §2.1 (a hull's box on its render cut's within 2 %)
const FIT = 0.02;
const FIXTURES = join(ROOT, 'scripts/fixtures/bf2017/physics');

const args = parseArgs(process.argv.slice(2));
const root = typeof args.root === 'string' ? args.root : existsSync(EXPORT) ? EXPORT : LAB;
const headers = typeof args.headers === 'string' ? args.headers : join(ROOT, 'lab/assets/bf2017/resdump/res/HavokPhysicsData');
const only = typeof args.only === 'string' ? args.only.split(',') : Object.keys(FIGHTER_PHYSICS);

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const manifest = JSON.parse(await readFile(join(ROOT, 'src/data/galaxyAssets.json'), 'utf8'));

// a render GLB's bytes: public/ where it is there, else the bucket's copy
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

const models = new Map();
const modelsFile = exportFile('models.jsonl');
if (!modelsFile) throw new Error(`no models.jsonl under ${root} or ${LAB}`);
for (const line of (await readFile(modelsFile, 'utf8')).split('\n')) {
  if (!line.trim()) continue;
  const row = JSON.parse(line);
  models.set(row.name, row);
}

// src modules use Vite's extensionless imports: loaded through Vite
const { createServer } = await import('vite');
const vite = await createServer({ root: ROOT, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', logLevel: 'error' });
const failed = [];
try {
  const galaxy = await vite.ssrLoadModule('/src/components/galaxy/models.js');
  const { MODELS: VEHICLES } = await vite.ssrLoadModule('/src/components/galaxy/surface/catalog/bf2017-vehicles.js');
  const { FLEET } = await import('./bf2017-fleet.mjs');

  // the game model a render file was cut from: lane V's surface kind's, or
  // the fleet row's (its surface kind's, or the model it names)
  const modelOf = (kind, url) => {
    if (RENDER_MODEL[kind]) return RENDER_MODEL[kind];
    const surface = url.match(/^\/models\/galaxy\/surface\/([a-z0-9]+)(\.[a-z0-9]+)?\.glb$/);
    if (surface) return VEHICLES[surface[1]]?.from ?? null;
    const row = FLEET.find(([file]) => `/models/galaxy/${file}.glb` === url);
    return row ? (row[3].kind ? VEHICLES[row[3].kind]?.from : row[3].name) : null;
  };

  // The game's frame into the plain cut's: its LOD0 box first (the brief's),
  // then each LOD's own as the export has it, for a cut lane V took from a
  // lower LOD (the light cuts the fleet's files are: the X-wing's LOD3, the
  // ARC-170's LOD4, whose outlines are not LOD0's).
  async function placed(doc, name) {
    const entry = models.get(name);
    if (!entry) throw new Error(`no ${name} in models.jsonl`);
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

  async function hullFor(kind) {
    const name = `${AIR}/${FIGHTER_PHYSICS[kind]}`;
    const file = exportFile(name);
    if (!file) throw new Error(`no ${name} under ${root} or ${LAB} (node scripts/bf2017-fetch.mjs --raw ${name})`);
    const header = join(headers, headerFile(name));
    if (!existsSync(header)) throw new Error(`no header ${headerFile(name)} in ${headers} (bf2export.exe resdump --types HavokPhysicsData)`);
    const properties = partProperties(readHeader(await readFile(header)), kind);
    const { shapes, dropped } = await readPhysicsGlb(await readFile(file));
    if (dropped.length) throw new Error(`${name} has leaves this can't read: ${dropped.map((d) => `${d.node} (${d.why})`).join(', ')}`);
    const cuts = cutsOf(galaxy, kind);
    const plainDoc = await glbDoc(cuts[0].url);
    const model = modelOf(kind, cuts[0].url);
    if (!model) throw new Error(`no game model named for ${cuts[0].url}`);
    const { matrix, lod, box } = await placed(plainDoc, model);
    const frame = frameOf(plainDoc, cuts[0].nose, kind);
    const fitted = fitShapes(shapes, matrix, frame);
    // (bolts meet root 1 where there are two roots, findings/62 §5)
    const bolts = boxOf(fitted.filter((s) => s.root === 1).length ? fitted.filter((s) => s.root === 1) : fitted);
    const fits = [];
    for (const cut of cuts) {
      const doc = await glbDoc(cut.url);
      fits.push({ ...cut, box: sceneBox(doc), ...offBy(bolts, cut === cuts[0] ? frame : frameOf(doc, cut.nose, kind)) });
    }
    const hull = assemble(fitted, properties);
    return { hull, bin: packHull(hull), fits, model, lod, game: box, scale: Math.hypot(matrix[0], matrix[1], matrix[2]), from: resOf(name) };
  }

  const rows = {};
  for (const kind of only) {
    if (!FIGHTER_PHYSICS[kind]) {
      console.error(`${kind}: not one of the game's fighters (${Object.keys(FIGHTER_PHYSICS).join(', ')})`);
      failed.push(kind);
      continue;
    }
    let made;
    try {
      made = await hullFor(kind);
    } catch (e) {
      console.error(`${kind}: ${e.message}`);
      failed.push(kind);
      continue;
    }
    const { hull, bin, fits, model, lod, game, scale, from } = made;
    const short = (url) => url.replace(/^\/models\/galaxy\//, '');
    const fit = fits.map((f) => `${short(f.url)} ${(f.off * 100).toFixed(2)} % at ${f.face.split(' ').slice(0, 2).join(' ')}`).join(', ');
    // (each property and how many parts are on it)
    const counts = new Map();
    for (const p of hull.parts) counts.set(p.property, (counts.get(p.property) ?? 0) + 1);
    const properties = [...counts].map(([p, n]) => `p${p} × ${n}`).join(', ');
    const worst = fits.reduce((a, b) => (b.off > a.off ? b : a));
    if (worst.off > FIT) {
      console.error(`${kind}: off by ${(worst.off * 100).toFixed(2)} % on ${short(worst.url)} (${worst.face}); fit ${fit}`);
      failed.push(kind);
      continue;
    }
    console.log(`${kind} ${bin.byteLength} B, ${hull.parts.length} parts, radius ${hull.radius.toFixed(4)} (${properties}; fit ${fit}; the game's ${model.split('/').pop()} LOD${lod}${Math.abs(scale - 1) < 1e-6 ? '' : ` × ${scale.toFixed(4)}`})`);
    rows[kind] = { source: 'game', bytes: bin.byteLength, parts: hull.parts.length, radius: Number(hull.radius.toFixed(4)), from };
    if (args.dry) continue;
    await mkdir(join(ROOT, 'public/models/galaxy/hulls'), { recursive: true });
    await writeFile(join(ROOT, 'public/models/galaxy/hulls', `${kind}.bin`), new Uint8Array(bin));
    if (args.fixture && kind === 'xwing') {
      await writeFile(join(FIXTURES, 'xwing-hull.bin'), new Uint8Array(bin));
      const round = (v) => Number(v.toFixed(6));
      const cutsFixture = {
        _source: `node scripts/bf2017-hulls.mjs --only xwing --fixture: each cut's box as galaxy/models.js's normalise measures it (every vertex through its node, in its GLB's frame), and the game box its plain cut was put on (${model} LOD${lod}: ${lod ? "measured from the export's file" : "models.jsonl's"})`,
        kind,
        game: { min: game.min.map(round), max: game.max.map(round) },
        cuts: fits.map((f) => ({ url: f.url, nose: f.nose, min: f.box.min.map(round), max: f.box.max.map(round) })),
      };
      await writeFile(join(FIXTURES, 'xwing-cuts.json'), `${JSON.stringify(cutsFixture, null, 2)}\n`);
    }
  }

  if (!args.dry && Object.keys(rows).length) {
    const file = join(ROOT, 'src/data/galaxyHulls.json');
    const all = existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : {};
    Object.assign(all, rows);
    const sorted = Object.fromEntries(Object.keys(all).sort().map((k) => [k, all[k]]));
    await writeFile(file, `${JSON.stringify(sorted, null, 2)}\n`);
  }
  // (what the roster flies that has no hull yet: the capitals and the site's own models are Task 6's)
  const have = new Set(Object.keys(existsSync(join(ROOT, 'src/data/galaxyHulls.json')) ? JSON.parse(await readFile(join(ROOT, 'src/data/galaxyHulls.json'), 'utf8')) : {}));
  const roster = await rosterKinds({ load: (path) => vite.ssrLoadModule(`/${path}`) });
  console.log(`roster kinds with no hull yet: ${roster.filter((k) => !have.has(k)).join(', ') || 'none'}`);
  console.log(`hulls: ${Object.keys(rows).length} kinds ${args.dry ? 'measured' : 'written'}, ${failed.length} failed${failed.length ? ` (${failed.join(', ')})` : ''}`);
} finally {
  await vite.close();
}
if (failed.length) process.exit(1);

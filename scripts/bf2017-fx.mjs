// The game's look for the galaxy's effects: fetches the effect sheets and
// meshes scripts/lib/bf2017-fx.mjs names from the 2017 drop (the private
// bf2017-assets bucket) into lab/assets/bf2017/ (git-ignored), ships each
// sheet as the game's own KTX2 at its sizes (its top mip levels taken off,
// nothing re-encoded) and each set of meshes as one small GLB of geometry,
// writes them under public/models/galaxy/bf2017/fx/, and the table the site
// reads (src/data/bf2017Fx.js) and their credits. A sheet the bucket does not
// have yet is said and skipped: the effect keeps its own look until it lands.
//
//   node --env-file=.env.local scripts/bf2017-fx.mjs [--only '<name>,…'] [--count]
//
//   only   just these sheets and meshes, by site name
//   count  how many of the drop's effect textures the bucket holds, and stop
//
// The keys: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (lib/bucket.mjs) from
// the environment, never printed. A file over 64 KB goes to the public bucket through
// scripts/assets-publish.mjs, not into git; the run says which.

import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, dequantize, flatten, meshopt, mergeDocuments, prune, transformMesh, unpartition, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { readManifest } from './lib/bf2017-manifest.mjs';
import { inBucket, localPath, objectUrl } from './lib/bf2017-paths.mjs';
import { NO_KEYS, bucketEnv, list } from './lib/bucket.mjs';
import { dropLevels, ktx2Info } from './lib/ktx2-levels.mjs';
import { COMMIT_CAP, EFFECT_CAP, MESHES, OUT_DIR, SET_CAP, SHEETS, SITE_DIR, TABLE, WANTED, bareGlb, dropFor, meshFile, sheetFile, tableEntry, tableModule, upCount, wantedSizes } from './lib/bf2017-fx.mjs';
import { writeCredit } from './lib/catalog-write.mjs';
import { PERMISSION } from './bf2017-import.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LAB = join(ROOT, 'lab/assets/bf2017');
const BUCKET = 'bf2017-assets';
const GAME = 'https://www.ea.com/games/starwars/battlefront/star-wars-battlefront-2';
const WAITS = [1000, 2000, 4000];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function keys() {
  const env = bucketEnv();
  if (!env) {
    console.error(NO_KEYS);
    process.exit(2);
  }
  return env;
}

// one object to lab/, kept when there; null when the bucket hasn't it
async function get(env, bucketPath) {
  const file = localPath(LAB, bucketPath);
  if (existsSync(file)) return file;
  for (let i = 0; ; i++) {
    let res = null;
    try {
      res = await env.fetch(objectUrl(env.base, BUCKET, bucketPath));
    } catch (e) {
      if (i >= WAITS.length) throw e;
    }
    if (res && res.status < 500) {
      if (!res.ok) return null;
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
      return file;
    }
    if (i >= WAITS.length) return null;
    await sleep(WAITS[i]);
  }
}

// every object under a folder of the bucket (one listing, a thousand keys a page)
async function listed(env, prefix, into = new Set()) {
  for (const f of (await list(env.fetch, BUCKET, `${prefix}/`)).files) into.add(f.key);
  return into;
}

async function loadJsonl(env, bucketPath) {
  const file = await get(env, bucketPath);
  if (!file) throw new Error(`${bucketPath}: not in the bucket`);
  return readManifest(await readFile(file, 'utf8'));
}

// a texture's KTX2 on disk (the bucket's web build: zstd UASTC with every level)
const textureKtx2 = (env, row) => get(env, inBucket(row.file.replace(/\.png$/, '.ktx2')));

async function makeSheet(name, spec, file) {
  const bytes = new Uint8Array(await readFile(file));
  const { width } = ktx2Info(bytes);
  const files = [];
  for (const w of wantedSizes(spec, width)) {
    const n = dropFor(width, w);
    let buf;
    try {
      buf = dropLevels(bytes, n);
    } catch (e) {
      // (BasisLZ keeps its codebooks across the levels: its own width only)
      console.log(`${name.padEnd(16)} ${w}: ${e.message}`);
      continue;
    }
    await writeFile(join(ROOT, OUT_DIR, sheetFile(name, w)), buf);
    files.push([w, buf.length]);
  }
  return files;
}

async function makeMesh(env, name, spec, models) {
  const io = new NodeIO().setLogger(new Logger(Logger.Verbosity.WARN)).registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  let doc = null;
  for (const from of spec.from) {
    const entry = models.get(from);
    if (!entry) throw new Error(`${from}: not in web/models.jsonl`);
    const file = await get(env, inBucket(entry.lods[0].file));
    if (!file) return null;
    const part = await io.readBinary(bareGlb(await readFile(file)));
    // in metres, its node's dequantising scale and offset put into the
    // vertices; each piece one named mesh, the name its own
    await part.transform(dequantize(), flatten());
    const short = from.split('/').pop().replace(/_mesh$/, '');
    for (const n of part.getRoot().listNodes()) {
      if (!n.getMesh()) continue;
      transformMesh(n.getMesh(), n.getWorldMatrix());
      n.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]).setName(short);
    }
    for (const m of part.getRoot().listMeshes()) m.setName(short);
    if (!doc) doc = part;
    else mergeDocuments(doc, part);
  }
  await doc.transform(unpartition(), dedup(), weld(), prune({ keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = join(ROOT, OUT_DIR, meshFile(name));
  await writeFile(out, await io.writeBinary(doc));
  return (await stat(out)).size;
}

const args = parseArgs(process.argv.slice(2));
const env = keys();
const textures = await loadJsonl(env, 'web/textures.jsonl');
const byName = new Map([...textures.values()].map((r) => [r.name.toLowerCase(), r]));

if (args.count) {
  // what is up: a HEAD per effect texture is slow; one listing of textures/fx is not
  const has = await listed(env, 'web/textures/fx');
  const n = upCount([...textures.values()], (f) => has.has(`web/${f}`));
  console.log(`effect textures in the bucket: ${n.up} of ${n.all}`);
  process.exit(0);
}

const only = typeof args.only === 'string' ? new Set(args.only.split(',')) : null;
await mkdir(join(ROOT, OUT_DIR), { recursive: true });
const tableFile = join(ROOT, TABLE);
// (a full run writes the table fresh; --only keeps the rest, less what no recipe names now)
const known = new Set([...Object.keys(SHEETS), ...Object.keys(MESHES)]);
const table = only && existsSync(tableFile) ? Object.fromEntries(Object.entries((await import(tableFile)).BF2017_FX).filter(([k]) => known.has(k))) : {};
let total = 0;
const big = [];

for (const [name, spec] of Object.entries(SHEETS)) {
  if (only && !only.has(name)) continue;
  const row = byName.get(spec.from.toLowerCase());
  const ktx2 = row && (await textureKtx2(env, row));
  if (!ktx2) {
    console.log(`${name.padEnd(16)} ${spec.from}: not in the bucket yet`);
    continue;
  }
  const files = await makeSheet(name, spec, ktx2);
  if (!files.length) continue;
  table[name] = tableEntry(name, { spec, files });
  for (const [w, b] of files) {
    console.log(`${name.padEnd(16)} ${String(w).padStart(4)}  ${String(b).padStart(7)} bytes`);
    if (b > EFFECT_CAP) throw new Error(`${name} at ${w}: ${b} bytes, over the effect cap`);
    if (b > COMMIT_CAP) big.push(`${SITE_DIR}/${sheetFile(name, w)}`);
  }
  total += Math.max(...files.map(([, b]) => b));
}

for (const [name, from] of Object.entries(WANTED)) {
  if (only && !only.has(name)) continue;
  const row = byName.get(from.toLowerCase());
  const up = row && ((await get(env, inBucket(row.file))) || (await get(env, inBucket(row.file.replace(/\.png$/, '.ktx2')))));
  console.log(`${name.padEnd(16)} ${from}: ${up ? 'UP: give it a recipe in SHEETS' : 'not in the bucket yet'}`);
}

const models = readManifest(await readFile(await get(env, 'web/models.jsonl'), 'utf8'));
for (const [name, spec] of Object.entries(MESHES)) {
  if (only && !only.has(name)) continue;
  const bytes = await makeMesh(env, name, spec, models);
  if (!bytes) {
    console.log(`${name.padEnd(16)} not in the bucket yet`);
    continue;
  }
  console.log(`${name.padEnd(16)} mesh  ${String(bytes).padStart(7)} bytes`);
  if (bytes > EFFECT_CAP) throw new Error(`${name}: ${bytes} bytes, over the effect cap`);
  if (bytes > COMMIT_CAP) big.push(`${SITE_DIR}/${meshFile(name)}`);
  table[name] = tableEntry(name, { spec, bytes, mesh: true });
  total += bytes;
  await writeCredit(join(ROOT, 'src/data/modelCredits.json'), `bf2017-fx-${name.replace('.', '-')}`, {
    title: `Star Wars Battlefront II (2017): ${spec.from.join(', ')}`,
    author: 'EA DICE',
    authorUrl: GAME,
    license: 'permission',
    licenseUrl: GAME,
    source: GAME,
    where: 'galaxy-surface',
    as: spec.as,
    file: `${SITE_DIR}/${meshFile(name)}`,
    permission: PERMISSION,
  });
}

await writeFile(tableFile, tableModule(table));
console.log(`the set: ${(total / 1024).toFixed(0)} KB of ${(SET_CAP / 1024).toFixed(0)} KB`);
if (total > SET_CAP) throw new Error('the effect set is over its cap');
if (big.length) console.log(`over 64 KB, for the public bucket (node scripts/assets-publish.mjs): ${big.join(', ')}`);

#!/usr/bin/env node
// A level's volumetric light beside its pack: the level's
// SimpleVolumetricsEntityData (already in the repo, in
// src/data/bf2017/maps/<world>.lighting.json) and the light cone spawns in
// its map extras (`web/maps/<level>/<name>.extras.json`'s `effects[]` in the
// private bf2017-assets bucket) to
// `public/models/galaxy/bf2017/levels/<world>/volumes.json`, rebased to lane
// L's pack frame and binned by its cells, like lights.json
// (scripts/lib/bf2017-volumes.mjs says how each is read).
//
//   node scripts/bf2017-volumes.mjs <world> [--level levels/mp/hoth_01]
//     [--pack public/models/galaxy/bf2017/levels/<world>/level.json]
//     [--lighting src/data/bf2017/maps/<world>.lighting.json]
//     [--origin x,y,z --yaw radians --arena metres] [--no-extras] [--dry]
//   node scripts/bf2017-volumes.mjs --flares [--dry]
//
// --flares reads the game's LensFlareBlueprints (every one data.tsv lists:
// twelve) and writes src/data/bf2017/flares.json, each as
// src/lib/three/light/flare.js's flareElements reads it, for eventFlare.
//
// Without the bucket's keys (SUPABASE_URL and BF2017_KEY or SUPA_KEY, from
// .env.local or the environment) the cones are left out and the script says
// so: the boxes alone are written. --dry prints the counts and writes
// nothing. The keys are never printed.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { objectUrl } from './lib/bf2017-paths.mjs';
import { gunzipSync } from 'node:zlib';
import { flareElements } from '../src/lib/three/light/flare.js';
import { CONE_RE, coneShape, volumesJson } from './lib/bf2017-volumes.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUCKET = 'bf2017-assets';
const argv = process.argv.slice(2);
const world = argv[0] && !argv[0].startsWith('--') ? argv[0] : null;
const flares = argv.includes('--flares');
const arg = (k) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};
const stop = (why, code = 2) => {
  console.error(why);
  process.exit(code);
};
if (!world && !flares) stop('usage: node scripts/bf2017-volumes.mjs <world> [--level levels/mp/<map>] [--pack level.json] [--lighting file] [--origin x,y,z --yaw r --arena m] [--no-extras] [--dry]');

const level = arg('level') ?? `levels/mp/${world ?? 'hoth'}_01`;
const name = level.split('/').pop();
const dry = argv.includes('--dry');
const outDir = join(ROOT, 'public/models/galaxy/bf2017/levels', world ?? '');

function keys() {
  const file = join(ROOT, '.env.local');
  let from = 'the environment';
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
    from = '.env.local';
  }
  const base = process.env.SUPABASE_URL;
  const key = process.env.BF2017_KEY || process.env.SUPA_KEY;
  if (!base || !key) return { from, env: null };
  return { from, env: { base, headers: { apikey: key, Authorization: `Bearer ${key}` } } };
}

function frame() {
  const packFile = arg('pack') ?? join(outDir, 'level.json');
  if (existsSync(packFile)) {
    const pack = JSON.parse(readFileSync(packFile, 'utf8'));
    console.log(`frame from ${packFile}: origin ${pack.origin}, yaw ${pack.yaw}, cell ${pack.cell}, arena ${pack.arena}`);
    return pack;
  }
  if (!arg('origin')) stop(`no level pack at ${packFile} (lane L's builder writes it): pass --pack, or --origin x,y,z [--yaw r] [--arena m]`);
  return { origin: arg('origin').split(',').map(Number), yaw: Number(arg('yaw') ?? 0), cell: 128, arena: Number(arg('arena') ?? 0) };
}

// A record under data/ by its name. The bucket keeps each folder in the case
// it was first uploaded in (`data/FX/Lighting/Emitters/` holds
// `fx/lighting/emitters/em_*`), so each folder is matched without case.
const listed = new Map();
async function list(env, prefix) {
  if (!listed.has(prefix)) {
    const res = await fetch(`${env.base.replace(/\/+$/, '')}/storage/v1/object/list/${BUCKET}`, { method: 'POST', headers: { ...env.headers, 'content-type': 'application/json' }, body: JSON.stringify({ prefix, limit: 1000, search: '' }) });
    listed.set(prefix, res.ok ? (await res.json()).map((o) => o.name) : []);
  }
  return listed.get(prefix);
}
async function record(env, name) {
  let prefix = 'data/';
  const parts = name.split('/');
  for (let i = 0; i < parts.length; i++) {
    const want = i === parts.length - 1 ? `${parts[i]}.json.gz` : parts[i];
    const hit = (await list(env, prefix)).find((n) => n.toLowerCase() === want.toLowerCase());
    if (!hit) return null;
    prefix += i === parts.length - 1 ? hit : `${hit}/`;
  }
  const res = await fetch(objectUrl(env.base, BUCKET, prefix), { headers: env.headers });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return JSON.parse((buf[0] === 0x1f ? gunzipSync(buf) : buf).toString('utf8'));
}

// each light cone effect's quad, from its blueprint's emitter
async function shapesOf(env, effects) {
  const shapes = {};
  for (const name of new Set(effects.map((e) => e.effect ?? e.name).filter((n) => CONE_RE.test(String(n))))) {
    const bp = await record(env, name);
    const em = bp?.objects?.find((o) => o?.$type === 'EmitterEntityData')?.Emitter?.$asset;
    const doc = em ? await record(env, em) : null;
    const shape = doc ? coneShape(doc) : null;
    console.log(`${name}: ${shape ? `${shape.width} × ${shape.height} m, colour ${shape.color}, exponent ${shape.exponent}` : 'emitter not read (the named defaults)'}`);
    if (shape) shapes[name.split('/').pop()] = shape;
  }
  return shapes;
}

async function get(env, path) {
  const res = await fetch(objectUrl(env.base, BUCKET, path), { headers: env.headers });
  if (!res.ok) stop(`${path}: ${res.status} from the bucket`, 1);
  return res.json();
}

if (flares) {
  const { from, env } = keys();
  if (!env) stop(`no bucket key (read: ${from}): the flares are in the bucket's data/`);
  const res = await fetch(objectUrl(env.base, BUCKET, 'data.tsv'), { headers: env.headers });
  if (!res.ok) stop(`data.tsv: ${res.status} from the bucket`, 1);
  const names = (await res.text())
    .split('\n')
    .map((l) => l.split('\t'))
    .filter((c) => c[1] === 'LensFlareBlueprint')
    .map((c) => c[0]);
  const out = { _from: `the bucket's data/: every LensFlareBlueprint data.tsv lists (${names.length}), read by flare.js's flareElements`, flares: {} };
  for (const n of names) {
    const asset = await record(env, n);
    if (!asset) {
      console.log(`${n}: missing`);
      continue;
    }
    const f = flareElements(asset);
    out.flares[n.split('/').pop()] = { ...f, _source: `${n}#LensFlareEntityData` };
    console.log(`${n}: ${f.elements.length} elements, occluder ${f.occluderSize} m`);
  }
  if (!dry) {
    const file = join(ROOT, 'src/data/bf2017/flares.json');
    writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`);
    console.log(`wrote ${file}`);
  }
  process.exit(0);
}

const pack = frame();
const lightingFile = arg('lighting') ?? join(ROOT, 'src/data/bf2017/maps', `${world}.lighting.json`);
const volumetrics = existsSync(lightingFile) ? (JSON.parse(readFileSync(lightingFile, 'utf8')).rows?.volumetrics ?? []) : [];
console.log(`${volumetrics.length} SimpleVolumetrics from ${existsSync(lightingFile) ? lightingFile : '(no lighting.json)'}`);
let effects = [];
let subworlds = null;
let shapes = {};
if (!argv.includes('--no-extras')) {
  const { from, env } = keys();
  if (!env) console.log(`no bucket key (read: ${from}): the light cone spawns are left out; the boxes alone are written`);
  else {
    console.log(`keys from ${from}`);
    const dir = `web/maps/${level}`;
    const [manifest, extras] = await Promise.all([get(env, `${dir}/${name}.json`), get(env, `${dir}/${name}.extras.json`)]);
    effects = extras.effects ?? [];
    subworlds = manifest.subworlds ?? null;
    console.log(`${effects.length} effect spawns in the extras`);
    shapes = await shapesOf(env, effects);
  }
}
const json = volumesJson({ volumetrics, effects, shapes }, pack, { subworlds });
console.log(`${name}: ${json.count} kept (${json.kinds.box} box, ${json.kinds.cone} cone); left out: ${Object.entries(json.skipped).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);
console.log(`cells: ${Object.keys(json.cells).length}`);
if (dry) process.exit(0);
mkdirSync(outDir, { recursive: true });
const out = join(outDir, 'volumes.json');
writeFileSync(out, `${JSON.stringify(json)}\n`);
console.log(`wrote ${out} (${(JSON.stringify(json).length / 1024).toFixed(1)} KB)`);

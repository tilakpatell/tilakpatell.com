// The game's planet skins into the site: lists the bucket's planet textures
// (web/textures.jsonl), resolves scripts/lib/bf2017-planets.mjs's SKINS
// against it, fetches each map (its PNG first, else its KTX2, unpacked),
// converts it to the site's sizes under public/textures/galaxy/planets/<id>/
// and writes src/data/planetSkins.json, which bodies.js reads. Prints a
// table: each planet, the maps it got, its bytes per tier and what is
// missing (the upload may still be running: run it again when it has them).
//
//   node --env-file=.env.local scripts/bf2017-planets.mjs [--only endor,naboo] [--dry] [--list] [--refresh]
//   node scripts/bf2017-planets.mjs --local [--root <dir>] [--out <dir>] [--data <file>]
//
//   dry      the plan only: which game name each map is, and what is missing
//   list     the bucket's planet texture names, and how many
//   refresh  fetch textures.jsonl again (it is kept under lab/assets/bf2017/)
//   local    no network: the names are the maps already under the root
//            (lab/assets/bf2017, or --root, e.g. scripts/fixtures/bf2017)
//
// The keys: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (lib/bucket.mjs) from
// the environment, never printed. (Node's fetch reads the proxy only with NODE_USE_ENV_PROXY=1.)

import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { localPath, objectUrl } from './lib/bf2017-paths.mjs';
import { NO_KEYS, bucketEnv } from './lib/bucket.mjs';
import { PICTURES, SKINS, TIERS, UNPLACED, convertSkin, isPlanetTexture, nameOf, planFor, planetNames, sequelWorld, skinsJson } from './lib/bf2017-planets.mjs';
import { unpackKtx2 } from './lib/bf2017-textures.mjs';
import { encodeImage } from './ktx2.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUCKET = 'bf2017-assets';
const LIST = 'web/textures.jsonl';
const WAITS = [1000, 2000, 4000];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function keys() {
  const env = bucketEnv();
  if (!env) {
    console.error(`${NO_KEYS} (or run with --local)`);
    process.exit(2);
  }
  return env;
}

// one object to disk, retried on a fault; false when the bucket hasn't it
async function getObject(env, root, path) {
  const file = localPath(root, path);
  if (existsSync(file)) return true;
  for (let i = 0; ; i++) {
    try {
      const res = await env.fetch(objectUrl(env.base, BUCKET, path));
      if (res.status < 500) {
        if (!res.ok) return false;
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, Buffer.from(await res.arrayBuffer()));
        return true;
      }
    } catch (e) {
      if (i >= WAITS.length) throw e;
    }
    if (i >= WAITS.length) return false;
    await sleep(WAITS[i]);
  }
}

// a map's PNG: the raw one, else its KTX2 unpacked (null when neither is there)
async function pngOf(env, root, name) {
  const has = async (p) => (env ? getObject(env, root, p) : existsSync(localPath(root, p)));
  const png = `web/textures/${name}.png`;
  if (await has(png)) return readFile(localPath(root, png));
  const ktx2 = `web/textures/${name}.ktx2`;
  if (!(await has(ktx2))) return null;
  return readFile(await unpackKtx2(localPath(root, ktx2), join(root, 'unpacked', dirname(name))));
}

const walk = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)])) : []);
const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const root = args.root ? join(ROOT, args.root) : join(ROOT, 'lab', 'assets', 'bf2017');
  const outDir = args.out ? join(ROOT, args.out) : join(ROOT, 'public', 'textures', 'galaxy', 'planets');
  const dataFile = args.data ? join(ROOT, args.data) : join(ROOT, 'src', 'data', 'planetSkins.json');
  const env = args.local ? null : keys();

  let names;
  if (env) {
    if (args.refresh) await rm(localPath(root, LIST), { force: true });
    if (!(await getObject(env, root, LIST))) {
      console.error(`${LIST}: not in the bucket`);
      process.exit(1);
    }
    names = planetNames(await readFile(localPath(root, LIST), 'utf8'));
  } else {
    const base = join(root, 'web', 'textures');
    names = new Set(
      walk(base)
        .filter((f) => /\.(png|ktx2)$/i.test(f))
        .map((f) => nameOf(relative(base, f).split('\\').join('/')))
        .filter(isPlanetTexture),
    );
  }

  if (args.list) {
    for (const n of [...names].sort()) console.log(n);
    console.log(`${names.size} planet textures listed${env ? ' in the bucket' : ' on disk'}`);
    process.exit(0);
  }

  const only = typeof args.only === 'string' ? args.only.split(',') : Object.keys(SKINS);
  const entries = existsSync(dataFile) ? JSON.parse(await readFile(dataFile, 'utf8')) : {};
  const rows = [];
  for (const id of only) {
    if (sequelWorld(id) || !SKINS[id]) {
      rows.push({ id, got: '', bytes: {}, missing: sequelWorld(id) ? 'sequel: never' : 'not in SKINS' });
      continue;
    }
    const plan = planFor(SKINS[id], names);
    const missing = plan.missing.map((m) => `${m.kind} (${m.why})`);
    if (args.dry) {
      rows.push({ id, got: plan.fetch.map((f) => `${f.kind}: ${f.name}`).join('<br>'), bytes: {}, missing: missing.join(', ') });
      continue;
    }
    const images = {};
    const from = {};
    for (const f of plan.fetch) {
      const png = await pngOf(env, root, f.name);
      if (png) {
        images[f.kind] = png;
        from[f.kind] = f.name;
      } else missing.push(`${f.kind} (listed, not fetched)`);
    }
    const { entry, files } = await convertSkin({ id, skin: SKINS[id], images, outDir, encodeKtx2: encodeImage });
    if (entry) entries[id] = { ...entry, from };
    const bytes = {};
    for (const f of files) bytes[f.tier] = (bytes[f.tier] ?? 0) + f.bytes;
    rows.push({ id, got: entry ? Object.keys(from).join(', ') : '', bytes, missing: missing.join(', ') });
  }
  if (!args.dry) {
    await mkdir(dirname(dataFile), { recursive: true });
    await writeFile(dataFile, skinsJson(entries));
  }
  console.log(`| planet | maps | ${TIERS.join(' | ')} | missing |\n|---|---|${TIERS.map(() => '---|').join('')}---|`);
  for (const r of rows) console.log(`| ${r.id} | ${r.got} | ${TIERS.map((t) => (r.bytes[t] ? mb(r.bytes[t]) : '')).join(' | ')} | ${r.missing} |`);
  console.log(`\n${names.size} planet textures listed; ${Object.keys(entries).length} planets skinned.`);
  console.log(`Pictures of a globe, not maps (these stay procedural): ${Object.keys(PICTURES).join(', ')}.`);
  console.log(`Not on the site: ${UNPLACED.join(', ')}.`);
}

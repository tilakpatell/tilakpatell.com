#!/usr/bin/env node
// A level's placed decals beside its pack: the game's map extras
// (`web/maps/<level>/<name>.extras.json` in the private bf2017-assets
// bucket) to `public/models/galaxy/bf2017/levels/<world>/decals.json`,
// rebased to lane L's pack frame and binned by its cells
// (scripts/lib/bf2017-decals.mjs says how each decal is read).
//
//   node scripts/bf2017-decals.mjs <world> [--level levels/mp/<map>]
//     [--pack public/models/galaxy/bf2017/levels/<world>/level.json]
//     [--origin x,y,z --yaw radians --arena metres] [--extras <local file>] [--fetch] [--dry]
//
// The frame comes from the pack's level.json (`origin`, `yaw`, `cell`,
// `arena`); without a pack, --origin (and --yaw, --arena) give it; without
// either the script stops. --extras reads a local extras file in place of
// the bucket's (no keys needed). --fetch takes each decal texture's KTX2
// from the bucket into the pack's `tex/decals/`, named by its file. A
// level with no decals (Hoth) writes nothing and says so. --dry prints the
// counts and writes nothing.
//
// The keys: SUPABASE_URL and BF2017_KEY (or SUPA_KEY), from .env.local when
// it is there, else from the environment; never printed. In a cloud
// session Node's fetch needs NODE_USE_ENV_PROXY=1.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decalsOf } from './lib/bf2017-decals.mjs';
import { objectUrl } from './lib/bf2017-paths.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUCKET = 'bf2017-assets';
const argv = process.argv.slice(2);
const world = argv[0] && !argv[0].startsWith('--') ? argv[0] : null;
const arg = (k) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};
const stop = (why, code = 2) => {
  console.error(why);
  process.exit(code);
};
if (!world) stop('usage: node scripts/bf2017-decals.mjs <world> [--level levels/mp/<map>] [--pack level.json] [--origin x,y,z --yaw r --arena m] [--extras file] [--fetch] [--dry]');

const level = arg('level') ?? `levels/mp/${world}_01`;
const name = level.split('/').pop();
const dry = argv.includes('--dry');
const fetchTex = argv.includes('--fetch');
const local = arg('extras');
const outDir = join(ROOT, 'public/models/galaxy/bf2017/levels', world);

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
  if (!base || !key) stop(`no bucket key: set SUPABASE_URL and BF2017_KEY in .env.local (read: ${from})`);
  console.log(`keys from ${from}`);
  return { base, headers: { apikey: key, Authorization: `Bearer ${key}` } };
}

function frame() {
  const packFile = arg('pack') ?? join(outDir, 'level.json');
  if (existsSync(packFile)) {
    const pack = JSON.parse(readFileSync(packFile, 'utf8'));
    console.log(`frame from ${packFile}: origin ${pack.origin}, yaw ${pack.yaw}, cell ${pack.cell}, arena ${pack.arena}`);
    return pack;
  }
  if (!arg('origin')) stop(`no level pack at ${packFile} (lane L's builder writes it): pass --pack, or --origin x,y,z [--yaw r] [--arena m]`);
  const pack = { origin: arg('origin').split(',').map(Number), yaw: Number(arg('yaw') ?? 0), cell: 128, arena: Number(arg('arena') ?? 0) };
  console.log(`frame from the flags: origin ${pack.origin}, yaw ${pack.yaw}, arena ${pack.arena || 'all'}`);
  return pack;
}

async function get(env, path, as = 'json') {
  const res = await fetch(objectUrl(env.base, BUCKET, path), { headers: env.headers });
  if (!res.ok) stop(`${path}: ${res.status} from the bucket`, 1);
  return as === 'json' ? res.json() : Buffer.from(await res.arrayBuffer());
}

const pack = frame();
const env = local && !fetchTex ? null : keys();
const dir = `web/maps/${level}`;
const [manifest, extras] = local ? [null, JSON.parse(readFileSync(local, 'utf8'))] : await Promise.all([get(env, `${dir}/${name}.json`), get(env, `${dir}/${name}.extras.json`)]);
const json = decalsOf(extras, pack, { subworlds: manifest?.subworlds ?? null });

console.log(`${name}: ${extras.decals?.length ?? 0} decals in the extras, ${json.count} kept (${json.kinds.projected} projected, ${json.kinds.volume} volume), ${json.textures.length} textures`);
console.log(`left out: ${Object.entries(json.skipped).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);
const perCell = Object.entries(json.cells)
  .map(([k, v]) => [k, v.length])
  .sort((a, b) => b[1] - a[1]);
console.log(`cells: ${perCell.length}; the fullest: ${perCell.slice(0, 8).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}`);
if (dry) process.exit(0);
if (!json.count) {
  console.log(`no decals to draw on ${world}: nothing written`);
  process.exit(0);
}
mkdirSync(outDir, { recursive: true });
if (fetchTex) {
  const texDir = join(outDir, 'tex/decals');
  mkdirSync(texDir, { recursive: true });
  for (const [tex, file] of Object.entries(json.files)) {
    if (!file) {
      console.log(`missing: ${tex} (no textureFiles row)`);
      continue;
    }
    const to = join(texDir, basename(file));
    if (!existsSync(to)) writeFileSync(to, await get(env, `web/${file}`, 'bytes'));
    json.files[tex] = `tex/decals/${basename(file)}`;
  }
}
const out = join(outDir, 'decals.json');
writeFileSync(out, `${JSON.stringify(json)}\n`);
console.log(`wrote ${out} (${(JSON.stringify(json).length / 1024).toFixed(1)} KB)`);

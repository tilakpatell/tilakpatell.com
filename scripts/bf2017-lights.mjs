#!/usr/bin/env node
// A level's placed lights beside its pack: the game's map extras
// (`web/maps/<level>/<name>.extras.json` in the private bf2017-assets
// bucket) to `public/models/galaxy/bf2017/levels/<world>/lights.json`,
// rebased to lane L's pack frame and binned by its cells
// (scripts/lib/bf2017-lights.mjs says how each light is read).
//
//   node scripts/bf2017-lights.mjs <world> [--level levels/mp/hoth_01]
//     [--pack public/models/galaxy/bf2017/levels/<world>/level.json]
//     [--origin x,y,z --yaw radians --arena metres] [--dry]
//
// The frame comes from the pack's level.json (`origin`, `yaw`, `cell`,
// `arena`); without a pack, --origin (and --yaw, --arena) give it, and
// without either the script stops: lights in the wrong frame are worse
// than none. --dry prints the counts and writes nothing.
//
// The keys: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (lib/bucket.mjs),
// from .env.local when it is there, else from the environment; the script says which, never prints
// them, and stops plainly without them.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lightsJson } from './lib/bf2017-lights.mjs';
import { objectUrl } from './lib/bf2017-paths.mjs';
import { bucketEnv } from './lib/bucket.mjs';

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
if (!world) stop('usage: node scripts/bf2017-lights.mjs <world> [--level levels/mp/<map>] [--pack level.json] [--origin x,y,z --yaw r --arena m] [--dry]');

const level = arg('level') ?? `levels/mp/${world}_01`;
const name = level.split('/').pop();
const dry = argv.includes('--dry');
const outDir = join(ROOT, 'public/models/galaxy/bf2017/levels', world);

// ── the keys ──
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
  const env = bucketEnv();
  if (!env) stop(`no bucket key: set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (lib/bucket.mjs) in .env.local (read: ${from})`);
  console.log(`keys from ${from}`);
  return env;
}

// ── the frame ──
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

async function get(env, path) {
  const res = await env.fetch(objectUrl(env.base, BUCKET, path));
  if (!res.ok) stop(`${path}: ${res.status} from the bucket`, 1);
  return res.json();
}

const pack = frame();
const env = keys();
const dir = `web/maps/${level}`;
const [manifest, extras] = await Promise.all([get(env, `${dir}/${name}.json`), get(env, `${dir}/${name}.extras.json`)]);
const json = lightsJson(extras, pack, { subworlds: manifest.subworlds });

console.log(`${name}: ${extras.lights?.length ?? 0} lights in the extras, ${json.count} kept (${json.kinds.point} point, ${json.kinds.spot} spot)`);
console.log(`left out: ${Object.entries(json.skipped).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);
const perCell = Object.entries(json.cells)
  .map(([k, v]) => [k, v.length])
  .sort((a, b) => b[1] - a[1]);
console.log(`cells: ${perCell.length}; the fullest: ${perCell.slice(0, 8).map(([k, n]) => `${k} ${n}`).join(', ')}`);
if (dry) process.exit(0);
mkdirSync(outDir, { recursive: true });
const out = join(outDir, 'lights.json');
writeFileSync(out, `${JSON.stringify(json)}\n`);
console.log(`wrote ${out} (${(JSON.stringify(json).length / 1024).toFixed(1)} KB)`);

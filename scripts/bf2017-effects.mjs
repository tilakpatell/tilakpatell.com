#!/usr/bin/env node
// A level's placed effects beside its pack (fidelity lane X): the game's
// map extras (`web/maps/<level>/<name>.extras.json`, `effects[]`, in the
// private bf2017-assets bucket or the export on the desktop) to
// `public/models/galaxy/bf2017/levels/<world>/effects.json`, rebased to
// lane L's pack frame and binned by its cells, as scripts/bf2017-lights.mjs
// does the lights (scripts/lib/bf2017-effects.mjs says how each is read).
// The effects it names with no table under src/data/bf2017/fx/ are listed:
// scripts/bf2017-emitters.mjs --level <world> reads them.
//
//   node scripts/bf2017-effects.mjs <world> [--level levels/mp/hoth_01]
//     [--root <export>] [--out <effects.json>]
//     [--pack public/models/galaxy/bf2017/levels/<world>/level.json]
//     [--origin x,y,z --yaw radians --arena metres] [--dry]
//
// The frame comes from the pack's level.json (`origin`, `yaw`, `cell`,
// `arena`); without a pack, --origin (and --yaw, --arena) give it, and
// without either the script stops: effects in the wrong frame are worse
// than none. --root reads the extras from the export instead of the bucket. --dry prints the counts and writes nothing.
//
// The keys: SUPABASE_URL and BF2017_KEY (or SUPA_KEY, the same key under
// the name the cloud sessions hold it by), from .env.local when it is
// there, else from the environment; the script says which, never prints
// them, and stops plainly without them.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { effectsJson } from './lib/bf2017-effects.mjs';
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
if (!world) stop('usage: node scripts/bf2017-effects.mjs <world> [--level levels/mp/<map>] [--root <export>] [--out file] [--pack level.json] [--origin x,y,z --yaw r --arena m] [--dry]');

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
  const base = process.env.SUPABASE_URL;
  const key = process.env.BF2017_KEY || process.env.SUPA_KEY;
  if (!base || !key) stop(`no bucket key: set SUPABASE_URL and BF2017_KEY in .env.local (read: ${from})`);
  console.log(`keys from ${from}`);
  return { base, headers: { apikey: key, Authorization: `Bearer ${key}` } };
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
  const res = await fetch(objectUrl(env.base, BUCKET, path), { headers: env.headers });
  if (!res.ok) stop(`${path}: ${res.status} from the bucket`, 1);
  return res.json();
}

const pack = frame();
const dir = `web/maps/${level}`;
let manifest;
let extras;
if (arg('root')) {
  const read = (p) => (existsSync(join(arg('root'), p)) ? JSON.parse(readFileSync(join(arg('root'), p), 'utf8')) : null);
  extras = read(`${dir}/${name}.extras.json`) ?? stop(`no ${dir}/${name}.extras.json under ${arg('root')}`, 1);
  manifest = read(`${dir}/${name}.json`) ?? { subworlds: extras.subworlds };
} else {
  const env = keys();
  [manifest, extras] = await Promise.all([get(env, `${dir}/${name}.json`), get(env, `${dir}/${name}.extras.json`)]);
}
const fxDir = join(ROOT, 'src/data/bf2017/fx');
const known = new Set(existsSync(fxDir) ? readdirSync(fxDir).filter((f) => !f.startsWith('_') && f.endsWith('.json')).map((f) => f.slice(0, -5)) : []);
const json = effectsJson(extras, pack, { subworlds: manifest.subworlds, known });

console.log(`${name}: ${extras.effects?.length ?? 0} effect spawns in the extras, ${json.count} kept of ${Object.keys(json.kinds).length} effects`);
console.log(`left out: ${Object.entries(json.skipped).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);
console.log(`the most spawned: ${Object.entries(json.kinds).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${k} ${n}`).join(', ')}`);
if (json.unread.length) console.log(`no table yet (${json.unread.length}): ${json.unread.join(', ')}`);
const perCell = Object.entries(json.cells)
  .map(([k, v]) => [k, v.length])
  .sort((a, b) => b[1] - a[1]);
console.log(`cells: ${perCell.length}; the fullest: ${perCell.slice(0, 8).map(([k, n]) => `${k} ${n}`).join(', ')}`);
if (dry) process.exit(0);
const out = arg('out') ?? join(outDir, 'effects.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(json)}\n`);
console.log(`wrote ${out} (${(JSON.stringify(json).length / 1024).toFixed(1)} KB)`);

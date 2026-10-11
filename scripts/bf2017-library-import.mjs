// The drop's object library, imported on demand (the fifth design, lane O):
// each object a world asks for by name (`game:<name>`, catalog/
// bf2017-library.js) fetched (scripts/bf2017-fetch.mjs), cut by
// scripts/bf2017-import.mjs to the native rule (the plain cut the game's
// own KTX2 untouched, the light `.lod1` and the `.far` cut the same maps
// with their top mips dropped, nothing re-encoded) into
// public/models/galaxy/surface/game/<slug>.glb, credited by the import
// (`surface-game-<slug>`), its index row copied into
// src/data/bf2017/library-used.json, and with --publish the cuts sent to the
// bucket (scripts/assets-publish.mjs) so the page can draw them.
//
//   node scripts/bf2017-library-import.mjs <name>[,<name>…] [--publish]
//   node scripts/bf2017-library-import.mjs --set <set> [--kind prop] [--size small,medium] [--publish]
//   node scripts/bf2017-library-import.mjs --from <file>[,<file>…] [--publish]   (every `game:<name>` the files name)
//     [--as '<what it is>'] [--tex 4096] [--light 512] [--far-tex 128] [--dry]
//
//   tex     the plain cut's maps at most this (4096: the game's own, untouched)
//   light   the light cut's colour (its other maps half that): a scattered
//           kind's 512 and 256
//   dry     the names, and nothing fetched
//
// The keys: SUPABASE_URL and SUPA_KEY (or BF2017_KEY), never printed;
// NODE_USE_ENV_PROXY=1 behind a proxy.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { inEra } from './lib/bf2017-library.mjs';
import { readLibrary } from './bf2017-library.mjs';
import { importModel } from './bf2017-import.mjs';
import { gameUrl, slugOf } from '../src/components/galaxy/surface/catalog/bf2017-slug.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const USED = process.env.LIBRARY_USED ?? join(ROOT, 'src', 'data', 'bf2017', 'library-used.json');
const GAME_REF = /game:([a-z0-9_./-]+)/gi;

// what a row is, for its credit: its name's words, and its set
const SETS = { _galacticempire: 'the Empire’s', _rebelalliance: 'the Rebellion’s', _galacticrepublic: 'the Republic’s', _separatists: 'the Separatists’', _generic: 'the galaxy’s' };
export function asOf(row) {
  const words = row.tags.length ? row.tags.join(' ') : row.name.split('/').pop();
  const set = SETS[row.set] ?? (row.set.charAt(0).toUpperCase() + row.set.slice(1)).replace(/_/g, ' ');
  return `${words} (${set} ${row.kind})`;
}

// the names to import: given, a set's, or every `game:` a file names
export function namesFrom(args, rows) {
  if (typeof args.from === 'string') {
    const out = new Set();
    for (const f of args.from.split(',')) for (const m of readFileSync(f, 'utf8').matchAll(GAME_REF)) out.add(m[1]);
    return [...out];
  }
  if (typeof args.set === 'string') {
    const kinds = typeof args.kind === 'string' ? args.kind.split(',') : null;
    const sizes = typeof args.size === 'string' ? args.size.split(',') : null;
    return rows.filter((r) => r.set === args.set && (!kinds || kinds.includes(r.kind)) && (!sizes || sizes.includes(r.size))).map((r) => r.name);
  }
  return String(args._[0] ?? '')
    .split(',')
    .filter(Boolean);
}

export function readUsed(file = USED) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
}
export function writeUsed(used, file = USED) {
  const sorted = Object.fromEntries(Object.keys(used).sort().map((k) => [k, used[k]]));
  writeFileSync(file, `${JSON.stringify(sorted, null, 1)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const rows = readLibrary();
  const byName = new Map(rows.map((r) => [r.name, r]));
  const names = namesFrom(args, rows);
  if (!names.length) {
    console.error('usage: node scripts/bf2017-library-import.mjs <name>[,<name>…] | --set <set> [--kind k] [--size s] | --from <file> [--publish]');
    process.exit(1);
  }
  const used = readUsed();
  const failed = [];
  for (const name of names) {
    const row = byName.get(name);
    // (the index has no sequel row, and nothing that isn't placeable)
    if (!row || !inEra(name)) {
      console.error(`${name}: not in the library's index (scripts/bf2017-library.mjs)`);
      failed.push(name);
      continue;
    }
    if (args.dry) {
      console.log(`${name}  ${slugOf(name)}  ${row.kind} ${row.size} ${row.tris}`);
      continue;
    }
    const fetched = spawnSync(process.execPath, [join(ROOT, 'scripts', 'bf2017-fetch.mjs'), name], { stdio: ['ignore', 'ignore', 'inherit'] });
    if (fetched.status !== 0) {
      failed.push(name);
      continue;
    }
    const as = typeof args.as === 'string' ? args.as : asOf(row);
    const light = Number(args.light ?? 512);
    const tex = Number(args.tex ?? 4096);
    try {
      console.log(`${name} → ${gameUrl(name)}`);
      const made = await importModel(name, { kind: slugOf(name), as, native: true, far: true, sub: 'surface/game', catalog: false, tex, maps: tex, lod1Tex: light, lod1Maps: light / 2, farTex: Number(args.farTex ?? 128) });
      const plain = made.find(([cut]) => cut === 'plain')[2];
      used[name] = { set: row.set, kind: row.kind, size: row.size, tris: row.tris, as, metres: Number(plain.size[1].toFixed(3)), ...(row.rig ? { rig: true } : {}) };
    } catch (e) {
      console.error(`${name}: ${e.message}`);
      failed.push(name);
    }
  }
  if (!args.dry) writeUsed(used);
  if (args.publish && !args.dry) {
    const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'assets-publish.mjs'), '--only', 'models/galaxy/surface/game/*'], { stdio: 'inherit' });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
  if (failed.length) {
    console.error(`not imported: ${failed.length}\n  ${failed.join('\n  ')}`);
    process.exit(1);
  }
}

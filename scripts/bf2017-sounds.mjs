// The Hoth sound set (scripts/lib/bf2017-sounds.mjs's SET) from the game's
// sound export to the site's MP3s under public/audio/galaxy/bf2017/, and the
// index the Battlefront world plays by, src/data/bf2017/sounds.json. The
// export (bf2-re/findings/36-sound-export.md) is 7,674 WAV on the owner's
// disk under Downloads/BF2_Extract/web/sounds/ with a manifest line a take;
// the same files go to the bucket's `web/sounds` (scripts/bf2017-audio.mjs
// reads them there one at a time).
//
//   node scripts/bf2017-sounds.mjs [--from <web/sounds dir>] [--manifest <hoth-export.jsonl>] [--only <name prefix>] [--dry]
//
// ffmpeg encodes each take as the site's pipeline does (bf2017-audio.mjs:
// MP3, 96 kbit/s): mono for a one-shot (`-ac 1` downmixes), stereo at
// 112 kbit/s for the music stems and the beds, where a quad or 6-channel
// source keeps its front pair. A `concat` row's takes are joined into one
// file (the 3 s quad bed takes make one loop). The index row: { files,
// bytes, seconds, stereo, loop, gain, asset }.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { SET, fileOf, planSet } from './lib/bf2017-sounds.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DIR = 'audio/galaxy/bf2017';
export const INDEX = 'src/data/bf2017/sounds.json';
const OUT = join(ROOT, 'public', DIR);
const MONO = ['-ac', '1', '-b:a', '96k'];
// (the front pair of a quad or 6-channel bed, both channels of a stereo stem)
const STEREO = (channels) => [...(channels > 2 ? ['-af', 'pan=stereo|c0=c0|c1=c1'] : ['-ac', '2']), '-b:a', '112k'];

const args = parseArgs(process.argv.slice(2));
const from = typeof args.from === 'string' ? args.from : 'C:/Users/tilak/Downloads/BF2_Extract/web/sounds';
const manifest = typeof args.manifest === 'string' ? args.manifest : 'C:/Users/tilak/source/repos/bf2-re/data/sounds/hoth-export.jsonl';
const only = typeof args.only === 'string' ? args.only : null;

if (!existsSync(manifest)) {
  console.error(`${manifest}: no manifest (the export's hoth-export.jsonl; --manifest names another)`);
  process.exit(2);
}
const rows = readFileSync(manifest, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const { plan, missing } = planSet(rows, SET);
for (const m of missing) console.warn(`missing in the manifest: ${m.name} ← ${m.asset}`);
const todo = plan.filter((p) => !only || p.name.startsWith(only));

const encode = (srcs, out, opts) => {
  if (srcs.length === 1) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', srcs[0], ...opts, out]);
    return;
  }
  const list = join(tmpdir(), `bf2017-sounds-${process.pid}.txt`);
  writeFileSync(list, srcs.map((s) => `file '${s.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, ...opts, out]);
  rmSync(list, { force: true });
};

if (args.dry) {
  let seconds = 0;
  for (const p of todo) {
    seconds += p.seconds;
    console.log(`${p.name.padEnd(30)} ${String(p.srcs.length).padStart(2)} take(s) ${String(p.seconds).padStart(7)} s ${p.stereo ? 'stereo' : 'mono'}${p.concat ? ' joined' : ''}${p.loop ? ' loop' : ''}`);
  }
  console.log(`${todo.length} names, ${Math.round(seconds)} s`);
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });
const was = existsSync(join(ROOT, INDEX)) ? JSON.parse(readFileSync(join(ROOT, INDEX), 'utf8')) : {};
const index = { _from: { export: 'web/sounds (bf2-re/findings/36-sound-export.md)', date: new Date().toISOString().slice(0, 10), script: 'scripts/bf2017-sounds.mjs' }, dir: DIR, rows: was.rows ?? {} };
let total = 0;
for (const p of todo) {
  const srcs = p.srcs.map((s) => join(from, s));
  const gone = srcs.filter((s) => !existsSync(s));
  if (gone.length) {
    console.warn(`${p.name}: ${gone.length} source file(s) missing under ${from}: ${gone[0]}`);
    continue;
  }
  const opts = p.stereo ? STEREO(p.channels) : MONO;
  const files = [];
  let bytes = 0;
  if (p.concat) {
    const f = fileOf(p.name, 0);
    encode(srcs, join(OUT, f), opts);
    files.push(f);
  } else {
    for (let i = 0; i < srcs.length; i++) {
      const f = fileOf(p.name, i);
      encode([srcs[i]], join(OUT, f), opts);
      files.push(f);
    }
  }
  for (const f of files) bytes += statSync(join(OUT, f)).size;
  total += bytes;
  index.rows[p.name] = { files, bytes, seconds: p.seconds, stereo: p.stereo, loop: p.loop, gain: p.gain, asset: `Sound/${p.asset}` };
  console.log(`${p.name.padEnd(30)} ${files.length} file(s) ${(bytes / 1024).toFixed(0).padStart(6)} KB`);
}
index.rows = Object.fromEntries(Object.keys(index.rows).sort().map((k) => [k, index.rows[k]]));
mkdirSync(dirname(join(ROOT, INDEX)), { recursive: true });
writeFileSync(join(ROOT, INDEX), `${JSON.stringify(index, null, 2)}\n`);
const all = Object.values(index.rows).reduce((s, r) => s + r.bytes, 0);
console.log(`${todo.length} names encoded (${(total / 1e6).toFixed(1)} MB); the index holds ${Object.keys(index.rows).length} names, ${(all / 1e6).toFixed(1)} MB → ${INDEX}`);

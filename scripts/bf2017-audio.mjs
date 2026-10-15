// The game's audio for the site's sounds and lines (src/lib/sound/
// gameSounds.js), the day it is in the bucket. Today (2026-10-10) the drop's
// `data/Sound` holds only Frostbite's records of its sounds, no audio, so
// this says what it finds and stops; once files are there it fetches one by
// its bucket path and makes it the site's MP3 under public/audio/galaxy/
// bf2017/, at the name gameSounds.js then gives the site's sound.
//
//   node --env-file=.env.local scripts/bf2017-audio.mjs              (what audio the bucket holds)
//   node --env-file=.env.local scripts/bf2017-audio.mjs <bucket path> --as <file under public/audio/galaxy/bf2017/> [--stereo]
//
// ffmpeg makes the MP3 (mono, 96 kbit/s, the level the site's clips are
// at; `--stereo` keeps two channels at 112 kbit/s for a music stem or a bed,
// a quad bed's front pair); the keys, SUPABASE_URL and BF2017_KEY (or
// SUPA_KEY), are never printed. The sound export (bf2-re/findings/
// 36-sound-export.md) lands under `web/sounds`; the Hoth set is made whole
// from the owner's copy by scripts/bf2017-sounds.mjs, this is for one file.

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { parseArgs } from './lib/args.mjs';
import { objectUrl } from './lib/bf2017-paths.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/audio/galaxy/bf2017');
const BUCKET = 'bf2017-assets';
const AUDIO = /\.(wav|ogg|opus|mp3|flac|m4a|aac)$/i;
// where the drop's audio would be (`web/sounds`: the sound export's WAVs)
const ROOTS = ['data/Sound', 'web/audio', 'web/sound', 'web/sounds'];

function keys() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.BF2017_KEY || process.env.SUPA_KEY;
  if (!base || !key) {
    console.error('Set SUPABASE_URL and BF2017_KEY (or SUPA_KEY) and run with node --env-file=.env.local.');
    process.exit(2);
  }
  return { base: base.replace(/\/+$/, ''), headers: { apikey: key, Authorization: `Bearer ${key}` } };
}

// every object under a folder, as { path, bytes }
async function list(env, prefix, out = []) {
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${env.base}/storage/v1/object/list/${BUCKET}`, { method: 'POST', headers: { ...env.headers, 'content-type': 'application/json' }, body: JSON.stringify({ prefix, limit: 1000, offset }) });
    if (!res.ok) return out;
    const page = await res.json();
    for (const e of page) {
      if (e.id) out.push({ path: `${prefix}/${e.name}`, bytes: e.metadata?.size ?? 0 });
      else await list(env, `${prefix}/${e.name}`, out);
    }
    if (page.length < 1000) return out;
  }
}

const args = parseArgs(process.argv.slice(2));
const env = keys();
const [from] = args._;

if (!from) {
  let records = 0;
  const audio = [];
  for (const r of ROOTS) {
    const all = await list(env, r);
    records += all.length;
    audio.push(...all.filter((o) => AUDIO.test(o.path)));
  }
  console.log(`${records} objects under ${ROOTS.join(', ')}; ${audio.length} of them audio`);
  for (const a of audio.slice(0, 40)) console.log(`  ${a.path}  ${a.bytes}`);
  process.exit(0);
}

if (typeof args.as !== 'string') {
  console.error('usage: scripts/bf2017-audio.mjs <bucket path> --as <file under public/audio/galaxy/bf2017/>');
  process.exit(1);
}
const res = await fetch(objectUrl(env.base, BUCKET, from), { headers: env.headers });
if (!res.ok) {
  console.error(`${from}: not in the bucket (${res.status})`);
  process.exit(1);
}
const raw = join(tmpdir(), `bf2017-audio-${process.pid}${from.slice(from.lastIndexOf('.'))}`);
await writeFile(raw, Buffer.from(await res.arrayBuffer()));
const out = join(OUT, args.as.replace(/\.[a-z0-9]+$/i, '.mp3'));
await mkdir(dirname(out), { recursive: true });
// (a stereo stem keeps two channels; a quad or 6-channel bed its front pair)
const channels = args.stereo ? ['-af', 'pan=stereo|c0=c0|c1=c1', '-b:a', '112k'] : ['-ac', '1', '-b:a', '96k'];
await promisify(execFile)('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, ...channels, out]);
console.log(`${from} → ${out.slice(ROOT.length + 1)}`);

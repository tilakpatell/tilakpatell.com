#!/usr/bin/env node
// A world's weathering beside its level pack: the VE data file's
// GlobalWeatheringParamsEntityData and the objects it names (the sky
// visibility, the AccumulateOverTimeOp), trimmed by
// src/lib/three/surface/weather.js's weatheringRecord, to
// `public/models/galaxy/bf2017/levels/<world>/weather.json`. The map
// extras' environments (lane R's entry) do not carry it: it is an entity of
// the VE record in `data/`, not a component.
//
//   node scripts/bf2017-weather.mjs <world> --ve Levels/Lighting/Hoth/Sunny_01/VE_Sky_Arctic_Sunny_01
//     [--kind snow|sand|wet] [--data <local .json or .json.gz>] [--dry]
//
// --kind defaults to the world's (weather.js's WEATHER_KIND). --data reads
// a local file (lab/assets/bf2017/data/…, as `bf2017-fetch.mjs data` leaves
// it) in place of the bucket's. The keys: SUPABASE_URL and BF2017_KEY (or
// SUPA_KEY) from the environment, never printed; in a cloud session Node's
// fetch needs NODE_USE_ENV_PROXY=1.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { kindOf, weatherParams, weatheringRecord } from '../src/lib/three/surface/weather.js';
import { objectUrl } from './lib/bf2017-paths.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
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
const ve = arg('ve');
if (!world || !ve) stop('usage: node scripts/bf2017-weather.mjs <world> --ve Levels/Lighting/<…>/VE_<…> [--kind snow|sand|wet] [--data file] [--dry]');
const kind = arg('kind') ?? kindOf(world);
if (!kind) stop(`no weather kind for ${world}: pass --kind snow|sand|wet`);

const unzip = (buf) => (buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf);
async function read() {
  const local = arg('data');
  if (local) return JSON.parse(unzip(readFileSync(local)).toString('utf8'));
  const base = process.env.SUPABASE_URL;
  const key = process.env.BF2017_KEY || process.env.SUPA_KEY;
  if (!base || !key) stop('no bucket key: set SUPABASE_URL and BF2017_KEY (or SUPA_KEY)');
  const res = await fetch(objectUrl(base, 'bf2017-assets', `data/${ve}.json.gz`), { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) stop(`data/${ve}.json.gz: ${res.status} from the bucket`, 1);
  return JSON.parse(unzip(Buffer.from(await res.arrayBuffer())).toString('utf8'));
}

const rec = weatheringRecord(await read(), kind);
const p = weatherParams(rec, kind);
console.log(`${ve}: ${Object.keys(rec.objects).length} weathering objects; ${kind}: ${p.initial} → ${p.target} over ${p.seconds} s, sky ${p.range.join('–')} ^${p.exponent}, indoor ≤ ${p.indoor}`);
if (!Object.keys(rec.objects).length) stop('no weathering in that record: nothing written', 0);
if (argv.includes('--dry')) process.exit(0);
const outDir = join(ROOT, 'public/models/galaxy/bf2017/levels', world);
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'weather.json'), `${JSON.stringify(rec, null, 1)}\n`);
console.log(`wrote ${join(outDir, 'weather.json')}`);

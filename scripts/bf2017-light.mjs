// A world under the game's light: its level's VisualEnvironment records, its
// outdoor probe and its grading LUT, read from the bf2017-assets bucket and
// written for the site.
//
//   node scripts/bf2017-light.mjs <world> --map <level> [--indoor <probe id>]
//       [--main <VE name>] [--also <VE name>,…]
//     e.g. hoth --map levels/mp/hoth_01/hoth_01 --indoor 9c323d00
//   --main: the level's sky when its map names none out of doors (Kamino's
//   storm, the Death Star's space); --also: weathers the map does not name;
//   --with: records of the main weather's own the game blends with it (a
//   space level splits one storm over two: Kamino's VE_Kamino_Stormy_SB_01
//   its sky, fog and tonemap, VE_SB_Kamino_Stormy_02 its sun and fill),
//   merged into it in order
//
// Writes src/data/bf2017/light/<world>.json (one entry a weather the level
// has: the record's sun, sky, fog, exposure, grading, wind and bounce, and
// its probe's sky colours) and, under public/textures/galaxy/bf2017/light/
// <world>/, each weather's outdoor probe and the world's one indoor probe
// (when named: lit by its own lamps, it is the same in every weather) as
// six 64² HDR faces, and each weather's LUT as a 17² × 17 strip (every other
// slice, row and column of the game's 33³: a grade is smooth, and the pack
// stays under 400 KB). Downloads are kept under
// lab/assets/bf2017/ (git-ignored).
//
// The keys: SUPABASE_URL and BF2017_KEY (or SUPA_KEY) from the environment,
// never printed. Behind a proxy, NODE_USE_ENV_PROXY=1.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import sharp from 'sharp';
import { mergeVE, pickEntries, pickVariants, probeStats, readHdr, readVE, shrinkFace, toComponents, weatherKey, writeHdr, lutStrip, halveLut, clipFaces } from './lib/bf2017-light.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'lab/assets/bf2017');
const BUCKET = 'bf2017-assets';
const FACES = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
const PROBE_SIZE = 64;

const args = process.argv.slice(2);
const world = args[0];
const opt = (k) => {
  const i = args.indexOf(`--${k}`);
  return i > 0 ? args[i + 1] : null;
};
const map = opt('map');
const indoorId = opt('indoor');
if (!world || !map) {
  console.error('node scripts/bf2017-light.mjs <world> --map <level path, e.g. levels/mp/hoth_01/hoth_01> [--indoor <probe id>]');
  process.exit(2);
}

const base = process.env.SUPABASE_URL;
const key = process.env.BF2017_KEY || process.env.SUPA_KEY;
if (!base || !key) {
  console.error('Set SUPABASE_URL and BF2017_KEY (or SUPA_KEY) in the environment.');
  process.exit(2);
}
const headers = { apikey: key, Authorization: `Bearer ${key}` };

// One object, from the cache or the bucket; null when the bucket hasn't it.
async function get(path) {
  const file = join(CACHE, path);
  if (existsSync(file)) return readFileSync(file);
  const url = `${base.replace(/\/+$/, '')}/storage/v1/object/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url, { headers });
      if (res.status >= 400 && res.status < 500) return null;
      if (res.ok) {
        const body = Buffer.from(await res.arrayBuffer());
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, body);
        return body;
      }
    } catch {
      // (a network fault: tried again below)
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
  }
  throw new Error(`could not fetch ${path}`);
}
const json = async (path) => {
  const b = await get(path);
  return b ? JSON.parse((path.endsWith('.gz') ? gunzipSync(b) : b).toString('utf8')) : null;
};

const mapRecord = await json(`web/maps/${map}.json`);
if (!mapRecord) throw new Error(`no map at web/maps/${map}.json`);
const picked = pickEntries([...(opt('main') ? [opt('main')] : []), ...(mapRecord.sky ?? []), ...(opt('also') ?? '').split(',').filter(Boolean)]);
const main = opt('main') ?? picked.main;
const overrides = picked.overrides.filter((n) => n !== main);
if (!main) {
  console.log(`${world}: the map names no VE_Sky_ record; nothing written.`);
  process.exit(0);
}
const record = async (name) => {
  const raw = await json(`data/${name}.json.gz`);
  if (!raw) console.log(`  missing: data/${name}.json.gz`);
  return raw ? readVE(toComponents(raw)) : null;
};
let mainRead = await record(main);
if (!mainRead) process.exit(1);
const blended = (opt('with') ?? '').split(',').filter(Boolean);
for (const w of blended) {
  const r = await record(w);
  if (r) mainRead = mergeVE(mainRead, r);
}
const mainWeather = weatherKey(main) ?? 'sunny';
// (each its own copy: the LUT's path is written into each below)
const weathers = { [mainWeather]: structuredClone({ ...mainRead, source: [main, ...blended] }) };
for (const o of overrides) {
  const r = await record(o);
  const w = weatherKey(o);
  if (r && w && !weathers[w]) weathers[w] = structuredClone({ ...mergeVE(mainRead, r), source: [main, o] });
}

// the textures' manifest, for the LUTs' slices and the level's probes
const manifest = (await get('web/textures.jsonl')).toString('utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const byName = new Map(manifest.map((t) => [t.name.toLowerCase(), t]));
const out = join(ROOT, 'public/textures/galaxy/bf2017/light', world);
mkdirSync(out, { recursive: true });
const site = (f) => `textures/galaxy/bf2017/light/${world}/${f}`;

// the grading LUTs: 33 slices to one strip
for (const [w, e] of Object.entries(weathers)) {
  const name = e.grading?.lut;
  if (!name) continue;
  const t = byName.get(name.toLowerCase());
  if (t?.type !== 'volume' || t.depth !== t.width || t.width !== t.height) {
    console.log(`  ${w}: the LUT ${name} is not a cube in the bucket; brightness, contrast and saturation only`);
    delete e.grading.lut;
    continue;
  }
  const n = t.width;
  const slices = [];
  for (const f of t.files) {
    const { data } = await sharp(await get(`web/${f}`)).raw({ depth: 'ushort' }).toBuffer({ resolveWithObject: true });
    slices.push(new Uint16Array(data.buffer, data.byteOffset, data.length / 2));
  }
  const half = (n + 1) / 2;
  const small = Number.isInteger(half) ? halveLut(slices, n) : null;
  const [lut, size] = small ? [small, half] : [lutStrip(slices, n), n];
  await sharp(Buffer.from(lut), { raw: { width: size * size, height: size, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile(join(out, `${w}.lut.png`));
  e.grading.lut = site(`${w}.lut.png`);
  e.grading.lutSize = size;
}

// the probes: the level's reflection volumes by folder
const level = map.split('/').slice(0, -1).join('/').toLowerCase();
const probes = manifest.filter((t) => t.type === 'cube' && t.file.startsWith(`textures/${level}/reflectionvolumetexture/`));
const variantOf = (t) => (t.name.split(/\/ReflectionVolumeTexture\//i)[1] ?? '').split('/').slice(0, -1).join('/');
const variants = [...new Set(probes.map(variantOf))];
const chosen = pickVariants(variants, Object.keys(weathers), mainWeather);
const readProbe = async (t) => {
  const faces = {};
  let size = 0;
  for (const [i, f] of t.files.entries()) {
    const h = readHdr(await get(`web/${f}`));
    faces[FACES[i]] = h.px;
    size = h.w;
  }
  return { t, faces, size, stats: probeStats(faces, size) };
};
const idOf = (t) => t.name.split('/').pop().slice(0, 8);
// (held under twice its horizon's brightness: no sun, no glare, in it)
const CLIP = 2;
const shipProbe = (p, stem) => {
  clipFaces(p.faces, CLIP * (p.stats.horizon[0] * 0.2126 + p.stats.horizon[1] * 0.7152 + p.stats.horizon[2] * 0.0722));
  for (const f of FACES) writeFileSync(join(out, `${stem}.${f}.hdr`), writeHdr({ w: PROBE_SIZE, h: PROBE_SIZE, px: shrinkFace(p.faces[f], p.size, PROBE_SIZE) }));
  return site(stem);
};
const r3 = (c) => c.map((v) => Math.round(v * 1000) / 1000);
for (const [w, e] of Object.entries(weathers)) {
  const vs = chosen[w];
  if (vs) {
    const all = [];
    for (const t of probes.filter((t) => vs.includes(variantOf(t)))) all.push(await readProbe(t));
    // the one that sees the most sky over it
    const best = all.sort((a, b) => b.stats.open - a.stats.open)[0];
    const s = best.stats;
    e.probe = { id: idOf(best.t), variant: variantOf(best.t), zenith: r3(s.zenith), horizon: r3(s.horizon), ground: r3(s.ground), open: Math.round(s.open * 100) / 100, url: shipProbe(best, w) };
    console.log(`  ${w}: outdoor probe ${e.probe.id} of ${e.probe.variant || 'the top'} (of ${all.length}; open ${e.probe.open})`);
  }
}
let indoor = null;
const inside = indoorId ? probes.find((t) => idOf(t) === indoorId) : null;
if (inside) {
  indoor = { id: indoorId, variant: variantOf(inside), url: shipProbe(await readProbe(inside), 'indoor') };
  console.log(`  indoor probe ${indoor.id} of ${indoor.variant}`);
} else if (indoorId) console.log(`  no probe ${indoorId} in the level`);

const light = { world, map, main: mainWeather, sky: { main, overrides }, weathers, indoor };
const file = join(ROOT, 'src/data/bf2017/light', `${world}.json`);
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, `${JSON.stringify(light, null, 1)}\n`);
console.log(`${world}: ${Object.keys(weathers).join(', ')} → ${file.slice(ROOT.length + 1)}`);

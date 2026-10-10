// Everything a map holds beside its pack's level.json (lane E0), each part a
// file the loader it belongs to reads, and a part the map lacks an empty
// one: lights.json (lane R's placed.js), actors.json and vehicles.json (the
// scene's life, rides and things), decals.json (in lane Q4's shape, by its
// scripts/lib/bf2017-decals.mjs's decalsOf where that has landed; Q4's
// src/lib/three/decals/ draws it), effects.json (fidelity X), tracks.json
// (src/lib/three/animTracks.js), probes.json and its 64² faces, the far
// shadow cache (level.json's `shadowCache`, fidelity S), scatter.json
// (the terrain's scatter table, fidelity N). The writers are pure, under
// scripts/lib/bf2017-level-*.mjs; this fetches, cuts and writes. Called by
// scripts/bf2017-level.mjs after the meshes, or alone with --parts.
//
//   writeParts({ env, cache, mapName, base (the map's files' stem under web/), map, json, out, subs, mode, weather, dry, log })
//     → { counts, lines (the README's section) }

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fetchData, fetchWeb, getObject } from './bf2017-fetch.mjs';
import { inBucket } from './lib/bf2017-paths.mjs';
import { mainSubs } from './lib/bf2017-level.mjs';
import { actorsJson, vehiclesJson } from './lib/bf2017-level-actors.mjs';
import { effectsJson } from './lib/bf2017-level-effects.mjs';
import { probesJson } from './lib/bf2017-level-probes.mjs';
import { tracksJson } from './lib/bf2017-level-tracks.mjs';
import { lightsJson } from './lib/bf2017-lights.mjs';
import { clipFaces, probeStats, readHdr, shrinkFace, writeHdr } from './lib/bf2017-light.mjs';
import { CREW } from '../src/components/galaxy/surface/crewList.js';
import { RIDES } from '../src/components/galaxy/surface/rides.js';
import { MODELS as VEHICLES } from '../src/components/galaxy/surface/catalog/bf2017-vehicles.js';

const HAVE = new Set(['fetched', 'kept']);
const FACES = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
const PROBE_SIZE = 64;
const lastOf = (p) => String(p).split('/').pop();
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

async function bytes(env, cache, path) {
  const r = await getObject(env, cache, path);
  return HAVE.has(r.state) ? readFile(r.file) : null;
}

export async function writeParts({ env, cache, mapName, base = `web/maps/${mapName}/${lastOf(mapName)}`, map, json, out, subs = null, mode = 'FantasyBattle', weather = 'sunny', dry = false, log = console.log }) {
  const extrasBuf = await bytes(env, cache, `${base}.extras.json`);
  const extras = extrasBuf ? JSON.parse(extrasBuf.toString('utf8')) : {};
  if (!extrasBuf) log(`${mapName}: no extras in the bucket; the parts are empty`);
  const arena = subs ?? mainSubs(map);
  // (the mode's own layer stands its creatures and its vehicles: Endor's Ewoks, Hoth's walkers)
  const placedSubs = [...arena, mode].map((s) => s.toLowerCase());
  const files = new Map(); // pack path → Buffer | string
  const put = (path, value) => files.set(path, typeof value === 'string' || Buffer.isBuffer(value) ? value : `${JSON.stringify(value)}\n`);
  const counts = {};

  // the lights (bf2017-lights.mjs's reading, lane R's placed.js draws them)
  const lights = lightsJson(extras, json, { subworlds: map.subworlds });
  put('lights.json', lights);
  counts.lights = lights.count;

  // the creatures, droids and civilians; the vehicles
  const actors = actorsJson(map, json, { kinds: new Set(Object.keys(CREW)), subs: placedSubs });
  actors.unresolved = extras.unresolvedObjects ?? {};
  put('actors.json', actors);
  const vehicles = vehiclesJson(map, json, { rides: new Set(Object.keys(RIDES)), things: new Set(Object.keys(VEHICLES)), subs: placedSubs });
  put('vehicles.json', vehicles);
  counts.actors = actors.life.length;
  counts.vehicles = vehicles.rides.length + vehicles.things.length;

  // the decals, in lane Q4's decals.json (its decalsOf, where it has landed;
  // until then the same shape, empty, and the README says so)
  const q4 = await import('./lib/bf2017-decals.mjs').catch(() => null);
  const decals = q4?.decalsOf ? q4.decalsOf(extras, json, { subworlds: map.subworlds }) : { format: 1, cell: json.cell ?? 128, count: 0, kinds: {}, skipped: {}, textures: [], files: {}, cells: {}, waiting: 'lane Q4 (scripts/lib/bf2017-decals.mjs)' };
  put('decals.json', decals);
  counts.decals = decals.count ?? 0;

  // the effect spawns
  const effects = effectsJson(extras, json, { subworlds: map.subworlds });
  put('effects.json', effects);
  counts.effects = effects.length;

  // the curve tracks of what the pack places
  await fetchWeb(env, cache, ['animtracks/**/*.json']);
  const tracksIn = [];
  const walk = async (dir) => {
    if (!existsSync(dir)) return;
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (e.isDirectory()) await walk(join(dir, e.name));
      else if (e.name.endsWith('.json')) tracksIn.push(JSON.parse(await readFile(join(dir, e.name), 'utf8')));
    }
  };
  await walk(join(cache, 'web', 'animtracks'));
  const tracks = tracksJson(tracksIn, json);
  put('tracks.json', tracks);
  counts.tracks = tracks.tracks.length;

  // the probes and the far shadow, from the level's lighting layers
  const folder = String(map.name).split('/').slice(0, -1).join('/');
  await fetchData(env, cache, [`${folder}/*`]);
  const layers = [];
  const dataDir = join(cache, 'data', ...folder.split('/'));
  for (const f of existsSync(dataDir) ? await readdir(dataDir) : []) {
    if (!f.endsWith('.json.gz')) continue;
    // (any layer may hold them: Endor's *_Lighting, Hoth's Cloudy_VFX)
    const text = gunzipSync(await readFile(join(dataDir, f))).toString('utf8');
    if (/ReflectionVolumeEntityData|DistantShadowCacheVolumeEntityData/.test(text)) layers.push(JSON.parse(text));
  }
  const manifest = new Map();
  const texList = await bytes(env, cache, 'web/textures.jsonl');
  const prefix = folder.toLowerCase();
  for (const line of (texList ?? '').toString('utf8').split('\n')) {
    if (!line.includes(prefix.split('/').pop())) continue;
    const t = JSON.parse(line);
    if (t.name.toLowerCase().startsWith(prefix)) manifest.set(t.name.toLowerCase(), t);
  }
  const record = await readFile(join(import.meta.dirname, '..', 'src', 'data', 'bf2017', 'light', `${String(json.world).split('/')[0]}.json`), 'utf8').then(JSON.parse, () => null);
  const probes = probesJson(layers, json, { textures: manifest, weather, variant: record?.weathers?.[weather]?.probe?.variant ?? null });
  const kept = [];
  for (const p of probes.probes) {
    const faces = {};
    let size = 0;
    for (const [i, f] of p.from.entries()) {
      const buf = await bytes(env, cache, `web/${f}`);
      if (!buf) break;
      const h = readHdr(buf);
      faces[FACES[i]] = h.px;
      size = h.w;
    }
    if (Object.keys(faces).length < 6) continue;
    const s = probeStats(faces, size);
    // (held under twice its horizon, as lane G's probes are: no sun in a reflection)
    clipFaces(faces, 2 * (s.horizon[0] * 0.2126 + s.horizon[1] * 0.7152 + s.horizon[2] * 0.0722));
    for (const f of FACES) files.set(`${p.faces}.${f}.hdr`, writeHdr({ w: PROBE_SIZE, h: PROBE_SIZE, px: shrinkFace(faces[f], size, PROBE_SIZE) }));
    const r3 = (c) => c.map((v) => Math.round(v * 1000) / 1000);
    kept.push({ id: p.id, variant: p.variant, centre: p.centre, axes: p.axes, faces: p.faces, zenith: r3(s.zenith), horizon: r3(s.horizon), ground: r3(s.ground), open: Math.round(s.open * 100) / 100 });
  }
  put('probes.json', { probes: kept, skipped: probes.skipped });
  counts.probes = kept.length;
  let shadowCache = null;
  if (probes.shadowCache) {
    const buf = await bytes(env, cache, `web/${probes.shadowCache.from}`);
    if (buf) {
      files.set(probes.shadowCache.png, buf);
      shadowCache = Object.fromEntries(Object.entries(probes.shadowCache).filter(([k]) => k !== 'from'));
    }
  }
  counts.shadow = shadowCache ? 1 : 0;

  // the terrain's scatter table, as the bucket has it
  const scatterPath = map.terrain?.scatter;
  const scatter = scatterPath ? await bytes(env, cache, inBucket(scatterPath)) : null;
  put('scatter.json', scatter ? scatter.toString('utf8') : '{}\n');
  counts.scatter = scatter ? 1 : 0;

  if (!dry) {
    for (const [path, value] of files) {
      await mkdir(join(out, ...path.split('/').slice(0, -1)), { recursive: true });
      await writeFile(join(out, path), value);
    }
  }
  const size = (pred) => [...files].filter(([p]) => pred(p)).reduce((a, [, v]) => a + v.length, 0);
  const unplaced = [...actors.unplaced, ...vehicles.unplaced];
  const lines = [
    "## The map's other parts",
    '',
    `Written beside level.json by \`scripts/bf2017-level-parts.mjs\` (lane E0); a part the map lacks is an empty file.`,
    '',
    '| part | count | bytes | read by |',
    '|---|---|---|---|',
    `| lights.json | ${counts.lights} | ${kb(size((p) => p === 'lights.json'))} | lane R's placed.js |`,
    `| actors.json | ${counts.actors} | ${kb(size((p) => p === 'actors.json'))} | the scene's life rows |`,
    `| vehicles.json | ${counts.vehicles} | ${kb(size((p) => p === 'vehicles.json'))} | the scene's rides and things |`,
    `| decals.json | ${counts.decals}${q4?.decalsOf ? '' : ' (lane Q4 fills it)'} | ${kb(size((p) => p === 'decals.json'))} | lane Q4's src/lib/three/decals/ |`,
    `| effects.json | ${counts.effects} | ${kb(size((p) => p === 'effects.json'))} | fidelity X (nothing until it merges) |`,
    `| tracks.json | ${counts.tracks} | ${kb(size((p) => p === 'tracks.json'))} | src/lib/three/animTracks.js |`,
    `| probes.json and probes/ | ${counts.probes} | ${kb(size((p) => p === 'probes.json' || p.startsWith('probes/')))} | levelProbes.js, lane R's grid |`,
    `| shadow/far.png | ${counts.shadow} | ${kb(size((p) => p.startsWith('shadow/')))} | fidelity S (level.json's shadowCache) |`,
    `| scatter.json | ${counts.scatter} | ${kb(size((p) => p === 'scatter.json'))} | fidelity N |`,
    '',
    `Not placed (no kind on the site yet, or scenery): ${unplaced.map((u) => `${u.blueprint} ×${u.count}`).join(', ') || 'none'}. Decals skipped: ${Object.entries(decals.skipped ?? {}).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}. Tracks of owners the pack lacks: ${tracks.unplaced.length}.`,
    '',
  ];
  for (const l of lines.slice(4, 15)) log(l);
  return { counts, lines, shadowCache };
}

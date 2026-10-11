// A level pack from the Battlefront II (2017) drop (lane L: docs/superpowers/
// plans/2026-10-10-bf2017-phaseL-levels.md, task 2): the game's map, its
// terrain and its meshes, cut for the site and written under
// public/models/galaxy/bf2017/levels/<world>/; scripts/assets-publish.mjs
// publishes every file but level.json and README.md to site-assets (git keeps
// those two; .gitignore's block hides the rest). The work is in scripts/lib/bf2017-level.mjs (pure,
// tested); this fetches, reads and writes.
//
//   node scripts/bf2017-level.mjs <map> --world <id> (--spot <x> <z> | --spawn | --whole [--key <levelKey>]) [--district <id>] [--inside] [--subs a,b] [--drop m,sub:m] [--share 1 | low=0.5,mid=0.8] [--arena 1024] [--yaw 0] [--ultra] [--parts] [--dry]
//
//   map     the map's folder under web/maps/ (levels/mp/hoth_01)
//   world   the site's world (hoth): the pack's folder and its credit
//   spot    the game's x and z that become the site's 0, 0 (the landing spot)
//   spawn   no spot: the first team's first spawn area in the map's gameplay
//           records (fetched from data/), scripts/lib/bf2017-level-spots.mjs
//   district  the pack is levels/<world>/<district>/ (a second map of one
//           world, or an interior); the default `main` is levels/<world>/
//   share   a tier's part of its row the level is fitted to, triangles and
//           calls (low=0.5,mid=0.8; default all of it), where the site's own
//           things already spend the rest
//   parts   only the map's other parts beside a pack already built (lights,
//           actors, vehicles, decals, effects, tracks, probes, the far shadow,
//           the scatter table: scripts/bf2017-level-parts.mjs)
//   mode    the mode layer whose creatures and vehicles stand (FantasyBattle,
//           Galactic Assault); weather: the probes' and shadow's (sunny)
//   whole   the level as the game has it, for the game world (lane G2: plans/
//           2026-10-10-bfg-laneG2-levels-whole.md): no spot, the map's frame
//           (origin 0, yaw 0), every sub-level but the lobby's, the outros'
//           and the other times of day, nothing buried left out, no horizon,
//           no budget fit, every cut; written to levels/<world>/game/<key>/
//           (key: the map's name, hoth_01) with a nav.bin and the frame check
//           (scripts/bf2017-level-nav.mjs). Published as one folder:
//           scripts/assets-publish.mjs --whole <world>/game/<key>
//   inside  an interior: no terrain, its bounds the pieces' extent, and where
//           the map has ground, only what is buried under it (Hoth's base)
//   subs    the sub-levels that are the arena (default: the level's own and Content)
//   drop    meshes left out, `<mesh>` or `<sub>:<mesh>` (`*` for any run): what the
//           site draws itself (a space level's corvettes, the battle's), the end
//           of round's room
//   share   the part of each tier's budget row the pack is fitted to (1): a
//           space level is drawn on the galaxy's flight page, beside the system
//           and the battle, so it takes a share
//   arena   the pack's half-size in metres; instances beyond it are the horizon
//   ultra   the LOD0 cut and 2048 textures as well
//   dry     the table only: fetches the map, terrain and manifest, writes nothing
//
// A level with no terrain record (the space levels) builds no ground layer:
// its pack is the instances alone, and its README says so.
//
// The keys as the fetch takes them (SUPABASE_URL, BF2017_KEY or SUPA_KEY),
// never printed. A map the bucket has not got yet is said so and exits 3:
// the uploader sends the maps in passes.

import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUDGET_ROWS } from '../src/lib/budgets.js';
import { LAYERS, imageLayerFrom } from '../src/lib/land/layers.js';
import { decodePng16 } from '../src/lib/level/png16.js';
import { fetchData, getObject, keys } from './bf2017-fetch.mjs';
import { spotFrom } from './lib/bf2017-level-spots.mjs';
import { mapRow } from './lib/bf2017-rulebook-map.mjs';
import { parseArgs } from './lib/args.mjs';
import { writeCredit } from './lib/catalog-write.mjs';
import { isSequel } from './lib/bf2017-manifest.mjs';
import { glbJson, imagePath, imageUris, inBucket } from './lib/bf2017-paths.mjs';
import { arenaOf, buildPack, cropHeights, emptyValue, fillEmpty, fillHoles, glbTriangles, heightsLayer, lodFile, mergeHeights, readMap, rewriteImageUris, terrainFrame } from './lib/bf2017-level.mjs';
import { LOD, capIndex, texSizeFor } from '../src/lib/level/lod.js';
import { ktx2Info, dropMips, mipsToFit } from './lib/ktx2-mips.mjs';
import { encodePng16 } from './lib/png16.mjs';
import { writeParts } from './bf2017-level-parts.mjs';
import { writeWholeNav } from './bf2017-level-nav.mjs';
import { LOW_K, WHOLE_ROWS, modeOnlyOf, wholeArena, wholeCull, wholeExtent, wholeSubs } from './lib/bf2017-level-whole.mjs';
import { main as writePhysics } from './bf2017-physics.mjs';

const USAGE = 'node scripts/bf2017-level.mjs <map> --world <id> (--spot <x> <z> | --spawn | --whole [--key <levelKey>]) [--district <id>] [--inside] [--subs a,b] [--drop m,sub:m] [--arena 1024] [--yaw 0] [--ultra] [--share 1 | low=0.5] [--parts] [--mode FantasyBattle] [--weather sunny] [--dry]';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'lab', 'assets', 'bf2017');
const PERMISSION = 'From EA DICE’s Star Wars Battlefront II (2017), used with permission on this non-commercial fan project; Star Wars and everything in it belong to Lucasfilm.';
const GAME = 'https://www.ea.com/games/starwars/battlefront/star-wars-battlefront-2';

// (what a fetch that worked says: anything else is not there yet, or the pool gave up)
const HAVE = new Set(['fetched', 'kept']);
const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;
const lastOf = (p) => p.split('/').pop();

async function need(env, path, what) {
  const r = await getObject(env, CACHE, path);
  if (!HAVE.has(r.state)) {
    console.error(`${path}: not in the bucket yet, or not fetched${r.error ? ` (${r.error})` : ''} (${what}). The uploader sends in passes: try again in ten minutes.`);
    process.exit(3);
  }
  return readFile(r.file);
}

// (eight at a time: the bucket answers in a few hundred milliseconds, and a
// level is a thousand files)
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

// The pack's two heightmaps in the site's frame: near at 1 m a pixel over the
// arena and 256 m round it (the detail map where it has ground, the world
// map under its holes and beyond it), far at 4 m over the whole world map;
// heights rebased so the spot's ground is 0
async function writeTerrain(env, record, { spot, groundY: givenY, arena, out, dry, whole = null }) {
  let groundY = givenY;
  const f = terrainFrame(record);
  const src = (await decodePng16(await need(env, inBucket(record.world.file), 'the world heightmap'))).data;
  // (a whole level: the near map over its pieces' extent, a square at 1 m a
  // pixel, 2 m past 3 km a side; its heights the game's own)
  const side = whole ? Math.max(whole.extent.max[0] - whole.extent.min[0], whole.extent.max[1] - whole.extent.min[1]) : 0;
  const square = whole
    ? { minX: whole.extent.min[0], minZ: whole.extent.min[1], size: side, metresPerPixel: side > 3072 ? 2 : 1 }
    : {
        minX: spot[0] - arena - 256,
        minZ: spot[1] - arena - 256,
        size: 2 * (arena + 256),
        metresPerPixel: 1,
      };
  // (a world map smaller than the world, Endor's: off it, its edge)
  const clamp = (record.world.sizeX ?? Infinity) < (record.worldSizeX ?? 0);
  const near = cropHeights(src, f, { ...square, clamp });
  let holeMask = null; // (the game's own holes in the near map, before they are filled)
  if (record.detail?.file) {
    const fd = terrainFrame(record, 'detail');
    const detail = (await decodePng16(await need(env, inBucket(record.detail.file), 'the detail heightmap'))).data;
    // (inside the detail map's bounds its holes are the game's own: filled
    // at the rim's lowest, so the hangar's mouth stays a way in)
    const inside = (i) => {
      const x = square.minX + (i % near.w) * square.metresPerPixel;
      const z = square.minZ + Math.floor(i / near.w) * square.metresPerPixel;
      return x >= fd.minX && z >= fd.minZ && x <= fd.minX + (fd.w - 1) * fd.metresPerPixel && z <= fd.minZ + (fd.h - 1) * fd.metresPerPixel;
    };
    const holes = mergeHeights(cropHeights(detail, { ...fd, hole: 0 }, square).data, near.data, 0, inside);
    holeMask = Uint8Array.from(holes, (v) => (v === 0 ? 1 : 0));
    near.data = fillHoles(holes, near.w, near.h);
  } else if (f.hole === 0) {
    // (a world map with holes of its own, Endor's bunker in its hill: the
    // same, each hole at its rim's lowest, so the way in stays open)
    holeMask = Uint8Array.from(near.data, (v) => (v === 0 ? 1 : 0));
    near.data = fillHoles(near.data, near.w, near.h);
  }
  // (ground the game never painted, Endor's outside its play area, takes its
  // nearest painted ground; the spot's ground read again from it)
  const empty = emptyValue(src);
  if (empty !== null) {
    near.data = fillEmpty(near.data, near.w, near.h, empty, { margin: 8 });
    const mid = Math.floor(near.h / 2) * near.w + Math.floor(near.w / 2);
    if (!whole) groundY = (near.data[mid] * f.scale) / 65536 + f.offset;
  }
  // (the far map at 4 m a pixel: the ground's grid out there is coarser still,
  // and a 2 m map of the whole 8 km is 16 million samples for every visitor)
  const FAR_MPP = 4;
  // (and a clamped map's far ground runs 2 km past it, so the horizon is not a cliff)
  const pad = clamp ? 2048 : 0;
  const far = cropHeights(src, f, { minX: f.minX - pad, minZ: f.minZ - pad, size: (f.w - 1) * f.metresPerPixel + 2 * pad, metresPerPixel: FAR_MPP, clamp });
  const nearPng = encodePng16(near.data, near.w, near.h);
  if (record.detail?.file === undefined && f.hole === 0) far.data = fillHoles(far.data, far.w, far.h);
  if (empty !== null) far.data = fillEmpty(far.data, far.w, far.h, empty, { margin: 2 });
  const farPng = encodePng16(far.data, far.w, far.h);
  if (!dry) {
    await mkdir(join(out, 'terrain'), { recursive: true });
    await writeFile(join(out, 'terrain', 'near.png'), nearPng);
    await writeFile(join(out, 'terrain', 'far.png'), farPng);
  }
  const json = {
    near: {
      png: 'terrain/near.png',
      metresPerPixel: square.metresPerPixel,
      min: [square.minX - spot[0], square.minZ - spot[1]],
      size: [near.w, near.h],
    },
    far: {
      png: 'terrain/far.png',
      metresPerPixel: FAR_MPP,
      min: [f.minX - pad - spot[0], f.minZ - pad - spot[1]],
      size: [far.w, far.h],
    },
    scale: f.scale,
    offset: f.offset - groundY,
    hole: f.hole ?? (record.detail?.holePixels > 0 ? 0 : null),
  };
  // (the ground as the site will read it, for what is under it)
  const layer = imageLayerFrom(
    { heightScale: json.scale, heightOffset: json.offset, holePixels: 0 },
    {
      ...near,
      minX: json.near.min[0],
      minZ: json.near.min[1],
      metresPerPixel: square.metresPerPixel,
    },
    { ...far, minX: json.far.min[0], minZ: json.far.min[1], metresPerPixel: FAR_MPP },
  );
  const holeAt = (x, z) => {
    const m = square.metresPerPixel;
    const i = Math.round((z - json.near.min[1]) / m) * near.w + Math.round((x - json.near.min[0]) / m);
    return Boolean(holeMask?.[i]) && Math.abs((x - json.near.min[0]) / m - near.w / 2) < near.w / 2 && Math.abs((z - json.near.min[1]) / m - near.h / 2) < near.h / 2;
  };
  return { json, layer, holeAt, groundY, bytes: { near: nearPng.length, far: farPng.length } };
}

// Each texture once, as the bucket encoded it, its mips dropped to each
// tier's size for the biggest thing that wears it (lod.js's texSizeFor):
// tex/<slug>.<size>.ktx2, one file a distinct size. The meshes name
// tex/<slug>.ktx2; level.json's `tex` says which size each tier takes.
async function writeTextures(env, uris, radiusOf, { out, tiers, dry }) {
  const slugs = new Map();
  const sizes = {}; // slug → { tier: size }
  const bytes = Object.fromEntries(tiers.map((t) => [t, 0]));
  const missing = [];
  const taken = new Set();
  for (const uri of uris) {
    let slug = lastOf(uri)
      .replace(/\.ktx2$/, '')
      .toLowerCase();
    if (taken.has(slug)) slug = `${slug}_${slugs.size}`;
    taken.add(slug);
    slugs.set(uri, slug);
  }
  await pool(uris, 8, async (uri) => {
    const slug = slugs.get(uri);
    const r = await getObject(env, CACHE, uri);
    if (!HAVE.has(r.state)) {
      missing.push(uri);
      return;
    }
    const buf = await readFile(r.file);
    const info = ktx2Info(buf);
    sizes[slug] = {};
    const written = new Map();
    for (const tier of tiers) {
      const size = Math.min(texSizeFor(radiusOf.get(uri) ?? 1, tier, /__(normal|orm)/.test(uri)), info.width);
      sizes[slug][tier] = size;
      if (!written.has(size)) {
        const k = dropMips(buf, Math.min(mipsToFit(info.width, size), info.levels - 1));
        written.set(size, k.length);
        if (!dry) {
          await mkdir(join(out, 'tex'), { recursive: true });
          await writeFile(join(out, 'tex', `${slug}.${size}.ktx2`), k);
        }
      }
      bytes[tier] += written.get(size);
    }
  });
  return { slugs, sizes, bytes, missing };
}

async function main(args) {
  const [mapName] = args._;
  const world = args.world;
  const district = typeof args.district === 'string' ? args.district : 'main';
  const inside = Boolean(args.inside);
  // (--whole: the level as the game has it, in the map's frame, lane G2)
  const whole = Boolean(args.whole);
  const levelKey = String(typeof args.key === 'string' ? args.key : lastOf(mapName ?? '')).toLowerCase();
  let spot = whole ? [0, 0] : [Number(args.spot), Number(args._[1])];
  if (!mapName || !world || (spot.some(Number.isNaN) && !args.spawn)) {
    console.error(`usage: ${USAGE}`);
    process.exit(1);
  }
  const env = keys();
  let arena = Number(args.arena ?? 1024);
  const yaw = Number(args.yaw ?? 0);
  // (a whole level ships every cut: the game world draws ultra on a desktop)
  const ultra = Boolean(args.ultra) || whole;
  // (--share: one part for every tier, 0.5, or each its own, low=0.5,mid=0.8)
  const share = /=/.test(String(args.share ?? ''))
    ? Object.fromEntries(
        String(args.share)
          .split(',')
          .filter(Boolean)
          .map((kv) => kv.split('='))
          .map(([t, k]) => [t, Number(k)]),
      )
    : args.share === undefined || Number(args.share) === 1
      ? {}
      : Object.fromEntries(Object.keys(BUDGET_ROWS).map((t) => [t, Number(args.share)]));
  if (Object.values(share).some((k) => !(k > 0 && k <= 1))) throw new Error('--share: a part of the row, over 0 and up to 1');
  // (each tier's row, its triangles and calls taken in its share)
  const rowsOf = (rows) => Object.fromEntries(Object.entries(rows).map(([t, r]) => [t, share[t] ? { ...r, tris: r.tris * share[t], calls: Math.floor(r.calls * share[t]) } : r]));
  const dry = Boolean(args.dry);
  let subs = typeof args.subs === 'string' ? args.subs.split(',') : null;
  const drop = typeof args.drop === 'string' ? args.drop.split(',') : [];
  // (a district's pack sits in its world's folder: levels/<world>/<district>/)
  // (a whole level's: levels/<world>/game/<levelKey>/)
  const packId = whole ? `${world}/game/${levelKey}` : district === 'main' ? world : `${world}/${district}`;
  const out = join(ROOT, 'public', 'models', 'galaxy', 'bf2017', 'levels', ...packId.split('/'));
  if (yaw) throw new Error('--yaw: the heightmaps are not turned yet; keep the level square to the site');

  // (the map's file by the bucket's index: a campaign map's is ds02_streamed, not its folder's name)
  const index = JSON.parse((await need(env, 'web/maps/index.json', 'the maps’ index')).toString('utf8'));
  const entry = (index.maps ?? index).find((m) => m.file.startsWith(`maps/${mapName}/`));
  const base = `web/maps/${mapName}/${entry ? lastOf(entry.file).replace(/\.json$/, '') : lastOf(mapName)}`;
  const mapJson = JSON.parse((await need(env, `${base}.json`, 'the map')).toString('utf8'));
  const map = readMap(mapJson, await need(env, `${base}.bin`, 'the map’s instances'));
  console.log(`${mapName}: ${map.instances.count} instances, ${map.meshes.length} meshes, subs ${map.subworlds.map(lastOf).join(', ')}`);
  console.log(`vehicle spawns: ${map.vehicleSpawns.map((v) => `${lastOf(v.blueprint ?? '?')} ${v.position?.map((n) => Math.round(n)).join(' ')}`).join(' · ') || 'none'}`);
  // (no spot given: the first team's first spawn area, from the map's own
  // gameplay records, scripts/lib/bf2017-rulebook-map.mjs)
  if (spot.some(Number.isNaN)) {
    const folder = String(map.name).split('/').slice(0, -1).join('/');
    await fetchData(env, CACHE, [`${folder}/*`]);
    const found = spotFrom(mapRow(CACHE, lastOf(mapName)));
    if (!found) throw new Error(`--spawn: ${mapName} has no team-one spawn in its gameplay records: pass --spot`);
    spot = found.spot.map((v) => Math.round(v * 100) / 100);
    console.log(`spot from ${found.from}: ${spot.join(' ')} (heading ${found.yaw.toFixed(2)})`);
  }

  // (a whole level: every sub-level but the lobby's, the outros' and the other times of day)
  const wholeOf = whole && !subs ? wholeSubs(map, { weather: args.weather ?? 'sunny' }) : null;
  if (wholeOf) {
    subs = wholeOf.subs;
    console.log(`whole: ${subs.join(', ')} (left out: ${wholeOf.skipped.join(', ') || 'none'})`);
  }

  // (--parts: the map's other parts beside a pack already built, its frame from its level.json)
  if (args.parts) {
    const json = JSON.parse(await readFile(join(out, 'level.json'), 'utf8'));
    const parts = await writeParts({ env, cache: CACHE, mapName, base, map, json, out, subs, mode: args.mode ?? 'FantasyBattle', weather: args.weather ?? 'sunny', dry, layers: whole });
    if (dry) return;
    json.shadowCache = parts.shadowCache;
    await writeFile(join(out, 'level.json'), `${JSON.stringify(json)}\n`);
    const readme = await readFile(join(out, 'README.md'), 'utf8').catch(() => '');
    const head = readme.split("## The map's other parts")[0].replace(/\n*$/, '\n\n');
    await writeFile(join(out, 'README.md'), `${head}${parts.lines.join('\n')}`);
    // (the game's shapes, and the props' collision hulls: lane P0's script)
    await writePhysics([out]);
    console.log(`wrote the parts beside ${relative(ROOT, out)}`);
    return;
  }

  const record = map.terrain;
  if (!record) console.log('no terrain: the ground stays the site’s');
  const ground = record ? await heightsLayer(record, await need(env, inBucket(record.world.file), 'the world heightmap')) : null;
  const detail = record?.detail?.file ? await heightsLayer(record, await need(env, inBucket(record.detail.file), 'the detail heightmap'), 'detail') : null;
  // (a whole level's ground is the game's own heights: nothing rebased)
  let groundY = whole ? 0 : detail && LAYERS.image(spot[0], spot[1], detail) ? LAYERS.image(spot[0], spot[1], detail) : ground ? LAYERS.image(spot[0], spot[1], ground) : 0;

  // the meshes: each one's LOD chain (the model manifest's, else counted
  // from its GLBs), its four cuts and their triangles
  const byFile = new Map();
  for (const line of (await need(env, 'web/models.jsonl', 'the model manifest')).toString('utf8').split('\n')) {
    if (!line.trim()) continue;
    const e = JSON.parse(line);
    byFile.set(e.file, e);
  }
  const files = new Map(); // bucket path → Buffer (the GLBs this pack ships, fetched once)
  const getGlb = async (file) => {
    const path = inBucket(file);
    if (!files.has(path)) {
      const r = await getObject(env, CACHE, path);
      files.set(path, !HAVE.has(r.state) ? null : await readFile(r.file));
    }
    return files.get(path);
  };
  const slugs = new Set();
  const NONE = { lods: [0], files: [] };
  const meshes = await pool(map.meshes, 8, async (m) => {
    const base = { name: m.file, bounds: [...m.min, ...m.max], mats: 1 };
    if (isSequel(m.file)) return { ...base, ...NONE, missing: 'sequel' };
    const entry = byFile.get(m.file);
    let chain = entry ? [...entry.lods].sort((x, y) => x.lod - y.lod).map((l) => ({ n: l.lod, file: l.file, tris: l.triangles })) : null;
    if (!chain) {
      chain = [];
      for (let n = 0; n < (m.lods ?? 1); n++) {
        const buf = await getGlb(lodFile(m.file, n));
        if (buf)
          chain.push({
            n,
            file: lodFile(m.file, n),
            tris: glbTriangles(buf).tris,
          });
      }
    }
    if (!chain.length) return { ...base, ...NONE, missing: 'not in the bucket' };
    return {
      ...base,
      lods: chain.map((l) => l.tris),
      files: chain.map((l) => l.file),
      mats: entry?.sections ?? 1,
    };
  });
  // (the LODs below the high tier's cap are drawn on ultra only: shipped with --ultra)
  meshes.forEach((m) => {
    let slug = lastOf(m.name)
      .replace(/\.glb$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_');
    if (slugs.has(slug)) slug = `${slug}_${slugs.size}`;
    slugs.add(slug);
    const from = ultra ? 0 : capIndex(m.lods, LOD.high.cap);
    m.glb = m.lods.map((_, n) => (m.missing || n < from ? null : `meshes/${slug}.lod${n}.glb`));
  });
  const absent = meshes.filter((m) => m.missing);
  if (absent.length)
    console.log(
      `${absent.length} meshes left out: ${absent
        .slice(0, 5)
        .map((m) => `${lastOf(m.name)} (${m.missing})`)
        .join(', ')}${absent.length > 5 ? ' …' : ''}`,
    );

  // (a whole level: its arena round the map's 0, every piece inside it; its extent the pieces' middle mass)
  let wholePack = null;
  if (whole) {
    const idx = arenaOf(map, { subs, drop }).filter((i) => !meshes[map.meshOf[i]].missing);
    arena = wholeArena(map, idx);
    const tiers = Object.keys(ultra ? BUDGET_ROWS : { low: 1, mid: 1, high: 1 });
    wholePack = { extent: wholeExtent(map, idx), cull: wholeCull(tiers), modeOnly: modeOnlyOf(map, subs), weather: wholeOf?.weather ?? null };
    console.log(`whole: arena ±${arena} m, extent ${wholePack.extent.min.join(' ')} to ${wholePack.extent.max.join(' ')}, mode layers ${Object.keys(wholePack.modeOnly).join(', ') || 'none'}`);
  }
  // (an interior writes no ground of its own, but reads it: what is under it is the interior)
  const terrain = record ? await writeTerrain(env, record, { spot, groundY, arena, out, dry: dry || inside, whole: wholePack }) : null;
  if (terrain && !whole) groundY = terrain.groundY;
  const pack = buildPack({
    world: packId,
    inside,
    mapName,
    map,
    spot,
    groundY,
    meshes: meshes.map(({ name, glb, lods, bounds, mats, missing }) => ({
      name,
      glb,
      lods,
      bounds,
      mats,
      missing: Boolean(missing),
    })),
    arena,
    // (--share: the part of a tier's row the level may take, where the site's
    // own things already spend the rest: Endor's low=0.5, a space level's 0.5)
    rows: whole ? Object.fromEntries(Object.keys(wholePack.cull).map((t) => [t, WHOLE_ROWS[t]])) : rowsOf(ultra ? BUDGET_ROWS : { low: BUDGET_ROWS.low, mid: BUDGET_ROWS.mid, high: BUDGET_ROWS.high }),
    subs,
    drop,
    whole: wholePack,
    terrain: terrain?.json ?? null,
    groundAt: terrain ? (x, z) => LAYERS.image(x, z, terrain.layer) : null,
    holeAt: terrain?.holeAt ?? null,
  });
  // (only the meshes the pack still holds, on some tier, ship)
  const used = new Set([...pack.json.far.draws, ...(pack.json.horizon?.draws ?? [])].map((d) => d.mesh));
  const tiersOf = Object.keys(pack.json.cull);
  for (const [m, mesh] of pack.json.meshes.entries()) if (!used.has(m) || tiersOf.every((t) => pack.json.cull[t].dropped.includes(m))) mesh.glb = mesh.glb.map(() => null);
  meshes.forEach((m, i) => (m.glb = pack.json.meshes[i].glb));

  // the GLBs: each LOD once, its images pointing at the pack's textures
  let glbBytes = 0;
  const uris = new Set();
  const texRadius = new Map(); // uri → the biggest radius among what wears it
  const glbs = [];
  if (!dry) {
    const radiusOf = (m) => Math.hypot(m.bounds[3] - m.bounds[0], m.bounds[4] - m.bounds[1], m.bounds[5] - m.bounds[2]) / 2;
    const wantGlb = meshes.flatMap((m) => m.glb.map((path, n) => path && { path, file: m.files[n], r: radiusOf(m) }).filter(Boolean));
    await pool(wantGlb, 8, async (g) => {
      const buf = await getGlb(g.file);
      if (!buf) return console.log(`${g.file}: missing`);
      for (const u of imageUris(buf, inBucket(g.file))) {
        uris.add(u);
        texRadius.set(u, Math.max(texRadius.get(u) ?? 0, g.r));
      }
      glbs.push({ ...g, buf, from: inBucket(g.file) });
    });
  }
  const tiers = ultra ? ['low', 'mid', 'high', 'ultra'] : ['low', 'mid', 'high'];
  const tex = dry ? { slugs: new Map(), sizes: {}, bytes: {}, missing: [] } : await writeTextures(env, [...uris], texRadius, { out, tiers, dry });
  Object.assign(
    pack.json.tex,
    Object.fromEntries(
      Object.keys(tex.sizes)
        .sort()
        .map((k) => [k, tex.sizes[k]]),
    ),
  );
  if (!dry) {
    await rm(join(out, 'meshes'), { recursive: true, force: true });
    await mkdir(join(out, 'meshes'), { recursive: true });
    for (const g of glbs) {
      const fixed = rewriteImageUris(g.buf, (uri) => {
        const abs = imagePath(uri, g.from);
        return `../tex/${tex.slugs.get(abs) ?? lastOf(abs).replace(/\.ktx2$/, '')}.ktx2`;
      });
      glbBytes += fixed.length;
      await writeFile(join(out, g.path), fixed);
      glbJson(fixed); // (a GLB that does not parse back is a bug here, not a file to ship)
    }
  }

  // the table
  const rows = [];
  rows.push(
    `| | ${Object.keys(pack.table).join(' | ')} |`,
    `|---|${Object.keys(pack.table)
      .map(() => '---')
      .join('|')}|`,
  );
  const by = (fn) => Object.values(pack.table).map(fn).join(' | ');
  const k = (n) => `${(n / 1000).toFixed(0)}k`;
  rows.push(`| drawn out to (radii: a 1 m thing, a 20 m one) | ${by((t) => `${t.K} (${t.K} m, ${t.K * 20} m)`)} |`);
  rows.push(`| meshes dropped (instances) | ${by((t) => `${t.dropped.length} (${t.dropped.reduce((a, d) => a + d.count, 0)})`)} |`);
  rows.push(`| worst place: triangles, calls | ${by((t) => `${k(t.worst.tris)}, ${t.worst.calls}`)} |`);
  rows.push(
    `| texture bytes (every map the level has) | ${Object.keys(pack.table)
      .map((t) => mb(tex.bytes[t] ?? 0))
      .join(' | ')} |`,
  );
  const farBytes = pack.files.get('far.bin').byteLength;
  const lines = [
    `# ${packId}: the game's level`,
    '',
    `From \`${mapName}\` (Star Wars Battlefront II, 2017, EA DICE; ${PERMISSION.split(';')[0].replace('From EA DICE’s Star Wars Battlefront II (2017), ', '')}). Written by \`node scripts/bf2017-level.mjs ${process.argv.slice(2).join(' ')}\`; do not edit by hand.`,
    '',
    `- ${pack.counts.arena} instances in the arena (±${arena} m), ${pack.counts.horizon} beyond it (the horizon), ${!record ? 'no terrain: no ground layer, the instances alone' : `${pack.counts.buried} ${inside ? 'left out above the ground (the world outside: its own pack)' : 'left out under the ground (an interior: its own pack, `--inside`)'}`}, ${pack.counts.cells} cells of ${pack.json.cell} m`,
    ...(whole ? [`- whole: yes (the map's frame: origin 0, yaw 0; nothing fitted, low to ${LOW_K} radii; sub-levels ${subs.join(', ')}; left out ${wholeOf?.skipped.join(', ') || 'none'}; the mode layers' own meshes: ${Object.entries(wholePack.modeOnly).map(([k, v]) => `${k} ${v.length}`).join(', ') || 'none'})`] : []),
    ...(drop.length ? [`- left out: ${drop.join(', ')}`] : []),
    ...(Object.keys(share).length ? [`- fitted to ${Object.entries(share).map(([t, k]) => `${t} ${k}`).join(', ')} of the tier's triangles and calls`] : []),
    `- ${meshes.length} meshes (${absent.length} left out), ${glbs.length} LOD files, ${mb(glbBytes)}`,
    `- the far list ${mb(farBytes)}; terrain ${terrain ? `near ${mb(terrain.bytes.near)}, far ${mb(terrain.bytes.far)}` : 'none'}; the spot's ground ${groundY.toFixed(2)} m in the game`,
    `- textures missing from the bucket: ${tex.missing.length}`,
    '',
    ...rows,
    '',
    ...Object.entries(pack.table).flatMap(([t, v]) => (v.dropped.length ? [`Dropped on ${t}: ${v.dropped.map((d) => `${lastOf(d.name).replace(/_mesh\.glb$/, '')} ×${d.count}`).join(', ')}`, ''] : [])),
  ];
  console.log(lines.join('\n'));
  if (dry) return;

  const parts = await writeParts({ env, cache: CACHE, mapName, base, map, json: pack.json, out, subs, mode: args.mode ?? 'FantasyBattle', weather: args.weather ?? 'sunny', layers: whole });
  pack.json.shadowCache = parts.shadowCache;
  lines.push(...parts.lines);
  await mkdir(join(out, 'cells'), { recursive: true });
  for (const [path, bin] of pack.files) await writeFile(join(out, path), Buffer.from(bin));
  await writeFile(join(out, 'level.json'), `${JSON.stringify(pack.json)}\n`);
  await writeFile(join(out, 'README.md'), `${lines.join('\n')}\n`);
  await writeCredit(join(ROOT, 'src', 'data', 'modelCredits.json'), `level-${packId.replaceAll('/', '-')}`, {
    title: `Star Wars Battlefront II (2017): ${mapName}${whole ? ' (whole)' : district === 'main' ? '' : ` (${district})`}`,
    author: 'EA DICE',
    authorUrl: GAME,
    license: 'permission',
    licenseUrl: GAME,
    source: GAME,
    // (a space level's is drawn in the galaxy's flight, not on a surface)
    where: record || inside ? 'galaxy-surface' : 'galaxy',
    as: `${packId}: the game's level`,
    file: `/models/galaxy/bf2017/levels/${packId}/level.json`,
    also: record || inside ? ['galaxy'] : [],
    permission: PERMISSION,
  });
  await writePhysics([out]);
  // (a whole level: its navgrid and the frame check, lane G2)
  if (whole) await writeWholeNav({ out, cache: CACHE, mapName, layer: terrain?.layer ?? null, extent: wholePack.extent });
  console.log(`wrote ${relative(ROOT, out)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!existsSync(CACHE)) await mkdir(CACHE, { recursive: true });
  await main(parseArgs(process.argv.slice(2))).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}

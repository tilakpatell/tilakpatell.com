// A level pack from the Battlefront II (2017) drop (lane L: docs/superpowers/
// plans/2026-10-10-bf2017-phaseL-levels.md, task 2): the game's map, its
// terrain and its meshes, cut for the site and written under
// public/models/galaxy/bf2017/levels/<world>/, which scripts/assets-upload.mjs
// mirrors to the bucket. The work is in scripts/lib/bf2017-level.mjs (pure,
// tested); this fetches, reads and writes.
//
//   node scripts/bf2017-level.mjs <map> --world <id> --spot <x> <z> [--subs a,b] [--drop m,sub:m] [--share 1] [--arena 1024] [--yaw 0] [--ultra] [--dry]
//
//   map     the map's folder under web/maps/ (levels/mp/hoth_01)
//   world   the site's world (hoth): the pack's folder and its credit
//   spot    the game's x and z that become the site's 0, 0 (the landing spot)
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
import { getObject, keys } from './bf2017-fetch.mjs';
import { parseArgs } from './lib/args.mjs';
import { writeCredit } from './lib/catalog-write.mjs';
import { isSequel } from './lib/bf2017-manifest.mjs';
import { glbJson, imagePath, imageUris, inBucket } from './lib/bf2017-paths.mjs';
import { buildPack, cropHeights, fillHoles, glbTriangles, heightsLayer, lodFile, mergeHeights, readMap, rewriteImageUris, terrainFrame } from './lib/bf2017-level.mjs';
import { LOD, capIndex, texSizeFor } from '../src/lib/level/lod.js';
import { ktx2Info, dropMips, mipsToFit } from './lib/ktx2-mips.mjs';
import { loadGameWord, wantedTransfer, withTransfer } from './lib/ktx2-colour.mjs';
import { encodePng16 } from './lib/png16.mjs';

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
async function writeTerrain(env, record, { spot, groundY, arena, out, dry }) {
  const f = terrainFrame(record);
  const src = (await decodePng16(await need(env, inBucket(record.world.file), 'the world heightmap'))).data;
  const square = {
    minX: spot[0] - arena - 256,
    minZ: spot[1] - arena - 256,
    size: 2 * (arena + 256),
    metresPerPixel: 1,
  };
  const near = cropHeights(src, f, square);
  let holeMask = null; // (the game's own holes in the near map, before they are filled)
  if (record.detail?.file) {
    const fd = terrainFrame(record, 'detail');
    const detail = (await decodePng16(await need(env, inBucket(record.detail.file), 'the detail heightmap'))).data;
    // (inside the detail map's bounds its holes are the game's own: filled
    // at the rim's lowest, so the hangar's mouth stays a way in)
    const inside = (i) => {
      const x = square.minX + (i % near.w);
      const z = square.minZ + Math.floor(i / near.w);
      return x >= fd.minX && z >= fd.minZ && x <= fd.minX + (fd.w - 1) * fd.metresPerPixel && z <= fd.minZ + (fd.h - 1) * fd.metresPerPixel;
    };
    const holes = mergeHeights(cropHeights(detail, { ...fd, hole: 0 }, square).data, near.data, 0, inside);
    holeMask = Uint8Array.from(holes, (v) => (v === 0 ? 1 : 0));
    near.data = fillHoles(holes, near.w, near.h);
  }
  // (the far map at 4 m a pixel: the ground's grid out there is coarser still,
  // and a 2 m map of the whole 8 km is 16 million samples for every visitor)
  const FAR_MPP = 4;
  const far = cropHeights(src, f, { minX: f.minX, minZ: f.minZ, size: (f.w - 1) * f.metresPerPixel, metresPerPixel: FAR_MPP });
  const nearPng = encodePng16(near.data, near.w, near.h);
  const farPng = encodePng16(far.data, far.w, far.h);
  if (!dry) {
    await mkdir(join(out, 'terrain'), { recursive: true });
    await writeFile(join(out, 'terrain', 'near.png'), nearPng);
    await writeFile(join(out, 'terrain', 'far.png'), farPng);
  }
  const json = {
    near: {
      png: 'terrain/near.png',
      metresPerPixel: 1,
      min: [-arena - 256, -arena - 256],
      size: [near.w, near.h],
    },
    far: {
      png: 'terrain/far.png',
      metresPerPixel: FAR_MPP,
      min: [f.minX - spot[0], f.minZ - spot[1]],
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
      metresPerPixel: 1,
    },
    { ...far, minX: json.far.min[0], minZ: json.far.min[1], metresPerPixel: FAR_MPP },
  );
  const holeAt = (x, z) => {
    const i = Math.round(z - json.near.min[1]) * near.w + Math.round(x - json.near.min[0]);
    return Boolean(holeMask?.[i]) && Math.abs(x - json.near.min[0] - near.w / 2) < near.w / 2 && Math.abs(z - json.near.min[1] - near.h / 2) < near.h / 2;
  };
  return { json, layer, holeAt, bytes: { near: nearPng.length, far: farPng.length } };
}

// Each texture once, as the bucket encoded it, its mips dropped to each
// tier's size for the biggest thing that wears it (lod.js's texSizeFor):
// tex/<slug>.<size>.ktx2, one file a distinct size. The meshes name
// tex/<slug>.ktx2; level.json's `tex` says which size each tier takes.
async function writeTextures(env, uris, radiusOf, { out, tiers, dry }) {
  // (the game's own word on each map's colour space, textures.jsonl's srgb
  // flag, when it has been fetched; the suffix rule otherwise)
  const word = loadGameWord(CACHE);
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
        // (and told what it is: the game's word, else a colour map sRGB and a
        // data map linear by suffix, whatever the encode wrote; the row says
        // it too, for the loader: ktx2-colour.mjs)
        const want = wantedTransfer(uri, { word });
        if (want) sizes[slug].srgb = want === 'srgb';
        const k = withTransfer(dropMips(buf, Math.min(mipsToFit(info.width, size), info.levels - 1)), want ?? 'linear');
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
  const spot = [Number(args.spot), Number(args._[1])];
  if (!mapName || !world || spot.some(Number.isNaN)) {
    console.error('usage: node scripts/bf2017-level.mjs <map> --world <id> --spot <x> <z> [--subs a,b] [--arena 1024] [--yaw 0] [--ultra] [--dry]');
    process.exit(1);
  }
  const env = keys();
  const arena = Number(args.arena ?? 1024);
  const yaw = Number(args.yaw ?? 0);
  const ultra = Boolean(args.ultra);
  const dry = Boolean(args.dry);
  const subs = typeof args.subs === 'string' ? args.subs.split(',') : null;
  const drop = typeof args.drop === 'string' ? args.drop.split(',') : [];
  const share = Number(args.share ?? 1);
  if (!(share > 0 && share <= 1)) throw new Error('--share: a part of the row, over 0 and up to 1');
  // (each tier's row, its triangles and calls taken in the share)
  const rowsOf = (rows) => Object.fromEntries(Object.entries(rows).map(([t, r]) => [t, share === 1 ? r : { ...r, tris: r.tris * share, calls: Math.floor(r.calls * share) }]));
  const out = join(ROOT, 'public', 'models', 'galaxy', 'bf2017', 'levels', world);
  if (yaw) throw new Error('--yaw: the heightmaps are not turned yet; keep the level square to the site');

  const base = `web/maps/${mapName}/${lastOf(mapName)}`;
  const map = readMap(JSON.parse((await need(env, `${base}.json`, 'the map')).toString('utf8')), await need(env, `${base}.bin`, 'the map’s instances'));
  console.log(`${mapName}: ${map.instances.count} instances, ${map.meshes.length} meshes, subs ${map.subworlds.map(lastOf).join(', ')}`);
  console.log(`vehicle spawns: ${map.vehicleSpawns.map((v) => `${lastOf(v.blueprint ?? '?')} ${v.position?.map((n) => Math.round(n)).join(' ')}`).join(' · ') || 'none'}`);

  const record = map.terrain;
  if (!record) console.log('no terrain: the ground stays the site’s');
  const ground = record ? await heightsLayer(record, await need(env, inBucket(record.world.file), 'the world heightmap')) : null;
  const detail = record?.detail?.file ? await heightsLayer(record, await need(env, inBucket(record.detail.file), 'the detail heightmap'), 'detail') : null;
  const groundY = detail && LAYERS.image(spot[0], spot[1], detail) ? LAYERS.image(spot[0], spot[1], detail) : ground ? LAYERS.image(spot[0], spot[1], ground) : 0;

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

  const terrain = record ? await writeTerrain(env, record, { spot, groundY, arena, out, dry }) : null;
  const pack = buildPack({
    world,
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
    rows: rowsOf(ultra ? BUDGET_ROWS : { low: BUDGET_ROWS.low, mid: BUDGET_ROWS.mid, high: BUDGET_ROWS.high }),
    subs,
    drop,
    terrain: terrain?.json ?? null,
    groundAt: terrain ? (x, z) => LAYERS.image(x, z, terrain.layer) : null,
    holeAt: terrain?.holeAt ?? null,
  });
  // (only the meshes the pack still holds, on some tier, ship)
  const used = new Set([...pack.json.far.draws, ...pack.json.horizon.draws].map((d) => d.mesh));
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
    `# ${world}: the game's level`,
    '',
    `From \`${mapName}\` (Star Wars Battlefront II, 2017, EA DICE; ${PERMISSION.split(';')[0].replace('From EA DICE’s Star Wars Battlefront II (2017), ', '')}). Written by \`node scripts/bf2017-level.mjs ${process.argv.slice(2).join(' ')}\`; do not edit by hand.`,
    '',
    `- ${pack.counts.arena} instances in the arena (±${arena} m), ${pack.counts.horizon} beyond it (the horizon), ${record ? `${pack.counts.buried} left out under the ground` : 'no terrain: no ground layer, the instances alone'}, ${pack.counts.cells} cells of ${pack.json.cell} m`,
    ...(drop.length ? [`- left out: ${drop.join(', ')}`] : []),
    ...(share !== 1 ? [`- fitted to ${share} of each tier's triangles and calls (drawn beside the galaxy's flight page)`] : []),
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

  await mkdir(join(out, 'cells'), { recursive: true });
  for (const [path, bin] of pack.files) await writeFile(join(out, path), Buffer.from(bin));
  await writeFile(join(out, 'level.json'), `${JSON.stringify(pack.json)}\n`);
  await writeFile(join(out, 'README.md'), `${lines.join('\n')}\n`);
  await writeCredit(join(ROOT, 'src', 'data', 'modelCredits.json'), `level-${world}`, {
    title: `Star Wars Battlefront II (2017): ${mapName}`,
    author: 'EA DICE',
    authorUrl: GAME,
    license: 'permission',
    licenseUrl: GAME,
    source: GAME,
    // (a space level's is drawn in the galaxy's flight, not on a surface)
    where: record ? 'galaxy-surface' : 'galaxy',
    as: `${world}: the game's level`,
    file: `/models/galaxy/bf2017/levels/${world}/level.json`,
    also: record ? ['galaxy'] : [],
    permission: PERMISSION,
  });
  console.log(`wrote ${relative(ROOT, out)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!existsSync(CACHE)) await mkdir(CACHE, { recursive: true });
  await main(parseArgs(process.argv.slice(2))).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}

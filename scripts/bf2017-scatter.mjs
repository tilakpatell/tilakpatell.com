// A level pack's terrain scatter (fidelity lane N: docs/superpowers/specs/
// 2026-10-10-battlefront-fidelity-design.md, "Lane N"; plan laneN-scatter):
// the game's scatter table for the pack's terrain, its types per layer, and
// where each layer grows, derived (scripts/lib/bf2017-scatter.mjs), written
// beside the pack as scatter.json, scatter/layers.png (a 16-bit grey PNG at
// 2 m a texel: a layer's index + 1, 0 where nothing grows) and the types'
// meshes under scatter/ with their maps in tex/ (sizes in scatter.json's
// `tex`, as level.json's are).
//
//   NODE_USE_ENV_PROXY=1 node scripts/bf2017-scatter.mjs <world> [<world> …] [--ref <git ref>] [--dry] [--picture <dir>]
//
// --picture writes <dir>/<world>-mask.png (each layer a colour over the
// ground's shade) and <world>-inputs.png (red the slope, green the canopy,
// blue the play area; grey the ground the game never painted)
//
// The table: the pack's own scatter.json where lane E0's level script wrote
// the bucket's table there, else the bucket's `web/maps/terrain_scatter/`.
// A pack whose level.json is not in this checkout (a world built on a branch
// not yet merged) is read from `--ref`'s tree, its published files (the
// heightmap, the far list) from the site-assets bucket by that tree's
// src/data/galaxyAssets.json.
//
// The keys: as scripts/bf2017-fetch.mjs reads them (SUPABASE_URL, and
// BF2017_KEY or SUPA_KEY), never printed.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeHeights } from '../src/lib/land/layers.js';
import { readInstances } from '../src/lib/level/instances.js';
import { texSizeFor } from '../src/lib/level/lod.js';
import { decodePng16 } from '../src/lib/level/png16.js';
import { densityOf, fieldOf, slopeOf } from '../src/lib/three/ground/masks.js';
import { getObject, keys } from './bf2017-fetch.mjs';
import { parseArgs } from './lib/args.mjs';
import { glbJson, inBucket } from './lib/bf2017-paths.mjs';
import { lodFile } from './lib/bf2017-level.mjs';
import { readTextureIndex } from './lib/bf2017-ground.mjs';
import { CANOPY, CARD, PLAY, RULES, bindMaps, claimOf, footprintOf, kindOf, lookOf, mapsOf, paintedOf, scatterJson, surfaceOf, typesOf } from './lib/bf2017-scatter.mjs';
import { dropMips, ktx2Info, mipsToFit } from './lib/ktx2-mips.mjs';
import { encodePng16 } from './lib/png16.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'lab', 'assets', 'bf2017');
const HAVE = new Set(['fetched', 'kept']);
// metres a texel of scatter/layers.png: a layer's edge within 2 m, as Q2's masks
const MASK_M = 2;
// the LODs a type ships: its first two (the game's scatter swaps to LOD1 at
// its Lod0DissolveOut; the site's scatter draws no farther than the mid band)
const SHIP_LODS = 2;
const lastOf = (p) => String(p).split('/').pop();
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
// the placed pieces that make a canopy (the game's forest trees, not their stumps)
const TREE = /tree(?!.*stump)/i;
// placed pieces that stand over no ground of their own: the backdrop's
// rocks, trees and clouds far off, shadow-only and decal meshes, water
// films; and anything over BIG_M m across (a backdrop's hills, a dish)
const NO_FOOTPRINT = /backdrop|cloud|shadowmesh|decal|algae|water/i;
const BIG_M = 80;
const TRUNK = 0.25;

async function bucket(env, path) {
  const r = await getObject(env, CACHE, path);
  return HAVE.has(r.state) ? readFile(r.file) : null;
}

// a pack's file: on disk, else (with --ref) its level.json from that tree and
// its published bytes from site-assets
function packFiles(world, ref) {
  const dir = join(ROOT, 'public/models/galaxy/bf2017/levels', world);
  const site = `models/galaxy/bf2017/levels/${world}`;
  let manifest = null;
  const fromRef = (path) => execFileSync('git', ['show', `${ref}:${path}`], { cwd: ROOT, maxBuffer: 1 << 28 });
  return {
    dir,
    async get(path) {
      const local = join(dir, path);
      if (existsSync(local)) return readFile(local);
      if (!ref) return null;
      if (path === 'level.json' || path === 'README.md') return fromRef(`public/${site}/${path}`);
      manifest ??= JSON.parse(fromRef('src/data/galaxyAssets.json').toString('utf8'));
      const e = manifest[`${site}/${path}`];
      if (!e) return null;
      const url = `${process.env.SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/site-assets/${e.hash}/${site}/${path}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return Buffer.from(await res.arrayBuffer());
    },
  };
}

// the bucket's table for the pack's map: the index's terrain under the map's folder
async function tableOf(env, pack, files) {
  const own = await files.get('scatter.json');
  if (own) {
    const t = JSON.parse(own.toString('utf8'));
    if (Array.isArray(t.layers) && t.layers.every((l) => Array.isArray(l.scatter))) return { table: t, from: 'the pack’s scatter.json (lane E0)' };
  }
  const index = JSON.parse((await bucket(env, 'web/maps/terrain_scatter/index.json')).toString('utf8'));
  const map = pack.map.toLowerCase();
  const hit = index.terrains.find((t) => t.terrain.toLowerCase().startsWith(`${map}/`));
  if (!hit) return { table: null, from: `no terrain under ${pack.map} in the index` };
  const buf = await bucket(env, inBucket(hit.file));
  return { table: buf && JSON.parse(buf.toString('utf8')), from: hit.file };
}

// the pack's placed pieces from its far list: where they stand, how they turn,
// their footprint and top, and whether they make the canopy
function piecesOf(pack, far) {
  const inst = readInstances(new Uint8Array(far));
  const out = [];
  for (const d of pack.far.draws) {
    const m = pack.meshes[d.mesh];
    const b = m.bounds;
    for (let k = 0; k < d.count; k++) {
      const i = d.offset + k;
      const tree = TREE.test(lastOf(m.name));
      const [qx, qy, qz, qw] = [0, 1, 2, 3].map((c) => inst.quaternion[i * 4 + c]);
      const sx = Math.abs(inst.scale[i * 3]);
      const sy = Math.abs(inst.scale[i * 3 + 1]);
      const sz = Math.abs(inst.scale[i * 3 + 2]);
      // (the angle of the piece's x axis in the ground's plane; a tilted
      // piece's box is near enough)
      const yaw = Math.atan2(2 * (qx * qz - qw * qy), 1 - 2 * (qy * qy + qz * qz));
      const cx = ((b[0] + b[3]) / 2) * sx;
      const cz = ((b[2] + b[5]) / 2) * sz;
      out.push({
        x: inst.position[i * 3] + cx * Math.cos(yaw) - cz * Math.sin(yaw),
        z: inst.position[i * 3 + 2] + cx * Math.sin(yaw) + cz * Math.cos(yaw),
        yaw,
        // (a tree covers the ground at its trunk, a quarter of its spread)
        half: [((b[3] - b[0]) / 2) * sx * (tree ? TRUNK : 1), ((b[5] - b[2]) / 2) * sz * (tree ? TRUNK : 1)],
        top: inst.position[i * 3 + 1] + b[4] * sy,
        tree,
        // (a tree's crown is the canopy, not a roof: only its trunk covers the ground)
        crown: tree && /_top|crown|canopy/i.test(lastOf(m.name)),
        skip: NO_FOOTPRINT.test(lastOf(m.name)),
      });
    }
  }
  return out;
}

// a mesh's LOD files (the model manifest's chain) and its maps (found by its
// folder in textures.jsonl, as the bucket encoded them), into the pack
async function shipMeshes(env, types, files, { dry }) {
  const byFile = new Map();
  for (const line of (await bucket(env, 'web/models.jsonl')).toString('utf8').split('\n')) {
    if (!line.trim()) continue;
    const e = JSON.parse(line);
    byFile.set(e.file, e);
  }
  const index = readTextureIndex((await bucket(env, 'web/textures.jsonl')).toString('utf8'));
  const meshes = {};
  const tex = {};
  const missingMaps = new Set();
  let bytes = 0;
  let count = 0;
  const slugOf = (u) => lastOf(u).replace(/\.ktx2$/, '').toLowerCase();
  // one map into tex/ at each tier's size; its slug, or null where the bucket lacks it
  const shipMap = async (path, radius) => {
    const slug = slugOf(path);
    if (tex[slug]) return slug;
    const buf = await bucket(env, inBucket(path));
    if (!buf) {
      missingMaps.add(path);
      return null;
    }
    const info = ktx2Info(buf);
    tex[slug] = {};
    for (const tier of ['low', 'mid', 'high', 'ultra']) {
      const size = Math.min(texSizeFor(radius, tier, /__normal/.test(path)), info.width);
      tex[slug][tier] = size;
      const out = `tex/${slug}.${size}.ktx2`;
      if (!dry && !existsSync(join(files.dir, out))) {
        await mkdir(join(files.dir, 'tex'), { recursive: true });
        const k = dropMips(buf, Math.min(mipsToFit(info.width, size), info.levels - 1));
        await writeFile(join(files.dir, out), k);
        bytes += k.length;
      }
    }
    return slug;
  };
  if (!dry) await mkdir(join(files.dir, 'scatter'), { recursive: true });
  for (const t of types) {
    if (meshes[t.mesh] !== undefined) continue;
    const entry = byFile.get(t.file);
    const chain = entry ? [...entry.lods].sort((a, b) => a.lod - b.lod).slice(0, SHIP_LODS) : [{ lod: 0, file: t.file, triangles: null }];
    const slug = lastOf(t.file).replace(/\.glb$/, '').toLowerCase();
    const r = entry ? Math.hypot(...entry.max.map((v, k) => v - entry.min[k])) / 2 : 1;
    const want = mapsOf(t.file, index);
    const radius = r * Math.max(...t.scale.max);
    const color = want.color ? await shipMap(want.color, radius) : null;
    const normal = want.normal ? await shipMap(want.normal, radius) : null;
    const look = lookOf(t.mesh, { color });
    const got = [];
    for (const l of look.look === 'waits' ? [] : chain) {
      const buf = await bucket(env, inBucket(l.file ?? lodFile(t.file, l.lod)));
      if (!buf) continue;
      const fixed = bindMaps(buf, { color: color && `../tex/${color}.ktx2`, normal: normal && `../tex/${normal}.ktx2`, card: CARD.test(lastOf(t.mesh)) });
      glbJson(fixed); // (a GLB that does not parse back is a bug here, not a file to ship)
      const path = `scatter/${slug}.lod${l.lod}.glb`;
      if (!dry) await writeFile(join(files.dir, path), fixed);
      bytes += fixed.length;
      count++;
      got.push({ glb: path, tris: l.triangles });
    }
    meshes[t.mesh] = { ...look, lods: got, radius: +r.toFixed(3), maps: { color, normal }, wanted: want };
  }
  return { meshes, tex, bytes, missing: [...missingMaps], glbs: count };
}

// the evidence's pictures, 1,024 px: the claim over the ground's shade, and the inputs
const LAYER_RGB = [
  [200, 170, 90],
  [70, 130, 210],
  [150, 90, 50],
  [120, 80, 40],
  [120, 220, 80],
  [60, 60, 60],
  [30, 140, 60],
  [20, 90, 50],
  [90, 170, 200],
  [30, 70, 170],
];
async function drawPicture(dir, world, ctx, claim) {
  const { default: sharp } = await import('sharp');
  const { w, h } = ctx.frame;
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of ctx.heights) if (!Number.isNaN(v)) [lo, hi] = [Math.min(lo, v), Math.max(hi, v)];
  const mask = Buffer.alloc(w * h * 3);
  const inputs = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const shade = 40 + ((ctx.heights[i] - lo) / (hi - lo || 1)) * 120;
    const c = claim[i] ? LAYER_RGB[(claim[i] - 1) % LAYER_RGB.length] : ctx.built[i] ? [255, 255, 255] : [shade, shade, shade];
    mask.set(c.map(Math.round), i * 3);
    inputs.set(ctx.painted[i] ? [Math.min(255, (ctx.slope[i] / 45) * 255), ctx.canopy[i] * 255, ctx.play[i] * 255].map(Math.round) : [90, 90, 90], i * 3);
  }
  await mkdir(dir, { recursive: true });
  for (const [name, buf] of [
    ['mask', mask],
    ['inputs', inputs],
  ])
    await sharp(buf, { raw: { width: w, height: h, channels: 3 } })
      .resize(1024, 1024)
      .png()
      .toFile(join(dir, `${world}-${name}.png`));
}

async function one(env, world, { ref, dry, picture }) {
  const files = packFiles(world, ref);
  const levelBuf = await files.get('level.json');
  if (!levelBuf) throw new Error(`${world}: no level.json (on disk, or pass --ref <the branch that built it>)`);
  const pack = JSON.parse(levelBuf.toString('utf8'));
  const { table, from } = await tableOf(env, pack, files);
  const rules = RULES[world] ?? { rules: [], _source: `no RULES.${world}: nothing placed until the world's rules are written` };
  const surface = surfaceOf(table);
  const kinds = new Map(surface.map((s) => [s.layer, kindOf(s.texture)]));
  for (const r of rules.rules) if (r.kind && kinds.get(r.layer) !== r.kind) throw new Error(`${world}: rule for layer ${r.layer} wants a ${r.kind} texture, the terrain's is ${surface.find((s) => s.layer === r.layer)?.texture ?? 'none'}`);
  const types = typesOf(table).flatMap((l) => (rules.rules.some((r) => r.layer === l.index) ? l.types : []));
  console.log(`${world}: ${table?.terrain ?? 'no table'} (${from}); ${typesOf(table).reduce((n, l) => n + l.types.length, 0)} types over ${table?.layers?.length ?? 0} layers; ${rules.rules.length} rules`);
  for (const s of surface) console.log(`  layer ${s.layer}: ${s.texture ?? '(unmatched)'} ${kindOf(s.texture) ?? ''} (${s.score})`);

  let mask = null;
  let shipped = { meshes: {}, tex: {}, bytes: 0, missing: [], glbs: 0 };
  if (rules.rules.length && types.length && pack.terrain) {
    const t = pack.terrain;
    const png = await decodePng16(await files.get(t.near.png));
    const heights = decodeHeights(png.data, t.scale, t.offset, { hole: t.hole });
    const frame = { w: png.w, h: png.h, minX: t.near.min[0], minZ: t.near.min[1], metresPerPixel: t.near.metresPerPixel };
    const pieces = piecesOf(pack, await files.get(pack.far.bin));
    const groundAt = (x, z) => {
      const i = Math.round((z - frame.minZ) / frame.metresPerPixel) * frame.w + Math.round((x - frame.minX) / frame.metresPerPixel);
      return heights[i] ?? -Infinity;
    };
    const trees = pieces.filter((p) => p.tree && !p.crown).flatMap((p) => [p.x, p.z]);
    const all = pieces.flatMap((p) => [p.x, p.z]);
    const ctx = {
      heights,
      frame,
      slope: slopeOf(heights, frame),
      field: fieldOf(heights, frame),
      canopy: densityOf(trees, frame, CANOPY),
      play: densityOf(all, frame, PLAY),
      painted: paintedOf(heights, frame),
      built: footprintOf(
        pieces.filter((p) => !p.crown && !p.skip && Math.max(...p.half) <= BIG_M),
        frame,
        groundAt,
      ),
    };
    const claim = claimOf(rules.rules, ctx);
    if (picture) await drawPicture(picture, world, ctx, claim);
    // (at MASK_M a texel: the claim of the texel at each one's corner)
    const step = Math.max(1, Math.round(MASK_M / frame.metresPerPixel));
    const w = Math.ceil(frame.w / step);
    const h = Math.ceil(frame.h / step);
    const data = new Uint16Array(w * h);
    const count = new Map();
    for (let z = 0; z < h; z++)
      for (let x = 0; x < w; x++) {
        const v = claim[z * step * frame.w + x * step];
        data[z * w + x] = v;
        count.set(v, (count.get(v) ?? 0) + 1);
      }
    const pngOut = encodePng16(data, w, h);
    const share = Object.fromEntries([...count].filter(([v]) => v).sort((a, b) => a[0] - b[0]).map(([v, n]) => [v - 1, +(n / (w * h)).toFixed(4)]));
    mask = { png: 'scatter/layers.png', w, h, minX: frame.minX, minZ: frame.minZ, metresPerPixel: frame.metresPerPixel * step, share, bytes: pngOut.length };
    console.log(`  mask ${w}×${h} at ${mask.metresPerPixel} m, ${kb(pngOut.length)}; shares ${JSON.stringify(share)}; painted ${((ctx.painted.reduce((a, b) => a + b, 0) / ctx.painted.length) * 100).toFixed(1)}%, built ${((ctx.built.reduce((a, b) => a + b, 0) / ctx.built.length) * 100).toFixed(1)}%`);
    shipped = await shipMeshes(env, types, files, { dry });
    if (!dry) {
      await mkdir(join(files.dir, 'scatter'), { recursive: true });
      await writeFile(join(files.dir, mask.png), pngOut);
    }
    const looks = Object.values(shipped.meshes).reduce((a, m) => ({ ...a, [m.look]: (a[m.look] ?? 0) + 1 }), {});
    console.log(`  ${Object.keys(shipped.meshes).length} meshes (${JSON.stringify(looks)}), ${shipped.glbs} LOD files, ${Object.keys(shipped.tex).length} maps, ${kb(shipped.bytes)}`);
    if (shipped.missing.length) console.log(`  maps not in the bucket yet (${shipped.missing.length}): ${shipped.missing.map(lastOf).join(', ')}`);
  } else console.log(`  nothing to place: ${!types.length ? 'the terrain scatters nothing' : !pack.terrain ? 'the pack has no terrain' : 'no rules'}`);

  const json = scatterJson({ world, table: table ?? { layers: [] }, rules, mask, tex: shipped.tex, meshes: shipped.meshes, surface });
  json.tableFrom = from;
  json.mapsMissing = shipped.missing;
  if (!dry) {
    await mkdir(files.dir, { recursive: true });
    await writeFile(join(files.dir, 'scatter.json'), `${JSON.stringify(json, null, 1)}\n`);
  }
  return json;
}

const args = parseArgs(process.argv.slice(2));
const worlds = args._;
if (!worlds.length) {
  console.error('usage: node scripts/bf2017-scatter.mjs <world> [<world> …] [--ref <git ref>] [--dry]');
  process.exit(1);
}
const env = keys();
for (const w of worlds) await one(env, w, { ref: typeof args.ref === 'string' ? args.ref : null, dry: Boolean(args.dry), picture: typeof args.picture === 'string' ? args.picture : null });

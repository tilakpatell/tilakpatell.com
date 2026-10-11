// The coarse horizon grid beside a level pack (lane N4: the GPU-first design's
// §4 "N4", World Partition's HLOD grid): node scripts/bf2017-horizon.mjs <world>
// writes public/models/galaxy/bf2017/levels/<world>/horizon/:
//
//   index.json            the cells (key → { glb, bytes, tris, impostors: { mesh: [x, y, z, yaw, size] … } })
//                         and the atlases (mesh → { albedo, normal, rows, radius, centre })
//   <key>.glb, <key>.lo.glb
//                         a 512 m cell's things merged at their last LODs, each
//                         material's group simplified to the cell's triangle
//                         target (the .lo cut, low's and mid's, a third of it),
//                         meshopt-compressed; its colour maps named as
//                         the pack's meshes name them (../tex/<slug>.ktx2), so
//                         the loader binds them from the same cache at their
//                         smallest row
//   <slug>.albedo.<size>.ktx2, <slug>.normal.<size>.ktx2
//                         the impostors' atlases (scripts/impostors.mjs): 16 × 16
//                         views at 2,048, UASTC, the smaller rows the same
//                         file with its top mips taken off (ktx2-levels.mjs)
//
// and gives level.json its `coarse` row ({ index, cell, far }: `far` the far
// list's bytes it was cut from, so a rebuilt pack drops a stale grid:
// scripts/lib/bf2017-level.mjs's keepRows). Which instances go where is
// scripts/lib/bf2017-horizon.mjs's (pure, tested).
//
// The pack's binaries are published by hash, not committed (lane E0): what
// the pack names is read from public/ where it is there, else from the
// bucket by its hash in src/data/galaxyAssets.json (public, no key), into
// scripts/.cache/n4/<world>/. The files written here are committed until
// `node scripts/assets-publish.mjs --only 'models/galaxy/bf2017/levels/*/horizon/*'`
// (the owner's key) sends them and takes them out of git.
//
//   node scripts/bf2017-horizon.mjs <world> [--views 16] [--size 2048] [--no-impostors] [--dry]
//   (ANGLE=d3d11 on the desktop bakes on the graphics chip: lane W's `impostors` job)

import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, quantize, reorder } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { readInstances } from '../src/lib/level/instances.js';
import { splitTextures } from '../src/components/galaxy/surface/level/levelPack.js';
import { parseArgs } from './lib/args.mjs';
import { CELL_TRIS, CELL_TRIS_LO, COARSE, horizonCells, impostorsOf, lastFile } from './lib/bf2017-horizon.mjs';
import { compose, mergeInto, multiply, newGroup } from './lib/horizon-merge.mjs';
import { VIEWS } from './lib/impostor-layout.mjs';
import { dropLevels, ktx2Info } from './lib/ktx2-levels.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASE =
  process.env.ASSET_BASE ?? process.env.VITE_ASSET_BASE ?? (process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL}/storage/v1/object/public/site-assets` : 'https://jzabcqboyemokwifmjmp.supabase.co/storage/v1/object/public/site-assets');
// _source: the design's §4 N4 (2,048 on high and ultra); the smaller tiers
// a step and two under, as the pack's own maps are (lod.js's texSizeFor)
export const ATLAS_ROWS = { low: 512, mid: 1024, high: 2048, ultra: 2048 };
// _source: meshopt's simplifier, error relative to the merge's extent: 1 %
// of a 512 m cell is 5 m, under a pixel at the grid's distance (bf2017-horizon.mjs's PROXY_MIN_RADIUS)
const SIMPLIFY_ERROR = 0.01;
// (the sloppy pass's: 2 %, 10 m in a 512 m cell, the grid's coarsest step)
const SLOPPY_ERROR = 0.02;

const manifest = JSON.parse(await readFile(join(ROOT, 'src/data/galaxyAssets.json'), 'utf8'));

// a pack file's bytes: public/ where it is there, else the bucket's copy
async function packFile(world, path) {
  const site = `models/galaxy/bf2017/levels/${world}/${path}`;
  const local = join(ROOT, 'public', site);
  if (existsSync(local)) return readFile(local);
  const cache = join(ROOT, 'scripts/.cache/n4', world, path);
  if (existsSync(cache)) return readFile(cache);
  const entry = manifest[site];
  if (!entry) throw new Error(`${site}: neither in public/ nor in galaxyAssets.json`);
  const r = await fetch(`${BASE}/${entry.hash}/${site}`);
  if (!r.ok) throw new Error(`${r.status} ${site}`);
  const buf = Buffer.from(await r.arrayBuffer());
  await mkdir(join(cache, '..'), { recursive: true });
  await writeFile(cache, buf);
  return buf;
}

const io = () =>
  new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });

// A mesh's last LOD as plain arrays a primitive, in its own frame (the
// node's matrix, which carries the quantisation's scale, applied), with the
// colour map each primitive's material wears: the GLB's own, else its
// recipe's (recipes.json), else none
async function partsOf(world, pack, recipes, meshIndex) {
  const f = lastFile(pack.meshes[meshIndex]);
  const { buffer, slots } = splitTextures(new Uint8Array(await packFile(world, f.glb)).buffer);
  const doc = await io().readBinary(new Uint8Array(buffer));
  const mats = doc.getRoot().listMaterials();
  const recipeOf = (mat) => {
    const list = recipes?.meshes?.[meshIndex] ?? [];
    const shader = mat?.getExtras()?.shader ?? null;
    return (shader && list.find((r) => r?.shader === shader)) ?? list[mats.indexOf(mat)] ?? null;
  };
  const colourOf = (mat) => {
    const own = slots.find((s) => s.material === mats.indexOf(mat) && s.slot === 'map')?.uri;
    if (own) return own.replace(/^(\.\.\/)+/, '');
    const name = recipeOf(mat)?.maps?.color;
    const path = name && recipes.maps?.[name];
    return typeof path === 'string' ? path : null;
  };
  const parts = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const world = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== 4) continue;
      const read = (name, size) => {
        const a = prim.getAttribute(name);
        if (!a) return null;
        const out = new Array(a.getCount() * size);
        const el = [];
        for (let i = 0; i < a.getCount(); i++) {
          a.getElement(i, el);
          for (let k = 0; k < size; k++) out[i * size + k] = el[k];
        }
        return out;
      };
      const mat = prim.getMaterial();
      parts.push({
        local: Array.from(world),
        geometry: {
          position: read('POSITION', 3),
          normal: read('NORMAL', 3),
          uv: read('TEXCOORD_0', 2),
          index: prim.getIndices() ? Array.from(prim.getIndices().getArray()) : null,
        },
        colour: colourOf(mat),
        factor: mat ? mat.getBaseColorFactor().map((c) => Math.round(c * 100) / 100) : [1, 1, 1, 1],
        roughness: mat ? mat.getRoughnessFactor() : 1,
      });
    }
  }
  return parts;
}

// a group's triangles cut to `ratio` of them, its unused vertices dropped
function simplified(g, ratio) {
  if (ratio >= 1 || g.index.length < 300) return g;
  const target = Math.max(3, Math.floor((g.index.length * ratio) / 3) * 3);
  const idx = Uint32Array.from(g.index);
  const pos = Float32Array.from(g.position);
  // (a cell is hundreds of separate meshes, each all border: the careful
  // simplifier stops at their outlines, so the sloppy one, which welds by
  // a grid, finishes what it leaves over the target)
  let [index] = MeshoptSimplifier.simplify(idx, pos, 3, target, SIMPLIFY_ERROR);
  if (index.length > target * 1.1) [index] = MeshoptSimplifier.simplifySloppy(index, pos, 3, null, target, SLOPPY_ERROR);
  const remap = new Map();
  const out = newGroup();
  for (const v of index) {
    if (!remap.has(v)) {
      remap.set(v, remap.size);
      out.position.push(g.position[v * 3], g.position[v * 3 + 1], g.position[v * 3 + 2]);
      out.normal.push(g.normal[v * 3], g.normal[v * 3 + 1], g.normal[v * 3 + 2]);
      out.uv.push(g.uv[v * 2], g.uv[v * 2 + 1]);
    }
    out.index.push(remap.get(v));
  }
  return out;
}

// A cell's groups as a GLB: one node at the cell's middle, one mesh, a
// primitive a material; quantised and meshopt-compressed as the pack's
// meshes are. Its colour maps are added to the JSON after (glTF-Transform
// would embed an image it was given, and the pack names its maps outside)
async function cellGlb(groups, origin) {
  const { Document } = await import('@gltf-transform/core');
  const doc = new Document();
  const buffer = doc.createBuffer();
  const mesh = doc.createMesh('proxy');
  const maps = [];
  for (const g of groups.values()) {
    if (!g.index.length) continue;
    const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
    const mat = doc.createMaterial(g.key).setBaseColorFactor(g.factor).setRoughnessFactor(g.roughness).setMetallicFactor(0);
    maps.push(g.colour);
    const prim = doc
      .createPrimitive()
      .setMaterial(mat)
      .setAttribute(
        'POSITION',
        acc(
          'VEC3',
          Float32Array.from(g.position, (v, k) => v - origin[k % 3]),
        ),
      )
      .setAttribute('NORMAL', acc('VEC3', Float32Array.from(g.normal)))
      .setAttribute('TEXCOORD_0', acc('VEC2', Float32Array.from(g.uv)))
      .setIndices(acc('SCALAR', Uint32Array.from(g.index)));
    mesh.addPrimitive(prim);
  }
  doc.createScene().addChild(doc.createNode('cell').setMesh(mesh).setTranslation(origin));
  await doc.transform(reorder({ encoder: MeshoptEncoder }), quantize({ quantizePosition: 14, quantizeNormal: 8, quantizeTexcoord: 12 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  return withMaps(await io().writeBinary(doc), maps);
}

// the cell's materials given their colour maps by URI (KHR_texture_basisu,
// as the pack's meshes carry them); the loader takes them out again and
// binds the shared cache's (levelPack.js's splitTextures)
export function withMaps(glb, maps) {
  if (!maps.some(Boolean)) return glb;
  const bytes = new Uint8Array(glb);
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const len = v.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + len)));
  json.images = [];
  json.textures = [];
  maps.forEach((uri, i) => {
    if (!uri) return;
    json.images.push({ uri: `../${uri}`, mimeType: 'image/ktx2' });
    json.textures.push({
      extensions: { KHR_texture_basisu: { source: json.images.length - 1 } },
    });
    json.materials[i].pbrMetallicRoughness = {
      ...json.materials[i].pbrMetallicRoughness,
      baseColorTexture: { index: json.textures.length - 1 },
    };
  });
  json.extensionsUsed = [...new Set([...(json.extensionsUsed ?? []), 'KHR_texture_basisu'])];
  let text = new TextEncoder().encode(JSON.stringify(json));
  const pad = (4 - (text.length % 4)) % 4;
  if (pad) {
    const t = new Uint8Array(text.length + pad).fill(0x20);
    t.set(text);
    text = t;
  }
  const rest = bytes.subarray(20 + len);
  const out = new Uint8Array(20 + text.length + rest.length);
  out.set(bytes.subarray(0, 20));
  const o = new DataView(out.buffer);
  o.setUint32(8, out.length, true);
  o.setUint32(12, text.length, true);
  out.set(text, 20);
  out.set(rest, 20 + text.length);
  return out;
}

// an impostor's record: where its bounding sphere's middle is, its yaw and
// its size (the instance's largest scale × the bake's radius), to the
// centimetre and the hundredth of a radian
function impostorRecord(inst, i, centre, radius) {
  const [x, y, z] = [inst.position[i * 3], inst.position[i * 3 + 1], inst.position[i * 3 + 2]];
  const [qx, qy, qz, qw] = Array.from(inst.quaternion.subarray(i * 4, i * 4 + 4));
  const m = compose([x, y, z], [qx, qy, qz, qw], Array.from(inst.scale.subarray(i * 3, i * 3 + 3)));
  const c = [m[0] * centre[0] + m[4] * centre[1] + m[8] * centre[2] + m[12], m[1] * centre[0] + m[5] * centre[1] + m[9] * centre[2] + m[13], m[2] * centre[0] + m[6] * centre[1] + m[10] * centre[2] + m[14]];
  const yaw = Math.atan2(2 * (qw * qy + qx * qz), 1 - 2 * (qy * qy + qx * qx));
  const s = Math.max(...Array.from(inst.scale.subarray(i * 3, i * 3 + 3), Math.abs));
  const r2 = (n, k = 100) => Math.round(n * k) / k;
  return [r2(c[0]), r2(c[1]), r2(c[2]), r2(yaw), r2(radius * s)];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const world = args._[0];
  if (!world) {
    console.error('node scripts/bf2017-horizon.mjs <world> [--views 16] [--size 2048] [--no-impostors] [--dry]');
    process.exit(1);
  }
  const dir = join(ROOT, 'public/models/galaxy/bf2017/levels', world);
  const pack = JSON.parse(await readFile(join(dir, 'level.json'), 'utf8'));
  const recipes = existsSync(join(dir, 'recipes.json')) ? JSON.parse(await readFile(join(dir, 'recipes.json'), 'utf8')) : null;
  const tables = {
    far: readInstances(new Uint8Array(await packFile(world, pack.far.bin)).buffer),
    horizon: pack.horizon?.bin ? readInstances(new Uint8Array(await packFile(world, pack.horizon.bin)).buffer) : null,
  };
  const impostors = args.noImpostors ? [] : impostorsOf(pack);
  const cells = horizonCells(pack, { horizon: tables.horizon }, { impostors });
  const out = join(dir, 'horizon');
  if (!args.dry) {
    await rm(out, { recursive: true, force: true });
    await mkdir(out, { recursive: true });
  }
  const parts = new Map(); // mesh → parts
  const partsFor = async (m) => {
    if (!parts.has(m)) parts.set(m, await partsOf(world, pack, recipes, m));
    return parts.get(m);
  };

  // the impostors' atlases first: their records need the bake's sphere
  const atlases = {};
  if (impostors.length) {
    const { createBaker } = await import('./impostors.mjs');
    const { encodeImage } = await import('./ktx2.mjs');
    const baker = await createBaker();
    const size = Number(args.size ?? 2048);
    for (const m of impostors) {
      const t0 = Date.now();
      const f = lastFile(pack.meshes[m]);
      const { buffer } = splitTextures(new Uint8Array(await packFile(world, f.glb)).buffer);
      const colourPath = (await partsFor(m)).find((p) => p.colour)?.colour ?? null;
      const colour = colourPath ? await packFile(world, colourPath.replace(/\.ktx2$/, `.${smallestRow(pack, colourPath)}.ktx2`)).catch(() => null) : null;
      const baked = await baker.bake(buffer, {
        n: Number(args.views ?? VIEWS),
        size,
        colour,
      });
      const slug = f.glb
        .split('/')
        .pop()
        .replace(/(_mesh)?\.lod\d+\.glb$/, '');
      const rows = {};
      for (const [kind, png, role] of [
        ['albedo', baked.albedo, 'color'],
        ['normal', baked.normal, 'other'],
      ]) {
        const { ktx2 } = await encodeImage(png, { role });
        const top = ktx2Info(ktx2).width;
        for (const want of new Set(Object.values(ATLAS_ROWS))) {
          const drop = Math.max(0, Math.round(Math.log2(top / want)));
          const file = `${slug}.${kind}.${want}.ktx2`;
          const bytes = dropLevels(ktx2, drop);
          rows[file] = bytes.length;
          if (!args.dry) await writeFile(join(out, file), bytes);
        }
      }
      atlases[m] = {
        slug,
        albedo: `horizon/${slug}.albedo.ktx2`,
        normal: `horizon/${slug}.normal.ktx2`,
        rows: ATLAS_ROWS,
        views: Number(args.views ?? VIEWS),
        radius: Math.round(baked.radius * 1000) / 1000,
        centre: baked.centre.map((c) => Math.round(c * 1000) / 1000),
        bytes: rows,
      };
      console.log(
        `impostor ${slug.padEnd(48)} r ${baked.radius.toFixed(2)} m  ${Object.entries(rows)
          .map(([k, b]) => `${k.split('.').slice(-2, -1)[0]} ${(b / 1024).toFixed(0)} KB`)
          .join(' ')}  ${((Date.now() - t0) / 1000).toFixed(1)} s`,
      );
    }
    await baker.close();
  }

  const index = {
    cell: COARSE,
    views: Number(args.views ?? VIEWS),
    cells: {},
    atlases: Object.fromEntries(Object.entries(atlases).map(([m, a]) => [m, a])),
  };
  let total = 0;
  let totalLo = 0;
  for (const [key, c] of Object.entries(cells)) {
    const [cx, cz] = key.split(',').map(Number);
    const origin = [(cx + 0.5) * COARSE, 0, (cz + 0.5) * COARSE];
    const groups = new Map();
    for (const p of c.proxies) {
      const inst = tables[p.table];
      const i = p.index;
      const m = compose(Array.from(inst.position.subarray(i * 3, i * 3 + 3)), Array.from(inst.quaternion.subarray(i * 4, i * 4 + 4)), Array.from(inst.scale.subarray(i * 3, i * 3 + 3)));
      for (const part of await partsFor(p.mesh)) {
        const gk = `${part.colour ?? '-'}|${part.factor.join(',')}`;
        if (!groups.has(gk))
          groups.set(gk, {
            ...newGroup(),
            key: gk,
            colour: part.colour,
            factor: part.factor,
            roughness: part.roughness,
          });
        mergeInto(groups.get(gk), part.geometry, multiply(m, part.local));
      }
    }
    const imp = {};
    for (const ref of c.impostors) {
      const a = atlases[ref.mesh];
      if (!a) continue;
      (imp[ref.mesh] ??= []).push(impostorRecord(tables[ref.table], ref.index, a.centre, a.radius));
    }
    const cuts = {};
    const sum = [...groups.values()].reduce((s, g) => s + g.index.length / 3, 0);
    for (const [cut, cap] of [
      ['plain', CELL_TRIS],
      ['lo', CELL_TRIS_LO],
    ]) {
      if (!sum) break;
      // (a cell already under the light cut's target is its own light cut)
      if (cut === 'lo' && sum <= cap && cuts.plain) {
        cuts.lo = cuts.plain;
        break;
      }
      const ratio = Math.min(1, cap / sum);
      const cutGroups = new Map([...groups].map(([gk, g]) => [gk, { ...g, ...simplified(g, ratio) }]));
      const tris = [...cutGroups.values()].reduce((s, g) => s + g.index.length / 3, 0);
      const glb = await cellGlb(cutGroups, origin);
      const file = `horizon/${key.replace(',', '_')}${cut === 'lo' ? '.lo' : ''}.glb`;
      if (!args.dry) await writeFile(join(dir, file), glb);
      cuts[cut] = { glb: file, bytes: glb.length, tris };
    }
    const bytes = cuts.plain?.bytes ?? 0;
    const tris = cuts.plain?.tris ?? 0;
    total += bytes;
    totalLo += cuts.lo?.bytes ?? 0;
    if (cuts.lo === cuts.plain) cuts.lo = { ...cuts.plain };
    index.cells[key] = {
      ...cuts,
      things: c.proxies.length,
      ...(Object.keys(imp).length ? { impostors: imp } : {}),
    };
    console.log(
      `cell ${key.padEnd(7)} ${String(c.proxies.length).padStart(4)} things → ${String(tris).padStart(6)} tris  ${(bytes / 1024).toFixed(0).padStart(4)} KB  (lo ${String(cuts.lo?.tris ?? 0).padStart(5)} tris ${((cuts.lo?.bytes ?? 0) / 1024).toFixed(0).padStart(3)} KB)  impostors ${c.impostors.length}`,
    );
  }
  const atlasBytes = Object.fromEntries(
    Object.entries(ATLAS_ROWS).map(([t, size]) => [
      t,
      Object.values(atlases).reduce(
        (s, a) =>
          s +
          Object.entries(a.bytes)
            .filter(([f]) => f.endsWith(`.${size}.ktx2`))
            .reduce((x, [, b]) => x + b, 0),
        0,
      ),
    ]),
  );
  index.bytes = { cells: total, lo: totalLo, atlases: atlasBytes };
  console.log(
    `${Object.keys(cells).length} cells, ${(total / 1e6).toFixed(2)} MB of proxies (lo ${(totalLo / 1e6).toFixed(2)} MB); atlases ${Object.entries(atlasBytes)
      .map(([t, b]) => `${t} ${(b / 1e6).toFixed(2)} MB`)
      .join(', ')}`,
  );
  if (args.dry) return;
  await writeFile(join(out, 'index.json'), `${JSON.stringify(index)}\n`);
  pack.coarse = {
    cell: COARSE,
    far: pack.far.bytes,
    index: 'horizon/index.json',
  };
  await writeFile(join(dir, 'level.json'), `${JSON.stringify(sortKeys(pack))}\n`);
  console.log(`wrote ${out} and level.json's coarse row`);
}

// (level.json's keys in order, as the pack builder writes them)
const sortKeys = (o) =>
  Object.fromEntries(
    Object.keys(o)
      .sort()
      .map((k) => [k, o[k]]),
  );

// the smallest row the pack lists for a map (its tex row's sizes)
function smallestRow(pack, path) {
  const slug = path
    .split('/')
    .pop()
    .replace(/\.ktx2$/, '');
  const sizes = Object.values(pack.tex?.[slug] ?? {}).filter((v) => typeof v === 'number');
  return sizes.length ? Math.min(...sizes) : 256;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();

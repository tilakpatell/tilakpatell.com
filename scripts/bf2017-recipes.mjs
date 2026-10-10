#!/usr/bin/env node
// The game's material recipes for a level pack (lane Q1:
// docs/superpowers/plans/2026-10-10-bf2017-surfaces-laneQ1-materials.md).
// Reads the export's material dump (web/materials.jsonl, cached under
// lab/assets/bf2017/), turns each of the pack's meshes' materials into a
// recipe (scripts/lib/bf2017-recipes.mjs) and writes recipes.json beside the
// pack's level.json; lists the maps the recipes want and which the bucket
// has; with --fetch, takes each one there into the pack's tex/ at the tier's
// sizes, as lane L's pack takes its own.
//
//   node scripts/bf2017-recipes.mjs --level hoth [--fetch]
//   node scripts/bf2017-recipes.mjs <mesh>            (one mesh's recipes, printed)
//   node scripts/bf2017-recipes.mjs --count           (families over the whole dump)
//   node scripts/bf2017-recipes.mjs --crew <kind>[,<kind>…] | --crew all
//     a crew pack's recipes, crew/<kind>.recipes.json: { materials: { <GLB
//     material name>: recipe }, maps, tex }, each material found by the
//     colour map it wears; its maps in crew/tex/ (a detail array's slices
//     encoded from the export's PNGs where the bucket has no KTX2), shared by
//     every kind; published with the packs (scripts/assets-publish.mjs)
//
// The keys (SUPABASE_URL and BF2017_KEY, or SUPA_KEY in a cloud session)
// come from the environment; in a cloud session Node's fetch needs
// NODE_USE_ENV_PROXY=1. A map the bucket has not got yet (the desktop is
// encoding them: web_opt/_surfaces_list.tsv) prints `missing:` and the
// recipe goes without it; run again with --fetch when it lands.
//
// recipes.json: { source, families, meshes: { <mesh index>: [recipe, …] },
//   maps: { <game texture name>: 'tex/<slug>.ktx2' | null }, tex: { <slug>: { low, mid, high, ultra } } }
// (the dump's material order; the loader matches a GLB material to its
// recipe by the shader the GLB's extras name)

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { candidatesOf, colourIndex, countFamilies, crewRecipes, mapsWanted, recipesOf } from './lib/bf2017-recipes.mjs';
import { ktx2Info, dropMips, mipsToFit } from './lib/ktx2-mips.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'lab/assets/bf2017');
const DUMP = 'materials.jsonl';
const TIERS = ['low', 'mid', 'high', 'ultra'];
// A tiling map's size per tier: it repeats over the surface, so it is sized
// by how close it is seen, not by the thing (the spec's tiers: high takes
// the detail a mip under ultra; low draws none, its row the smallest)
const TILING_SIZE = { low: 256, mid: 512, high: 512, ultra: 1024 };
// a mask or overlay spans the thing once: lod.js's data maps' sizes
const MASK_SIZE = { low: 256, mid: 512, high: 512, ultra: 1024 };
const TILING_KINDS = new Set(['detail', 'array']);

const dumpPath = join(CACHE, 'web', DUMP);
const meshOf = (glbName) => glbName.replace(/^models\//, '').replace(/\.glb$/, '');

async function readDump() {
  if (!existsSync(dumpPath)) {
    console.error(`No dump at ${dumpPath}: run node scripts/bf2017-fetch.mjs --raw ${DUMP} first.`);
    process.exit(2);
  }
  const rows = new Map();
  for (const line of (await readFile(dumpPath, 'utf8')).split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    rows.set(r.mesh, r);
  }
  return rows;
}

async function bucketHas(env, listFolder) {
  const folders = new Map();
  return async (path) => {
    const dir = `web/${path.slice(0, path.lastIndexOf('/'))}`;
    if (!folders.has(dir))
      folders.set(
        dir,
        listFolder(env, `${dir}/`)
          .then((names) => new Set(names))
          .catch(() => new Set()),
      );
    return (await folders.get(dir)).has(path.split('/').pop());
  };
}

// A KTX2 at each tier's size, its mips dropped (tex/<slug>.<size>.ktx2,
// one file a distinct size) → { tier: size }
async function writeSizes(buf, kind, dir, slug) {
  const info = ktx2Info(buf);
  const sizes = TILING_KINDS.has(kind) ? TILING_SIZE : MASK_SIZE;
  const row = {};
  const written = new Set();
  await mkdir(dir, { recursive: true });
  for (const tier of TIERS) {
    const size = Math.min(sizes[tier], info.width);
    row[tier] = size;
    if (written.has(size)) continue;
    written.add(size);
    await writeFile(join(dir, `${slug}.${size}.ktx2`), dropMips(buf, Math.min(mipsToFit(info.width, size), info.levels - 1)));
  }
  return row;
}

async function level(world, { fetch: doFetch }) {
  const packDir = join(ROOT, 'public/models/galaxy/bf2017/levels', world);
  const pack = JSON.parse(await readFile(join(packDir, 'level.json'), 'utf8'));
  const rows = await readDump();
  const meshes = {};
  const all = [];
  let unknown = 0;
  pack.meshes.forEach((m, i) => {
    const row = rows.get(meshOf(m.name));
    if (!row) return unknown++;
    meshes[i] = recipesOf(row);
    all.push(...meshes[i]);
  });
  const families = {};
  for (const r of all) families[r.family] = (families[r.family] ?? 0) + 1;
  const wanted = mapsWanted(all);
  console.log(`${pack.meshes.length} meshes, ${all.length} materials (${unknown} meshes not in the dump)`);
  console.log(
    `families: ${Object.entries(families)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}`,
  );
  console.log(`maps wanted: ${wanted.length}`);

  const { keys, listFolder, getObject } = await import('./bf2017-fetch.mjs');
  const env = keys();
  const has = await bucketHas(env, listFolder);
  const maps = {};
  const tex = {};
  const old = existsSync(join(packDir, 'recipes.json')) ? JSON.parse(await readFile(join(packDir, 'recipes.json'), 'utf8')) : null;
  let missing = 0;
  for (const { name, kind } of wanted) {
    let found = null;
    for (const c of candidatesOf(name, kind)) if (await has(c)) found ??= c;
    if (!found) {
      console.log(`missing: ${kind.padEnd(8)} ${name}`);
      maps[name] = null;
      missing++;
      continue;
    }
    const slug = found
      .split('/')
      .pop()
      .replace(/\.ktx2$/, '');
    maps[name] = `tex/${slug}.ktx2`;
    if (!doFetch) {
      // (a map fetched by an earlier run keeps its rows)
      if (old?.tex?.[slug]) tex[slug] = old.tex[slug];
      else maps[name] = null;
      console.log(`${old?.tex?.[slug] ? 'have:   ' : 'there:  '} ${kind.padEnd(8)} ${name}`);
      continue;
    }
    const got = await getObject(env, CACHE, `web/${found}`);
    if (got.state !== 'fetched' && got.state !== 'kept') {
      console.log(`failed: ${kind.padEnd(8)} ${name} (${got.state})`);
      maps[name] = null;
      continue;
    }
    tex[slug] = await writeSizes(await readFile(got.file), kind, join(packDir, 'tex'), slug);
    console.log(`fetched: ${kind.padEnd(8)} ${name} → tex/${slug}`);
  }
  const out = { source: `web/${DUMP}`, families, meshes, maps, tex };
  const text = `${JSON.stringify(out)}\n`;
  await writeFile(join(packDir, 'recipes.json'), text);
  const have = Object.values(maps).filter(Boolean).length;
  console.log(`recipes.json: ${(text.length / 1e6).toFixed(2)} MB; maps ${have} of ${wanted.length} in the pack, ${missing} missing from the bucket`);
}

// ---- crew packs (scripts/bf2017-import.mjs's kinds under crew/): each
// material found by its colour map, the maps beside the packs in crew/tex/,
// shared by every kind

const CREW_DIR = join(ROOT, 'public/models/galaxy/bf2017/crew');
const ASSETS = 'src/data/galaxyAssets.json';

// a crew GLB's JSON chunk: the file here, else its first bytes from the
// site's public bucket (the published GLBs are not in git)
async function crewGlbJson(kind) {
  const local = join(CREW_DIR, `${kind}.glb`);
  const parse = (b) => JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  if (existsSync(local)) return parse(await readFile(local));
  const published = JSON.parse(await readFile(join(ROOT, ASSETS), 'utf8'))[`models/galaxy/bf2017/crew/${kind}.glb`];
  if (!published) return null;
  const url = `${process.env.SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/site-assets/${published.hash}/models/galaxy/bf2017/crew/${kind}.glb`;
  const head = Buffer.from(await (await fetch(url, { headers: { Range: 'bytes=0-19' } })).arrayBuffer());
  const len = head.readUInt32LE(12);
  const json = Buffer.from(await (await fetch(url, { headers: { Range: `bytes=20-${19 + len}` } })).arrayBuffer());
  return JSON.parse(json.toString('utf8'));
}

async function crew(kinds) {
  const { keys, listFolder, getObject } = await import('./bf2017-fetch.mjs');
  const { encodeImage } = await import('./ktx2.mjs');
  const env = keys();
  const has = await bucketHas(env, listFolder);
  const index = colourIndex([...(await readDump()).values()]);
  const textures = new Map();
  for (const line of (await readFile((await getObject(env, CACHE, 'web/textures.jsonl')).file, 'utf8')).split('\n')) {
    if (!line.trim()) continue;
    const t = JSON.parse(line);
    textures.set(t.name.toLowerCase(), t);
  }
  const texDir = join(CREW_DIR, 'tex');
  const done = new Map(); // game name → its maps entry, across kinds
  const sizesOf = {};
  const total = { kinds: 0, materials: 0, maps: 0, missing: 0, encoded: 0 };
  // one map into crew/tex: its slices for an array (encoded from the export's
  // PNGs when the bucket has no KTX2), else its KTX2
  async function mapOf(name, kind) {
    if (done.has(name)) return done.get(name);
    let entry = null;
    if (kind === 'array') {
      const t = textures.get(name.toLowerCase());
      const files = t?.files ?? (t ? [t.file] : []);
      const paths = [];
      for (const [i, png] of files.entries()) {
        const slug = `${png.split('/').pop().replace(/\.png$/, '')}`;
        if (!existsSync(join(texDir, `${slug}.${Math.min(TILING_SIZE.high, t.width)}.ktx2`)) || !sizesOf[slug]) {
          let buf = null;
          for (const c of [`${png.replace(/\.png$/, '')}__normal.ktx2`, png.replace(/\.png$/, '.ktx2')]) {
            if (!buf && (await has(c))) buf = await readFile((await getObject(env, CACHE, `web/${c}`)).file);
          }
          if (!buf) {
            const got = await getObject(env, CACHE, `web/${png}`);
            if (got.state !== 'fetched' && got.state !== 'kept') break;
            buf = (await encodeImage(await readFile(got.file), { role: 'normal' })).ktx2;
            total.encoded++;
          }
          sizesOf[slug] = await writeSizes(buf, kind, texDir, slug);
        }
        paths[i] = `tex/${slug}.ktx2`;
      }
      entry = paths.length && paths.length === files.length ? paths : null;
    } else {
      let found = null;
      for (const c of candidatesOf(name, kind)) if (!found && (await has(c))) found = c;
      if (found) {
        const slug = found.split('/').pop().replace(/\.ktx2$/, '');
        if (!sizesOf[slug]) sizesOf[slug] = await writeSizes(await readFile((await getObject(env, CACHE, `web/${found}`)).file), kind, texDir, slug);
        entry = `tex/${slug}.ktx2`;
      }
    }
    if (!entry) {
      console.log(`missing: ${kind.padEnd(8)} ${name}`);
      total.missing++;
    }
    done.set(name, entry);
    return entry;
  }
  for (const kind of kinds) {
    const glb = await crewGlbJson(kind).catch((e) => (console.log(`${kind}: no GLB (${e.message})`), null));
    if (!glb) continue;
    const materials = crewRecipes(glb, index);
    const wanted = mapsWanted(Object.values(materials));
    const maps = {};
    const tex = {};
    for (const { name, kind: k } of wanted) {
      maps[name] = await mapOf(name, k);
      for (const p of [maps[name]].flat().filter(Boolean)) {
        const slug = p.slice(4, -5);
        tex[slug] = sizesOf[slug];
      }
    }
    await writeFile(join(CREW_DIR, `${kind}.recipes.json`), `${JSON.stringify({ source: `web/${DUMP}`, materials, maps, tex })}\n`);
    total.kinds++;
    total.materials += Object.keys(materials).length;
    total.maps += wanted.length;
    console.log(`${kind}: ${Object.keys(materials).length} of ${glb.materials?.length ?? 0} materials, ${wanted.length} maps (${Object.entries(materials).map(([n, r]) => `${n}: ${r.family}`).join(', ')})`);
  }
  console.log(`crew: ${total.kinds} kinds, ${total.materials} materials with recipes, ${total.maps} maps wanted, ${total.missing} missing, ${total.encoded} slices encoded from the export's PNGs`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.count) {
    const rows = [...(await readDump()).values()];
    const c = countFamilies(rows);
    const total = Object.values(c).reduce((a, b) => a + b, 0);
    for (const [k, v] of Object.entries(c).sort((a, b) => b[1] - a[1])) console.log(`${k.padEnd(18)} ${String(v).padStart(6)}  ${((100 * v) / total).toFixed(1)}%`);
    console.log(`${'total'.padEnd(18)} ${String(total).padStart(6)}`);
    return;
  }
  if (args.level) return level(args.level, { fetch: !!args.fetch });
  if (args.crew) {
    const { CREW } = await import('../src/components/galaxy/surface/crewList.js');
    const all = Object.keys(CREW).filter((k) => /\/bf2017\/crew\//.test(CREW[k].url ?? ''));
    return crew(args.crew === 'all' || args.crew === true ? all : String(args.crew).split(','));
  }
  const [mesh] = args._;
  if (!mesh) {
    console.error('usage: node scripts/bf2017-recipes.mjs --level <world> [--fetch] | <mesh> | --count');
    process.exit(2);
  }
  const row = (await readDump()).get(mesh);
  if (!row) {
    console.error(`${mesh}: not in the dump`);
    process.exit(1);
  }
  console.log(JSON.stringify(recipesOf(row), null, 2));
}

await main();

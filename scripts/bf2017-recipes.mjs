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
import { candidatesOf, countFamilies, mapsWanted, recipesOf } from './lib/bf2017-recipes.mjs';
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
    const buf = await readFile(got.file);
    const info = ktx2Info(buf);
    const sizes = TILING_KINDS.has(kind) ? TILING_SIZE : MASK_SIZE;
    tex[slug] = {};
    const written = new Set();
    for (const tier of TIERS) {
      const size = Math.min(sizes[tier], info.width);
      tex[slug][tier] = size;
      if (written.has(size)) continue;
      written.add(size);
      const out = dropMips(buf, Math.min(mipsToFit(info.width, size), info.levels - 1));
      await mkdir(join(packDir, 'tex'), { recursive: true });
      await writeFile(join(packDir, 'tex', `${slug}.${size}.ktx2`), out);
    }
    console.log(`fetched: ${kind.padEnd(8)} ${name} → tex/${slug}`);
  }
  const out = { source: `web/${DUMP}`, families, meshes, maps, tex };
  const text = `${JSON.stringify(out)}\n`;
  await writeFile(join(packDir, 'recipes.json'), text);
  const have = Object.values(maps).filter(Boolean).length;
  console.log(`recipes.json: ${(text.length / 1e6).toFixed(2)} MB; maps ${have} of ${wanted.length} in the pack, ${missing} missing from the bucket`);
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

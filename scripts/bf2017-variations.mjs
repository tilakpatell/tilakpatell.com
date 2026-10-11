// A level pack's variations.json: the game's own colour-to-texture map for
// the pack's meshes (lane colour: docs/superpowers/plans/
// 2026-10-10-bf2017-accuracy-lane-colour.md, task 2). Reads the level's
// MeshVariationDatabase records (its own and every sub-level's), the
// ObjectVariation records they name, the map's static groups and the level
// records' members (each instance's variation), and writes
// public/models/galaxy/bf2017/levels/<world>/variations.json and a
// "Variations" table in the pack's README.
//
//   node scripts/bf2017-variations.mjs <world> [--fetch]
//
//   fetch  take each texture an applied variation binds apart from the
//          mesh's default into the pack's tex/ at the tier's sizes (else
//          only the maps the pack already has are named, the rest null)
//
// The records come from the bucket into lab/assets/bf2017/ (SUPABASE_URL and
// SUPA_KEY or BF2017_KEY; NODE_USE_ENV_PROXY=1 behind a proxy).

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { parseArgs } from './lib/args.mjs';
import { instanceUse, variationsOf } from './lib/bf2017-variations.mjs';
import { dropMips, ktx2Info, mipsToFit } from './lib/ktx2-mips.mjs';
import { CACHE, dataIndex, records } from './bf2017-shader-names.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TIERS = ['low', 'mid', 'high', 'ultra'];
// a colour or mask map spans the thing once: Q1's MASK_SIZE (scripts/bf2017-recipes.mjs)
const SIZE = { low: 256, mid: 512, high: 512, ultra: 1024 };
const lastOf = (p) => p.split('/').pop();
const slugOf = (ktx2) => lastOf(ktx2).replace(/\.ktx2$/, '');

async function writeSizes(buf, dir, slug) {
  const info = ktx2Info(buf);
  const row = {};
  const written = new Set();
  await mkdir(dir, { recursive: true });
  for (const tier of TIERS) {
    const size = Math.min(SIZE[tier], info.width);
    row[tier] = size;
    if (written.has(size)) continue;
    written.add(size);
    await writeFile(join(dir, `${slug}.${size}.ktx2`), dropMips(buf, Math.min(mipsToFit(info.width, size), info.levels - 1)));
  }
  return row;
}

// every texture name the MVDB records bind, for the bucket's listing
function texturesNamed(mvdbs) {
  const out = new Set();
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    if (n.$assetType === 'TextureAsset' && n.$asset) out.add(n.$asset);
    Object.values(n).forEach(walk);
  };
  mvdbs.forEach((m) => walk(m.record));
  return out;
}

async function bucketListing(env, listFolder, names) {
  const folders = new Map();
  const has = async (path) => {
    const dir = `web/${path.slice(0, path.lastIndexOf('/'))}`;
    if (!folders.has(dir))
      folders.set(
        dir,
        listFolder(env, `${dir}/`)
          .then((n) => new Set(n))
          .catch(() => new Set()),
      );
    return (await folders.get(dir)).has(lastOf(path));
  };
  const found = new Set();
  await Promise.all(
    [...names].map(async (name) => {
      const base = `textures/${name.toLowerCase()}`;
      for (const p of [`${base}.ktx2`, `${base}__normal.ktx2`]) if (await has(p)) found.add(p);
    }),
  );
  return found;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const world = args._[0];
  if (!world) {
    console.error('usage: node scripts/bf2017-variations.mjs <world> [--fetch]');
    process.exit(2);
  }
  const packDir = join(ROOT, 'public/models/galaxy/bf2017/levels', world);
  const pack = JSON.parse(await readFile(join(packDir, 'level.json'), 'utf8'));
  const level = pack.map; // levels/mp/hoth_01
  const own = lastOf(level).toLowerCase();
  const { fetchData, getObject, keys, listFolder } = await import('./bf2017-fetch.mjs');
  const env = keys();
  const mapBase = `web/maps/${level}/${lastOf(level)}.json`;
  if (!existsSync(join(CACHE, mapBase))) await getObject(env, CACHE, mapBase);
  const map = JSON.parse(await readFile(join(CACHE, mapBase), 'utf8'));
  // (data.tsv lower-cases a level's record names; the bucket keeps their
  // case, which the map's sub-world names carry)
  const cased = String(map.subworlds[0]?.name ?? map.subworlds[0])
    .split('/')
    .slice(0, -1)
    .join('/');
  const found = (await fetchData(env, CACHE, [`${cased}/**/MeshVariationDb_Win32`])).filter((r) => r.file?.endsWith('MeshVariationDb_Win32.json.gz') && existsSync(r.file));
  const mvdbs = await Promise.all(found.map(async (r) => ({ sub: r.file.split('/').at(-2), record: JSON.parse(gunzipSync(await readFile(r.file)).toString('utf8')) })));
  // (the level's own first: its defaults do not count against the rule)
  mvdbs.sort((a, b) => (a.sub.toLowerCase() === own ? -1 : b.sub.toLowerCase() === own ? 1 : a.sub.localeCompare(b.sub)));
  const mvdbNames = mvdbs.map((m) => m.record.name);
  const index = await dataIndex();
  const variationRecords = [...(await records(index.filter((r) => r.type === 'ObjectVariation').map((r) => r.name))).values()];
  console.log(`${level}: ${mvdbs.length} variation databases, ${variationRecords.length} object variations`);
  const listed = await bucketListing(env, listFolder, texturesNamed(mvdbs));

  // each instance's variation: the map's static groups against the level records' members
  const names = new Map();
  for (const r of variationRecords) {
    const head = r.objects?.find((o) => o.$type === 'ObjectVariation');
    if (head?.NameHash != null) names.set(head.NameHash, lastOf(head.Name));
  }
  const subRecords = await records(map.subworlds.map((s) => s.name ?? s));
  const members = {};
  map.subworlds.forEach((s, i) => {
    const rec = subRecords.get(s.name ?? s);
    members[i] = (rec?.objects ?? []).filter((o) => o.$type === 'StaticModelGroupEntityData').flatMap((o) => o.MemberDatas ?? []);
  });
  const { instances, byMesh } = instanceUse({ groups: map.groups, meshes: map.meshes, members, names });

  const all = variationsOf({ mvdbs, variations: variationRecords, listing: (p) => listed.has(p), use: byMesh });
  // the pack's meshes only
  const meshes = {};
  for (const m of pack.meshes) {
    const key = m.name
      .replace(/^models\//, '')
      .replace(/\.glb$/, '')
      .toLowerCase();
    if (all.meshes[key]) meshes[key] = all.meshes[key];
  }
  const rows = Object.values(meshes);
  const counts = {
    meshes: rows.length,
    withVariations: rows.filter((r) => Object.keys(r.variations).length).length,
    byInstances: rows.filter((r) => r.by === 'instances').length,
    byRule: rows.filter((r) => r.by === 'rule').length,
    mixed: rows.filter((r) => r.by === 'mixed').length,
  };

  // the maps an applied variation binds apart from its mesh's default, in the pack
  const old = existsSync(join(packDir, 'variations.json')) ? JSON.parse(await readFile(join(packDir, 'variations.json'), 'utf8')) : null;
  const have = { ...(pack.tex ?? {}), ...(old?.tex ?? {}) };
  const maps = {};
  const tex = {};
  for (const r of rows.filter((x) => x.use)) {
    r.variations[r.use].materials.forEach((m, i) => {
      // (the default's textures whatever slot names them: the GLB wears those)
      const def = new Set(Object.values(r.default?.[i]?.textures ?? {}));
      for (const path of Object.values(m.textures)) if (path && !def.has(path)) maps[path] = null;
    });
  }
  for (const path of Object.keys(maps)) {
    const slug = slugOf(path);
    if (have[slug]) {
      maps[path] = `tex/${slug}.ktx2`;
      if (old?.tex?.[slug]) tex[slug] = old.tex[slug];
      continue;
    }
    if (!args.fetch) continue;
    const got = await getObject(env, CACHE, `web/${path}`);
    if (got.state !== 'fetched' && got.state !== 'kept') continue;
    tex[slug] = await writeSizes(await readFile(got.file), join(packDir, 'tex'), slug);
    maps[path] = `tex/${slug}.ktx2`;
    console.log(`fetched: ${path} → tex/${slug}`);
  }
  const missingInPack = Object.values(maps).filter((v) => !v).length;
  const out = {
    format: 1,
    level,
    _source: { mvdb: mvdbNames, map: mapBase, variations: 'data.tsv ObjectVariation' },
    counts: { ...counts, missingTextures: all.missing.length, mapsNotInPack: missingInPack },
    meshes,
    maps,
    tex,
    instances,
    missing: all.missing,
  };
  const text = `${JSON.stringify(out)}\n`;
  await writeFile(join(packDir, 'variations.json'), text);

  const readme = join(packDir, 'README.md');
  if (existsSync(readme)) {
    const table = [
      '## Variations',
      '',
      `Written by \`node scripts/bf2017-variations.mjs ${world}\` from the level's ${mvdbs.length} mesh variation databases (variations.json, ${(text.length / 1e6).toFixed(2)} MB).`,
      '',
      '| meshes | with variations | applied by instances | by the level rule | mixed (default drawn) | textures missing from the bucket | maps not in the pack |',
      '|---|---|---|---|---|---|---|',
      `| ${counts.meshes} | ${counts.withVariations} | ${counts.byInstances} | ${counts.byRule} | ${counts.mixed} | ${all.missing.length} | ${missingInPack} |`,
      '',
    ].join('\n');
    const body = await readFile(readme, 'utf8');
    const cut = body.indexOf('## Variations');
    const next = cut < 0 ? -1 : body.indexOf('\n## ', cut + 1);
    const updated = cut < 0 ? `${body.trimEnd()}\n\n${table}` : `${body.slice(0, cut)}${table}${next < 0 ? '' : body.slice(next + 1)}`;
    await writeFile(readme, updated);
  }
  console.log(JSON.stringify(out.counts));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();

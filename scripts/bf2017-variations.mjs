// A level pack's variations.json: the game's own colour-to-texture map for
// its meshes, from the level's mesh variation databases and the object
// variations they name (scripts/lib/bf2017-variations.mjs; the colour lane's
// task 2). No network: the records come from the drop fetched ahead into
// lab/assets/bf2017/ (git-ignored). The bucket keys the databases with their
// case, so they are fetched by folder, never by data.tsv's lower-cased path:
//
//   NODE_USE_ENV_PROXY=1 node --env-file=.env.local scripts/bf2017-fetch.mjs --folder 'data/Levels/MP/Hoth_01/<sub>/MeshVariationDb*'
//   NODE_USE_ENV_PROXY=1 node --env-file=.env.local scripts/bf2017-fetch.mjs data type:ObjectVariation type:SurfaceShaderPreset
//   NODE_USE_ENV_PROXY=1 node --env-file=.env.local scripts/bf2017-fetch.mjs --raw materials.jsonl
//   node scripts/bf2017-variations.mjs <world>… [--root lab/assets/bf2017] [--dry]
//   NODE_USE_ENV_PROXY=1 node --env-file=.env.local scripts/bf2017-variations.mjs <world>… --fetch
//
// --fetch adds to the pack the maps a chosen variation swaps to that it has
// not got: each KTX2 as the bucket encoded it, its mips dropped to the sizes
// the map it replaces takes (tex/<slug>.<size>.ktx2) and stamped by the
// game's word (ktx2-colour.mjs), sized in variations.json's own `tex` rows
// so level.json is left as its builder wrote it. A later run keeps the rows
// whose files are there.
//
// The databases read are the pack's own: the level's and the sub-levels its
// README's command took (`--subs`), else the ones scripts/bf2017-level.mjs
// takes by default (mainSubs: the level's own, Content, Shared_Art, Sunny). Writes public/models/galaxy/bf2017/
// levels/<world>/variations.json and a "Variations" table in its README.

import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { gunzipSync } from 'node:zlib';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { getObject, keys } from './bf2017-fetch.mjs';
import { mainSubs } from './lib/bf2017-level.mjs';
import { loadGameWord, wantedTransfer, withTransfer } from './lib/ktx2-colour.mjs';
import { dropMips, ktx2Info, mipsToFit } from './lib/ktx2-mips.mjs';
import { variationsOf } from './lib/bf2017-variations.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const LEVELS = join(ROOT, 'public', 'models', 'galaxy', 'bf2017', 'levels');

function walk(dir, test, out = []) {
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, test, out);
    else if (test(f, p)) out.push(p);
  }
  return out;
}

export const readRecord = (file) => JSON.parse((file.endsWith('.gz') ? gunzipSync(readFileSync(file)) : readFileSync(file)).toString('utf8'));
export const meshKey = (name) => String(name).toLowerCase().replace(/^models\//, '').replace(/\.glb$/, '');

// the sub-levels the pack was built from: its README's --subs, else the level builder's own default
export function subsOf(readme, map) {
  const m = /--subs\s+([^\s`]+)/.exec(readme ?? '');
  return (m ? m[1].split(',') : mainSubs({ name: map })).map((s) => s.toLowerCase());
}

// the pack's level folder in the cache (the bucket's case) and its databases there
export function databases(root, map, subs) {
  const want = `data/${map}`.toLowerCase();
  const dirs = walk(join(root, 'data', 'Levels'), (f) => /^MeshVariationDb/i.test(f)).map((p) => relative(root, p).split('\\').join('/'));
  return dirs.filter((p) => {
    const parts = p.split('/');
    return parts.slice(0, -2).join('/').toLowerCase() === want && subs.includes(parts.at(-2).toLowerCase());
  });
}

export async function materialRows(file, keys) {
  const rows = new Map();
  const lines = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of lines) {
    const k = /"mesh":"([^"]+)"/.exec(line)?.[1];
    if (k && keys.has(k.toLowerCase())) rows.set(k.toLowerCase(), JSON.parse(line));
  }
  return rows;
}

function readmeSection(out, dbs) {
  const c = out.counts;
  const ruled = Object.entries(out.rule).slice(0, 12);
  return [
    '## Variations',
    '',
    `Written beside level.json by \`node scripts/bf2017-variations.mjs\` (the colour lane) from the level's mesh variation databases (${dbs.map((d) => `\`${d.split('/').at(-2)}\``).join(', ')}) and the object variations they name; the level loader applies them through the game material.`,
    '',
    '| meshes | in a database | with variations | variations | rule-decided | missing textures |',
    '|---|---|---|---|---|---|',
    `| ${c.meshes} | ${c.inMvdb} | ${c.withVariations} | ${c.variations} | ${c.ruled} | ${c.missing} |`,
    '',
    ruled.length ? `The level's own rule decided${c.ruled > ruled.length ? ` (the first ${ruled.length} of ${c.ruled})` : ''}: ${ruled.map(([m, v]) => `\`${m.split('/').pop()}\` → \`${v.split('/').pop()}\``).join(', ')}.` : "The level's own rule decided nothing: no mesh has one variation alone.",
    '',
  ].join('\n');
}

// the maps the swaps want, fetched and written beside the pack's own; their rows
async function fetchMaps(root, dir, sizes, list) {
  const env = keys();
  const word = loadGameWord(root);
  const rows = {};
  for (const w of list) {
    const r = await getObject(env, root, w.file);
    if (r.state !== 'fetched' && r.state !== 'kept') {
      console.log(`  not in the bucket: ${w.file}`);
      continue;
    }
    const buf = readFileSync(r.file);
    const info = ktx2Info(buf);
    const want = wantedTransfer(w.file, { word });
    const row = {};
    mkdirSync(join(dir, 'tex'), { recursive: true });
    for (const [tier, size] of Object.entries(sizes[w.like] ?? {})) {
      if (typeof size !== 'number') continue;
      row[tier] = Math.min(size, info.width);
      const file = join(dir, 'tex', `${w.slug}.${row[tier]}.ktx2`);
      if (!existsSync(file)) writeFileSync(file, withTransfer(dropMips(buf, Math.min(mipsToFit(info.width, row[tier]), info.levels - 1)), want ?? 'linear'));
    }
    if (want) row.srgb = want === 'srgb';
    rows[w.slug] = row;
    console.log(`  added ${w.slug} (${Object.entries(row).map(([k, v]) => `${k} ${v}`).join(', ')})`);
  }
  return rows;
}

// a row a past run added whose files are still there
const onDisk = (dir, rows) => Object.fromEntries(Object.entries(rows ?? {}).filter(([slug, row]) => Object.values(row).every((v) => typeof v !== 'number' || existsSync(join(dir, 'tex', `${slug}.${v}.ktx2`)))));

export function withSection(readme, section) {
  const at = readme.indexOf('## Variations');
  if (at < 0) return `${readme.replace(/\n*$/, '\n\n')}${section}`;
  const next = readme.indexOf('\n## ', at + 3);
  return `${readme.slice(0, at)}${section}${next < 0 ? '' : `\n${readme.slice(next + 1)}`}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(args.root ?? join(ROOT, 'lab', 'assets', 'bf2017'));
  const materialsFile = join(root, 'web', 'materials.jsonl');
  if (!existsSync(materialsFile)) {
    console.error(`No materials.jsonl under ${root}: node --env-file=.env.local scripts/bf2017-fetch.mjs --raw materials.jsonl`);
    process.exit(2);
  }
  const records = walk(join(root, 'data'), (f) => f.endsWith('.json.gz') && !/^MeshVariationDb/i.test(f))
    .map((p) => {
      try {
        return readRecord(p);
      } catch {
        return null;
      }
    })
    .filter((r) => r?.type === 'ObjectVariation');
  for (const world of args._) {
    const dir = join(LEVELS, world);
    const pack = JSON.parse(readFileSync(join(dir, 'level.json'), 'utf8'));
    const readme = existsSync(join(dir, 'README.md')) ? readFileSync(join(dir, 'README.md'), 'utf8') : '';
    const recipes = existsSync(join(dir, 'recipes.json')) ? JSON.parse(readFileSync(join(dir, 'recipes.json'), 'utf8')) : null;
    const dbs = databases(root, pack.map, subsOf(readme, pack.map));
    if (!dbs.length) {
      console.error(`${world}: no mesh variation database of ${pack.map} in ${relative(ROOT, root)}: fetch its folders first (--folder 'data/<Level>/<sub>/MeshVariationDb*').`);
      process.exitCode = 2;
      continue;
    }
    // (the meshes the pack draws: one with no LOD file is listed, never drawn)
    const meshes = pack.meshes.filter((m) => (m.glb ?? []).some(Boolean)).map((m) => meshKey(m.name));
    const sizes = { ...(pack.tex ?? {}), ...(recipes?.tex ?? {}) };
    const before = existsSync(join(dir, 'variations.json')) ? JSON.parse(readFileSync(join(dir, 'variations.json'), 'utf8')) : null;
    let tex = onDisk(dir, before?.tex);
    const input = {
      mvdbs: dbs.map((p) => ({ path: p.replace(/\.gz$/, ''), record: readRecord(join(root, p)) })),
      records,
      materials: await materialRows(materialsFile, new Set(meshes)),
      meshes,
    };
    let { fetch, ...out } = variationsOf({ ...input, slugs: [...Object.keys(sizes), ...Object.keys(tex)] });
    if (args.fetch && fetch.length && !args.dry) {
      tex = { ...tex, ...(await fetchMaps(root, dir, sizes, fetch)) };
      ({ fetch, ...out } = variationsOf({ ...input, slugs: [...Object.keys(sizes), ...Object.keys(tex)] }));
    }
    if (Object.keys(tex).length) out.tex = tex;
    const c = out.counts;
    console.log(`${world}: ${dbs.length} databases; ${c.meshes} meshes, ${c.inMvdb} in a database, ${c.withVariations} with variations (${c.variations}), ${c.ruled} decided by the level's rule, ${c.missing} textures missing${fetch.length ? `, ${fetch.length} swapped-to maps to fetch (--fetch)` : ''}${out.tex ? `, ${Object.keys(out.tex).length} added` : ''}`);
    if (args.dry) continue;
    writeFileSync(join(dir, 'variations.json'), `${JSON.stringify(out)}\n`);
    if (readme) writeFileSync(join(dir, 'README.md'), withSection(readme, readmeSection(out, dbs)));
  }
}

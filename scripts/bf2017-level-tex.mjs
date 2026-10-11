// A level pack's textures the bucket had not got when the pack was built,
// fetched now it has them (scripts/lib/bf2017-level-tex.mjs): each map a
// pack GLB names that level.json's `tex` lacks, from beside its source map
// in the bucket, written as the factory writes its own (tex/<slug>.<size>.ktx2,
// sized for its biggest wearer by lod.js's texSizeFor, told its colour space)
// and given its row; nothing else in the pack changes, so only the new maps
// are published (scripts/assets-publish.mjs --only '…/<pack>/tex/*').
// Theed's far LODs (M_LowerLODs_01, simplewindow) drew white for want of the
// facades' atlases this way.
//
//   NODE_USE_ENV_PROXY=1 node scripts/bf2017-level-tex.mjs <pack> [--dry]
//
//   pack  the pack's folder under public/models/galaxy/bf2017/levels/ (naboo/market)
//   dry   say what is missing and where it would come from; write nothing
//
// The pack's GLBs are read from public/ when they are there, else from the
// published site (src/data/galaxyAssets.json, SUPABASE_URL's site-assets);
// the drop's texture index is lab/assets/bf2017/web/textures.jsonl (fetched:
// `node scripts/bf2017-fetch.mjs --raw textures.jsonl`). The keys
// (SUPABASE_URL and BF2017_KEY, or SUPA_KEY in a cloud session) come from the
// environment.

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getObject, keys } from './bf2017-fetch.mjs';
import { parseArgs } from './lib/args.mjs';
import { glbJson } from './lib/bf2017-paths.mjs';
import { bucketPathOf, texGaps, textureDirs } from './lib/bf2017-level-tex.mjs';
import { ktx2Info, dropMips, mipsToFit } from './lib/ktx2-mips.mjs';
import { loadGameWord, wantedTransfer, withTransfer } from './lib/ktx2-colour.mjs';
import { texSizeFor } from '../src/lib/level/lod.js';
import { remotePath } from '../src/lib/assetPath.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'lab', 'assets', 'bf2017');
const HAVE = new Set(['fetched', 'kept']);

async function main(args) {
  const [packId] = args._;
  if (!packId) {
    console.error('usage: node scripts/bf2017-level-tex.mjs <pack> [--dry]');
    process.exit(1);
  }
  const rel = `models/galaxy/bf2017/levels/${packId}`;
  const out = join(ROOT, 'public', rel);
  const json = JSON.parse(await readFile(join(out, 'level.json'), 'utf8'));
  const indexFile = join(CACHE, 'web', 'textures.jsonl');
  if (!existsSync(indexFile)) {
    console.error(`No texture index at ${indexFile}: run node scripts/bf2017-fetch.mjs --raw textures.jsonl first.`);
    process.exit(2);
  }
  const index = textureDirs((await readFile(indexFile, 'utf8')).split('\n').filter(Boolean).map((l) => JSON.parse(l)));

  // the pack's GLBs: on disk, else as published
  const manifest = JSON.parse(await readFile(join(ROOT, 'src/data/galaxyAssets.json'), 'utf8'));
  const base = process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/site-assets` : null;
  const glbs = new Map();
  const paths = [...new Set(json.meshes.flatMap((m) => (m.glb ?? []).filter(Boolean)))];
  for (let i = 0; i < paths.length; i += 16)
    await Promise.all(
      paths.slice(i, i + 16).map(async (p) => {
        const local = join(out, p);
        let buf = existsSync(local) ? await readFile(local) : null;
        if (!buf && base && manifest[`${rel}/${p}`]) {
          const res = await fetch(remotePath(`${rel}/${p}`, base, manifest));
          if (res.ok) buf = Buffer.from(await res.arrayBuffer());
        }
        if (buf) glbs.set(p, glbJson(buf));
      }),
    );
  console.log(`${packId}: ${glbs.size} of ${paths.length} GLBs read`);

  const gaps = texGaps(json.meshes, (p) => glbs.get(p) ?? null, json.tex);
  const env = keys();
  const word = loadGameWord(CACHE);
  const tiers = Object.keys(Object.values(json.tex)[0] ?? { low: 0, mid: 0, high: 0 }).filter((k) => k !== 'srgb');
  const rows = {};
  const still = [];
  for (const [slug, gap] of [...gaps].sort((a, b) => a[0].localeCompare(b[0]))) {
    const at = bucketPathOf(slug, gap.dirs, index);
    const got = at ? await getObject(env, CACHE, `web/${at}`) : null;
    if (!got || !HAVE.has(got.state)) {
      still.push(slug);
      console.log(`missing: ${slug}${at ? '' : ' (no folder for it)'} — worn by ${gap.materials.join(', ')}`);
      continue;
    }
    if (args.dry) {
      console.log(`there:   ${slug} ← web/${at} (r ${gap.radius}; ${gap.materials.join(', ')})`);
      continue;
    }
    const buf = await readFile(got.file);
    const info = ktx2Info(buf);
    const row = {};
    const want = wantedTransfer(slug, { word });
    if (want) row.srgb = want === 'srgb';
    const written = new Set();
    await mkdir(join(out, 'tex'), { recursive: true });
    for (const tier of tiers) {
      const size = Math.min(texSizeFor(gap.radius || 1, tier, /__(normal|orm)/.test(slug)), info.width);
      row[tier] = size;
      if (written.has(size)) continue;
      written.add(size);
      await writeFile(join(out, 'tex', `${slug}.${size}.ktx2`), withTransfer(dropMips(buf, Math.min(mipsToFit(info.width, size), info.levels - 1)), want ?? 'linear'));
    }
    rows[slug] = row;
    console.log(`fetched: ${slug} ← web/${at} (${tiers.map((t) => row[t]).join('/')}; ${gap.materials.join(', ')})`);
  }
  console.log(`${gaps.size} maps the GLBs name and level.json lacks: ${Object.keys(rows).length} fetched, ${still.length} still not in the bucket`);
  if (args.dry || !Object.keys(rows).length) return;
  // (the rows in the factory's order: sorted by slug)
  json.tex = Object.fromEntries(Object.entries({ ...json.tex, ...rows }).sort((a, b) => a[0].localeCompare(b[0])));
  await writeFile(join(out, 'level.json'), `${JSON.stringify(json)}\n`);
  const readme = join(out, 'README.md');
  if (existsSync(readme)) await writeFile(readme, (await readFile(readme, 'utf8')).replace(/- textures missing from the bucket: \d+/, `- textures missing from the bucket: ${still.length}`));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main(parseArgs(process.argv.slice(2)));

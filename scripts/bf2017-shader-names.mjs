// The shader depots' parameter names, as a dictionary the site keeps (lane
// colour: docs/superpowers/plans/2026-10-10-bf2017-accuracy-lane-colour.md,
// task 1). Every name the export spells out (the material dump's keys, the
// object variations' parameter names, the shader presets' parameters) by
// its djb2-xor hash (scripts/lib/bf2017-shader-names.mjs); with --depots,
// the desktop's depot probe resolved against it and the share by count.
//
//   node scripts/bf2017-shader-names.mjs [--depots <maps_work/shaderdepots.jsonl>] [--out src/data/bf2017/shaderParams.json]
//
// In the cloud the records come from the bucket (web/materials.jsonl and the
// ObjectVariation and SurfaceShaderPreset records data.tsv lists, into
// lab/assets/bf2017/); the depots are the desktop's (not in the bucket).

import { createReadStream, existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createGunzip, gunzipSync } from 'node:zlib';
import { parseArgs } from './lib/args.mjs';
import { hashName, namesFrom, resolveDepot } from './lib/bf2017-shader-names.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE = join(ROOT, 'lab/assets/bf2017');

// data.tsv's rows: name, type, path, bytes
export async function dataIndex() {
  const { getObject, keys } = await import('./bf2017-fetch.mjs');
  const file = join(CACHE, 'data.tsv');
  if (!existsSync(file)) await getObject(keys(), CACHE, 'data.tsv');
  return (await readFile(file, 'utf8'))
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [name, type, path, bytes] = l.split('\t');
      return { name, type, path, bytes: Number(bytes) };
    });
}

// records by name (data/<name>.json.gz), fetched once into the cache, read
// whole; a record the bucket lacks is left out
export async function records(names, { pool = 16 } = {}) {
  const { getObject, keys } = await import('./bf2017-fetch.mjs');
  const env = keys();
  const out = new Map();
  const queue = [...new Set(names)];
  await Promise.all(
    Array.from({ length: pool }, async () => {
      while (queue.length) {
        const name = queue.shift();
        const path = `data/${name}.json.gz`;
        const local = join(CACHE, path);
        if (!existsSync(local)) await getObject(env, CACHE, path).catch(() => null);
        if (existsSync(local)) out.set(name, JSON.parse(gunzipSync(await readFile(local)).toString('utf8')));
      }
    }),
  );
  return out;
}

export async function webFile(path) {
  const local = join(CACHE, 'web', path);
  if (!existsSync(local)) {
    const { getObject, keys } = await import('./bf2017-fetch.mjs');
    await getObject(keys(), CACHE, `web/${path}`);
  }
  return local;
}

async function* lines(file) {
  const input = file.endsWith('.gz') ? createReadStream(file).pipe(createGunzip()) : createReadStream(file);
  for await (const l of createInterface({ input, crlfDelay: Infinity })) if (l.trim()) yield l;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const out = args.out ?? join(ROOT, 'src/data/bf2017/shaderParams.json');
  const materials = [];
  for await (const l of lines(await webFile('materials.jsonl'))) materials.push(JSON.parse(l));
  const index = await dataIndex();
  const of = (type) => index.filter((r) => r.type === type).map((r) => r.name);
  const variations = [...(await records(of('ObjectVariation'))).values()];
  const presets = [...(await records(of('SurfaceShaderPreset'))).values()];
  const names = namesFrom({ materials, variations, presets });
  const dict = Object.fromEntries([...names].sort().map((n) => [n, hashName(n)]));
  const result = {
    format: 1,
    source: {
      materials: 'web/materials.jsonl',
      variations: variations.length,
      presets: presets.length,
    },
    names: dict,
    depots: null,
    unresolved: {},
    resolvedShare: null,
  };
  if (args.depots) {
    const rows = [];
    for await (const l of lines(args.depots)) rows.push(JSON.parse(l));
    const r = resolveDepot(rows, names);
    const total = r.resolved + Object.values(r.unresolved).reduce((a, b) => a + b, 0);
    result.depots = {
      file: args.depots,
      rows: rows.length,
      params: total,
      resolved: r.resolved,
    };
    result.unresolved = Object.fromEntries(Object.entries(r.unresolved).sort((a, b) => b[1] - a[1]));
    result.resolvedShare = total ? Math.round((r.resolved / total) * 1e4) / 1e4 : null;
  }
  await writeFile(out, `${JSON.stringify(result, null, 1)}\n`);
  console.log(
    `names ${names.size} (materials ${materials.length} rows, variations ${variations.length}, presets ${presets.length}) → ${out}${result.depots ? `; depots resolved ${result.resolvedShare}` : '; depots: run on the desktop with --depots'}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();

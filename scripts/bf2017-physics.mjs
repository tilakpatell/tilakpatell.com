// The game's collision shapes into a level pack (lane P0 of the physics
// design): every mesh the pack places that has a physics asset gets
// `physics/<mesh>.bin` (its shapes once, in the mesh's frame:
// scripts/lib/bf2017-physics.mjs), and `level.json` a `physics` section
// { version, materials, meshes: { <mesh index>: { name, file, hulls,
// meshTriangles, capsules, spheres, colliders, bounds, partCount, bytes } },
// cells: { "cx,cz": { colliders, instances, triangles } } }. The pack's own
// cell bins already place every instance (lane L's), so no transform is
// stored twice: a cell's colliders are its draws' meshes' shapes.
//
//   node --env-file=.env.local scripts/bf2017-physics.mjs <pack dir> [--from <web_opt>] [--dry]
//   node --env-file=.env.local scripts/bf2017-physics.mjs --map levels/mp/hoth_01 [--from <web_opt>] [--cell 128]
//
//   pack dir  a level pack: level.json with `meshes` ([{ file | source }],
//             the map's model files) and `cells` ({ key: { draws: [{ mesh,
//             count }] } })
//   map       no pack: the table for a map as it stands (every instance,
//             in 128 m cells), nothing written
//   from      the export's web_opt folder on this machine (or BF2017_EXPORT);
//             else the bucket, cached under lab/assets/bf2017/
//   dry       read and count, write nothing
//
// It prints a table (meshes with shapes, hulls, mesh triangles, capsules,
// dropped, bytes, the ten heaviest cells) and, unless dry, writes it into
// the pack's README.md between physics markers.

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { cellIndex, packShapes, physicsKey, readPhysicsGlb, summarise } from './lib/bf2017-physics.mjs';
import { objectUrl } from './lib/bf2017-paths.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'lab', 'assets', 'bf2017');
const BUCKET = 'bf2017-assets';

// A file of the web build, from the export on this machine or the bucket
// (kept in the cache after).
function source(from) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.BF2017_KEY || process.env.SUPA_KEY;
  return async function get(path) {
    if (from) {
      const f = join(from, path);
      return existsSync(f) ? readFile(f) : null;
    }
    const cached = join(CACHE, 'web', path);
    if (existsSync(cached)) return readFile(cached);
    if (!base || !key) throw new Error('Set SUPABASE_URL and BF2017_KEY (or SUPA_KEY), or pass --from <web_opt>.');
    const res = await fetch(objectUrl(base, BUCKET, `web/${path}`), { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) return null;
    const body = Buffer.from(await res.arrayBuffer());
    await mkdir(dirname(cached), { recursive: true });
    await writeFile(cached, body);
    return body;
  };
}

async function records(get) {
  const text = await get('physics.jsonl');
  if (!text) throw new Error('No physics.jsonl in the source.');
  const out = new Map();
  for (const line of text.toString('utf8').split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    if (r.status === 'ok' || !r.status) out.set(r.res, r);
  }
  return out;
}

const slug = (name) =>
  name
    .split('/')
    .pop()
    .replace(/_Physics_Win32$/i, '')
    .toLowerCase();

// Every mesh's shapes, read once.
async function readMeshes(meshes, get, recs, from) {
  const out = {};
  const bins = {};
  const names = new Set();
  const dropped = [];
  for (let i = 0; i < meshes.length; i++) {
    const file = meshes[i].source ?? meshes[i].file ?? meshes[i].name;
    const rec = recs.get(physicsKey(file));
    if (!rec) continue;
    // (a flat folder of GLBs, the fixtures', by the file's own name)
    const buf = (await get(rec.glb ?? `physics/${rec.name}.glb`)) ?? (from ? await get(`${rec.name.split('/').pop()}.glb`) : null);
    if (!buf) {
      dropped.push({ mesh: i, why: 'not in the source yet' });
      continue;
    }
    const { shapes, dropped: gone } = await readPhysicsGlb(buf, rec);
    for (const d of gone) dropped.push({ mesh: i, ...d });
    if (!shapes.length) continue;
    let name = slug(rec.name);
    if (names.has(name)) name = `${name}-${i}`;
    names.add(name);
    const bin = packShapes(shapes);
    bins[i] = { file: `physics/${name}.bin`, bin };
    out[i] = { bytes: bin.byteLength, file: `physics/${name}.bin`, name: rec.name, ...summarise(shapes), materials: [...new Set(shapes.map((s) => s.material))] };
  }
  return { meshes: out, bins, dropped };
}

// A map's instances as 128 m cells of draws (for --map: what a pack would hold).
async function mapCells(map, get, cell) {
  const json = JSON.parse((await get(`maps/${map}/${map.split('/').pop()}.json`)).toString('utf8'));
  const bin = await get(`maps/${map}/${json.bin.file}`);
  const buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
  const P = new Float32Array(buf, json.bin.position, 3 * json.bin.count);
  const cells = {};
  for (const g of json.groups) {
    if (g.kind === 'actor') continue;
    for (let i = g.offset; i < g.offset + g.count; i++) {
      const key = `${Math.floor(P[i * 3] / cell)},${Math.floor(P[i * 3 + 2] / cell)}`;
      const draws = (cells[key] ??= { draws: [] }).draws;
      const d = draws.find((x) => x.mesh === g.mesh);
      if (d) d.count++;
      else draws.push({ mesh: g.mesh, count: 1 });
    }
  }
  return { meshes: json.meshes, cells };
}

function table({ meshes, dropped, cells }) {
  const list = Object.values(meshes);
  const sum = (k) => list.reduce((a, m) => a + m[k], 0);
  const heavy = Object.entries(cells)
    .sort((a, b) => b[1].colliders - a[1].colliders)
    .slice(0, 10);
  const lines = [
    '| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    `| ${list.length} | ${sum('hulls')} | ${sum('meshTriangles')} | ${sum('capsules')} | ${sum('spheres')} | ${dropped.length} | ${sum('bytes')} |`,
    '',
    '| heaviest cells | colliders | trimesh triangles |',
    '| --- | --- | --- |',
    ...heavy.map(([k, c]) => `| ${k} | ${c.colliders} | ${c.triangles} |`),
  ];
  return lines.join('\n');
}

const sorted = (v) =>
  Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const from = typeof args.from === 'string' ? args.from : process.env.BF2017_EXPORT || null;
  const get = source(from);
  const recs = await records(get);
  const cell = Number(args.cell) || 128;
  const [dir] = args._;
  let pack = null;
  let meshesIn;
  let cellsIn;
  if (args.map) {
    ({ meshes: meshesIn, cells: cellsIn } = await mapCells(String(args.map), get, cell));
  } else if (dir) {
    pack = JSON.parse(await readFile(join(dir, 'level.json'), 'utf8'));
    meshesIn = pack.meshes ?? [];
    cellsIn = pack.cells ?? {};
  } else {
    console.error('usage: node --env-file=.env.local scripts/bf2017-physics.mjs <pack dir> [--from <web_opt>] [--dry] | --map <levels/mp/hoth_01> [--cell 128]');
    process.exit(1);
  }
  const { meshes, bins, dropped } = await readMeshes(meshesIn, get, recs, from);
  const cells = cellIndex(cellsIn, meshes);
  const report = table({ meshes, dropped, cells });
  console.log(report);
  const why = {};
  for (const d of dropped) why[d.why] = (why[d.why] ?? 0) + 1;
  if (dropped.length) console.log('\ndropped:', JSON.stringify(why));
  if (!pack || args.dry) return;

  const materials = {};
  for (const m of Object.values(meshes)) for (const i of m.materials) materials[i] = { tag: i };
  for (const m of Object.values(meshes)) delete m.materials;
  pack.physics = sorted({ cells, materials, meshes, version: 1 });
  await mkdir(join(dir, 'physics'), { recursive: true });
  for (const { file, bin } of Object.values(bins)) await writeFile(join(dir, file), Buffer.from(bin));
  // (compact, and the pack's own key order kept: only the physics section is sorted)
  await writeFile(join(dir, 'level.json'), JSON.stringify(pack) + '\n');
  const readme = join(dir, 'README.md');
  const old = existsSync(readme) ? await readFile(readme, 'utf8') : '';
  const block = `<!-- physics -->\n## Physics\n\nThe game's shapes (\`node scripts/bf2017-physics.mjs\`).\n\n${report}\n<!-- /physics -->`;
  const next = /<!-- physics -->[\s\S]*<!-- \/physics -->/.test(old) ? old.replace(/<!-- physics -->[\s\S]*<!-- \/physics -->/, block) : `${old.trimEnd()}\n\n${block}\n`;
  await writeFile(readme, next.trimStart());
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}

// The coverage ledger of the Battlefront II (2017) drop: every object in the
// bf2017-assets bucket, and for each the site file that uses it, the lane
// that will, or the rule that keeps it out (scripts/lib/bf2017-coverage.mjs
// decides; scripts/lib/bf2017-owners.mjs is the lanes' commitment). The
// spec is docs/superpowers/specs/2026-10-10-bf2017-every-asset-design.md
// §3, lane Z.
//
//   node scripts/bf2017-coverage.mjs [--listing <tsv>] [--out <dir>]
//   node scripts/bf2017-coverage.mjs --root <export>/web_opt [--out <dir>]
//   node scripts/bf2017-coverage.mjs --check [--out <dir>]
//
//   (no flag)  the fetch form: the manifests from the bucket (into
//              lab/assets/bf2017/, git-ignored, kept between runs) and a
//              walk of its listing; needs SUPABASE_URL and BF2017_KEY (or
//              SUPA_KEY) in the environment, never printed. NODE_USE_ENV_PROXY=1
//              behind a proxy.
//   listing    a saved walk (path<TAB>bytes a line) in place of a new one
//   root       the desktop's web_opt (the uploader's mirror): the manifests
//              from there and its upload_state.tsv as the listing; no key
//   out        where ledger.md and ledger.json.gz go
//              (docs/superpowers/evidence/bf2017-coverage)
//   check      reads the committed ledger.json.gz, prints the counts and the
//              first twenty offenders, exits 1 while a row is unowned or
//              owned by a lane that has merged (CI runs this; no keys)
//
// The site's consumers are read from the working tree (readConsumers), and
// the clip packs published to site-assets (not in git) from that public
// bucket by galaxyAssets.json's hashes, read-only, when SUPABASE_URL is set.

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { parseArgs } from './lib/args.mjs';
import { publishedPath } from './lib/asset-manifest.mjs';
import { classify, consumersOf, ledgerMarkdown, listingOf, normalise, rowsOf, summarise, usedTextures } from './lib/bf2017-coverage.mjs';
import { LANES, OWNERS } from './lib/bf2017-owners.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = 'docs/superpowers/evidence/bf2017-coverage';
const PAGE = 1000;

// Every object under a bucket folder: `list(prefix, offset)` answers one page
// of Storage's list call ({ name, id }; a folder has no id), a thousand at most.
export async function walkListing(list, prefix) {
  const out = [];
  const folders = [prefix];
  while (folders.length) {
    const at = folders.shift();
    for (let offset = 0; ; offset += PAGE) {
      const page = await list(at, offset);
      for (const e of page) {
        const path = `${at}/${e.name}`;
        if (e.id) out.push(e.bytes != null ? { path, bytes: e.bytes } : path);
        else folders.push(path);
      }
      if (page.length < PAGE) break;
    }
  }
  return out;
}

// The strings of a JSON value that a walk finds, under the keys `want` names (all, by default)
function strings(value, want = null, out = [], key = null) {
  if (typeof value === 'string') {
    if (!want || want.includes(key)) out.push(value);
  } else if (Array.isArray(value)) value.forEach((v) => strings(v, want, out, key));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) strings(v, want, out, k);
  return out;
}
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const filesUnder = (dir, test) => (existsSync(dir) ? readdirSync(dir, { recursive: true }).map(String).filter(test).map((f) => join(dir, f)) : []);

// A GLB's JSON chunk: the clip packs name each clip's source in `extras.source`
export function glbJson(buf) {
  const len = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
}
const clipSources = (gltf) => (gltf.animations ?? []).map((a) => a.extras?.source).filter(Boolean);
const PREFIX = 'Star Wars Battlefront II (2017): ';

// The site's consumers of the drop, from the working tree at `root`:
// { names: Set(key), by: Map(key → the file that names it) }. `fetchPack(path,
// entry)` → a published clip pack's bytes (or null), for the packs not in git.
export async function readConsumers(root, { fetchPack = null } = {}) {
  const byFile = {};
  const add = (file, names) => {
    const rel = relative(root, file).split('\\').join('/');
    (byFile[rel] ??= []).push(...names.filter((n) => typeof n === 'string' && n));
  };
  const at = (p) => join(root, p);

  // the galaxy manifest's `from`, and the clip packs it lists
  const assets = existsSync(at('src/data/galaxyAssets.json')) ? readJson(at('src/data/galaxyAssets.json')) : {};
  add(at('src/data/galaxyAssets.json'), Object.values(assets).map((e) => e.from));
  for (const [path, entry] of Object.entries(assets)) {
    if (!/\/clips-[^/]+\.glb$/.test(path)) continue;
    const local = at(`public/${path}`);
    const buf = existsSync(local) ? readFileSync(local) : fetchPack ? await fetchPack(path, entry) : null;
    if (buf) add(existsSync(local) ? local : at(`public/${path}`), clipSources(glbJson(buf)));
  }
  for (const file of filesUnder(at('public/models/galaxy/bf2017'), (f) => /(^|\/)(clips-[^/]+|walrus)\.glb$/.test(f))) add(file, clipSources(glbJson(readFileSync(file))));

  // the credits: an EA DICE row's title names the drop's path
  if (existsSync(at('src/data/modelCredits.json'))) {
    const names = [];
    for (const c of Object.values(readJson(at('src/data/modelCredits.json')))) {
      if (!String(c.title ?? '').startsWith(PREFIX)) continue;
      const path = c.title.slice(PREFIX.length).trim();
      names.push(path, `mapref:${path}`);
    }
    add(at('src/data/modelCredits.json'), names);
  }

  // the level packs: the map, its terrain, its meshes, its maps, its shapes and its extras
  for (const file of filesUnder(at('public/models/galaxy/bf2017/levels'), (f) => f.endsWith('level.json'))) {
    const pack = readJson(file);
    const names = [];
    // (the map and its terrain by the name the pack gives: resolveLevels finds the rows)
    if (pack.map) {
      names.push(`mapref:${pack.map}`);
      for (const kind of ['lights', 'decals', 'actors', 'vehicles', 'effects']) if (existsSync(join(dirname(file), `${kind}.json`))) names.push(`mapextra:${kind}:${pack.map}`);
    }
    names.push(...(pack.meshes ?? []).map((m) => m.name));
    names.push(...Object.keys(pack.tex ?? {}));
    names.push(...strings(pack.physics ?? {}, ['name', 'shapes', 'source']).map((s) => `physics:${s}`));
    add(file, names);
    // (its variations.json, lane colour: the variation databases and object variations it read)
    const vfile = join(dirname(file), 'variations.json');
    if (existsSync(vfile)) {
      const v = readJson(vfile);
      add(vfile, [...(v._source?.mvdb ?? []), ...Object.values(v.meshes ?? {}).flatMap((m) => Object.values(m._source?.variations ?? {}))]);
    }
  }

  // the space levels' set pieces (scripts/bf2017-space.mjs): the map, each
  // model's parts, the asteroid tracks the rocks turn on, the map's globes
  for (const file of filesUnder(at('src/data/galaxy/space'), (f) => f.endsWith('.json'))) {
    const pack = readJson(file);
    const names = [];
    if (pack.map) names.push(`mapref:${pack.map}`);
    for (const m of Object.values(pack.models ?? {})) names.push(...(m.from ?? []));
    if (pack.from && typeof pack.from === 'object') names.push(...Object.values(pack.from));
    if (!pack.models) for (const g of Object.values(pack)) if (typeof g?.from === 'string') names.push(g.from);
    add(file, names);
  }

  // the planets' skins, the light records, the effects and the rulebooks' sources
  if (existsSync(at('src/data/planetSkins.json'))) add(at('src/data/planetSkins.json'), Object.values(readJson(at('src/data/planetSkins.json'))).flatMap((s) => strings(s.from ?? {})));
  for (const file of filesUnder(at('src/data/bf2017/light'), (f) => f.endsWith('.json'))) add(file, strings(readJson(file)).filter((s) => s.includes('/')));
  if (existsSync(at('src/data/bf2017Fx.js'))) {
    const text = readFileSync(at('src/data/bf2017Fx.js'), 'utf8');
    add(at('src/data/bf2017Fx.js'), [...text.matchAll(/"([^"]*\/[^"]*)"/g)].map((m) => m[1]).filter((s) => !s.startsWith('/')));
  }
  for (const file of filesUnder(at('src/data/bf2017'), (f) => f.endsWith('.json') && !f.startsWith('light'))) add(file, strings(readJson(file), ['_source']));
  if (existsSync(at('src/data/bf2017/library.json'))) add(at('src/data/bf2017/library.json'), strings(readJson(at('src/data/bf2017/library.json'))).filter((s) => s.includes('/')));
  return consumersOf(byFile);
}

// A level named by a pack or a credit (`mapref:<path>`, `mapextra:<kind>:<path>`)
// is found among the map rows as written or with its last folder doubled
// (levels/mp/hoth_01 → levels/mp/hoth_01/hoth_01; levels/sp/a1/m1end/ds02 as
// it is); the terrains under that map's folder are its terrain (the
// manifest names them every way: terrain/terrain, hoth_01_terrain/…,
// terrainkessel_01/…). Adds the rows' own keys to the consumers.
export function resolveLevels(consumers, rows) {
  const maps = new Map(rows.filter((r) => r.part === 'maps').map((r) => [r.keys[0], r]));
  const terrains = rows.filter((r) => r.part === 'terrain');
  const give = (k, by) => {
    consumers.names.add(k);
    if (!consumers.by.has(k)) consumers.by.set(k, by);
  };
  for (const key of [...consumers.names]) {
    const m = key.match(/^(mapref|mapextra):(?:([a-z]+):)?(.*)$/);
    if (!m) continue;
    const [, kind, extra, ref] = m;
    const by = consumers.by.get(key);
    const last = ref.split('/').pop();
    const row = maps.get(`map:${ref}`) ?? maps.get(`map:${ref}/${last}`);
    if (!row) continue;
    if (kind === 'mapextra') {
      give(`${row.keys[0]}.${extra}`, by);
      continue;
    }
    give(row.keys[0], by);
    const folder = row.keys[0].slice('map:'.length, row.keys[0].lastIndexOf('/'));
    for (const t of terrains) if (t.keys[0].startsWith(`terrain:${folder}/`)) give(t.keys[0], by);
  }
  return consumers;
}

// The gate: no row unowned, no row owned by a lane that has merged, and no
// row owned by a lane the table does not know
export function checkLedger(rows, lanes = LANES) {
  const known = new Set(lanes.map((l) => l.lane));
  const merged = new Map(lanes.filter((l) => l.merged).map((l) => [l.lane, l.merged]));
  const unowned = rows.filter((r) => r.state === 'unowned').map((r) => r.name);
  const stale = rows.filter((r) => r.state === 'owned' && merged.has(r.by)).map((r) => ({ name: r.name, lane: r.by, merged: merged.get(r.by) }));
  const unknown = rows.filter((r) => r.state === 'owned' && !known.has(r.by)).map((r) => ({ name: r.name, lane: r.by }));
  return { ok: !unowned.length && !stale.length && !unknown.length, unowned, stale, unknown };
}

// --- the fetch and the write -------------------------------------------------

const jsonl = (text) => text.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const MANIFESTS = ['web/models.jsonl', 'web/anims.jsonl', 'web/textures.jsonl', 'web/physics.jsonl', 'web/terrain.jsonl', 'web/misc.jsonl', 'web/maps/index.json', 'data.tsv'];

async function fromBucket(args) {
  const { keys, getObject } = await import('./bf2017-fetch.mjs');
  const env = keys();
  const cache = join(ROOT, 'lab/assets/bf2017');
  const text = {};
  for (const p of MANIFESTS) {
    const got = await getObject(env, cache, p);
    if (got.state === 'missing' || got.state === 'failed') throw new Error(`${p}: ${got.state}`);
    text[p] = readFileSync(got.file, 'utf8');
  }
  let listing;
  if (args.listing) listing = readFileSync(args.listing, 'utf8').split('\n').filter(Boolean);
  else {
    const list = async (prefix, offset) => {
      for (let tries = 0; ; tries++) {
        const res = await fetch(`${env.base.replace(/\/+$/, '')}/storage/v1/object/list/bf2017-assets`, {
          method: 'POST',
          headers: { ...env.headers, 'content-type': 'application/json' },
          body: JSON.stringify({ prefix, limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } }),
        }).catch(() => null);
        if (res?.ok) return (await res.json()).map((e) => ({ name: e.name, id: e.id, bytes: e.metadata?.size }));
        if (tries >= 4) throw new Error(`list ${prefix}: ${res ? res.status : 'no answer'}`);
        await new Promise((r) => setTimeout(r, 1000 * 2 ** tries));
      }
    };
    const found = [...(await walkListing(list, 'web')), ...(await walkListing(list, 'test')), { path: 'data.tsv', bytes: text['data.tsv'].length }];
    listing = found.map((f) => (typeof f === 'string' ? f : `${f.path}\t${f.bytes ?? 0}`));
    const saved = join(cache, 'web/listing.tsv');
    mkdirSync(dirname(saved), { recursive: true });
    writeFileSync(saved, listing.join('\n') + '\n');
  }
  return { text, listing, source: `the bucket (${listing.length.toLocaleString('en-GB')} objects listed)` };
}

function fromRoot(dir) {
  const text = {};
  for (const p of MANIFESTS) {
    const local = [join(dir, p.replace(/^web\//, '')), join(dir, p), join(dir, '..', p)].find(existsSync);
    if (!local) throw new Error(`${p}: not under ${dir}`);
    text[p] = readFileSync(local, 'utf8');
  }
  // upload_state.tsv: the uploader's record, its first column the bucket path under web/
  const state = readFileSync(join(dir, 'upload_state.tsv'), 'utf8').split('\n').filter(Boolean);
  const listing = state.map((l) => l.split('\t')[0]).map((p) => (p.startsWith('web/') ? p : `web/${p}`));
  return { text, listing, source: `the desktop export's ${dir}` };
}

async function publishedPack(path, entry) {
  const base = process.env.SUPABASE_URL;
  if (!base || !entry?.hash) return null;
  const res = await fetch(`${base.replace(/\/+$/, '')}/storage/v1/object/public/site-assets/${publishedPath(path, entry.hash)}`).catch(() => null);
  return res?.ok ? Buffer.from(await res.arrayBuffer()) : null;
}

export async function build({ text, listing }, { root = ROOT, fetchPack = publishedPack } = {}) {
  const manifests = {
    models: jsonl(text['web/models.jsonl']),
    anims: jsonl(text['web/anims.jsonl']),
    textures: jsonl(text['web/textures.jsonl']),
    physics: jsonl(text['web/physics.jsonl']),
    terrain: jsonl(text['web/terrain.jsonl']),
    misc: jsonl(text['web/misc.jsonl']),
    maps: JSON.parse(text['web/maps/index.json']),
    data: text['data.tsv'],
    listing,
  };
  const consumers = await readConsumers(root, { fetchPack });
  const listed = listingOf(listing);
  const rows = rowsOf(manifests);
  resolveLevels(consumers, rows);
  // the bucket's own manifests are read by this script and the fetch
  for (const p of MANIFESTS) {
    const k = normalise(`${p.includes('/', 4) ? p.split('/')[1] : 'index'}:${p.replace(/^web\//, '')}`);
    consumers.names.add(k);
    if (!consumers.by.has(k)) consumers.by.set(k, 'scripts/bf2017-coverage.mjs');
  }
  let done = rows.map((r) => ({ ...r, ...classify(r, { consumers, listing: listed, owners: OWNERS }) }));
  // a used model's textures are used by the same consumer
  for (const [k, by] of usedTextures(done, manifests.models)) if (!consumers.names.has(k)) (consumers.names.add(k), consumers.by.set(k, by));
  done = rows.map((r) => ({ ...r, ...classify(r, { consumers, listing: listed, owners: OWNERS }) }));
  return done;
}

const slim = (r) => ({ id: r.id, part: r.part, name: r.name, state: r.state, by: r.by, bytes: r.bytes, ...(r.count ? { count: r.count } : {}), ...(r.finding ? { finding: true } : {}) });

function write(done, outDir, source) {
  mkdirSync(outDir, { recursive: true });
  const summary = summarise(done);
  const unowned = done.filter((r) => r.state === 'unowned').map((r) => r.id);
  const at = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  writeFileSync(join(outDir, 'ledger.md'), ledgerMarkdown(summary, { at, unowned, source, lanes: LANES }));
  writeFileSync(join(outDir, 'ledger.json.gz'), gzipSync(JSON.stringify(done.map(slim))));
  return summary;
}

export function readLedger(outDir) {
  return JSON.parse(gunzipSync(readFileSync(join(outDir, 'ledger.json.gz'))).toString('utf8'));
}

const counts = (rows) => {
  const c = { used: 0, owned: 0, excluded: 0, 'not-uploaded': 0, unowned: 0 };
  for (const r of rows) c[r.state]++;
  return `${rows.length.toLocaleString('en-GB')} rows: used ${c.used} · owned ${c.owned} · excluded ${c.excluded} · not-uploaded ${c['not-uploaded']} · unowned ${c.unowned}`;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = join(ROOT, args.out ?? OUT);
  if (args.check) {
    const rows = readLedger(outDir);
    const r = checkLedger(rows);
    console.log(`coverage: ${counts(rows)}`);
    for (const n of r.unowned.slice(0, 20)) console.log(`  unowned  ${n}`);
    for (const s of r.stale.slice(0, 20)) console.log(`  stale    ${s.name}  (lane ${s.lane}, merged in #${s.merged}, still not used)`);
    for (const u of r.unknown.slice(0, 20)) console.log(`  unknown  ${u.name}  (lane ${u.lane} is not in LANES)`);
    if (!r.ok) {
      console.log(`coverage: ${r.unowned.length} unowned, ${r.stale.length} owned by a merged lane, ${r.unknown.length} by an unknown one. Use them, or name their lane in scripts/lib/bf2017-owners.mjs.`);
      process.exit(1);
    }
    console.log('coverage: every object is used, owned by an open lane, or excluded by a rule.');
    return;
  }
  const input = args.root ? fromRoot(args.root) : await fromBucket(args);
  const done = await build(input);
  write(done, outDir, input.source);
  console.log(`coverage: ${counts(done)}`);
  console.log(`wrote ${relative(ROOT, outDir)}/ledger.md and ledger.json.gz`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}

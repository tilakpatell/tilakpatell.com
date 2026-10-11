// Fetches models from the Star Wars Battlefront II (2017) drop (the private
// bf2017-assets bucket on the owner's Supabase) into lab/assets/bf2017/,
// which git ignores: nothing fetched is committed as it comes; it goes
// through scripts/bf2017-import.mjs first. A model is asked for by its
// manifest name; the fetch takes its LOD files, the textures its GLBs name
// (read from each GLB's image URIs, since they point outside the file), any
// parts beside it and its collision mesh, and keeps the bucket's layout on
// disk so the GLBs' relative URIs still resolve.
//
//   node --env-file=.env.local scripts/bf2017-fetch.mjs manifest
//   node --env-file=.env.local scripts/bf2017-fetch.mjs <name> [--lod all|<n>[,<n>…]] [--parts '<glob>,…'] [--no-textures] [--collision]
//   node --env-file=.env.local scripts/bf2017-fetch.mjs --all '<glob over name>' [--verify] [--pool 6] [--no-textures] [--no-collision]
//   node --env-file=.env.local scripts/bf2017-fetch.mjs --list '<glob over name>'
//   node --env-file=.env.local scripts/bf2017-fetch.mjs data '<glob over record name>' […]
//   node --env-file=.env.local scripts/bf2017-fetch.mjs web '<glob under web/>' […]
//   node --env-file=.env.local scripts/bf2017-fetch.mjs --raw <path under web/>
//   node --env-file=.env.local scripts/bf2017-fetch.mjs --folder '<folder under web/>/<glob>'
//   node --env-file=.env.local scripts/bf2017-fetch.mjs anims
//   node --env-file=.env.local scripts/bf2017-fetch.mjs anim <clip name>
//
//   manifest     web/models.jsonl (about 25 MB), which every other command reads
//   name         a model's `name` in the manifest (characters/hero/luke/luke_rotj_01/luke_rotj_01_mesh)
//   lod          which LODs (all by default)
//   parts        globs over the model's folder for the parts that go with it ('*_cape_mesh,*_hands_mesh')
//   no-textures  the GLBs only
//   collision    its collision GLB as well
//   all          every model under a glob, whole (LODs, collision, maps), one
//                summary line: fetched · kept · missing · failed · MB · s;
//                exit 1 only on a failure, never on a missing
//   verify       trust no index: measure every file again, fetch what's wrong
//   pool         how many requests at once (6)
//   list         the names under a glob, with their LOD triangles
//   data         gameplay records (data/<Name>.json.gz) whose names match the
//                globs (`*` within a folder, `**` across), or every record of a
//                type (`type:ObjectVariation`, from data.tsv's type column), and
//                data.tsv, their index: the Battlefront extractor's --root
//                (scripts/bf2017-data.mjs)
//   web          files of the web build (svg/**, fonts/…, maps/…, strings/…),
//                and the listing of their folders in web/files.txt
//   raw          one object by its path (maps/README.md, terrain.jsonl), not a model
//   folder       every object in one folder of the bucket whose name matches
//                the glob (a map's files: 'maps/levels/mp/hoth_01/*')
//   list         the names under a glob, with their LOD triangles (models)
//                or their frames and fps (clips, once `anims` has run)
//   anims        web/anims.jsonl (about 16 MB), the clips' manifest
//   anim         one clip's glTF (web/anims/…), by its name in that manifest
//
// Every request goes through scripts/lib/pool.mjs (retries, backoff, a
// timeout by size, a .part renamed when whole), so a cut-off run leaves no
// half file and the next one resumes; lab/assets/bf2017/.index.json writes
// down what is on disk, so a second pass over a set asks for nothing it has.
//
// The keys: SUPABASE_URL and BF2017_KEY (or SUPA_KEY, the same key under the
// name the cloud sessions hold it by) from the environment, never printed.
// A texture none of whose sources the bucket holds yet is `missing`, not an
// error: the upload is still running, and the import says what it lacks.

import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { animEntry, animPath, globRe } from './lib/bf2017-anims.mjs';
import { partsOf, readManifest } from './lib/bf2017-manifest.mjs';
import { dataPath, globDir, globMatch, globRegExp, imageUris, inBucket, isCurrent, jobsFor, localPath, namesOfType, objectUrl, readIndex, summaryLine, textureSources, writeIndex } from './lib/bf2017-paths.mjs';
import { createPool } from './lib/pool.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUCKET = 'bf2017-assets';
const MANIFEST = 'web/models.jsonl';
const ANIMS = 'web/anims.jsonl';
const INDEX = '.index.json';

export function keys() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.BF2017_KEY || process.env.SUPA_KEY;
  if (!base || !key) {
    console.error('Set SUPABASE_URL and BF2017_KEY in .env.local and run with node --env-file=.env.local.');
    process.exit(2);
  }
  return { base, headers: { apikey: key, Authorization: `Bearer ${key}` } };
}

// Every request goes through one pool (scripts/lib/pool.mjs): six at once,
// each retried on a fault, a 429 or a 5xx, written to a .part and renamed
// when whole. Supabase answers 400 (and sometimes 404) for an object it
// hasn't got: that is `missing`, the upload not there yet, not a failure.
let shared = null;
const poolOf = (size = 6) => (shared ??= createPool({ size, missing: [400, 404] }));

// What this run did, for the summary line and the index.
const run = { fetched: 0, kept: 0, missing: 0, failed: 0, bytes: 0, index: null, verify: false, root: null };
const sizeOf = async (file) => (existsSync(file) ? (await stat(file)).size : null);
const note = (r) => {
  run[r.state]++;
  if (r.state === 'fetched') run.bytes += r.bytes;
  return r;
};

// One object to disk. `kept`: the index wrote it down at the size it is (no
// request at all), or the bucket's content-length is its size. `missing`:
// the bucket hasn't it. `failed`: the pool gave up (the line says why).
// `size`: the manifest's bytes, a guess for the timeout only (the uploader
// re-encoded the GLBs after writing them down, so the bucket's are smaller;
// the body is held to the response's own content-length). With --verify the
// index is not trusted: every file is asked about again and one that is
// wrong is fetched again.
export async function getObject(env, root, bucketPath, { size = null } = {}) {
  const url = objectUrl(env.base, BUCKET, bucketPath);
  const file = localPath(root, bucketPath);
  const index = run.index ?? {};
  const onDisk = await sizeOf(file);
  if (onDisk != null) {
    if (!run.verify && isCurrent(index, bucketPath, null, onDisk)) return note({ file, bytes: onDisk, state: 'kept' });
    const head = await poolOf().run({ url, method: 'HEAD', headers: env.headers });
    if (head.status === 'missing') return note({ file, bytes: 0, state: 'missing' });
    if (head.status === 'fetched' && Number(head.headers.get('content-length')) === onDisk) {
      index[bucketPath] = { bytes: onDisk, at: new Date().toISOString() };
      return note({ file, bytes: onDisk, state: 'kept' });
    }
  }
  const got = await poolOf().run({ url, headers: env.headers, size, to: file });
  if (got.status === 'fetched') index[bucketPath] = { bytes: got.bytes, at: new Date().toISOString() };
  else if (got.status === 'missing') delete index[bucketPath];
  return note({ file, bytes: got.bytes, state: got.status, error: got.error });
}

// The objects in one folder of the bucket (Storage's list call, a page at a time)
export async function listFolder(env, prefix) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${env.base.replace(/\/+$/, '')}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: { ...env.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    if (!res.ok) throw new Error(`list ${prefix}: ${res.status}`);
    const page = await res.json();
    out.push(...page.filter((o) => o.id).map((o) => o.name));
    if (page.length < 1000) return out;
  }
}

const say = (r) => console.log(`${relative(ROOT, r.file).padEnd(110)} ${String(r.bytes).padStart(10)}  ${r.state}${r.error ? `  (${r.error})` : ''}`);

async function loadManifest(root) {
  const file = localPath(root, MANIFEST);
  if (!existsSync(file)) {
    console.error(`No manifest at ${relative(ROOT, file)}: run node --env-file=.env.local scripts/bf2017-fetch.mjs manifest first.`);
    process.exit(2);
  }
  return readManifest(await readFile(file, 'utf8'));
}

// A texture by its sources, best first: the first the bucket holds.
async function getTexture(env, root, bucketPath, sources = textureSources(bucketPath)) {
  let last = null;
  for (const src of sources) {
    last = await getObject(env, root, src);
    if (last.state !== 'missing') return last;
    // (each source asked and not there counted once, as the texture's miss below)
    run.missing--;
  }
  return note({ file: localPath(root, bucketPath), bytes: 0, state: 'missing', error: last?.error });
}

// The textures a fetched GLB names that the manifest didn't (the uploader's
// derived maps), each once a run.
async function texturesOf(env, root, r, glbBucketPath, seen) {
  if (r.state === 'missing' || r.state === 'failed') return [];
  let uris = [];
  try {
    uris = imageUris(await readFile(r.file), glbBucketPath);
  } catch {
    return [];
  }
  const fresh = uris.filter((u) => !seen.has(u));
  for (const u of fresh) seen.add(u);
  return Promise.all(
    fresh.map(async (u) => {
      const t = await getTexture(env, root, u);
      say(t);
      return t;
    }),
  );
}

// A whole set at once (`--all '<glob>'`): every LOD, collision mesh and map
// of every model whose name matches, through the pool, then the maps the
// GLBs name besides. One line a file, one summary line.
export async function fetchAll(env, root, manifest, glob, { textures = true, collision = true } = {}) {
  const jobs = jobsFor(manifest, glob, { textures, collision });
  const seen = new Set(jobs.filter((j) => j.kind === 'texture').flatMap((j) => [j.path, ...j.sources]));
  const results = await Promise.all(
    jobs.map(async (j) => {
      const r = j.kind === 'texture' ? await getTexture(env, root, j.path, j.sources) : await getObject(env, root, j.path, { size: j.size });
      say(r);
      const more = textures && j.kind === 'model' ? await texturesOf(env, root, r, j.path, seen) : [];
      return [r, ...more];
    }),
  );
  return results.flat();
}

export async function fetchModel(env, root, manifest, name, { lod = 'all', parts = null, textures = true, collision = false } = {}) {
  const entry = manifest.get(name);
  if (!entry) throw new Error(`${name}: not in the manifest (try --list)`);
  const want = lod === 'all' ? null : new Set(String(lod).split(',').map(Number));
  const entries = [entry, ...(parts ? partsOf(manifest, name, parts.split(',')) : [])];
  const seen = new Set();
  const results = await Promise.all(
    entries.flatMap((e) => [
      ...e.lods
        .filter((l) => !want || want.has(l.lod))
        .map(async (l) => {
          const r = await getObject(env, root, inBucket(l.file), { size: l.bytes ?? null });
          say(r);
          return [r, ...(textures ? await texturesOf(env, root, r, inBucket(l.file), seen) : [])];
        }),
      ...(collision && e.collision?.file
        ? [
            (async () => {
              const r = await getObject(env, root, inBucket(e.collision.file), { size: e.collision.bytes ?? null });
              say(r);
              return [r];
            })(),
          ]
        : []),
    ]),
  );
  return results.flat();
}

// The index read before a run and written after it, and the summary line.
// Every object under a bucket folder, its sub-folders walked (Storage lists
// one level at a time; a folder comes back with no id).
const PAGE = 1000;
async function listUnder(env, prefix) {
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    let page = null;
    for (let tries = 0; !page; tries++) {
      const res = await fetch(`${env.base.replace(/\/+$/, '')}/storage/v1/object/list/${BUCKET}`, {
        method: 'POST',
        headers: { ...env.headers, 'content-type': 'application/json' },
        body: JSON.stringify({ prefix, limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } }),
      }).catch(() => null);
      if (res?.ok) page = await res.json();
      else if (tries >= 3) throw new Error(`list ${prefix}: ${res ? res.status : 'no answer'}`);
      else await new Promise((r) => setTimeout(r, 1000 * 2 ** tries));
    }
    for (const e of page) {
      const path = `${prefix}/${e.name}`;
      if (e.id) out.push(path);
      else out.push(...(await listUnder(env, path)));
    }
    if (page.length < PAGE) return out;
  }
}

// Bucket paths through the pool, one line each.
const getAll = (env, root, paths) =>
  Promise.all(
    paths.map(async (p) => {
      const r = await getObject(env, root, p);
      say(r);
      return r;
    }),
  );

// The records a glob names, and data.tsv, their index.
export async function fetchData(env, root, globs) {
  const results = await getAll(env, root, ['data.tsv']);
  for (const glob of globs) {
    // (`type:<Type>`: every record data.tsv says is of that type, by name)
    if (glob.startsWith('type:')) {
      const names = namesOfType(await readFile(join(root, 'data.tsv'), 'utf8'), glob.slice(5));
      if (!names.length) console.log(`${glob}: nothing of that type in data.tsv`);
      results.push(...(await getAll(env, root, names.map(dataPath))));
      continue;
    }
    const re = globRegExp(glob);
    const dir = globDir(glob);
    const names = (await listUnder(env, dir ? `data/${dir}` : 'data'))
      .filter((p) => p.endsWith('.json.gz'))
      .map((p) => p.slice('data/'.length, -'.json.gz'.length))
      .filter((n) => re.test(n));
    if (!names.length) console.log(`${glob}: nothing matches`);
    results.push(...(await getAll(env, root, names.map(dataPath))));
  }
  return results;
}

// Files of the web build (`web/<glob>`), and a listing of everything under
// the globs' folders in `web/files.txt`, so the extractor knows the 23 fonts
// without fetching 46 MB of them.
export async function fetchWeb(env, root, globs) {
  const results = [];
  const listing = join(root, 'web', 'files.txt');
  const listed = new Set(existsSync(listing) ? (await readFile(listing, 'utf8')).split('\n').filter(Boolean) : []);
  for (const glob of globs) {
    const re = globRegExp(glob);
    const dir = globDir(glob);
    const names = (await listUnder(env, dir ? `web/${dir}` : 'web')).map((p) => p.slice('web/'.length));
    names.forEach((n) => listed.add(n));
    const want = names.filter((n) => re.test(n));
    if (!want.length) console.log(`${glob}: nothing matches`);
    results.push(...(await getAll(env, root, want.map((n) => `web/${n}`))));
  }
  await mkdir(dirname(listing), { recursive: true });
  await writeFile(listing, [...listed].sort().join('\n') + '\n');
  return results;
}

async function withIndex(root, verify, work) {
  const file = join(root, INDEX);
  run.index = await readIndex(file);
  run.verify = verify;
  const t0 = Date.now();
  try {
    return await work();
  } finally {
    await writeIndex(file, run.index).catch((e) => console.error(`couldn't write the index: ${e.message}`));
    console.log(summaryLine({ ...run, seconds: (Date.now() - t0) / 1000 }));
  }
}

// ── the clips (phase 1): their manifest, one clip, and both in --list ──

export const anims = {
  // the manifest, fetched when it isn't on disk
  async load(env, root) {
    const file = localPath(root, ANIMS);
    if (!existsSync(file)) say(await getObject(env ?? keys(), root, ANIMS));
    return readManifest(await readFile(file, 'utf8'));
  },
  // one clip's glTF on disk: { file, bytes, state }, `missing` when the
  // bucket hasn't it yet (164 of the 10,270 weren't up on 2026-10-10)
  async fetch(env, root, manifest, name) {
    const e = animEntry(manifest, name);
    if (!e) return { file: null, bytes: 0, state: 'unknown' };
    return getObject(env ?? keys(), root, animPath(e));
  },
};

function listAll(models, clips, glob) {
  const re = globRe(glob);
  for (const [name, e] of models ?? []) if (re.test(name)) console.log(`${name}  ${e.lods.map((l) => l.triangles).join(' · ')}`);
  for (const [name, e] of clips ?? []) if (re.test(name)) console.log(`${name}  ${e.frames} frames at ${e.fps}${e.additive ? ', additive' : ''}  ${e.skeleton.split('/').pop()}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const root = join(ROOT, 'lab', 'assets', 'bf2017');
  const [what] = args._;
  if (args.pool) poolOf(Math.max(1, Number(args.pool) || 6));
  if (args.list) {
    const has = (p) => existsSync(localPath(root, p));
    if (!has(MANIFEST) && !has(ANIMS)) await loadManifest(root);
    listAll(has(MANIFEST) ? await loadManifest(root) : null, has(ANIMS) ? readManifest(await readFile(localPath(root, ANIMS), 'utf8')) : null, args.list);
  } else if (typeof args.raw === 'string') {
    const env = keys();
    let r = null;
    await withIndex(root, true, async () => say((r = await getObject(env, root, inBucket(args.raw)))));
    process.exit(r?.state === 'missing' ? 3 : run.failed > 0 ? 1 : 0);
  } else if (typeof args.folder === 'string') {
    const env = keys();
    const path = inBucket(args.folder);
    const folder = path.slice(0, path.lastIndexOf('/') + 1);
    const match = globMatch(path.slice(folder.length));
    const names = (await listFolder(env, folder)).filter((n) => match(n));
    if (!names.length) console.log(`${folder}: nothing there yet`);
    await withIndex(root, Boolean(args.verify), async () => {
      for (const n of names) say(await getObject(env, root, folder + n));
    });
    process.exit(run.failed > 0 ? 1 : 0);
  } else if (what === 'anims') {
    say(await getObject(keys(), root, ANIMS));
  } else if (what === 'anim') {
    const env = keys();
    const r = await anims.fetch(env, root, await anims.load(env, root), String(args._[1] ?? ''));
    if (r.state === 'unknown') {
      console.error(`${args._[1]}: not in web/anims.jsonl (try --list)`);
      process.exit(1);
    }
    say(r);
  } else if (typeof args.all === 'string') {
    const env = keys();
    const manifest = await loadManifest(root);
    // (exit 1 on a failure only: a `missing` is the upload not there yet)
    await withIndex(root, Boolean(args.verify), () => fetchAll(env, root, manifest, args.all, { textures: !args.noTextures, collision: !args.noCollision }));
    process.exit(run.failed > 0 ? 1 : 0);
  } else if (what === 'data' || what === 'web') {
    if (args._.length < 2) {
      console.error(`usage: node scripts/bf2017-fetch.mjs ${what} '<glob>' […]`);
      process.exit(1);
    }
    const env = keys();
    await withIndex(root, Boolean(args.verify), () => (what === 'data' ? fetchData : fetchWeb)(env, root, args._.slice(1)));
    process.exit(run.failed > 0 ? 1 : 0);
  } else if (what === 'manifest') {
    const env = keys();
    // (always asked again: the upload keeps adding to it)
    await withIndex(root, true, async () => say(await getObject(env, root, MANIFEST)));
    process.exit(run.failed > 0 ? 1 : 0);
  } else if (what) {
    const env = keys();
    const manifest = await loadManifest(root);
    // (`--no-textures` reads as noTextures)
    await withIndex(root, Boolean(args.verify), () =>
      fetchModel(env, root, manifest, what, { lod: args.lod ?? 'all', parts: typeof args.parts === 'string' ? args.parts : null, textures: !args.noTextures, collision: Boolean(args.collision) }),
    ).catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
    process.exit(run.failed > 0 ? 1 : 0);
  } else {
    console.error("usage: node --env-file=.env.local scripts/bf2017-fetch.mjs manifest | --raw <path under web/> | --folder '<folder>/<glob>' | data '<glob>' […] | web '<glob>' […] | <name> [--lod all|0,2] [--parts '<glob>,…'] [--no-textures] [--collision] [--verify] | --all '<glob>' [--verify] [--pool 6] [--no-textures] [--no-collision] | --list '<glob>'");
    process.exit(1);
  }
}

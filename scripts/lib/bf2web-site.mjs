// What the site takes from bf2-web, and how it checks a build before Hoth plays it
// (docs/decisions/2026-10-28-bf2web-pipeline.md). bf2-web exports a play site and uploads it to the private bucket
// as sites/<build>/ (its manifest.json last, so a manifest there means every file before it went up); the site
// adopts one by naming it in src/data/bf2web/play.json, which cloudflare/play.js serves. Nothing of bf2-web's source
// comes here: a new build is data, and a build that keeps to the contract below is adopted with no one rewriting
// anything. One that breaks it is refused with what broke, and that is the change a person (or a session) looks at.
// Pure: the scripts read the bucket and pass what they read.
//
//   CONTRACT   the schema, the roots the Worker serves, the files and the page's hooks the site relies on
//   contractProblems(manifest) → [why, …]     hookProblems(worldPlay) → [why, …]   (its runtime/world-play.mjs text)
//   missingFiles(manifest, prefix, listed) → [why, …]   listed: [{ key, size }] under sites/<build>/
//   rulebookProblems(listed) → [why, …]   listed: a rulebook folder's files
//   uiDataFor(id, own, shared) → { uiData, problems }: the build's own rulebooks (sites/<build>/ui-data/, the build
//     self-contained, so going back to it brings its rulebooks back too) when all are there, else the shared folder's
//   newest(candidates, current) → the newest adoptable build's id newer than current's, or null
//     candidates: [{ id, created, problems }]   current: { id, created } | null
//     only a build of bf2-web's main (MAIN_BUILD, main-<sha8>, as the desktop names them) is taken on its own: a
//     build the desktop made from a branch or a worktree is played only when it's named (adopt --build)
//   programNeeds(graphics, used) → { features, limits }: what the programs the build draws (used: the names its
//     pipeline cache, pipelines.json, lists) ask of the GPU. Each stage's bindings are counted against WebGPU's
//     per-stage limits: a layout over one can't be made, its pipeline never comes and the engine waits on it for good
//     (frame 0 never presents: 2026-10-28, ten of Hoth's materials sample 23 textures in one pixel stage, over the
//     default 16), and the dual-source blend. The site asks the visitor's GPU for them before it sends anyone to the
//     engine (lib/bf2web/engineSupport). Compute isn't counted: what its programs ask isn't known to stop a round.
//   floorNeeds(floor, packed, requires) → { features, limits }: a build that sends its own floor (its runtime/
//     play-quality.mjs's FLOOR, and play-config.json's requires: the most a stage of its catalog binds) is held to what
//     its page refuses below (belowFloor) rather than to its programs' raw counts: FLOOR's features, FLOOR's limits with
//     requires over them, the sampled textures capped at packed (PACKED_SAMPLED_TEXTURES: SH-10's renderer draws a
//     program over the device's limit through texture arrays, so Hoth's 23 need 16)
//   levelProblems(config, worlds) → [why, …]: play-config.json's levels against the galaxy's worlds (worlds: src/data/
//     bf2017/modes.json's, each world's ground levels). The galaxy opens the engine on the worlds whose ground they are
//     (src/lib/bf2web/levels.js), so a build that lists none of theirs is refused, not adopted to take the engine off
//     Hoth; a level no world has beside one that is, is left to the engine
//   adopted(play, id, manifest, uiData, needs, levels) → play.json for that build (levels: its play-config.json's)
//   compressible(manifest, typeOf) → the entries worth a brotli copy: the binary files Cloudflare sends as they are
//     (typeOf: cloudflare/play.js's contentType, application/octet-stream), 1 KB or more
//   ENCODINGS: encodings.json's schema   encodingsOf(sizes, quality) → encodings.json for those copies
//   uploadPlan(manifest, { prefix, previous, previousPrefix, existing }) → [{ action, key, path?, from? }]
//     copy a file the previous build has byte for byte (by its sha256), skip one already there, put the rest;
//     the manifest always last

import { worldsOf } from '../../src/lib/bf2web/levels.js';

export const CONTRACT = {
  schema: 'bf2-play-site/1',
  // the roots the page asks for by absolute path that the Worker maps (cloudflare/play.js); another is a new contract
  routes: ['/export/', '/ui-data/', '/profile/'],
  // what play.js and the front end must find in a build
  files: ['index.html', 'original-frame-graph.js', 'original-frame-graph.wasm', 'ui/main.js', 'runtime/world-play.mjs'],
  // what cloudflare/playReturn.js reads off the play page (runtime/world-play.mjs): its record, its sessions' end
  // reason and the state it names on the body
  hooks: [
    ['window.__playFlow', 'the flow’s record (window.__playFlow)'],
    ['flow.sessions.push', 'each session’s record kept in flow.sessions'],
    ['endReason', 'a session’s endReason'],
    ["document.body.className = 'play-' + state", 'the state named on the body (play-<state>)'],
    ["'quit'", 'the Quit action'],
  ],
  // the front end's rulebooks (bf2-web's frontend/tools/extract.mjs), served at /ui-data/
  rulebooks: ['screens.json', 'shapes.json', 'options.json', 'option-screens.json', 'palettes.json', 'loading.json', 'info.json', 'films.json', 'fonts.json'],
};

const safe = (path) => typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.split('/').some((p) => p === '' || p === '.' || p === '..');

export function contractProblems(manifest) {
  if (!manifest || typeof manifest !== 'object') return ['no manifest'];
  const out = [];
  if (manifest.schema !== CONTRACT.schema) out.push(`schema ${JSON.stringify(manifest.schema)}, not ${CONTRACT.schema}`);
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  if (!entries.length) out.push('no entries');
  const paths = new Set();
  for (const e of entries) {
    if (!safe(e?.path)) out.push(`an unsafe path: ${JSON.stringify(e?.path)}`);
    else if (paths.has(e.path)) out.push(`listed twice: ${e.path}`);
    else paths.add(e.path);
    if (!Number.isInteger(e?.bytes) || e.bytes < 0) out.push(`no size: ${e?.path}`);
    if (!/^[0-9a-f]{64}$/.test(e?.sha256 ?? '')) out.push(`no sha256: ${e?.path}`);
  }
  for (const f of CONTRACT.files) if (!paths.has(f)) out.push(`missing ${f}`);
  for (const r of Object.keys(manifest.routes ?? {})) if (!CONTRACT.routes.includes(r)) out.push(`a root the Worker doesn’t serve: ${r}`);
  if (paths.has('manifest.json')) out.push('the manifest lists itself');
  return out;
}

export function hookProblems(worldPlay) {
  if (typeof worldPlay !== 'string' || !worldPlay) return ['no runtime/world-play.mjs'];
  return CONTRACT.hooks.filter(([text]) => !worldPlay.includes(text)).map(([, what]) => `the play page no longer has ${what}`);
}

export function missingFiles(manifest, prefix, listed) {
  const sizes = new Map(listed.map((f) => [f.key, f.size]));
  const out = [];
  if (!sizes.has(prefix + 'manifest.json')) out.push('manifest.json not uploaded');
  for (const e of manifest.entries ?? []) {
    const size = sizes.get(prefix + e.path);
    if (size === undefined) out.push(`not uploaded: ${e.path}`);
    else if (size !== e.bytes) out.push(`${e.path}: ${size} bytes, the manifest says ${e.bytes}`);
  }
  return out;
}

export function rulebookProblems(listed) {
  const names = new Set(listed.map((f) => f.key.slice(f.key.lastIndexOf('/') + 1)));
  return CONTRACT.rulebooks.filter((r) => !names.has(r)).map((r) => `rulebook missing: ${r}`);
}

export const SHARED_UI = 'library/ui/frontend/';

export function uiDataFor(id, own, shared) {
  if (own.length && !rulebookProblems(own).length) return { uiData: `sites/${id}/ui-data/`, problems: [] };
  return { uiData: SHARED_UI, problems: rulebookProblems(shared) };
}

export const MAIN_BUILD = /^main-[0-9a-f]{8}$/;

const time = (created) => (Number.isFinite(Date.parse(created)) ? Date.parse(created) : -Infinity);

export function newest(candidates, current = null) {
  const after = current ? time(current.created) : -Infinity;
  const ok = candidates.filter((c) => MAIN_BUILD.test(c.id) && !c.problems.length && c.id !== current?.id && time(c.created) > after);
  ok.sort((a, b) => time(b.created) - time(a.created) || (a.id < b.id ? 1 : -1));
  return ok[0]?.id ?? null;
}

const STAGE_LIMITS = ['maxSampledTexturesPerShaderStage', 'maxSamplersPerShaderStage', 'maxStorageBuffersPerShaderStage', 'maxStorageTexturesPerShaderStage', 'maxUniformBuffersPerShaderStage'];

function stageCounts(bindings = []) {
  const n = Object.fromEntries(STAGE_LIMITS.map((k) => [k, 0]));
  for (const b of bindings) {
    const l = b.layout ?? {};
    if (l.texture) n.maxSampledTexturesPerShaderStage++;
    else if (l.sampler) n.maxSamplersPerShaderStage++;
    else if (l.storageTexture) n.maxStorageTexturesPerShaderStage++;
    else if (l.buffer?.type === 'uniform') n.maxUniformBuffersPerShaderStage++;
    else if (l.buffer) n.maxStorageBuffersPerShaderStage++;
  }
  return n;
}

export function programNeeds(graphics = [], used = null) {
  const limits = Object.fromEntries([...STAGE_LIMITS, 'maxBindGroups'].map((k) => [k, 0]));
  const features = new Set();
  const take = (k, v) => (limits[k] = Math.max(limits[k], v));
  for (const r of graphics) {
    if (used && !used.has(r.name)) continue;
    const stages = [r.vertex?.bindings ?? [], r.pixel?.bindings ?? []];
    for (const bindings of stages) for (const [k, v] of Object.entries(stageCounts(bindings))) take(k, v);
    for (const b of stages.flat()) if (Number.isInteger(b?.group)) take('maxBindGroups', b.group + 1);
    if (String(r.pixel?.wgsl ?? '').includes('enable dual_source_blending')) features.add('dual-source-blending');
  }
  return { features: [...features].sort(), limits };
}

export function floorNeeds(floor = {}, packed = null, requires = {}) {
  const limits = { ...(floor.limits ?? {}), ...(requires ?? {}) };
  if (Number.isInteger(packed) && limits.maxSampledTexturesPerShaderStage > packed) limits.maxSampledTexturesPerShaderStage = packed;
  return { features: [...new Set(floor.features ?? [])].sort(), limits };
}

export function levelProblems(config, worlds) {
  const levels = config?.levels;
  if (!Array.isArray(levels) || !levels.length || !levels.every((l) => typeof l === 'string' && l)) return ['play-config.json lists no levels'];
  return worldsOf(levels, worlds).length ? [] : [`its levels are no galaxy world’s ground: ${levels.join(', ')}`];
}

export function adopted(play, id, manifest, uiData = play.uiData, needs = play.needs ?? null, levels = null) {
  const bytes = manifest.entries.reduce((n, e) => n + e.bytes, 0);
  // Already-open pages still need their immutable files after the pointer changes. Retain only roots that have
  // actually been published, never discover/serve arbitrary bucket builds. An intentional retirement removes
  // that entry from play.json together with its bucket files; ordinary adoption does not expire active pages.
  const retainedBuilds = { ...play.retainedBuilds };
  if (play.build && play.build !== id) {
    const { site, export: exportRoot, uiData: previousUi, exportAllow } = play;
    retainedBuilds[play.build] = { site, export: exportRoot, uiData: previousUi, exportAllow: [...(exportAllow ?? [])] };
  }
  delete retainedBuilds[id];
  return { ...play, build: id, site: `sites/${id}/`, uiData, ...(levels ? { levels: [...levels] } : {}), mb: Math.round(bytes / 1e6), retainedBuilds, ...(needs ? { needs } : {}) };
}

// (Cloudflare compresses what it calls text, the wasm and the JSON among it, on its own: 104 MB of engine reaches a
// browser as 17. Not the rest, which is most of a build: 1.65 GB of textures, 0.3 GB of scene data.)
export const ENCODINGS = 'bf2-play-encodings/1';

export const compressible = (manifest, typeOf) => manifest.entries.filter((e) => e.bytes >= 1024 && typeOf(e.path) === 'application/octet-stream');

export function encodingsOf(sizes, quality) {
  return { schema: ENCODINGS, quality, br: Object.fromEntries([...sizes].sort(([a], [b]) => (a < b ? -1 : 1))) };
}

export function uploadPlan(manifest, { prefix, previous = null, previousPrefix = null, existing = [] }) {
  const was = new Map((previous?.entries ?? []).map((e) => [e.path, e.sha256]));
  const there = new Map(existing.map((f) => [f.key, f.size]));
  const plan = manifest.entries.map((e) => {
    const key = prefix + e.path;
    if (there.get(key) === e.bytes) return { action: 'skip', key };
    if (previousPrefix && was.get(e.path) === e.sha256) return { action: 'copy', key, from: previousPrefix + e.path };
    return { action: 'put', key, path: e.path };
  });
  // (always put again, and last: its presence says the upload finished)
  plan.push({ action: 'put', key: prefix + 'manifest.json', path: 'manifest.json' });
  return plan;
}

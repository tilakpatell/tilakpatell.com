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
//   adopted(play, id, manifest, uiData) → play.json for that build
//   uploadPlan(manifest, { prefix, previous, previousPrefix, existing }) → [{ action, key, path?, from? }]
//     copy a file the previous build has byte for byte (by its sha256), skip one already there, put the rest;
//     the manifest always last

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

const time = (created) => (Number.isFinite(Date.parse(created)) ? Date.parse(created) : -Infinity);

export function newest(candidates, current = null) {
  const after = current ? time(current.created) : -Infinity;
  const ok = candidates.filter((c) => !c.problems.length && c.id !== current?.id && time(c.created) > after);
  ok.sort((a, b) => time(b.created) - time(a.created) || (a.id < b.id ? 1 : -1));
  return ok[0]?.id ?? null;
}

export function adopted(play, id, manifest, uiData = play.uiData) {
  const bytes = manifest.entries.reduce((n, e) => n + e.bytes, 0);
  return { ...play, build: id, site: `sites/${id}/`, uiData, mb: Math.round(bytes / 1e6) };
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

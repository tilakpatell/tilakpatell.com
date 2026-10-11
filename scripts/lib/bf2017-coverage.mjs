// The coverage ledger of the Battlefront II (2017) drop (the bf2017-assets
// bucket): one row per object, and each row one state, decided in this
// order:
//
//   used          a site file names it (the consumer is `by`)
//   excluded      a rule keeps it out: the sequel era (`isSequel`; for the
//                 films, lane M's `isSequelFilm`, which also knows the
//                 campaign's mission codes and act 3), or the uploader's
//                 scaffolding and notes (the owner holds the licence for
//                 everything else, the fonts included: 2026-10-10)
//   not-uploaded  a manifest lists it and the bucket's listing has none of
//                 its files (`by`: the lane that uploads it, D for textures)
//   owned         the owners table (bf2017-owners.mjs) names a lane for it
//   unowned       nothing does: the gate fails while any row is
//
// Pure: the runner (scripts/bf2017-coverage.mjs) reads the manifests, the
// listing and the site's consumers and hands them here. The spec is
// docs/superpowers/specs/2026-10-10-bf2017-every-asset-design.md §3, lane Z.
//
// normalise(name) → the key a consumer and a row are matched by
// rowsOf({ models, anims, textures, physics, terrain, maps, misc, data, listing }) → [row]
//   row: { id, part, name, files: [path under web/], bytes, keys: [key], count? }
// listingOf(paths) → Set of path keys; consumersOf({ file: [name] }) → { names, by }
// classify(row, { consumers, listing, owners }) → { state, by }
// usedTextures(classified, models) → Map(key → consumer): the maps a used model binds
// summarise(classified) → { byPart, byLane, totals }; ledgerMarkdown(summary, { at, unowned })

import { isSequel } from './bf2017-manifest.mjs';
import { isSequelFilm } from './bf2017-ui.mjs';

export const STATES = ['used', 'owned', 'excluded', 'not-uploaded', 'unowned'];
export const PARTS = ['models', 'collision', 'anims', 'textures', 'physics', 'terrain', 'maps', 'maps.lights', 'maps.decals', 'maps.actors', 'maps.vehicles', 'maps.effects', 'scatter', 'animtracks', 'movies', 'fonts', 'svg', 'strings', 'data', 'index', 'test', 'other'];
const EXTRAS = ['lights', 'decals', 'actors', 'vehicles', 'effects'];

// The spec's §6, verbatim: the uploader's test files and ranges, its
// placeholders, what it marked for deletion, the RootLevel dev maps, and the
// paintball set (the sequel's Resistance and First Order art)
export const EXCLUDED_PREFIXES = ['test/', 'testranges', 'placeholders', 'tobedeleted_tempintransition', 'rootlevel', 'paintball'];
// The uploader's own notes and viewers (README, GUIDE, the two viewer pages): not content
const DOCS = /(^|\/)(readme\.md|guide\.md|viewer\.html|cloud_viewer\.html)$/;

const EXT = /\.(glb|gltf|ktx2|png|jpg|webp|json|jsonl|bin|webm|ogv|ssa|srt|vtt|ttf|otf|svg|gz|tsv|txt|md|html|vp6)$/;
const lower = (s) => String(s).toLowerCase();

// A name as a consumer or a row spells it, down to the one key both share:
// lowercase, the record's `#object` and the cut's `|lod1` dropped, the folder
// dropped, the extension, the LOD and a derived map's suffix dropped, and the
// clip packer's `~` rename undone.
// A `kind:` prefix (`map:`, `terrain:`, `physics:`, `collision:`) keeps the
// whole path: those rows share their names with another part's, and their
// basenames repeat across levels (Hoth_01's terrain and Hoth_02's).
export function normalise(name) {
  const [, kind = '', rest] = lower(name).match(/^([a-z.]+:)?(.*)$/);
  let s = rest.replace(/[#|].*$/, '');
  if (!kind) s = s.slice(s.lastIndexOf('/') + 1);
  s = s.replace(/\.gz$/, '').replace(EXT, '');
  return kind + s
    .replace(/~/g, '-')
    .replace(/_lod\d+$/, '')
    .replace(/__(normal|orm_[0-9a-z]+)$/, '');
}

// A bucket path as the listing check reads it: lowercase, under web/, no extension
export const pathKey = (p) => lower(p).replace(/^web\//, '').replace(/\.gz$/, '').replace(EXT, '');
const dirOf = (key) => key.slice(0, key.lastIndexOf('/'));
const derivedOf = (key) => key.replace(/__(normal|orm_[0-9a-z]+)$/, '');

const splitListing = (lines) => lines.map((l) => {
  const [path, size] = l.split('\t');
  return { path, bytes: Number(size) || 0 };
});
export const listingOf = (lines) => new Set(splitListing(lines).map((l) => pathKey(l.path)));

export function consumersOf(byFile) {
  const names = new Set();
  const by = new Map();
  for (const [file, list] of Object.entries(byFile)) {
    for (const n of list) {
      const k = normalise(n);
      if (!k) continue;
      names.add(k);
      if (!by.has(k)) by.set(k, file);
    }
  }
  return { names, by };
}

const sum = (xs) => xs.reduce((n, x) => n + (Number(x) || 0), 0);
const row = (part, name, files, bytes, keys = [normalise(name), ...files.map(normalise)]) => ({ id: `${part}:${lower(name)}`, part, name, files, bytes, keys: [...new Set(keys)] });

function partOfListing(path) {
  const p = lower(path);
  if (p.startsWith('test/')) return 'test';
  if (!p.startsWith('web/') || !p.slice(4).includes('/')) return 'index';
  const rest = p.slice(4);
  if (rest.startsWith('maps/terrain_scatter/')) return 'scatter';
  const top = rest.split('/')[0];
  if (top === 'anims_additive') return 'anims';
  return PARTS.includes(top) ? top : 'other';
}

export function rowsOf({ models = [], anims = [], textures = [], physics = [], terrain = [], maps = [], misc = [], data = '', listing = null }) {
  const rows = [];
  for (const m of models) {
    const files = (m.lods?.length ? m.lods.map((l) => l.file) : [m.file]).filter(Boolean);
    rows.push(row('models', m.name, files, m.lods?.length ? sum(m.lods.map((l) => l.bytes)) : m.bytes));
    if (m.collision?.file) rows.push(row('collision', m.name, [m.collision.file], m.collision.bytes, [normalise(`collision:${m.name}`)]));
  }
  for (const a of anims) rows.push({ ...row('anims', a.file, [a.file], a.bytes, [normalise(a.name), normalise(a.file)]), name: a.name });
  for (const t of textures) rows.push(row('textures', t.name, [t.file], t.bytes));
  for (const p of physics) rows.push(row('physics', p.name, [p.glb ?? p.file].filter(Boolean), p.resBytes ?? p.bytes, [normalise(`physics:${p.name}`)]));
  for (const t of terrain) {
    const parts = [t.world, t.detail].filter((x) => x?.file);
    rows.push(row('terrain', t.name, parts.map((x) => x.file), sum(parts.map((x) => x.bytes)), [normalise(`terrain:${t.name}`)]));
  }
  for (const m of maps) {
    const key = normalise(`map:${m.level}`);
    rows.push(row('maps', m.level, [m.file, m.bin].filter(Boolean), m.bytes, [key]));
    for (const kind of EXTRAS) rows.push(row(`maps.${kind}`, m.level, [m.extras].filter(Boolean), 0, [`${key}.${kind}`]));
  }
  for (const m of misc) {
    const part = m.cat === 'keys' ? 'strings' : m.cat;
    rows.push(row(PARTS.includes(part) ? part : 'other', m.name ?? m.file, [m.file], m.bytes));
  }
  // data.tsv: name, type, file, bytes; a row per top folder and type
  const groups = new Map();
  for (const line of String(data).split('\n')) {
    if (!line.trim()) continue;
    const [name, type, , bytes] = line.split('\t');
    const id = `${name.split('/')[0]}/${type}`;
    const g = groups.get(id) ?? { id: `data:${id}`, part: 'data', name: id, files: [], bytes: 0, keys: [], count: 0 };
    g.bytes += Number(bytes) || 0;
    g.count++;
    g.keys.push(normalise(name));
    groups.set(id, g);
  }
  rows.push(...groups.values());
  if (listing) {
    // every listed object a row claims (a texture's derived maps, a film's
    // subtitles, a terrain's record beside its heights hang on theirs); the
    // rest rows of their own, a model's LOD files one row. Bytes are the
    // bucket's, not the manifests' (which measured the masters).
    const claimed = new Map();
    for (const r of rows) {
      r.bytes = r.part === 'data' ? r.bytes : 0;
      for (const f of r.files) claimed.set(pathKey(f), r);
      if (r.part === 'terrain' && r.files[0]) claimed.set(`dir:${dirOf(pathKey(r.files[0]))}`, r);
    }
    for (const { path, bytes } of splitListing(listing)) {
      const key = pathKey(path);
      const name = lower(path).replace(/^web\//, '');
      const owner = claimed.get(key) ?? claimed.get(derivedOf(key)) ?? (name.startsWith('terrain/') ? claimed.get(`dir:${dirOf(key)}`) : null) ?? claimed.get(`lods:${key.replace(/_lod\d+$/, '')}`);
      if (owner) {
        if (!owner.files.includes(name) && !owner.files.some((f) => pathKey(f) === key)) owner.files.push(name);
        owner.bytes += bytes;
        continue;
      }
      const part = partOfListing(path);
      const r = row(part, name, [name], bytes, [normalise(name), normalise(`${part}:${name}`)]);
      claimed.set(key, r);
      claimed.set(`lods:${key.replace(/_lod\d+$/, '')}`, r);
      rows.push(r);
    }
  }
  return rows;
}

const hit = (row, test) => test(lower(row.name)) || row.files.some((f) => test(lower(f)));
// (an object only the listing names is called by its bucket path; the owners
// read it without its part's folder, as the manifests name their rows)
const FOLDER = /^(models|collision|textures|physics|terrain|maps|anims|anims_additive|animtracks|movies|fonts|svg|strings)\//;
const ownerHit = (row, test) => hit(row, test) || test(lower(row.name).replace(FOLDER, ''));

function ownerOf(row, owners) {
  for (const o of owners) {
    if (!o.match && !o.part) continue;
    if (o.part && row.part !== o.part) continue;
    if (!o.match) return o;
    const ok = o.match instanceof RegExp ? ownerHit(row, (s) => o.match.test(s)) : ownerHit(row, (s) => s.startsWith(lower(o.match)));
    if (ok) return o;
  }
  return null;
}

export function classify(row, { consumers, listing = null, owners = [] }) {
  const used = row.keys.find((k) => consumers.names.has(k));
  if (used) return { state: 'used', by: consumers.by.get(used) };
  if (row.part !== 'data' && hit(row, isSequel)) return { state: 'excluded', by: 'era' };
  if (row.part === 'movies' && isSequelFilm(row.name)) return { state: 'excluded', by: 'era' };
  if (hit(row, (s) => EXCLUDED_PREFIXES.some((p) => (p.endsWith('/') ? s.startsWith(p) : s.includes(p))))) return { state: 'excluded', by: 'scaffolding' };
  if (DOCS.test(lower(row.name))) return { state: 'excluded', by: 'scaffolding' };
  if (listing && row.files.length && !row.files.some((f) => listing.has(pathKey(f)))) return { state: 'not-uploaded', by: row.part === 'textures' ? 'D' : 'listing' };
  const o = ownerOf(row, owners);
  if (o) return { state: 'owned', by: o.lane, ...(o.finding ? { finding: true } : {}) };
  return { state: 'unowned', by: '' };
}

// The maps a used model binds are used by the same consumer: a model's
// `textures` are its source maps, and the KTX2 the GLB points at is cut from them
export function usedTextures(classified, models) {
  const consumerOf = new Map();
  for (const r of classified) if (r.part === 'models' && r.state === 'used') consumerOf.set(lower(r.name), r.by);
  const out = new Map();
  for (const m of models) {
    const by = consumerOf.get(lower(m.name));
    if (!by) continue;
    for (const t of m.textures ?? []) if (!out.has(normalise(t))) out.set(normalise(t), by);
  }
  return out;
}

const blank = () => ({ used: 0, owned: 0, excluded: 0, notUploaded: 0, unowned: 0, bytes: 0, objects: 0 });
const field = (state) => (state === 'not-uploaded' ? 'notUploaded' : state);

export function summarise(classified) {
  const byPart = {};
  const byLane = {};
  const byRule = {};
  const totals = blank();
  for (const r of classified) {
    const p = (byPart[r.part] ??= blank());
    for (const t of [p, totals]) {
      t[field(r.state)]++;
      t.bytes += Number(r.bytes) || 0;
      t.objects += r.count ?? 1;
    }
    if (r.state === 'owned') {
      const l = (byLane[r.by] ??= { owned: 0, finding: 0 });
      l.owned++;
      if (r.finding) l.finding++;
    }
    if (r.state === 'excluded') byRule[r.by] = (byRule[r.by] ?? 0) + 1;
  }
  return { byPart, byLane, byRule, totals };
}

const n = (x) => x.toLocaleString('en-GB');
const mb = (b) => n(Math.round(b / 1e6));

export function ledgerMarkdown(summary, { at, unowned = [], source = '', lanes = [] }) {
  const design = new Map(lanes.map((l) => [l.lane, l.design]));
  const out = [];
  out.push('# The Battlefront II (2017) drop: the coverage ledger', '');
  out.push(`Written ${at}${source ? ` from ${source}` : ''} by \`scripts/bf2017-coverage.mjs\`. One row per object (a model with all its LOD files; a map and each of its five extras kinds; \`data/\` by top folder and record type), each in one state: used, owned, excluded, not-uploaded, unowned. \`npm run coverage:bf2017\` fails while any row is unowned, or owned by a lane that has merged.`, '');
  const t = summary.totals;
  out.push(`**Rows:** ${n(t.used + t.owned + t.excluded + t.notUploaded + t.unowned)} · used ${n(t.used)} · owned ${n(t.owned)} · excluded ${n(t.excluded)} · not-uploaded ${n(t.notUploaded)} · unowned ${n(t.unowned)}`, '');
  out.push('## By part', '', '| part | rows | objects | MB | used | owned | excluded | not-uploaded | unowned |', '| --- | --: | --: | --: | --: | --: | --: | --: | --: |');
  for (const part of PARTS) {
    const p = summary.byPart[part];
    if (!p) continue;
    const rows = p.used + p.owned + p.excluded + p.notUploaded + p.unowned;
    out.push(`| ${part} | ${n(rows)} | ${n(p.objects)} | ${mb(p.bytes)} | ${n(p.used)} | ${n(p.owned)} | ${n(p.excluded)} | ${n(p.notUploaded)} | ${n(p.unowned)} |`);
  }
  out.push('', '## Owned, by lane', '', 'Of each lane’s rows, those its plan did not name are the fifth design’s first finding (`finding: true` in the owners table), given to it when the ledger was first written.', '', '| lane | design | owned rows | of them, the first finding |', '| --- | --- | --: | --: |');
  for (const [lane, l] of Object.entries(summary.byLane).sort((a, b) => b[1].owned - a[1].owned)) out.push(`| ${lane} | ${design.has(lane) ? `#${design.get(lane)}` : ''} | ${n(l.owned)} | ${n(l.finding)} |`);
  out.push('', '## Excluded, by rule', '', '| rule | rows |', '| --- | --: |');
  for (const [rule, c] of Object.entries(summary.byRule ?? {}).sort((a, b) => b[1] - a[1])) out.push(`| ${rule} | ${n(c)} |`);
  if (unowned.length) {
    out.push('', `## Unowned (the first ${Math.min(200, unowned.length)} of ${n(unowned.length)})`, '');
    for (const u of unowned.slice(0, 200)) out.push(`- \`${u}\``);
  }
  return out.join('\n') + '\n';
}

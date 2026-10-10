// The Battlefront rulebooks, extracted from the 2017 game's data dump into
// src/data/bf2017/ (spec section 8): the teams a level's era fields, their
// classes, heroes, reinforcements and vehicles, every weapon, ability and
// star card they carry, the AI's tuning, the level's map, lighting and
// cameras, the HUD's widgets, and the strings all of them name. Every number
// carries the record it came from (`<key>_source`); see scripts/lib/bf2017-*.
//
//   node scripts/bf2017-data.mjs all --root <dir> [--level hoth_01] [--era Orig] [--out src/data/bf2017] [--only <id,…>] [--dry]
//   node scripts/bf2017-data.mjs <rulebook> --root <dir> …        one rulebook (and what it needs, unwritten)
//   node scripts/bf2017-data.mjs fixture <record name> [--cut root] [--root <dir>]
//   node scripts/bf2017-data.mjs modes [--root <dir>] [--out src/data/bf2017]   the levels' mode layers (scripts/lib/bf2017-modes.mjs): web/maps/index.json and each level's manifest
//
//   root   the export: data.tsv and data/<Name>.json(.gz), with the web build
//          under web/ (the bucket's layout: lab/assets/bf2017 after
//          scripts/bf2017-fetch.mjs data and web) or ../web_opt (the owner's
//          C:/Users/tilak/Downloads/BF2_Extract/web)
//   dry    builds and counts, writes nothing
//   fixture  copies a record into scripts/fixtures/bf2017/data/ (cut to what
//          its root reaches with --cut root) and adds its data.tsv row

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { cutAsset, isSequel, loadAsset, readWebJson, resolveStrings, rootOf, webFile } from './lib/bf2017-ebx.mjs';
import { abilityRow, cardRow, classRow, heroRow, indexOf, reinforcementRow, teamRow, vehicleRow, weaponRow } from './lib/bf2017-rulebook.mjs';
import { aiRulebook } from './lib/bf2017-rulebook-ai.mjs';
import { camerasRow, copyUiAssets, lightingRow, uiRow } from './lib/bf2017-rulebook-look.mjs';
import { mapRow } from './lib/bf2017-rulebook-map.mjs';
import { LEVEL_WORLDS, modesRulebook } from './lib/bf2017-modes.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT = 'build 489592';

// In the order they are built: each reads what an earlier one found.
export const RULEBOOKS = ['teams', 'map', 'classes', 'heroes', 'reinforcements', 'vehicles', 'weapons', 'abilities', 'cards', 'ai', 'lighting', 'cameras', 'ui', 'strings'];
const NEEDS = {
  classes: ['teams'],
  heroes: ['teams'],
  reinforcements: ['teams'],
  vehicles: ['teams', 'map'],
  weapons: ['teams', 'classes', 'heroes', 'reinforcements'],
  abilities: ['teams', 'classes', 'heroes', 'reinforcements'],
  cards: ['teams', 'classes'],
  cameras: ['teams', 'map', 'classes', 'heroes', 'reinforcements', 'vehicles', 'weapons'],
  strings: RULEBOOKS.filter((r) => r !== 'strings'),
};

export function fileOf(step, level) {
  const map = level.toLowerCase().replace(/_\d+$/, '');
  if (step === 'map') return `maps/${map}.json`;
  if (step === 'lighting') return `maps/${map}.lighting.json`;
  return `${step}.json`;
}

export function plan(argv) {
  const args = parseArgs(argv);
  const [what = 'all'] = args._;
  if (what !== 'all' && !RULEBOOKS.includes(what)) throw new Error(`${what}: not a rulebook (${RULEBOOKS.join(', ')}, all)`);
  if (typeof args.root !== 'string') throw new Error('--root <export dir> is required');
  const want = what === 'all' ? new Set(RULEBOOKS) : new Set([...(NEEDS[what] ?? []), what]);
  return {
    steps: RULEBOOKS.filter((r) => want.has(r)),
    write: what === 'all' ? RULEBOOKS : [what],
    root: args.root,
    level: typeof args.level === 'string' ? args.level : 'hoth_01',
    era: typeof args.era === 'string' ? args.era : 'Orig',
    out: typeof args.out === 'string' ? args.out : 'src/data/bf2017',
    only: typeof args.only === 'string' ? new Set(args.only.split(',')) : null,
    dry: Boolean(args.dry),
  };
}

// ── names ───────────────────────────────────────────────────────────────

// A row's `name` as candidates: the first the strings hold, else none.
function nameIn(strings, name) {
  const all = Array.isArray(name) ? name : name ? [name] : [];
  return all.find((id) => strings && Object.keys(resolveStrings([id], strings)).length) ?? null;
}

function named(strings, rows) {
  for (const r of Object.values(rows)) if (r && 'name' in r) r.name = nameIn(strings, r.name);
  return rows;
}

const byId = (rows) => Object.fromEntries(rows.filter(Boolean).map((r) => [r.id, r]));

// Rows by id from records, each record that gives none listed as missing.
const rowsOf = (ctx, names, fn) =>
  byId(
    names.map((n) => {
      const r = fn(n);
      if (!r) ctx.$nulls.push(`row: ${n}`);
      return r;
    }),
  );
const sides = (ctx) => Object.values(ctx.teams).flatMap((t) => [t.light, t.dark]).filter(Boolean);
const uniq = (xs) => [...new Set(xs.filter(Boolean))];

// The web build's files, for the icons and fonts: a listing the fetch wrote,
// else the folders on disk.
function webFiles(root) {
  const listing = join(root, 'web', 'files.txt');
  if (existsSync(listing)) return readFileSync(listing, 'utf8').split('\n').filter(Boolean);
  const out = [];
  for (const top of ['svg', 'fonts']) {
    const base = webFile(root, top);
    if (!base) continue;
    const walk = (d) => readdirSync(d).forEach((e) => (statSync(join(d, e)).isDirectory() ? walk(join(d, e)) : out.push(`${top}/${relative(base, join(d, e)).split('\\').join('/')}`)));
    walk(base);
  }
  return out;
}

// The HUD widgets the game's first set needs (decision 14), by folder.
const WIDGETS = /^UI\/(InGame\/(Hud\/(Weapons\/Widgets\/WeaponHeat\/WeaponHeat(Widget|Bar)|Abilities\/[^/]+|Objectives\/[^/]+|InworldMarkers\/InworldMarkerDisplayScreen|Radar\/[^/]+|KillLog\/KillLogScreen|KillMessage\/[^/]+|DamageIndicator\/[^/]+|SquadMemberList\/[^/]+|Health\/[^/]+|ScoreLog\/[^/]+)|Death\/DeathBattlepoints|Scoreboard\/[^/]+|EndOfRound\/[^/]*Outcome[^/]*)|Customize\/Screens\/SpawnOverlayScreen)$/;

// ── the builders ─────────────────────────────────────────────────────────

const BUILD = {
  teams: (p) => ({ [`${p.era}:${p.level}`]: teamRow(p.root, p.era, p.level) }),
  map: (p) => mapRow(p.root, p.level),
  classes: (p, ctx) =>
    byId(
      sides(ctx).flatMap((s) =>
        s.classKits.map((k) => {
          const [, , , cls] = k.split('/');
          return classRow(p.root, cls, p.era, s.team.includes('_Light_') ? 'L' : 'D', { level: p.level }) ?? (ctx.$nulls.push(`row: ${k}`), null);
        }),
      ),
    ),
  heroes: (p, ctx) => byId(sides(ctx).flatMap((s) => s.heroKits.map((k) => heroRow(p.root, k, { side: s.team.includes('_Light_') ? 'light' : 'dark' }) ?? (ctx.$nulls.push(`row: ${k}`), null)))),
  reinforcements: (p, ctx) => rowsOf(ctx, sides(ctx).flatMap((s) => s.reinforcementKits), (k) => reinforcementRow(p.root, k)),
  vehicles: (p, ctx) => rowsOf(ctx, [...sides(ctx).flatMap((s) => s.vehicleKits), ...uniq((ctx.map.vehicleSpawns ?? []).map((v) => v.blueprint))].filter((n) => !isSequel(n)), (n) => vehicleRow(p.root, n)),
  weapons: (p, ctx) => {
    const kits = [...Object.values(ctx.classes), ...Object.values(ctx.heroes), ...Object.values(ctx.reinforcements)];
    const names = uniq(kits.flatMap((k) => [...(k.weaponAssets ?? []), k.weaponUnlock, k.primaryAsset]));
    const rows = rowsOf(ctx, names, (n) => weaponRow(p.root, n));
    return p.only ? Object.fromEntries(Object.entries(rows).filter(([id]) => p.only.has(id))) : rows;
  },
  abilities: (p, ctx) => rowsOf(ctx, uniq([...Object.values(ctx.classes), ...Object.values(ctx.heroes), ...Object.values(ctx.reinforcements)].flatMap((k) => (k.abilities ?? []).map((a) => a.asset))), (n) => abilityRow(p.root, n)),
  cards: (p, ctx) => rowsOf(ctx, uniq(Object.values(ctx.classes).flatMap((k) => k.cardAssets ?? [])), (n) => cardRow(p.root, n)),
  ai: (p) => aiRulebook(p.root),
  lighting: (p) => lightingRow(p.root, p.level),
  cameras: (p, ctx) => camerasRow(p.root, { weapons: Object.values(ctx.weapons), vehicles: uniq(Object.values(ctx.vehicles).map((v) => v.blueprint)).filter((b) => indexOf(p.root).has(`${b}_Camera`)) }),
  ui: (p) =>
    uiRow(
      p.root,
      [...indexOf(p.root).keys()].filter((n) => WIDGETS.test(n) && indexOf(p.root).get(n).type === 'UIWidgetBlueprint' && !isSequel(n)),
      { files: webFiles(p.root), depth: 2 },
    ),
  strings: (p, ctx) => {
    const ids = new Set();
    const walk = (v, key) => {
      if (typeof v === 'string' && (key === 'name' || key === 'texts' || key === 'strings') && /^ID_/.test(v)) ids.add(v);
      else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
    };
    for (const step of RULEBOOKS) if (step !== 'strings' && ctx[step]) walk(ctx[step], '');
    return ctx.$strings ? resolveStrings([...ids].sort(), ctx.$strings) : {};
  },
};

const COUNT = {
  teams: (rows) => ({ rows: Object.keys(rows).length, refused: Object.values(rows).reduce((n, t) => n + t.refused.length, 0) }),
  map: (m) => ({ rows: m.spawns.length + m.polygons.length + m.volumes.length + m.waypoints.length }),
  ai: (a) => ({ rows: Object.keys(a.tactics).length + Object.keys(a.templates).length + a.patterns.length }),
  lighting: (l) => ({ rows: l.lights.length + l.prefabs.length }),
  cameras: (c) => ({ rows: Object.keys(c.vehicles).length + Object.keys(c.aim).length + (c.soldier ? 1 : 0) }),
  ui: (u) => ({ rows: Object.keys(u.widgets).length }),
};

// Every `_missing` link under a value, once.
function missingIn(v, out = new Set()) {
  if (Array.isArray(v)) v.forEach((x) => missingIn(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) k === '_missing' && Array.isArray(x) ? x.forEach((m) => out.add(m)) : missingIn(x, out);
  return out;
}

export function run(p, { write, log = console.log, copy = (root, out, ui) => copyUiAssets(root, out, ui) } = {}) {
  const head = readFileSync(join(p.root, 'data.tsv')).subarray(0, 65536);
  const from = { export: EXPORT, date: new Date().toISOString().slice(0, 10), root: createHash('sha1').update(head).digest('hex') };
  const ctx = { $strings: readWebJson(p.root, 'strings/English.json'), $nulls: [] };
  const counts = {};
  for (const step of p.steps) {
    ctx.$nulls = [];
    const rows = BUILD[step](p, ctx);
    ctx[step] = ['classes', 'heroes', 'reinforcements', 'weapons'].includes(step) ? named(ctx.$strings, rows) : rows;
    const missing = [...new Set([...missingIn(rows), ...ctx.$nulls])];
    counts[step] = { ...(COUNT[step]?.(rows) ?? { rows: Object.keys(rows).length }), missing: missing.length };
    if (step === 'ui' && !p.dry) counts.ui.copied = copy(p.root, join(ROOT, 'public', 'battlefront'), rows);
    log(`${step.padEnd(15)} ${String(counts[step].rows).padStart(5)} rows${counts[step].refused ? `, ${counts[step].refused} refused` : ''}${missing.length ? `, ${missing.length} missing` : ''}`);
    for (const m of missing) log(`  missing: ${m}`);
    if (!p.dry && p.write.includes(step)) write(fileOf(step, p.level), { _from: from, rows });
  }
  return counts;
}

// A record into the fixtures, cut to what its root reaches with --cut root.
export function fixture(root, name, { cut = null, out = join(ROOT, 'scripts', 'fixtures', 'bf2017', 'data') } = {}) {
  const asset = loadAsset(root, name);
  if (!asset) throw new Error(`${name}: not in ${root}`);
  const kept = cut === 'root' ? cutAsset(asset, () => false) : asset;
  const file = join(out, 'data', `${name}.json`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(kept));
  const tsv = join(out, 'data.tsv');
  const e = indexOf(root).get(name);
  const rows = (existsSync(tsv) ? readFileSync(tsv, 'utf8').split('\n') : []).filter((r) => r && !r.startsWith(`${name}\t`));
  rows.push([name, e?.type ?? rootOf(asset).$type, `data/${name}.json`, e?.bytes ?? 0].join('\t'));
  writeFileSync(tsv, rows.sort().join('\n') + '\n');
  return { file, bytes: statSync(file).size, objects: kept.objects.length };
}

// The modes rulebook from the web build's maps: every multiplayer and space
// level's manifest (bf2017-fetch.mjs --raw <its file>), read for its subworlds.
export function modes(root, { strings = readWebJson(root, 'strings/English.json') } = {}) {
  const index = readWebJson(root, 'maps/index.json') ?? [];
  const levels = [];
  const missing = [];
  for (const m of index) {
    if (m.kind !== 'multiplayer' && m.kind !== 'space') continue;
    if (isSequel(m.level)) continue;
    const man = readWebJson(root, m.file);
    if (man) levels.push({ level: m.level, subworlds: man.subworlds ?? [] });
    else if (LEVEL_WORLDS[m.file.split('/').pop().replace(/\.json$/, '')]) missing.push(m.file);
  }
  return { book: modesRulebook(levels, strings), missing };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  try {
    if (argv[0] === 'modes') {
      const args = parseArgs(argv.slice(1));
      const root = typeof args.root === 'string' ? args.root : join(ROOT, 'lab', 'assets', 'bf2017');
      const { book, missing } = modes(root);
      for (const f of missing) console.log(`  missing: ${f}`);
      const to = join(ROOT, typeof args.out === 'string' ? args.out : join('src', 'data', 'bf2017'), 'modes.json');
      writeFileSync(to, JSON.stringify({ _from: { export: EXPORT, date: new Date().toISOString().slice(0, 10) }, ...book }, null, 1) + '\n');
      console.log(`modes: ${Object.keys(book.levels).length} levels on ${Object.keys(book.worlds).length} worlds; wrote ${relative(ROOT, to)}`);
    } else if (argv[0] === 'fixture') {
      const args = parseArgs(argv.slice(1));
      const r = fixture(typeof args.root === 'string' ? args.root : join(ROOT, 'lab', 'assets', 'bf2017'), args._[0], { cut: args.cut });
      console.log(`${relative(ROOT, r.file)}  ${r.bytes} bytes, ${r.objects} objects${r.bytes > 40000 ? '  (over 40 KB: cut it, or keep it gzipped)' : ''}`);
    } else {
      const p = plan(argv);
      run(p, {
        write: (file, json) => {
          const to = join(ROOT, p.out, file);
          mkdirSync(dirname(to), { recursive: true });
          writeFileSync(to, JSON.stringify(json) + '\n');
          console.log(`  wrote ${relative(ROOT, to)} (${Math.round(statSync(to).size / 1024)} KB)`);
        },
      });
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}


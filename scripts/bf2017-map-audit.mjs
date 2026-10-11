// The maps' accuracy ledger (scripts/lib/bf2017-map-audit.mjs): a row per
// usable map, written to docs/superpowers/evidence/bf2017-maps/ledger.md and
// ledger.json.
//
//   node scripts/bf2017-map-audit.mjs --all            every usable map
//   node scripts/bf2017-map-audit.mjs <level…>         those maps' rows only (by key: hoth_01, endor_02)
//   node scripts/bf2017-map-audit.mjs --refresh        re-read the packs' READMEs and the galaxy
//                                                      check's reports (an E lane runs it before its PR)
//   node scripts/bf2017-map-audit.mjs --check          fails on a README part the pack lacks, a mode in
//                                                      modes.json without its rulebook, an unplaced count
//                                                      off its header (CI: npm run maps:bf2017)
//   --root <dir>  the bucket's copy (lab/assets/bf2017: web/maps/index.json and each map's manifest,
//                 fetched by scripts/bf2017-fetch.mjs web 'maps/…')
//
// The data columns come from the bucket when its files are on disk, else from
// ledger.json (the last run that had them), so the check needs no bucket.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { USABLE, auditMap, checkRows, levelKey, rulebookFile } from './lib/bf2017-map-audit.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs/superpowers/evidence/bf2017-maps');
const PACKS = join(ROOT, 'public/models/galaxy/bf2017/levels');
const MAPS = join(ROOT, 'src/data/bf2017/maps');
const EVIDENCE = join(ROOT, 'docs/superpowers/evidence');
const PARTS = ['lights.json', 'decals.json', 'effects.json', 'actors.json', 'vehicles.json', 'scatter.json', 'ground.json'];
const TIERS = ['low', 'mid', 'high', 'ultra'];

const readJson = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null);
const countOf = (j) => (j == null ? 0 : Array.isArray(j) ? j.length : typeof j.count === 'number' ? j.count : Array.isArray(j.rows) ? j.rows.length : Object.keys(j).length ? 1 : 0);

// The bucket's columns for a map: its index row's counts, its sub-levels, its actors and vehicle spawns
function dataOf(root, level) {
  const index = readJson(join(root, 'web/maps/index.json')) ?? [];
  const row = index.find((r) => r.level.toLowerCase() === level.toLowerCase());
  if (!row) return null;
  const man = readJson(join(root, 'web', row.file));
  const counts = Object.fromEntries(['level', 'kind', 'instances', 'meshes', 'spawns', 'lights', 'effects', 'decals', 'bytes'].map((k) => [k, row[k]]));
  return {
    index: { ...counts, terrain: (row.terrain ?? []).map(() => ({})) },
    manifest: man
      ? {
          subworlds: (man.subworlds ?? []).map((s) =>
            String(s?.name ?? s)
              .split('/')
              .pop(),
          ),
          groups: [
            {
              kind: 'actor',
              count: (man.groups ?? []).filter((g) => g.kind === 'actor').reduce((n, g) => n + g.count, 0),
            },
          ],
          vehicleSpawns: { length: man.vehicleSpawns?.length ?? 0 },
        }
      : null,
  };
}

// The packs on disk, by the map key their level.json names
function packs() {
  const published = new Set(Object.keys(readJson(join(ROOT, 'src/data/galaxyAssets.json')) ?? {}));
  const out = {};
  for (const world of existsSync(PACKS) ? readdirSync(PACKS) : []) {
    const lj = readJson(join(PACKS, world, 'level.json'));
    if (!lj?.map) continue;
    const dir = join(PACKS, world);
    const has = (f) => existsSync(join(dir, f)) || published.has(`models/galaxy/bf2017/levels/${world}/${f}`);
    const parts = Object.fromEntries(PARTS.filter((f) => existsSync(join(dir, f))).map((f) => [f, countOf(readJson(join(dir, f)))]));
    out[levelKey(lj.map)] = {
      world,
      readme: existsSync(join(dir, 'README.md')) ? readFileSync(join(dir, 'README.md'), 'utf8') : '',
      parts,
      has,
    };
  }
  return out;
}

// The galaxy check's latest report per tier for a world: surface-<tier>.json under the evidence
function reports() {
  const found = [];
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/^surface-(low|mid|high|ultra)\.json$/.test(e)) found.push(p);
    }
  };
  walk(EVIDENCE);
  found.sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);
  const out = {};
  for (const f of found) {
    const tier = f.match(/surface-(\w+)\.json$/)[1];
    for (const r of readJson(f) ?? [])
      if (r?.id && r.calls != null)
        (out[r.id] ??= {})[tier] = {
          calls: r.calls,
          triangles: r.triangles,
          from: relative(ROOT, f),
        };
  }
  return out;
}

// The hand stage files beside a rulebook: <base>.stages.json, or <base>.<mode>.stages.json
function stagesOf(key) {
  const base = rulebookFile(key).replace(/\.json$/, '');
  const mine = (f) => f === `${base}.stages.json` || (f.startsWith(`${base}.`) && /^[a-z]\w*\.stages\.json$/i.test(f.slice(base.length + 1)));
  return readdirSync(MAPS)
    .filter(mine)
    .map((f) => readJson(join(MAPS, f))?.mode)
    .filter(Boolean);
}

export function build({ root = join(ROOT, 'lab/assets/bf2017'), only = null } = {}) {
  const prior = readJson(join(OUT, 'ledger.json'));
  const priorData = Object.fromEntries((prior?.rows ?? []).map((r) => [r.key, r.data]));
  const modes = readJson(join(ROOT, 'src/data/bf2017/modes.json'))?.levels ?? {};
  const byKey = packs();
  const reps = reports();
  const order = [...USABLE.filter((l) => byKey[levelKey(l)]), ...USABLE.filter((l) => !byKey[levelKey(l)])];
  const rows = [];
  for (const level of order) {
    const key = levelKey(level);
    if (only && !only.has(key)) continue;
    const data = dataOf(root, level) ?? priorData[key] ?? null;
    const pack = byKey[key] ?? null;
    const rb = readJson(join(MAPS, rulebookFile(key)));
    const variations = pack ? readJson(join(EVIDENCE, 'bf2017-colour', `${pack.world}.json`)) : null;
    const row = auditMap({
      level,
      index: data?.index ?? null,
      manifest: data?.manifest ?? null,
      pack,
      report: pack ? (reps[pack.world] ?? null) : null,
      rulebook: rb
        ? {
            ...rb.rows,
            unplacedCount: rb._from?.unplaced ?? rb.rows?.unplaced?.length ?? 0,
          }
        : null,
      modes: modes[key] ?? null,
      stages: rb ? stagesOf(key) : [],
      variations: variations
        ? {
            applied: variations.applied ?? null,
            rule: variations.rule ?? null,
            default: variations.default ?? null,
          }
        : null,
    });
    rows.push(Object.assign(row, { data }));
  }
  return rows;
}

const cell = (c) => (c == null ? '–' : c.inPack == null ? `${c.inMap ?? '–'}` : `${c.inMap ?? '–'} / ${c.inPack} / ${c.drawn ?? '–'}`);
const drawnCell = (i) => (i.inPack == null ? `${i.inMap ?? '–'} / none` : `${i.inMap ?? '–'} / ${i.inPack} / ${TIERS.map((t) => i.drawn?.[t] ?? '–').join('·')}`);
const list = (xs) => (xs.length ? xs.join(', ') : '–');

export function markdown(rows) {
  const n = rows.length;
  const count = (f) => rows.filter(f).length;
  const lines = [
    '# The maps’ accuracy ledger',
    '',
    'Written by `node scripts/bf2017-map-audit.mjs --all` (the sixth design’s lane maps); do not edit by hand. An E lane runs `node scripts/bf2017-map-audit.mjs <level> --refresh` before its PR, and its row’s drawn columns fill from its pack’s README. `npm run maps:bf2017` checks it in CI.',
    '',
    `Of ${n} usable maps: ${count((r) => r.rulebook)} have a rulebook, ${count((r) => r.pack)} a pack, ${count((r) => r.instances.drawn)} drawn columns; ${count((r) => r.modes.inRecords.length)} carry a multiplayer mode in their records.`,
    '',
    'Columns: in the map / in the pack / drawn (instances: drawn at low·mid·high·ultra, from the pack’s cull row). A map with no pack has its map column and `none`. Modes: in the records · in modes.json · with a rulebook · with hand stages.',
    '',
    '| map | kind | pack | sub-levels | instances | lights | decals | effects | actors | vehicles | modes | gaps |',
    '|---|---|---|--:|---|---|---|---|---|---|---|---|',
  ];
  for (const r of rows) {
    const m = r.modes;
    lines.push(
      `| ${r.key} | ${r.kind ?? '–'} | ${r.pack ?? '–'} | ${r.subLevels.inMap ?? '–'}${r.subLevels.inPack != null ? ` / ${r.subLevels.inPack}` : ''} | ${drawnCell(r.instances)} | ${cell(r.lights)} | ${cell(r.decals)} | ${cell(r.effects)} | ${cell(r.actors)} | ${cell(r.vehicles)} | ${list(m.inRecords)} · ${list(m.inModesJson)} · ${list(m.withRulebook)} · ${list(m.withStages)} | ${list(r.gaps)} |`,
    );
  }
  return lines.join('\n') + '\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const keys = args._.map((s) => s.toLowerCase());
  const root = typeof args.root === 'string' ? args.root : join(ROOT, 'lab/assets/bf2017');
  const all = build({ root });
  const rows = keys.length ? all.filter((r) => keys.includes(r.key)) : all;
  for (const k of keys) if (!all.some((r) => r.key === k)) console.error(`${k}: not a usable map (${USABLE.map(levelKey).join(', ')})`);
  const errors = checkRows(rows);
  if (args.check) {
    for (const e of errors) console.error(e);
    console.log(`maps: ${rows.length} rows, ${errors.length} errors`);
    process.exit(errors.length ? 1 : 0);
  }
  // (one level's run keeps the other rows: the ledger is always the whole set)
  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    join(OUT, 'ledger.json'),
    JSON.stringify(
      {
        about: 'The maps’ accuracy ledger: scripts/bf2017-map-audit.mjs',
        rows: all.map((r) => ({ ...r })),
      },
      null,
      1,
    ) + '\n',
  );
  writeFileSync(join(OUT, 'ledger.md'), markdown(all));
  for (const r of rows) console.log(`${r.key.padEnd(22)} ${(r.pack ?? '–').padEnd(10)} instances ${drawnCell(r.instances).padEnd(30)} modes ${r.modes.inRecords.join(',')}${r.gaps.length ? `  gaps: ${r.gaps.join('; ')}` : ''}`);
  for (const e of errors) console.error(e);
  console.log(`wrote ${relative(ROOT, join(OUT, 'ledger.md'))}: ${all.length} maps, ${errors.length} errors`);
}

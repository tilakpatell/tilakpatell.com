// The maps' accuracy ledger (the sixth design's lane maps): for each usable
// map of the drop, how much of it the site draws and plays. A row sets what
// the map holds (its index row and manifest on the bucket: sub-levels,
// instances, lights, decals, effects, actors, vehicle spawns, the modes its
// sub-levels carry) against what a pack keeps (the pack's README, written by
// scripts/bf2017-level.mjs and lane E0's parts table) and what is drawn per
// tier (the README's cull row; the galaxy check's calls and triangles when a
// report names the pack's world), and against the rulebooks (maps/<file>.json,
// its hand stages) and modes.json.
//
//   USABLE                 the 44 maps the fifth design lists, in its order
//   levelKey(level)        'Levels/MP/Hoth_01/Hoth_01' → 'hoth_01'; a campaign
//                          map 'Levels/SP/A1/M0LIB/DS02' → 'a1_m0lib_ds02'
//   rulebookFile(key)      'hoth_01' → 'hoth.json', 'hoth_02' → 'hoth.2.json'
//   readmeOf(text)         a pack README's numbers: instances, cull, parts, subs
//   auditMap(input) → row  pure: the inputs are read by scripts/bf2017-map-audit.mjs
//   checkRows(rows) → errors
//
// A map with no pack has its data columns and `drawn: none`; that is not a
// failure. A pack whose README claims a part the pack lacks is.

import { modesOf } from './bf2017-modes.mjs';

export const USABLE = [
  'Levels/MP/Hoth_01/Hoth_01',
  'S9_3/Hoth_02/Hoth_02',
  'Levels/MP/Endor_01/Endor_01',
  'S2_1/Levels/Endor_02/Endor_02',
  'S8_1/Endor_04/Endor_04',
  'Levels/MP/Tatooine_01/Tatooine_01',
  'S9_3/Tatooine_02/Tatooine_02',
  'S2_2/Levels/JabbasPalace_01/JabbasPalace_01',
  'Levels/MP/Yavin_01/Yavin_01',
  'Levels/MP/Kashyyyk_01/Kashyyyk_01',
  'S7/Levels/Kashyyyk_02/Kashyyyk_02',
  'Levels/MP/Kamino_01/Kamino_01',
  'S7_1/Levels/Kamino_03/Kamino_03',
  'Levels/MP/Naboo_01/Naboo_01',
  'Levels/MP/Naboo_02/Naboo_02',
  'S7_2/Levels/Naboo_03/Naboo_03',
  'S5_1/Levels/MP/Geonosis_01/Geonosis_01',
  'S6_2/Geonosis_02/Levels/Geonosis_02/Geonosis_02',
  'S9_3/Scarif/Levels/MP/Scarif_02/Scarif_02',
  'S2/Levels/CloudCity_01/CloudCity_01',
  'Levels/MP/DeathStar02_01/DeathStar02_01',
  'S8/Felucia/Levels/MP/Felucia_01/Felucia_01',
  'S3/Levels/Kessel_01/Kessel_01',
  'Levels/Space/SB_Endor_01/SB_Endor_01',
  'Levels/Space/SB_Fondor_01/SB_Fondor_01',
  'Levels/Space/SB_Kamino_01/SB_Kamino_01',
  'Levels/Space/SB_DroidBattleShip_01/SB_DroidBattleShip_01',
  'Levels/SP/A1/M0LIB/DS02',
  'Levels/SP/A1/M1END/DS02',
  'Levels/SP/A1/M1END/DS04',
  'Levels/SP/A1/M2FON/DS02',
  'Levels/SP/A1/M3PIL/DS02',
  'Levels/SP/A1/M4VAR/DS02',
  'Levels/SP/A1/M5NAB/DS02',
  'Levels/SP/A1/M5NAB/DS05',
  'Levels/SP/A2/M2BES/DS02',
  'Levels/SP/A2/M3SUL/DS02',
  'Levels/SP/A3/M1PIL/DS02',
  'Levels/SP/A3/M1PIL/DS04',
  'A3/Levels/SP/M2PIL/DS02',
  'A3/Levels/SP/M3ATH/DS02',
  'A3/Levels/SP/M4VAR/DS02',
  'Levels/Frontend/Frontend',
  'Levels/InitialExperience/InitialExperience_01',
];

export function levelKey(level) {
  const segs = String(level).split('/');
  const sp = segs.findIndex((s) => s.toLowerCase() === 'sp');
  // (a campaign map: its act, mission and detached sub-world; A3/Levels/SP/… holds the act in front)
  if (sp >= 0) return [...(/^A\d$/i.test(segs[0]) && sp > 0 ? [segs[0]] : []), ...segs.slice(sp + 1)].join('_').toLowerCase();
  return segs[segs.length - 1].toLowerCase();
}

export function rulebookFile(key) {
  const m = key.match(/^(.+)_(\d+)$/);
  if (!m || /_ds\d+$/.test(key)) return `${key}.json`;
  return Number(m[2]) === 1 ? `${m[1]}.json` : `${m[1]}.${Number(m[2])}.json`;
}

// ── the pack's README ──────────────────────────────────────────────────

const num = (s) => Number(String(s).replace(/,/g, ''));

export function readmeOf(text) {
  const out = {
    instances: null,
    horizon: null,
    subs: null,
    cull: null,
    parts: null,
  };
  if (!text) return out;
  const inst = text.match(/^- (\d+) instances in the arena[^,]*, (\d+) beyond it/m);
  if (inst) [out.instances, out.horizon] = [num(inst[1]), num(inst[2])];
  const subs = text.match(/--subs ([^\s`]+)/);
  if (subs) out.subs = subs[1].split(',').filter(Boolean);
  // (the cull table: its header names the tiers, its "meshes dropped (instances)" row each tier's count)
  const head = text.match(/^\| *\| *(low[^\n]*)\|\s*$/m);
  const dropped = text.match(/^\| *meshes dropped \(instances\) *\|([^\n]*)\|\s*$/m);
  if (head && dropped) {
    const tiers = head[1]
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);
    const cells = dropped[1].split('|').map((s) => s.trim());
    out.cull = Object.fromEntries(tiers.map((t, i) => [t, num(cells[i]?.match(/\((\d+)\)/)?.[1] ?? NaN)]).filter(([, v]) => Number.isFinite(v)));
  }
  // (lane E0's "The map's other parts" table: | part | count | bytes | read by |)
  const sec = text.split(/^## The map's other parts\s*$/m)[1];
  if (sec) {
    out.parts = {};
    for (const line of sec.split('\n')) {
      const c = line.match(/^\| *([a-z][\w./ ]*?\.(?:json|png|bin)[^|]*?) *\| *(\d+)[^|]*\| *([^|]*)\| *([^|]*)\|/i);
      if (!c) continue;
      const file = c[1].split(/\s+and\s+/)[0].trim();
      out.parts[file] = {
        count: num(c[2]),
        bytes: c[3].trim(),
        readBy: c[4].trim(),
        drawn: !/nothing|fills it|not yet/i.test(line),
      };
    }
  }
  return out;
}

// ── the row ────────────────────────────────────────────────────────────

const PART_OF = {
  lights: 'lights.json',
  decals: 'decals.json',
  effects: 'effects.json',
  actors: 'actors.json',
  vehicles: 'vehicles.json',
};
const TIERS = ['low', 'mid', 'high', 'ultra'];

// The modes a level's sub-levels carry (lane F's table, and Strike's
// `Domination`, the layer PF_Strike_Bombs and PF_Strike_CTF stand in)
export function modesInRecords(subworlds = []) {
  const names = subworlds.map((s) =>
    String(s?.name ?? s)
      .split('/')
      .pop(),
  );
  const got = modesOf(names);
  if (names.some((n) => /^Domination$/i.test(n)) && !got.includes('strike')) got.push('strike');
  return got;
}

/**
 * input: { level, index, manifest, pack, report, rulebook, modes, stages, variations }
 *   index     the map's row of web/maps/index.json (counts), or null
 *   manifest  its manifest (subworlds, groups, vehicleSpawns), or null
 *   pack      { world, readme: text, parts: { file: count } (from the files on disk), has(file) } or null
 *   report    { <tier>: { calls, triangles } } for the pack's world, or null
 *   rulebook  the map rulebook's rows, or null; stages: the hand stage files' modes
 *   modes     modes.json's row for the level, or null
 *   variations lane colour's audit row ({ applied, rule, default }), or null
 */
export function auditMap({ level, index = null, manifest = null, pack = null, report = null, rulebook = null, modes = null, stages = [], variations = null }) {
  const key = levelKey(level);
  const subs = (manifest?.subworlds ?? []).map((s) =>
    String(s?.name ?? s)
      .split('/')
      .pop(),
  );
  const readme = pack ? readmeOf(pack.readme) : null;
  const gaps = [];
  const actorsInMap = (manifest?.groups ?? []).filter((g) => g.kind === 'actor').reduce((n, g) => n + (g.count ?? 0), 0);
  const inMap = {
    instances: index?.instances ?? null,
    lights: index?.lights ?? null,
    decals: index?.decals ?? null,
    effects: index?.effects ?? null,
    actors: manifest ? actorsInMap : null,
    vehicles: manifest ? (manifest.vehicleSpawns?.length ?? 0) : null,
  };

  const instances = { inMap: inMap.instances, inPack: null, drawn: null };
  if (pack) {
    instances.inPack = readme.instances != null ? readme.instances + (readme.horizon ?? 0) : null;
    instances.drawn = Object.fromEntries(TIERS.map((t) => [t, readme.cull?.[t] != null && readme.instances != null ? readme.instances - readme.cull[t] : null]));
    for (const t of TIERS)
      if (report?.[t])
        instances.drawn[`${t}Frame`] = {
          calls: report[t].calls,
          triangles: report[t].triangles,
        };
  }
  const part = (name) => {
    const file = PART_OF[name];
    const row = { inMap: inMap[name], inPack: null, drawn: null };
    if (!pack) return row;
    const claimed = readme.parts?.[file];
    const onDisk = pack.parts?.[file];
    row.inPack = claimed?.count ?? onDisk ?? 0;
    row.drawn = claimed ? (claimed.drawn ? claimed.count : 0) : (onDisk ?? 0);
    return row;
  };

  const inRecords = modesInRecords(subs);
  const withRulebook = rulebook?.modes ?? [];
  const row = {
    level,
    key,
    kind: index?.kind ?? null,
    world: pack?.world ?? modes?.world ?? null,
    pack: pack?.world ?? null,
    subLevels: {
      inMap: subs.length || null,
      inPack: pack ? (readme.subs?.length ?? subs.length) : null,
    },
    instances,
    lights: part('lights'),
    decals: part('decals'),
    effects: part('effects'),
    actors: part('actors'),
    vehicles: part('vehicles'),
    variations: variations ?? null,
    modes: {
      inRecords,
      inModesJson: modes?.modes ?? [],
      withRulebook,
      withStages: stages,
    },
    terrain: {
      layers: index?.terrain?.length ?? 0,
      scatter: Boolean(pack && (readme.parts?.['scatter.json']?.count || pack.parts?.['scatter.json'] || pack.parts?.['ground.json'])),
    },
    rulebook: rulebook
      ? {
          file: rulebookFile(key),
          unplaced: rulebook.unplaced?.length ?? 0,
          stated: rulebook.unplacedCount ?? rulebook.unplaced?.length ?? 0,
        }
      : null,
    gaps,
  };
  if (!index) gaps.push('not in the bucket’s index');
  if (!pack) gaps.push('no pack');
  if (!rulebook) gaps.push('no rulebook');
  for (const m of inRecords) if (rulebook && !withRulebook.includes(m)) gaps.push(`mode ${m}: in the records, not in the rulebook`);
  // (the claims a check fails on: kept beside the row, not in the ledger's columns)
  Object.defineProperty(row, 'claims', {
    enumerable: false,
    value: pack
      ? Object.entries(readme.parts ?? {})
          .filter(([, p]) => p.count > 0)
          .map(([file]) => ({ file, found: Boolean(pack.has?.(file)) }))
      : [],
  });
  return row;
}

// The errors `--check` fails on.
export function checkRows(rows) {
  const errors = [];
  for (const r of rows) {
    for (const c of r.claims ?? []) if (!c.found) errors.push(`${r.key}: the pack’s README claims ${c.file}, which the pack lacks`);
    for (const m of r.modes.inModesJson) if (r.rulebook && !r.modes.withRulebook.includes(m)) errors.push(`${r.key}: modes.json lists ${m}, which its rulebook lacks`);
    if (r.rulebook && r.rulebook.unplaced !== r.rulebook.stated) errors.push(`${r.key}: its rulebook has ${r.rulebook.unplaced} unplaced rows, its header says ${r.rulebook.stated}`);
  }
  return errors;
}

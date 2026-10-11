// The Arcade (Skirmish) as the game keeps it (arcade.json): its battle
// scenarios, its settings screen's parameters, and the bots' names.
//
//   Gameplay/GameModes/Skirmish/BattleScenarios/PF_Skirmish_BattleScenario_Teams_Scenario_<n>
//       (LogicPrefabBlueprint) a PlanetDataEntityData: TeamList (two WSTeamData,
//       light first) and a PlanetList (WSPlanetList; empty in every scenario)
//   WSTeamData   WSFaction (Faction_<Side>_<Era>), Heroes and SpecialSoldiers
//       (WSSoldierCustomizationKitList: Kits[] of kit records)
//   Gameplay/GameModes/Skirmish/Parameters/SkirmishParam_* (SkirmishParameter)
//       ParamName, IndexValuesInt or IndexValuesFloat (the choices the screen
//       steps through), DefaultIntValue (the index the screen starts on)
//   Gameplay/GameModes/Skirmish/ParameterLists/SkirmishBaseParameters
//       (SkirmishParamsList) the parameters the screen shows, in its order
//   Gameplay/GameModes/Skirmish/AINames_<Faction>_Skirmish (AIPlayerNames)
//       LocalizedNames[] (string hashes): the bots' names
//
// The sequel era's scenarios (a NewEra faction on either side) and the First
// Order's names are refused; the Rebels' names list is the Resistance's too,
// and is kept as the Rebels'.

import { isSequel, loadAsset, readWebJson, rootOf, shortName } from './bf2017-ebx.mjs';
import { indexOf } from './bf2017-rulebook.mjs';

const SCENARIOS = /^Gameplay\/GameModes\/Skirmish\/BattleScenarios\/PF_Skirmish_BattleScenario_Teams_Scenario_(\d+)$/;
const PARAMS = /^Gameplay\/GameModes\/Skirmish\/Parameters\/SkirmishParam_\w+$/;
const NAMES = /^Gameplay\/GameModes\/Skirmish\/AINames_(\w+)_Skirmish$/;
const BASE = 'Gameplay/GameModes/Skirmish/ParameterLists/SkirmishBaseParameters';

const hexOf = (n) => (n >>> 0).toString(16).toUpperCase().padStart(8, '0');

// A kit record → the rulebooks' id where its folder is a row's, else its name
function kitId(kit, books) {
  const folder = kit.split('/').slice(0, 4).join('/') + '/';
  for (const book of Object.values(books)) for (const row of Object.values(book ?? {})) if (row.kit?.startsWith(folder)) return row.id;
  return shortName(kit);
}

function kitList(root, ref, books) {
  const a = ref?.$asset ? loadAsset(root, ref.$asset) : null;
  if (!a) return [];
  const kits = (rootOf(a).Kits ?? []).map((k) => k?.$asset).filter(Boolean);
  return kits.filter((k) => !isSequel(k)).map((k) => kitId(k, books));
}

function teamOf(root, ref, books) {
  const a = ref?.$asset ? loadAsset(root, ref.$asset) : null;
  const t = a ? rootOf(a) : null;
  const faction = t?.WSFaction?.$asset ?? null;
  const [, side = null, era = null] = shortName(faction ?? '').match(/^Faction_(Light|Dark)_(\w+)$/) ?? [];
  return { team: ref?.$asset ?? null, side: side?.toLowerCase() ?? null, era, faction, heroes: t ? kitList(root, t.Heroes, books) : [], specials: t ? kitList(root, t.SpecialSoldiers, books) : [] };
}

export function arcadeRulebook(root, { books = {}, strings = readWebJson(root, 'strings/English.json') } = {}) {
  const names = [...indexOf(root).keys()];
  const refused = [];

  const scenarios = {};
  for (const n of names.filter((x) => SCENARIOS.test(x)).sort()) {
    const a = loadAsset(root, n);
    const i = a ? a.objects.findIndex((o) => o?.$type === 'PlanetDataEntityData') : -1;
    if (i < 0) continue;
    const pd = a.objects[i];
    const teams = (pd.TeamList ?? []).map((t) => teamOf(root, t, books));
    const id = `scenario_${n.match(SCENARIOS)[1]}`;
    if (teams.some((t) => isSequel(t.team ?? '') || isSequel(t.faction ?? ''))) {
      refused.push(id);
      continue;
    }
    const planets = typeof pd.PlanetList?.$ref === 'number' ? (a.objects[pd.PlanetList.$ref]?.Planets ?? []).map((p) => p?.$asset ?? p).filter(Boolean) : [];
    scenarios[id] = { id, light: teams[0] ?? null, dark: teams[1] ?? null, planets, _source: `${n}#PlanetDataEntityData` };
  }

  const params = {};
  for (const n of names.filter((x) => PARAMS.test(x)).sort()) {
    const a = loadAsset(root, n);
    if (!a) continue;
    const p = rootOf(a);
    const float = (p.IndexValuesFloat ?? []).length > 0;
    const values = float ? p.IndexValuesFloat : (p.IndexValuesInt ?? []);
    params[p.ParamName] = { name: p.ParamName, values, float, defaultIndex: p.DefaultIntValue ?? 0, default: values[p.DefaultIntValue ?? 0] ?? null, _source: `${n}#SkirmishParameter.${float ? 'IndexValuesFloat' : 'IndexValuesInt'}` };
  }

  const baseAsset = loadAsset(root, BASE);
  const base = baseAsset ? (rootOf(baseAsset).Parameters ?? []).map((r) => r?.$asset).filter(Boolean).map((x) => loadAsset(root, x)).filter(Boolean).map((x) => rootOf(x).ParamName) : [];

  const bots = {};
  for (const n of names.filter((x) => NAMES.test(x)).sort()) {
    // (one list serves the Rebels and the Resistance: kept, as the Rebels')
    const faction = n.match(NAMES)[1] === 'Rebel_Resistance' ? 'Rebel' : n.match(NAMES)[1];
    if (isSequel(faction)) {
      refused.push(`names: ${faction}`);
      continue;
    }
    const a = loadAsset(root, n);
    if (!a) continue;
    const hashes = (rootOf(a).LocalizedNames ?? []).map((r) => a.objects[r.$ref]?.StringHash).filter((h) => typeof h === 'number').map(hexOf);
    const table = strings?.strings ?? strings ?? {};
    bots[faction] = { names: hashes.map((h) => table[h] ?? null).filter(Boolean), _source: `${n}#AIPlayerNames.LocalizedNames` };
  }

  return { scenarios, params, base, bots, refused };
}

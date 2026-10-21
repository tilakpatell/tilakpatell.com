// The Instant Action Overhaul V2's rulebook (src/data/bf2017/mods/iao-v2.json):
// what the mod does to an AutoPlayer, from its own records
// (`bf2-re/data/mods/iao-v2/ebx/`, read by scripts/lib/bf2017-mods.mjs):
//
//   options     its AI options (IAIAI*): each one's record, steps and default
//   steps       the five steps of its aim, reaction, dodging, jumping,
//               abilities and lightsaber options and what each sets
//   adaptive    its adaptive difficulty: each team's aim noise scale drawn
//               again, evenly, from its ten every so many seconds
//   autoPlayers its hub's own settings (the prefab that holds the steps'),
//               among them the squad-spawn probability
//   container   the server settings it renames or changes (the AutoPlayer counts)
//   records     its 34 AutoPlayer records (those that hold an AutoPlayer's
//               settings or its manager), the sequel era's refused
//   kits        its AI kits (`S7_2/Gameplay/Kits/AI/`): side, era, class, the AI
//               body, and the Skirmish template and tactics that body plays
//               (ai.json's `skirmish`); `kitTemplates` the same by era, side and class
//   botLogic   the command posts' deal (ai/botLogicOverhaul.js): its times, its
//               radius, the return, the table of twelve
//
// Which record is which is found by what it holds (the steps are the record
// whose SelectEvents are a five-step option's, the hub the record that holds
// the steps' prefab), except the deal's: those addresses were read by hand on
// 2026-10-13 (NOTES.md, "The Overhaul's bot logic") and are listed in DEAL,
// each read back from its record here, so a number is the record's and only
// the address is the hand's.
//
//   iaoRulebook({ load, list, vanilla, ai }) → rulebook
//     load(name) → asset; list() → [{ name, text }] of every record (text: its JSON);
//     vanilla: gameSettings.json's `settings`; ai: ai.json's rows

import { containerDiff, graphOf, hashOf, kitRow, optionChannels, sequelMod, settingRows, spreadOf, stepTables, STEP_EVENTS } from './bf2017-mods.mjs';

// The site's names for the mod's options (instantAction.js's rows `overhaul.<name>`), by hand.
export const OPTIONS = { IAIAIDifficulty: 'aim', IAIAIReactionTimes: 'reaction', IAIAIDodging: 'dodging', IAIAIJumping: 'jumping', IAIAIAbilities: 'abilities', IAIAILightsaberAggression: 'lightsaber', IAIAIAdaptiveDifficulty: 'adaptive', IAIAISquad: 'squad' };

const PF_BOT_LOGIC = 'addons/mode1/gameplay/pf_bot_logic';
// The deal's numbers by address (record, object, field), read by hand on 2026-10-13 and read back here.
export const DEAL = {
  hold: ['e997b471-26f3-4b97-8593-eefb13bbc1b2', 4, 'Delay'], // the start's hold after the mode starts
  startLag: ['e997b471-26f3-4b97-8593-eefb13bbc1b2', 7, 'Delay'], // then the start told, a tenth after
  every: [PF_BOT_LOGIC, 3, 'Delay'], // the deal's period
  lag: [PF_BOT_LOGIC, 15, 'Delay'], // a deal let through, then made a tenth after
  limit: ['4f5621f1-0e5b-411d-8577-d54631bfc015', 3, 'Delay'], // the limiter: not twice in this
  moveRadius: ['49bf0a13-06eb-4618-98aa-0122b145ce3b', 3, 'MoveAreaRadius'], // to the post, within this
  defendRadius: ['49bf0a13-06eb-4618-98aa-0122b145ce3b', 2, 'DefendAreaRadius'], // then defend it, within this
  respawn: ['e997b471-26f3-4b97-8593-eefb13bbc1b2', 1, 'ValueIfFalse'], // a fallen bot's RespawnDelay once started
  respawnBefore: ['e997b471-26f3-4b97-8593-eefb13bbc1b2', 1, 'ValueIfTrue'], // and before: none comes back
};
// The table: a side's EventSwitch of twelve outputs (Out0 … Out11), each firing one of four prefab
// references; which reference is which entry (X, Y, M, F: what each tests is botLogicOverhaul.js's) by hand.
export const TABLE = { record: 'aa720ab6-defb-4a68-8c3c-cc596bb8a4ce', switch: 4, letters: { 2: 'X', 3: 'Y', 1: 'M', 5: 'F' } };

const short = (name) => (name ? name.slice(name.lastIndexOf('/') + 1) : null);

// one number of the deal, read back from its record
function at(load, [record, index, field]) {
  const asset = load(record);
  const o = asset?.objects?.[index];
  if (!o || typeof o[field] !== 'number') throw new Error(`${record}#${index}.${field}: not a number in the mod's records`);
  return { value: o[field], _source: `${record}#${index}.${field}` };
}

// the table of twelve: the switch's outputs in order, each the letter of the reference it fires
function tableOf(load) {
  const asset = load(TABLE.record);
  const g = graphOf(asset);
  const n = g.objects[TABLE.switch]?.OutEvents;
  if (!n) throw new Error(`${TABLE.record}#${TABLE.switch}: no EventSwitch`);
  const entries = Array.from({ length: n }, (_, k) => {
    const to = g.events.find((e) => e.from === TABLE.switch && e.event === hashOf(`Out${k}`))?.to;
    if (!(to in TABLE.letters)) throw new Error(`${TABLE.record}#${TABLE.switch}: Out${k} fires #${to}, not one of the table's references`);
    return TABLE.letters[to];
  });
  return { entries, refs: Object.fromEntries(Object.entries(TABLE.letters).map(([i, l]) => [l, `${TABLE.record}#${i}.Blueprint`])), _source: `${TABLE.record}#${TABLE.switch}.OutEvents`, letters: 'hand' };
}

// The Skirmish template an AI body plays for a class: the B1's body the Separatists', every other the class's
// own (ai.json's skirmish.templates, keyed `heavy`, `heavy_separatist`)
const templateKey = (k) => (k.class && k.class !== 'hero' && /_Skirmish$/i.test(k.aiBody ?? '') ? `${k.class}${/_B1_/i.test(k.aiBody) ? '_separatist' : ''}` : null);

export function iaoRulebook({ load, list, vanilla, ai }) {
  const records = list();
  const refused = new Set();
  const keep = (name) => {
    if (!sequelMod(name)) return true;
    refused.add(name);
    return false;
  };

  // the options: GUID → UniqueId, and the AI ones with their steps and default
  const optionNames = new Map();
  const options = {};
  for (const r of records.filter((r) => r.text.includes('"type":"ProfileOptionData'))) {
    const a = JSON.parse(r.text);
    const o = a.objects[a.root];
    if (!keep(o.UniqueId)) continue;
    optionNames.set(a.name, o.UniqueId);
    if (!(o.UniqueId in OPTIONS)) continue;
    const items = o.Items ?? [];
    options[OPTIONS[o.UniqueId]] = { option: o.UniqueId, items: items.length, default: items.findIndex((i) => i.Default), _source: `${a.name}#${a.root}.Items` };
  }

  // the AutoPlayer records: those holding an AutoPlayer's settings or its manager
  const apRecords = records.filter((r) => r.text.includes('"AutoPlayerSettingsEntityData"') || r.text.includes('"AutoPlayerManagerEntityData"'));
  const index = [];
  const graphs = new Map();
  for (const r of apRecords) {
    const a = JSON.parse(r.text);
    const count = (t) => a.objects.filter((o) => o?.$type === t).length;
    const row = { record: a.name, type: a.type, settings: count('AutoPlayerSettingsEntityData'), managers: count('AutoPlayerManagerEntityData') };
    if (!keep(a.name)) continue;
    index.push(row);
    graphs.set(a.name, { asset: a, g: graphOf(a) });
  }
  index.sort((x, y) => (x.record < y.record ? -1 : 1));

  // the options hub (the record reading the most options) gives each channel property its option
  const hubOf = [...graphs.values()].map(({ asset, g }) => ({ asset, g, n: g.objects.filter((o) => o?.$type === 'GetProfileOptionEntityData').length })).sort((x, y) => y.n - x.n)[0];
  const channels = optionChannels(hubOf.g, optionNames);

  // the steps: every record's five-step selects, by option; a second record's same table is noted beside
  const steps = {};
  let stepsRecord = null;
  for (const [name, { g }] of graphs)
    for (const t of stepTables(g, name, channels)) {
      const key = OPTIONS[t.option] ?? t.option;
      if (!steps[key]) {
        steps[key] = { option: t.option, steps: STEP_EVENTS.map((s) => s[0].toLowerCase() + s.slice(1)), default: options[key]?.default ?? null, settings: t.settings, _source: t._source };
        if (key === 'aim') stepsRecord = name;
        continue;
      }
      for (const [setting, row] of Object.entries(t.settings)) {
        const mine = steps[key].settings[setting];
        if (mine && JSON.stringify(mine.values) !== JSON.stringify(row.values)) throw new Error(`${t._source}: ${setting} differs from ${steps[key]._source}`);
        if (!mine) steps[key].settings[setting] = row;
      }
      (steps[key].also ??= []).push(t._source);
    }

  // the adaptive difficulty: the record whose selects feed each team's aim noise scale
  let adaptive = null;
  for (const [name, { g }] of graphs) {
    const s = spreadOf(g, name);
    if (s?.settings.some((n) => /^AimNoiseScaleTeam\d$/.test(n))) adaptive = { option: 'IAIAIAdaptiveDifficulty', default: options.adaptive ? options.adaptive.default === 1 : null, ...s };
  }

  // the hub: the record that holds the steps' prefab; its own settings, the squad-spawn probability among them
  const hub = [...graphs.entries()].find(([, { asset }]) => asset.objects.some((o) => o?.$type === 'LogicPrefabReferenceObjectData' && o.Blueprint?.$asset === stepsRecord));
  const autoPlayers = hub ? { record: hub[0], rows: settingRows(hub[1].g, hub[0]).map(({ setting, value, _source }) => ({ setting, value, _source })) } : null;
  const squadRows = autoPlayers?.rows.filter((r) => r.setting === 'SquadSpawnProbability') ?? [];
  if (squadRows.length !== 1) throw new Error(`the hub sets the squad-spawn probability ${squadRows.length} times`);

  // the server settings: the container against the game's
  const container = load('online/gamesettingscontainer');
  const settings = containerDiff(container, container.name, vanilla);

  // the AI kits, and the Skirmish template and tactics each one's AI body plays
  const kits = [];
  for (const r of records.filter((r) => r.name.startsWith('s7_2/gameplay/kits/ai/') && r.text.includes('"type":"WSSoldierCustomizationKitAsset"'))) {
    const a = JSON.parse(r.text);
    const k = kitRow(a, a.name);
    if (!k || !keep(a.name) || !keep(k.kit) || (k.era && !keep(`Faction_${k.era}`))) continue;
    const key = templateKey(k);
    const t = key ? ai.skirmish?.templates?.[key] : null;
    kits.push({ kit: short(k.kit), side: k.side, era: k.era, class: k.class, aiBody: short(k.aiBody), template: t ? key : null, tactics: t?.tactics ?? null, _source: k._source, ...(t ? { template_source: t._source } : {}) });
  }
  kits.sort((x, y) => (x.kit < y.kit ? -1 : 1));
  // (the same by era, side and class: what a bot's template is, the rows the sim reads, each the first
  // kit's; a class whose kits disagree would throw)
  const kitTemplates = {};
  for (const k of kits) {
    if (!k.era || !k.side || !k.template) continue;
    const at = ((kitTemplates[k.era] ??= {})[k.side] ??= {});
    const row = (at[k.class] ??= { template: k.template, tactics: k.tactics, aiBody: k.aiBody, kits: 0, _source: k._source, template_source: k.template_source });
    if (row.template !== k.template) throw new Error(`${k.kit}: the ${k.era} ${k.side} ${k.class} kits play ${row.template} and ${k.template}`);
    row.kits++;
  }

  const botLogic = Object.fromEntries(Object.entries(DEAL).map(([k, address]) => [k, at(load, address)]));
  botLogic.table = tableOf(load);

  return {
    options,
    steps,
    adaptive,
    autoPlayers,
    squadSpawn: { value: squadRows[0].value, _source: squadRows[0]._source },
    container: settings,
    records: index,
    kits,
    kitTemplates,
    botLogic,
    refused: [...refused].sort(),
  };
}

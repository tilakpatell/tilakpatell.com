// The mods' reader on three of the Instant Action Overhaul V2's own records,
// cut to what it reads (scripts/fixtures/bf2017/mods/iao-v2/, `node
// scripts/bf2017-mods.mjs fixture`): its five-step options, its adaptive
// difficulty and one of its AI kits.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { containerDiff, fieldValue, graphOf, hashOf, kitRow, optionChannels, sequelMod, settingRows, spreadOf, stepTables } from './bf2017-mods.mjs';

const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/bf2017/mods/iao-v2/${name}.json`, import.meta.url), 'utf8'));
const STEPS = '5783324c-2b78-418d-8aad-4458b7dfb32a';
const SPREAD = 'c526bd5a-7386-4b10-94a9-c647325de279';
const steps = fixture(STEPS);
const spread = fixture(SPREAD);
const kit = fixture('s7_2_gameplay_kits_ai_heavy_ot_kit_l_heavy_ot_ap-hoth');

// the options' channel properties, as the mod's options hub feeds them (optionChannels on the hub record)
const CHANNELS = new Map([
  [hashOf('IAIAIDifficulty'), 'IAIAIDifficulty'],
  [-656069254, 'IAIAIReactionTimes'],
  [hashOf('IAIAIDodging'), 'IAIAIDodging'],
]);

// the object a source names, in the record it names
const objectAt = (asset, source) => asset.objects[Number(/#(\d+)/.exec(source)[1])];

describe('the engine’s names', () => {
  it('are the djb2-xor hash the export’s ids are', () => {
    expect(hashOf('Selected')).toBe(1570873612);
    expect(hashOf('Value')).toBe(225375086);
    expect(hashOf('AimNoiseScale')).toBe(-1932920026);
    expect(hashOf('VeryEasy') >>> 0).toBe(0xbe2a9213);
  });

  it('reads an interface field’s text as its value', () => {
    expect(fieldValue('Float32 0.125')).toBe(0.125);
    expect(fieldValue('Int32 27')).toBe(27);
    expect(fieldValue('Boolean True')).toBe(true);
    expect(fieldValue('')).toBe(null);
  });
});

describe('the step tables', () => {
  const tables = stepTables(graphOf(steps), STEPS, CHANNELS);
  const of = (option) => tables.find((t) => t.option === option);

  it('are the aim’s, the reaction’s and the dodging’s five steps, each setting by step', () => {
    expect(of('IAIAIDifficulty').steps).toEqual(['VeryEasy', 'Easy', 'Medium', 'Hard', 'VeryHard']);
    expect(of('IAIAIDifficulty').settings.AimNoiseScale.values).toEqual([100, 5, 1, 0.5, 0.125]);
    expect(of('IAIAIReactionTimes').settings.LofReactionTimeS.values).toEqual([0.5, 0.3, 0.1, 0.05, 0]);
    expect(of('IAIAIDodging').settings.EvasiveManeuversDodgeRollProbability.values).toEqual([0, 0.01, 0.05, 0.1, 1]);
  });

  it('leaves a step that fires no setting empty: the aim’s field of view has no Hard', () => {
    expect(of('IAIAIDifficulty').settings.TargetTrackerFieldOfViewDegrees.values).toEqual([40, 80, 110, null, 180]);
  });

  it('names each value’s interface field and each table’s select', () => {
    const t = of('IAIAIDifficulty');
    expect(objectAt(steps, t._source).$type).toBe('SelectEventEntityData');
    for (const s of t.settings.AimNoiseScale._source) expect(s).toMatch(new RegExp(`^${STEPS}#\\d+\\.Fields\\[0x[0-9a-f]{8}\\]$`));
    expect(objectAt(steps, t.settings.AimNoiseScale._source[0]).$type).toBe('InterfaceDescriptorData');
  });

  it('names an option it cannot place by its channel property’s hash', () => {
    const anon = stepTables(graphOf(steps), STEPS, new Map());
    expect(anon.find((t) => t.settings.AimNoiseScale).option).toBe(`0x${(hashOf('IAIAIDifficulty') >>> 0).toString(16)}`);
  });
});

describe('the adaptive difficulty', () => {
  const s = spreadOf(graphOf(spread), SPREAD);

  it('draws each team’s aim noise scale from ten, evenly, every fifteen seconds, set a tenth after', () => {
    expect(s.settings.sort()).toEqual(['AimNoiseScaleTeam1', 'AimNoiseScaleTeam2']);
    expect(s.scales).toEqual([0.15, 0.3, 0.6, 0.8, 1, 1.1, 1.35, 1.55, 1.95, 2.5]);
    expect(s.every).toBe(15);
    expect(s.lag).toBe(0.1);
    expect(s.uniform).toBe(true);
  });

  it('names the Float each scale is, the delay that repeats it and the random event', () => {
    s._source.scales.forEach((src, k) => expect(objectAt(spread, src).DefaultValue).toBe(s.scales[k]));
    expect(objectAt(spread, s._source.every).$type).toBe('DelayEntityData');
    expect(objectAt(spread, s._source.uniform).$type).toBe('RandomMultiEventEntityData');
  });

  it('is not found in a graph with no select feeding a setting', () => {
    expect(spreadOf(graphOf(kit), 'kit')).toBe(null);
  });
});

describe('a kit', () => {
  it('is its faction’s side and era, its class, its body and the AI body the game spawns it with', () => {
    expect(kitRow(kit, kit.name)).toMatchObject({ kit: 'S7_2/Gameplay/Kits/AI/Heavy/OT/Kit_L_Heavy_OT_AP-HOTH', side: 'light', era: 'Orig', class: 'heavy', body: 'Gameplay/Characters/StormTrooperShared', aiBody: 'Gameplay/Characters/StormTrooperAI_Skirmish' });
  });

  it('is not read from a record that is not one', () => {
    expect(kitRow(spread, SPREAD)).toBe(null);
  });
});

describe('the settings a graph sets', () => {
  it('are each setting’s constant with the field it comes from', () => {
    const rows = settingRows(graphOf(spread), SPREAD);
    // (the spread's two are fed by its selects, worked out in the graph: no constant)
    expect(rows).toEqual([]);
    const aim = settingRows(graphOf(steps), STEPS).filter((r) => r.setting === 'AimNoiseScale');
    expect(aim.map((r) => r.value).sort((a, b) => a - b)).toEqual([0.125, 0.5, 1, 5, 100]);
  });
});

describe('the options a hub reads', () => {
  it('are followed down to the channel property each feeds', () => {
    const hub = {
      root: 0,
      objects: [
        { $type: 'LogicPrefabBlueprint', PropertyConnections: [{ Source: { $ref: 1 }, Target: { $ref: 2 }, SourceFieldId: 1, TargetFieldId: 2 }, { Source: { $ref: 2 }, Target: { $ref: 3 }, SourceFieldId: 3, TargetFieldId: -656069254 }] },
        { $type: 'GetProfileOptionEntityData', OptionData: { $asset: '7d4be957' } },
        { $type: 'ClientIntToServerEntityData' },
        { $type: 'SchematicChannelEntityData' },
      ],
    };
    expect(optionChannels(graphOf(hub), new Map([['7d4be957', 'IAIAIReactionTimes']]))).toEqual(new Map([[-656069254, 'IAIAIReactionTimes']]));
  });
});

describe('the server settings', () => {
  it('a row the mod renames is the game’s no longer found, one it changes is noted beside the game’s', () => {
    const node = (i, SettingName, DefaultValue) => ({ $type: 'GameSettingNode', SettingName, SettingType: 'GameSettingType_Int', DefaultValue, GameSettings: [] });
    const asset = { root: 0, objects: [{ $type: 'GameSettingsContainer' }, node(1, 'TeamSize_AutoPlayers_Mode8 Mophead', '0'), node(2, 'GameMode_Blast_MinPlayersToStart', '2'), node(3, 'IAIMaxRey', '32')] };
    const d = containerDiff(asset, 'c', { TeamSize_AutoPlayers_Mode8: 16, GameMode_Blast_MinPlayersToStart: 4 });
    expect(d.renamed).toEqual([{ name: 'TeamSize_AutoPlayers_Mode8', as: 'TeamSize_AutoPlayers_Mode8 Mophead', value: 0, game: 16, _source: 'c#1.DefaultValue' }]);
    expect(d.changed).toEqual([{ name: 'GameMode_Blast_MinPlayersToStart', value: 2, game: 4, _source: 'c#2.DefaultValue' }]);
    // (and the sequel era's own row is left out)
    expect(d.added).toEqual([]);
  });
});

describe('the sequel era', () => {
  it('is refused in the mod’s own short names', () => {
    for (const n of ['s7_2/gameplay/kits/ai/heavy/nt/kit_l_heavy_nt_ap_ja', 's9_3/coop_nt_mc85/gamemodes_flow', 'IAIMaxBB8', 'IAIMaxFOFlame', 'IAIMaxResSpy', 'IAIMaxKyloRen', 'IAILightingJakku', 'Faction_NewEra', 's9/takodana_02/gamemodes_flow', 'addons/pve/gameplay/teams/pf_pve_teams_fosd']) expect(sequelMod(n)).toBe(true);
    for (const n of ['s7_2/gameplay/kits/ai/heavy/ot/kit_l_heavy_ot_ap-hoth', 'IAIMaxBossk', 'IAIAIReactionTimes', 'IAILightingHoth', 'Faction_Orig', 'IAIMaxGrievous', 'IAIMaxRepCommando', 's9_3/hoth_02/gamemodes_flow']) expect(sequelMod(n)).toBe(false);
  });
});

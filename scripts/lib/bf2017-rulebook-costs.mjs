// The costs the game keeps as records (decision 5 of the galaxy-on-the-game
// design): the Battle Point prices (points.json) and the kit limits
// (kits.json).
//
// Online/BattlepointCostData (BattlepointCostData):
//   HeroCostConfig[]  { GameMode, BattlepointHeroCostEntries[{ Hero, EraCost, NoneEraCost }] }
//                     one table, PLANETARY_BATTLES, every hero 4,000 (EraCost
//                     and NoneEraCost alike; EraCost is read)
//   UnitCostConfig[]  { GameMode, Map, BattlepointUnitCostEntries[{ Character, Cost }] }
//                     PLANETARY_BATTLES with Map "" is the default price list
//                     (58 rows); each map's own (HOTH, ENDOR, …) is the price
//                     list on that map; Mode_5 has KESSEL's and JABBASPALACE's.
//                     The tables with Map GLOBAL, and any name in a map's table
//                     that is no unit of the default list, are the mode's
//                     settings (spawn times, round times, HvV's tickets and
//                     enabled heroes, the sabers' stamina costs), not prices.
//                     The record holds no score events: what a kill earns stays
//                     by hand (NOTES.md).
//
// A Character is a rulebook id where the rulebooks hold it (UNITS); an OT or
// PT unit they do not hold yet keeps the record's name under `other`; the
// sequel era's are refused.

import { isSequel, loadAsset, rootOf } from './bf2017-ebx.mjs';

const RECORD = 'Online/BattlepointCostData';

export const HEROES = {
  CHEWBACCA: 'chewbacca',
  HAN_SOLO: 'hansolo',
  LANDO: 'lando',
  LEIA: 'leia',
  LUKE_SKYWALKER: 'luke',
  YODA: 'yoda',
  'OBI-WAN_KENOBI': 'obiwan',
  ANAKIN_SKYWALKER: 'anakin',
  BOBA_FETT: 'bobafett',
  BOSSK: 'bossk',
  DARTH_VADER: 'darthvader',
  EMPEROR_PALPATINE: 'emperor',
  DARTH_MAUL: 'maul',
  IDEN_VERSIO: 'iden',
  GRIEVOUS: 'grievous',
  COUNT_DOOKU: 'dooku',
};

// Character → reinforcements.json / vehicles.json id
export const UNITS = {
  WOOKIE_WARRIOR: 'WookieWarrior',
  REBEL_JUMPTROOPER: 'RebelJumpTrooper',
  EWOKREBEL: 'EwokRebel',
  DEATHTROOPER: 'DeathTrooper',
  JUMPTROOPER: 'JumpTrooper',
  ISBAGENT: 'ISBAgent',
  XWING_T65: 'Kit_Vehicle_Xwing_T65',
  ATRT_REBEL: 'Kit_Vehicle_ATRT_Rebel',
  AIRSPEEDER_T47: 'Kit_Vehicle_AirSpeeder_T47',
  Y_WING: 'Kit_Vehicle_Ywing',
  A_WING: 'Kit_Vehicle_Awing',
  TIE_FIGHTER: 'Kit_Vehicle_TieFighter',
  TIE_INTERCEPTOR: 'Kit_Vehicle_TieInterceptor',
  TIE_BOMBER: 'Kit_Vehicle_TieBomber',
  ATST: 'Kit_Vehicle_ATST',
  // (the AT-AT a player takes the guns of on Hoth: the team's AT-AT kit; a reading, NOTES.md)
  ATAT: 'Kit_Vehicle_ATAT_Objective',
};

// The sequel era's units the shared matcher (isSequel) does not know by
// these spellings: the First Order's and the Resistance's, and the units
// only the sequel maps' tables list.
const SEQUEL_UNITS = new Set(['RESISTENCE_JUMPTROOPER', 'FIRSTORDER_JUMPTROOPER', 'FLAMETROOPER', 'X_WING_T70', 'A_WING_RZ3', 'LANDSPEEDER_LIUV', 'LANSPEEDER_LIUV_RESISTENCE', 'NT_SKISPEEDER', 'TIE_FIGHTER_FIRSTORDER', 'TIE_FIGHTER_SPECIALFORCES', 'FO_ATST', 'GUNNER', 'RESISTANCESPY', 'BERMUDACOP', 'JUMPCOP', 'CAPTAIN_PHASMA']);
const sequel = (name) => SEQUEL_UNITS.has(name) || isSequel(name.toLowerCase());
// the same units' kits, by their gameplay assets' names
const SEQUEL_KITS = /Flametrooper|Gunner|BermudaCop|JumpCop|AwingRZ3|Landspeeder_LIUV|NT_Skispeeder|FO_ATST|TieFighter_SpecialForces|T70|SmokeyBear/i;
const sequelKit = (kit) => isSequel(kit) || SEQUEL_KITS.test(kit);

// The record's game modes → the site's mode ids
export const MODES = {
  PLANETARY_BATTLES: 'galacticAssault',
  PLANETARY_MISSIONS: 'strike',
  BLAST: 'blast',
  HEROES_VERSUS_VILLIANS: 'hvv',
  SPACE_BATTLE: 'starfighter',
  MODE_1: 'supremacy',
  MODE_3: 'ewokHunt',
  MODE_5: 'extraction',
  MODE_6: 'showdown',
  MODE_7: 'heroStarfighters',
  MODE_9: 'coop',
  MODE_DEFEND: 'coopDefend',
  MODE_C: 'jetpackCargo',
  GLOBAL: 'global',
};

// The record's maps → the game's level keys
export const MAPS = {
  HOTH: 'hoth_01',
  ENDOR: 'endor_01',
  TATOOINE: 'tatooine_01',
  YAVIN: 'yavin_01',
  DEATHSTAR2: 'deathstar02_01',
  KASHYYYK: 'kashyyyk_01',
  KAMINO: 'kamino_01',
  NABOO: 'naboo_01',
  GEONOSIS: 'geonosis_01',
  KESSEL: 'kessel_01',
  JABBASPALACE: 'jabbaspalace_01',
};

// The game as played, where the record says nothing (NOTES.md)
const EARN = { source: 'hand', kill: 100, assist: 50, objectiveTick: 10, objectiveDamage: 1, vehicleKill: 150, heroKill: 250, squadSpawn: 25 };
const LIMITS = { source: 'hand', heroesPerTeam: 1, reinforcementsPerTeam: 4 };
const BP_RATE = { source: 'hand', value: 1 };

const set = (into, key, value, source) => {
  into[key] = value;
  into[`${key}_source`] = source;
};

export function pointsRulebook(root) {
  const asset = loadAsset(root, RECORD);
  if (!asset) throw new Error(`${RECORD}: not in ${root}`);
  const r = rootOf(asset);
  const at = (path) => `${RECORD}#${r.$type}.${path}`;
  const refused = new Set();
  const out = { cost: { heroes: {}, units: {}, other: {}, byMode: {} }, settings: {}, earn: { ...EARN }, limits: { ...LIMITS }, bpRate: { ...BP_RATE }, refused: [] };

  // the heroes
  const counts = new Map();
  (r.HeroCostConfig ?? []).forEach((cfg, c) => {
    if (MODES[String(cfg.GameMode).toUpperCase()] !== 'galacticAssault') return;
    (cfg.BattlepointHeroCostEntries ?? []).forEach((e, i) => {
      const id = HEROES[e.Hero];
      const src = at(`HeroCostConfig.${c}.BattlepointHeroCostEntries.${i}.EraCost`);
      if (sequel(e.Hero)) return void refused.add(e.Hero);
      if (!id) return void set(out.cost.other, e.Hero, e.EraCost, src);
      set(out.cost.heroes, id, e.EraCost, src);
      counts.set(e.EraCost, (counts.get(e.EraCost) ?? 0) + 1);
    });
  });
  const common = [...counts].sort((a, b) => b[1] - a[1])[0];
  if (common) set(out.cost.heroes, 'default', common[0], 'derived: the most common EraCost of HeroCostConfig');

  // the default price list says which names are units; the rest are settings
  const configs = r.UnitCostConfig ?? [];
  const isDefault = (cfg) => MODES[String(cfg.GameMode).toUpperCase()] === 'galacticAssault' && !cfg.Map;
  const unitNames = new Set(configs.filter(isDefault).flatMap((cfg) => (cfg.BattlepointUnitCostEntries ?? []).map((e) => e.Character)));

  const prices = (cfg, c, into) => {
    (cfg.BattlepointUnitCostEntries ?? []).forEach((e, i) => {
      const src = at(`UnitCostConfig.${c}.BattlepointUnitCostEntries.${i}.Cost`);
      if (!unitNames.has(e.Character)) {
        into.settings ??= {};
        if (!sequel(e.Character)) set(into.settings, e.Character, e.Cost, src);
        return;
      }
      if (sequel(e.Character)) return void refused.add(e.Character);
      const id = UNITS[e.Character];
      if (id) set((into.units ??= {}), id, e.Cost, src);
      else set((into.other ??= {}), e.Character, e.Cost, src);
    });
  };

  configs.forEach((cfg, c) => {
    const mode = MODES[String(cfg.GameMode).toUpperCase()];
    if (!mode) return;
    if (isDefault(cfg)) {
      const t = {};
      prices(cfg, c, t);
      Object.assign(out.cost.units, t.units);
      Object.assign(out.cost.other, t.other);
      return;
    }
    if (!cfg.Map || cfg.Map === 'GLOBAL') {
      const s = (out.settings[mode] ??= {});
      (cfg.BattlepointUnitCostEntries ?? []).forEach((e, i) => {
        if (!sequel(e.Character.replace(/^LIGHTSABER_COSTS_\w*?_(?=[A-Z]+$)/, ''))) set(s, e.Character, e.Cost, at(`UnitCostConfig.${c}.BattlepointUnitCostEntries.${i}.Cost`));
      });
      return;
    }
    const level = MAPS[cfg.Map];
    if (!level || sequel(cfg.Map)) return void refused.add(cfg.Map);
    const t = { map: cfg.Map };
    prices(cfg, c, t);
    (out.cost.byMode[mode] ??= {})[level] = t;
  });

  out.refused = [...refused].sort();
  return out;
}

// ── the kit limits ───────────────────────────────────────────────────────
//
// A PF_KitLimitations_* prefab (LogicPrefabBlueprint) holds
// KitLimitationEntityData rows: { KitId, MaxCountProperty, PriceProperty,
// EnabledAtStageProperty }. KitId is the Identifier of the kit's gameplay
// asset (GP_*, WSSoldier/VehicleCustomizationGameplayAsset); each *Property
// is a field id the prefab's PropertyConnections bind (TargetFieldId), and
// the value is read back up the graph from that connection's source:
//
//   InterfaceDescriptorData      the prefab's own field: its default (`Int32 6`,
//                                `Boolean True` as 1), or what the prefab that
//                                holds this one binds to it
//   LogicPrefabReferenceObjectData  another prefab (PF_HeroKitMaxCount…): its
//                                output field, read inside it
//   PropertyCast, SyncedBool/Int, And, IntHub   passed through (IntHub: the
//                                input its InputSelect picks, HashedInput[1 + n])
//   MathEntityData               its little assembly (inputs, constants, `>`,
//                                the select function)
//   BattlepointUnit/HeroCostEntityData   the price, from Online/BattlepointCostData
//   DynamicDebugVariableEntityData   a debug override, unset: true
//
// Where the chain ends anywhere else (a SelectInt, a Math whose input is
// the Arcade's setting), the value is unread and the row says so.

const KIT_PREFABS = {
  planetaryBattles: 'Gameplay/GameModes/Shared/PF_KitLimitations_PlanetaryBattles',
  hvv: 'Gameplay/GameModes/Shared/PF_KitLimitations_HeroesVSVillains',
  trooperModes: 'Gameplay/GameModes/Shared/PF_KitLimitations_TrooperModes',
  skirmish: 'Gameplay/GameModes/Shared/PF_KitLimitations_Skirmish',
  skirmishSpace: 'Gameplay/GameModes/Shared/PF_KitLimitations_Skirmish_Space',
};
const FIELDS = { maxCount: 'MaxCountProperty', price: 'PriceProperty', stage: 'EnabledAtStageProperty' };
// the game as played, where the graph gives no number (NOTES.md)
const PLAYED = { hero: 1, special: 4 };

const u32 = (n) => n >>> 0;
const SELECT = 193418243; // (MathEntityData's select function: cond ? a : b)

function fieldValue(v) {
  const [type, x] = String(v ?? '').split(' ');
  if (/^U?Int/.test(type) || /^Float/.test(type)) return Number(x);
  if (type === 'Boolean') return x === 'True' ? 1 : 0;
  return null;
}

// The value a graph puts out on (object, field): { value, source } or null
function valueOf(root, ctx, i, field, record, depth = 0) {
  if (depth > 24) return null;
  const { asset } = ctx;
  const o = asset.objects[i];
  const pcs = rootOf(asset).PropertyConnections ?? [];
  const into = (t, f) => pcs.filter((c) => c.Target?.$ref === t && (f == null || u32(c.TargetFieldId) === u32(f)));
  const from = (c) => valueOf(root, ctx, c.Source.$ref, c.SourceFieldId, record, depth + 1);
  // (a field bound more than once: the first binding that reads)
  const first = (cs) => {
    for (const c of cs) {
      const v = from(c);
      if (v) return v;
    }
    return null;
  };
  const at = (path) => `${asset.name}#${o.$type}.${path}`;
  switch (o?.$type) {
    case 'InterfaceDescriptorData': {
      const f = (o.Fields ?? []).find((x) => u32(x.Id) === u32(field));
      if (!f) return null;
      // (a field the holding prefab binds wins over its default)
      if (ctx.outer) {
        for (const c of (rootOf(ctx.outer.asset).PropertyConnections ?? []).filter((x) => x.Target?.$ref === ctx.ref && u32(x.TargetFieldId) === u32(field))) {
          const v = valueOf(root, ctx.outer, c.Source.$ref, c.SourceFieldId, record, depth + 1);
          if (v) return v;
        }
      }
      const v = fieldValue(f.Value);
      if (v != null) return { value: v, source: at(`Fields.${o.Fields.indexOf(f)}.Value`) };
      // (an output field: what the prefab binds to it inside)
      return first(into(i, field));
    }
    case 'LogicPrefabReferenceObjectData': {
      const inner = loadAsset(root, o.Blueprint?.$asset);
      if (!inner) return null;
      const face = inner.objects.findIndex((x) => x?.$type === 'InterfaceDescriptorData');
      return face < 0 ? null : valueOf(root, { asset: inner, outer: ctx, ref: i }, face, field, record, depth + 1);
    }
    case 'PropertyCastEntityData':
    case 'SyncedBoolEntityData':
    case 'SyncedIntEntityData':
      return first(into(i));
    case 'AndEntityData': {
      const ins = into(i).map(from);
      if (ins.some((x) => !x)) return null;
      return { value: ins.every((x) => x.value) ? 1 : 0, source: ins.find((x) => !/DynamicDebug/.test(x.source))?.source ?? at('Inputs') };
    }
    case 'DynamicDebugVariableEntityData':
      return { value: 1, source: at('VariableType') };
    case 'IntHubEntityData': {
      const hashes = o.HashedInput ?? [];
      const want = hashes.length > (o.InputCount ?? 0) ? hashes[1 + (o.InputSelect ?? 0)] : hashes[o.InputSelect ?? 0];
      return first(into(i, want));
    }
    case 'MathEntityData':
      return mathOf(o, (f) => first(into(i, f)), at);
    case 'BattlepointUnitCostEntityData':
    case 'BattlepointHeroCostEntityData':
      return record(o);
    default:
      return null;
  }
}

// MathEntityData's assembly: int and bool registers, as the export writes it
function mathOf(o, input, at) {
  const I = [];
  const B = [];
  const fns = o.Assembly?.FunctionCalls ?? [];
  let used = null;
  for (const ins of o.Assembly?.Instructions ?? []) {
    switch (ins.Code) {
      case 'MathOpCode_InputI': {
        const v = input(ins.Param1);
        if (!v) return null;
        I[ins.Result] = v.value;
        used = v.source;
        break;
      }
      case 'MathOpCode_ConstI':
        I[ins.Result] = ins.Param1;
        break;
      case 'MathOpCode_GreaterI':
        B[ins.Result] = I[ins.Param1] > I[ins.Param2];
        break;
      case 'MathOpCode_Func': {
        const [c, a, b] = fns[ins.Param2]?.Parameters ?? [];
        if (ins.Param1 !== SELECT) return null;
        I[ins.Result] = B[c] ? I[a] : I[b];
        break;
      }
      case 'MathOpCode_Return':
        return { value: I[ins.Result], source: used ?? at('Assembly') };
      default:
        return null;
    }
  }
  return null;
}

// The record's price a cost entity names
function recordPrice(root) {
  const asset = loadAsset(root, RECORD);
  const r = asset ? rootOf(asset) : null;
  return (o) => {
    if (!r) return null;
    if (o.$type === 'BattlepointHeroCostEntityData') {
      for (const [c, cfg] of (r.HeroCostConfig ?? []).entries()) {
        if (cfg.GameMode !== o.GameMode) continue;
        const k = (cfg.BattlepointHeroCostEntries ?? []).findIndex((e) => e.Hero === o.Hero);
        if (k >= 0) return { value: cfg.BattlepointHeroCostEntries[k][o.EraAppropriate ? 'EraCost' : 'NoneEraCost'], source: `${RECORD}#${r.$type}.HeroCostConfig.${c}.BattlepointHeroCostEntries.${k}.${o.EraAppropriate ? 'EraCost' : 'NoneEraCost'}` };
      }
      return null;
    }
    // (the map's own table, else the default list)
    for (const map of [o.Map ?? '', '']) {
      for (const [c, cfg] of (r.UnitCostConfig ?? []).entries()) {
        if (cfg.GameMode !== o.GameMode || (cfg.Map ?? '') !== map) continue;
        const k = (cfg.BattlepointUnitCostEntries ?? []).findIndex((e) => e.Character === o.Character);
        if (k >= 0) return { value: cfg.BattlepointUnitCostEntries[k].Cost, source: `${RECORD}#${r.$type}.UnitCostConfig.${c}.BattlepointUnitCostEntries.${k}.Cost` };
      }
    }
    return null;
  };
}

// A gameplay asset → the rulebooks' id: a hero's or reinforcement's by its
// kit's folder, a vehicle's `Kit_Vehicle_<name>`
function idOf(gp, books) {
  if (!gp) return null;
  const folder = gp.replace(/^S\d+(_\d+)?\//, '').split('/').slice(0, 4).join('/') + '/';
  for (const book of ['heroes', 'reinforcements']) for (const row of Object.values(books[book] ?? {})) if (row.kit?.startsWith(folder)) return row.id;
  const v = `Kit_Vehicle_${gp.split('/').pop().replace(/^GP_Vehicle_/, '')}`;
  return books.vehicles?.[v] ? v : null;
}
const kindOf = (gp) => (/\/Hero(Vehicle)?\//.test(gp ?? '') ? 'hero' : /\/Specials\//.test(gp ?? '') ? 'special' : /Vehicle/.test(gp ?? '') ? 'vehicle' : null);

export function kitsRulebook(root, { books = {}, gameplay = [] } = {}) {
  const gp = new Map();
  for (const n of gameplay) {
    const a = loadAsset(root, n);
    if (a && rootOf(a).Identifier != null) gp.set(u32(rootOf(a).Identifier), n);
  }
  const record = recordPrice(root);
  const out = {};
  const counts = { rows: 0, named: 0, maxCount: 0, price: 0, refused: 0 };
  for (const [mode, name] of Object.entries(KIT_PREFABS)) {
    const asset = loadAsset(root, name);
    if (!asset) continue;
    const rows = [];
    asset.objects.forEach((k, i) => {
      if (k?.$type !== 'KitLimitationEntityData') return;
      (k.LimitationGroups ?? []).forEach((g, gi) =>
        (g.Limitations ?? []).forEach((l, li) => {
          const kit = gp.get(u32(l.KitId)) ?? null;
          if (kit && sequelKit(kit)) return void counts.refused++;
          counts.rows++;
          if (kit) counts.named++;
          const row = { kit, kitId: u32(l.KitId), id: idOf(kit, books), kind: kindOf(kit), _source: `${name}#KitLimitationEntityData.LimitationGroups.${gi}.Limitations.${li}` };
          for (const [key, prop] of Object.entries(FIELDS)) {
            const c = (rootOf(asset).PropertyConnections ?? []).find((x) => x.Target?.$ref === i && u32(x.TargetFieldId) === u32(l[prop]));
            const v = c ? valueOf(root, { asset }, c.Source.$ref, c.SourceFieldId, record) : null;
            if (v && Number.isFinite(v.value)) {
              set(row, key, v.value, v.source);
              if (key !== 'stage') counts[key]++;
            } else if (key !== 'stage') row[key] = { source: 'hand', value: key === 'maxCount' ? (PLAYED[row.kind] ?? null) : null, hash: `0x${u32(l[prop]).toString(16).padStart(8, '0')}` };
          }
          rows.push(row);
        }),
      );
    });
    out[mode] = { prefab: name, rows };
  }
  return { ...out, counts: { ...counts, _source: 'derived: the rows above, counted (refused: the sequel era’s kits, left out)' } };
}

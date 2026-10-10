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

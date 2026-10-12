// Instant Action: the round a setup screen's choices make, from one call.
// The game's Instant Action is Supremacy against AutoPlayers (the settings'
// group `GameMode/PvE/Instant_Action_Supremacy`, their rows' suffix `_Mode8`:
// bf2-re findings 28 and 34), later the multiplayer modes on their own maps
// too. Every number here is a row of the server's settings
// (`gameSettings.json`), named in the round's `sources`; a row the settings
// lack is the value written beside it, marked 'hand'.
//
//   the sides' sizes   TeamSize_RealPlayer_<Easy|Normal|Hard>_Mode8 (12) the
//                      player's side, the player one of them, and
//                      TeamSize_AutoPlayers_<…>_Mode8 (13) the other; a count
//                      asked for (`bots: { friendly, enemy }`) replaces them
//   the round's length ConquestMaxTickets_<Short|Normal|Long>_Mode8 (50, 100,
//                      200) reinforcements a side, their bleed ×
//                      TicketBleedMult_<…>_Mode8 (2, 1, 0.5)
//   Battle Points      BPRate_<Slow|Default|Fast>_Mode8 (0.5, 1, 2)
//   heroes             Heroes_MaxCount_Team<n>_Mode8 (4) out at once a side,
//                      AutoPlayers_Heroes_MaxCount_Team<n>_Mode8 (3) of them
//                      bots; a side's switch off, none; a count asked, its bots'
//   reinforcements     Specials_MaxCount_Team<n>_Mode8 (12),
//                      AutoPlayers_Specials_MaxCount_Team<n>_Mode8 (10); a
//                      count of none is that side's off (the screen has no switch)
//   vehicles           AutoPlayers_Vehicles_MaxCount_Team<n> (2); off, none
//   the bots           ai/autoPlayer.js's numbers for the side facing the
//                      player (`_Enemies_`) and the side beside them
//                      (`_Friendlies_`), ai/waves.js's tables for each, an
//                      objective mode's by side and stage (`wavesBy`)
//
// The options are the game's own (ai.json's `instantAction`, the profile's
// `Gameplay/Profiles/InstantActionParams/*`): each carries the option it is
// (`option`), its default by that option's index and its items' names from
// the game's strings (`labels`). A count the profile leaves to the settings
// (its default −1) is offered at the rows' number, up to the rows' most.
//
// Read by hand (src/data/bf2017/NOTES.md, "Instant Action"): that the
// RealPlayer row is the player's side's size with the player in it; that the
// screen's Normal, Hard and Expert are, in order, the AutoPlayers' Rookie,
// Normal and Expert rows and the team sizes' Easy, Normal and Hard; that the
// screen's medium length is the rows' Normal; the most a side's count may be
// asked (MAX_SIDE).
//
// What the sim acts on: the level, the mode, the era, the sides' bots
// (AutoPlayers: `pve` off), the difficulty, the Battle Points' rate, the
// reinforcements and their bleed on a mode that counts them, each side's caps
// (its commander's for the bots, the offers' for the side), the AutoPlayers'
// waves for a fallen bot's return and for a hero's or a reinforcement's, and
// their aim, line of fire and strafe (ai/soldierBrain.js reads each side's
// numbers off `sim.instantAction`). Carried, not acted on: the vehicles' caps
// (no vehicle deploys yet), all-era heroes, the dodge roll.
// Pure: no three.js, no DOM.
//
//   erasFor(rulebook, level) → ['Orig', …]
//   optionsFor(gs, { rulebook, level, team }) → [{ id, group: 'modifiers' | 'advanced' | 'faction' | 'site', kind: 'choice' | 'toggle' | 'count', choices?, labels?, min?, max?, default, option, source }]
//     (in the game's screen's order, the enemy's of a pair before the player's side's)
//     (a dotted id is a nested field: `heroes.enemyCount` is choice.heroes.enemyCount)
//   roundFor(gs, choice) → round      (throws on a choice that is not one of the options')
//   startInstantAction({ rulebook, gs, nav, seed, spawns, ...choice }) → { sim, round }
//   applyRound(sim, round)      (sim.js's: the round's length and rate on a battle, as the sim does at its making)
//   loadSettings() → Promise<gs>      (gameSettings.json, a chunk of its own: 68 KB the page asks for with the setup screen)
//     choice: { level, mode, era, team, difficulty: 'rookie' | 'normal' | 'expert', length: 'short' | 'medium' | 'long',
//       bpRate: 'slow' | 'default' | 'fast', allEraHeroes, bots: { friendly, enemy },
//       heroes: { friendly, enemy, friendlyCount, enemyCount }, reinforcements: { friendlyCount, enemyCount },
//       vehicles: { friendly, enemy, friendlyCount, enemyCount } }   (a bare boolean for heroes, reinforcements
//       or vehicles is both sides' switch; 'normal' is taken for the medium length)

import { autoPlayerFor } from './ai/autoPlayer.js';
import { wavesFor } from './ai/waves.js';
import { MODES } from './modes/index.js';
import { levelKey, modesOf } from './rulebook.js';
import { createSim } from './sim.js';

export { applyRound } from './sim.js';

export const loadSettings = () => import('../../data/bf2017/gameSettings.json').then((m) => m.default);

export const DIFFICULTIES = ['rookie', 'normal', 'expert'];
export const LENGTHS = ['short', 'medium', 'long'];
export const RATES = ['slow', 'default', 'fast'];
// The most bots a side may be asked for, by hand: the game's largest AutoPlayer team (TeamSizeAP_BotTeam_Large, 24).
export const MAX_SIDE = 24;
// Instant Action's own mode: Supremacy's command posts.
export const OWN_MODE = 'supremacy';
// The mode the AutoPlayers' rows are asked by: none of autoPlayer.js's SUFFIX, so the settings' `_Mode8`.
const AP_ROWS = 'instantAction';
// The stages an objective mode's waves are held for (the settings' `_Phase<n>` rows).
const PHASES = 5;

export const DEFAULTS = { level: 'hoth', mode: OWN_MODE, era: 'Orig', team: 2, difficulty: 'rookie', length: 'medium', bpRate: 'default', allEraHeroes: false, heroes: true, vehicles: true, reinforcements: true, bots: null };

// the screen's difficulty for the team-size rows, the lengths and the rates as the rows spell them
const SCREEN = { rookie: 'Easy', normal: 'Normal', expert: 'Hard' };
const LENGTH = { short: 'Short', medium: 'Normal', long: 'Long' };
const RATE = { slow: 'Slow', default: 'Default', fast: 'Fast' };

const reader = (gs, sources) => (key, names, fallback) => {
  const s = gs?.settings ?? gs ?? {};
  for (const n of names) if (n in s && s[n] !== null) {
    sources[key] = n;
    return s[n];
  }
  sources[key] = 'hand';
  return fallback;
};

// the eras a level's sides are held for (teams.json's rows, `<era>:<level>`)
export function erasFor(rulebook, level) {
  const key = `:${levelKey(level)}`;
  const eras = Object.keys(rulebook?.teams ?? {}).filter((k) => k.endsWith(key)).map((k) => k.slice(0, -key.length));
  return eras.length ? eras : [DEFAULTS.era];
}

// the modes a level's round may be: the game's own for that level that the sim runs
function modesFor(rulebook, level) {
  const own = rulebook ? modesOf(rulebook, level).filter((m) => MODES.includes(m)) : [];
  return own.length ? own : [...MODES];
}

// what a side may have out and how many of them bots, from the rows (the round's caps before any choice)
function rowsFor(g, n) {
  return {
    heroes: { max: g(`heroes.${n}`, [`Heroes_MaxCount_Team${n}_Mode8`], 4), bots: g(`heroes.bots.${n}`, [`AutoPlayers_Heroes_MaxCount_Team${n}_Mode8`, `AutoPlayers_Heroes_MaxCount_Team${n}`], 3) },
    reinforcements: { max: g(`reinforcements.${n}`, [`Specials_MaxCount_Team${n}_Mode8`], 12), bots: g(`reinforcements.bots.${n}`, [`AutoPlayers_Specials_MaxCount_Team${n}_Mode8`, `AutoPlayers_Specials_MaxCount_Team${n}`], 10) },
    vehicles: { bots: g(`vehicles.bots.${n}`, [`AutoPlayers_Vehicles_MaxCount_Team${n}`], 2) },
  };
}

export function optionsFor(gs, { rulebook = null, level = DEFAULTS.level, team = DEFAULTS.team } = {}) {
  const sources = {};
  const g = reader(gs, sources);
  const modes = modesFor(rulebook, level);
  const eras = erasFor(rulebook, level);
  const profile = rulebook?.ai?.instantAction ?? {};
  const text = (id) => rulebook?.strings?.[id] ?? id;
  const PROFILE = 'Gameplay/Profiles/InstantActionParams/';
  // a choice the game's profile holds: its default by the option's index, its items' own names
  const pick = (id, option, choices, fallback) => {
    const row = profile[option];
    const at = row && row.default >= 0 && row.default < choices.length ? choices[row.default] : fallback;
    // (names only where the strings table holds every one: the difficulty's ids are not in it, and its values, rookie, normal and expert, are the screen's own words)
    const labels = row?.items?.length === choices.length && row.items.every((i) => rulebook?.strings?.[i]) ? row.items.map(text) : null;
    return { id, kind: 'choice', choices: [...choices], ...(labels ? { labels } : {}), default: at, option, source: row ? PROFILE + option : 'hand' };
  };
  const flag = (id, option, fallback) => {
    const row = profile[option];
    return { id, kind: 'toggle', default: row && row.default >= 0 ? row.default === 1 : fallback, option, source: row ? PROFILE + option : 'hand' };
  };
  // a count the profile leaves to the settings (-1): the rows' number, to the rows' most
  const number = (id, option, value, min, max, source) => ({ id, kind: 'count', min, max, default: value, option, source });
  const size = g('size', ['TeamSize_AutoPlayers_Easy_Mode8', 'TeamSize_AutoPlayers_Mode8'], 13);
  const mine = g('mine', ['TeamSize_RealPlayer_Easy_Mode8', 'TeamSize_RealPlayer_Mode8'], 12);
  const friend = rowsFor(g, team);
  const foe = rowsFor(g, 3 - team);
  // The screen's order (the game's Instant Action screen as it draws them, NOTES.md): Game Modifiers, then
  // Advanced Settings with the enemy's of each pair before the player's side's; the switches, which the
  // screen draws past what was seen of it, after the counts; the side is the screen's Change Faction; the
  // era is the site's own row.
  const rows = {
    modifiers: [
      { id: 'mode', kind: 'choice', choices: modes, default: modes.includes(OWN_MODE) ? OWN_MODE : modes[0], option: 'InstantActionModeToPlay', source: 'modes.json' },
      pick('difficulty', 'InstantActionDifficulty', DIFFICULTIES, DEFAULTS.difficulty),
      pick('length', 'InstantActionTimeLimit', LENGTHS, DEFAULTS.length),
    ],
    advanced: [
      pick('bpRate', 'InstantActionBPRate', RATES, DEFAULTS.bpRate),
      number('bots.enemy', 'InstantActionNumEnemyAI_PC', size, 1, MAX_SIDE, sources.size),
      number('bots.friendly', 'InstantActionNumFriendlyAI_PC', Math.max(0, mine - 1), 0, MAX_SIDE, sources.mine),
      number('heroes.enemyCount', 'InstantActionEnemyHeroCount', foe.heroes.bots, 0, foe.heroes.max, sources[`heroes.bots.${3 - team}`]),
      number('heroes.friendlyCount', 'InstantActionFriendlyHeroCount', friend.heroes.bots, 0, friend.heroes.max, sources[`heroes.bots.${team}`]),
      number('reinforcements.enemyCount', 'InstantActionEnemyReinforcementCount', foe.reinforcements.bots, 0, foe.reinforcements.max, sources[`reinforcements.bots.${3 - team}`]),
      number('reinforcements.friendlyCount', 'InstantActionFriendlyReinforcementCount', friend.reinforcements.bots, 0, friend.reinforcements.max, sources[`reinforcements.bots.${team}`]),
      number('vehicles.enemyCount', 'InstantActionEnemyVehicleCount', foe.vehicles.bots, 0, foe.vehicles.bots, sources[`vehicles.bots.${3 - team}`]),
      number('vehicles.friendlyCount', 'InstantActionFriendlyVehicleCount', friend.vehicles.bots, 0, friend.vehicles.bots, sources[`vehicles.bots.${team}`]),
      flag('heroes.enemy', 'InstantActionEnemyHeroes', true),
      flag('heroes.friendly', 'InstantActionFriendlyHeroes', true),
      flag('vehicles.enemy', 'InstantActionEnemyVehicles', true),
      flag('vehicles.friendly', 'InstantActionFriendlyVehicles', true),
      flag('allEraHeroes', 'InstantActionAllEraHeroes', DEFAULTS.allEraHeroes),
    ],
    faction: [{ id: 'team', kind: 'choice', choices: [1, 2], default: DEFAULTS.team, option: 'PlayerProfileInstantActionParamsPlayerTeam', source: 'hand' }],
    site: [{ id: 'era', kind: 'choice', choices: eras, default: eras.includes(DEFAULTS.era) ? DEFAULTS.era : eras[0], option: null, source: 'teams.json' }],
  };
  return Object.entries(rows).flatMap(([group, list]) => list.map((o) => ({ ...o, group })));
}

const oneOf = (what, value, list) => {
  if (!list.includes(value)) throw new Error(`Instant Action: ${what} ${value} is not one of ${list.join(', ')}`);
  return value;
};

const count = (what, value, min, max = MAX_SIDE) => {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Instant Action: ${what} ${value} is not a whole number from ${min} to ${max}`);
  return value;
};

// a side's switch and count out of a choice: a bare boolean is both sides' switch (the first screen's shape)
const sideOf = (v, who) => (v !== null && typeof v === 'object' ? { on: v[who] ?? true, count: v[`${who}Count`] ?? null } : { on: v !== false, count: null });

export function roundFor(gs, choice = {}) {
  const c = { ...DEFAULTS, ...choice };
  const difficulty = oneOf('difficulty', c.difficulty, DIFFICULTIES);
  // (the rows' Normal is the screen's medium: either name is taken)
  const length = oneOf('length', c.length === 'normal' ? 'medium' : c.length, LENGTHS);
  const rate = oneOf('bpRate', c.bpRate, RATES);
  const mode = oneOf('mode', c.mode, MODES);
  // (the era is the teams table's to refuse: the sim's start reads the level's row for it)
  const era = String(c.era);
  const team = oneOf('team', c.team, [1, 2]);
  const other = 3 - team;
  const sources = {};
  const g = reader(gs, sources);
  const D = SCREEN[difficulty];
  const mine = g('size.mine', [`TeamSize_RealPlayer_${D}_Mode8`, 'TeamSize_RealPlayer_Mode8'], 12);
  const theirs = g('size.theirs', [`TeamSize_AutoPlayers_${D}_Mode8`, 'TeamSize_AutoPlayers_Mode8'], 13);
  const friendly = c.bots?.friendly != null ? count('bots.friendly', c.bots.friendly, 0) : Math.max(0, mine - 1);
  const enemy = c.bots?.enemy != null ? count('bots.enemy', c.bots.enemy, 1) : theirs;
  // a side's caps: the rows', none where its switch is off, its bots' the count asked where one is
  const side = (n) => {
    const who = n === team ? 'friendly' : 'enemy';
    const rows = rowsFor(g, n);
    const unit = (kind, v, row) => {
      const { on, count: asked } = sideOf(v, who);
      if (!on) return { ...(row.max != null ? { max: 0 } : {}), bots: 0 };
      if (asked == null) return row;
      const bots = count(`${kind}.${who}Count`, asked, 0, row.max ?? row.bots);
      // (the screen has no switch for the reinforcements: a count of none is that side's off)
      return { ...(row.max != null ? { max: bots === 0 && kind === 'reinforcements' ? 0 : row.max } : {}), bots };
    };
    return { heroes: unit('heroes', c.heroes, rows.heroes), reinforcements: unit('reinforcements', c.reinforcements, rows.reinforcements), vehicles: unit('vehicles', c.vehicles, rows.vehicles) };
  };
  const cp = mode === OWN_MODE;
  // (the waves' side on an objective mode before the sim has made it: the dark side attacks, as on Hoth)
  const wavesOf = (n) => wavesFor(gs, { cp, side: n === 2 ? 'attack' : 'defend', phase: 1, length, human: n === team });
  const byPhase = (s) => Array.from({ length: PHASES }, (_, i) => wavesFor(gs, { cp: false, side: s, phase: i + 1, length }));
  return {
    level: c.level,
    mode,
    era,
    team,
    difficulty,
    length,
    allEraHeroes: !!c.allEraHeroes,
    bots: { [team]: friendly, [other]: enemy },
    tickets: g('tickets', [`ConquestMaxTickets_${LENGTH[length]}_Mode8`, 'ConquestMaxTickets_Mode8'], 100),
    bleed: g('bleed', [`TicketBleedMult_${LENGTH[length]}_Mode8`], 1),
    bpRate: g('bpRate', [`BPRate_${RATE[rate]}_Mode8`], 1),
    caps: { [team]: side(team), [other]: side(other) },
    // (the bots facing the player and the bots beside them: the settings' two aim rows. Instant Action's
    // own rows, `_Mode8`, whatever mode the round plays: autoPlayer.js reads a bare 'supremacy' as the
    // multiplayer Supremacy's `_Mode1`, which holds no row by difficulty)
    ap: { [team]: autoPlayerFor(gs, { mode: AP_ROWS, difficulty, side: 'Friendlies' }), [other]: autoPlayerFor(gs, { mode: AP_ROWS, difficulty, side: 'Enemies' }) },
    waves: { [team]: wavesOf(team), [other]: wavesOf(other) },
    // (an objective mode's waves by the side a team plays and its stage, for the sim to take as the round moves; the command posts' are one table)
    wavesBy: cp ? null : { attack: byPhase('attack'), defend: byPhase('defend') },
    sources,
  };
}

// The round started: the sim made for it, the round on it for what reads the rest
export function startInstantAction({ rulebook, gs, nav = null, seed = 1, spawns = null, teams = null, ...choice }) {
  const round = roundFor(gs, choice);
  // (AutoPlayers, not the Arcade's Skirmish bots: `pve` off; the difficulty's row is the multiplayer one of its
  // name. The sim takes the round at its making: its rate, its length, its caps and its waves, sim.js's roundIn)
  const sim = createSim({ rulebook, level: round.level, era: round.era, nav, seed, teams, spawns, bots: round.bots, mode: round.mode, difficulty: round.difficulty, pve: false, instantAction: round });
  return { sim, round };
}

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
// the game's strings (`labels`). A count is the option's own (its Min, Max
// and Value: 20 bots a side of 0 to 32, 2 heroes of 0 to 4, 4 reinforcements
// of 0 to 20, 1 vehicle of 0 to 2), the settings' rows where the rulebook
// holds no such option.
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
// waves for a fallen bot's return and for a hero's or a reinforcement's, how
// often it comes in on a squadmate (`AP_SquadSpawnProbability`: else at a
// spawn point, a command post its side holds, modes/supremacy.js), and
// their aim, line of fire and strafe (ai/soldierBrain.js reads each side's
// numbers off `sim.instantAction`). On command posts (Supremacy, Instant
// Action's own mode) each bot's post is the game's bot logic's, on its spawn
// and when the orphans are called (ai/botLogic.js, `round.botLogic`), in
// place of the commander's plan; a round that asks for it (`botLogic:
// 'overhaul'`) has the Instant Action Overhaul V2's in the game's place
// (ai/botLogicOverhaul.js: its deal, its six seconds, its steps and its
// spread). Carried, not acted on: the vehicles' caps
// (no vehicle deploys yet), all-era heroes, the dodge roll.
// Pure: no three.js, no DOM.
//
//   erasFor(rulebook, level) → ['Orig', …]
//   optionsFor(gs, { rulebook, level, team }) → [{ id, group: 'modifiers' | 'advanced' | 'faction' | 'site' | 'overhaul', kind: 'choice' | 'toggle' | 'count', choices?, labels?, min?, max?, default, option, source,
//     label, help, listed, carried?, when? }]   (label, help: the row's own words on the game's screen, the string table's;
//     listed: the game's own screen has this row;
//     carried: the sim does not act on it yet; when: what else must be chosen for it to act; the screen's logic
//     over these rows is instantActionForm.js)
//     (in the game's screen's order, the enemy's of a pair before the player's side's)
//     (a dotted id is a nested field: `heroes.enemyCount` is choice.heroes.enemyCount)
//   roundFor(gs, choice, { cap, profile }) → round      (throws on a choice that is not one of the options';
//     profile: the rulebook's ai.instantAction, the game's own options: with it a count not asked for is the
//     option's own starting value, 20 bots a side, 2 heroes, 4 reinforcements, 1 vehicle; without it the rows')
//   sideCap(detail) → the most bots a side for a machine's quality level ('low' | 'mid' | 'high' | 'ultra'); `cap` in
//     optionsFor, roundFor and startInstantAction is that number: a round's own sizes come down to it
//     (`round.scaled`), a count asked past it is refused, and the options offer none past it
//   startInstantAction({ rulebook, gs, nav, seed, spawns, ...choice }) → { sim, round }
//   applyRound(sim, round)      (sim.js's: the round's length and rate on a battle, as the sim does at its making)
//   loadSettings() → Promise<gs>      (gameSettings.json, a chunk of its own: 68 KB the page asks for with the setup screen)
//     choice: { level, mode, era, team, difficulty: 'rookie' | 'normal' | 'expert', length: 'short' | 'medium' | 'long',
//       bpRate: 'slow' | 'default' | 'fast', allEraHeroes, bots: { friendly, enemy },
//       heroes: { friendly, enemy, friendlyCount, enemyCount }, reinforcements: { friendlyCount, enemyCount },
//       vehicles: { friendly, enemy, friendlyCount, enemyCount }, botLogic: 'game' | 'overhaul',
//       overhaul: { aim, reaction, dodging: 'veryEasy' … 'veryHard', spread } }   (a bare boolean for heroes,
//       reinforcements or vehicles is both sides' switch; 'normal' is taken for the medium length)

import { autoPlayerFor } from './ai/autoPlayer.js';
import { wavesFor } from './ai/waves.js';
import { POST_RADIUS, timersFor } from './ai/botLogic.js';
import * as Overhaul from './ai/botLogicOverhaul.js';
import { MODES } from './modes/index.js';
import { levelKey, modeName, worldModesOf, worldName } from './rulebook.js';
import { createSim } from './sim.js';

export { applyRound } from './sim.js';

export const loadSettings = () => import('../../data/bf2017/gameSettings.json').then((m) => m.default);

export const DIFFICULTIES = ['rookie', 'normal', 'expert'];
export const LENGTHS = ['short', 'medium', 'long'];
export const RATES = ['slow', 'default', 'fast'];
// The most bots a side may be asked for: the game's own, the most of its AI count options (InstantActionNum…AI_PC).
export const MAX_SIDE = 32;
// The most bots a side a machine is given, by its quality level (lib/device.js's `detail`), by hand: every
// bot is a skinned body on the game's rig and the frame is the processor's. The strongest has the game's
// most, a high one thirteen a side (the settings' own AutoPlayer side), a middling one the eight a side the
// page has always drawn.
export const SIDE_BY_DETAIL = { low: 5, mid: 8, high: 13, ultra: MAX_SIDE };
export const sideCap = (detail) => SIDE_BY_DETAIL[detail] ?? SIDE_BY_DETAIL.mid;
// Instant Action's own mode: Supremacy's command posts.
export const OWN_MODE = 'supremacy';
// The mode the AutoPlayers' rows are asked by: none of autoPlayer.js's SUFFIX, so the settings' `_Mode8`.
const AP_ROWS = 'instantAction';
// The stages an objective mode's waves are held for (the settings' `_Phase<n>` rows).
const PHASES = 5;

// The command posts' bot logic a round may ask for: the game's own, or the Instant Action Overhaul V2's.
export const BOT_LOGICS = ['game', 'overhaul'];

export const DEFAULTS = { level: 'hoth', mode: OWN_MODE, era: 'Orig', team: 2, difficulty: 'rookie', length: 'medium', bpRate: 'default', allEraHeroes: false, heroes: true, vehicles: true, reinforcements: true, bots: null, botLogic: 'game', overhaul: null };

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

// the modes a level's round may be: the game's own for that level's world that the sim runs (a mode is
// played on the level of the world that holds it: rulebook.js's levelForMode), Instant Action's own first
function modesFor(rulebook, level) {
  const own = rulebook ? worldModesOf(rulebook, level).filter((m) => MODES.includes(m)) : [];
  const list = own.length ? own : [...MODES];
  return list.includes(OWN_MODE) ? [OWN_MODE, ...list.filter((m) => m !== OWN_MODE)] : list;
}

// what a side may have out and how many of them bots, from the rows (the round's caps before any choice)
function rowsFor(g, n) {
  return {
    heroes: { max: g(`heroes.${n}`, [`Heroes_MaxCount_Team${n}_Mode8`], 4), bots: g(`heroes.bots.${n}`, [`AutoPlayers_Heroes_MaxCount_Team${n}_Mode8`, `AutoPlayers_Heroes_MaxCount_Team${n}`], 3) },
    reinforcements: { max: g(`reinforcements.${n}`, [`Specials_MaxCount_Team${n}_Mode8`], 12), bots: g(`reinforcements.bots.${n}`, [`AutoPlayers_Specials_MaxCount_Team${n}_Mode8`, `AutoPlayers_Specials_MaxCount_Team${n}`], 10) },
    vehicles: { bots: g(`vehicles.bots.${n}`, [`AutoPlayers_Vehicles_MaxCount_Team${n}`], 2) },
  };
}

export function optionsFor(gs, { rulebook = null, level = DEFAULTS.level, team = DEFAULTS.team, cap = MAX_SIDE } = {}) {
  const sources = {};
  const g = reader(gs, sources);
  const modes = modesFor(rulebook, level);
  const eras = erasFor(rulebook, level);
  const profile = rulebook?.ai?.instantAction ?? {};
  const PROFILE = 'Gameplay/Profiles/InstantActionParams/';
  // a row's own words on the game's screen (ai.json's `title` and `help`: the string table's), else the site's
  const words = (option, mine) => ({ label: profile[option]?.title?.text ?? mine, help: profile[option]?.help?.text ?? null });
  // a choice the game's profile holds: its default by the option's index, its items' own names
  const pick = (id, option, choices, fallback, mine) => {
    const row = profile[option];
    const at = row && row.default >= 0 && row.default < choices.length ? choices[row.default] : fallback;
    // (the items' names where the profile holds one for each: the game's words, ROOKIE for the difficulty's first)
    const labels = row?.labels?.length === choices.length ? [...row.labels] : null;
    return { id, kind: 'choice', choices: [...choices], ...(labels ? { labels } : {}), default: at, option, source: row ? PROFILE + option : 'hand', ...words(option, mine) };
  };
  const flag = (id, option, fallback, mine) => {
    const row = profile[option];
    // (a switch's two words: the game's OFF and ON)
    const labels = row?.labels?.length === 2 ? [...row.labels] : ['OFF', 'ON'];
    return { id, kind: 'toggle', labels, default: row && row.default >= 0 ? row.default === 1 : fallback, option, source: row ? PROFILE + option : 'hand', ...words(option, mine) };
  };
  // a count: the game's own option's least, most and starting value where the rulebook holds them
  // (ProfileOptionDataFloat's Min, Max and Value), else the settings' rows; `most` is the machine's share
  const number = (id, option, value, min, max, source, most = Infinity, mine = id) => {
    const row = profile[option];
    const own = typeof row?.value === 'number';
    const top = Math.min(own ? (row.max ?? max) : max, most);
    return { id, kind: 'count', min: own ? (row.min ?? min) : min, max: top, default: Math.min(own ? row.value : value, top), option, source: own ? PROFILE + option : source, ...words(option, mine) };
  };
  // (what the sim carries and does not act on yet: no vehicle deploys, and a hero's row holds no era)
  const carried = (o) => ({ ...o, carried: true });
  // (the site's own rows, and the mod's: a name by hand; `when`: what else must be chosen for the row to act)
  const STEP_WORDS = ['VERY EASY', 'EASY', 'MEDIUM', 'HARD', 'VERY HARD'];
  const modeWord = (m) => (rulebook && modeName(rulebook, m) ? modeName(rulebook, m).toUpperCase() : String(m).toUpperCase());
  const place = (rulebook && worldName(rulebook, level)) || String(level);
  const size = g('size', ['TeamSize_AutoPlayers_Easy_Mode8', 'TeamSize_AutoPlayers_Mode8'], 13);
  const mine = g('mine', ['TeamSize_RealPlayer_Easy_Mode8', 'TeamSize_RealPlayer_Mode8'], 12);
  const friend = rowsFor(g, team);
  const foe = rowsFor(g, 3 - team);
  const most = Math.max(1, Math.min(MAX_SIDE, cap));
  // The screen's order (the game's Instant Action screen as it draws them, NOTES.md): Game Modifiers, then
  // Advanced Settings with the enemy's of each pair before the player's side's, ending at the friendly
  // vehicle count; the profile's five switches, which that screen does not list, after the counts; the
  // side is the screen's Change Faction; the era is the site's own row.
  const rows = {
    modifiers: [
      // (the modes' names are the game's for each, modes.json's: its own list of this option is Supremacy and its two Missions)
      { id: 'mode', kind: 'choice', choices: modes, labels: modes.map(modeWord), default: modes.includes(OWN_MODE) ? OWN_MODE : modes[0], option: 'InstantActionModeToPlay', source: 'modes.json', ...words('InstantActionModeToPlay', 'MODE') },
      // (the location: the page's own level, a row of one choice until a round may move to another)
      { id: 'level', kind: 'choice', choices: [level], labels: [place.toUpperCase()], default: level, option: 'InstantActionLevelToPlay', source: 'modes.json', ...words('InstantActionLevelToPlay', 'LOCATION') },
      pick('difficulty', 'InstantActionDifficulty', DIFFICULTIES, DEFAULTS.difficulty, 'AI DIFFICULTY'),
      pick('length', 'InstantActionTimeLimit', LENGTHS, DEFAULTS.length, 'ROUND LENGTH'),
    ],
    advanced: [
      pick('bpRate', 'InstantActionBPRate', RATES, DEFAULTS.bpRate, 'BATTLE POINTS'),
      // (the sides' sizes, no more than the machine is given: the module passes its share, `cap`)
      number('bots.enemy', 'InstantActionNumEnemyAI_PC', size, 1, MAX_SIDE, sources.size, most, 'ENEMY AI COUNT'),
      number('bots.friendly', 'InstantActionNumFriendlyAI_PC', Math.max(0, mine - 1), 0, MAX_SIDE, sources.mine, most, 'FRIENDLY AI COUNT'),
      number('heroes.enemyCount', 'InstantActionEnemyHeroCount', foe.heroes.bots, 0, foe.heroes.max, sources[`heroes.bots.${3 - team}`], Infinity, 'ENEMY HERO COUNT'),
      number('heroes.friendlyCount', 'InstantActionFriendlyHeroCount', friend.heroes.bots, 0, friend.heroes.max, sources[`heroes.bots.${team}`], Infinity, 'FRIENDLY HERO COUNT'),
      number('reinforcements.enemyCount', 'InstantActionEnemyReinforcementCount', foe.reinforcements.bots, 0, foe.reinforcements.max, sources[`reinforcements.bots.${3 - team}`], Infinity, 'ENEMY REINFORCEMENT COUNT'),
      number('reinforcements.friendlyCount', 'InstantActionFriendlyReinforcementCount', friend.reinforcements.bots, 0, friend.reinforcements.max, sources[`reinforcements.bots.${team}`], Infinity, 'FRIENDLY REINFORCEMENT COUNT'),
      carried(number('vehicles.enemyCount', 'InstantActionEnemyVehicleCount', foe.vehicles.bots, 0, foe.vehicles.bots, sources[`vehicles.bots.${3 - team}`], Infinity, 'ENEMY VEHICLE COUNT')),
      carried(number('vehicles.friendlyCount', 'InstantActionFriendlyVehicleCount', friend.vehicles.bots, 0, friend.vehicles.bots, sources[`vehicles.bots.${team}`], Infinity, 'FRIENDLY VEHICLE COUNT')),
      flag('heroes.enemy', 'InstantActionEnemyHeroes', true, 'ENEMY HEROES'),
      flag('heroes.friendly', 'InstantActionFriendlyHeroes', true, 'FRIENDLY HEROES'),
      carried(flag('vehicles.enemy', 'InstantActionEnemyVehicles', true, 'ENEMY VEHICLES')),
      carried(flag('vehicles.friendly', 'InstantActionFriendlyVehicles', true, 'FRIENDLY VEHICLES')),
      carried(flag('allEraHeroes', 'InstantActionAllEraHeroes', DEFAULTS.allEraHeroes, 'ENABLE HEROES FROM ANY ERA')),
    ],
    // (the side: the screen's Change Faction button, not a row of its list)
    faction: [{ id: 'team', kind: 'choice', choices: [1, 2], default: DEFAULTS.team, option: 'PlayerProfileInstantActionParamsPlayerTeam', source: 'hand', label: rulebook?.ai?.instantAction?.$screen?.faction?.text ?? 'CHANGE FACTION', help: null }],
    site: [
      { id: 'era', kind: 'choice', choices: eras, default: eras.includes(DEFAULTS.era) ? DEFAULTS.era : eras[0], option: null, source: 'teams.json', label: 'ERA', help: null },
      // (the command posts' bot logic: the game's, or the Instant Action Overhaul V2's, ai/botLogicOverhaul.js)
      { id: 'botLogic', kind: 'choice', choices: [...BOT_LOGICS], labels: ['GAME', 'OVERHAUL'], default: DEFAULTS.botLogic, option: null, source: 'hand', label: 'BOT LOGIC', help: null, when: { mode: OWN_MODE } },
    ],
    // (the mod's own rows, read where its logic is the round's: three of its five-step options, and its
    // spread. Their names are by hand: the mod's own are in its string handler, not linked to its options)
    overhaul: [
      { id: 'overhaul.aim', option: 'IAIAIDifficulty', label: 'AI AIM' },
      { id: 'overhaul.reaction', option: 'IAIAIReactionTimes', label: 'AI REACTION' },
      { id: 'overhaul.dodging', option: 'IAIAIDodging', label: 'AI DODGING' },
    ]
      .map((o) => ({ ...o, kind: 'choice', choices: [...Overhaul.STEPS], labels: [...STEP_WORDS], default: 'medium' }))
      .concat([{ id: 'overhaul.spread', kind: 'toggle', labels: ['OFF', 'ON'], default: true, option: 'IAIAIAdaptiveDifficulty', label: 'AI DIFFICULTY SPREAD' }])
      .map((o) => ({ ...o, source: 'iao-v2', help: null, when: { mode: OWN_MODE, botLogic: 'overhaul' } })),
  };
  // (`listed`: a row of the game's own screen. Its list is thirteen rows and ends at the friendly vehicle
  // count; the five switches under them here are the profile's options, worded by the string table, with
  // no row on that screen)
  const UNLISTED = ['heroes.enemy', 'heroes.friendly', 'vehicles.enemy', 'vehicles.friendly', 'allEraHeroes'];
  const listed = (group, o) => (group === 'modifiers' || group === 'advanced') && !UNLISTED.includes(o.id);
  return Object.entries(rows).flatMap(([group, list]) => list.map((o) => ({ ...o, group, listed: listed(group, o) })));
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

export function roundFor(gs, choice = {}, { cap = MAX_SIDE, profile = null } = {}) {
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
  // (the machine's share: a round's own sizes come down to it, a count asked past it is refused)
  const most = Math.max(1, Math.min(MAX_SIDE, cap));
  // (the game's own option where the rulebook's profile holds it: its starting value and its least; else the rows)
  const own = (option, key) => {
    const row = profile?.[option];
    if (typeof row?.value !== 'number') return null;
    sources[key] = `Gameplay/Profiles/InstantActionParams/${option}`;
    return row;
  };
  const mineOpt = own('InstantActionNumFriendlyAI_PC', 'size.mine');
  const theirsOpt = own('InstantActionNumEnemyAI_PC', 'size.theirs');
  const wantMine = mineOpt ? mineOpt.value : Math.max(0, mine - 1);
  const wantTheirs = theirsOpt ? theirsOpt.value : theirs;
  const friendly = c.bots?.friendly != null ? count('bots.friendly', c.bots.friendly, 0, most) : Math.min(wantMine, most);
  const enemy = c.bots?.enemy != null ? count('bots.enemy', c.bots.enemy, theirsOpt ? (theirsOpt.min ?? 0) : 1, most) : Math.min(wantTheirs, most);
  const scaled = (c.bots?.friendly == null && wantMine > most) || (c.bots?.enemy == null && wantTheirs > most);
  // a side's caps: the rows', none where its switch is off, its bots' the count asked where one is
  const side = (n) => {
    const who = n === team ? 'friendly' : 'enemy';
    const rows = rowsFor(g, n);
    const OPTION = { heroes: 'Hero', reinforcements: 'Reinforcement', vehicles: 'Vehicle' };
    const unit = (kind, v, row) => {
      const { on, count: asked } = sideOf(v, who);
      if (!on) return { ...(row.max != null ? { max: 0 } : {}), bots: 0 };
      // (the game's own count option for this side and kind: what it starts at and its most)
      const opt = own(`InstantAction${who === 'friendly' ? 'Friendly' : 'Enemy'}${OPTION[kind]}Count`, `${kind}.bots.${n}`);
      const top = opt ? (opt.max ?? row.max ?? row.bots) : (row.max ?? row.bots);
      const bots = asked != null ? count(`${kind}.${who}Count`, asked, 0, top) : opt ? opt.value : row.bots;
      // (the screen has no switch for the reinforcements: a count of none is that side's off; a side may
      // have out at least as many as its bots are given)
      return { ...(row.max != null ? { max: bots === 0 && kind === 'reinforcements' ? 0 : Math.max(row.max, bots) } : {}), bots };
    };
    return { heroes: unit('heroes', c.heroes, rows.heroes), reinforcements: unit('reinforcements', c.reinforcements, rows.reinforcements), vehicles: unit('vehicles', c.vehicles, rows.vehicles) };
  };
  const cp = mode === OWN_MODE;
  // (the mod's logic is the command posts' alone; its steps and its spread are read where it is the round's)
  const overhaul = oneOf('botLogic', c.botLogic, BOT_LOGICS) === 'overhaul' && cp;
  const steps = {};
  for (const k of ['aim', 'reaction', 'dodging']) steps[k] = oneOf(`overhaul.${k}`, c.overhaul?.[k] ?? 'medium', Overhaul.STEPS);
  const spread = oneOf('overhaul.spread', c.overhaul?.spread ?? true, [true, false]);
  const apOf = (side) => {
    const ap = autoPlayerFor(gs, { mode: AP_ROWS, difficulty, side });
    return overhaul ? Overhaul.tuned(ap, steps) : ap;
  };
  // (the waves' side on an objective mode before the sim has made it: the dark side attacks, as on Hoth)
  const wavesOf = (n) => {
    const w = wavesFor(gs, { cp, side: n === 2 ? 'attack' : 'defend', phase: 1, length, human: n === team });
    // (the mod's: a fallen bot back after its six seconds, with no window to wait on)
    return overhaul ? { ...w, soldiers: { ...w.soldiers, pause: 0, delay: Overhaul.RESPAWN } } : w;
  };
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
    cap: most,
    scaled,
    tickets: g('tickets', [`ConquestMaxTickets_${LENGTH[length]}_Mode8`, 'ConquestMaxTickets_Mode8'], 100),
    bleed: g('bleed', [`TicketBleedMult_${LENGTH[length]}_Mode8`], 1),
    bpRate: g('bpRate', [`BPRate_${RATE[rate]}_Mode8`], 1),
    caps: { [team]: side(team), [other]: side(other) },
    // (the bots facing the player and the bots beside them: the settings' two aim rows. Instant Action's
    // own rows, `_Mode8`, whatever mode the round plays: autoPlayer.js reads a bare 'supremacy' as the
    // multiplayer Supremacy's `_Mode1`, which holds no row by difficulty)
    ap: { [team]: apOf('Friendlies'), [other]: apOf('Enemies') },
    waves: { [team]: wavesOf(team), [other]: wavesOf(other) },
    // (an objective mode's waves by the side a team plays and its stage, for the sim to take as the round moves; the command posts' are one table)
    wavesBy: cp ? null : { attack: byPhase('attack'), defend: byPhase('defend') },
    // (the command posts' bot logic: the game's graph, ai/botLogic.js, or the mod's deal where it is asked for,
    // ai/botLogicOverhaul.js; an objective mode's bots are the commander's)
    botLogic: overhaul ? { kind: 'overhaul', radius: Overhaul.POST_RADIUS, spread } : cp ? { kind: 'game', timers: timersFor(gs), radius: POST_RADIUS } : null,
    sources,
  };
}

// The round started: the sim made for it, the round on it for what reads the rest
export function startInstantAction({ rulebook, gs, nav = null, seed = 1, spawns = null, teams = null, cap = MAX_SIDE, ...choice }) {
  const round = roundFor(gs, choice, { cap, profile: rulebook?.ai?.instantAction ?? null });
  // (AutoPlayers, not the Arcade's Skirmish bots: `pve` off; the difficulty's row is the multiplayer one of its
  // name. The sim takes the round at its making: its rate, its length, its caps and its waves, sim.js's roundIn)
  const sim = createSim({ rulebook, level: round.level, era: round.era, nav, seed, teams, spawns, bots: round.bots, mode: round.mode, difficulty: round.difficulty, pve: false, instantAction: round });
  return { sim, round };
}

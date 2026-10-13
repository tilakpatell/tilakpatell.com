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
//                      bots; off, none
//   reinforcements     Specials_MaxCount_Team<n>_Mode8 (12),
//                      AutoPlayers_Specials_MaxCount_Team<n>_Mode8 (10)
//   vehicles           AutoPlayers_Vehicles_MaxCount_Team<n> (2); off, none
//   the bots           ai/autoPlayer.js's numbers for the side facing the
//                      player (`_Enemies_`) and the side beside them
//                      (`_Friendlies_`), ai/waves.js's tables for each
//
// Read by hand (src/data/bf2017/NOTES.md, "Instant Action"): that the
// RealPlayer row is the player's side's size with the player in it; that the
// screen's Easy, Normal and Hard are the AutoPlayers' Rookie, Normal and
// Expert rows in order; the most a side's count may be asked (MAX_SIDE).
//
// What the sim acts on today: the level, the mode, the era, the sides' bots
// (AutoPlayers: `pve` off), the difficulty, the Battle Points' rate, and the
// reinforcements on a mode that counts them. The rest is carried on
// `sim.instantAction` for the brains, the commander and the heroes' and
// vehicles' lanes to read: the AutoPlayers' numbers, the waves, the caps.
// Pure: no three.js, no DOM.
//
//   erasFor(rulebook, level) → ['Orig', …]
//   optionsFor(gs, { rulebook, level }) → [{ id, kind: 'choice' | 'toggle' | 'count', choices?, min?, max?, default, source }]
//   roundFor(gs, choice) → round      (throws on a choice that is not one of the options')
//   startInstantAction({ rulebook, gs, nav, seed, spawns, ...choice }) → { sim, round }
//   loadSettings() → Promise<gs>      (gameSettings.json, a chunk of its own: 68 KB the page asks for with the setup screen)
//     choice: { level, mode, era, team, difficulty, length, bpRate, heroes, vehicles, reinforcements, bots: { friendly, enemy } }

import { autoPlayerFor } from './ai/autoPlayer.js';
import { wavesFor } from './ai/waves.js';
import { MODES } from './modes/index.js';
import { levelKey, modesOf } from './rulebook.js';
import { createSim } from './sim.js';

export const loadSettings = () => import('../../data/bf2017/gameSettings.json').then((m) => m.default);

export const DIFFICULTIES = ['rookie', 'normal', 'expert'];
export const LENGTHS = ['short', 'normal', 'long'];
export const RATES = ['slow', 'default', 'fast'];
// The most bots a side may be asked for, by hand: the game's largest AutoPlayer team (TeamSizeAP_BotTeam_Large, 24).
export const MAX_SIDE = 24;
// Instant Action's own mode: Supremacy's command posts.
export const OWN_MODE = 'supremacy';
// The mode the AutoPlayers' rows are asked by: none of autoPlayer.js's SUFFIX, so the settings' `_Mode8`.
const AP_ROWS = 'instantAction';

export const DEFAULTS = { level: 'hoth', mode: OWN_MODE, era: 'Orig', team: 2, difficulty: 'normal', length: 'normal', bpRate: 'default', heroes: true, vehicles: true, reinforcements: true, bots: null };

// the screen's difficulty for the team-size rows, the lengths and the rates as the rows spell them
const SCREEN = { rookie: 'Easy', normal: 'Normal', expert: 'Hard' };
const LENGTH = { short: 'Short', normal: 'Normal', long: 'Long' };
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

export function optionsFor(gs, { rulebook = null, level = DEFAULTS.level } = {}) {
  const sources = {};
  const g = reader(gs, sources);
  const modes = modesFor(rulebook, level);
  const eras = erasFor(rulebook, level);
  const size = g('size', ['TeamSize_AutoPlayers_Normal_Mode8', 'TeamSize_AutoPlayers_Mode8'], 13);
  const mine = g('mine', ['TeamSize_RealPlayer_Normal_Mode8', 'TeamSize_RealPlayer_Mode8'], 12);
  return [
    { id: 'mode', kind: 'choice', choices: modes, default: modes.includes(OWN_MODE) ? OWN_MODE : modes[0], source: 'modes.json' },
    { id: 'era', kind: 'choice', choices: eras, default: eras.includes(DEFAULTS.era) ? DEFAULTS.era : eras[0], source: 'teams.json' },
    { id: 'team', kind: 'choice', choices: [1, 2], default: DEFAULTS.team, source: 'hand' },
    { id: 'difficulty', kind: 'choice', choices: [...DIFFICULTIES], default: DEFAULTS.difficulty, source: 'AP_AimNoiseScale_<Rookie|Normal|Expert>_Mode8' },
    { id: 'length', kind: 'choice', choices: [...LENGTHS], default: DEFAULTS.length, source: 'ConquestMaxTickets_<Short|Normal|Long>_Mode8' },
    { id: 'bpRate', kind: 'choice', choices: [...RATES], default: DEFAULTS.bpRate, source: 'BPRate_<Slow|Default|Fast>_Mode8' },
    { id: 'heroes', kind: 'toggle', default: DEFAULTS.heroes, source: 'Heroes_MaxCount_Team<n>_Mode8' },
    { id: 'reinforcements', kind: 'toggle', default: DEFAULTS.reinforcements, source: 'Specials_MaxCount_Team<n>_Mode8' },
    { id: 'vehicles', kind: 'toggle', default: DEFAULTS.vehicles, source: 'AutoPlayers_Vehicles_MaxCount_Team<n>' },
    { id: 'bots.friendly', kind: 'count', min: 0, max: MAX_SIDE, default: Math.max(0, mine - 1), source: sources.mine },
    { id: 'bots.enemy', kind: 'count', min: 1, max: MAX_SIDE, default: size, source: sources.size },
  ];
}

const oneOf = (what, value, list) => {
  if (!list.includes(value)) throw new Error(`Instant Action: ${what} ${value} is not one of ${list.join(', ')}`);
  return value;
};

const count = (what, value, min) => {
  if (!Number.isInteger(value) || value < min || value > MAX_SIDE) throw new Error(`Instant Action: ${what} ${value} is not a whole number from ${min} to ${MAX_SIDE}`);
  return value;
};

export function roundFor(gs, choice = {}) {
  const c = { ...DEFAULTS, ...choice };
  const difficulty = oneOf('difficulty', c.difficulty, DIFFICULTIES);
  const length = oneOf('length', c.length, LENGTHS);
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
  const cap = (on, key, names, fallback) => (on ? g(key, names, fallback) : 0);
  const side = (n) => ({
    heroes: { max: cap(c.heroes, `heroes.${n}`, [`Heroes_MaxCount_Team${n}_Mode8`], 4), bots: cap(c.heroes, `heroes.bots.${n}`, [`AutoPlayers_Heroes_MaxCount_Team${n}_Mode8`, `AutoPlayers_Heroes_MaxCount_Team${n}`], 3) },
    reinforcements: { max: cap(c.reinforcements, `reinforcements.${n}`, [`Specials_MaxCount_Team${n}_Mode8`], 12), bots: cap(c.reinforcements, `reinforcements.bots.${n}`, [`AutoPlayers_Specials_MaxCount_Team${n}_Mode8`, `AutoPlayers_Specials_MaxCount_Team${n}`], 10) },
    vehicles: { bots: cap(c.vehicles, `vehicles.bots.${n}`, [`AutoPlayers_Vehicles_MaxCount_Team${n}`], 2) },
  });
  const cp = mode === OWN_MODE;
  // (the waves' side on an objective mode: the game's dark side attacks, as on Hoth; the mode's own sides replace it once the sim has made it)
  const wavesOf = (n) => wavesFor(gs, { cp, side: n === 2 ? 'attack' : 'defend', phase: 1, length: length === 'normal' ? 'medium' : length, human: n === team });
  return {
    level: c.level,
    mode,
    era,
    team,
    difficulty,
    length,
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
    sources,
  };
}

// The round started: the sim made for it, the round on it for what reads the rest
export function startInstantAction({ rulebook, gs, nav = null, seed = 1, spawns = null, teams = null, ...choice }) {
  const round = roundFor(gs, choice);
  // (AutoPlayers, not the Arcade's Skirmish bots: `pve` off; the difficulty's row is the multiplayer one of its name)
  const sim = createSim({ rulebook, level: round.level, era: round.era, nav, seed, teams, spawns, bots: round.bots, mode: round.mode, difficulty: round.difficulty, pve: false });
  sim.instantAction = round;
  if (sim.bp) sim.bp.rate = round.bpRate;
  // (a mode that counts reinforcements, Supremacy's ground: the round's length is theirs)
  if (sim.ga?.tickets) for (const k of Object.keys(sim.ga.tickets)) sim.ga.tickets[k] = round.tickets;
  return { sim, round };
}

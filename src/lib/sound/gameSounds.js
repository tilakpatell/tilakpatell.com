// The site's sounds and lines, by the names it already plays them by, each
// to the 2017 game's file that will take its place: so the day the game's
// audio is in the bucket, a file drops in under a name the site already
// calls and nothing else changes. Until then every game file is null and
// the site plays its own (synthesised or recorded) sound, as today.
//
// The names, `<where>.<what>[:<which>]`:
//   surface.*   the galaxy surface's own (components/galaxy/surface/sounds.js:
//               saber(what), combat(what), step(ground), blast(), roar(), crash())
//   universe.*  the universe's (components/universe/sounds.js: gunSound(gun),
//               shipEngine(kind), flybySound, impactSound, boomSound)
//   sfx.*       lib/sfx.js's exports
//   clip.*      lib/clips.js's CLIPS
//   line.*      a voice in surface/voicelines.js's NAMES: the heroes' lines and
//               the troopers' barks, by the situation the game says them in
//               (a line set: { <situation>: file | null })
// The saber's hum is lit with its ignite on the site (one sound), so the
// game's ignite and hum go together under `surface.saber:ignite`.
//
// GAME_SOUNDS: { name: file | null } (a line: { situation: file | null })
// soundFor(name, has, table) → the game file's URL, if the bucket had it
//   (`has(file)`), else null: the site's own plays
// lineFor(voice, situation, has, table) → the same for a line

const GAME_DIR = '/audio/galaxy/bf2017';

// the situations a hero or a trooper says something in, the game's set
export const SITUATIONS = ['spawn', 'taunt', 'kill', 'hurt', 'defeat', 'ability'];
const lines = () => Object.fromEntries(SITUATIONS.map((s) => [s, null]));

const names = (where, list) => Object.fromEntries(list.map((n) => [`${where}${n}`, null]));

// The Hoth set (scripts/bf2017-sounds.mjs, src/data/bf2017/sounds.json: the
// Battlefront world plays the whole set by its own names) gives these their
// first takes: the E-11's close layer, the snow walk, the hit and kill cues.
export const GAME_SOUNDS = {
  // the saber, its strokes and the duel
  ...names('surface.saber:', ['ignite', 'off', 'swing', 'throw', 'clash', 'deflect']),
  ...names('surface.combat:', ['heavy', 'parry', 'force', 'vent', 'perfect', 'lock', 'boom', 'hit', 'kill', 'dodge', 'broken']),
  'surface.combat:hit': 'hit-hit-01.mp3',
  'surface.combat:kill': 'hit-kill-01.mp3',
  // feet on each ground, a blaster's shot, the beasts, the gate
  ...names('surface.step:', ['sand', 'snow', 'grass', 'stone', 'metal', 'mud']),
  'surface.step:snow': 'step-walk-01.mp3',
  ...names('surface.', ['blast', 'roar', 'crash']),
  // the blasters by weapon, the ships' engines, a fly-by, a hit, a blast
  ...names('universe.gunSound:', ['blaster', 'bowcaster', 'sniper', 'smg', 'westar']),
  'universe.gunSound:blaster': 'blaster-e11-close-01.mp3',
  'universe.gunSound:sniper': 'blaster-dlt19x-close-01.mp3',
  ...names('universe.shipEngine:', ['xwing', 'falcon']),
  ...names('universe.', ['flybySound', 'impactSound', 'boomSound']),
  ...names('sfx.', ['laser', 'blast', 'boom', 'saber', 'flyby', 'torpedo', 'hyperspace']),
  ...names('clip.', ['vader', 'useTheForce', 'hyperspaceEnter', 'hyperspaceExit']),
  // the heroes' lines, and the troopers' barks
  ...Object.fromEntries(['luke', 'vader', 'obiwan', 'anakin', 'dooku', 'yoda', 'han', 'leia', 'lando', 'bobafett', 'stormtrooper', 'clonetrooper', 'battledroid', 'rebeltrooper'].map((v) => [`line.${v}`, lines()])),
};

const url = (file) => `${GAME_DIR}/${file}`;

export function soundFor(name, has = () => false, table = GAME_SOUNDS) {
  if (!Object.hasOwn(table, name)) return null;
  const file = table[name];
  return typeof file === 'string' && has(file) ? url(file) : null;
}

export function lineFor(voice, situation, has = () => false, table = GAME_SOUNDS) {
  const set = Object.hasOwn(table, `line.${voice}`) ? table[`line.${voice}`] : null;
  const file = set && Object.hasOwn(set, situation) ? set[situation] : null;
  return typeof file === 'string' && has(file) ? url(file) : null;
}

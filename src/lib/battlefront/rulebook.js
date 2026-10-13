// The Battlefront rules' typed access to the rulebooks under
// src/data/bf2017/ (written by scripts/bf2017-data.mjs from the 2017 game's
// data, the hand files beside them; NOTES.md says which values are by hand).
// Every accessor throws on an id that is not there: a rulebook typo is a bug
// to see at once, not a case for the rules to handle.
//
// Levels are keyed by the game's level key (`hoth_01`); the short names older
// readers use (`hoth`, lane H's `endor`…) are aliases. A level's files are
// named as the maps rulebooks name them: the world, then `.n` past its first
// level (`hoth.json`, `hoth.2.json`, `hoth.stages.json`, `hoth.<mode>.json`).
// Hoth is bundled; every other level is fetched when asked (`loadLevel`).

import abilities from '../../data/bf2017/abilities.json';
import ai from '../../data/bf2017/ai.json';
import arcade from '../../data/bf2017/arcade.json';
import cameras from '../../data/bf2017/cameras.json';
import cards from '../../data/bf2017/cards.json';
import classes from '../../data/bf2017/classes.json';
import heroes from '../../data/bf2017/heroes.json';
import kits from '../../data/bf2017/kits.json';
import hoth from '../../data/bf2017/maps/hoth.json';
import hothLighting from '../../data/bf2017/maps/hoth.lighting.json';
import hothStages from '../../data/bf2017/maps/hoth.stages.json';
import modes from '../../data/bf2017/modes.json';
import points from '../../data/bf2017/points.json';
import reinforcements from '../../data/bf2017/reinforcements.json';
import squads from '../../data/bf2017/squads.json';
import strings from '../../data/bf2017/strings.json';
import teams from '../../data/bf2017/teams.json';
import ui from '../../data/bf2017/ui.json';
import vehicles from '../../data/bf2017/vehicles.json';
import weapons from '../../data/bf2017/weapons.json';

// The game's level key (`hoth_01`) for a short name the older readers use
// (`hoth`, and lane H's `endor`, `tatooine`, `geonosis`, `kashyyyk`).
export const ALIASES = { hoth: 'hoth_01', endor: 'endor_01', tatooine: 'tatooine_01', geonosis: 'geonosis_01', kashyyyk: 'kashyyyk_01' };
export const levelKey = (level) => ALIASES[String(level).toLowerCase()] ?? String(level).toLowerCase();

// `hoth_01` → `hoth`, `hoth_02` → `hoth.2`
export function fileOfLevel(level) {
  const key = levelKey(level);
  const m = key.match(/^(.*)_0*(\d+)$/);
  if (!m) return key;
  return Number(m[2]) === 1 ? m[1] : `${m[1]}.${Number(m[2])}`;
}

// The maps the bundle leaves out, each its own chunk, fetched when asked
const FILES = import.meta.glob(['../../data/bf2017/maps/*.json', '!**/sb_*', '!**/arenas.json', '!**/hoth.json', '!**/hoth.lighting.json', '!**/hoth.stages.json'], { import: 'default' });
const fileAt = (name) => FILES[`../../data/bf2017/maps/${name}.json`] ?? null;
const loaded = new Map();

// `hoth.strike.json` → `strike` (a level's mode file; `stages` is Galactic Assault's)
const modeFileOf = (name, path) => path.slice(path.lastIndexOf('/') + 1).match(new RegExp(`^${name.replace('.', '\\.')}\\.([a-zA-Z]+)\\.json$`))?.[1] ?? null;
export const hothModeFiles = () => Object.keys(FILES).filter((path) => modeFileOf('hoth', path));

async function modeFiles(name) {
  const stages = {};
  for (const [path, load] of Object.entries(FILES)) {
    const mode = modeFileOf(name, path);
    if (!mode || mode === 'lighting') continue;
    const file = await load();
    stages[file.mode ?? (mode === 'stages' ? 'galacticAssault' : mode)] = file;
  }
  return stages;
}

function freeze(v) {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    Object.values(v).forEach(freeze);
  }
  return v;
}

let cached = null;

export function loadRulebook() {
  cached ??= freeze({
    abilities: abilities.rows,
    ai: ai.rows,
    cameras: cameras.rows,
    cards: cards.rows,
    classes: classes.rows,
    heroes: heroes.rows,
    kits,
    arcade,
    maps: { hoth_01: { map: hoth.rows, lighting: hothLighting.rows, stages: { [hothStages.mode]: hothStages } } },
    points,
    reinforcements: reinforcements.rows,
    squads: squads.rows,
    strings: strings.rows,
    teams: teams.rows,
    ui: ui.rows,
    vehicles: vehicles.rows,
    weapons: weapons.rows,
  });
  return cached;
}

function pick(table, id, what) {
  const row = table[id];
  if (!row) throw new Error(`${what} ${id}: not in the rulebook`);
  return row;
}

export const weaponOf = (rb, id) => pick(rb.weapons, id, 'weapon');
export const classOf = (rb, id) => pick(rb.classes, id, 'class');
export const heroOf = (rb, id) => pick(rb.heroes, id, 'hero');
export const reinforcementOf = (rb, id) => pick(rb.reinforcements, id, 'reinforcement');
export const vehicleOf = (rb, id) => pick(rb.vehicles, id, 'vehicle');
export const abilityOf = (rb, id) => pick(rb.abilities, id, 'ability');
export const cardOf = (rb, id) => pick(rb.cards, id, 'star card');

// A level's rulebooks ({ map, lighting, stages: { [mode]: file } }), bundled or loaded
export function levelOf(rb, level) {
  const key = levelKey(level);
  const lv = loaded.get(key) ?? rb.maps[key];
  if (lv) return lv;
  if (fileAt(fileOfLevel(key))) throw new Error(`level ${key}: not loaded yet (await loadLevel('${key}'))`);
  throw new Error(`level ${key}: not in the rulebook`);
}

// Fetches a level's map, its lighting and its mode files once
export async function loadLevel(level) {
  const key = levelKey(level);
  if (loaded.has(key)) return loaded.get(key);
  // (Hoth is bundled; a mode file of its own beside its stages is fetched)
  if (key === 'hoth_01') {
    const hothLv = levelOf(loadRulebook(), key);
    const more = await modeFiles('hoth');
    const lv = Object.keys(more).length ? freeze({ ...hothLv, stages: { ...more, ...hothLv.stages } }) : hothLv;
    loaded.set(key, lv);
    return lv;
  }
  const name = fileOfLevel(key);
  const at = fileAt(name);
  if (!at) throw new Error(`level ${key}: not in the rulebook`);
  const map = (await at()).rows;
  const lighting = fileAt(`${name}.lighting`) ? (await fileAt(`${name}.lighting`)()).rows : null;
  const stages = await modeFiles(name);
  const lv = freeze({ map, lighting, stages });
  loaded.set(key, lv);
  return lv;
}

// The game's levels on a galaxy system and a level's modes: modes.json's
// (lane F's) until G1's frontend.json, read from the inclusion options, lands
export const levelsFor = (system) => [...(modes.worlds[system]?.ground ?? [])];
export const modesOf = (rb, level) => [...(modes.levels[levelKey(level)]?.modes ?? [])];
// The modes a level's world holds on its ground, the level's own first (Hoth's Supremacy is its second level's)
export function worldModesOf(rb, level) {
  const own = modesOf(rb, level);
  const world = modes.worlds[modes.levels[levelKey(level)]?.world];
  const ground = (world?.ground ?? []).flatMap((k) => modes.levels[k]?.modes ?? []);
  return [...new Set([...own, ...ground])];
}
// The level of a world that holds a mode: the level itself where it does, else the first of its world's
// that does (Hoth's Supremacy is its second level's, on the same ground); the level itself where none does
export function levelForMode(rb, level, mode) {
  const key = levelKey(level);
  if (modes.levels[key]?.modes?.includes(mode)) return key;
  const first = modes.worlds[modes.levels[key]?.world]?.ground?.[0] ?? key;
  return (modes.worlds[modes.levels[key]?.world]?.ground ?? []).find((k) => modes.levels[k]?.modes?.includes(mode)) ?? first;
}

export function teamsFor(rb, level, era = 'Orig') {
  const t = pick(rb.teams, `${era}:${levelKey(level)}`, 'teams');
  return { light: t.light, dark: t.dark };
}

export const mapOf = (rb, level) => levelOf(rb, level).map;
export const lightingOf = (rb, level) => levelOf(rb, level).lighting;
export const stagesOf = (rb, level, mode) => levelOf(rb, level).stages[mode] ?? null;
export const kitsOf = (rb) => rb.kits;
export const arcadeOf = (rb) => rb.arcade;
export const camerasOf = (rb) => rb.cameras;
export const uiOf = (rb) => rb.ui;
export const aiOf = (rb) => rb.ai;
export const pointsOf = (rb) => rb.points;
export const squadsOf = (rb) => rb.squads;
// (the squad strip's words travel with squads.json, beside the strings rulebook)
export const stringOf = (rb, id) => rb.strings[id] ?? rb.squads?.strings?.[id] ?? id;

// A mode's spawn points and spawn areas, by team or by id.
export function spawnsFor(map, { mode, team = null, ids = null }) {
  const want = ids ? new Set(ids) : null;
  return [...map.spawns, ...map.polygons].filter((s) => s.mode === mode && (team === null || s.team === team) && (!want || want.has(s.id)));
}

export function volumeOf(map, id) {
  const v = map.volumes.find((x) => x.id === id);
  if (!v) throw new Error(`volume ${id}: not in the map`);
  return v;
}

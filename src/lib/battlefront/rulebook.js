// The Battlefront rules' typed access to the rulebooks under
// src/data/bf2017/ (written by scripts/bf2017-data.mjs from the 2017 game's
// data, the hand files beside them; NOTES.md says which values are by hand).
// Every accessor throws on an id that is not there: a rulebook typo is a bug
// to see at once, not a case for the rules to handle.

import abilities from '../../data/bf2017/abilities.json';
import ai from '../../data/bf2017/ai.json';
import cameras from '../../data/bf2017/cameras.json';
import cards from '../../data/bf2017/cards.json';
import classes from '../../data/bf2017/classes.json';
import heroes from '../../data/bf2017/heroes.json';
import hoth from '../../data/bf2017/maps/hoth.json';
import hothLighting from '../../data/bf2017/maps/hoth.lighting.json';
import hothStages from '../../data/bf2017/maps/hoth.stages.json';
import points from '../../data/bf2017/points.json';
import reinforcements from '../../data/bf2017/reinforcements.json';
import squads from '../../data/bf2017/squads.json';
import strings from '../../data/bf2017/strings.json';
import teams from '../../data/bf2017/teams.json';
import ui from '../../data/bf2017/ui.json';
import vehicles from '../../data/bf2017/vehicles.json';
import weapons from '../../data/bf2017/weapons.json';

// A level's short name (`hoth`) and the export's (`hoth_01`).
const LEVELS = { hoth: 'hoth_01' };

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
    maps: { hoth: { map: hoth.rows, lighting: hothLighting.rows, stages: { [hothStages.mode]: hothStages } } },
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

const levelOf = (rb, level) => pick(rb.maps, level, 'level');

export function teamsFor(rb, level, era = 'Orig') {
  const t = pick(rb.teams, `${era}:${LEVELS[level] ?? level}`, 'teams');
  return { light: t.light, dark: t.dark };
}

export const mapOf = (rb, level) => levelOf(rb, level).map;
export const lightingOf = (rb, level) => levelOf(rb, level).lighting;
export const stagesOf = (rb, level, mode) => levelOf(rb, level).stages[mode] ?? null;
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

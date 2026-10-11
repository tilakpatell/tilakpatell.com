// Starfighter Assault's kits from the game's records (the sixth design's
// lane fighters, task 4): which fighters each side flies on a level, which
// the galaxy's battle flies them as, and how the one you fly handles.
// Pure: src/data/bf2017/air.json (scripts/lib/bf2017-rulebook-air.mjs) and a
// level's map rulebook.
//
// - eraOf(level) → 'orig' | 'preq': the level's sides (the Rebels and the
//   Empire, or the Republic and the Separatists).
// - kitsOf(air, map, level) → [team 0's, team 1's], each
//   [{ id, kind, role, weight, hero? }]: the kinds the mode's kit list
//   (`Gameplay/Teams/Space/Vehicles_<Side>_<Era>_Space`) allows that side
//   and no others, each the class its kit record names (fighter,
//   interceptor, bomber), weighted by how many of the level's vehicle
//   spawners place it (its AI squadrons: Endor's 13 X-wings and 13 TIE
//   fighters; one at least, so every class flies), a bomber one (its
//   spawners, Endor's 55 TIE bombers, are the level's scripted bomber
//   flights, which the plan flies as the attacker's waves).
//   A kind the level's spawners place that the side's list refuses (the
//   droid battleship's lone X-wing spawner, on the Republic's side) is left
//   out. The hero ships (the kit limitation's, three at once, 2,000 Battle
//   Points) are listed apart, `heroes`, not flown by the bots.
// - SIM: the galaxy battle's kind for each of the game's (universe/wars.js's
//   FIGHTERS: the ones the fleet's files are the game's for,
//   scripts/bf2017-fleet.mjs), `source: 'hand'`.
// - tuneFor(row, ref) → the galaxy ship's tune (universe/ship.js's TUNE:
//   cruise, boost, accel, agility) for flying `row`, as its handling
//   compares with the X-wing's (the galaxy's own ship flies as an X-wing
//   at 1): its top speed, boost speed, acceleration and turn rates over the
//   X-wing's, held to what the galaxy's tune allows (`held` lists what the
//   hold cut: the Hyena's slower boost can't be had).

import { TUNE } from '../../../universe/ship';

export const SIM = {
  source: 'hand',
  xwing_t65: 'xwing65',
  awing: 'awing',
  ywing: 'ywing',
  tiefighter: 'tie',
  tieinterceptor: 'interceptor',
  tiebomber: 'tiebomber',
  arc170: 'arc170',
  vwing: 'vwing',
  btlywing: 'ywing',
  vulturedroid: 'vulture',
  droidtrifighter: 'trifighter',
  hyenabomber: 'hyena',
};

const ERA = { rebel: 'orig', empire: 'orig', republic: 'preq', separatists: 'preq' };
export const eraOf = (level) => ERA[level.sides[0]] ?? ERA[level.sides[1]] ?? 'orig';

// the game's Team1 is the light side's (the battle's team 0)
const SIDE = ['light', 'dark'];

const idOf = (blueprint) => blueprint.split('/')[3]?.toLowerCase() ?? '';

export function kitsOf(air, map, level) {
  const era = eraOf(level);
  const rows = map.rows ?? map;
  const placed = new Map();
  for (const v of rows.vehicleSpawns ?? []) placed.set(idOf(v.blueprint), (placed.get(idOf(v.blueprint)) ?? 0) + 1);
  return [0, 1].map((team) => {
    const allowed = air.kits[era]?.[SIDE[team]] ?? [];
    return allowed
      .filter((id) => air.vehicles[id] && SIM[id])
      .map((id) => {
        const role = air.vehicles[id].class ?? 'fighter';
        // (a level's bomber spawners are its scripted bomber flights, flown as the plan's waves: in the pool a bomber weighs one)
        const weight = role === 'bomber' ? 1 : Math.max(1, placed.get(id) ?? 0);
        return { id, kind: SIM[id], role, weight, abilities: (air.vehicles[id].abilities ?? []).map((a) => a.id) };
      });
  });
}

// the hero ships a side may take, as the mode's kit limitation names them (the sequel's refused in the rulebook)
export const heroesOf = (air, team) => air.heroes?.[SIDE[team]] ?? [];

// the battle's fighters for a side: its kits as createBattle's side.fighters ({ kind, role, weight })
export const fightersOf = (kits) => kits.map(({ kind, role, weight }) => ({ kind, role, weight }));

// the kit the player flies on a side: its fighter class's, else the first
export const playerKit = (kits, role = 'fighter') => kits.find((k) => k.role === role) ?? kits[0] ?? null;

export function tuneFor(row, ref) {
  const h = row.handling;
  const r = ref.handling;
  const want = {
    cruise: h.maxSpeed / r.maxSpeed,
    boost: h.boostMaxSpeed / r.boostMaxSpeed,
    accel: h.engineAccelerationRate / r.engineAccelerationRate,
    agility: h.axisTurnRates[1] / r.axisTurnRates[1],
  };
  const tune = {};
  const held = [];
  for (const [k, v] of Object.entries(want)) {
    const [lo, hi] = TUNE[k];
    tune[k] = +Math.min(hi, Math.max(lo, v)).toFixed(3);
    if (Math.abs(tune[k] - v) > 1e-3) held.push(k);
  }
  return { tune, held };
}

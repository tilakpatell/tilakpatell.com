// The 2017 game’s damage in space, pure: the rules are its records
// (src/data/bf2017/damage.json, from scripts/lib/bf2017-rulebook-damage.mjs;
// its `_notes` state them, bf2-re findings/62 proves them) and this runs them
// for every bolt in the galaxy and every ram. No three.js, no DOM. The grid
// and the kinds are laid out once here, so a hit looks up and allocates
// nothing but what it returns.
//
// A bolt does `damage` out to falloff[0] m, falling straight to `damageFar`
// at falloff[1] and `damageFar` beyond. What it meets takes the material
// grid’s cell for (the bolt’s property, the target’s): multiplier × damage,
// and only when that reaches the cell’s threshold, else nothing. A pair with
// no relation is the (default, default) cell, 0× under 2: no damage, not 1×
// (findings/62 §3, _notes[0]).
//
// A fighter, or a turret (a vehicle too), is judged against its own pair’s
// property, `VehicleEntityData.MaterialPair`, whatever part the bolt met: a
// part’s own relation spends only that part’s states, which reach a fighter’s
// health through a weak spot, and no starfighter has one (findings/62 §2,
// _notes[1]). Then × the difficulty’s VehicleDamageModifier, and a friend’s
// bolt × its FriendlyDamageModifier (friendly fire off, as the game’s
// multiplayer).
//
// A capital’s part (a static model’s) is judged against the hull part the
// bolt met, × (1 + n × perMate) where the part is linked to the squad bonus
// and × its DamageMultiplier, then spent down its health states: never past
// the next state’s health, where it is held and moves on, the rest of the hit
// going back through the same rule (the threshold checked again, so a rest
// under it is dropped; the bonus and the multiplier applied again); in the
// last state it falls to 0. Only a hit on the part its state names spends
// it, and a friend’s bolt does nothing unless the part has friendly fire
// (findings/62 §4, _notes[2–3]). When a hit moves a part into a state naming
// another part, the game breaks its `children` (FLT_MAX each: the caller’s,
// `spend(childState, Infinity)`).
//
// A blast reaches a vehicle as its record’s damage, no grid (slot 43,
// FUN_141bea1c0, _notes[4]); whether a static model holds a blast to the grid
// was not read, so blastDamage takes the caller’s choice: give it a target
// property and the grid rules, give it none and it doesn’t. Where a blast
// reaches is the caller’s.
//
//   boltDamage(bolt, metres)                  → the bolt’s damage at that range
//   multiplier(attackerProperty, targetProperty) → the grid’s cell { multiplier, threshold, collision, _source }
//                                               (shared: read it, don’t change it)
//   hitDamage(bolt, metres, targetProperty)   → multiplier × boltDamage, or 0 under the threshold
//   vehicleDamage(vehicle, bolt, metres, friend = false) → a fighter’s or turret’s loss
//   blastDamage(blast, targetProperty = null) → the blast’s damage; held to the grid when given a property
//   rammed(ram, angleDeg, friend)             → `friend` or `enemy` under `angle`, a `glancing`-th of it past
//   partsHealth(chain)                        → { hp, stage, floors }: a part’s state at its first health
//   spend(state, dmg, threshold = 0, scale = 1) → the state after dmg (a new one; the given one is kept)
//   partHit(part, state, hit, bolt, metres, mates = 0, friend = false) → the part’s state after the bolt
//                                               (hit: the hull’s part met, { name, property }; the same state when nothing is spent)
//   kindDamage(kind)                          → the kind’s fighters/capitals row, through `stand`; null for none
//   capitalSite(kind, id)                     → the kind’s `site` entry for a war subsystem, or null
//   turretOf(kind, partName)                  → the turret a hull part stands for (`turretParts`), or null

import DAMAGE from '../../data/bf2017/damage.json';

const NONE = DAMAGE.noRelation;
const SQUAD = DAMAGE.squadBonus;

// the grid as rows by the attacker’s property, each by the target’s
const ROWS = [];
for (const [a, row] of Object.entries(DAMAGE.grid)) {
  const cells = (ROWS[Number(a)] = []);
  for (const [t, cell] of Object.entries(row)) cells[Number(t)] = cell;
}

// The difficulty’s modifiers are one DifficultyData row for every vehicle
// (multiplayer Normal); each fighter carries it, a turret’s row doesn’t.
const DIFFICULTY = Object.values(DAMAGE.fighters)[0];
const VEHICLE = DIFFICULTY.vehicleDamageModifier;
const FRIENDLY = DIFFICULTY.friendlyDamageModifier;

// every kind to its row: the game’s own, or the stand-in’s for a kind the
// game never had (null where the stand-in is nothing, the Death Stars)
const KINDS = new Map();
for (const [k, row] of Object.entries(DAMAGE.fighters)) KINDS.set(k, row);
for (const [k, row] of Object.entries(DAMAGE.capitals)) KINDS.set(k, row);
for (const [k, { as }] of Object.entries(DAMAGE.stand)) {
  KINDS.set(k, as ? (DAMAGE.fighters[as] ?? DAMAGE.capitals[as] ?? null) : null);
}

export function boltDamage(bolt, metres) {
  const near = bolt.falloff[0];
  const far = bolt.falloff[1];
  if (metres <= near) return bolt.damage;
  if (metres >= far) return bolt.damageFar;
  return bolt.damage + ((bolt.damageFar - bolt.damage) * (metres - near)) / (far - near);
}

export function multiplier(attackerProperty, targetProperty) {
  const row = ROWS[attackerProperty];
  return (row && row[targetProperty]) || NONE;
}

// the rule (FUN_146a1ad50, slot 42): applied when threshold ≤ multiplier × damage
function judged(property, targetProperty, damage) {
  const cell = multiplier(property, targetProperty);
  const d = cell.multiplier * damage;
  return d >= cell.threshold ? d : 0;
}

export function hitDamage(bolt, metres, targetProperty) {
  return judged(bolt.property, targetProperty, boltDamage(bolt, metres));
}

export function vehicleDamage(vehicle, bolt, metres, friend = false) {
  const d = hitDamage(bolt, metres, vehicle.property) * (vehicle.vehicleDamageModifier ?? VEHICLE);
  return friend ? d * (vehicle.friendlyDamageModifier ?? FRIENDLY) : d;
}

export function blastDamage(blast, targetProperty = null) {
  return targetProperty === null ? blast.damage : judged(blast.property, targetProperty, blast.damage);
}

// What the game measures the angle from was not read (findings/45:187 words
// the glance as below it); the plan’s reading is kept: full under `angle`.
export function rammed(ram, angleDeg, friend) {
  const d = friend ? ram.friend : ram.enemy;
  return angleDeg < ram.angle ? d : d / ram.glancing;
}

export function partsHealth(chain) {
  return { hp: chain[0], stage: 0, floors: chain.slice(1) };
}

// The spend (FUN_140c68080): down to the next state’s health at most, held
// there, and the rest goes back through the rule, so a rest under the
// threshold is dropped and one over it is scaled again. With `states` and the
// hit part’s `name`, a state naming another part takes none of the rest.
function run(state, dmg, threshold, scale, states, name) {
  const floors = state.floors;
  let hp = state.hp;
  let stage = state.stage;
  for (;;) {
    if (stage >= floors.length) {
      hp = hp - dmg > 0 ? hp - dmg : 0;
      break;
    }
    const floor = floors[stage];
    if (hp - dmg > floor) {
      hp -= dmg;
      break;
    }
    const rest = dmg - (hp - floor);
    hp = floor;
    stage++;
    if (states && states[stage] !== name) break;
    if (!(rest > 0) || rest < threshold) break;
    dmg = rest * scale;
  }
  return { hp, stage, floors };
}

export function spend(state, dmg, threshold = 0, scale = 1) {
  return dmg > 0 ? run(state, dmg, threshold, scale, null, null) : state;
}

// mates: the shooter’s squadmates who hit the part in the last
// squadBonus.cooldown seconds (the caller counts them; 0 by default), at
// most one unless the bonus is each mate’s
export function partHit(part, state, hit, bolt, metres, mates = 0, friend = false) {
  if (friend && !part.friendlyFire) return state;
  if (part.states[state.stage] !== hit.name) return state;
  const cell = multiplier(bolt.property, hit.property);
  const d = cell.multiplier * boltDamage(bolt, metres);
  if (!(d > 0) || d < cell.threshold) return state;
  const n = SQUAD.eachMate ? mates : Math.min(mates, 1);
  const scale = (part.squad ? 1 + n * SQUAD.perMate : 1) * (part.damageMultiplier ?? 1);
  return run(state, d * scale, cell.threshold, scale, part.states, hit.name);
}

export function kindDamage(kind) {
  return KINDS.get(kind) ?? null;
}

// the site’s choices (_notes[5]), not records: which game record a war
// subsystem takes, and which turret a hull part stands for
export function capitalSite(kind, id) {
  return kindDamage(kind)?.site?.[id] ?? null;
}

export function turretOf(kind, partName) {
  const row = kindDamage(kind);
  const turret = row?.turretParts?.parts[partName];
  return (turret && row.turrets[turret]) || null;
}

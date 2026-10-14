// The 2017 game’s damage in space, pure: the rules are its records
// (src/data/bf2017/damage.json, from scripts/lib/bf2017-rulebook-damage.mjs;
// its `_notes` state them, bf2-re findings/62 proves them) and this runs them
// for every bolt in the galaxy and every ram. No three.js, no DOM. The grid,
// the kinds and the capitals’ parts are laid out once here, so a hit looks
// up and allocates nothing but what it returns.
//
// A bolt does `damage` out to falloff[0] m, falling straight to `damageFar`
// at falloff[1] and `damageFar` beyond. What it meets takes the material
// grid’s cell for (the bolt’s property, the target’s): multiplier × damage,
// and only when that reaches the cell’s threshold, else nothing. A pair with
// no relation is the (default, default) cell, 0× under 2: no damage, not 1×
// (findings/62 §3; _notes.bolt).
//
// A fighter, or a turret (a vehicle too), is judged against its own pair’s
// property, `VehicleEntityData.MaterialPair`, whatever part the bolt met: a
// part’s own relation spends only that part’s states, which reach a fighter’s
// health through a weak spot, and no starfighter has one (findings/62 §2;
// _notes.fighter). Then × the difficulty’s VehicleDamageModifier, and a
// friend’s bolt × its FriendlyDamageModifier (friendly fire off, as the
// game’s multiplayer).
//
// A capital’s part (a static model’s: a `parts` row, or a `site` entry, the
// war’s subsystem on a game record) is judged against the record’s property
// for its current state, × (1 + n × perMate) where it is linked to the squad
// bonus and × its DamageMultiplier, then spent down its health states: never
// past the next state’s health, where it is held and moves on, the rest of
// the hit going back through the same rule (÷ the multiplier it was judged
// by, × the new state’s, the threshold checked again, so a rest under it or
// on a state no bolt hurts is dropped; the bonus and the multiplier applied
// again); in the last state it falls to 0. Where the record names a part a
// state (`states`), only a hit on that part spends it and the rest stops at a
// state naming another; an entry without (a site hull’s own part, a level’s
// object) takes any hit routed to it by its `parts`. A friend’s bolt does
// nothing unless it has friendly fire (findings/62 §4; _notes.capital,
// .chain, .site). When a hit moves a part into a state naming another part,
// the game breaks its `children` (FLT_MAX each: the caller’s,
// `spend(childState, Infinity)`).
//
// A blast reaches a vehicle as its record’s damage, no grid (slot 43,
// FUN_141bea1c0; _notes.blast); whether a static model holds a blast to the
// grid was not read, so blastDamage takes the caller’s choice: give it a
// target property and the grid rules, give it none and it doesn’t. Where a
// blast reaches is the caller’s.
//
//   boltDamage(bolt, metres)                  → the bolt’s damage at that range
//   multiplier(attackerProperty, targetProperty) → the grid’s cell { multiplier, threshold, collision, _source }
//                                               (shared: read it, don’t change it)
//   hitDamage(bolt, metres, targetProperty)   → multiplier × boltDamage, or 0 under the threshold
//   vehicleDamage(vehicle, bolt, metres, friend = false) → a fighter’s or turret’s loss
//   blastDamage(blast, targetProperty = null) → the blast’s damage; held to the grid when given a property
//   rammed(ram, angleDeg, friend)             → `friend` or `enemy` under `angle`, a `glancing`-th of it past
//   partsHealth(chain)                        → { hp, stage, floors }: a part’s state at its first health
//   spend(state, dmg, threshold = 0, scale = 1) → the state after dmg: a new one, or the same when unchanged
//   takes(row, state, name)                   → whether a hit on that hull part spends the row in its state
//   partHit(row, state, name, bolt, metres, mates = 0, friend = false) → the row’s state after the bolt
//                                               (name: the hull part met, or null for the record’s current
//                                               part; the same state when nothing is spent)
//   openSite(entry, state)                    → the state the war opens an objective’s record to
//   capitalPart(kind, partName)               → where a hull part’s hit goes: { kind: 'site' | 'turret' |
//                                               'part', key, row, name, keys?, fallback } or null
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

// The ruling: `angleDeg` is measured from the contact normal, 0° head-on;
// under `angle` (CollisionAngle) the full ram, past it a `glancing`-th.
export function rammed(ram, angleDeg, friend) {
  const d = friend ? ram.friend : ram.enemy;
  return angleDeg < ram.angle ? d : d / ram.glancing;
}

export function partsHealth(chain) {
  return { hp: chain[0], stage: 0, floors: chain.slice(1) };
}

// The spend (FUN_140c68080): down to the next state’s health at most, held
// there, and the rest goes back through the rule (÷ the multiplier m it was
// judged by, then slot 42 again). With a row, the rest is judged again on the
// new state’s property, and stops at a state naming another part than `name`;
// without one (spend), the cell stays the same. The same state comes back
// when neither the health nor the state moved.
function run(row, state, dmg, attacker, m, threshold, scale, name) {
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
    let rest = dmg - (hp - floor);
    hp = floor;
    stage++;
    if (!(rest > 0)) break;
    if (row) {
      if (row.states && row.states[stage] !== name) break;
      const cell = multiplier(attacker, row.properties[stage]);
      if (cell.multiplier !== m) {
        rest = (rest / m) * cell.multiplier;
        m = cell.multiplier;
      }
      threshold = cell.threshold;
    }
    if (!(rest > 0) || rest < threshold) break;
    dmg = rest * scale;
  }
  return hp === state.hp && stage === state.stage ? state : { hp, stage, floors };
}

export function spend(state, dmg, threshold = 0, scale = 1) {
  return dmg > 0 ? run(null, state, dmg, undefined, 1, threshold, scale, null) : state;
}

// The gate: where the record names a part a state, only a hit on that part
// spends it (findings/62 §4); a row without `states` takes any hit its caller
// routes to it; a null name is the record’s current part (a stand-in’s
// subsystem, whose hull has none of the record’s parts).
export function takes(row, state, name) {
  return name === null || !row.states || row.states[state.stage] === name;
}

// mates: the shooter’s squadmates who hit the part in the last
// squadBonus.cooldown seconds (the caller counts them; 0 by default), at
// most one unless the bonus is each mate’s
export function partHit(row, state, name, bolt, metres, mates = 0, friend = false) {
  if (friend && !row.friendlyFire) return state;
  if (!takes(row, state, name)) return state;
  const cell = multiplier(bolt.property, row.properties[state.stage]);
  const d = cell.multiplier * boltDamage(bolt, metres);
  if (!(d > 0) || d < cell.threshold) return state;
  const n = SQUAD.eachMate ? mates : Math.min(mates, 1);
  const scale = (row.squad ? 1 + n * SQUAD.perMate : 1) * (row.damageMultiplier ?? 1);
  const at = name === null && row.states ? row.states[state.stage] : name;
  return run(row, state, d * scale, bolt.property, cell.multiplier, cell.threshold, scale, at);
}

// The site’s rule, labelled as the site’s: when the war makes a subsystem its
// objective, a record whose first state is a 1-hp shell above the next (the
// MC80’s nodules 201 then 200 and engines 251 then 250, the Venator’s bridge
// 700 then 699: on a part no bolt hurts, so no bolt starts them) moves to its
// second state at that health. It stands for the game’s objective start,
// whose prefabs send the record an event (0xffd00e43, its name unresolved;
// findings/62, the Task 7 report); any other record is as it was.
export function openSite(entry, state) {
  const h = entry.health;
  if (state.stage !== 0 || !h || h.length < 2 || h[0] - h[1] !== 1) return state;
  return { hp: h[1], stage: 1, floors: state.floors };
}

// Where a hull part’s hit goes (_notes.precedence, _notes.site), one index a
// capital row, built the first time it is asked for:
// - a site entry whose `parts` name it ({ kind: 'site', key, keys, row, name,
//   fallback }; `keys` every entry naming it: the Star Destroyer’s two
//   generators share its one dome module). The controller’s ruling: where
//   the entry’s state names another part (takes() refuses), the hit falls to
//   `fallback`, the part’s own turret or row below, or null;
// - else, for a hull part named as a war subsystem (a stand-in’s hull, made
//   of the war’s parts), the site entry of that name with a record, `name`
//   null: the hit is on the record’s current part;
// - else the turret `turretParts` names ({ kind: 'turret', key, row });
// - else the `parts` row any of whose states names it ({ kind: 'part' }).
// A part none of these names is null: it counts as the hull (_notes.site).
const PARTS = new Map();

function indexOf(row) {
  const index = new Map();
  const own = new Map();
  for (const [key, part] of Object.entries(row.parts ?? {})) {
    for (const s of part.states) if (s && !own.has(s)) own.set(s, { kind: 'part', key, row: part, name: s, fallback: null });
  }
  for (const [part, key] of Object.entries(row.turretParts?.parts ?? {})) {
    own.set(part, { kind: 'turret', key, row: row.turrets[key], name: part, fallback: null });
  }
  for (const [name, at] of own) index.set(name, at);
  for (const [key, entry] of Object.entries(row.site ?? {})) {
    if (entry.health) index.set(key, { kind: 'site', key, keys: [key], row: entry, name: null, fallback: null });
  }
  for (const [key, entry] of Object.entries(row.site ?? {})) {
    if (!entry.health) continue;
    for (const part of entry.parts) {
      const at = index.get(part);
      if (at?.kind === 'site' && at.name !== null) at.keys.push(key);
      else index.set(part, { kind: 'site', key, keys: [key], row: entry, name: part, fallback: own.get(part) ?? null });
    }
  }
  return index;
}

export function capitalPart(kind, partName) {
  const row = kindDamage(kind);
  if (!row?.site) return null;
  let index = PARTS.get(row);
  if (!index) PARTS.set(row, (index = indexOf(row)));
  return index.get(partName) ?? null;
}

export function kindDamage(kind) {
  return KINDS.get(kind) ?? null;
}

// the site’s choices (_notes.site), not records: which game record a war
// subsystem takes, and which turret a hull part stands for
export function capitalSite(kind, id) {
  return kindDamage(kind)?.site?.[id] ?? null;
}

export function turretOf(kind, partName) {
  const row = kindDamage(kind);
  const turret = row?.turretParts?.parts[partName];
  return (turret && row.turrets[turret]) || null;
}

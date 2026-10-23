// The guns' numbers, pure (tested in Node; scene.js shoots by them, the
// hero panel offers them): the table is lib/arms/hand.js's and the rules
// (the heat and its vent, the mods, the sights) lib/arms/handRules.js's,
// one set for every world a crew walks with a gun; both re-exported here for
// the galaxy's callers. The kinds are universe/gunplay.js's GUNS (the gun in
// the hand); a kind here without one there falls back to the blaster's
// numbers.
//
//   WEAPONS, MODS, WEAPON_IDS, MOD_IDS, PICKABLE, SHOW_KILLS, UNIQUE_HAND,
//   pickableWith         the table, lib/arms/hand.js's
//   SHOT_FLOOR, VENT, COOL_WAIT, weaponOf, withMods, heatShot, heatStep, vent, ventSpot,
//   spreadAt             the rules, lib/arms/handRules.js's

export { MAX_MODS, MODS, MOD_IDS, PICKABLE, SHOW_KILLS, UNIQUE_HAND, WEAPONS, WEAPON_IDS, pickableWith } from '../../../lib/arms/hand';
export { COOL_WAIT, SHOT_FLOOR, VENT, heatShot, heatStep, spreadAt, vent, ventSpot, weaponOf, withMods } from '../../../lib/arms/handRules';

// The Hangar's Arms, as plain rules: the ship's three lines as they're
// fitted (the universe's armoury, weapons.js), each with what it does (a
// hit's damage, shots a second at the ship's stock pace, the shots in a
// burst, the ordnance rack), and the shipyard slot it's changed in; and a
// crew member's guns for the hand, their own first and then the ones any
// of them may pick (the galaxy's table, weaponRules.js), none for a Jedi
// (their blade is the Crew's) or for Artoo. Pure, tested.
//
//   LINE_SLOT, STOCK_CADENCE
//   shipLines(ship, loadout) → [{ line, name, weapon, damage, rate, shots, rack: { ammo, reload } | null }]
//   handGuns(who) → [{ id, name, about, damage, rate, range, heat }]

import { HAND_WEAPONS, PICKABLE, heroById } from '../galaxy/shared/arms';
import { SHIP_WEAPONS, createArmory } from '../universe/shared/hangar';

export const LINE_SLOT = { primary: 'guns', secondary: 'secondary', ordnance: 'ordnance' };
// each ship's seconds between blaster shots, as both maps fly them (universe/
// scene.js's and galaxy/scene.js's CADENCE, which neither lends)
export const STOCK_CADENCE = { xwing: 0.12, falcon: 0.16, cruiser: 0.19, rv: 0.2 };

export function shipLines(ship, loadout) {
  const arm = createArmory(ship, loadout);
  const base = STOCK_CADENCE[ship] ?? 0.18;
  return [0, 1, 2].map((i) => {
    arm.select(i);
    const w = SHIP_WEAPONS[arm.id];
    return { line: arm.line, name: arm.name, weapon: arm.id, damage: w.damage, rate: 1 / (base * w.cadence), shots: w.count, rack: w.heavy ? { ammo: w.ammo, reload: w.reload } : null };
  });
}

export function handGuns(who) {
  const own = heroById(who)?.weapon;
  if (!own || own === 'saber') return [];
  return [own, ...PICKABLE.filter((g) => g !== own)]
    .filter((g) => HAND_WEAPONS[g])
    .map((id) => {
      const w = HAND_WEAPONS[id];
      return { id, name: w.name, about: w.about, damage: w.damage, rate: (w.burst ?? 1) / w.every, range: w.range, heat: w.heat };
    });
}

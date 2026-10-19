// The Hangar's Arms, as plain rules: the ship's three lines as they're
// fitted (the universe's armoury, weapons.js), each with what it does (a
// hit's damage, shots a second at the ship's stock pace, the shots in a
// burst, the ordnance rack), and the shipyard slot it's changed in; and a
// crew member's guns for the hand, their own first and then the ones any
// of them may pick (the galaxy's table, weaponRules.js), none for a Jedi
// (their blade is the Crew's) or for Artoo; and the skill tree's eight
// unique weapons, each open or naming the node that opens it. Pure, tested.
//
//   LINE_SLOT, STOCK_CADENCE
//   shipLines(ship, loadout, fx) → [{ line, name, weapon, damage, rate, shots, rack: { ammo, reload } | null }]
//   handGuns(who, arms) → [{ id, name, about, damage, rate, range, heat, unique }]
//   uniqueArms(arms) → [{ id, node, name, does, from, where ('ship' | 'hand'), slot (the shipyard's, a ship's), opens ('Skills · Guns · Seismic charge'), open }]
// (`fx`, `arms`: the skill tree's effects and its fx.arms, the unique weapons opened)

import { HAND_WEAPONS, heroById, pickableWith } from '../galaxy/shared/arms';
import { SHIP_WEAPONS, createArmory } from '../universe/shared/hangar';
import { BRANCH_LABEL, KEY_LABEL, NODES } from './skills/tree';

export const LINE_SLOT = { primary: 'guns', secondary: 'secondary', ordnance: 'ordnance' };
// each ship's seconds between blaster shots, as both maps fly them (universe/
// scene.js's and galaxy/scene.js's CADENCE, which neither lends)
export const STOCK_CADENCE = { xwing: 0.12, falcon: 0.16, cruiser: 0.19, rv: 0.2 };

export function shipLines(ship, loadout, fx = undefined) {
  const arm = createArmory(ship, loadout, fx);
  const base = STOCK_CADENCE[ship] ?? 0.18;
  return [0, 1, 2].map((i) => {
    arm.select(i);
    const w = arm.weapon;
    return { line: arm.line, name: arm.name, weapon: arm.id, damage: w.damage, rate: 1 / (base * w.cadence), shots: w.count, rack: w.heavy ? { ammo: w.ammo, reload: w.reload } : null };
  });
}

export function handGuns(who, arms = []) {
  const own = heroById(who)?.weapon;
  if (!own || own === 'saber') return [];
  return [own, ...pickableWith(arms).filter((g) => g !== own)]
    .filter((g) => HAND_WEAPONS[g])
    .map((id) => {
      const w = HAND_WEAPONS[id];
      return { id, name: w.name, about: w.about, damage: w.damage, rate: (w.burst ?? 1) / w.every, range: w.range, heat: w.heat, unique: Boolean(w.unique) };
    });
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);
export function uniqueArms(arms = []) {
  const open = Array.isArray(arms) ? arms : [];
  return Object.entries(NODES)
    .filter(([, n]) => n.arms)
    .map(([node, n]) => {
      const ship = SHIP_WEAPONS[n.arms]?.unique ? SHIP_WEAPONS[n.arms] : null;
      return {
        id: n.arms,
        node,
        name: n.name,
        does: ship ? n.line : `In the hand: ${n.line[0].toLowerCase()}${n.line.slice(1)}`,
        from: cap(KEY_LABEL[n.key]),
        where: ship ? 'ship' : 'hand',
        slot: ship ? LINE_SLOT[ship.line] : null,
        opens: `Skills · ${BRANCH_LABEL[n.branch]} · ${n.name}`,
        open: open.includes(n.arms),
      };
    });
}

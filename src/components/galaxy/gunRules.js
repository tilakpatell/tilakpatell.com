// The galaxy's guns, every line of the universe's armoury (weapons.js,
// through universe/shared/flying.js), as the galaxy fires them: one shot's
// punch, from the guns fitted in the shipyard, the pickups' rapid fire and
// the weapon's own; and a line's pace, the ship's own (its cadence, under
// the pickups) times the weapon's. Pure, tested.
//
//   shotPunch(w, g, gun) → hits on a hunter one shot is worth (lib/combat/flight/guns.js's)
//   lineCadence(base, w) → seconds between this line's shots

export { shotPunch } from '../../lib/combat/flight/guns'; // (both maps': lib/combat/flight/guns.js)
export const lineCadence = (base, w) => base * (w?.cadence ?? 1);

// Every weapon a ship can carry, as numbers: one table for every world that
// flies the universe's ships (the universe map and the galaxy). A leaf
// module: the universe's outfit.js reads it as it loads (the read-out's
// ordnance row) and its weapons.js builds the armoury from outfit.js's parts,
// so the table sits apart from both and neither waits on the other.
// (universe/weaponTable.js re-exports it, for the callers it had.)
//
// code: what goes over the wire with a shot (the universe's protocol.js), so the others
// draw it as it is; never reused, never over 15. line: which of the three
// it's fired from (weapons.js's LINES). damage: what one hit takes off
// another pilot's shields (a blaster bolt is protocol.js's DAMAGE; none over
// its DAMAGE_MAX). punch: against hunters and the Citadel (a hunter's hp is
// in punches). life and speed: of the blaster's. scale: how big each shot
// is drawn. The ordnance line's rounds are few: `ammo` of them, one back
// every `reload` seconds, and they home at `homing` radians a second.
// unique: one of the four the skill tree opens (hangar/skills/tree.js's u-*
// nodes, which name it as `arms`): a ship fires it only while its node is
// taken (universe/weapons.js), and what it does past a bolt is
// universe/uniqueArms.js's, on lib/arms/behaviours.js's numbers.
export const WEAPONS = {
  blaster: { code: 0, line: 'primary', cadence: 1, count: 1, cone: 0, life: 1, speed: 1, damage: 10, punch: 1, scale: 1 },
  spread: { code: 1, line: 'secondary', cadence: 2.4, count: 5, cone: 0.075, life: 0.55, speed: 0.9, damage: 6, punch: 0.6, scale: 0.75 },
  heavy: { code: 2, line: 'ordnance', cadence: 3.2, count: 1, cone: 0, life: 2.8, speed: 0.5, damage: 30, punch: 8, scale: 1, homing: 2.4, ammo: 4, reload: 6.5, heavy: true },
  ion: { code: 3, line: 'secondary', cadence: 3, count: 3, cone: 0.05, life: 0.7, speed: 0.85, damage: 8, punch: 1.2, scale: 0.9 },
  flak: { code: 4, line: 'secondary', cadence: 2, count: 7, cone: 0.12, life: 0.4, speed: 0.95, damage: 4, punch: 0.45, scale: 0.65 },
  missiles: { code: 5, line: 'ordnance', cadence: 2.2, count: 1, cone: 0, life: 2.2, speed: 0.65, damage: 20, punch: 5, scale: 1, homing: 3.4, ammo: 6, reload: 4.5, heavy: true },
  mk2: { code: 6, line: 'ordnance', cadence: 4, count: 1, cone: 0, life: 3.2, speed: 0.45, damage: 30, punch: 12, scale: 1, homing: 2, ammo: 3, reload: 9, heavy: true },
  // ── the unique four ──
  // the Seismic charge (Attack of the Clones): dropped behind, then a flat ring of it
  seismic: { code: 7, line: 'ordnance', cadence: 4, count: 1, cone: 0, life: 1.4, speed: 0.1, damage: 26, punch: 9, scale: 1.4, ammo: 2, reload: 10, heavy: true, unique: true },
  // Concentrated dark matter (Rick's): one slow bolt through every ship in its line
  darkmatter: { code: 8, line: 'secondary', cadence: 3.6, count: 1, cone: 0.06, life: 2.4, speed: 0.38, damage: 18, punch: 4, scale: 2, unique: true },
  // the Blue sky cluster (Walt's): a homing round that bursts into six shards near its target
  crystal: { code: 9, line: 'ordnance', cadence: 3, count: 1, cone: 0, life: 2.6, speed: 0.55, damage: 24, punch: 3, scale: 1, homing: 3, ammo: 3, reload: 7, heavy: true, unique: true },
  // the Energon arc (Cybertron's): lightning to the lock and on; `count` is the ships it reaches
  energon: { code: 10, line: 'secondary', cadence: 3, count: 4, cone: 0, life: 0.75, speed: 1, damage: 12, punch: 2.4, scale: 1, unique: true },
};

const BY_CODE = new Map(Object.entries(WEAPONS).map(([id, w]) => [w.code, id]));
// A shot's weapon from its wire code: anything not in the table (a newer
// peer's, or junk) is drawn as the blaster.
export const byCode = (code) => BY_CODE.get(code) ?? 'blaster';

// An ordnance rack's worth against the stock torpedoes': hits on hunters a
// second, held over the reload (the read-out's row and the catalogue's price).
export const rackOf = (w) => (w.punch * w.ammo) / w.reload;
// A secondary's worth: what a burst lands on hunters, over the time between bursts.
export const burstOf = (w) => (w.count * w.punch) / w.cadence;

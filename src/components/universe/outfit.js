// The hangar: fitting out a ship for the universe map, the way a space sim's
// outfitting screen does it. Each ship has slots, and a part for each:
// its paint job (paint.js), strap-on boosters, manoeuvring thrusters, its
// guns, its shields and a set of fins. Parts are real (modules.js bolts
// them on, and the other pilots see them) and they change how it flies:
// boosters push the boost harder (and get to it quicker), thrusters swing
// it round faster, guns fire faster or hit harder, shields soak more or
// come back sooner. Nothing's free: every part draws power from the ship's
// own plant (and a fit that needs more than it makes won't go on), and
// adds mass, which takes the edge off how fast it turns. The factory parts
// are every ship's; a few more come straight away, and the best are
// earned, each with an achievement from one of the worlds.
//
// Pure data and numbers, so it's tested in Node: Hangar.jsx offers the
// parts and shows statsOf, scene.js flies on statsOf (ship.js's `tune`), and
// online/protocol.js sends what's fitted (only ids from here are believed).

import { CADENCE, pace } from '../../lib/combat/flight/guns';
import { PAINTS, STOCK, isOpen as paintOpen, parsePaint } from './paint';
import { statsOfBuild, statsOfTune } from './shipyard/build';
import { tuned } from './ship';
import { WEAPONS, rackOf } from './weaponTable';

export { STOCK };
export const LOADOUT_KEY = 'tp-universe-loadout';
// (secondary and ordnance came last, after the fins, so every loadout kept
// and every peer's wire reads as it did: a slot it never had is stock)
export const SLOTS = ['paint', 'booster', 'thrusters', 'guns', 'shields', 'fins', 'secondary', 'ordnance'];
export const SLOT_LABEL = { paint: 'Paint', booster: 'Boosters', thrusters: 'Thrusters', guns: 'Primary', shields: 'Shields', fins: 'Fins', secondary: 'Secondary', ordnance: 'Ordnance' };
export const PARTS_SLOTS = SLOTS.slice(1); // (the ones that are parts, not paint)
export const FASTEST = 0.12; // seconds between shots, at the quickest any gun may fire (protocol.js lets in ten a second)
const MASS_K = 0.03; // how much each tonne of parts takes off how quickly it turns

// Each ship's power plant (MW): the Falcon's got it where it counts, the
// RV's a camper's generator
export const PLANT = { xwing: 7, falcon: 9, cruiser: 8, rv: 5 };

// A part: { id, slot, name, blurb, mass (t), power (MW), achievement, hint }
// and what it does: boost, accel, cruise, agility, level (each added on, as
// a share of what the ship does as it comes), cadence (the time between
// shots, multiplied), punch (hits on a hunter each bolt is worth), bolt
// (how big the bolt is drawn), armor (damage taken, multiplied), regen (how
// fast shields come back, multiplied), delay (seconds after a hit before
// they start). A secondary or ordnance part names the `weapon`
// (weaponTable.js) it puts on that line of the armoury (weapons.js). A part with a `look` is drawn as that part of its slot is
// (modules.js): one that's new in the numbers, with no model of its own.
// What a part costs, and any lock beyond an achievement, is catalog.js's.
const part = (slot, id, name, blurb, { mass = 0, power = 0, achievement = null, hint = null, ...does } = {}) => ({ id, slot, name, blurb, mass, power, achievement, hint, ...does });

export const PARTS = [
  // boosters, strapped to its flanks, lit as it boosts
  part('booster', STOCK, 'None', 'The engines it came with.'),
  part('booster', 'srb', 'Twin solid boosters', 'A pair of rockets strapped either side. More boost, sooner.', { mass: 2, power: 1, boost: 0.25, accel: 0.2 }),
  part('booster', 'afterburner', 'Afterburner', 'A collar round the engines that lights the boost up long and white.', {
    mass: 1,
    power: 2,
    boost: 0.35,
    accel: 0.1,
    achievement: 'trench',
    hint: 'Hit the exhaust port in the trench run',
  }),
  part('booster', 'repulsor', 'Repulsor pods', 'Stark tech under each flank: the quickest to full boost.', {
    mass: 1,
    power: 3,
    boost: 0.3,
    accel: 0.45,
    achievement: 'ironman',
    hint: 'Bring down Ultron Prime at the Repulsor Range',
  }),
  part('booster', 'portal', 'Portal-fluid injectors', 'Two tanks of the green stuff. The fastest thing on the map, and heavy with it.', {
    mass: 3,
    power: 3,
    boost: 0.55,
    accel: 0.3,
    achievement: 'showmewhatyougot',
    hint: 'Beat the Cromulon in Portal panic',
  }),
  // manoeuvring thrusters
  part('thrusters', STOCK, 'Stock', 'The thrusters it came with.'),
  part('thrusters', 'rcs', 'RCS quads', 'Four little thruster blocks at its corners. Turns, pitches and rolls quicker.', { mass: 0.5, power: 1, agility: 0.15 }),
  part('thrusters', 'racing', 'Racing exhausts', 'Chrome pipes, hot-rod style: a faster cruise and a quicker getaway.', {
    mass: 1,
    power: 2,
    cruise: 0.15,
    accel: 0.25,
    achievement: 'hulk',
    hint: 'Run 2,000 m through Midtown at Smash Run',
  }),
  part('thrusters', 'vector', 'Vectored thrust', 'Vanes on the engines that steer the blast, as a Seeker’s do. The tightest turns there are.', {
    mass: 1,
    power: 2,
    agility: 0.3,
    level: 0.3,
    achievement: 'grounded',
    hint: 'Bring Starscream down over Jasper in Roll out',
  }),
  part('thrusters', 'vamonos', 'Vamonos Pest exhausts', 'The pest van’s pipes, tented and tuned: a quicker cruise for a quiet getaway.', {
    mass: 1,
    power: 1,
    cruise: 0.1,
    accel: 0.15,
    agility: 0.05,
    look: 'racing',
  }),
  // guns
  part('guns', STOCK, 'Stock', 'The guns it came with.'),
  part('guns', 'twin', 'Twin-linked cannons', 'A second barrel, fired in turn with the first. Quicker shots.', { mass: 1, power: 1, cadence: 0.8 }),
  part('guns', 'fusion', 'Fusion cannon', 'Megatron’s arm cannon, bolted on: slow, and a bolt takes three hits’ worth off a hunter.', {
    mass: 2,
    power: 3,
    cadence: 2,
    punch: 3,
    bolt: 2,
    achievement: 'onestand',
    hint: 'Beat Megatron in Kaon in Roll out',
  }),
  part('guns', 'incom', 'Incom targeting computer', 'An X-wing’s own fire control, wired to twin barrels: quicker shots than a second barrel alone.', {
    mass: 1,
    power: 2,
    cadence: 0.7,
    achievement: 'rebels',
    hint: 'Save Yavin 4 in the Battle of Yavin',
    look: 'twin',
  }),
  // shields
  part('shields', STOCK, 'Stock', 'The shields it came with.'),
  part('shields', 'reinforced', 'Reinforced plating', 'Armour on its flanks: takes a fifth less from a hit, comes back a little slower.', { mass: 1.5, power: 1, armor: 0.8, regen: 0.85 }),
  part('shields', 'fastcharge', 'Fast-charge emitters', 'Shields that start coming back two seconds after a hit, and twice as fast.', {
    mass: 0.5,
    power: 2,
    regen: 2,
    delay: 2,
    achievement: 'captain',
    hint: 'Clear all twelve rooms of Ricochet',
  }),
  part('shields', 'vibranium', 'Vibranium plating', 'Cap’s shield on its back, and the metal under the paint: takes two fifths less from a hit.', {
    mass: 2,
    power: 2,
    armor: 0.6,
    achievement: 'quinjet',
    hint: 'Fly the Tesseract into the hangar at Tesseract Run',
  }),
  // fins
  part('fins', STOCK, 'None', 'As it came.'),
  part('fins', 'fins', 'Stabiliser fins', 'A pair of tail fins: rolls back upright quicker, turns a touch tighter.', { mass: 0.5, level: 0.4, agility: 0.05 }),
  part('fins', 'council', 'Council of Ricks fins', 'The Council’s own tail fins, with a powered trim: upright quicker still, and tighter in a turn.', {
    mass: 0.5,
    power: 1,
    level: 0.5,
    agility: 0.1,
    look: 'fins',
  }),
  // the secondary line: a fan of shorter shots
  part('secondary', STOCK, 'Scatter', 'The scatter it came with.', { weapon: 'spread' }),
  part('secondary', 'ion', 'Ion burst', 'Three heavier ion bolts a burst, tighter than the scatter.', {
    mass: 1,
    power: 1,
    weapon: 'ion',
    achievement: 'rebels',
    hint: 'Save Yavin 4 in the Battle of Yavin',
    look: 'twin',
  }),
  part('secondary', 'flak', 'Flak burst', 'Seven short-lived shells in a wide fan: hard to miss with, light on each hit.', { mass: 1.5, power: 2, weapon: 'flak', look: 'twin' }),
  // (the skill tree's two: each sold and fired only once its node is taken, catalog.js's NEW and weapons.js)
  part('secondary', 'darkmatter', 'Concentrated dark matter', 'Rick’s: one slow, dark bolt that goes through every ship in its line, a third less at each.', { mass: 1.5, power: 2, weapon: 'darkmatter', look: 'twin' }),
  part('secondary', 'energon', 'Energon arc', 'Cybertron’s lightning: to the lock, then on to up to three more near it, each jump weaker.', { mass: 1, power: 2, weapon: 'energon', look: 'twin' }),
  // the ordnance line: slow homing rounds from a rack
  part('ordnance', STOCK, 'Torpedo rack', 'The rack it came with: four heavy rounds.', { weapon: 'heavy' }),
  part('ordnance', 'missiles', 'Missile rack', 'Six lighter missiles that turn harder and come back sooner.', { mass: 1, power: 1, weapon: 'missiles', look: 'fusion' }),
  part('ordnance', 'mk2', 'Mk II torpedoes', 'Three slow torpedoes that hit half as hard again as the stock rack’s, and take their time coming back.', {
    mass: 2,
    power: 2,
    weapon: 'mk2',
    achievement: 'trench',
    hint: 'Hit the exhaust port in the trench run',
    look: 'fusion',
  }),
  part('ordnance', 'seismic', 'Seismic charges', 'Two charges dropped behind you: a beat of silence, then a flat ring that takes everything in it.', { mass: 2, power: 2, weapon: 'seismic', look: 'fusion' }),
  part('ordnance', 'crystal', 'Blue sky cluster', 'Three homing rounds that burst into six blue shards near what they’re after.', { mass: 1, power: 1, weapon: 'crystal', look: 'fusion' }),
];

const BY_SLOT = Object.fromEntries(SLOTS.map((slot) => [slot, new Map()]));
for (const p of PARTS) BY_SLOT[p.slot].set(p.id, p);
for (const p of PAINTS) BY_SLOT.paint.set(p.id, { ...p, slot: 'paint', mass: 0, power: 0 });

export const partsFor = (slot) => [...(BY_SLOT[slot]?.values() ?? [])];
export const partById = (slot, id) => BY_SLOT[slot]?.get(id) ?? BY_SLOT[slot]?.get(STOCK) ?? null;

// A part id for a slot, from storage or the wire, or null for anything else.
export const parsePart = (slot, id) => (slot === 'paint' ? parsePaint(id) : typeof id === 'string' && BY_SLOT[slot]?.has(id) ? id : null);

// Whether a part's there to fit, with these achievements unlocked.
export const isOpen = (p, unlocked = []) => (p.slot === 'paint' ? paintOpen(p, unlocked) : !p.achievement || unlocked.includes(p.achievement));

// The parts (not paints) an achievement opens, for its toast.
export const partsUnlockedBy = (achievement) => PARTS.filter((p) => p.achievement === achievement);

export const STOCK_LOADOUT = Object.freeze(Object.fromEntries(SLOTS.map((s) => [s, STOCK])));

// What's fitted, as a whole loadout: every slot a part it has (the
// factory's for anything else).
export function readLoadout(raw) {
  const out = { ...STOCK_LOADOUT };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const slot of SLOTS) out[slot] = parsePart(slot, raw[slot]) ?? STOCK;
  return out;
}

// Whatever was kept (or nothing), as { ship id: loadout } for the ships
// given (crews.js's).
export function readLoadouts(raw, ships) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const ship of ships) if (raw[ship] && typeof raw[ship] === 'object') out[ship] = readLoadout(raw[ship]);
  return out;
}

const fitted = (loadout) => PARTS_SLOTS.map((slot) => partById(slot, loadout[slot]));

// How much power a loadout draws, and how much its parts weigh.
export const powerOf = (loadout) => fitted(loadout).reduce((n, p) => n + p.power, 0);
export const massOf = (loadout) => fitted(loadout).reduce((n, p) => n + p.mass, 0);
// A garage build (shipyard/build.js) flown in place of the ship's own hull
// brings its own plant, and its modules draw from it too. On the crew's own
// ship, a tune's modules draw from the crew's plant (a tune brings none).
export const capacityOf = (kind, build = null) => (build ? statsOfBuild(build).plant : (PLANT[kind] ?? 0));
// What the hull's modules draw: a build's, or on the stock ship the tune's.
const hullDraw = (build, tune) => (build ? statsOfBuild(build).power : tune ? statsOfTune(tune).power : 0);
export const fits = (kind, loadout, build = null, tune = null) => powerOf(loadout) + hullDraw(build, tune) <= capacityOf(kind, build);

// What a loadout does to the ship, as multipliers on how it flies as it
// comes (1 each, for the factory's): { boost, accel, cruise, agility, level }
// for ship.js's tune, { cadence, punch, bolt } for the guns, { armor, regen,
// delay } for the shields, and its mass, power and the plant's capacity.
// On a garage build, the build's own numbers are what it does as it comes;
// on the crew's own ship, the modules of its tune (a tune is a stock ship's
// only: a build's modules are the ship) add theirs to what it does as it comes.
// (the skill tree's effects, hangar/skills's fx, as the scenes hand them in;
// neutral when there are none: nothing added, nothing multiplied)
const NO_FX = {};
export function statsOf(kind, loadout = STOCK_LOADOUT, build = null, tune = null, fx = NO_FX) {
  const own = build ? statsOfBuild(build) : tune ? statsOfTune(tune) : null;
  const s = { boost: own?.boost ?? 1, accel: own?.accel ?? 1, cruise: own?.cruise ?? 1, agility: own?.agility ?? 1, level: own?.level ?? 1, cadence: 1, punch: 1, bolt: 1, armor: 1, regen: 1, delay: 5 };
  for (const p of fitted(loadout)) {
    for (const k of ['boost', 'accel', 'cruise', 'agility', 'level']) s[k] += p[k] ?? 0;
    for (const k of ['cadence', 'armor', 'regen']) s[k] *= p[k] ?? 1;
    s.punch = Math.max(s.punch, p.punch ?? 1);
    s.bolt = Math.max(s.bolt, p.bolt ?? 1);
    s.delay = Math.min(s.delay, p.delay ?? 5);
  }
  // the skills on top of the parts: added as a part's share is, multiplied as
  // a part's are; their plating only against the game's own ships (armorGame:
  // the scenes' hurt() takes it for a hit with no pilot behind it), and the
  // hyperdrive's recharge (jump)
  for (const k of ['boost', 'accel', 'cruise', 'agility', 'level']) s[k] += Number.isFinite(fx[k]) ? fx[k] : 0;
  for (const k of ['cadence', 'regen']) s[k] *= Number.isFinite(fx[k]) ? fx[k] : 1;
  s.armorGame = Number.isFinite(fx.armor) ? fx.armor : 1;
  s.jump = Number.isFinite(fx.jump) ? fx.jump : 1;
  // the ordnance rack's worth, against the stock torpedoes'
  const rack = WEAPONS[partById('ordnance', loadout.ordnance)?.weapon] ?? WEAPONS.heavy;
  s.ordnance = rackOf(rack) / rackOf(WEAPONS.heavy);
  const mass = massOf(loadout) + (own?.mass ?? 0);
  s.agility /= 1 + MASS_K * mass;
  // (rounded: halves and tenths of a tonne summed came out as 4.199999999999999 t)
  return { ...s, mass: Math.round(mass * 100) / 100, power: powerOf(loadout) + (own?.power ?? 0), capacity: capacityOf(kind, build) };
}

// The loadout a ship flies with: what was fitted to it, each part only
// while it's still open, and, should it ever need more power than the ship
// makes, parts coming off (the hungriest first) until it doesn't.
export function loadoutOf(saved, ship, unlocked = [], build = null, tune = null) {
  if (!ship) return { ...STOCK_LOADOUT };
  const l = readLoadout(saved?.[ship]);
  for (const slot of SLOTS) if (!isOpen(partById(slot, l[slot]), unlocked)) l[slot] = STOCK;
  while (!fits(ship, l, build, tune)) {
    const hungriest = PARTS_SLOTS.filter((slot) => l[slot] !== STOCK).sort((a, b) => partById(b, l[b]).power - partById(a, l[a]).power)[0];
    if (!hungriest) break;
    l[hungriest] = STOCK;
  }
  return l;
}

// The parts fitted (as saved) that the ship flies without: the ones the
// plant can't run (or not earned), for the hangar to say so.
export const droppedParts = (saved, flown) => PARTS_SLOTS.filter((slot) => saved?.[slot] && saved[slot] !== STOCK && flown[slot] !== saved[slot]).map((slot) => partById(slot, saved[slot]));

// What to keep after fitting a part: the saved loadout with it in (not the
// one flown, which a smaller plant may have taken parts off: a bigger one
// gets them back).
export const fitInto = (saved, slot, id) => ({ ...readLoadout(saved), [slot]: id });

// Fitting a part: the new loadout, or why it won't go: 'locked' (not
// earned yet) or 'power' (the ship can't run it with what else is fitted;
// `short` says by how many MW).
export function equip(kind, loadout, slot, id, unlocked = [], build = null, tune = null) {
  const p = partById(slot, parsePart(slot, id));
  if (!p) return { ok: false, reason: 'unknown', loadout };
  if (!isOpen(p, unlocked)) return { ok: false, reason: 'locked', loadout };
  const next = { ...loadout, [slot]: p.id };
  if (!fits(kind, next, build, tune)) return { ok: false, reason: 'power', short: powerOf(next) + hullDraw(build, tune) - capacityOf(kind, build), loadout };
  return { ok: true, loadout: next };
}

// What goes over the wire: the parts (not the paint, which goes on its
// own), in PARTS_SLOTS' order; and what came in, read back (anything it
// doesn't know is the factory's).
export const writeOutfit = (loadout) => PARTS_SLOTS.map((slot) => loadout[slot] ?? STOCK);
export function readOutfit(data, paint = STOCK) {
  const out = { ...STOCK_LOADOUT, paint: parsePaint(paint) ?? STOCK };
  if (!Array.isArray(data)) return out;
  PARTS_SLOTS.forEach((slot, i) => (out[slot] = parsePart(slot, data[i]) ?? STOCK));
  return out;
}

// The hangar's read-out: how it does against the factory ship, as
// { id, value (1 as it comes), bar (0…1 of the best any fit could do), change (%) }.
// (its flying as it flies: held to what any fit can do, ship.js's tuned)
const measures = (s) => ({
  speed: tuned(s).boost,
  accel: tuned(s).accel,
  agility: tuned(s).agility,
  firepower: s.punch / s.cadence, // (what the guns do to hunters in a second, against the factory guns)
  shields: 1 / s.armor,
  recharge: s.regen * (5 / s.delay),
  ordnance: s.ordnance,
});
// the best of each over every fit there is (power aside)
const BEST = (() => {
  const best = {};
  const walk = (i, l) => {
    if (i === PARTS_SLOTS.length) {
      for (const [k, v] of Object.entries(measures(statsOf('falcon', l)))) best[k] = Math.max(best[k] ?? 0, v);
      return;
    }
    for (const p of partsFor(PARTS_SLOTS[i])) walk(i + 1, { ...l, [PARTS_SLOTS[i]]: p.id });
  };
  walk(0, { ...STOCK_LOADOUT });
  return best;
})();
export function readout(kind, loadout, build = null, tune = null) {
  return Object.entries(measures(statsOf(kind, loadout, build, tune))).map(([id, value]) => ({ id, value, bar: Math.min(1, value / BEST[id]), change: Math.round((value - 1) * 100) }));
}
// What a part does, in words, for the hangar's list: ['Boost +25%', …].
// Given the ship (its kind), a gun part says what it does on that ship: on
// one already at the quickest any gun may fire, punch where a quicker shot
// can't be had.
const pct = (v) => `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}%`;
const some = (v) => Math.round(Math.abs(v) * 100) !== 0;
export function partEffects(p, kind = null) {
  const out = [];
  if (p.boost) out.push(`Boost ${pct(p.boost)}`);
  if (p.accel) out.push(`Acceleration ${pct(p.accel)}`);
  if (p.cruise) out.push(`Cruise ${pct(p.cruise)}`);
  if (p.agility) out.push(`Agility ${pct(p.agility)}`);
  if (p.level) out.push(`Self-levelling ${pct(p.level)}`);
  if (p.cadence && kind) {
    const base = CADENCE[kind] ?? 0.18;
    const g = pace(base, p.cadence, FASTEST);
    const rate = Math.max(FASTEST, base) / g.gap - 1;
    if (some(rate)) out.push(`Fire rate ${pct(rate)}`);
    if (some(g.punch - 1)) out.push(`Punch ${pct(g.punch - 1)}`);
  } else if (p.cadence) out.push(`Fire rate ${pct(1 / p.cadence - 1)}`);
  if (p.punch) out.push(`${p.punch}× on hunters`);
  if (p.armor) out.push(`Damage taken ${pct(p.armor - 1)}`);
  if (p.regen) out.push(`Recharge ${pct(p.regen - 1)}`);
  if (p.delay) out.push(`Recharges ${p.delay} s after a hit`);
  const w = p.id !== STOCK && WEAPONS[p.weapon];
  if (w && p.slot === 'secondary') out.push(`${w.count} shots a burst`, `${w.punch}× on hunters a shot`);
  if (w && p.slot === 'ordnance') out.push(`Rounds: ${w.ammo}, one back every ${w.reload} s`, `${w.punch}× on hunters`);
  return out;
}

export const READOUT_LABEL = { speed: 'Boost speed', accel: 'Acceleration', agility: 'Agility', firepower: 'Firepower', shields: 'Shield strength', recharge: 'Shield recharge', ordnance: 'Ordnance' };

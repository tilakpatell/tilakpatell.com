import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../Achievements';
import { CREWS } from './crews';
import { STOCK_BUILD, rollBuild, statsOfBuild, statsOfTune } from './shipyard/build';
import {
  FASTEST,
  PARTS,
  PARTS_SLOTS,
  PLANT,
  READOUT_LABEL,
  SLOTS,
  SLOT_LABEL,
  STOCK,
  STOCK_LOADOUT,
  capacityOf,
  droppedParts,
  equip,
  fitInto,
  fits,
  isOpen,
  loadoutOf,
  massOf,
  partById,
  parsePart,
  partEffects,
  partsFor,
  partsUnlockedBy,
  powerOf,
  readLoadout,
  readLoadouts,
  readOutfit,
  readout,
  statsOf,
  writeOutfit,
} from './outfit';
import { WEAPONS } from './weapons';

const SHIPS = CREWS.map((c) => c.id);
const NONE = []; // (no achievements yet)
const EVERYTHING = Object.keys(ACHIEVEMENTS);

describe('the parts', () => {
  it('give every slot a factory part first, and every part a slot it knows', () => {
    for (const slot of SLOTS) expect(partsFor(slot)[0].id, slot).toBe(STOCK);
    for (const p of PARTS) expect(PARTS_SLOTS, p.id).toContain(p.slot);
    for (const slot of PARTS_SLOTS) expect(new Set(partsFor(slot).map((p) => p.id)).size).toBe(partsFor(slot).length);
  });

  it('cost nothing as they come, and power and mass once fitted', () => {
    for (const slot of PARTS_SLOTS) {
      expect(partById(slot, STOCK).power).toBe(0);
      expect(partById(slot, STOCK).mass).toBe(0);
    }
    for (const p of PARTS.filter((q) => q.id !== STOCK)) {
      expect(p.mass, p.id).toBeGreaterThan(0);
      expect(p.power, p.id).toBeGreaterThanOrEqual(0);
      expect(p.name, p.id).toBeTruthy();
      expect(p.blurb, p.id).toBeTruthy();
    }
  });

  it('are open from the start, or come with an achievement there is, with a hint', () => {
    for (const p of PARTS.filter((q) => q.achievement)) {
      expect(ACHIEVEMENTS[p.achievement], p.id).toBeTruthy();
      expect(p.hint, p.id).toBeTruthy();
      expect(isOpen(p, NONE), p.id).toBe(false);
      expect(isOpen(p, [p.achievement]), p.id).toBe(true);
    }
    // a part for every slot to try straight away
    for (const slot of PARTS_SLOTS) expect(partsFor(slot).filter((p) => p.id !== STOCK && !p.achievement).length, slot).toBeGreaterThan(0);
    expect(partsUnlockedBy('onestand').map((p) => p.id)).toEqual(['fusion']);
  });

  it('borrow only the look of a part of their own slot (a weapon line’s, of a gun) that has one of its own', () => {
    const borrowers = PARTS.filter((p) => p.look);
    expect(borrowers.map((p) => p.id).sort()).toEqual(['council', 'crystal', 'darkmatter', 'energon', 'flak', 'incom', 'ion', 'missiles', 'mk2', 'seismic', 'vamonos']);
    for (const p of borrowers) {
      const from = partById(['secondary', 'ordnance'].includes(p.slot) ? 'guns' : p.slot, p.look);
      expect(from.id, p.id).toBe(p.look);
      expect(from.id, p.id).not.toBe(STOCK);
      expect(from.look, p.id).toBeUndefined();
    }
  });

  it('believe only ids they have, slot by slot', () => {
    expect(parsePart('booster', 'srb')).toBe('srb');
    expect(parsePart('guns', 'srb')).toBeNull();
    expect(parsePart('paint', 'aws')).toBe('aws');
    expect(parsePart('nonsense', STOCK)).toBeNull();
    for (const junk of ['__proto__', 'constructor', '', null, 3, {}]) expect(parsePart('booster', junk)).toBeNull();
    expect(partById('booster', 'nonsense').id).toBe(STOCK);
  });
});

describe('power and mass', () => {
  it('lets every ship fly the starter parts all at once, and each starter weapon on a stock ship', () => {
    const starterOf = (slot) => partsFor(slot).find((p) => p.id !== STOCK && !p.achievement).id;
    const flying = ['booster', 'thrusters', 'guns', 'shields', 'fins'];
    const starter = Object.fromEntries(flying.map((slot) => [slot, starterOf(slot)]));
    for (const kind of SHIPS) expect(fits(kind, { ...STOCK_LOADOUT, ...starter }), kind).toBe(true);
    // (a second weapon line is a choice on the RV's small plant, not a given)
    for (const kind of SHIPS) for (const slot of ['secondary', 'ordnance']) expect(fits(kind, { ...STOCK_LOADOUT, [slot]: starterOf(slot) }), kind).toBe(true);
  });

  it('won’t run the best of everything on any ship: something has to give', () => {
    const best = Object.fromEntries(PARTS_SLOTS.map((slot) => [slot, [...partsFor(slot)].sort((a, b) => b.power - a.power)[0].id]));
    for (const kind of SHIPS) expect(fits(kind, { ...STOCK_LOADOUT, ...best }), kind).toBe(false);
  });

  it('adds up', () => {
    const l = { ...STOCK_LOADOUT, booster: 'srb', guns: 'fusion' };
    expect(powerOf(l)).toBe(4);
    expect(massOf(l)).toBe(4);
    expect(powerOf(STOCK_LOADOUT)).toBe(0);
    expect(PLANT.falcon).toBeGreaterThan(PLANT.rv);
  });
});

describe('what a loadout does', () => {
  it('is nothing at all as it comes', () => {
    for (const kind of SHIPS) {
      const s = statsOf(kind);
      for (const k of ['boost', 'accel', 'cruise', 'agility', 'level', 'cadence', 'punch', 'bolt', 'armor', 'regen']) expect(s[k], `${kind} ${k}`).toBe(1);
      expect(s.delay).toBe(5);
    }
  });

  it('boosts harder with boosters, and turns slower for the weight', () => {
    const s = statsOf('falcon', { ...STOCK_LOADOUT, booster: 'portal' });
    expect(s.boost).toBeCloseTo(1.55, 6);
    expect(s.agility).toBeLessThan(1);
    expect(statsOf('falcon', { ...STOCK_LOADOUT, thrusters: 'vector' }).agility).toBeGreaterThan(1.2);
  });

  it('fires slower and harder with the fusion cannon, and never faster than the wire lets in', () => {
    const fusion = statsOf('xwing', { ...STOCK_LOADOUT, guns: 'fusion' });
    expect(fusion.cadence).toBe(2);
    expect(fusion.punch).toBe(3);
    expect(fusion.bolt).toBe(2);
    // the quickest guns there are, on the quickest ship (scene.js clamps to FASTEST too)
    expect(0.12 * statsOf('xwing', { ...STOCK_LOADOUT, guns: 'twin' }).cadence).toBeLessThan(FASTEST);
  });

  it('soaks more with plating and comes back sooner with fast-charge', () => {
    expect(statsOf('rv', { ...STOCK_LOADOUT, shields: 'vibranium' }).armor).toBeCloseTo(0.6, 6);
    const fast = statsOf('rv', { ...STOCK_LOADOUT, shields: 'fastcharge' });
    expect(fast.regen).toBe(2);
    expect(fast.delay).toBe(2);
  });

  it('says what each part does, in words', () => {
    expect(partEffects(partById('booster', 'srb'))).toEqual(['Boost +25%', 'Acceleration +20%']);
    expect(partEffects(partById('guns', 'fusion'))).toEqual(['Fire rate −50%', '3× on hunters']);
    expect(partEffects(partById('shields', 'reinforced'))).toEqual(['Damage taken −20%', 'Recharge −15%']);
    expect(partEffects(partById('booster', STOCK))).toEqual([]);
  });

  it('says a gun part gives punch on a ship at the cap (B8)', () => {
    const on = (id, kind) => partEffects(partById('guns', id), kind);
    expect([on('incom', 'xwing'), on('twin', 'xwing'), on('incom', 'cruiser'), on('incom'), on('incom', 'falcon'), on('fusion', 'xwing')]).toEqual([['Punch +43%'], ['Punch +25%'], ['Fire rate +43%'], ['Fire rate +43%'], ['Fire rate +33%', 'Punch +7%'], ['Fire rate −50%', '3× on hunters']]);
  });

  it('reads out against the factory ship, each bar inside 0…1', () => {
    const stock = readout('xwing', STOCK_LOADOUT);
    expect(stock.every((r) => r.change === 0 && r.bar > 0 && r.bar <= 1)).toBe(true);
    const fast = readout('xwing', { ...STOCK_LOADOUT, booster: 'portal' });
    expect(fast.find((r) => r.id === 'speed').change).toBe(55);
    expect(fast.find((r) => r.id === 'speed').bar).toBe(1); // (the fastest there is)
    expect(fast.find((r) => r.id === 'agility').change).toBeLessThan(0);
  });
});

describe('the weapon slots', () => {
  it('an old loadout reads with stock secondary and ordnance', () => {
    const l = readLoadout({ booster: 'srb' });
    expect(l.secondary).toBe(STOCK);
    expect(l.ordnance).toBe(STOCK);
    const wire = readOutfit(['srb', 'stock', 'stock', 'stock', 'stock']);
    expect(wire.booster).toBe('srb');
    expect(wire.secondary).toBe(STOCK);
    expect(wire.ordnance).toBe(STOCK);
  });

  it('are appended after the fins, never reordered', () => {
    expect(SLOTS).toEqual(['paint', 'booster', 'thrusters', 'guns', 'shields', 'fins', 'secondary', 'ordnance']);
    expect(SLOT_LABEL.guns).toBe('Primary');
    expect(SLOT_LABEL.secondary).toBe('Secondary');
    expect(SLOT_LABEL.ordnance).toBe('Ordnance');
  });

  it('the wire carries the seven parts in order', () => {
    const l = { ...STOCK_LOADOUT, paint: 'aws', booster: 'srb', secondary: 'ion', ordnance: 'mk2' };
    const wire = writeOutfit(l);
    expect(wire).toHaveLength(7);
    expect(wire.slice(5)).toEqual(['ion', 'mk2']);
    expect(readOutfit(JSON.parse(JSON.stringify(wire)), 'aws')).toEqual(l);
  });

  it('each weapon part names a weapon of its own line', () => {
    for (const slot of ['secondary', 'ordnance']) for (const p of partsFor(slot)) expect(WEAPONS[p.weapon]?.line, p.id).toBe(slot);
  });

  it('the readout has an ordnance row: up with the missile rack, down with the slow Mk II', () => {
    const stock = readout('xwing', STOCK_LOADOUT).find((r) => r.id === 'ordnance');
    expect(stock.change).toBe(0);
    const row = readout('xwing', { ...STOCK_LOADOUT, ordnance: 'missiles' }).find((r) => r.id === 'ordnance');
    expect(row.change).toBeGreaterThan(0);
    expect(row.bar).toBe(1);
    // (the Mk II hits harder a round but sustains less: the row is rounds a second, as the spec says)
    expect(readout('xwing', { ...STOCK_LOADOUT, ordnance: 'mk2' }).find((r) => r.id === 'ordnance').change).toBeLessThan(0);
    expect(row.bar).toBeLessThanOrEqual(1);
    expect(READOUT_LABEL.ordnance).toBe('Ordnance');
  });

  it('partEffects says a secondary’s shots and an ordnance’s rounds', () => {
    expect(partEffects(partById('secondary', 'ion'))).toContain('3 shots a burst');
    expect(partEffects(partById('ordnance', 'missiles'))).toContain('Rounds: 6, one back every 4.5 s');
    expect(partEffects(partById('secondary', STOCK))).toEqual([]);
  });
});

describe('fitting and keeping', () => {
  it('fits an open part, and says why not otherwise', () => {
    expect(equip('xwing', STOCK_LOADOUT, 'booster', 'srb', NONE)).toEqual({ ok: true, loadout: { ...STOCK_LOADOUT, booster: 'srb' } });
    expect(equip('xwing', STOCK_LOADOUT, 'booster', 'portal', NONE)).toMatchObject({ ok: false, reason: 'locked' });
    expect(equip('xwing', STOCK_LOADOUT, 'booster', 'nonsense', NONE)).toMatchObject({ ok: true, loadout: STOCK_LOADOUT }); // (back to the factory's)
    const full = { ...STOCK_LOADOUT, booster: 'portal', guns: 'fusion' }; // 6 of the RV's 5
    expect(equip('rv', { ...STOCK_LOADOUT, booster: 'portal' }, 'guns', 'fusion', EVERYTHING)).toEqual({ ok: false, reason: 'power', short: 1, loadout: { ...STOCK_LOADOUT, booster: 'portal' } });
    expect(equip('falcon', { ...STOCK_LOADOUT, booster: 'portal' }, 'guns', 'fusion', EVERYTHING)).toEqual({ ok: true, loadout: full });
    expect(equip('xwing', STOCK_LOADOUT, 'paint', 'aws', ['cartographer']).loadout.paint).toBe('aws');
  });

  it('reads back what was kept, for the ships there are, every slot a part it knows', () => {
    expect(readLoadouts(null, SHIPS)).toEqual({});
    expect(readLoadouts([1], SHIPS)).toEqual({});
    expect(readLoadouts({ xwing: { booster: 'srb', paint: 'aws', guns: 'laser', extra: 1 }, tie: { booster: 'srb' }, rv: 'srb' }, SHIPS)).toEqual({ xwing: { ...STOCK_LOADOUT, booster: 'srb', paint: 'aws' } });
    expect(readLoadout(JSON.parse('{"__proto__": {"booster": "srb"}}'))).toEqual(STOCK_LOADOUT);
  });

  it('flies what was fitted while it’s open and the ship can run it', () => {
    const kept = { xwing: { ...STOCK_LOADOUT, booster: 'srb', guns: 'fusion', paint: 'sith' } };
    expect(loadoutOf(kept, 'xwing', ['onestand', 'order66'])).toEqual(kept.xwing);
    expect(loadoutOf(kept, 'xwing', [])).toEqual({ ...STOCK_LOADOUT, booster: 'srb' }); // (not earned)
    expect(loadoutOf(kept, 'falcon', EVERYTHING)).toEqual(STOCK_LOADOUT); // (nothing fitted)
    expect(loadoutOf(kept, null, EVERYTHING)).toEqual(STOCK_LOADOUT);
    // kept on a ship that can't run it all: the hungriest part comes off first
    const greedy = { rv: { ...STOCK_LOADOUT, booster: 'portal', guns: 'fusion', thrusters: 'rcs' } };
    const flown = loadoutOf(greedy, 'rv', EVERYTHING);
    expect(fits('rv', flown)).toBe(true);
    expect(flown.thrusters).toBe('rcs');
  });

  it('goes over the wire as ids, and comes back the same', () => {
    const l = { ...STOCK_LOADOUT, paint: 'aws', booster: 'repulsor', thrusters: 'rcs', guns: 'twin', shields: 'vibranium', fins: 'fins' };
    expect(readOutfit(JSON.parse(JSON.stringify(writeOutfit(l))), 'aws')).toEqual(l);
    expect(readOutfit(null)).toEqual(STOCK_LOADOUT);
    expect(readOutfit(['<script>', 7, 'fusion'], '#fff')).toEqual({ ...STOCK_LOADOUT, guns: 'fusion' });
  });
});

describe('on a garage build', () => {
  const needle = { ...STOCK_BUILD, hull: 'needle' };
  it('flies on the build’s own numbers, under the parts', () => {
    const b = rollBuild(7, Object.keys(ACHIEVEMENTS));
    const own = statsOfBuild(b);
    const s = statsOf('rv', STOCK_LOADOUT, b);
    expect(s.agility).toBeCloseTo(own.agility / (1 + 0.03 * own.mass), 6);
    expect(s.boost).toBeCloseTo(own.boost, 6);
    expect(s.capacity).toBe(own.plant);
    expect(s.power).toBe(own.power);
    const boosted = statsOf('rv', { ...STOCK_LOADOUT, booster: 'srb' }, b);
    expect(boosted.boost).toBeCloseTo(own.boost + 0.25, 6);
  });

  it('runs on the build’s plant, not the ship’s', () => {
    expect(capacityOf('rv', needle)).toBe(6);
    expect(capacityOf('rv', null)).toBe(PLANT.rv);
    expect(capacityOf('falcon')).toBe(PLANT.falcon);
  });

  it('takes parts off, hungriest first, when the build can’t power them', () => {
    const all = Object.keys(ACHIEVEMENTS);
    const heavy = { ...STOCK_LOADOUT, booster: 'portal', guns: 'fusion', shields: 'fastcharge' }; // (8 MW)
    expect(loadoutOf({ falcon: heavy }, 'falcon', all)).toEqual(heavy); // (the Falcon's 9 MW runs it all)
    const l = loadoutOf({ falcon: heavy }, 'falcon', all, needle); // (needle: 6 MW, its twin cans draw 1)
    expect(powerOf(l) + statsOfBuild(needle).power).toBeLessThanOrEqual(6);
    expect(l.booster).toBe(STOCK); // (portal: 3 MW, the hungriest)
    expect(loadoutOf({ rv: heavy }, 'rv', all, { ...STOCK_BUILD, hull: 'hauler' })).toEqual(heavy); // (the hauler's 10 MW does, on the RV)
  });

  it('says how much power is short against the build', () => {
    const all = Object.keys(ACHIEVEMENTS);
    expect(equip('falcon', { ...STOCK_LOADOUT, guns: 'fusion' }, 'booster', 'portal', all).ok).toBe(true);
    const r = equip('falcon', { ...STOCK_LOADOUT, guns: 'fusion' }, 'booster', 'portal', all, needle);
    expect(r).toMatchObject({ ok: false, reason: 'power', short: 1 }); // (3 + 3 + 1 against 6)
    expect(equip('falcon', STOCK_LOADOUT, 'booster', 'portal', all, needle).ok).toBe(true);
  });
});

describe('on a crew’s own ship, tuned', () => {
  const all = Object.keys(ACHIEVEMENTS);
  const tune = { engines: 'quad', cockpit: 'canopy' };

  it('flies on the tune’s numbers under the parts, as a build’s modules would add them', () => {
    const own = statsOfTune(tune);
    const s = statsOf('xwing', STOCK_LOADOUT, null, tune);
    expect(s.boost).toBeCloseTo(own.boost, 6);
    expect(s.accel).toBeCloseTo(own.accel, 6);
    expect(s.agility).toBeCloseTo(own.agility / (1 + 0.03 * own.mass), 6);
    expect(s.mass).toBeCloseTo(own.mass, 6);
    expect(s.power).toBe(own.power);
    expect(s.capacity).toBe(PLANT.xwing); // (the crew’s own plant: a tune brings none)
    const boosted = statsOf('xwing', { ...STOCK_LOADOUT, booster: 'srb' }, null, tune);
    expect(boosted.boost).toBeCloseTo(own.boost + 0.25, 6);
    expect(statsOf('xwing', STOCK_LOADOUT, null, {})).toEqual(statsOf('xwing', STOCK_LOADOUT));
  });

  it('is ignored on a garage build: the build’s modules are the ship', () => {
    expect(statsOf('xwing', STOCK_LOADOUT, STOCK_BUILD, tune)).toEqual(statsOf('xwing', STOCK_LOADOUT, STOCK_BUILD));
  });

  it('draws on the crew’s plant, so a part may not fit beside it', () => {
    expect(fits('rv', { ...STOCK_LOADOUT, booster: 'portal' }, null, { engines: 'quad' })).toBe(true); // (3 + 2 = 5)
    expect(fits('rv', { ...STOCK_LOADOUT, booster: 'portal', thrusters: 'rcs' }, null, { engines: 'quad' })).toBe(false); // (3 + 1 + 2 = 6)
    expect(fits('rv', { ...STOCK_LOADOUT, booster: 'portal', thrusters: 'rcs' })).toBe(true);
    expect(equip('rv', { ...STOCK_LOADOUT, booster: 'portal' }, 'thrusters', 'rcs', all, null, { engines: 'quad' })).toMatchObject({ ok: false, reason: 'power', short: 1 });
    expect(equip('rv', { ...STOCK_LOADOUT, booster: 'portal' }, 'thrusters', 'rcs', all).ok).toBe(true);
  });

  it('takes parts off, hungriest first, when the tune leaves too little', () => {
    const heavy = { ...STOCK_LOADOUT, booster: 'portal', thrusters: 'rcs' }; // (4 MW: the RV runs it alone)
    expect(loadoutOf({ rv: heavy }, 'rv', all)).toEqual(heavy);
    const l = loadoutOf({ rv: heavy }, 'rv', all, null, { engines: 'quad' });
    expect(l.booster).toBe(STOCK);
    expect(l.thrusters).toBe('rcs');
    expect(droppedParts(heavy, l).map((p) => p.id)).toEqual(['portal']);
  });

  it('shows in the read-out, and the same as the module on a build for the shares it adds', () => {
    const now = readout('xwing', STOCK_LOADOUT, null, tune);
    const speed = (r) => r.find((x) => x.id === 'speed').value;
    expect(speed(now)).toBeGreaterThan(speed(readout('xwing', STOCK_LOADOUT)));
    expect(readout('xwing', STOCK_LOADOUT, null, {})).toEqual(readout('xwing', STOCK_LOADOUT));
  });
});

describe('what a smaller plant takes off', () => {
  const all = Object.keys(ACHIEVEMENTS);
  const heavy = { ...STOCK_LOADOUT, booster: 'portal', guns: 'fusion', shields: 'fastcharge' };
  const needle = { ...STOCK_BUILD, hull: 'needle' };

  it('names the parts fitted that the ship flies without', () => {
    const flown = loadoutOf({ falcon: heavy }, 'falcon', all, needle);
    expect(droppedParts(heavy, flown).map((p) => p.id)).toEqual(['portal']);
    expect(droppedParts(heavy, heavy)).toEqual([]);
  });

  it('keeps them in what’s saved when something else is fitted, so a bigger plant gets them back', () => {
    const r = equip('falcon', loadoutOf({ falcon: heavy }, 'falcon', all, needle), 'paint', 'sith', all, needle);
    expect(r.ok).toBe(true);
    const saved = fitInto(heavy, 'paint', r.loadout.paint);
    expect(saved).toEqual({ ...heavy, paint: 'sith' });
    expect(loadoutOf({ falcon: saved }, 'falcon', all, { ...STOCK_BUILD, hull: 'hauler' }).booster).toBe('portal');
  });
});

describe('the skill tree on the ship (hangar/skills’ fx)', () => {
  const fx = { boost: 0.1, accel: 0.15, cruise: 0, agility: 0.08, level: 0, cadence: 0.92, regen: 1.25, armor: 0.9, jump: 0.75 };
  it('stacks with the parts, never replaces them', () => {
    const plain = statsOf('xwing', STOCK_LOADOUT);
    const skilled = statsOf('xwing', STOCK_LOADOUT, null, null, fx);
    expect(skilled.boost).toBeCloseTo(plain.boost + 0.1);
    expect(skilled.accel).toBeCloseTo(plain.accel + 0.15);
    expect(skilled.cadence).toBeCloseTo(plain.cadence * 0.92);
    expect(skilled.regen).toBeCloseTo(plain.regen * 1.25);
    expect(skilled.agility).toBeGreaterThan(plain.agility);
  });
  it('softens only what the game’s ships hit you with, and leaves the parts’ plating as it is', () => {
    const skilled = statsOf('xwing', STOCK_LOADOUT, null, null, fx);
    expect(skilled.armor).toBe(statsOf('xwing', STOCK_LOADOUT).armor);
    expect(skilled.armorGame).toBeCloseTo(0.9);
    expect(skilled.jump).toBeCloseTo(0.75);
  });
  it('is the ship as it was with no skills', () => {
    const plain = statsOf('xwing', STOCK_LOADOUT);
    expect(plain.armorGame).toBe(1);
    expect(plain.jump).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import { COOL_WAIT, MAX_MODS, MODS, MOD_IDS, PICKABLE, SHOW_KILLS, UNIQUE_HAND, VENT, WEAPONS, WEAPON_IDS, heatShot, heatStep, pickableWith, spreadAt, vent, ventSpot, weaponOf, withMods } from './weaponRules';
import { GUNS } from '../../universe/gunplay';

describe('the weapons', () => {
  it('every kind has its numbers in range, and a gun in the hand', () => {
    for (const id of WEAPON_IDS) {
      const w = WEAPONS[id];
      expect(GUNS[id], `${id} has no gun built`).toBeTruthy();
      expect(['galaxy', 'elsewhere']).toContain(w.side);
      expect(w.damage).toBeGreaterThanOrEqual(1);
      expect(w.every).toBeGreaterThan(0.05);
      expect(w.every).toBeLessThan(2);
      expect(w.heat).toBeGreaterThan(0);
      expect(w.heat).toBeLessThanOrEqual(0.5);
      expect(w.cool).toBeGreaterThan(0);
      expect(w.range).toBeGreaterThan(20);
      expect(w.zoom).toBeGreaterThanOrEqual(1);
      expect(w.name.length).toBeGreaterThan(1);
      if (w.burst) expect(w.burst).toBeGreaterThanOrEqual(2);
      if (w.pellets) expect(w.pellets).toBeGreaterThanOrEqual(3);
    }
    for (const id of PICKABLE) expect(WEAPONS[id], id).toBeTruthy();
  });
  it('offers every gun whose kills are a show: Rick’s three (a portal, the ice, the shrink) to anyone, the unique ones with their nodes', () => {
    for (const id of ['portal', 'freeze', 'shrink']) {
      expect(SHOW_KILLS, id).toContain(id);
      expect(PICKABLE, id).toContain(id);
      expect(WEAPONS[id].side, id).toBe('elsewhere');
    }
    for (const id of SHOW_KILLS) expect(pickableWith(Object.keys(UNIQUE_HAND)), id).toContain(id);
  });
  it('a stream of light bolts and a slow heavy shot come out near each other over a second', () => {
    const dps = (w) => (w.damage * (w.burst ?? 1) * (w.pellets ?? 1)) / w.every;
    expect(dps(WEAPONS.dlt19)).toBeGreaterThan(dps(WEAPONS.sniper) * 0.5);
    expect(dps(WEAPONS.dlt19)).toBeLessThan(dps(WEAPONS.sniper) * 5);
    expect(dps(WEAPONS.shotgun)).toBeLessThan(dps(WEAPONS.smg) * 1.2);
  });
  it('an unknown kind shoots like the blaster', () => {
    expect(weaponOf('nope')).toBe(WEAPONS.blaster);
    expect(withMods('nope').kind).toBe('blaster');
  });
});

describe('the mods', () => {
  it('each bends the numbers the way it says, at most two at once, never twice', () => {
    for (const id of MOD_IDS) expect(MODS[id].name).toBeTruthy();
    const w = withMods('rifle', ['cooling', 'cooling', 'choke', 'scope']);
    expect(w.mods).toEqual(['cooling', 'choke']);
    expect(w.heat).toBeCloseTo(WEAPONS.rifle.heat * 0.7);
    expect(w.spread).toBeCloseTo(WEAPONS.rifle.spread * 0.5);
    expect(w.zoom).toBe(WEAPONS.rifle.zoom);
    expect(withMods('rifle', ['nope']).mods).toEqual([]);
    expect(MAX_MODS).toBe(2);
  });
  it('damage stays a whole number of hits', () => {
    expect(Number.isInteger(withMods('blaster', ['barrel']).damage)).toBe(true);
    expect(withMods('blaster', ['barrel']).damage).toBeGreaterThanOrEqual(WEAPONS.blaster.damage);
  });
});

describe('heat', () => {
  const w = WEAPONS.blaster;
  it('builds a shot at a time, locks at the top, cools on its own', () => {
    let h = { value: 0, locked: false, lockedAt: null };
    let n = 0;
    while (!h.locked) {
      h = heatShot(h, w, n * w.every);
      n++;
    }
    expect(n).toBe(Math.ceil(1 / w.heat));
    expect(h.lockedAt).toBeCloseTo((n - 1) * w.every);
    const during = heatStep(h, 0.1, w, h.lockedAt + 0.5);
    expect(during.locked).toBe(true);
    const after = heatStep(h, 0.1, w, h.lockedAt + VENT.lock + 0.1);
    expect(after.locked).toBe(false);
    expect(after.value).toBe(0);
    const cooled = heatStep({ value: 0.5, locked: false, lockedAt: null, shotAt: 0 }, 0.5, w, 1);
    expect(cooled.value).toBeCloseTo(0.5 - w.cool * 0.5);
    expect(heatStep({ value: 0.5, locked: false, lockedAt: null, shotAt: 0.9 }, 0.5, w, 1).value).toBe(0.5); // (just fired: not yet)
  });
  it('held down, every gun locks within ten seconds, and left alone cools off in under five', () => {
    for (const id of WEAPON_IDS) {
      const g = WEAPONS[id];
      let h = { value: 0, locked: false, lockedAt: null, shotAt: null };
      let t = 0;
      let next = 0;
      while (!h.locked && t < 10) {
        if (t >= next) {
          h = heatShot(h, g, t);
          next = t + g.every;
        }
        h = heatStep(h, 1 / 60, g, t);
        t += 1 / 60;
      }
      expect(h.locked, `${id} never locks`).toBe(true);
      expect(t, `${id} locks too soon`).toBeGreaterThan(1.2);
      let c = { value: 1, locked: false, lockedAt: null, shotAt: 0 };
      for (let k = 0; k < 5 * 60; k++) c = heatStep(c, 1 / 60, g, COOL_WAIT + k / 60);
      expect(c.value, `${id} cools too slowly`).toBe(0);
    }
  });
  it('the vent: perfect in the sweet spot, half early, nothing late; early venting just empties it', () => {
    const h = { value: 1, locked: true, lockedAt: 10 };
    const mid = 10 + ((VENT.sweet[0] + VENT.sweet[1]) / 2) * VENT.lock;
    expect(ventSpot(h, mid)).toBeGreaterThan(VENT.sweet[0]);
    expect(vent(h, mid)).toMatchObject({ value: 0, locked: false, perfect: true });
    expect(vent(h, 10.05)).toMatchObject({ value: 0.5, locked: false, perfect: false });
    expect(vent(h, 10 + VENT.lock * 0.9).locked).toBe(true);
    expect(vent({ value: 0.7, locked: false, lockedAt: null }, 3).value).toBe(0);
    expect(ventSpot({ value: 0.3, locked: false, lockedAt: null }, 3)).toBeNull();
  });
  it('the sights tighten the scatter', () => {
    expect(spreadAt(w, true)).toBeLessThan(spreadAt(w, false));
  });
});

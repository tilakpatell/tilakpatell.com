import { describe, expect, it } from 'vitest';
import { DAMAGE_MAX } from './online/protocol';
import { STOCK_LOADOUT } from './outfit';
import { ARSENAL, LINES, WEAPONS, armsView, byCode, createArmory, fan, steer } from './weapons';

describe('the armoury, as the HUD shows it', () => {
  it('names the line picked, with the ordnance rack whichever it is (it’s the one count of the rounds)', () => {
    const a = createArmory('xwing');
    expect(armsView(a)).toEqual({ name: 'Laser cannons', line: 'primary', index: 0, ammo: 4, max: 4, filling: 0 });
    a.select(2);
    expect(armsView(a)).toMatchObject({ name: 'Proton torpedoes', line: 'ordnance', index: 2, ammo: 4, max: 4 });
  });
  it('fills the record it’s handed', () => {
    const a = createArmory('falcon');
    const out = armsView(a);
    a.select(1);
    expect(armsView(a, out)).toBe(out);
    expect(out.name).toBe('Flak burst');
  });
});

describe('weapons', () => {
  it('every ship names all three lines', () => {
    for (const a of Object.values(ARSENAL)) expect(a.names).toHaveLength(LINES.length);
  });

  it('every weapon has its own code under 16 and damage at most 30', () => {
    const codes = Object.values(WEAPONS).map((w) => w.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const [id, w] of Object.entries(WEAPONS)) {
      expect(Number.isInteger(w.code) && w.code >= 0 && w.code < 16, id).toBe(true);
      expect(w.damage, id).toBeLessThanOrEqual(DAMAGE_MAX);
      expect(LINES, id).toContain(w.line);
      expect(byCode(w.code)).toBe(id);
    }
  });

  it('every ordnance weapon is heavy, and nothing else is (the launch, the rack and its sound key on it)', () => {
    for (const [id, w] of Object.entries(WEAPONS)) expect(Boolean(w.heavy), id).toBe(w.line === 'ordnance');
  });

  it('an unknown code is the blaster', () => {
    expect(byCode(40)).toBe('blaster');
    expect(byCode(-1)).toBe('blaster');
    expect(byCode('2')).toBe('blaster');
    expect(byCode(undefined)).toBe('blaster');
  });

  it('the stock armoury is the blaster, the spread and the heavy rack', () => {
    const a = createArmory('xwing');
    const seen = [];
    for (let i = 0; i < 3; i++) {
      seen.push([a.id, a.line, a.name]);
      a.cycle();
    }
    expect(seen).toEqual([
      ['blaster', 'primary', 'Laser cannons'],
      ['spread', 'secondary', 'Ion scatter'],
      ['heavy', 'ordnance', 'Proton torpedoes'],
    ]);
    expect(a.ammoMax).toBe(4);
  });

  it('an armoury takes its secondary and ordnance from the loadout', () => {
    const a = createArmory('xwing', { ...STOCK_LOADOUT, secondary: 'ion', ordnance: 'missiles' });
    a.select(1);
    expect(a.id).toBe('ion');
    expect(a.name).toBe('Ion burst');
    expect(a.weapon).toBe(WEAPONS.ion);
    a.select(2);
    expect(a.id).toBe('missiles');
    expect(a.name).toBe('Missile rack');
    expect(a.ammoMax).toBe(6);
    expect(a.ammo).toBe(6);
  });

  it('refit keeps the line and clamps the rounds', () => {
    const a = createArmory('falcon');
    a.select(2);
    a.fired(0);
    a.fired(10000);
    expect(a.ammo).toBe(2);
    a.refit({ ...STOCK_LOADOUT, ordnance: 'mk2' });
    expect(a.index).toBe(2);
    expect(a.id).toBe('mk2');
    expect(a.ammoMax).toBe(3);
    expect(a.ammo).toBe(2);
    a.fired(20000);
    a.refit({ ...STOCK_LOADOUT, ordnance: 'mk2' }); // (the same rack: nothing back)
    expect(a.ammo).toBe(1);
    a.refit(STOCK_LOADOUT);
    expect(a.ammo).toBe(1);
    expect(a.ammoMax).toBe(4);
    expect(a.name).toBe('Concussion missiles');
  });

  it('cycles and selects, and fires each at its own pace', () => {
    const a = createArmory('xwing');
    expect(a.name).toBe('Laser cannons');
    expect(a.ready(0, 0.12)).toBe(true);
    a.fired(0);
    expect(a.ready(100, 0.12)).toBe(false);
    expect(a.ready(120, 0.12)).toBe(true);
    a.cycle();
    expect(a.id).toBe('spread');
    a.cycle(-1);
    a.cycle(-1);
    expect(a.id).toBe('heavy');
    expect(a.select(9)).toBe(false);
    expect(a.select(0)).toBe(true);
  });

  it('heavy rounds run out and come back one at a time', () => {
    const a = createArmory('falcon');
    a.select(2);
    let t = 0;
    for (let i = 0; i < a.ammoMax; i++) {
      expect(a.ready(t, 0.16)).toBe(true);
      a.fired(t);
      t += 10000;
    }
    expect(a.ammo).toBe(0);
    expect(a.ready(t, 0.16)).toBe(false);
    a.update(WEAPONS.heavy.reload);
    expect(a.ammo).toBe(1);
    a.reload();
    expect(a.ammo).toBe(a.ammoMax);
  });

  it('a fan stays unit length and around the aim', () => {
    const shots = fan([0, 0, -1], 5, 0.08);
    expect(shots).toHaveLength(5);
    for (const d of shots) {
      expect(Math.hypot(...d)).toBeCloseTo(1);
      expect(d[2]).toBeLessThan(-0.95);
    }
    expect(fan([0, 0, -1], 1, 0.08)).toEqual([[0, 0, -1]]);
  });

  it('a homing round turns no faster than its rate, keeping its speed', () => {
    const v = [0, 0, -10];
    steer(v, [1, 0, 0], 1, 0.5);
    expect(Math.hypot(...v)).toBeCloseTo(10);
    expect(Math.atan2(v[0], -v[2])).toBeCloseTo(0.5, 1);
    for (let i = 0; i < 20; i++) steer(v, [1, 0, 0], 1, 0.5);
    expect(v[0]).toBeCloseTo(10);
  });
});

describe('the armoury with the skill tree’s guns (hangar/skills’ fx)', () => {
  it('racks one more round with deep racks, and brings them back sooner with a fast loader', () => {
    const a = createArmory('xwing', STOCK_LOADOUT, { ammo: 1, reload: 0.8 });
    a.select(2);
    expect(a.ammoMax).toBe(WEAPONS.heavy.ammo + 1);
    expect(a.weapon.reload).toBeCloseTo(WEAPONS.heavy.reload * 0.8);
  });
  it('fires one more shot a burst with a wide scatter', () => {
    const a = createArmory('xwing', STOCK_LOADOUT, { shots: 1 });
    a.select(1);
    expect(a.weapon.count).toBe(WEAPONS.spread.count + 1);
  });
  it('homes harder and flies further with smart rounds', () => {
    const a = createArmory('xwing', STOCK_LOADOUT, { homing: 1.3, life: 1.25 });
    a.select(2);
    expect(a.weapon.homing).toBeCloseTo(WEAPONS.heavy.homing * 1.3);
    expect(a.weapon.life).toBeCloseTo(WEAPONS.heavy.life * 1.25);
  });
  it('is the armoury as it was with no skills, the table untouched', () => {
    const a = createArmory('xwing', STOCK_LOADOUT);
    a.select(2);
    expect(a.ammoMax).toBe(WEAPONS.heavy.ammo);
    expect(a.weapon).toEqual(WEAPONS.heavy);
    createArmory('xwing', STOCK_LOADOUT, { ammo: 3 });
    expect(WEAPONS.heavy.ammo).toBe(4);
  });
  it('takes new skills on a refit, keeping the line and the rounds left, and keeps them on a new loadout', () => {
    const a = createArmory('xwing');
    a.select(2);
    a.fired(0);
    a.refit(STOCK_LOADOUT, { ammo: 2 });
    expect(a.index).toBe(2);
    expect(a.ammoMax).toBe(WEAPONS.heavy.ammo + 2);
    expect(a.ammo).toBe(WEAPONS.heavy.ammo - 1);
    a.refit({ ...STOCK_LOADOUT, ordnance: 'mk2' });
    expect(a.ammoMax).toBe(WEAPONS.mk2.ammo + 2);
    a.refit(STOCK_LOADOUT, {});
    expect(a.ammoMax).toBe(WEAPONS.heavy.ammo);
  });
});

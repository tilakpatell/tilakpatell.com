import { describe, expect, it } from 'vitest';
import { seeded } from '../seeded.js';
import { loadRulebook, weaponOf } from './rulebook.js';
import { AI_DAMAGE_SCALE, RECOIL, createGun, damageAt, fire, kickAim, recoilOf, tick } from './weapons.js';

const rb = loadRulebook();
const DEG = Math.PI / 180;

describe('recoil (finding 34: GunSwayRecoilData, CameraRecoilData)', () => {
  it('adds 0.7° of upward kick a shot standing, capped at 10°, and a horizontal kick within ±0.5°', () => {
    const g = createGun(weaponOf(rb, 'e11'), { rand: seeded(5) });
    const shots = fire(g, 0);
    expect(shots[0].kick[1]).toBeCloseTo(0.7 * DEG, 9);
    expect(Math.abs(shots[0].kick[0])).toBeLessThanOrEqual(0.5 * DEG + 1e-12);
    expect(g.recoil[1]).toBeCloseTo(0.7, 9);
    // twenty shots with no tick between them: the amplitude stops at the cap
    for (let i = 1; i <= 20; i++) fire(g, i * 0.2);
    expect(g.recoil[1]).toBe(RECOIL.stand.max);
    expect(Math.abs(g.recoil[0])).toBeLessThanOrEqual(RECOIL.stand.hMax);
  });

  it('decays the amplitude at 10°/s, so a 300 rpm rifle is back at rest before its next shot', () => {
    const g = createGun(weaponOf(rb, 'e11'), { rand: seeded(5) });
    fire(g, 0);
    tick(g, 0.05, 0.05);
    expect(g.recoil[1]).toBeCloseTo(0.2, 9);
    tick(g, 0.05, 0.1);
    expect(g.recoil[1]).toBe(0);
    expect(recoilOf(g)).toEqual([0, 0]);
  });

  it('leaves a shot’s whole kick standing at the end of the step it was fired in, as the sim orders a step', () => {
    const g = createGun(weaponOf(rb, 'e11'), { rand: seeded(5) });
    // (the sim's step: the trigger, then the soldier's tick, at one time)
    const seen = [];
    for (let i = 0; i < 8; i++) {
      const now = i * 0.05;
      fire(g, now);
      tick(g, 0.05, now);
      seen.push(Math.round(g.recoil[1] * 1000) / 1000);
    }
    // (300 rpm: a bolt every fourth step)
    expect(seen).toEqual([0.7, 0.2, 0, 0, 0.7, 0.2, 0, 0]);
  });

  it('kicks less crouched and zoomed, more prone, and follows the dispersion sample’s side', () => {
    const row = weaponOf(rb, 'e11');
    const crouched = createGun(row, { rand: seeded(1) });
    expect(fire(crouched, 0, { stance: 'crouch' })[0].kick[1]).toBeCloseTo(RECOIL.crouch.inc * DEG, 9);
    const zoomed = createGun(row, { rand: seeded(1) });
    expect(fire(zoomed, 0, { stance: 'zoomStand' })[0].kick[1]).toBeCloseTo(RECOIL.zoomStand.inc * DEG, 9);
    const prone = createGun(row, { rand: seeded(1) });
    expect(fire(prone, 0, { stance: 'prone' })[0].kick[1]).toBeCloseTo(2 * DEG, 9);
    const g = createGun(row, { rand: seeded(9) });
    for (let i = 0; i < 12; i++) {
      const [shot] = fire(g, i);
      const side = Math.sign(shot.dir[0]) || 1;
      expect(Math.sign(shot.kick[0]) || side).toBe(side);
    }
  });

  it('turns a bot’s aim point by its gun’s own kick', () => {
    const g = createGun(weaponOf(rb, 'e11'), { rand: seeded(2) });
    const from = [0, 1.6, 0];
    const aim = [0, 1.6, 20];
    expect(kickAim(g, from, aim)).toEqual(aim);
    fire(g, 0);
    const kicked = kickAim(g, from, aim);
    expect(kicked[1]).toBeGreaterThan(1.6);
    expect(Math.hypot(kicked[0], kicked[1] - 1.6, kicked[2])).toBeCloseTo(20, 6);
    expect(Math.atan2(kicked[1] - 1.6, kicked[2])).toBeCloseTo(0.7 * DEG, 6);
  });

  it('halves a bot’s bolt (the AI projectile: 18 → 10 against 36 → 19)', () => {
    const a280 = weaponOf(rb, 'a280');
    expect(damageAt(a280, 0)).toBe(36);
    expect(damageAt(a280, 0, { bot: true })).toBe(36 * AI_DAMAGE_SCALE);
    expect(damageAt(a280, 40, { bot: true })).toBeCloseTo(19 * AI_DAMAGE_SCALE, 9);
    expect(damageAt({ ...a280, aiDamage: true }, 0, { bot: true })).toBe(36);
  });
});

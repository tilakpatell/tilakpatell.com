import { describe, expect, it } from 'vitest';
import gs from '../../../data/bf2017/gameSettings.json';
import { seeded } from '../../seeded.js';
import { AIM_GATE, aimStep, autoPlayerFor, createAim, createEvasion, createLof, dodges, groundOk, lofStep, noiseOf, rowOf, setting, strafeSide, suffixOf, takeRoll, weaponClass } from './autoPlayer.js';

describe('the AutoPlayer’s settings', () => {
  it('takes the most particular row the server holds', () => {
    expect(setting(gs, 'AP_LofReactionTimeS', { difficulty: 'expert' })).toEqual({ value: 0.025, name: 'AP_LofReactionTimeS_Expert_Mode8' });
    expect(setting(gs, 'AP_AimNoiseScale', { difficulty: 'rookie' }).value).toBe(7);
    expect(setting(gs, 'AP_AimNoiseScale', { mode: 'supremacy' }).name).toBe('AP_AimNoiseScale_Mode1');
    expect(setting(gs, 'AP_AimNoiseScale', { mode: 'coop' }).value).toBe(2.3);
    expect(setting(gs, 'AP_LofTimeoutS').name).toBe('AP_LofTimeoutS');
    expect(setting(gs, 'AP_NoSuchRow')).toBe(null);
  });

  it('reads Instant Action’s numbers by difficulty, the noise’s side factor among them', () => {
    const normal = autoPlayerFor(gs, { difficulty: 'normal' });
    expect(normal).toMatchObject({ fov: 140, lofReaction: 0.05, lofTimeout: 1.5, lead: 0.15, aimLap: 0.25, noiseScale: 3, sideScale: 1, engageScale: 2.5, dodgeRoll: 0.2, strafeInvert: [1.5, 3.5] });
    expect(normal.noise).toEqual({ blaster: 1.5, lmg: 1.5, shotgun: 3, sniper: 1, launcher: 0 });
    expect(autoPlayerFor(gs, { difficulty: 'expert', side: 'Enemies' }).sideScale).toBe(0.9);
    expect(autoPlayerFor(gs, { difficulty: 'rookie', side: 'Enemies' }).sideScale).toBe(1.2);
    expect(autoPlayerFor(gs, { mode: 'supremacy' }).noise.blaster).toBe(2.5);
    // (every number says which row it came from)
    expect(normal.sources.noiseScale).toBe('AP_AimNoiseScale_Normal_Mode8');
    expect(Object.values(normal.sources).filter((s) => s === 'hand')).toEqual([]);
  });

  it('names the suffixes and the rows', () => {
    expect([suffixOf('galacticAssault'), suffixOf('supremacy'), suffixOf('coop')]).toEqual(['Mode8', 'Mode1', 'Mode9']);
    expect([rowOf('rookie'), rowOf('multiplayer:expert'), rowOf(null), rowOf('medium')]).toEqual(['Rookie', 'Expert', 'Normal', 'Normal']);
  });

  it('gives the noise of each weapon class', () => {
    const ap = autoPlayerFor(gs, { difficulty: 'normal' });
    expect(noiseOf(ap, weaponClass('rifle', 'e11'))).toBeCloseTo(4.5);
    expect(noiseOf(ap, weaponClass('heavy', 'dlt19'))).toBeCloseTo(4.5);
    expect(noiseOf(ap, weaponClass('sniper', 'nt242'))).toBeCloseTo(3);
    expect(weaponClass('pistol', 'blurrg1120')).toBe('shotgun');
    expect(weaponClass('special', 'smartrocket')).toBe('launcher');
  });
});

describe('the tracker', () => {
  const ap = autoPlayerFor(gs, { difficulty: 'normal' });

  it('turns onto a target inside a second, and holds it inside the noise', () => {
    const aim = createAim();
    aim.yaw = Math.PI / 2; // looking 90° away
    aim.pitch = 0;
    const rand = seeded(3);
    let t = 0;
    let on = null;
    const errors = [];
    for (let i = 0; i < 60; i++) {
      const r = aimStep(aim, ap, { from: [0, 1.6, 0], at: [0, 1.4, 30], noise: noiseOf(ap, 'blaster'), dt: 0.05, rand });
      t += 0.05;
      if (on === null && r.error < AIM_GATE + noiseOf(ap, 'blaster')) on = t;
      if (t > 1.5) errors.push(r.error);
    }
    expect(on).toBeLessThan(1);
    expect(Math.max(...errors)).toBeLessThan(noiseOf(ap, 'blaster') + 0.5);
  });

  it('leads a moving target by the prediction time', () => {
    const aim = createAim();
    const r = aimStep(aim, { ...ap, aimLap: 1e-6 }, { from: [0, 0, 0], at: [0, 0, 20], vel: [10, 0, 0], noise: 0, dt: 0.05 });
    expect(r.point[0]).toBeCloseTo(1.5, 1);
  });

  it('fires once the line has been clear for the reaction, and for the timeout after it is lost', () => {
    const lof = createLof();
    expect(lofStep(lof, ap, { clear: true, now: 0 })).toBe(false);
    expect(lofStep(lof, ap, { clear: true, now: 0.05 })).toBe(true);
    expect(lofStep(lof, ap, { clear: false, now: 1 })).toBe(true);
    expect(lofStep(lof, ap, { clear: false, now: 1.6 })).toBe(false);
    expect(lofStep(createLof(), ap, { clear: false, now: 5 })).toBe(false);
  });
});

describe('the evasion', () => {
  const ap = autoPlayerFor(gs, { difficulty: 'normal' });

  it('flips its strafe every 1.5 to 3.5 s', () => {
    const ev = createEvasion();
    const rand = seeded(1);
    const flips = [];
    let side = strafeSide(ev, ap, { now: 0, rand });
    for (let t = 0.05; t < 30; t += 0.05) {
      const s = strafeSide(ev, ap, { now: t, rand });
      if (s !== side) flips.push(t);
      side = s;
    }
    const gaps = flips.slice(1).map((t, i) => t - flips[i]);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(1.5 - 0.06);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(3.5 + 0.06);
  });

  // (the game's step, FUN_145571ea0: the ground is probed every step of a leg; a failed probe ends the leg and
  // starts that side's cooldown, the other leg starting at once if its own side is not cooling)
  it('leaves a side whose ground fails at once, and stays on the other while that side cools', () => {
    const ev = createEvasion();
    // (the shortest legs, so the open side's time is up twice while the other cools)
    const rand = () => 0;
    const ground = (s) => s === -1;
    const sides = [];
    for (let t = 0; t < ap.groundCheck.cooldown - 0.01; t += 0.05) sides.push(strafeSide(ev, ap, { now: t, rand, ground }));
    expect(new Set(sides)).toEqual(new Set([-1]));
  });

  it('ends the strafe with no ground either side, until a side has cooled', () => {
    const ev = createEvasion();
    const rand = seeded(3);
    let ok = false;
    const ground = () => ok;
    for (let t = 0; t < ap.groundCheck.cooldown - 0.01; t += 0.05) expect(strafeSide(ev, ap, { now: t, rand, ground })).toBe(0);
    ok = true;
    expect(Math.abs(strafeSide(ev, ap, { now: ap.groundCheck.cooldown + 0.05, rand, ground }))).toBe(1);
  });

  it('probes from the check’s height above the feet, down the check’s distance', () => {
    expect(ap.groundCheck).toMatchObject({ distance: 2.5, drop: 3.5, offset: 1.5, cooldown: 3 });
    expect(ap.sources['groundCheck.offset']).toBe('AP_EvasiveManeuversGroundCheckHeightOffsetM');
    // (ground this far above or below the feet, m)
    expect(groundOk(ap, -1.9)).toBe(true);
    expect(groundOk(ap, -2.1)).toBe(false);
    expect(groundOk(ap, 1.4)).toBe(true);
    expect(groundOk(ap, 1.6)).toBe(false);
  });

  // (the game's FUN_14556df20, called as each leg starts: the roll and the jump are drawn there, once a leg)
  it('draws the dodge roll as a leg starts, one leg in five, and hands it over once', () => {
    const ev = createEvasion();
    const rand = seeded(5);
    let legs = 0;
    let rolls = 0;
    let side = 0;
    for (let t = 0; t < 4000; t += 0.05) {
      const s = strafeSide(ev, ap, { now: t, rand });
      if (s !== side) legs++;
      side = s;
      if (takeRoll(ev)) rolls++;
      expect(takeRoll(ev)).toBe(false);
    }
    expect(legs).toBeGreaterThan(1000);
    expect(rolls / legs).toBeGreaterThan(0.2 - 0.03);
    expect(rolls / legs).toBeLessThan(0.2 + 0.03);
  });

  it('rolls at the dodge probability', () => {
    const rand = seeded(9);
    let n = 0;
    for (let i = 0; i < 2000; i++) if (dodges(ap, rand)) n++;
    expect(n / 2000).toBeGreaterThan(0.17);
    expect(n / 2000).toBeLessThan(0.23);
  });
});

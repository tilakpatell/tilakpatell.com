import { describe, expect, it } from 'vitest';
import gs from '../../../data/bf2017/gameSettings.json';
import { seeded } from '../../seeded.js';
import { BURSTS, TOLERANCE, aimPoint, autoPlayerFor, burstStep, createAim, createBurst, createEvasion, createLof, dodges, groundOk, lofStep, mayFire, noiseOf, rowOf, setting, strafeSide, suffixOf, takeRoll, viewMiss, viewStep, weaponClass } from './autoPlayer.js';

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
    // (a launcher takes the blaster's numbers: the game's own fall-through)
    expect(weaponClass('special', 'smartrocket')).toBe('blaster');
  });
});

// (the game's own update, read from its code: NOTES.md, "The AutoPlayers")
describe('the aim', () => {
  const ap = autoPlayerFor(gs, { difficulty: 'normal' });
  const RAD = Math.PI / 180;
  const from = [0, 1.6, 0];
  const at = [0, 1.4, 30];
  const off = (p) => ({ yaw: Math.atan2(p[0] - from[0], p[2] - from[2]) / RAD, pitch: (Math.atan2(p[1] - from[1], Math.hypot(p[0] - from[0], p[2] - from[2])) - Math.atan2(at[1] - from[1], 30)) / RAD });

  it('is drawn afresh every update, inside the noise on the yaw and on the pitch each', () => {
    const rand = seeded(3);
    const draws = Array.from({ length: 2000 }, () => off(aimPoint(ap, { from, at, noise: 4, rand })));
    expect(Math.max(...draws.map((d) => Math.abs(d.yaw)))).toBeLessThanOrEqual(4 + 1e-6);
    expect(Math.max(...draws.map((d) => Math.abs(d.pitch)))).toBeLessThanOrEqual(4 + 1e-3);
    // (a square, not a disc: both near their most at once does happen)
    expect(draws.some((d) => Math.abs(d.yaw) > 3.2 && Math.abs(d.pitch) > 3.2)).toBe(true);
    // (no memory: one draw says nothing of the next)
    expect(new Set(draws.slice(0, 50).map((d) => d.yaw.toFixed(4))).size).toBe(50);
    expect(aimPoint(ap, { from, at, noise: 0, rand })).toEqual(at);
  });

  it('leads a moving target by the prediction time', () => {
    const p = aimPoint(ap, { from: [0, 0, 0], at: [0, 0, 20], vel: [10, 0, 0], noise: 0 });
    expect(p[0]).toBeCloseTo(10 * ap.lead, 6);
  });

  it('the view turns onto it no faster than a lap every AimLapTime, a quarter of that in pitch', () => {
    const aim = createAim();
    aim.yaw = Math.PI / 2;
    aim.pitch = 0;
    const slow = { ...ap, aimLap: 4 };
    viewStep(aim, slow, { from, point: at, dt: 0.05 });
    expect(Math.PI / 2 - aim.yaw).toBeCloseTo(((2 * Math.PI) / 4) * 0.05, 9);
    for (let i = 0; i < 100; i++) viewStep(aim, slow, { from, point: at, dt: 0.05 });
    expect(aim.yaw).toBeCloseTo(0, 6);
    const up = createAim();
    up.yaw = 0;
    up.pitch = 1;
    viewStep(up, slow, { from, point: at, dt: 0.05 });
    expect(1 - up.pitch).toBeCloseTo(((2 * Math.PI) / 4 / 4) * 0.05, 9);
  });
});

describe('the trigger', () => {
  const ap = autoPlayerFor(gs, { difficulty: 'normal' });

  it('measures how far the view line passes from the target, and that the target is ahead', () => {
    const aim = createAim();
    aim.yaw = 0;
    aim.pitch = 0;
    expect(viewMiss(aim, [0, 0, 0], [1, 0, 20])).toMatchObject({ ahead: true });
    expect(viewMiss(aim, [0, 0, 0], [1, 0, 20]).miss2).toBeCloseTo(1, 9);
    expect(viewMiss(aim, [0, 0, 0], [0, 0, 0.5]).ahead).toBe(false);
    expect(viewMiss(aim, [0, 0, 0], [0, 0, -20]).ahead).toBe(false);
  });

  it('fires with the view line inside the weapon’s tolerance of the target, wider under noise, at any range', () => {
    expect(TOLERANCE).toEqual({ blaster: 2, lmg: 1, shotgun: 1, sniper: 0.15 });
    expect(mayFire('blaster', 1, { miss2: 1.9, ahead: true })).toBe(true);
    expect(mayFire('blaster', 1, { miss2: 2.1, ahead: true })).toBe(false);
    expect(mayFire('sniper', 0, { miss2: 0.2, ahead: true })).toBe(false);
    // (the tolerance times the noise where that is over one)
    expect(mayFire('blaster', 4.5, { miss2: 8.9, ahead: true })).toBe(true);
    expect(mayFire('blaster', 4.5, { miss2: 9.1, ahead: true })).toBe(false);
    expect(mayFire('blaster', 4.5, { miss2: 0, ahead: false })).toBe(false);
  });

  it('holds the trigger a burst and lets it go a pause: a blaster 0.2 s on and 0.1 off, a shotgun 0.2 s every 2.2', () => {
    const held = (cls, seconds) => {
      const b = createBurst();
      const on = [];
      for (let t = 0; t < seconds - 1e-9; t += 0.05) on.push(burstStep(b, cls, { start: true, now: t }) ? 1 : 0);
      return on.join('');
    };
    expect(BURSTS.blaster).toEqual({ hold: 0.2, pause: 0.1 });
    expect(held('blaster', 0.9)).toBe('111100111100111100');
    // (four steps held, off until 2.2 s, four held again, then off)
    expect(held('shotgun', 2.6).replace(/0+/g, '0')).toBe('1111011110');
    expect(held('shotgun', 2.6).indexOf('1', 4)).toBe(44);
    // (nothing to fire at: a burst begun runs out, none begins)
    const b = createBurst();
    expect(burstStep(b, 'blaster', { start: true, now: 0 })).toBe(true);
    expect(burstStep(b, 'blaster', { start: false, now: 0.1 })).toBe(true);
    expect(burstStep(b, 'blaster', { start: false, now: 0.25 })).toBe(false);
    expect(burstStep(b, 'blaster', { start: false, now: 5 })).toBe(false);
  });

  it('has its line of fire once the line has been clear past the reaction, and for the timeout after it is lost', () => {
    const lof = createLof();
    expect(lofStep(lof, ap, { clear: true, now: 0 })).toBe(false);
    expect(lofStep(lof, ap, { clear: true, now: 0.1 })).toBe(true);
    expect(lofStep(lof, ap, { clear: false, now: 1 })).toBe(true);
    expect(lofStep(lof, ap, { clear: false, now: 1.7 })).toBe(false);
    expect(lofStep(createLof(), ap, { clear: false, now: 5 })).toBe(false);
  });

  it('a line lost before the reaction was up gives nothing after, and the reaction is waited again when it clears', () => {
    const slow = { ...ap, lofReaction: 0.5 };
    const lof = createLof();
    expect(lofStep(lof, slow, { clear: true, now: 0 })).toBe(false);
    expect(lofStep(lof, slow, { clear: false, now: 0.2 })).toBe(false);
    expect(lofStep(lof, slow, { clear: true, now: 0.3 })).toBe(false);
    expect(lofStep(lof, slow, { clear: true, now: 0.7 })).toBe(false);
    expect(lofStep(lof, slow, { clear: true, now: 0.85 })).toBe(true);
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

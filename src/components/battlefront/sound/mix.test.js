import { describe, expect, it } from 'vitest';
import { RUN_MAX, WALK_MAX } from '../figures/locomotion.js';
import { DUCKS, LAND_DROP, LAND_FULL, LOUDNESS, ONE_SHOTS, admits, blasterLayers, createWindow, dueOneShots, footstep, hear, landing, lifeCues, loudnessOf, musicFor, oneShots, overheatCues, panOf, topOf } from './mix.js';

describe('the blaster’s layers by distance', () => {
  it('is the close take and the HiFi transient at the muzzle, at the patch’s gains', () => {
    const l = blasterLayers(0);
    expect(l.close).toBeCloseTo(0.9);
    expect(l.hifi).toBeCloseTo(0.2);
    expect(l.distant).toBe(0);
    expect(l.far).toBe(0);
  });

  it('crosses from the close take to the distant one over 6 to 22 m, and the far tail comes in past 300 m', () => {
    const near = blasterLayers(6);
    expect(near.distant).toBe(0);
    const mid = blasterLayers(14);
    expect(mid.close).toBeGreaterThan(0);
    expect(mid.distant).toBeGreaterThan(0);
    const out = blasterLayers(22);
    expect(out.close).toBe(0);
    expect(out.distant).toBeGreaterThan(0);
    expect(blasterLayers(100).far).toBe(0);
    expect(blasterLayers(600).far).toBeGreaterThan(0);
    expect(blasterLayers(1000).distant).toBe(0);
  });

  it('falls with distance (a shot at 40 m is half the one at the muzzle)', () => {
    expect(blasterLayers(40).distant / 0.8).toBeCloseTo(0.5, 1);
    expect(blasterLayers(500).far).toBeLessThan(blasterLayers(1000).far);
    expect(blasterLayers(2000).far).toBeLessThan(blasterLayers(1000).far);
  });

  it('takes a weapon’s own gains (the heavy’s bark is mostly its far layer)', () => {
    const l = blasterLayers(0, [0.6, 0.7, 0.25]);
    expect(l.close).toBeCloseTo(0.6);
    expect(l.hifi).toBeCloseTo(0.25);
  });
});

describe('the sound’s side of the listener', () => {
  it('is to the right of someone facing +Z when it lies at +X, and ahead is the middle', () => {
    expect(panOf([0, 0, 0], [5, 0, 0], 0)).toBeCloseTo(1);
    expect(panOf([0, 0, 0], [-5, 0, 0], 0)).toBeCloseTo(-1);
    expect(panOf([0, 0, 0], [0, 0, 5], 0)).toBeCloseTo(0);
    expect(panOf([0, 0, 0], [0, 0, 5], Math.PI / 2)).toBeCloseTo(-1);
    expect(panOf([1, 0, 1], [1, 0, 1], 0)).toBe(0);
  });
});

describe('the footsteps by speed', () => {
  it('is silent standing, the walk set under the walk band, the jog in it, the sprint over it', () => {
    expect(footstep(0)).toBeNull();
    expect(footstep(1.9).set).toBe('walk');
    expect(footstep(WALK_MAX + 0.1).set).toBe('jog');
    expect(footstep(RUN_MAX + 0.1).set).toBe('sprint');
  });

  it('plants more often the faster the body goes, and fuller and higher (the patch’s ScaleClamps)', () => {
    const walk = footstep(1.9);
    const sprint = footstep(5.97);
    expect(walk.interval).toBeGreaterThan(sprint.interval);
    expect(sprint.gain).toBeCloseTo(1);
    expect(walk.gain).toBeLessThan(0.5);
    expect(walk.gain).toBeGreaterThanOrEqual(0.15);
    expect(sprint.pitch).toBe(1);
    expect(footstep(0.5).pitch).toBeCloseTo(0.85);
    expect(footstep(3, { crouch: true }).gain).toBeLessThan(footstep(3).gain);
  });
});

describe('a landing', () => {
  it('is a drop of a ledge’s worth in one step, half gain at the least and whole from a long fall', () => {
    // (the sprint down a 45° slope falls 0.3 m a step: no landing)
    expect(landing(5.97 * 0.05)).toBeNull();
    expect(landing(0)).toBeNull();
    expect(landing(-3)).toBeNull();
    expect(landing(LAND_DROP).gain).toBeCloseTo(0.5);
    expect(landing(LAND_FULL).gain).toBe(1);
    expect(landing(40).gain).toBe(1);
    expect(landing(1.5).gain).toBeGreaterThan(landing(0.8).gain);
  });
});

describe('the HDR window', () => {
  it('drops the footsteps while a blaster fires in earshot, and lets them back a second or two after', () => {
    const w = createWindow();
    expect(admits(w, LOUDNESS.step, 0)).toBe(true);
    hear(w, LOUDNESS.blaster, 10, 0.64);
    expect(topOf(w, 10)).toBe(100);
    expect(admits(w, LOUDNESS.step, 10)).toBe(false);
    expect(admits(w, LOUDNESS.death, 10)).toBe(true);
    expect(admits(w, LOUDNESS.step, 10.5)).toBe(false);
    expect(admits(w, LOUDNESS.step, 12)).toBe(true);
  });

  it('a far shot is quieter in the window than a near one', () => {
    expect(loudnessOf(LOUDNESS.blaster, 0.1)).toBeCloseTo(80);
    const w = hear(createWindow(), loudnessOf(LOUDNESS.blaster, 0.1), 0);
    expect(admits(w, LOUDNESS.step, 0)).toBe(true);
  });

  it('never falls under its floor', () => {
    expect(topOf(createWindow(), 1000)).toBe(20);
  });
});

describe('the mixers', () => {
  it('ducks the world −20 dB under a 300 Hz low-pass on death, −10 dB under the tension stem', () => {
    expect(DUCKS.death).toMatchObject({ db: -20, lpf: 300 });
    expect(DUCKS.tension.db).toBe(-10);
    expect(DUCKS.none.db).toBe(0);
  });
});

describe('the bed’s one-shots', () => {
  it('are the nine of the finding and the ice, each placed at its distance on its interval', () => {
    expect(ONE_SHOTS.map((o) => o.name)).toContain('ambience.alien.wampa');
    expect(ONE_SHOTS.find((o) => o.name === 'ambience.wind.gusts')).toMatchObject({ dist: [10, 25], every: [9, 18] });
    let k = 0;
    const seq = [0.5, 0.2, 0.9, 0.1, 0.7];
    const rng = () => seq[k++ % seq.length];
    const shots = oneShots(rng, 0);
    expect(dueOneShots(shots, 0, rng)).toHaveLength(0);
    const due = dueOneShots(shots, 1000, rng);
    expect(due).toHaveLength(ONE_SHOTS.length);
    for (const d of due) {
      const row = ONE_SHOTS.find((o) => o.name === d.name);
      expect(d.dist).toBeGreaterThanOrEqual(row.dist[0]);
      expect(d.dist).toBeLessThanOrEqual(row.dist[1]);
    }
    expect(dueOneShots(shots, 1000, rng)).toHaveLength(0);
    for (const s of shots) expect(s.next).toBeGreaterThan(1000);
  });
});

describe('the music by the mode’s state', () => {
  const mode = (over = {}) => ({ objectives: [{ meter: 0 }], tickets: 90, result: null, ...over });
  it('is the medium stem in play, high past 0.6 of an objective, the tension as it closes or the tickets run out', () => {
    expect(musicFor(null)).toBeNull();
    expect(musicFor(mode())).toBe('medium');
    expect(musicFor(mode({ objectives: [{ meter: 0.65 }] }))).toBe('high');
    expect(musicFor(mode({ objectives: [{ meter: 0.85 }] }))).toBe('tension');
    expect(musicFor(mode({ tickets: 10 }))).toBe('tension');
    expect(musicFor(mode({ tickets: 0 }))).toBe('medium');
  });

  it('is the end of round by who won', () => {
    expect(musicFor(mode({ result: { winner: 2 } }), 2)).toBe('eor.win');
    expect(musicFor(mode({ result: { winner: 1 } }), 2)).toBe('eor.lose');
    expect(musicFor(mode({ result: { winner: 3 } }), 2)).toBe('eor.draw');
  });
});

describe('the gun’s and the life’s cues', () => {
  const gun = (heat, overheated = false) => ({ heat, overheated, warning: 0.75 });
  it('warns as the bar nears the top, sounds the overheat at it, the reset when it clears', () => {
    expect(overheatCues(gun(0.5), gun(0.7))).toEqual([]);
    expect(overheatCues(gun(0.7), gun(0.8))).toEqual(['overheat.warning']);
    expect(overheatCues(gun(0.8), gun(1, true))).toEqual(['overheat.overheated']);
    expect(overheatCues(gun(0.4, true), gun(0, false))).toEqual(['overheat.reset']);
    expect(overheatCues(gun(0.6), gun(0))).toEqual(['overheat.manual']);
    expect(overheatCues(null, gun(0))).toEqual([]);
  });

  it('marks a hit, a kill and the death', () => {
    const me = (over = {}) => ({ state: 'alive', hitAt: null, killAt: null, ...over });
    expect(lifeCues(me(), me({ hitAt: 3 }))).toEqual(['hit.hit']);
    expect(lifeCues(me(), me({ hitAt: 3, firstHit: true }))).toEqual(['hit.first']);
    expect(lifeCues(me({ hitAt: 3 }), me({ hitAt: 3 }))).toEqual([]);
    expect(lifeCues(me(), me({ killAt: 4 }))).toEqual(['hit.kill']);
    expect(lifeCues(me(), me({ state: 'down' }))).toEqual(['death']);
  });
});

import { describe, expect, it } from 'vitest';
import gs from '../../../data/bf2017/gameSettings.json';
import { createWaves, mayDeploy, soldiersOpen, stage, unitOpen, wavesFor } from './waves.js';

describe('the waves’ tables', () => {
  it('are Instant Action’s on the command-post modes', () => {
    const t = wavesFor(gs, { cp: true });
    expect(t.soldiers).toEqual({ spawn: 15, pause: 30, force: 60, delay: 4 });
    expect([t.hero.start, t.hero.pause, t.hero.max]).toEqual([90, 180, 2]);
    expect([t.special.start, t.special.pause, t.special.max]).toEqual([60, 90, 6]);
    expect([t.vehicle.start, t.vehicle.pause, t.vehicle.max]).toEqual([60, 120, 2]);
    expect(wavesFor(gs, { cp: true, human: true }).hero.max).toBe(1);
    expect(Object.values(t.sources).filter((s) => s === 'hand')).toEqual([]);
  });

  it('are Co-op’s attack and defend rows by phase on the objective modes', () => {
    const a1 = wavesFor(gs, { side: 'attack', phase: 1 });
    expect(a1.soldiers).toEqual({ spawn: 5, pause: 30, force: 55, delay: 1 });
    expect([a1.hero.start, a1.hero.max, a1.special.max]).toEqual([999, 1, 2]);
    expect(wavesFor(gs, { side: 'attack', phase: 1, length: 'short' }).soldiers.pause).toBe(20);
    expect(wavesFor(gs, { side: 'attack', phase: 5 }).soldiers.force).toBe(40);
    const pauses = [1, 2, 3, 4, 5].map((phase) => wavesFor(gs, { side: 'defend', phase }).soldiers.pause);
    // (the fifth phase has no row: the fourth's stands)
    expect(pauses).toEqual([12, 6, 3, 0, 0]);
    const d3 = wavesFor(gs, { side: 'defend', phase: 3 });
    expect([d3.hero.start, d3.hero.pause, d3.hero.max, d3.special.max, d3.vehicle.start, d3.vehicle.next]).toEqual([60, 140, 2, 3, 20, 3]);
  });
});

describe('a team’s waves', () => {
  it('let soldiers in through the window, or once their forced time has come', () => {
    const w = createWaves(wavesFor(gs, { side: 'attack', phase: 1 }), 0);
    expect(soldiersOpen(w, 2)).toBe(true);
    expect(soldiersOpen(w, 10)).toBe(false);
    expect(soldiersOpen(w, 36)).toBe(true);
    // (the delay first)
    expect(mayDeploy(w, { since: 1.5, now: 2 })).toBe(false);
    expect(mayDeploy(w, { since: 0, now: 2 })).toBe(true);
    expect(mayDeploy(w, { since: 6, now: 30 })).toBe(false);
    expect(mayDeploy(w, { since: -30, now: 30 })).toBe(true);
    // (a pause of nothing never shuts)
    const d4 = createWaves(wavesFor(gs, { side: 'defend', phase: 4 }), 0);
    expect([1, 7, 13, 99].every((t) => soldiersOpen(d4, t))).toBe(true);
  });

  it('open a unit’s wave on its time, for its window, then after its pause', () => {
    const w = createWaves(wavesFor(gs, { cp: true }), 0);
    expect(unitOpen(w, 'hero', 89)).toBe(false);
    expect(unitOpen(w, 'hero', 90)).toBe(true);
    expect(unitOpen(w, 'hero', 94)).toBe(true);
    expect(unitOpen(w, 'hero', 96)).toBe(false);
    expect(unitOpen(w, 'hero', 274)).toBe(false);
    expect(unitOpen(w, 'hero', 275)).toBe(true);
  });

  it('give the attackers no hero in the first stage, and one on the next stage’s pause', () => {
    const w = createWaves(wavesFor(gs, { side: 'attack', phase: 1 }), 0);
    expect(unitOpen(w, 'hero', 600)).toBe(false);
    stage(w, wavesFor(gs, { side: 'attack', phase: 2 }), 600);
    expect(unitOpen(w, 'hero', 759)).toBe(false);
    expect(unitOpen(w, 'hero', 760)).toBe(true);
    expect(unitOpen(w, 'vehicle', 603)).toBe(true);
  });
});

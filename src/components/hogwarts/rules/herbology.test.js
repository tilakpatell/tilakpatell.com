import { describe, expect, it } from 'vitest';
import { HERB, POTS, act, herbologyBot, inGreen, marker, muffs, newHerbology, result, stepHerbology } from './herbology';

const DT = 1 / 60;
// wait until the marker is (or isn't) in the green
function until(h, want, limit = 5) {
  for (let t = 0; t < limit; t += DT) {
    if (inGreen(h) === want) return h;
    h = stepHerbology(h, DT).herb;
  }
  throw new Error('never');
}

describe('a pot', () => {
  it('the marker swings across the bar and back', () => {
    let h = act(newHerbology({ earmuffs: true })).herb;
    expect(marker(h)).toBe(0);
    h = stepHerbology(h, POTS[0].swing / 2).herb;
    expect(marker(h)).toBeCloseTo(1);
    h = stepHerbology(h, POTS[0].swing / 2 - 1e-6).herb;
    expect(marker(h)).toBeCloseTo(0, 3);
  });
  it('a push in the green repots it and the next pot comes up', () => {
    let h = act(newHerbology({ earmuffs: true })).herb;
    h = until(h, true);
    const r = act(h);
    expect(r.what).toBe('potted');
    expect(r.herb.pot).toBe(1);
    expect(r.herb.out).toBe(false);
  });
  it('a push outside it lets it wriggle free, still crying', () => {
    let h = act(newHerbology({ earmuffs: true })).herb;
    h = until(until(h, true), false);
    const r = act(h);
    expect(r.what).toBe('missed');
    expect(r.herb.out).toBe(true);
    expect(r.herb.cry).toBeGreaterThan(0);
  });
  it('each pot is quicker and narrower than the last', () => {
    for (let i = 1; i < POTS.length; i++) {
      expect(POTS[i].swing).toBeLessThan(POTS[i - 1].swing);
      expect(POTS[i].half).toBeLessThan(POTS[i - 1].half);
    }
  });
});

describe('the cry', () => {
  it('without earmuffs, it gets through at once: a ten-second faint', () => {
    let h = act(newHerbology()).herb;
    let what = null;
    let t = 0;
    while (!what) {
      ({ herb: h, what } = stepHerbology(h, DT));
      t += DT;
    }
    expect(what).toBe('fainted');
    expect(t).toBeLessThan(1);
    expect(h.faint).toBe(HERB.faint);
    expect(act(h).what).toBe(null); // (out cold)
    const later = stepHerbology(h, HERB.faint);
    expect(later.what).toBe('woke');
    expect(later.herb.pot).toBe(0);
  });
  it('through earmuffs it takes long enough to repot several swings over', () => {
    expect(HERB.cry / HERB.muffled).toBeGreaterThan(3 * POTS[0].swing);
  });
  it('earmuffs can’t come off with a Mandrake in your hand', () => {
    const h = act(newHerbology({ earmuffs: true })).herb;
    expect(muffs(h, false).earmuffs).toBe(true);
  });
});

describe('the lesson', () => {
  it('the bot puts its earmuffs on and repots all four without fainting, for ten points', () => {
    let h = newHerbology();
    let t = 0;
    while (!h.done && t < 120) {
      const a = herbologyBot(h);
      if (a === 'muffs') h = muffs(h, true);
      else if (a === 'act') h = act(h).herb;
      h = stepHerbology(h, DT).herb;
      t += DT;
    }
    expect(h.done).toBe(true);
    expect(h.faints).toBe(0);
    expect(h.misses).toBe(0);
    expect(t).toBeLessThan(30);
    expect(result(h)).toEqual({ type: 'lesson', id: 'herbology', done: true, points: 10 });
  });
});

import { describe, expect, it } from 'vitest';
import { createBattle } from './battle';
import { seededRand } from './battleKit';
import { DIFFICULTY, difficulty, pressureOf, statsOf } from './battleDifficulty';
import { createDirector } from './battleDirector';
import { planFor } from './battlePlan';
import { WARS } from './wars';

// How hard the fight round you is, from how you're doing in it (your kills,
// your deaths lately, your shields), and what that changes: only what shoots
// at you, never the battle every pilot shares.
describe('difficulty', () => {
  it('rises with your kills and falls with your deaths and low shields, between 0.6 and 1.6', () => {
    expect(difficulty({ killsPerMin: 2, deaths: 0, shield: 100 })).toBeCloseTo(1, 9);
    let last = -Infinity;
    for (let k = 0; k <= 12; k += 0.5) {
      const d = difficulty({ killsPerMin: k, deaths: 0, shield: 100 });
      expect(d).toBeGreaterThanOrEqual(last);
      last = d;
    }
    last = Infinity;
    for (let n = 0; n <= 6; n++) {
      const d = difficulty({ killsPerMin: 4, deaths: n, shield: 100 });
      expect(d).toBeLessThanOrEqual(last);
      last = d;
    }
    expect(difficulty({ killsPerMin: 2, deaths: 0, shield: 20 })).toBeCloseTo(0.8, 9);
    for (const s of [{ killsPerMin: 50 }, { killsPerMin: 0, deaths: 9, shield: 0 }, {}]) {
      const d = difficulty(s);
      expect(d).toBeGreaterThanOrEqual(DIFFICULTY.range[0]);
      expect(d).toBeLessThanOrEqual(DIFFICULTY.range[1]);
    }
  });

  it('scales only what shoots at you: how many may be on you, how true their aim, whether the ace duels you, how near the flak reaches', () => {
    expect(pressureOf(1)).toEqual({ d: 1, onYou: 2, spread: 0.02, aceDuels: false, flak: 25 });
    expect(pressureOf(0.6)).toMatchObject({ onYou: 1, flak: 15, aceDuels: false });
    expect(pressureOf(0.6).spread).toBeCloseTo(0.02 / 0.6, 9);
    expect(pressureOf(1.6)).toMatchObject({ onYou: 3, flak: 25, aceDuels: true });
    expect(pressureOf(1.2).aceDuels).toBe(true);
    for (let d = 0.6; d <= 1.6; d += 0.05) {
      const p = pressureOf(d);
      expect(p.onYou).toBeGreaterThanOrEqual(1);
      expect(p.onYou).toBeLessThanOrEqual(4);
    }
  });

  it('reads your stats from your own kills and deaths: kills a minute since you came (from a minute at par), deaths in the last five minutes', () => {
    const s = statsOf({ kills: [10, 40, 70, 100], deaths: [5, 60, 110], since: 0, now: 120, shield: 60 });
    expect(s.killsPerMin).toBeCloseTo((4 + DIFFICULTY.par) / 3, 9);
    expect(s.deaths).toBe(3);
    expect(statsOf({ kills: [], deaths: [5], since: 0, now: 400, shield: 60 }).deaths).toBe(0);
    // (just come in: at par, neither let off nor pressed for one lucky kill)
    expect(difficulty(statsOf({ kills: [], deaths: [], since: 0, now: 0 }))).toBeCloseTo(1, 9);
    expect(statsOf({ kills: [3], deaths: [], since: 0, now: 5, shield: 100 }).killsPerMin).toBeLessThan(3);
  });
});

describe('the fight round you, at each difficulty', () => {
  const war = WARS.starwars;
  // a pilot circling the attacked objective ship (14 units off it, a turn every nine seconds)
  const circling = (d, seconds = 60, seed = 'difficulty') => {
    const b = createBattle({ war, attacker: 0, at: [0, 0, 0], axis: [1, 0], perSide: 10, rand: seededRand(seed), tickets: false, tactics: true });
    b.setYou(0);
    b.setDifficulty(d);
    const ship = b.capitals.find((c) => c.objective);
    let hurt = 0;
    const step = 1 / 30;
    for (let i = 0; i < seconds / step; i++) {
      const a = i * step * 0.7;
      const you = { x: ship.pos.x + Math.cos(a) * 14, y: ship.pos.y + 6, z: ship.pos.z + Math.sin(a) * 14, alive: true };
      for (const e of b.update(step, you)) if (e.type === 'hurt') hurt += e.damage;
    }
    return { b, hurt: hurt / seconds };
  };

  // (over six half-minute battles: one battle's dice decide too much of it, one seed
  // going 0.28 and the next 0.85 of the harder one's on the same code, and
  // anything that moves in the battle, its objectives' places among them,
  // deals them again)
  it('hurts a pilot circling the attacked objective a third less at 0.6 than at 1, and no more than a few fighters are on you at once', () => {
    const seeds = ['difficulty', 'a', 'b', 'c', 'd', 'e'];
    const sum = (d) => seeds.reduce((n, seed) => n + circling(d, 30, seed).hurt, 0);
    const one = sum(1);
    const easy = sum(0.6);
    expect(easy).toBeLessThanOrEqual(one * 0.7);
    expect(one).toBeGreaterThan(0);
    const hard = circling(1.6, 20);
    expect(hard.b.you.on).toBeLessThanOrEqual(pressureOf(1.6).onYou + 1);
  });

  it('never touches the battle every pilot shares: the director’s state, and what’s told the tally, are the same at 0.6 and 1.6', () => {
    const shared = (d) => {
      const plan = planFor({ id: 'difficulty.shared', kind: 'assault', attacker: 0 });
      const dir = createDirector({ plan, seed: plan.id });
      const told = [];
      const clock = { t: 60 };
      const b = createBattle({ war, attacker: 0, perSide: 8, rand: seededRand('difficulty'), tickets: false, tactics: true, plan, director: { state: () => dir.state(clock.t, () => 0) }, onMine: (id, n) => told.push([id, n]), elapsed: 60 });
      b.setYou(1);
      b.setDifficulty(d);
      const ship = b.capitals.find((c) => c.objective);
      for (let i = 0; i < 30 * 30; i++) {
        b.update(1 / 30, { x: ship.pos.x, y: ship.pos.y + 20, z: ship.pos.z, alive: true });
        clock.t = b.clock;
      }
      return { told, objectives: b.objectives.map((o) => [o.key, o.hp, o.alive]), state: JSON.stringify(dir.state(clock.t, () => 0)) };
    };
    const easy = shared(0.6);
    const hard = shared(1.6);
    expect(easy.told).toEqual([]);
    expect(hard.told).toEqual([]);
    expect(hard.objectives).toEqual(easy.objectives);
    expect(hard.state).toBe(easy.state);
  });
});

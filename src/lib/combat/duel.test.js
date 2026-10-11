import { describe, expect, it } from 'vitest';
import { DUEL, createDuellist, duelStep, guarding, onGuardBroken, onHit, onStagger, swung } from './duel';

// a roll that always comes up `v` (0 beats every rate, 0.99 none)
const always = (v) => () => v;
// a repeatable roll
const seeded = (seed = 7) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const DT = 1 / 30;
// you, standing at x, z; swinging: your stroke (`t` seconds into its clip)
const you = (x, z, swinging = null, extra = {}) => ({ pos: [x, z], swinging, ...extra });
// frame after frame until `until` says so (or `n` frames): each frame's step out
function run(d, y, rng, { n = 600, until = () => false, walk = true } = {}) {
  const outs = [];
  for (let i = 0; i < n; i++) {
    const out = duelStep(d, typeof y === 'function' ? y(i) : y, DT, rng);
    outs.push(out);
    // (it moves as it says it does, at 2 m/s)
    if (walk) {
      d.at[0] += out.move[0] * 2 * DT;
      d.at[1] += out.move[1] * 2 * DT;
    }
    if (until(out)) break;
  }
  return outs;
}

describe('a duellist from 10 m', () => {
  it('approaches, circles at reach, then attacks with a stroke from its table', () => {
    const d = createDuellist({ reach: 2.2, strokes: ['sword.light.a', 'sword.light.b'] });
    d.at = [0, 0];
    const outs = run(d, you(0, 10), seeded(), { until: (o) => o.state === 'attack' });
    const states = outs.map((o) => o.state).filter((s, i, a) => s !== a[i - 1]);
    expect(states).toEqual(['approach', 'circle', 'attack']);
    // closing, it went at you; at the stroke it was in reach
    expect(outs[0].move[1]).toBeGreaterThan(0.9);
    expect(Math.hypot(d.at[0], d.at[1] - 10)).toBeLessThan(2.2 * 1.6);
    const last = outs.at(-1);
    expect(last.stroke).toBe('sword.light.a');
    expect(last.begin).toBe(true);
    expect(last.face).toBeCloseTo(Math.atan2(0 - d.at[0], 10 - d.at[1]));
  });

  it('circles round you, not into you', () => {
    const d = createDuellist({ reach: 2.2 });
    d.at = [0, 7.8];
    const outs = run(d, you(0, 10), seeded(3), { n: 5 });
    expect(outs.at(-1).state).toBe('circle');
    // (sideways: across the line to you more than along it)
    expect(Math.abs(outs.at(-1).move[0])).toBeGreaterThan(Math.abs(outs.at(-1).move[1]));
  });

  it('takes the strokes in turn, and holds an attack as long as its clip says', () => {
    const d = createDuellist({ reach: 2.2, strokes: ['a', 'b'] });
    d.at = [0, 8];
    const first = run(d, you(0, 10), always(0.99), { until: (o) => o.begin });
    expect(first.at(-1).stroke).toBe('a');
    swung(d, 1.5);
    const held = run(d, you(0, 10), always(0.99), { n: 40, walk: false });
    expect(held.every((o) => o.state === 'attack' && o.stroke === 'a' && !o.begin)).toBe(true);
    const next = run(d, you(0, 10), always(0.99), { until: (o) => o.begin });
    expect(next.map((o) => o.state)).toContain('recover');
    expect(next.at(-1).stroke).toBe('b');
  });

  it('is the same duellist for the same seed', () => {
    const go = () => {
      const d = createDuellist({ reach: 2.2, seed: 42 });
      d.at = [3, -4];
      return run(d, (i) => you(Math.sin(i / 20) * 3, 6, i % 90 > 60 ? { contact: [0.3, 0.5], t: (i % 90 - 60) / 30 } : null)).map((o) => o.state + o.stroke + o.block).join();
    };
    expect(go()).toBe(go());
  });
});

describe('your stroke at it', () => {
  // it circling at reach, your stroke starting now (`lead` seconds to its contact)
  const circling = (rates) => {
    const d = createDuellist({ reach: 2.2, ...rates });
    d.at = [0, 8];
    run(d, you(0, 10), always(0.99), { until: (o) => o.state === 'circle' });
    return d;
  };
  const swing = (t, contact = [0.4, 0.6]) => ({ contact, t });

  it('blocks when the roll beats its guard, held through your contact and let down after', () => {
    const d = circling({ guard: 0.6 });
    const a = duelStep(d, you(0, 10, swing(0)), DT, always(0.5));
    expect(a.state).toBe('block');
    expect(a.block).toBe(true);
    expect(guarding(d)).toBe('block');
    expect(duelStep(d, you(0, 10, swing(0.55)), DT, always(0.5)).block).toBe(true);
    const after = duelStep(d, you(0, 10, swing(0.7)), DT, always(0.5));
    expect(after.block).toBe(false);
    expect(guarding(d)).toBe(null);
  });

  it('lets it through when the roll doesn’t beat its guard', () => {
    const d = circling({ guard: 0.6 });
    const a = duelStep(d, you(0, 10, swing(0)), DT, always(0.7));
    expect(a.block).toBe(false);
    expect(guarding(d)).toBe(null);
  });

  it('never blocks a stroke from out of reach', () => {
    const d = circling({ guard: 1 });
    expect(duelStep(d, you(0, 20, swing(0)), DT, always(0)).block).toBe(false);
  });

  it('holds its block for a strike whose query would reach it, and not for one that wouldn’t (the engine’s say)', () => {
    const a = circling({ guard: 1 });
    expect(duelStep(a, you(0, 10, { ...swing(0), reaches: true }), DT, always(0)).block).toBe(true);
    const b = circling({ guard: 1 });
    expect(duelStep(b, you(0, 10, { ...swing(0), reaches: false }), DT, always(0)).block).toBe(false);
  });

  it('can’t hold it with its stamina spent, and lets it down when it goes', () => {
    const a = circling({ guard: 1 });
    expect(duelStep(a, you(0, 10, swing(0), { tired: true }), DT, always(0)).block).toBe(false);
    const b = circling({ guard: 1 });
    expect(duelStep(b, you(0, 10, swing(0)), DT, always(0)).block).toBe(true);
    expect(duelStep(b, you(0, 10, swing(0.2), { tired: true }), DT, always(0)).block).toBe(false);
  });

  it('comes at you at once when your stamina’s spent', () => {
    const d = circling({ guard: 0 });
    const out = duelStep(d, you(0, 10, null, { out: true }), DT, always(0.99));
    expect(out.state).toBe('attack');
    expect(out.begin).toBe(true);
  });

  it('doesn’t block mid-stroke: it’s committed', () => {
    const d = createDuellist({ reach: 2.2, guard: 1 });
    d.at = [0, 8];
    run(d, you(0, 10), always(0.99), { until: (o) => o.begin });
    expect(duelStep(d, you(0, 10, swing(0)), DT, always(0)).state).toBe('attack');
  });
});

describe('what you do to it', () => {
  const attacking = () => {
    const d = createDuellist({ reach: 2.2 });
    d.at = [0, 8];
    run(d, you(0, 10), always(0.99), { until: (o) => o.begin });
    return d;
  };

  it('its block broken at no stamina, it reels the rulebook’s time', () => {
    const d = attacking();
    onGuardBroken(d);
    const n = Math.round(DUEL.stagger.broken / DT);
    const outs = run(d, you(0, 10), always(0.99), { n: n + 2, walk: false });
    expect(outs[n - 2].state).toBe('stagger');
    expect(outs.at(-1).state).not.toBe('stagger');
  });

  it('a heavy hit stops its stroke; a light one doesn’t', () => {
    const d = attacking();
    onHit(d, {});
    expect(duelStep(d, you(0, 10), DT, always(0.99)).state).toBe('attack');
    onHit(d, { heavy: true });
    const out = duelStep(d, you(0, 10), DT, always(0.99));
    expect(out.state).toBe('stagger');
    expect(out.stroke).toBe(null);
  });

  it('shoved or struck hard, it reels as long as it’s told and its stroke stops', () => {
    const d = attacking();
    onStagger(d, 1.4);
    const outs = run(d, you(0, 10), always(0.99), { n: Math.round(1.4 / DT) + 2, walk: false });
    expect(outs[0]).toMatchObject({ state: 'stagger', stroke: null });
    expect(outs[Math.round(1.4 / DT) - 2].state).toBe('stagger');
    expect(outs.at(-1).state).not.toBe('stagger');
  });

  it('dead, it stays dead', () => {
    const d = attacking();
    onHit(d, { dead: true });
    const outs = run(d, you(0, 10), always(0), { n: 30 });
    expect(outs.every((o) => o.state === 'dead' && !o.stroke && !o.block && o.move[0] === 0 && o.move[1] === 0)).toBe(true);
  });
});

// Review Focus 5: a target gone mid-combo isn't swung at for the rest of the clip
describe('a target lost mid-attack', () => {
  const attacking = () => {
    const d = createDuellist({ reach: 2.2 });
    d.at = [0, 8];
    run(d, you(0, 10), always(0.99), { until: (o) => o.begin });
    swung(d, 1.2);
    return d;
  };

  it('dead: back to approach, the stroke dropped', () => {
    const d = attacking();
    const out = duelStep(d, you(0, 10, null, { dead: true }), DT, always(0.99));
    expect(out.state).toBe('approach');
    expect(out.stroke).toBe(null);
    expect(out.move).toEqual([0, 0]);
  });

  it('gone 20 m in a frame: back to approach, the stroke dropped', () => {
    const d = attacking();
    const out = duelStep(d, you(0, 30), DT, always(0.99));
    expect(out.state).toBe('approach');
    expect(out.stroke).toBe(null);
    // (and it goes after you)
    expect(out.move[1]).toBeGreaterThan(0.9);
  });

  it('gone altogether (nobody there): approach, standing', () => {
    const d = attacking();
    const out = duelStep(d, null, DT, always(0.99));
    expect(out.state).toBe('approach');
    expect(out.stroke).toBe(null);
  });

  it('a step back isn’t gone: the stroke goes on', () => {
    const d = attacking();
    expect(duelStep(d, you(0, 11), DT, always(0.99)).stroke).not.toBe(null);
  });
});

describe('a duellist at the game’s cadence', () => {
  const cadence = { 'A_Luke_AttackLoop_Strike1': { dur: 1.6, back: 1.667 }, 'A_Luke_AttackLoop_Strike2': { dur: 1.667, back: 0.9 } };

  it('holds a stroke as long as the game’s strike, and is open for its return’s length after', () => {
    const d = createDuellist({ reach: 2.2, strokes: Object.keys(cadence), cadence });
    d.at = [0, 0];
    // (no combo roll comes up: 0.99 beats nothing)
    const outs = run(d, you(0, 2), always(0.99), { until: (o) => o.state === 'recover', walk: false });
    const begun = outs.findIndex((o) => o.begin);
    expect(outs[begun].stroke).toBe('A_Luke_AttackLoop_Strike1');
    expect((outs.length - 1 - begun) * DT).toBeCloseTo(1.6, 1);
    expect(d.state).toBe('recover');
    // (the frame it goes into recovery counts toward it)
    expect(d.timer + DT).toBeCloseTo(1.667, 5);
  });

  it('keeps the game’s strike length when the saber says the whole clip runs longer', () => {
    const d = createDuellist({ reach: 2.2, strokes: Object.keys(cadence), cadence });
    d.at = [0, 0];
    run(d, you(0, 2), always(0.99), { until: (o) => o.begin, walk: false });
    swung(d, 4.8);
    expect(d.timer).toBe(1.6);
  });

  it('keeps the site’s own recovery without one', () => {
    const d = createDuellist({ reach: 2.2 });
    d.at = [0, 0];
    run(d, you(0, 2), always(0.99), { until: (o) => o.state === 'recover', walk: false });
    expect(d.timer).toBeGreaterThanOrEqual(DUEL.recover[0] - DT);
    expect(d.timer).toBeLessThanOrEqual(DUEL.recover[1]);
  });
});

import { describe, expect, it } from 'vitest';
import { feed, nextQuest, questsOf, start, stepTarget, stepText } from './quests';

const QUEST = {
  id: 'droids',
  name: 'Lost droids',
  steps: [
    { type: 'talk', actor: 'trader', text: 'Talk to the Jawa' },
    { type: 'collect', item: 'droid', n: 3, spots: [[0, 0], [5, 5], [9, 9]], text: 'Find the droids' },
    { type: 'reach', at: [100, 0], r: 5, text: 'Bring them back' },
  ],
};

const run = (p, events, q = QUEST) => {
  const out = [];
  for (const e of events) {
    const r = feed(p, q, e);
    p = r.progress;
    out.push(...r.out);
  }
  return { p, out };
};

describe('a quest', () => {
  it('goes step by step, counting what it counts, to the end', () => {
    let { p, out } = run(start(QUEST), [{ type: 'talk', actor: 'someone else' }]);
    expect(p.step).toBe(0);
    expect(out).toEqual([]);
    ({ p, out } = run(p, [{ type: 'talk', actor: 'trader' }]));
    expect(p.step).toBe(1);
    expect(out).toEqual([{ type: 'step', step: 1 }]);
    expect(stepText(QUEST, p)).toBe('Find the droids (0/3)');
    ({ p, out } = run(p, [{ type: 'pickup', item: 'droid' }, { type: 'pickup', item: 'rock' }, { type: 'pickup', item: 'droid' }]));
    expect(p.count).toBe(2);
    expect(stepText(QUEST, p)).toBe('Find the droids (2/3)');
    ({ p, out } = run(p, [{ type: 'pickup', item: 'droid' }]));
    expect(p.step).toBe(2);
    expect(stepTarget(QUEST.steps[p.step], p)).toEqual([100, 0]);
    ({ p, out } = run(p, [{ type: 'at', x: 50, z: 0 }]));
    expect(p.step).toBe(2);
    ({ p, out } = run(p, [{ type: 'at', x: 97, z: 1 }]));
    expect(p).toBeNull();
    expect(out).toEqual([{ type: 'done' }]);
  });

  it('runs a race gate by gate, in order, riding what it says, against the clock', () => {
    const race = { id: 'canyon', steps: [{ type: 'race', ride: 'landspeeder', gates: [[0, 50], [0, 100]], r: 6, time: 20, text: 'Beggar’s Canyon' }] };
    let { p } = run(start(race), [{ type: 'at', x: 0, z: 100, riding: 'landspeeder' }], race);
    expect(p.count).toBe(0); // (the second gate first doesn't count)
    ({ p } = run(p, [{ type: 'at', x: 0, z: 50, riding: null }], race));
    expect(p.count).toBe(0); // (on foot doesn't either)
    ({ p } = run(p, [{ type: 'at', x: 1, z: 49, riding: 'landspeeder' }], race));
    expect(p.count).toBe(1);
    expect(stepTarget(race.steps[0], p)).toEqual([0, 100]);
    // too slow: back to the first gate
    const slow = run(p, [{ type: 'tick', dt: 25 }], race);
    expect(slow.out).toEqual([{ type: 'fail', why: 'time' }]);
    expect(slow.p.count).toBe(0);
    const { p: end, out } = run(p, [{ type: 'tick', dt: 5 }, { type: 'at', x: 0, z: 101, riding: 'landspeeder' }], race);
    expect(end).toBeNull();
    expect(out.at(-1)).toEqual({ type: 'done' });
  });

  it('ignores what isn’t its own', () => {
    const p = start(QUEST);
    expect(feed(p, { ...QUEST, id: 'other' }, { type: 'talk', actor: 'trader' }).progress).toBe(p);
    expect(feed(null, QUEST, { type: 'talk', actor: 'trader' }).progress).toBeNull();
  });
});

describe('someone with more than one thing to ask', () => {
  it('offers the first not done, then the next', () => {
    const spec = { quest: ['lift', 'cave'] };
    expect(nextQuest(spec, new Set())).toBe('lift');
    expect(nextQuest(spec, new Set(['lift']))).toBe('cave');
    expect(nextQuest(spec, new Set(['lift', 'cave']))).toBe(null);
    expect(nextQuest({ quest: 'arena' }, new Set())).toBe('arena');
    expect(nextQuest({}, new Set())).toBe(null);
    expect(questsOf({ quest: 'arena' })).toEqual(['arena']);
  });
});

import { describe, expect, it } from 'vitest';
import { LANES, SONG, TUNING, chartOf, inView, newRhythm, stepRhythm } from './rhythm';

const DT = 1 / 60;
const run = (brain, max = 60 * 60) => {
  let g = newRhythm();
  const events = [];
  let top = g.heads;
  for (let i = 0; i < max && g.phase === 'play'; i++) {
    g = stepRhythm(g, brain(g, i), DT);
    events.push(...g.events);
    top = Math.max(top, g.heads);
  }
  return { g, events, top };
};
// a player who hits each note on the step nearest its time (the step's press is judged at its end), skipping the ones `skip` says
const player = (skip = () => false) => (g) => {
  const t = g.t + DT;
  const n = g.notes.find((o) => !o.hit && Math.abs(o.t - t) <= DT / 2 + 1e-9);
  return n && !skip(n) ? { hit: n.lane } : {};
};
const careful = player();
const sleeper = () => ({});
// one who presses a lane every step, round and round
const masher = (g, i) => ({ hit: i % LANES });
// the song's state with its clock at `t`, the notes before it played
const at = (t) => {
  const g = newRhythm();
  return { ...g, t, notes: g.notes.map((n) => (n.t < t - TUNING.good ? { ...n, hit: 'great' } : n)) };
};

describe('the rhythm kind: four lanes on the beat, the heads’ meter up to the end', () => {
  it('charts the song: sixteen bars of eighths after the lead, in four lanes, the last note at 33 s', () => {
    expect(SONG).toHaveLength(16);
    for (const bar of SONG) expect(bar).toMatch(/^[0-3.]{8}$/);
    const chart = chartOf();
    expect(chart).toHaveLength(56);
    expect(new Set(chart.map((n) => n.id)).size).toBe(56);
    for (const n of chart) {
      expect([0, 1, 2, 3]).toContain(n.lane);
      const eighths = (n.t - TUNING.lead) / (30 / TUNING.bpm);
      expect(eighths).toBeCloseTo(Math.round(eighths), 9);
    }
    expect(chart.map((n) => n.t)).toEqual([...chart.map((n) => n.t)].sort((a, b) => a - b));
    expect(chart[0]).toMatchObject({ t: TUNING.lead, lane: 0 });
    expect(chart.at(-1).t).toBeCloseTo(33, 9);
    expect(newRhythm()).toMatchObject({ phase: 'play', t: 0, heads: TUNING.heads, streak: 0, hits: 0, misses: 0, beat: 0, last: null, events: [] });
    expect(newRhythm().notes.every((n) => n.hit === null)).toBe(true);
  });

  it('hits a note pressed in its lane inside its window: great close, good a little off, and a whiff outside it', () => {
    const first = newRhythm().notes[0];
    const great = stepRhythm(at(first.t - 0.03), { hit: first.lane }, 0);
    expect(great.notes[0].hit).toBe('great');
    expect(great).toMatchObject({ heads: TUNING.heads + TUNING.gain.great, hits: 1, streak: 1, last: 'great' });
    expect(great.events).toContainEqual({ type: 'hit', id: first.id, lane: first.lane, grade: 'great' });
    const good = stepRhythm(at(first.t + 0.1), { hit: first.lane }, 0);
    expect(good.notes[0].hit).toBe('good');
    expect(good.heads).toBeCloseTo(TUNING.heads + TUNING.gain.good, 9);
    const wild = stepRhythm(at(first.t - 0.2), { hit: first.lane }, 0);
    expect(wild.notes[0].hit).toBe(null);
    expect(wild).toMatchObject({ hits: 0, streak: 0, last: 'whiff' });
    expect(wild.heads).toBeCloseTo(TUNING.heads - TUNING.cost.whiff, 9);
    expect(wild.events).toContainEqual({ type: 'whiff', lane: first.lane });
  });

  it('calls a note let past a miss, and it costs the heads more than a whiff', () => {
    const first = newRhythm().notes[0];
    const g = stepRhythm(at(first.t + TUNING.good - 0.01), {}, 0.02);
    expect(g.notes[0].hit).toBe('miss');
    expect(g).toMatchObject({ misses: 1, last: 'miss' });
    expect(g.heads).toBeCloseTo(TUNING.heads - TUNING.cost.miss, 9);
    expect(g.events).toContainEqual({ type: 'miss', id: first.id, lane: first.lane });
    expect(TUNING.cost.miss).toBeGreaterThan(TUNING.cost.whiff);
  });

  it('hits one note with one press, the nearest in its own lane', () => {
    // (the hook's two notes a quaver apart in the second lane)
    const notes = newRhythm().notes;
    const i = notes.findIndex((n, k) => n.lane === notes[k + 1]?.lane && notes[k + 1].t - n.t < 0.3);
    const [a, b] = [notes[i], notes[i + 1]];
    // (both in reach, the first the nearer: it's hit, and the second's left to come)
    const g = stepRhythm(at(a.t + 0.122), { hit: a.lane }, 0);
    expect(Math.abs(b.t - (a.t + 0.122))).toBeLessThanOrEqual(TUNING.good);
    expect(g.notes[i].hit).toBe('good');
    expect(g.notes[i + 1].hit).toBe(null);
    expect(g.hits).toBe(1);
    // (and a press in another lane hits neither)
    const other = stepRhythm(at(a.t), { hit: (a.lane + 1) % LANES }, 0);
    expect([other.notes[i].hit, other.notes[i + 1].hit]).toEqual([null, null]);
    expect(other.last).toBe('whiff');
  });

  it('keeps the heads between empty and full', () => {
    const won = run(careful);
    expect(won.top).toBeLessThanOrEqual(1);
    expect(won.g.heads).toBe(1);
    expect(run(sleeper).g.heads).toBe(0);
  });

  it('is won by a careful player, and by one who hits two notes in three', () => {
    for (const brain of [careful, player((n) => n.id % 3 === 2)]) {
      const { g, events } = run(brain);
      expect(g.phase).toBe('won');
      expect(g.notes.every((n) => n.hit)).toBe(true);
      expect(events.filter((e) => e.type === 'won')).toHaveLength(1);
    }
  });

  it('is lost by a sleeper, by one who hits half the notes, and by mashing every lane', () => {
    for (const brain of [sleeper, player((n) => n.id % 2 === 1), masher]) expect(run(brain).g.phase).toBe('lost');
  });

  it('is lost the moment the heads empty, once, and nothing changes after', () => {
    const { g, events } = run(sleeper);
    expect(g).toMatchObject({ phase: 'lost', heads: 0 });
    expect(events.filter((e) => e.type === 'lost')).toEqual([{ type: 'lost' }]);
    expect(stepRhythm(g, { hit: 0 }, 1)).toEqual({ ...g, events: [] });
    const won = run(careful).g;
    expect(stepRhythm(won, { hit: 0 }, 1)).toEqual({ ...won, events: [] });
  });

  it('is lost when the heads come to empty by sums that leave a floating-point crumb', () => {
    // (two greats, six notes let past, then wild swings: 0.5 + 0.1 − 0.48 is 0.12000000000000006, not 0.12)
    let g = { ...at(9.3), heads: 0.12000000000000006 };
    const empty = 2; // (no note in the third lane near 9.3 s)
    for (let k = 0; k < 4 && g.phase === 'play'; k++) g = stepRhythm(g, { hit: empty }, 0);
    expect(g).toMatchObject({ phase: 'lost', heads: 0 });
  });

  it('counts a long frame as a tenth of a second at most', () => {
    expect(stepRhythm(newRhythm(), {}, 5).t).toBeCloseTo(0.1, 9);
  });

  it('ticks the beats as they pass', () => {
    const { events } = run(sleeper, Math.round(1.1 / DT));
    expect(events.filter((e) => e.type === 'beat')).toEqual([
      { type: 'beat', n: 1 },
      { type: 'beat', n: 2 },
    ]);
  });

  it('takes perks and, until the shop decides what they do here, reads none', () => {
    expect(newRhythm({ perks: { slow: 2 } })).toEqual(newRhythm());
  });

  it('puts the notes in view where they are down their lanes', () => {
    const [first, second] = newRhythm().notes;
    const on = inView(at(first.t));
    expect(on).toContainEqual({ id: first.id, lane: first.lane, y: 1 });
    const ahead = inView(at(second.t - TUNING.fall)).find((n) => n.id === second.id);
    expect(ahead.y).toBeCloseTo(0, 9);
    expect(inView(at(first.t - TUNING.fall - 0.1)).find((n) => n.id === first.id)).toBe(undefined);
    const hit = stepRhythm(at(first.t), { hit: first.lane }, 0);
    expect(inView(hit).find((n) => n.id === first.id)).toBe(undefined);
  });
});

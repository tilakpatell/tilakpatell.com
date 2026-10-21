import { describe, expect, it } from 'vitest';
import { ASK_AT, ASK_WAIT, BEATS, END, PARTS, SKIP_TO, answerRide, canSkip, newRide, noInput, rideAt, skipRide, stepRide } from './arrival';
import { LINES } from './lines';
import { hatPicks } from './sorting';

// the ride played with nobody touching anything, a tenth of a second a step
function play(ride, { answer = null, limit = 600 } = {}) {
  const all = [];
  let r = ride;
  let t = 0;
  while (!r.done && t < limit) {
    const s = stepRide(r, 0.1);
    r = s.ride;
    all.push(...s.events);
    t += 0.1;
    // (each answer puts the next question: answered as it comes)
    let asked = s.events.find((e) => e.type === 'ask');
    while (asked && answer) {
      const a = answerRide(r, answer(asked.q));
      r = a.ride;
      all.push(...a.events);
      asked = a.events.find((e) => e.type === 'ask');
    }
  }
  return { ride: r, events: all, seconds: t };
}

describe('the arrival’s clock', () => {
  it('runs its beats in order through the four parts', () => {
    for (let i = 1; i < BEATS.length; i++) expect(BEATS[i].at).toBeGreaterThan(BEATS[i - 1].at);
    expect(new Set(BEATS.map((b) => b.id)).size).toBe(BEATS.length);
    expect([...new Set(BEATS.map((b) => b.part))]).toEqual(PARTS);
    for (const b of BEATS) for (const l of b.lines) expect(LINES[l.who]?.[l.key], `${b.id}: ${l.who}.${l.key}`).toBeTruthy();
  });

  it('takes three to four minutes with no input', () => {
    expect(noInput()).toBeGreaterThanOrEqual(180);
    expect(noInput()).toBeLessThanOrEqual(240);
    const { ride, seconds, events } = play(newRide({ seed: 9 }));
    expect(ride.done).toBe(true);
    expect(seconds).toBeGreaterThanOrEqual(180);
    expect(seconds).toBeLessThanOrEqual(241);
    // every beat opened once, every line said once, the Hat answered all three
    expect(events.filter((e) => e.type === 'beat').map((e) => e.id)).toEqual(BEATS.map((b) => b.id));
    expect(events.filter((e) => e.type === 'answer').map((e) => e.by)).toEqual(['hat', 'hat', 'hat']);
    expect(events.filter((e) => e.type === 'line' && e.key === 'silent')).toHaveLength(1);
    expect(events.at(-1).type).toBe('end');
  });

  it('holds at the Hat until the three questions are answered', () => {
    let r = newRide({ at: 'hat' });
    let asked = null;
    for (let i = 0; i < 60 && asked == null; i++) {
      const s = stepRide(r, 0.1);
      r = s.ride;
      asked = s.events.find((e) => e.type === 'ask')?.q ?? null;
    }
    expect(asked).toBe(0);
    expect(r.t).toBe(ASK_AT);
    // (held: time passes, the line doesn’t)
    r = stepRide(r, 5).ride;
    expect(r.t).toBe(ASK_AT);
    let s = answerRide(r, 2);
    expect(s.events).toEqual([{ type: 'answer', q: 0, a: 2, by: 'you' }, { type: 'ask', q: 1 }]);
    s = answerRide(s.ride, 0);
    s = answerRide(s.ride, 3);
    expect(s.events.at(-1)).toEqual({ type: 'sort', answers: [2, 0, 3] });
    // then on to the house and the feast
    const rest = play(s.ride);
    expect(rest.events.filter((e) => e.type === 'beat').map((e) => e.id)).toEqual(['house', 'feast']);
    expect(rest.ride.done).toBe(true);
  });

  it('lets the Hat answer for a silent visitor after a while, the same each time for a seed', () => {
    const r = { ...newRide({ at: 'hat', seed: 77 }), t: ASK_AT, asking: 0, fresh: false };
    expect(stepRide(r, ASK_WAIT - 0.5).events).toEqual([]);
    const s = stepRide(stepRide(r, ASK_WAIT - 0.5).ride, 1);
    expect(s.events).toContainEqual({ type: 'answer', q: 0, a: hatPicks(77, 0), by: 'hat' });
  });

  it('opens at the hall for ?at=hall, and at any beat or part by its name', () => {
    expect(rideAt('hall')).toBe(BEATS.find((b) => b.id === 'hall').at);
    expect(rideAt('boats')).toBe(BEATS.find((b) => b.id === 'pushoff').at);
    expect(rideAt('nowhere')).toBe(0);
    const first = stepRide(newRide({ at: 'hall' }), 0.1);
    expect(first.events[0]).toEqual({ type: 'beat', id: 'hall', part: 'hall' });
  });

  it('skips to the steps on Enter, but only once the arrival has been seen', () => {
    const r = newRide();
    expect(canSkip(r, 0)).toBe(false);
    expect(canSkip(r, 1)).toBe(true);
    const s = skipRide(r);
    expect(s.ride.t).toBe(BEATS.find((b) => b.id === SKIP_TO).at);
    expect(s.events[0]).toEqual({ type: 'beat', id: 'boathouse', part: 'steps' });
    // (Hagrid’s word a second in, as the boats bump the jetty)
    expect(stepRide(s.ride, 1.5).events).toContainEqual({ type: 'line', who: 'hagrid', key: 'steps' });
    // (past the steps there is nothing to skip to)
    expect(canSkip(s.ride, 1)).toBe(false);
  });

  it('ends at END and says nothing more', () => {
    const { ride } = play(newRide({ at: 'feast' }));
    expect(ride.t).toBe(END);
    expect(stepRide(ride, 1).events).toEqual([]);
  });

  it('ignores an answer out of turn or out of range', () => {
    const r = newRide();
    expect(answerRide(r, 1).events).toEqual([]);
    const asking = { ...r, asking: 0 };
    expect(answerRide(asking, 7).events).toEqual([]);
    expect(answerRide(asking, 1.5).events).toEqual([]);
  });

  it('plays the whole ride with quick answers in about three minutes and a half', () => {
    const { seconds, events } = play(newRide(), { answer: () => 1 });
    expect(events.filter((e) => e.type === 'answer').every((e) => e.by === 'you')).toBe(true);
    expect(seconds).toBeGreaterThan(180);
    expect(seconds).toBeLessThan(200);
  });
});

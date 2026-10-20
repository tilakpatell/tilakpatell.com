import { describe, expect, it } from 'vitest';
import { TUNING, freezeEyes, freezeNews, freezeReadout, jumpSplashes, moving, newFreeze, stepFreeze, takesJump } from './freeze';

const DT = 0.05;
// `s` seconds of steps with this input, the events gathered
const hold = (g, s, input = {}) => {
  const seen = [];
  for (let i = 0; i < Math.round(s / DT); i++) {
    g = stepFreeze(g, input, DT);
    seen.push(...g.events);
  }
  return { g, seen };
};
const started = () => stepFreeze(newFreeze(), { moving: true }, DT);

describe('the freeze kind: play dead while the buyers look', () => {
  it('waits, nobody looking, till Morty first moves', () => {
    const { g } = hold(newFreeze(), 5);
    expect(g).toMatchObject({ phase: 'idle', eyes: null, told: false });
    expect(freezeEyes(g)).toBe(null);
    expect(freezeReadout(g)).toEqual({ on: false, vitals: null, line: '' });
  });

  it('starts at Morty’s first step, their backs turned', () => {
    const g = started();
    expect(g).toMatchObject({ phase: 'run', eyes: 'away', left: TUNING.away[0], len: TUNING.away[0], beat: 0 });
    expect(g.events).toEqual([{ type: 'start' }]);
  });

  it('turns them round by turns: backs, a turn, a look, backs again', () => {
    let g = started();
    const beats = [];
    for (let i = 0; i < 400; i++) {
      const was = g.eyes;
      g = stepFreeze(g, {}, DT);
      if (g.eyes !== was) beats.push([g.eyes, g.len]);
    }
    expect(beats.slice(0, 6)).toEqual([
      ['turn', TUNING.turn],
      ['look', TUNING.look[0]],
      ['away', TUNING.away[1]],
      ['turn', TUNING.turn],
      ['look', TUNING.look[1]],
      ['away', TUNING.away[2]],
    ]);
  });

  it('lets him move while their backs are turned and while they turn, and catches him moving while they look, once', () => {
    let g = hold(started(), TUNING.away[0] - 0.2, { moving: true }).g;
    expect(g).toMatchObject({ phase: 'run', eyes: 'away' });
    g = hold(g, 0.4, { moving: true }).g; // (into the turn)
    expect(g).toMatchObject({ phase: 'run', eyes: 'turn' });
    g = hold(g, TUNING.turn, {}).g; // (still, into the look)
    expect(g.eyes).toBe('look');
    const caught = stepFreeze(g, { moving: true }, DT);
    expect(caught.phase).toBe('lost');
    expect(caught.events).toEqual([{ type: 'lost', why: 'moved' }]);
    expect(stepFreeze(caught, { moving: true }, DT).events).toEqual([]);
    expect(freezeEyes(caught)).toBe('seen');
  });

  it('takes him into the vat behind their backs, and catches a jump at any other time', () => {
    const into = stepFreeze(started(), { jumped: true }, DT);
    expect(into).toMatchObject({ phase: 'in', eyes: 'in', left: TUNING.hold, len: TUNING.hold });
    expect(into.events).toEqual([{ type: 'in' }]);
    expect(stepFreeze(newFreeze(), { jumped: true }, DT).events).toEqual([{ type: 'lost', why: 'jumped' }]);
    const turning = hold(started(), TUNING.away[0] + 0.1).g;
    expect(turning.eyes).toBe('turn');
    expect(stepFreeze(turning, { jumped: true }, DT).phase).toBe('lost');
    const looking = hold(turning, TUNING.turn).g;
    expect(looking.eyes).toBe('look');
    expect(stepFreeze(looking, { jumped: true }, DT).events).toEqual([{ type: 'lost', why: 'jumped' }]);
    // (in already, the vat used again is nothing)
    expect(stepFreeze(into, { jumped: true }, DT)).toMatchObject({ phase: 'in', events: [] });
  });

  it('says whether a jump now would take him in (so the vat splashes only for one)', () => {
    expect(takesJump(started())).toBe(true);
    expect(takesJump(newFreeze())).toBe(false);
    expect(takesJump(hold(started(), TUNING.away[0] + 0.1).g)).toBe(false); // (turning)
    expect(takesJump(stepFreeze(started(), { jumped: true }, DT))).toBe(false); // (in already)
    expect(takesJump(null)).toBe(false);
  });

  it('splashes the vat for a jump that takes him in, and for any jump once the death’s been faked', () => {
    expect(jumpSplashes(started(), { done: false })).toBe(true);
    expect(jumpSplashes(hold(started(), TUNING.away[0] + 0.1).g, { done: false })).toBe(false); // (turning: a catch, no splash)
    expect(jumpSplashes(newFreeze(), { done: false })).toBe(false);
    // (its task done: the game's idle, and the vat's just a vat to jump in)
    expect(jumpSplashes(newFreeze(), { done: true })).toBe(true);
  });

  it('gives him a moment to settle in the vat before it judges him', () => {
    const into = stepFreeze(started(), { jumped: true }, DT);
    const settling = hold(into, TUNING.settle - 0.1, { moving: true });
    expect(settling.g.phase).toBe('in');
    const caught = hold(settling.g, 0.2, { moving: true });
    expect(caught.g.phase).toBe('lost');
    expect(caught.seen).toEqual([{ type: 'lost', why: 'moved' }]);
  });

  it('is won once he’s played dead for the whole hold', () => {
    const into = stepFreeze(started(), { jumped: true }, DT);
    const { g, seen } = hold(into, TUNING.hold + DT);
    expect(g.phase).toBe('won');
    expect(seen.at(-1)).toEqual({ type: 'won' });
    expect(freezeEyes(g)).toBe(null);
  });

  it('counts a long frame as a tenth of a second at most', () => {
    const g = stepFreeze(started(), {}, 5);
    expect(g).toMatchObject({ eyes: 'away' });
    expect(g.left).toBeCloseTo(TUNING.away[0] - 0.1, 5);
  });

  it('changes nothing once it’s over', () => {
    const lost = { ...started(), phase: 'lost' };
    expect(stepFreeze(lost, { moving: true, jumped: true }, DT)).toEqual({ ...lost, events: [] });
  });

  it('knows Morty’s moving by his speed, or his being off the ground', () => {
    expect(moving({ speed: TUNING.still - 0.1, air: false })).toBe(false);
    expect(moving({ speed: TUNING.still + 0.1, air: false })).toBe(true);
    expect(moving({ speed: 0, air: true })).toBe(true);
    expect(moving(null)).toBe(false);
  });

  it('says where the buyers’ eyes are, for the figures', () => {
    expect(freezeEyes(started())).toBe('away');
    expect(freezeEyes(hold(started(), TUNING.away[0] + 0.1).g)).toBe('look'); // (turning)
    expect(freezeEyes(stepFreeze(started(), { jumped: true }, DT))).toBe('look'); // (peering into the vat)
    expect(freezeEyes(null)).toBe(null);
  });

  it('takes perks and, until the shop decides what they do here, reads none', () => {
    expect(newFreeze({ perks: { stun: 1 } })).toEqual(newFreeze());
  });

  it('tells the place what to say: the win till it’s kept, the loss once and not in a fade', () => {
    const won = { ...newFreeze(), phase: 'won' };
    expect(freezeNews(won, { done: false, fading: false })).toBe('done');
    expect(freezeNews(won, { done: true, fading: false })).toBe(null);
    const lost = { ...newFreeze(), phase: 'lost' };
    expect(freezeNews(lost, { done: false, fading: false })).toBe('caught');
    expect(freezeNews(lost, { done: false, fading: true })).toBe(null);
    expect(freezeNews({ ...lost, told: true }, { done: false, fading: false })).toBe(null);
    expect(freezeNews(newFreeze(), { done: false, fading: false })).toBe(null);
  });

  it('reads out for the HUD while it’s on: what the buyers are doing, and how long it lasts', () => {
    const g = started();
    expect(freezeReadout(g)).toEqual({ on: true, vitals: { value: 100, max: 100, low: false }, line: 'Their backs are turned: move' });
    const half = stepFreeze(g, {}, TUNING.away[0] / 2 > 0.1 ? 0.1 : TUNING.away[0] / 2);
    expect(freezeReadout(half).vitals.value).toBe(Math.round((half.left / half.len) * 100));
    expect(freezeReadout(hold(g, TUNING.away[0] + 0.1).g)).toMatchObject({ vitals: { low: true }, line: 'They’re turning round: stop' });
    expect(freezeReadout(hold(g, TUNING.away[0] + TUNING.turn + 0.1).g).line).toBe('They’re looking: keep still');
    expect(freezeReadout(stepFreeze(g, { jumped: true }, DT)).line).toBe('In the vat: play dead');
    expect(freezeReadout(null)).toEqual({ on: false, vitals: null, line: '' });
    for (const s of [0.1, TUNING.away[0] + 0.1, TUNING.away[0] + TUNING.turn + 0.1]) {
      const line = freezeReadout(hold(g, s).g).line;
      expect(line).not.toMatch(/!/);
      expect(line.split(/[.?]\s/)).toHaveLength(1);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { TENTACULA, WILLOW, limbAngles, nearestLimb, newWillow, stepWillow } from './willow';

const DT = 1 / 30;
// run the tree `seconds` with `you` where `where(t)` says, a knot knock at the times in `knocks`; every event, timed
function sim(seconds, where, { kind = WILLOW, knocks = [] } = {}) {
  let s = newWillow();
  const events = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const t = i * DT;
    const knot = knocks.some((k) => Math.abs(k - t) < DT / 2);
    s = stepWillow(s, DT, { you: where(t), knot }, kind);
    for (const e of s.ev) events.push({ ...e, t });
  }
  return { s, events };
}
const of = (events, type) => events.filter((e) => e.type === type);

describe('the Whomping Willow', () => {
  it('sways and never strikes at someone who stays out of its reach', () => {
    const { events } = sim(30, () => [0, WILLOW.reach + 0.5]);
    expect(of(events, 'strike')).toHaveLength(0);
  });

  it('winds up, strikes along the nearest limb and throws you clear by six metres, a point gone', () => {
    const you = [3, 8];
    const { events } = sim(2, () => you);
    const [wind] = of(events, 'windup');
    expect(wind.limb).toBe(nearestLimb(WILLOW, Math.atan2(you[0], you[1])));
    const [hit] = of(events, 'hit');
    expect(hit).toBeTruthy();
    expect(hit.t).toBeGreaterThan(WILLOW.windup);
    expect(hit.t).toBeLessThan(WILLOW.windup + WILLOW.strike + 0.1);
    expect(Math.hypot(...hit.throw)).toBeCloseTo(WILLOW.throw, 6);
    // (away from the trunk)
    expect(hit.throw[0] * you[0] + hit.throw[1] * you[1]).toBeGreaterThan(0);
    expect(hit.points).toBe(-1);
  });

  it('misses someone who dodges round the trunk while it winds up and strikes', () => {
    // standing on one side, then round the other once the limb has begun to come through
    const { events } = sim(1.5, (t) => (t < WILLOW.windup + 0.1 ? [0, 8] : [0, -8]));
    expect(of(events, 'strike')).toHaveLength(1);
    expect(of(events, 'miss')).toHaveLength(1);
    expect(of(events, 'hit')).toHaveLength(0);
  });

  it('rests between strikes: never two inside its rest', () => {
    const { events } = sim(20, () => [0, 6]);
    const strikes = of(events, 'strike').map((e) => e.t);
    expect(strikes.length).toBeGreaterThan(3);
    for (let i = 1; i < strikes.length; i++) expect(strikes[i] - strikes[i - 1]).toBeGreaterThanOrEqual(WILLOW.rest + WILLOW.windup - DT);
  });

  it('holds still ten seconds when its knot is struck, then wakes', () => {
    const { events } = sim(16, () => [0, 6], { knocks: [0.2] });
    const [frozen] = of(events, 'frozen');
    const [thawed] = of(events, 'thawed');
    expect(frozen.t).toBeCloseTo(0.2, 1);
    expect(thawed.t - frozen.t).toBeCloseTo(WILLOW.frozen, 1);
    expect(of(events, 'strike').filter((e) => e.t > frozen.t && e.t < thawed.t)).toHaveLength(0);
    expect(of(events, 'strike').some((e) => e.t > thawed.t)).toBe(true);
  });

  it('a knock in mid-swing stops the swing', () => {
    const { events } = sim(3, () => [0, 6], { knocks: [WILLOW.windup + 0.1] });
    expect(of(events, 'hit')).toHaveLength(0);
    expect(of(events, 'frozen')).toHaveLength(1);
  });

  it('a walker making for the trunk from thirty metres is struck before reaching it', () => {
    // walking in at a walk, straight at it
    const { events } = sim(20, (t) => [0, Math.max(1, 30 - 1.6 * t)]);
    expect(of(events, 'hit').length).toBeGreaterThan(0);
  });

  it('moves no limb while frozen, and the struck limb most while it strikes', () => {
    const frozen = { ...newWillow(), mode: 'frozen', frozen: 5 };
    expect(limbAngles(frozen, 3).every((a) => a.yaw === 0 && a.lift === 0)).toBe(true);
    const striking = { ...newWillow(), mode: 'strike', limb: 2, aim: WILLOW.limbs[2].yaw + 0.4, t: WILLOW.strike };
    const a = limbAngles(striking, 3);
    expect(Math.abs(a[2].yaw)).toBeGreaterThan(Math.max(...a.filter((_, i) => i !== 2).map((x) => Math.abs(x.yaw))));
  });
});

describe('the Venomous Tentacula', () => {
  it('snaps at you as you pass close, a nudge and no point lost', () => {
    const { events } = sim(4, (t) => [-6 + 3 * t, 1.5], { kind: TENTACULA });
    const hits = of(events, 'hit');
    expect(of(events, 'strike').length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(Math.hypot(...h.throw)).toBeCloseTo(TENTACULA.throw, 6);
      expect(h.points).toBe(0);
    }
  });

  it('leaves you be at the far side of the bench', () => {
    const { events } = sim(10, () => [0, TENTACULA.reach + 1], { kind: TENTACULA });
    expect(of(events, 'strike')).toHaveLength(0);
  });
});

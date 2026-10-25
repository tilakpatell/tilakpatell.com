import { describe, expect, it } from 'vitest';
import { AIM, trackNudge, aimAngles, assist, assistAmount, bearing, dirTo, edgeOf, intercept, nose, onScreen, sweptHit, track } from './targeting';

const ship = { x: 0, y: 0, z: 0, heading: 0, pitch: 0, speed: 0 }; // nose along −z
const hunter = (id, at, vel = [0, 0, 0]) => ({ id, at, vel, size: 0.3 });
// a lock followed for `seconds`, the same scene each step
const follow = (s, cands, lock, seconds, opts) => {
  for (let t = 0; t < seconds; t += 1 / 60) lock = track(s, cands, lock, 1 / 60, opts);
  return lock;
};

describe('the nose', () => {
  it('points along the heading, tipped by the pitch', () => {
    expect(nose(ship)).toEqual([-0, 0, -1]);
    const [x, y, z] = nose({ heading: Math.PI / 2, pitch: 0.5 });
    expect(x).toBeCloseTo(-Math.cos(0.5), 6);
    expect(y).toBeCloseTo(Math.sin(0.5), 6);
    expect(z).toBeCloseTo(0, 6);
  });

  it('measures how far something is off it', () => {
    expect(bearing(ship, [0, 0, -10]).off).toBeCloseTo(0, 6);
    expect(bearing(ship, [10, 0, 0]).off).toBeCloseTo(Math.PI / 2, 6);
    expect(bearing(ship, { x: 0, y: 0, z: 10 }).off).toBeCloseTo(Math.PI, 6);
    expect(bearing(ship, [3, 4, 0]).dist).toBe(5);
    expect(dirTo(ship, [0, 0, -7])).toEqual([0, 0, -1]);
  });
});

describe('the lock', () => {
  it('picks up the hunter nearest the nose, within range, and nothing far off it', () => {
    const near = hunter('a', [1, 0, -20]); // just off the nose
    const wide = hunter('b', [15, 0, -10]); // well off to the side
    const far = hunter('c', [0, 0, -(AIM.range + 10)]);
    expect(track(ship, [wide, near, far], null, 1 / 60)?.id).toBe('a');
    expect(track(ship, [wide], null, 1 / 60)).toBeNull();
    expect(track(ship, [far], null, 1 / 60)).toBeNull();
    expect(track(ship, [], null, 1 / 60)).toBeNull();
  });

  it('holds on while the target swings out past the pick-up cone, and drops it once it is well away', () => {
    const lock = track(ship, [hunter('a', [0, 0, -20])], null, 1 / 60);
    // out past the pick-up cone but inside the hold: kept
    const swung = hunter('a', [20 * Math.sin(0.6), 0, -20 * Math.cos(0.6)]);
    expect(track(ship, [swung], lock, 1 / 60)).toMatchObject({ id: 'a', out: 0 });
    expect(follow(ship, [swung], lock, 3)?.id).toBe('a'); // (for as long as there's nothing better ahead)
    expect(track(ship, [swung], null, 1 / 60)).toBeNull(); // (it would not be picked up from there)
    // behind: a moment's grace, then gone
    const behind = hunter('a', [0, 0, 20]);
    expect(track(ship, [behind], lock, 1 / 60)?.id).toBe('a');
    expect(follow(ship, [behind], lock, AIM.lose * 0.5)?.id).toBe('a');
    expect(follow(ship, [behind], lock, AIM.lose + 0.2)).toBeNull();
    // back in before the grace runs out: held, the clock reset
    const half = follow(ship, [behind], lock, AIM.lose * 0.5);
    expect(track(ship, [hunter('a', [0, 0, -20])], half, 1 / 60)).toEqual({ id: 'a', out: 0 });
  });

  it('lets go when the target is gone, and picks up another', () => {
    const lock = track(ship, [hunter('a', [0, 0, -20])], null, 1 / 60);
    expect(track(ship, [], lock, 1 / 60)).toBeNull();
    expect(track(ship, [hunter('b', [2, 0, -15])], lock, 1 / 60)?.id).toBe('b');
  });

  it('cycles round the hunters ahead, nearest the nose first', () => {
    const cands = [hunter('a', [0, 0, -20]), hunter('b', [5, 0, -20]), hunter('c', [-9, 0, -20]), hunter('d', [0, 0, 20])];
    let lock = track(ship, cands, null, 1 / 60);
    expect(lock.id).toBe('a');
    lock = track(ship, cands, lock, 1 / 60, { cycle: true });
    expect(lock.id).toBe('b');
    lock = track(ship, cands, lock, 1 / 60, { cycle: true });
    expect(lock.id).toBe('c');
    lock = track(ship, cands, lock, 1 / 60, { cycle: true }); // round again (never the one behind)
    expect(lock.id).toBe('a');
  });

  it('prefers the hunter coming at you over one as near the nose that is not', () => {
    const calm = { ...hunter('a', [1.5, 0, -20]) };
    const coming = { ...hunter('b', [-1.6, 0, -20]), threat: 1 };
    expect(track(ship, [calm, coming], null, 1 / 60)?.id).toBe('b');
  });

  it('moves straight on to the next one round the nose when its target goes down', () => {
    const lock = track(ship, [hunter('a', [0, 0, -20])], null, 1 / 60);
    // the next is out past the pick-up cone, but well inside the hold
    const next = hunter('b', [20 * Math.sin(0.6), 0, -20 * Math.cos(0.6)]);
    expect(track(ship, [next], lock, 1 / 60)?.id).toBe('b');
    // (a fresh look from nothing would not have picked it up)
    expect(track(ship, [next], null, 1 / 60)).toBeNull();
  });

  it('gives up one that has swung wide for another squarely ahead, after a moment', () => {
    const lock = track(ship, [hunter('a', [0, 0, -20])], null, 1 / 60);
    const swung = hunter('a', [20 * Math.sin(0.6), 0, -20 * Math.cos(0.6)]); // inside the hold, off the nose
    const ahead = hunter('b', [0.5, 0, -12]);
    // not at once (a dogfight swings about)
    expect(follow(ship, [swung, ahead], lock, AIM.swap * 0.5)?.id).toBe('a');
    expect(follow(ship, [swung, ahead], lock, AIM.swap + 0.1)).toEqual({ id: 'b', out: 0 });
    // and the same for one that's flown out of the bolts' reach, dead ahead
    const far = hunter('a', [0, 0, -(AIM.range + 8)]);
    expect(follow(ship, [far, ahead], lock, AIM.swap + 0.1)?.id).toBe('b');
    // back onto the nose in time: the moment starts over
    const nearly = follow(ship, [swung, ahead], lock, AIM.swap * 0.8);
    const back = track(ship, [hunter('a', [0, 0, -20]), ahead], nearly, 1 / 60);
    expect(back).toEqual({ id: 'a', out: 0 });
    // one picked by hand stays, whatever else is ahead
    expect(follow(ship, [swung, ahead], { id: 'a', out: 0, manual: true }, 3)).toEqual({ id: 'a', out: 0, manual: true });
  });

  it('holds a lock picked by hand for longer before letting it go', () => {
    const lock = { id: 'a', out: 0, manual: true };
    const behind = hunter('a', [0, 0, 20]);
    expect(follow(ship, [behind], lock, AIM.lose + 0.2)?.id).toBe('a');
    expect(follow(ship, [behind], lock, AIM.loseManual + 0.2)).toBeNull();
  });

  it('cycles the other way round too', () => {
    const cands = [hunter('a', [0, 0, -20]), hunter('b', [5, 0, -20]), hunter('c', [-9, 0, -20])];
    let lock = track(ship, cands, null, 1 / 60);
    lock = track(ship, cands, lock, 1 / 60, { cycle: -1 });
    expect(lock.id).toBe('c');
    lock = track(ship, cands, lock, 1 / 60, { cycle: -1 });
    expect(lock.id).toBe('b');
  });

  it('marks a lock moved on to by hand as picked by hand', () => {
    const cands = [hunter('a', [0, 0, -20]), hunter('b', [5, 0, -20])];
    const lock = track(ship, cands, track(ship, cands, null, 1 / 60), 1 / 60, { cycle: true });
    expect(lock).toMatchObject({ id: 'b', manual: true });
  });
});

describe('the guns', () => {
  it('reach well past where the hunters open fire (16 out)', () => {
    expect(AIM.bolt * AIM.life).toBeGreaterThan(30);
    expect(AIM.range).toBeGreaterThanOrEqual(AIM.bolt * AIM.life);
  });

  it('are fast enough to catch the quickest hunter crossing the nose, soon', () => {
    const p = intercept(ship, AIM.bolt, [0, 0, -20], [26, 0, 0]);
    expect(p).not.toBeNull();
    expect(p.t).toBeLessThan(AIM.life);
    // and the lead is a modest angle off the target, not a wild guess
    expect(Math.atan2(p.x, -p.z)).toBeLessThan(0.5);
  });
});

describe('the lead', () => {
  it('is the target itself when it sits still', () => {
    const p = intercept(ship, 20, [0, 0, -10], [0, 0, 0]);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.z).toBeCloseTo(-10, 6);
    expect(p.t).toBeCloseTo(0.5, 6);
  });

  it('is out ahead of a target crossing the nose, where the bolt meets it', () => {
    const vel = [6, 0, 0];
    const p = intercept(ship, 20, [0, 0, -10], vel);
    expect(p.x).toBeGreaterThan(0);
    // the bolt and the target get there together
    expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(20 * p.t, 6);
    expect(p.x).toBeCloseTo(vel[0] * p.t, 6);
  });

  it('has no answer for a target it can never catch', () => {
    expect(intercept(ship, 20, [0, 0, -10], [0, 0, -30])).toBeNull();
    expect(intercept(ship, 20, [0, 0, -10], [0, 0, -20])).toBeNull(); // (exactly as fast: never closes)
  });

  it('catches a target running away slower than the bolt', () => {
    const p = intercept(ship, 20, [0, 0, -10], [0, 0, -10]);
    expect(p.t).toBeCloseTo(1, 6);
    expect(p.z).toBeCloseTo(-20, 6);
  });
});

describe('the help onto the lead', () => {
  const ahead = [0, 0, -1];
  const off = (a) => [Math.sin(a), 0, -Math.cos(a)];

  it('bends a shot all the way inside the assist cone, and not at all past the edge', () => {
    expect(assist(ahead, off(AIM.assist * 0.5))).toEqual(off(AIM.assist * 0.5));
    expect(assist(ahead, off(AIM.assistEdge + 0.1))).toEqual(ahead);
  });

  it('bends it part of the way in between, and keeps it a unit vector', () => {
    const mid = (AIM.assist + AIM.assistEdge) / 2;
    const d = assist(ahead, off(mid));
    expect(Math.hypot(...d)).toBeCloseTo(1, 6);
    const a = Math.atan2(d[0], -d[2]);
    expect(a).toBeGreaterThan(0.1 * mid);
    expect(a).toBeLessThan(0.9 * mid);
  });

  it('follows the aim-assist setting: none when off, the full bend further out when strong', () => {
    const want = off(AIM.assist * 1.25); // just past the usual full-bend cone
    expect(assist(ahead, want, 0)).toEqual(ahead);
    expect(assist(ahead, want, 1)).not.toEqual(want);
    expect(assist(ahead, want, 1.6)).toEqual(want);
  });

  it('forgives a little more up and down than side to side', () => {
    const a = AIM.assist * 1.15;
    const up = [0, Math.sin(a), -Math.cos(a)];
    expect(assist(ahead, up)).toEqual(up);
    expect(assist(ahead, off(a))).not.toEqual(off(a));
  });

  it('says how much of the bend a shot gets: all of it, some, or none', () => {
    expect(assistAmount(ahead, off(AIM.assist * 0.5))).toBe(1);
    const mid = assistAmount(ahead, off((AIM.assist + AIM.assistEdge) / 2));
    expect(mid).toBeGreaterThan(0.1);
    expect(mid).toBeLessThan(0.9);
    expect(assistAmount(ahead, off(AIM.assistEdge + 0.1))).toBe(0);
    expect(assistAmount(ahead, off(AIM.assist * 0.5), 0)).toBe(0);
  });

  it('turns a direction back into a heading and a pitch', () => {
    expect(aimAngles([0, 0, -1])).toEqual({ heading: -0, pitch: 0 });
    const { heading, pitch } = aimAngles(nose({ heading: 1.2, pitch: -0.3 }));
    expect(heading).toBeCloseTo(1.2, 6);
    expect(pitch).toBeCloseTo(-0.3, 6);
  });
});

describe('the edge of the screen', () => {
  const rect = { x: 0, y: 100, w: 1000, h: 600 };

  it('puts a marker on the border, in from the edge, on the line out to the thing', () => {
    const right = edgeOf(500, 0, rect);
    expect(right).toEqual({ x: 1000 - 28, y: 400, angle: 0 });
    const up = edgeOf(0, -300, rect);
    expect(up.x).toBe(500);
    expect(up.y).toBe(100 + 28);
    expect(up.angle).toBeCloseTo(-Math.PI / 2, 6);
    const corner = edgeOf(300, 300, rect);
    expect(corner.y).toBeCloseTo(400 + 272, 6);
    expect(corner.x).toBeCloseTo(772, 6);
  });

  it('knows what is on the screen', () => {
    expect(onScreen(500, 400, 10, rect)).toBe(true);
    expect(onScreen(500, 400, -1, rect)).toBe(false); // behind the camera
    expect(onScreen(5, 400, 10, rect)).toBe(false); // too near the edge
    expect(onScreen(500, 690, 10, rect)).toBe(false);
  });
});

describe('a hit', () => {
  it('counts a bolt that passes through a target crossing its path during the frame', () => {
    // where the target ends up the bolt has already passed, but they met halfway
    const k = sweptHit([0, 0, 0], [0, 0, -1], [-0.5, 0, -0.5], [0.5, 0, -0.5], 0.3);
    expect(k).toBeCloseTo(0.5, 6);
  });

  it('misses a target that moves out of the way first', () => {
    expect(sweptHit([0, 0, 0], [0, 0, -1], [0, 0, -0.4], [0, 2, -0.4], 0.3)).toBeNull();
  });

  it('counts one the bolt and the target close on head on, even faster than a frame', () => {
    // closing at 80 a second, a sixtieth of a second: they pass through each other
    expect(sweptHit([0, 0, 0], [0, 0, -1], [0, 0.1, -1.2], [0, 0.1, -0.1], 0.3)).not.toBeNull();
  });
});


describe('the nose following the lock', () => {
  const s = { x: 0, y: 0, z: 0, heading: 0, pitch: 0, bank: 0, speed: 5 };
  it('nudges the stick toward a target off to the right, and up toward one above', () => {
    const right = trackNudge(s, [3, 0, -20]);
    expect(right.turn).toBeGreaterThan(0.05);
    expect(Math.abs(right.climb)).toBeLessThan(1e-6);
    const up = trackNudge(s, [0, 3, -20]);
    expect(up.climb).toBeGreaterThan(0.05);
    expect(Math.abs(up.turn)).toBeLessThan(1e-6);
    const left = trackNudge(s, [-3, -3, -20]);
    expect(left.turn).toBeLessThan(0);
    expect(left.climb).toBeLessThan(0);
  });

  it('is never more than its share of the stick, and grows with the angle off', () => {
    const near = trackNudge(s, [0.5, 0, -20]);
    const far = trackNudge(s, [4, 0, -20]);
    expect(far.turn).toBeGreaterThan(near.turn);
    expect(far.turn).toBeLessThanOrEqual(AIM.trackMax + 1e-9);
    // well off (past where the gain saturates, inside where it fades): the cap, and no more
    const off = (AIM.trackCone * 0.6 + 1 / AIM.trackGain) / 2;
    expect(1 / AIM.trackGain).toBeLessThan(AIM.trackCone * 0.6); // (the test's angle is in the flat part)
    const capped = trackNudge(s, [Math.tan(off) * 20, 0, -20]);
    expect(capped.turn).toBeCloseTo(AIM.trackMax, 9);
    expect(trackNudge(s, [Math.tan(off) * 20, 0, -20], 1.6).turn).toBeCloseTo(AIM.trackMax * 1.6, 9);
    expect(trackNudge(s, [0, 0, -20])).toEqual({ turn: 0, climb: 0 });
  });

  it('lets go past the cone, and fades toward its edge', () => {
    const inside = trackNudge(s, [Math.tan(AIM.trackCone * 0.5) * 20, 0, -20]);
    const edge = trackNudge(s, [Math.tan(AIM.trackCone * 0.95) * 20, 0, -20]);
    expect(inside.turn).toBeGreaterThan(edge.turn);
    expect(edge.turn).toBeGreaterThan(0);
    expect(trackNudge(s, [Math.tan(AIM.trackCone * 1.2) * 20, 0, -20])).toEqual({ turn: 0, climb: 0 });
    expect(trackNudge(s, [0, 0, 20])).toEqual({ turn: 0, climb: 0 }); // (behind)
  });

  it('follows the setting: none when off, more when strong', () => {
    expect(trackNudge(s, [3, 0, -20], 0)).toEqual({ turn: 0, climb: 0 });
    expect(trackNudge(s, [1, 0, -20], 1.6).turn).toBeGreaterThan(trackNudge(s, [1, 0, -20], 1).turn);
  });

  it('works in the ship’s own frame: rolled on its side, a target above is a turn, not a climb', () => {
    const rolled = { ...s, bank: Math.PI / 2 }; // rolled right: its up points right
    const n = trackNudge(rolled, [0, 3, -20]);
    expect(Math.abs(n.climb)).toBeLessThan(1e-6);
    expect(n.turn).toBeLessThan(-0.05); // (the ship's left is up, now)
    const climbing = { ...s, pitch: 0.5 };
    const ahead = trackNudge(climbing, [0, Math.sin(0.5) * 20, -Math.cos(0.5) * 20]);
    expect(Math.abs(ahead.turn) + Math.abs(ahead.climb)).toBeLessThan(1e-6);
  });

  it('lets go for the pilot pushing the other way, however lightly, and not for one pushing with it', () => {
    const n = trackNudge(s, [3, 1, -20]);
    const against = trackNudge(s, [3, 1, -20], 1, { turn: -1, climb: 0 });
    expect(against.turn).toBe(0);
    expect(against.climb).toBe(n.climb);
    // a light push the other way is still the pilot's: the ship never turns against it
    for (const push of [-0.05, -0.2, -0.5]) {
      const light = trackNudge(s, [3, 1, -20], 1.6, { turn: push, climb: push });
      expect(light).toEqual({ turn: 0, climb: 0 });
      expect(push + light.turn).toBeLessThan(0);
    }
    // a hand resting a hair off centre isn't a push
    expect(trackNudge(s, [3, 1, -20], 1, { turn: -0.01, climb: 0.01 })).toEqual(n);
    const withIt = trackNudge(s, [3, 1, -20], 1, { turn: 1, climb: 1 });
    expect(withIt).toEqual(n);
  });
});

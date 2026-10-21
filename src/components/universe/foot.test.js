import { describe, expect, it } from 'vitest';
import { createBolts } from '../../lib/combat/bolt';
import { FIRST } from '../../lib/combat/accuracy';
import { BOLT, FOOT, METRE, TROOPS, aimAt, apart, at, bearing, byTrench, createJump, facingAlong, footBodies, footSkills, footSolids, inTrench, landingSpot, march, offset, person, place, rightOf, solidsOn, squad, vec, velOf, walk } from './foot';

const R = 18;
const seeded = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const run = (w, input, seconds, obstacles) => {
  let s = w;
  for (let t = 0; t < seconds; t += 1 / 60) s = walk(s, input, 1 / 60, R, obstacles);
  return s;
};
const onGround = (w) => {
  expect(vec.len(w.n)).toBeCloseTo(1, 6);
  expect(vec.len(w.f)).toBeCloseTo(1, 6);
  expect(vec.dot(w.n, w.f)).toBeCloseTo(0, 6); // facing along the ground
};

describe('on foot', () => {
  const start = person([0, 1, 0], [0, 0, -1]);

  it('walks where it faces, faster running, and stays on the ground', () => {
    const walked = run(start, { move: 1 }, 2);
    onGround(walked);
    expect(walked.n[2]).toBeLessThan(0); // forward is −z here
    const d = apart(start, walked, R);
    expect(d).toBeGreaterThan(FOOT.walk * 1.5);
    expect(d).toBeLessThan(FOOT.walk * 2.05);
    expect(apart(start, run(start, { move: 1, run: true }, 2), R)).toBeGreaterThan(d * 2);
  });

  it('turns right when told to, and steps sideways', () => {
    const turned = run(start, { turn: 1 }, 0.3);
    onGround(turned);
    expect(turned.f[0]).toBeGreaterThan(0.3); // its right is +x
    expect(apart(start, turned, R)).toBeCloseTo(0, 9); // on the spot
    const stepped = run(start, { strafe: 1 }, 1);
    expect(stepped.n[0]).toBeGreaterThan(0);
    expect(stepped.f[2]).toBeCloseTo(-1, 3); // still facing the same way
  });

  it('goes all the way round the planet in a straight line', () => {
    let w = { ...start, speed: FOOT.run };
    const steps = Math.round((2 * Math.PI * R) / (FOOT.run / 60));
    for (let i = 0; i < steps; i++) w = walk(w, { move: 1, run: true }, 1 / 60, R);
    onGround(w);
    expect(apart(start, w, R)).toBeLessThan(FOOT.run * 0.1);
  });

  it('jumps, comes down again, and only jumps off the ground', () => {
    let w = walk(start, { jump: true }, 1 / 60, R);
    let top = 0;
    let again = 0;
    for (let t = 0; t < 1.5; t += 1 / 60) {
      const was = w.vh;
      w = walk(w, { jump: w.h > 0 }, 1 / 60, R); // (held in the air: no second jump)
      if (w.vh > 0 && was <= 0) again++; // (a new jump)
      top = Math.max(top, w.h);
    }
    expect(top).toBeGreaterThan(0.7 * METRE);
    expect(top).toBeLessThan(1.4 * METRE);
    expect(again).toBe(0);
    expect(w.h).toBe(0);
  });

  it('jumps once for a key held down, however long it’s held (a press, not a bool)', () => {
    const jump = createJump();
    let w = start;
    let jumps = 0;
    for (let t = 0; t < 3; t += 1 / 60) {
      jump.hold(true);
      const was = w.vh;
      w = walk(w, { jump: jump.press }, 1 / 60, R);
      if (w.vh > 0 && was <= 0) jumps++;
    }
    expect(jumps).toBe(1);
    // let go and pressed again: another
    jump.hold(false);
    w = walk(w, { jump: jump.press }, 1 / 60, R);
    jump.hold(true);
    w = walk(w, { jump: jump.press }, 1 / 60, R);
    expect(w.vh).toBeGreaterThan(0);
  });

  it('jumps on landing for a press a hair too early, and not for one long before', () => {
    const early = (before) => {
      const jump = createJump();
      let w = walk(start, { jump: true }, 1 / 60, R);
      let pressed = false;
      let landed = null;
      for (let t = 0; t < 2; t += 1 / 60) {
        // (the time left in the air, as it falls: h / speed, near enough)
        const left = w.vh < 0 ? w.h / -w.vh : Infinity;
        if (!pressed && left <= before) {
          jump.hold(true);
          jump.hold(false);
          pressed = true;
        }
        const was = w.h;
        w = walk(w, { jump: jump.press }, 1 / 60, R);
        if (was > 0 && w.h === 0) landed = t;
        if (landed !== null && t - landed > 0.05) break;
      }
      return { pressed, up: w.h > 0 || w.vh > 0 };
    };
    expect(early(0.08)).toEqual({ pressed: true, up: true });
    expect(early(0.4)).toEqual({ pressed: true, up: false });
  });

  it('goes round the parked ship, never through it', () => {
    const ship = { n: offset(start, 0.1, 0, R).n, r: 0.04 };
    const w = run(start, { move: 1 }, 6, [ship]);
    expect(apart(w, ship, R)).toBeGreaterThanOrEqual(ship.r + FOOT.radius - 1e-6);
  });

  it('comes down on the near side of a planet, toward the light', () => {
    const c = [100, 0, 0];
    const from = [100, 0, 40];
    expect(landingSpot(from, c)).toEqual([0, 0, 1]);
    const lit = landingSpot(from, c, [0, 1, 0]);
    expect(lit[1]).toBeGreaterThan(0.4);
    expect(lit[2]).toBeGreaterThan(0.4);
    // the light round the far side: still the near side
    expect(landingSpot(from, c, [0, 0, -1])[2]).toBeGreaterThan(0.3);
    const f = facingAlong([0, 1, 0], [1, 1, 0]);
    expect(f[0]).toBeCloseTo(1, 6);
    expect(bearing([0, 1, 0], [0, 0, -1], [-1, 0, 0])).toBeCloseTo(Math.PI / 2, 6); // to the left is +
  });
});

describe('by a trench', () => {
  // (a big planet, the Death Star's size against a person, its trench round its middle)
  const BIG = 150;
  const band = { half: 1.48, home: 0.4, arc: Math.PI };

  it('comes down beside it, on the side it was coming down on, its door toward it', () => {
    for (const n of [vec.unit([1, 0.3, 0.2]), vec.unit([-0.2, -0.6, 0.7]), vec.unit([0.3, 0.001, -1])]) {
      const back = 20 * METRE;
      const spot = byTrench(n, band, BIG, back);
      onGround({ ...spot, n: spot.n, f: spot.f });
      expect(Math.sign(spot.n[1])).toBe(Math.sign(n[1]));
      // `back` from the rim, along the ground
      expect(Math.asin(Math.abs(spot.n[1])) * BIG - band.half).toBeCloseTo(back, 6);
      expect(inTrench(spot.n, band, BIG)).toBe(false);
      // as near where it was coming down as that is: the same way round
      expect(Math.atan2(spot.n[2], spot.n[0])).toBeCloseTo(Math.atan2(n[2], n[0]), 6);
      // facing along the trench, its right toward it
      expect(spot.f[1]).toBeCloseTo(0, 2);
      expect(-Math.sign(spot.n[1]) * rightOf(spot)[1]).toBeGreaterThan(0);
    }
  });

  it('only comes down along the part of a trench there is', () => {
    const part = { ...band, home: 0, arc: 0.5 };
    const spot = byTrench([0, 0.1, -1], part, BIG, 0.5);
    expect(Math.abs(Math.atan2(spot.n[2], spot.n[0]))).toBeLessThanOrEqual(0.5);
  });

  it('walks up to the rim and no further, and along it', () => {
    const spot = byTrench([1, 0.2, 0], band, BIG, 2 * METRE);
    let w = person(spot.n, [0, -1, 0]); // facing the trench
    for (let t = 0; t < 3; t += 1 / 60) w = walk(w, { move: 1, run: true }, 1 / 60, BIG, [{ band }]);
    onGround(w);
    expect(inTrench(w.n, band, BIG)).toBe(false);
    expect(Math.asin(w.n[1]) * BIG).toBeCloseTo(band.half + FOOT.radius, 4);
    // and along it, as it was
    let a = person(spot.n, spot.f);
    for (let t = 0; t < 3; t += 1 / 60) a = walk(a, { move: 1 }, 1 / 60, BIG, [{ band }]);
    expect(apart(a, { n: spot.n }, BIG)).toBeGreaterThan(FOOT.walk * 2.5);
    expect(inTrench(a.n, band, BIG)).toBe(false);
  });

  it('sends squads from your side of it', () => {
    const me = { id: 'me', ...person(byTrench([1, 0.2, 0], band, BIG, 10 * METRE).n, [0, 0, 1]) };
    const rand = seeded(5);
    for (let i = 0; i < 20; i++) {
      for (const t of squad(rand, me, BIG, { band })) {
        expect(inTrench(t.n, band, BIG, 2 * METRE)).toBe(false);
        expect(Math.sign(t.n[1])).toBe(Math.sign(me.n[1]));
      }
    }
  });
});

describe('a squad', () => {
  const me = { id: 'me', ...person([0, 1, 0], [0, 0, -1]) };

  it('comes from over the horizon, a way off, facing you', () => {
    const troops = squad(seeded(3), me, R, { count: 4 });
    expect(troops).toHaveLength(4);
    for (const t of troops) {
      onGround(t);
      expect(apart(t, me, R)).toBeGreaterThan(35 * METRE);
      expect(Math.abs(bearing(t.n, t.f, vec.add(me.n, t.n, -1)))).toBeLessThan(0.05);
      expect(TROOPS[t.kind]).toBeTruthy();
    }
  });

  it('walks at you, stops at its distance and shoots, mostly at you', () => {
    const rand = seeded(5);
    let troops = squad(rand, me, R, { count: 3, kinds: ['gromflomite'] });
    const shots = [];
    for (let t = 0; t < 40; t += 1 / 30) {
      const r = march(troops, [me], 1 / 30, R, rand);
      troops = r.troops;
      shots.push(...r.shots);
    }
    for (const t of troops) {
      const d = apart(t, me, R);
      expect(d).toBeLessThan(TROOPS.gromflomite.range[1] * METRE * 1.15);
      expect(d).toBeGreaterThan(TROOPS.gromflomite.range[0] * METRE * 0.5);
    }
    expect(shots.length).toBeGreaterThan(6);
    // each says who fired it and how far off its mark was (so the drawing can start it at the muzzle)
    for (const s of shots) {
      expect(troops.some((t) => t.id === s.by)).toBe(true);
      expect(s.range).toBeGreaterThan(5 * METRE);
      expect(s.range).toBeLessThan(TROOPS.gromflomite.range[1] * METRE * 1.5);
    }
    // a shot at you passes near you
    const near = shots.filter((s) => {
      const toMe = vec.add(vec.add(at(me, R), me.n, METRE), s.from, -1);
      const along = vec.dot(toMe, s.dir);
      return vec.len(vec.add(toMe, s.dir, -along)) < METRE * 1.5;
    });
    expect(near.length).toBeGreaterThan(shots.length * 0.3);
  });

  it('never shoots through a rock between, and leads you walking across', () => {
    const rand = seeded(5);
    let troops = squad(rand, me, R, { count: 1, kinds: ['cop'], dist: 10 * METRE });
    // (it stands where it is, the rock square between)
    const block = [{ n: vec.unit(vec.add(troops[0].n, me.n)), r: 2 * METRE }];
    let shots = 0;
    for (let t = 0; t < 10; t += 1 / 30) {
      const r = march(troops, [me], 1 / 30, R, rand, block);
      troops = r.troops.map((o) => ({ ...o, n: troops[0].n }));
      shots += r.shots.length;
    }
    expect(shots).toBe(0);
    // across its view at a run: aimed ahead of you
    const runner = { ...me, f: rightOf(me), speed: FOOT.run };
    const v = velOf(runner);
    expect(vec.len(v)).toBeCloseTo(FOOT.run);
    let shot = null;
    let them = squad(seeded(3), me, R, { count: 1, kinds: ['cop'], dist: 10 * METRE });
    for (let t = 0; t < 20 && !shot; t += 1 / 30) {
      const r = march(them, [runner], 1 / 30, R, seeded(3));
      them = r.troops;
      shot = r.shots[0] ?? null;
    }
    expect(shot).not.toBeNull();
    expect(shot.lead).toBeGreaterThan(0.2 * METRE);
    // the first goes wider on purpose
    expect(shot.spread).toBeCloseTo(TROOPS.cop.spread * 0.6 * FIRST);
  });

  it('raises its gun as it comes into range, and lowers it out of range', () => {
    const rand = seeded(7);
    let troops = squad(rand, me, R, { count: 1, kinds: ['cop'] });
    expect(troops[0].aim ?? 0).toBe(0);
    let raisedAt = null;
    for (let t = 0; t < 40; t += 1 / 30) {
      troops = march(troops, [me], 1 / 30, R, rand).troops;
      if (raisedAt == null && troops[0].aim > 0.9) raisedAt = t;
    }
    expect(raisedAt).not.toBeNull();
    expect(apart(troops[0], me, R)).toBeLessThan(TROOPS.cop.range[1] * METRE * 1.5);
    // far off again: it comes down, over more than a moment
    let far = { ...troops[0], ...person(offset(me, 60 * METRE, 0, R).n, me.f), cool: 1, hold: troops[0].hold };
    const t0 = far.aim;
    far = march([far], [me], 1 / 30, R, rand).troops[0];
    expect(far.aim).toBeLessThan(t0);
    expect(far.aim).toBeGreaterThan(t0 - 0.2);
    for (let t = 0; t < 2; t += 1 / 30) far = march([far], [me], 1 / 30, R, rand).troops[0];
    expect(far.aim).toBe(0);
    // one without a gun never aims
    let brute = squad(rand, me, R, { count: 1, kinds: ['gazorpian'], dist: 8 * METRE });
    for (let t = 0; t < 3; t += 1 / 30) brute = march(brute, [me], 1 / 30, R, rand).troops;
    expect(brute[0].aim).toBe(0);
  });

  it('charges in without a gun, and lands a blow', () => {
    const rand = seeded(9);
    let troops = squad(rand, me, R, { count: 1, kinds: ['gazorpian'] });
    let hits = [];
    for (let t = 0; t < 30 && !hits.length; t += 1 / 30) {
      const r = march(troops, [me], 1 / 30, R, rand);
      troops = r.troops;
      hits = r.hits;
    }
    expect(hits[0]).toMatchObject({ target: 'me', damage: TROOPS.gazorpian.damage });
  });
});

describe('a probe droid', () => {
  const me = { id: 'me', ...person([0, 1, 0], [0, 0, -1]) };
  it('keeps its distance, never fires nor charges, and calls a squad in once it has had you in sight a while', () => {
    const rand = seeded(11);
    let troops = squad(rand, me, R, { count: 1, kinds: ['probe'] });
    const calls = [];
    let shots = 0;
    let hits = 0;
    let firstCall = null;
    let near = Infinity;
    for (let t = 0; t < 40; t += 1 / 30) {
      const r = march(troops, [me], 1 / 30, R, rand);
      troops = r.troops;
      shots += r.shots.length;
      hits += r.hits.length;
      for (const c of r.calls) {
        calls.push(c);
        firstCall ??= t;
      }
      near = Math.min(near, apart(troops[0], me, R));
    }
    expect(shots).toBe(0);
    expect(hits).toBe(0);
    expect(near).toBeGreaterThan(TROOPS.probe.range[0] * METRE * 0.6);
    expect(calls).toEqual([expect.objectContaining({ by: troops[0].id })]);
    expect(firstCall).toBeGreaterThan(TROOPS.probe.calls);
    // and the troops that aren't probes never call
    let plain = squad(rand, me, R, { count: 2, kinds: ['stormtrooper'] });
    for (let t = 0; t < 30; t += 1 / 30) {
      const r = march(plain, [me], 1 / 30, R, rand);
      plain = r.troops;
      expect(r.calls).toHaveLength(0);
    }
  });

  it('knows every side’s troops: Star Wars’, Evil Morty’s guard and Jack’s crew too', () => {
    for (const k of ['stormtrooper', 'scout', 'probe', 'mortyguard', 'jackscrew']) {
      expect(TROOPS[k], k).toBeTruthy();
      expect(TROOPS[k].range[0], k).toBeLessThan(TROOPS[k].range[1]);
    }
    expect(TROOPS.scout.speed).toBeGreaterThan(TROOPS.stormtrooper.speed);
    // and every troop has a name for the lock (not its kind's id)
    for (const [k, t] of Object.entries(TROOPS)) expect(t.name, k).toMatch(/^[A-Z][^_]*$/);
  });
});

describe('a bolt', () => {
  // fly a bolt on the one step till it's done: what it ended on
  const flyOut = (spec, world) => {
    const bolts = createBolts();
    bolts.fire({ speed: BOLT.speed, range: BOLT.range, ...spec });
    for (let i = 0; i < 240 && bolts.live().length; i++) {
      const ev = bolts.step(1 / 60, { blades: [], ...world });
      if (ev.length) return ev[0];
    }
    return null;
  };

  it('flies straight, and hits whoever it passes close to first', () => {
    const me = { id: 'me', ...person([0, 1, 0], [0, 0, -1]) };
    const far = { ...person(offset(me, 20 * METRE, 0, R).n, [0, 0, 1]), id: 1, kind: 'cop', alive: true };
    const near = { ...person(offset(me, 10 * METRE, 0.2 * METRE, R).n, [0, 0, 1]), id: 2, kind: 'cop', alive: true };
    const e = flyOut({ from: vec.add(at(me, R), me.n, METRE), dir: me.f, side: 'you', owner: 'me' }, { solids: footSolids([], R), bodies: footBodies({ troops: [far, near], R }) });
    expect(e.type).toBe('hit');
    expect(e.body.id).toBe(2);
  });

  it('goes into the ground', () => {
    const e = flyOut({ from: [0, R + METRE, 0], dir: vec.unit([0, -1, -1]), side: 'you' }, { solids: footSolids([], R), bodies: [] });
    expect(e.type).toBe('solid');
    expect(vec.len(e.at)).toBeCloseTo(R, 4);
  });

  it('stops at a rock in the way, and goes over a small one', () => {
    const me = { id: 'me', ...person([0, 1, 0], [0, 0, -1]) };
    const t = { ...person(offset(me, 12 * METRE, 0, R).n, [0, 0, 1]), id: 1, kind: 'cop', alive: true };
    const rock = { n: offset(me, 6 * METRE, 0, R).n, r: 1.2 * METRE };
    const from = vec.add(at(me, R), me.n, 1.3 * METRE);
    const e = flyOut({ from, dir: me.f, side: 'you', owner: 'me' }, { solids: footSolids([rock], R), bodies: footBodies({ troops: [t], R }) });
    expect(e.type).toBe('solid');
    expect(apart({ n: vec.unit(e.at) }, me, R)).toBeLessThan(6 * METRE);
    const pebble = { n: rock.n, r: 0.3 * METRE, top: 0.5 * METRE };
    expect(flyOut({ from, dir: me.f, side: 'you', owner: 'me' }, { solids: footSolids([pebble], R), bodies: footBodies({ troops: [t], R }) }).type).toBe('hit');
  });

  it('flies by a lamp post’s walk circle (its own body’s the landing physics’), which you still walk round', () => {
    const me = { id: 'me', ...person([0, 1, 0], [0, 0, -1]) };
    const t = { ...person(offset(me, 12 * METRE, 0, R).n, [0, 0, 1]), id: 1, kind: 'cop', alive: true };
    const post = { n: offset(me, 6 * METRE, 0, R).n, r: 0.28 * METRE, pass: true };
    const from = vec.add(at(me, R), me.n, 1.1 * METRE);
    expect(flyOut({ from, dir: me.f, side: 'you', owner: 'me' }, { solids: footSolids([post], R), bodies: footBodies({ troops: [t], R }) }).type).toBe('hit');
    let w = me;
    let nearest = Infinity;
    for (let s = 0; s < 6; s += 1 / 60) {
      w = walk(w, { move: 1 }, 1 / 60, R, [post]);
      nearest = Math.min(nearest, apart(w, post, R));
    }
    expect(nearest).toBeGreaterThanOrEqual(post.r + FOOT.radius - 1e-6);
  });

  it('theirs hits you and your mate, never each other', () => {
    const me = { id: 'me', ...person([0, 1, 0], [0, 0, -1]) };
    const t = { ...person(offset(me, 10 * METRE, 0, R).n, [0, 0, 1]), id: 1, kind: 'cop', alive: true };
    const mid = { ...person(offset(me, 5 * METRE, 0, R).n, [0, 0, 1]), id: 2, kind: 'cop', alive: true };
    const from = vec.add(at(t, R), t.n, METRE);
    const e = flyOut({ from, dir: vec.unit(vec.add(vec.add(at(me, R), me.n, METRE), from, -1)), side: 'troop', owner: 1 }, { solids: footSolids([], R), bodies: footBodies({ me, troops: [t, mid], R }) });
    expect(e.type).toBe('hit');
    expect(e.body.id).toBe('me');
  });

  it('is aimed at the nearest trooper round the way you face', () => {
    const me = person([0, 1, 0], [0, 0, -1]);
    const ahead = { ...person(offset(me, 10 * METRE, 1 * METRE, R).n, [0, 0, 1]), id: 1, alive: true };
    const closer = { ...person(offset(me, 6 * METRE, -0.5 * METRE, R).n, [0, 0, 1]), id: 2, alive: true };
    const behind = { ...person(offset(me, -3 * METRE, 0, R).n, [0, 0, 1]), id: 3, alive: true };
    expect(aimAt(me, [ahead, closer, behind], R).id).toBe(2);
    expect(aimAt(me, [ahead, behind], R).id).toBe(1);
    expect(aimAt(me, [behind], R)).toBeNull();
    expect(aimAt(me, [{ ...closer, alive: false }], R)).toBeNull();
  });
});

describe("a landing's things", () => {
  const frame = person([0, 1, 0], [0, 0, -1]); // facing −z, so +x (three.js's left of it) is −x here
  const left = vec.cross([0, 1, 0], [0, 0, -1]); // n × f

  it('stands a thing so many metres ahead and to the side, upright on the ground', () => {
    const ahead = place(frame, 0, 10, R);
    onGround(ahead);
    expect(apart(frame, ahead, R)).toBeCloseTo(10 * METRE, 6);
    expect(ahead.n[2]).toBeLessThan(0);
    expect(vec.dot(ahead.f, frame.f)).toBeCloseTo(1, 3); // facing on, the way the frame does
    const side = place(frame, 4, 0, R);
    expect(apart(frame, side, R)).toBeCloseTo(4 * METRE, 6);
    expect(vec.dot(vec.unit(vec.add(side.n, frame.n, -1)), left)).toBeGreaterThan(0.99); // +x: n × f
  });

  it('turns it as three.js turns a thing about its up: +z round toward +x', () => {
    const turned = place(frame, 0, 0, R, Math.PI / 2);
    onGround(turned);
    expect(vec.dot(turned.f, left)).toBeCloseTo(1, 6);
  });

  it("makes a thing's solids circles along the ground, where they stand", () => {
    const spot = place(frame, 0, 20, R);
    const [c] = solidsOn(spot, [{ circle: [0, 0, 3] }], R);
    expect(apart(c, spot, R)).toBeCloseTo(0, 6);
    expect(c.r).toBeCloseTo(3 * METRE, 9);
    // a box 8 m by 2 m: a row of circles down its length, covering it end to end
    const row = solidsOn(spot, [{ box: [0, 0, 4, 1] }], R);
    expect(row.length).toBeGreaterThan(2);
    const ends = row.map((o) => apart(o, spot, R) + o.r);
    expect(Math.max(...ends)).toBeGreaterThanOrEqual(4 * METRE - 1e-9);
    expect(Math.max(...ends)).toBeLessThan(4.6 * METRE);
    for (const o of row) expect(o.r).toBeCloseTo(1 * METRE, 9);
    // turned a quarter round by its yaw, the row runs the other way
    const along = (list) => vec.unit(vec.add(list[list.length - 1].n, list[0].n, -1));
    expect(Math.abs(vec.dot(along(row), left))).toBeGreaterThan(0.99);
    const turnedRow = solidsOn(spot, [{ box: [0, 0, 4, 1, Math.PI / 2] }], R);
    expect(Math.abs(vec.dot(along(turnedRow), spot.f))).toBeGreaterThan(0.99);
  });

  it('keeps someone out of a solid placed on the ground', () => {
    const spot = place(frame, 0, 6, R);
    const solids = solidsOn(spot, [{ circle: [0, 0, 2] }], R);
    const walked = run(frame, { move: 1 }, 6, solids);
    expect(apart(walked, spot, R)).toBeGreaterThanOrEqual(2 * METRE + FOOT.radius - 1e-6);
  });
});

describe('other dimensions', () => {
  it('give every pilot the same code wherever they are met, and different pilots different ones', async () => {
    const { dimensionOf } = await import('./footScene');
    const a = dimensionOf('7f3a9c');
    expect(dimensionOf('7f3a9c')).toEqual(a);
    expect(a.code).toMatch(/^[A-Z]-\d{2,3}\S\d$/);
    expect(a.hue).toBeGreaterThanOrEqual(0);
    expect(a.hue).toBeLessThan(1);
    const codes = new Set(Array.from({ length: 50 }, (_, i) => dimensionOf(`pilot-${i}`).code));
    expect(codes.size).toBeGreaterThan(45);
  });
});

describe('the skill tree on foot (hangar/skills’ fx)', () => {
  it('takes a tenth less from each hit with tough, heals half again as fast with the medic, and hits the troops harder', () => {
    const k = footSkills({ health: 1.1, heal: 1.5, damage: 1.15, boost: 0.1 });
    expect(k.hurt).toBeCloseTo(1 / 1.1);
    expect(k.heal).toBeCloseTo(FOOT.heal * 1.5);
    expect(k.damage).toBeCloseTo(1.15);
  });
  it('is the foot as it was with no skills, or nonsense', () => {
    for (const fx of [undefined, null, {}, { health: -1, heal: 'x', damage: 0 }]) expect(footSkills(fx)).toEqual({ hurt: 1, heal: FOOT.heal, damage: 1 });
  });
});

import { describe, expect, it } from 'vitest';
import { ALERT_CLIP, HOSTILE_BODY, SCAN, STEP, absorb, bodyClip, createPosture, fallOf, hostileBody, hostileStep, startBurst, startBurst as sb, stepBurst, strafeStep, whereHit } from './hostiles';
import { MODE_BODY } from '../../../lib/ai/body';
import { seeded } from '../../../lib/seeded';
import { createSearch } from '../../../lib/ai/search';
import { createTokens } from '../../../lib/ai/squad';

describe('how the enemies fight', () => {
  it('fires a burst a shot at a time, then runs dry', () => {
    const b = startBurst({ burst: { n: 3, gap: 0.1 } });
    expect(b).toEqual({ left: 3, wait: 0 });
    expect(stepBurst(b, 0.016, 0.1)).toBe(1);
    expect(stepBurst(b, 0.05, 0.1)).toBe(0);
    expect(stepBurst(b, 0.06, 0.1)).toBe(1);
    expect(stepBurst(b, 0.5, 0.1)).toBe(1); // (the last, however long the frame)
    expect(stepBurst(b, 1, 0.1)).toBe(0);
    expect(sb(null).left).toBe(1); // (one without a burst: one shot)
  });

  it('strafes across the line to you, holding its distance', () => {
    const you = { x: 0, z: 0 };
    const h = { strafe: { speed: 2, every: 2, keep: 10 } };
    const a = strafeStep({ x: 0, z: 10 }, you, h, 0.5, 0);
    expect(a.yaw).toBeCloseTo(Math.PI, 5); // (facing you)
    expect(Math.abs(a.x)).toBeCloseTo(1, 5); // (a metre across in half a second)
    expect(a.z).toBeCloseTo(10, 5); // (at the distance it likes: no closer)
    const b = strafeStep({ x: 0, z: 10 }, you, h, 0.5, 2.5);
    expect(Math.sign(b.x)).toBe(-Math.sign(a.x)); // (the other way, a couple of seconds on)
    // too far: it comes in; too close: it backs off
    expect(strafeStep({ x: 0, z: 20 }, you, h, 0.5, 0).z).toBeLessThan(20);
    expect(strafeStep({ x: 0, z: 4 }, you, h, 0.5, 0).z).toBeGreaterThan(4);
  });

  it('soaks hits on a shield before the body takes any', () => {
    expect(absorb({ shield: 3, hp: 2 }, 1)).toEqual({ shield: 2, hp: 2 });
    expect(absorb({ shield: 1, hp: 2 }, 2)).toEqual({ shield: 0, hp: 1 });
    expect(absorb({ shield: 0, hp: 2 }, 1)).toEqual({ shield: 0, hp: 1 });
    expect(absorb({ hp: 2 }, 2)).toEqual({ shield: 0, hp: 0 });
  });
});

describe('an enemy’s head', () => {
  const DT = 1 / 30;
  const trooper = (over = {}) => ({ b: { x: 0, z: 0, yaw: 0, to: null, wait: 0 }, hostile: { range: 40, every: 2, damage: 6, ...over.hostile }, spec: { roam: 4, leash: 40, speed: 1.4, ...over.spec }, home: [0, 0], hp: 2, hpMax: 2, flinch: 0 });
  // a wall along x = 10: nothing sees across it
  const wall = (a, b) => (a.x < 10) === (b.x < 10);
  const run = (t, world, seconds, r = seeded(1), each = null) => {
    const modes = new Set();
    let out = null;
    for (let s = 0; s < seconds; s += DT) {
      const w = typeof world === 'function' ? world(s) : world;
      out = hostileStep(t, w, DT, r);
      t.b.x = out.x;
      t.b.z = out.z;
      t.b.yaw = out.yaw;
      modes.add(out.mode);
      each?.(out, s);
    }
    return { out, modes };
  };

  it('a trooper that loses you behind a wall goes to where you were, then looks about with the others', () => {
    const t = trooper();
    const search = createSearch({ rand: seeded(2), spots: (b) => [{ x: b.at.x + 6, y: 0, z: b.at.z + 6 }, { x: b.at.x - 6, y: 0, z: b.at.z - 6 }] });
    let lookedAt = null;
    let guessedAt = null;
    const { modes } = run(
      t,
      (s) => ({ you: s < 3 ? { x: 5, z: 20 } : { x: 15, z: 24 }, allies: [], seesThrough: wall, search, who: 'a' }),
      22,
      seeded(1),
      (out, s) => {
        if (out.mode === 'look' && lookedAt === null) lookedAt = { s, goal: { ...t.mind.goal } };
        if (out.guessed && guessedAt === null) guessedAt = s;
        search.update(DT);
      },
    );
    expect(guessedAt).toBeGreaterThan(3 + 2.5 - 0.2);
    expect(lookedAt).not.toBeNull();
    // where it last had you: behind the wall, where you went in the moment it still knew
    expect(lookedAt.goal.x).toBeCloseTo(15, 0);
    expect(lookedAt.goal.z).toBeCloseTo(24, 0);
    expect(modes.has('search')).toBe(true);
  });

  it('fires at its belief, not at you, once it can only guess', () => {
    const t = trooper();
    const aims = [];
    // you step behind the wall at 2 s, and once it can only guess (2.5 s on) you move on along it
    run(t, (s) => ({ you: s < 2 ? { x: 5, z: 10 } : s < 5 ? { x: 15, z: 10 } : { x: 15, z: 30 }, allies: [], seesThrough: wall }), 8, seeded(1), (out, s) => {
      if (s > 5.3 && out.aim) aims.push(out);
    });
    expect(aims.length).toBeGreaterThan(0);
    for (const a of aims) {
      expect(a.guessed).toBe(true);
      expect(Math.hypot(a.aim.x - 15, a.aim.z - 30)).toBeGreaterThan(3);
    }
    // in sight, it aims at you
    const u = trooper();
    const { out } = run(u, { you: { x: 5, z: 10 }, allies: [], seesThrough: wall }, 2);
    expect(out.aim).toEqual({ x: 5, z: 10 });
    expect(out.guessed).toBe(false);
  });

  it('leads you while it sees you moving: aims where you will be when its bolt arrives', () => {
    const t = trooper();
    const { out } = run(t, { you: { x: 0, z: 30, vel: { x: 2.3, z: 0 } }, allies: [], seesThrough: () => true }, 2);
    expect(out.guessed).toBe(false);
    expect(out.aim.z).toBeCloseTo(30, 0);
    // (a third of a second at 90 m/s: 0.77 m ahead of you)
    expect(out.aim.x).toBeGreaterThan(0.6);
    expect(out.aim.x).toBeLessThan(0.95);
  });

  it('a blaster trooper with no shot takes cover from your line of fire; a duellist stays in your view', () => {
    const tokens = createTokens({ pools: { shot: 0 } });
    // a pillar between: a wall on x = 10 hides anything on its far side from you at x = 0
    const t = trooper({ spec: { leash: 60, roam: 4, speed: 1.4 } });
    t.b.x = 8;
    let deepest = 0;
    const { modes } = run(t, { you: { x: 0, z: 0 }, allies: [], seesThrough: wall, tokens, who: 'a' }, 12, seeded(1), (out) => {
      deepest = Math.max(deepest, out.x);
    });
    expect(modes.has('cover')).toBe(true);
    expect(deepest).toBeGreaterThan(10);
    const duel = trooper({ hostile: { range: 14, chase: 1.8, melee: true, reach: 2.6, blade: { color: '#f00' } } });
    duel.b.x = 8;
    const d = run(duel, { you: { x: 0, z: 0 }, allies: [], seesThrough: wall, tokens, who: 'd' }, 6);
    expect(d.modes.has('cover')).toBe(false);
    expect(d.modes.has('close')).toBe(true);
    expect(Math.hypot(d.out.x, d.out.z)).toBeLessThan(3.5);
  });

  it.each(['close', 'back', 'strafe'])('a %s in progress whose mark has gone between two choices carries on rather than falling over', (mode) => {
    const c = trooper({ hostile: { range: 40, chase: 2.7, melee: true, reach: 3.4, strafe: { speed: 2.6, every: 2.2, keep: 14 } }, spec: { roam: 3, leash: 40 } });
    // (a mark that died, or an ally with nothing left to fight, mid-move)
    c.mind = { mode, goal: null, thinkAt: 99, clock: 0 };
    expect(() => hostileStep(c, { you: null, allies: [] }, DT, seeded(1))).not.toThrow();
    expect(c.mind.mode).toBe('wander');
  });

  it('the old spawns run as before: a strafer circles, holding its distance; a chaser comes to arm’s reach and stops', () => {
    const s = trooper({ hostile: { range: 45, strafe: { speed: 2.6, every: 2.2, keep: 14 } }, spec: { roam: 4, leash: 60 } });
    s.b.z = 14;
    let crossed = 0;
    let minD = Infinity;
    run(s, { you: { x: 0, z: 0 }, allies: [] }, 8, seeded(3), (out) => {
      if (Math.abs(out.x) > 1) crossed += 1;
      minD = Math.min(minD, Math.hypot(out.x, out.z));
    });
    expect(crossed).toBeGreaterThan(30);
    expect(minD).toBeGreaterThan(14 * 0.6);
    const c = trooper({ hostile: { range: 40, chase: 2.7, melee: true, reach: 3.4 }, spec: { roam: 3, leash: 15 } });
    c.b.z = 12;
    const r = run(c, { you: { x: 0, z: 0 }, allies: [] }, 8);
    expect(Math.hypot(r.out.x, r.out.z)).toBeLessThan(3.4);
    expect(Math.hypot(r.out.x, r.out.z)).toBeGreaterThan(1.5);
    // and never further from home than its leash: a chaser with a short leash stops short
    const k = trooper({ hostile: { range: 60, chase: 2.7, melee: true, reach: 2 }, spec: { roam: 3, leash: 6 } });
    const far = run(k, { you: { x: 0, z: 30 }, allies: [] }, 8);
    expect(far.out.z).toBeLessThanOrEqual(6.01);
    // with nobody about, it wanders near home
    const w = trooper();
    const wander = run(w, { you: null, allies: [] }, 10);
    expect(wander.modes.has('wander')).toBe(true);
    expect(Math.hypot(wander.out.x, wander.out.z)).toBeLessThan(5);
    expect(STEP.rethink).toBeGreaterThan(0);
  });
});

describe('an enemy’s body', () => {
  const DT = 1 / 30;
  // a step as hostileStep gives it, with what activity.js adds: its belief of you, whether it sees you
  const step = (over = {}) => ({ x: 0, z: 0, yaw: 0, mode: 'hold', moving: 0, aim: null, guessed: false, ...over });
  // its head's turn from its facing, to where it looks
  const lookAngle = (s, b) => Math.atan2(b.look.x - s.x, b.look.z - s.z) - s.yaw;

  it('the table: the site’s rows, with the hostiles’ own modes', () => {
    for (const mode of Object.keys(MODE_BODY)) expect(HOSTILE_BODY[mode]).toBeDefined();
    expect(HOSTILE_BODY.cover.base).toBe('crouch');
    // (the game's own, for a figure that has the soldiers' set: walrusSets/npc.js)
    expect(HOSTILE_BODY.cover.clip).toBe('cover.low.idle');
    expect(ALERT_CLIP).toBe('aware.alert');
    expect(HOSTILE_BODY.cover.rise).toBe(true);
    expect(HOSTILE_BODY.strafe.look).toBe('aim');
    expect(HOSTILE_BODY.search.scan).toBe(true);
    for (const mode of ['hold', 'close', 'flank', 'look', 'wander']) expect(HOSTILE_BODY[mode]).toBeDefined();
  });

  it('plays the game’s clip where the figure has it, else the site’s', () => {
    expect(bodyClip({ clips: { 'cover.low.idle': {} } }, 'cover.low.idle', 'crouch')).toBe('cover.low.idle');
    expect(bodyClip({ clips: { idle: {} } }, 'cover.low.idle', 'crouch')).toBe('crouch');
    expect(bodyClip({}, 'cover.low.idle', 'crouch')).toBe('crouch');
    expect(bodyClip({ clips: { 'cover.low.idle': {} } }, null, null)).toBe(null);
  });

  it('a strafer’s feet go across while its chest, its head and its gun stay on you', () => {
    const p = createPosture({ seed: 1 });
    const you = { x: 0, z: 10 };
    let b = hostileBody(p, step({ mode: 'strafe', aim: you, sees: true }), DT, { t: 0 });
    // going +x at 2.4 m/s, facing +z (+x is its left: side, + right, comes out −)
    for (let i = 1; i <= 10; i++) b = hostileBody(p, step({ mode: 'strafe', x: i * 0.08, aim: you, sees: true }), DT, { t: i * DT });
    expect(b.motion.side).toBeCloseTo(-2.4, 1);
    expect(Math.abs(b.motion.speed)).toBeLessThan(0.05);
    expect(b.look).toEqual({ x: 0, z: 10 });
    expect(b.aim).toBe(1);
    expect(b.base).toBe(null);
    expect(b.mark).toBe('!'); // (it's only just seen you)
  });

  it('in cover it runs there standing, crouches once it’s stopped, and rises to fire', () => {
    const p = createPosture({ seed: 2 });
    const you = { x: 0, z: 20 };
    let b;
    let t = 0;
    // running to its spot: never crouched while its feet move (they'd slide)
    for (let i = 0; i < 20; i++) {
      b = hostileBody(p, step({ mode: 'cover', x: -i * 0.1, aim: you, sees: true }), DT, { t: (t += DT) });
      expect(b.base).toBe(null);
    }
    const there = step({ mode: 'cover', x: -1.9, aim: you, sees: true });
    // there: not at once, but after a moment, crouched, its gun down
    for (let i = 0; i < 3; i++) b = hostileBody(p, there, DT, { t: (t += DT) });
    expect(b.base).toBe(null);
    for (let i = 0; i < 15; i++) b = hostileBody(p, there, DT, { t: (t += DT) });
    expect(b.base).toBe('crouch');
    expect(b.clip).toBe('cover.low.idle');
    expect(b.aim).toBe(0);
    expect(b.look).toEqual({ x: 0, z: 20 });
    // about to fire: up, the gun up
    b = hostileBody(p, there, DT, { t: (t += DT), firing: true });
    expect(b.base).toBe(null);
    expect(b.aim).toBe(1);
    // and down again after
    for (let i = 0; i < 15; i++) b = hostileBody(p, there, DT, { t: (t += DT) });
    expect(b.base).toBe('crouch');
  });

  it('searching, its head sweeps both ways across where it walks, never behind, and a ? hangs over it', () => {
    const p = createPosture({ seed: 3 });
    let left = 0;
    let right = 0;
    for (let i = 0; i < 150; i++) {
      const s = step({ mode: 'search', z: i * 0.04, yaw: 0.3 });
      const b = hostileBody(p, s, DT, { t: i * DT });
      expect(b.mark).toBe('?');
      expect(b.scan).toBe(true);
      expect(b.aim).toBe(0);
      const a = lookAngle(s, b);
      expect(Math.abs(a)).toBeLessThanOrEqual(SCAN.yaw + 1e-6);
      if (a > 0.4) left++;
      if (a < -0.4) right++;
    }
    expect(left).toBeGreaterThan(5);
    expect(right).toBeGreaterThan(5);
    // two of them, each in its own time
    const a = createPosture({ seed: 4 });
    const c = createPosture({ seed: 5 });
    const s = step({ mode: 'search' });
    expect(lookAngle(s, hostileBody(a, s, DT, { t: 1 }))).not.toBeCloseTo(lookAngle(s, hostileBody(c, s, DT, { t: 1 })), 2);
  });

  it('going to look where it last had you: its eyes on that spot, a ? over it', () => {
    const p = createPosture({ seed: 6 });
    const b = hostileBody(p, step({ mode: 'look', z: 0.05, belief: { at: { x: 5, y: 0, z: 8 }, visible: false } }), DT, { t: 0 });
    expect(b.look).toEqual({ x: 5, z: 8 });
    expect(b.mark).toBe('?');
  });

  it('it starts once when it sees you, a ! for a moment, and again only once it’s lost you a while', () => {
    const p = createPosture({ seed: 7 });
    const you = { x: 0, z: 12 };
    let t = 0;
    let b;
    for (let i = 0; i < 10; i++) {
      b = hostileBody(p, step({ mode: 'wander', z: i * 0.03 }), DT, { t: (t += DT) });
      expect(b.alert).toBe(false);
      expect(b.mark).toBe(null);
    }
    b = hostileBody(p, step({ mode: 'hold', aim: you, sees: true }), DT, { t: (t += DT) });
    expect(b.alert).toBe(true);
    expect(b.mark).toBe('!');
    b = hostileBody(p, step({ mode: 'hold', aim: you, sees: true }), DT, { t: (t += DT) });
    expect(b.alert).toBe(false);
    expect(b.mark).toBe('!');
    for (let i = 0; i < 45; i++) b = hostileBody(p, step({ mode: 'hold', aim: you, sees: true }), DT, { t: (t += DT) });
    expect(b.alert).toBe(false);
    expect(b.mark).toBe(null);
    // a glimpse lost and had again at once: no start
    for (let i = 0; i < 15; i++) b = hostileBody(p, step({ mode: 'hold', aim: you, guessed: true, sees: false }), DT, { t: (t += DT) });
    b = hostileBody(p, step({ mode: 'hold', aim: you, sees: true }), DT, { t: (t += DT) });
    expect(b.alert).toBe(false);
    expect(b.mark).toBe(null);
    // lost, and looking a while
    for (let i = 0; i < 100; i++) b = hostileBody(p, step({ mode: 'search' }), DT, { t: (t += DT) });
    expect(b.mark).toBe('?');
    // found again
    b = hostileBody(p, step({ mode: 'hold', aim: you, sees: true }), DT, { t: (t += DT) });
    expect(b.alert).toBe(true);
    expect(b.mark).toBe('!');
  });

  it('a mode no row covers is drawn by its motion alone', () => {
    const p = createPosture({ seed: 8 });
    hostileBody(p, step({ mode: 'dance' }), DT, { t: 0 });
    const b = hostileBody(p, step({ mode: 'dance', z: 0.05 }), DT, { t: DT });
    expect(b.motion.speed).toBeCloseTo(1.5, 5);
    expect(b.base).toBe(null);
    expect(b.scan).toBe(false);
    expect(b.mark).toBe(null);
    expect(b.look).toBe(null);
    expect(b.aim).toBe(0);
  });

  it('a step that jumps (knocked, or put back) moves its feet no faster than a sprint', () => {
    const p = createPosture({ seed: 9 });
    hostileBody(p, step(), DT, { t: 0 });
    const b = hostileBody(p, step({ x: 5 }), DT, { t: DT });
    expect(Math.hypot(b.motion.speed, b.motion.side)).toBe(0);
  });

  it('where a hit lands: the head, high up; else the chest', () => {
    expect(whereHit(1.72, 0, 1.83)).toBe('head');
    expect(whereHit(1.2, 0, 1.83)).toBe('chest');
    expect(whereHit(11.7, 10, 1.83)).toBe('head');
    expect(whereHit(null, 0, 1.83)).toBe('chest');
  });

  it('which way it goes down: the way the shot went, else away from you, else back', () => {
    const a = fallOf({ push: { x: 0, y: 0.3, z: 2 } });
    expect(a.x).toBeCloseTo(0, 6);
    expect(a.z).toBeCloseTo(1, 6);
    const b = fallOf({ from: { x: 0, z: 0 }, at: { x: 3, z: 4 } });
    expect(b.x).toBeCloseTo(0.6, 6);
    expect(b.z).toBeCloseTo(0.8, 6);
    const c = fallOf({ yaw: Math.PI / 2 });
    expect(c.x).toBeCloseTo(-1, 6);
    expect(c.z).toBeCloseTo(0, 6);
    // (a shot straight down: no way along the ground, so away from you)
    const d = fallOf({ push: { x: 0, y: -1, z: 0 }, from: { x: 0, z: 0 }, at: { x: 0, z: -2 } });
    expect(d.z).toBeCloseTo(-1, 6);
  });
});

import { describe, expect, it } from 'vitest';
import { BOSS_WAVE, LAWN, LIFT, LINE, WAVES, callLightning, liftInput, newLawn, recallHammer, setMove, skipLift, startAtBoss, startLawn, stepLawn, throwHammer } from './rules';

const DT = 1 / 120;
const run = (g, secs, brain) => {
  const ev = [];
  for (let t = 0; t < secs; t += DT) {
    brain?.(g, t);
    ev.push(...stepLawn(g, DT));
    if (g.phase === 'won' || g.phase === 'lost') break;
  }
  return ev;
};
// straight to wave 1, with nothing on the lawn
const ready = (seed = 1) => {
  const g = newLawn({ seed });
  startLawn(g);
  skipLift(g);
  run(g, 1.3);
  g.spawns = [];
  g.enemies = [];
  return g;
};
const soldier = (g, x, z, extra = {}) => {
  const e = { id: g.nextId++, kind: 'soldier', hp: 1, r: 0.55, speed: 0, t: 0, seed: 0, stagger: 0, onLawn: true, h: 1.9, x, y: 0, z, goal: x, fx: 0, fz: 1, ...extra };
  g.enemies.push(e);
  return e;
};

// A steady hand on the lift: push against where the needle is and where it's going.
const steady = (g) => {
  const L = g.lift;
  liftInput(g, true, -(2.4 * L.x + 1.1 * L.v));
};

// A sensible Thor: lightning on crowds, the hammer back when a bolt is coming,
// the nearest Chitauri first, and for the armoured ones a throw past their
// side, a walk along the terrace to line up, and a recall through their backs.
export function thunderer(g, { noise = 0 } = {}) {
  const h = g.hammer;
  const T = g.thor;
  const foes = g.enemies.filter((e) => e.hp > 0 && e.onLawn);
  const armoured = (e) => e.kind === 'brute' || e.kind === 'cull';
  const n = () => (noise ? (Math.sin(g.t * 37.1 + T.x) + Math.sin(g.t * 11.3)) * noise : 0);
  setMove(g, 0);
  if (g.charge >= 100 && foes.length) {
    let best = null;
    let bn = 0;
    for (const e of foes) {
      if (e.kind === 'chariot') continue;
      let k = 0;
      for (const f of foes) if (Math.hypot(f.x - e.x, f.z - e.z) < LAWN.strike) k += f.kind === 'soldier' ? 1 : 2;
      if (k > bn) {
        bn = k;
        best = e;
      }
    }
    if (best && (bn >= 3 || best.z > -12) && (h.state === 'held' || Math.hypot(h.x - best.x, h.z - best.z) < 6)) callLightning(g, best);
  }
  // a bolt on its way: step out of its line, or call the hammer back to swat it
  if (h.state !== 'held') {
    const back = Math.hypot(h.x - T.x, h.z) / LAWN.recallSpeed;
    for (const b of g.bolts) {
      if (b.vz <= 0) continue;
      const t = -b.z / b.vz;
      const x = b.x + b.vx * t;
      if (Math.abs(x - T.x) > 1.4 || t > 2.5) continue;
      if (back + 0.15 < t) recallHammer(g);
      else {
        const away = x > T.x ? -1 : 1;
        setMove(g, Math.abs(T.x + away) > LAWN.thorX - 0.5 ? -away : away);
      }
      return;
    }
  }
  let target = null;
  let urgency = -Infinity;
  for (const e of foes) {
    if (e.kind === 'chariot') continue;
    const u = e.z + (e.kind === 'brute' ? 4 : e.kind === 'cull' ? 3 : 0) + (e.charging > 0 ? 10 : 0) + (e.shooter && e.shots < 3 && e.z >= e.stopZ ? 5 : 0);
    if (u > urgency) {
      urgency = u;
      target = e;
    }
  }
  const chariot = foes.find((e) => e.kind === 'chariot' && Math.abs(e.x) < 16);
  if (h.state === 'held') {
    if (target && armoured(target)) {
      const s = target.x >= 0 ? 1 : -1;
      const o = target.r + 3;
      throwHammer(g, { x: target.x + o * s + n(), z: target.z - 14 });
      g.bot = { id: target.id };
    } else if (target && target.z > -44) {
      const d = Math.hypot(target.x - T.x, target.z);
      const lead = d / LAWN.throwSpeed;
      const ax = target.x + target.fx * target.speed * lead;
      const az = target.z + target.fz * target.speed * lead;
      const l = Math.hypot(ax - T.x, az);
      throwHammer(g, { x: ax + ((ax - T.x) / l) * 5 + n(), z: az + (az / l) * 5 });
      g.bot = null;
    } else if (chariot) {
      const lead = Math.hypot(chariot.x - T.x, chariot.z) / LAWN.throwSpeed;
      throwHammer(g, { x: chariot.x + chariot.vx * lead + n(), y: chariot.y, z: chariot.z });
      g.bot = null;
    } else setMove(g, Math.abs(T.x) > 0.5 ? -Math.sign(T.x) : 0);
    return;
  }
  if (h.state === 'down') {
    const b = g.bot && foes.find((e) => e.id === g.bot.id);
    if (!b) {
      recallHammer(g);
      return;
    }
    // where Thor must stand for the way back to run through its back
    const want = h.x + ((b.x - h.x) * -h.z) / (b.z - h.z) - LAWN.hand.dx;
    if (Math.abs(want) > LAWN.thorX || Math.abs(T.x - want) < 0.25) recallHammer(g);
    else setMove(g, Math.sign(want - T.x));
  }
}

describe('Hold the Lawn: the lift', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    it(`comes up for a steady hand (seed ${seed})`, () => {
      const g = newLawn({ seed });
      startLawn(g);
      const ev = run(g, 6, steady);
      expect(ev.some((e) => e.type === 'lifted')).toBe(true);
      expect(g.phase).not.toBe('lift');
    });
  }

  it('falls over (nearly always) if you only hold on', () => {
    let dropped = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const g = newLawn({ seed });
      startLawn(g);
      const ev = run(g, 8, (q) => q.phase === 'lift' && liftInput(q, true, 0));
      if (ev.find((e) => e.type === 'drop' || e.type === 'lifted')?.type === 'drop') dropped++;
    }
    expect(dropped).toBeGreaterThanOrEqual(11);
  });

  it('can be done by a slower, sloppier hand, in a try or two', () => {
    let lifted = 0;
    for (const seed of [11, 12, 13, 14, 15, 16]) {
      const g = newLawn({ seed });
      startLawn(g);
      const seen = [];
      const ev = run(g, 14, (q) => {
        if (q.phase !== 'lift') return;
        const L = q.lift;
        seen.push([L.x, L.v]);
        // reacts to what it saw a fifth of a second ago, a bit too hard
        const [x, v] = seen[Math.max(0, seen.length - 24)];
        liftInput(q, true, -(3 * x + 0.6 * v));
      });
      if (ev.some((e) => e.type === 'lifted')) lifted++;
    }
    expect(lifted).toBeGreaterThanOrEqual(5);
  });

  it('does nothing while you let go', () => {
    const g = newLawn({ seed: 1 });
    startLawn(g);
    run(g, 5);
    expect(g.phase).toBe('lift');
    expect(Math.abs(g.lift.x)).toBeLessThan(LIFT.green);
  });
});

describe('Hold the Lawn: the hammer', () => {
  it('flies through every soldier on its line, for more each', () => {
    const g = ready();
    for (const z of [-10, -16, -22]) soldier(g, 0.45, z);
    throwHammer(g, { x: 0.45, z: -30 });
    const ev = run(g, 1.5);
    const kills = ev.filter((e) => e.type === 'kill');
    expect(kills.length).toBe(3);
    expect(kills.map((k) => k.score)).toEqual([100, 150, 200]);
    expect(g.hammer.state).toBe('down');
  });

  it('comes back to his hand on a recall, through anything in the way', () => {
    const g = ready();
    throwHammer(g, { x: 6, z: -30 });
    run(g, 1.5);
    soldier(g, 3.2, -15);
    recallHammer(g);
    const ev = run(g, 1.5);
    expect(ev.some((e) => e.type === 'kill')).toBe(true);
    expect(ev.some((e) => e.type === 'catch')).toBe(true);
    expect(g.hammer.state).toBe('held');
  });

  it('is turned aside by a brute’s shield from the front, and kills it from behind', () => {
    const g = ready();
    const b = soldier(g, 0.45, -15, { kind: 'brute', hp: 2, r: 0.9, h: 2.4 });
    throwHammer(g, { x: 0.45, z: -30 });
    let ev = run(g, 1);
    expect(ev.some((e) => e.type === 'block')).toBe(true);
    expect(b.hp).toBe(2);
    expect(g.hammer.state).toBe('down');
    // throw past it, step across, recall through its back
    recallHammer(g);
    run(g, 1.5);
    throwHammer(g, { x: 4.5, z: -29 });
    run(g, 1.5);
    const want = g.hammer.x + ((b.x - g.hammer.x) * -g.hammer.z) / (b.z - g.hammer.z) - LAWN.hand.dx;
    ev = run(g, 3, (q) => setMove(q, Math.abs(q.thor.x - want) < 0.1 ? 0 : Math.sign(want - q.thor.x)));
    recallHammer(g);
    ev = run(g, 1.5);
    expect(ev.some((e) => e.type === 'kill' && e.kind === 'brute')).toBe(true);
  });

  it('only throws out over the lawn', () => {
    const g = ready();
    expect(throwHammer(g, { x: 0, z: 2 })).toBe(false);
    expect(g.hammer.state).toBe('held');
  });
});

describe('Hold the Lawn: bolts and lightning', () => {
  it('swats bolts with the hammer in hand, and takes them with it out', () => {
    const g = ready();
    g.bolts.push({ x: 0, y: 1.3, z: -6, vx: 0, vy: 0, vz: LAWN.boltSpeed, t: 0 });
    let ev = run(g, 1);
    expect(ev.some((e) => e.type === 'swat')).toBe(true);
    expect(g.thor.hp).toBe(LAWN.hearts);
    throwHammer(g, { x: 10, z: -40 });
    g.bolts.push({ x: 0, y: 1.3, z: -6, vx: 0, vy: 0, vz: LAWN.boltSpeed, t: 0 });
    ev = run(g, 1);
    expect(ev.some((e) => e.type === 'hurt')).toBe(true);
    expect(g.thor.hp).toBe(LAWN.hearts - 1);
  });

  it('a bolt that hurts him leaves him safe from the next for LAWN.iframes', () => {
    expect(LAWN.iframes).toBe(0.8);
    const g = ready();
    throwHammer(g, { x: 10, z: -40 });
    run(g, 0.4); // (the hammer well away: in flight it knocks bolts out)
    // two bolts 0.3 s apart: one heart
    g.bolts.push({ x: 0, y: 1.3, z: -6, vx: 0, vy: 0, vz: LAWN.boltSpeed, t: 0 });
    g.bolts.push({ x: 0, y: 1.3, z: -6 - LAWN.boltSpeed * 0.3, vx: 0, vy: 0, vz: LAWN.boltSpeed, t: 0 });
    let ev = run(g, 1.2);
    expect(ev.filter((e) => e.type === 'hurt')).toHaveLength(1);
    expect(g.thor.hp).toBe(LAWN.hearts - 1);
    // one more, well after: it hurts
    if (g.hammer.state === 'held') throwHammer(g, { x: 10, z: -40 });
    run(g, 0.4);
    g.bolts.push({ x: 0, y: 1.3, z: -1, vx: 0, vy: 0, vz: LAWN.boltSpeed, t: 0 });
    ev = run(g, 0.3);
    expect(ev.filter((e) => e.type === 'hurt')).toHaveLength(1);
    expect(g.thor.hp).toBe(LAWN.hearts - 2);
  });

  it('a breach still counts in his safe time (the lawn is crossed, he isn’t hit)', () => {
    const g = ready();
    throwHammer(g, { x: 10, z: -40 });
    run(g, 0.4);
    g.bolts.push({ x: 0, y: 1.3, z: -1, vx: 0, vy: 0, vz: LAWN.boltSpeed, t: 0 });
    run(g, 0.2);
    expect(g.thor.hp).toBe(LAWN.hearts - 1);
    soldier(g, 4, LINE - 0.01, { speed: 2 });
    run(g, 0.1);
    expect(g.thor.hp).toBe(LAWN.hearts - 2);
  });

  it('knocks bolts out of the air with the hammer in flight', () => {
    const g = ready();
    g.bolts.push({ x: 0.45, y: 1.25, z: -20, vx: 0, vy: 0, vz: LAWN.boltSpeed, t: 0 });
    throwHammer(g, { x: 0.45, z: -30 });
    const ev = run(g, 1);
    expect(ev.some((e) => e.type === 'deflect')).toBe(true);
  });

  it('can dodge a bolt by walking', () => {
    const g = ready();
    throwHammer(g, { x: 10, z: -40 });
    g.bolts.push({ x: 0, y: 1.3, z: -14, vx: 0, vy: 0, vz: LAWN.boltSpeed, t: 0 });
    run(g, 1.5, (q) => setMove(q, 1));
    expect(g.thor.hp).toBe(LAWN.hearts);
  });

  it('chains lightning from one Chitauri to the next', () => {
    const g = ready();
    for (let i = 0; i < 6; i++) soldier(g, -12 + i * 5, -20 - (i % 2) * 2);
    g.charge = 100;
    expect(callLightning(g, { x: -12, z: -20 })).toBe(true);
    const ev = run(g, 0.1);
    expect(ev.filter((e) => e.type === 'kill').length).toBe(6);
    expect(ev.find((e) => e.type === 'lightning').arcs.length).toBe(6);
    expect(g.charge).toBeLessThan(100);
    expect(callLightning(g, { x: 0, z: -20 })).toBe(false);
  });
});

describe('Hold the Lawn: the waves', () => {
  it('loses the lawn to a Thor who does nothing', () => {
    const g = newLawn({ seed: 1 });
    startLawn(g);
    skipLift(g);
    const ev = run(g, 300);
    expect(g.phase).toBe('lost');
    expect(ev.some((e) => e.type === 'breach')).toBe(true);
  });

  for (const seed of [1, 2, 3]) {
    it(`holds the lawn and beats Cull Obsidian for a sensible Thor (seed ${seed})`, () => {
      const g = newLawn({ seed });
      startLawn(g);
      skipLift(g);
      const ev = run(g, 900, (q) => thunderer(q));
      expect(g.phase).toBe('won');
      const won = ev.find((e) => e.type === 'won');
      expect(won.stone).toBe(true);
      expect(ev.filter((e) => e.type === 'wave').length).toBe(WAVES.length);
    });
  }

  it('plays the same way from the same seed', () => {
    const play = () => {
      const g = newLawn({ seed: 9 });
      startLawn(g);
      skipLift(g);
      run(g, 90, (q) => thunderer(q));
      return [g.score, g.thor.hp, g.wave, g.enemies.length];
    };
    expect(play()).toEqual(play());
  });

  it('never lets a Chitauri stand past the line', () => {
    const g = newLawn({ seed: 4 });
    startLawn(g);
    skipLift(g);
    let worst = -Infinity;
    run(g, 120, (q) => {
      for (const e of q.enemies) if (e.kind !== 'chariot') worst = Math.max(worst, e.z);
    });
    expect(worst).toBeLessThan(LINE + 0.01);
  });
  it('starts again at Cull Obsidian from the checkpoint: five hearts, no lightning', () => {
    expect(BOSS_WAVE).toBe(WAVES.length - 1);
    expect(WAVES[BOSS_WAVE].boss).toBe(true);
    const g = newLawn({ seed: 1 });
    expect(startAtBoss(g)).toEqual([{ type: 'checkpoint', n: WAVES.length }]);
    expect([g.phase, g.thor.hp, g.charge, g.score]).toEqual(['break', LAWN.hearts, 0, 0]);
    const ev = run(g, 2);
    expect(ev.filter((e) => e.type === 'wave')).toEqual([expect.objectContaining({ n: WAVES.length, boss: true })]);
    expect(g.wave).toBe(BOSS_WAVE);
    expect(g.enemies.some((e) => e.kind === 'cull')).toBe(true);
  });
  it('loses the checkpoint to a Thor who does nothing', () => {
    const g = newLawn({ seed: 1 });
    startAtBoss(g);
    const ev = run(g, 300);
    expect(g.phase).toBe('lost'); // at about 36 s on seeds 1 to 3
    expect(ev.find((e) => e.type === 'lost').wave).toBe(WAVES.length);
  });
  it('lets a sensible Thor beat Cull Obsidian from the checkpoint', () => {
    const g = newLawn({ seed: 1 });
    startAtBoss(g);
    const ev = run(g, 300, (q) => thunderer(q));
    expect(g.phase).toBe('won'); // at 48–71 s on seeds 1 to 3
    expect(ev.find((e) => e.type === 'won').stone).toBe(true);
  });
  it('carries nothing over into the checkpoint from a game just lost', () => {
    const g = newLawn({ seed: 1 });
    startLawn(g);
    skipLift(g);
    run(g, 300);
    expect(g.phase).toBe('lost');
    startAtBoss(g);
    expect([g.enemies, g.bolts, g.spawns]).toEqual([[], [], []]);
    expect(g.hammer.state).toBe('held');
    expect([g.thor.hp, g.charge, g.score]).toEqual([LAWN.hearts, 0, 0]);
  });
});

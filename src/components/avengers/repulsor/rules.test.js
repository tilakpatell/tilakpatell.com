import { describe, expect, it } from 'vitest';
import { EYE, LANES, RANGE, WAVES, aimAt, newRange, rayHit, startRange, stepRange, strafe, unibeam } from './rules';

const DT = 1 / 120;

// steps the game for `secs`, letting `brain` set the inputs each step
function run(s, secs, brain) {
  const events = [];
  for (let t = 0; t < secs && s.phase !== 'won' && s.phase !== 'lost'; t += DT) {
    brain?.(s);
    events.push(...stepRange(s, DT));
  }
  return events;
}

const until = (s, fn, secs = 60) => {
  for (let t = 0; t < secs && !fn(s); t += DT) stepRange(s, DT);
};

// A sensible pilot: shoots whatever will hit soonest, steps out of the way
// of anything aimed at its lane, and saves the unibeam for a crowd or a boss.
function pilot(s) {
  const eye = { x: s.x, y: EYE, z: 0 };
  // where bolts and telegraphed volleys will land
  const danger = new Set();
  for (const b of s.bolts) {
    const tt = -b.z / Math.max(1, b.vz);
    const lx = b.x + b.vx * tt;
    LANES.forEach((x, i) => {
      if (Math.abs(lx - x) < RANGE.boltHit + 0.4) danger.add(i);
    });
  }
  for (const e of s.enemies) if (e.kind === 'prime' && e.volley) e.volley.lanes.forEach((i) => danger.add(i));
  for (const e of s.enemies) {
    if ((e.kind === 'drone' || e.kind === 'missile') && e.z > -14) {
      LANES.forEach((x, i) => {
        if (Math.abs(e.x - x) < RANGE.ramHit + 0.6) danger.add(i);
      });
    }
  }
  if (danger.has(s.lane)) {
    const safe = [0, 1, 2].filter((i) => !danger.has(i)).sort((a, b) => Math.abs(a - s.lane) - Math.abs(b - s.lane))[0];
    if (safe != null && safe !== s.lane) strafe(s, Math.sign(safe - s.lane));
  }
  // target: the nearest threat by time to reach us, else anything
  const targets = s.enemies.filter((e) => e.hp > 0 && e.z < -2);
  targets.sort((a, b) => b.z - a.z);
  const t = targets[0];
  s.input.firing = !!t && s.energy >= RANGE.shotCost;
  if (t) {
    const spot = t.kind === 'prime' ? t.parts.find((p) => p.hp > 0 && (p.core ? t.parts.every((q) => q.core || q.hp <= 0) : true)) : null;
    const at = spot ? { x: t.x + spot.dx, y: t.y + spot.dy, z: t.z } : t.kind === 'sentry' ? { x: t.x, y: t.y + 0.42, z: t.z } : t;
    s.input.aim = aimAt(eye, at);
  }
  const crowd = s.enemies.filter((e) => e.z > -60).length;
  if (s.charge >= 100 && (crowd >= 3 || s.enemies.some((e) => e.kind === 'prime'))) unibeam(s);
}

describe('Repulsor Range', () => {
  it('starts on the pad, full energy and armour, middle lane', () => {
    const s = newRange({ seed: 1 });
    expect(s.phase).toBe('ready');
    expect(s.armor).toBe(RANGE.armor);
    expect(s.energy).toBe(RANGE.energy);
    expect(s.lane).toBe(1);
    expect(s.x).toBe(LANES[1]);
  });

  it('sends the first wave of drones once started', () => {
    const s = newRange({ seed: 1 });
    const ev = startRange(s);
    expect(ev.some((e) => e.type === 'wave' && e.n === 1)).toBe(true);
    run(s, 4);
    expect(s.enemies.some((e) => e.kind === 'drone')).toBe(true);
  });

  it('is lost by a pilot who does nothing', () => {
    const s = newRange({ seed: 2 });
    startRange(s);
    run(s, 400);
    expect(s.phase).toBe('lost');
    expect(s.armor).toBe(0);
  });

  for (const seed of [1, 2, 3, 4]) {
    it(`is won by a sensible pilot (seed ${seed}), boss and all`, () => {
      const s = newRange({ seed });
      startRange(s);
      const ev = run(s, 900, pilot);
      expect(s.phase).toBe('won');
      expect(ev.some((e) => e.type === 'won')).toBe(true);
      expect(s.wave).toBe(WAVES.length - 1);
      expect(s.score).toBeGreaterThan(5000);
    });
  }

  it('costs energy to fire, clicks dry when empty, and recharges', () => {
    const s = newRange({ seed: 1 });
    startRange(s);
    s.input.firing = true;
    s.input.aim = { x: 0, y: 0.3, z: -1 };
    const ev = run(s, 3);
    expect(ev.filter((e) => e.type === 'shot').length).toBeGreaterThan(5);
    expect(ev.some((e) => e.type === 'dry')).toBe(true);
    s.input.firing = false;
    const low = s.energy;
    run(s, 2);
    expect(s.energy).toBeGreaterThan(low + 20);
  });

  it('destroys a drone it hits, for points', () => {
    const s = newRange({ seed: 5 });
    startRange(s);
    until(s, (q) => q.enemies.some((e) => e.kind === 'drone' && e.z > -40));
    const d = s.enemies.find((e) => e.kind === 'drone');
    s.input.aim = aimAt({ x: s.x, y: EYE, z: 0 }, d);
    s.input.firing = true;
    const ev = run(s, 0.05);
    expect(ev.some((e) => e.type === 'kill' && e.kind === 'drone')).toBe(true);
    expect(s.score).toBeGreaterThan(0);
  });

  it('builds a combo on quick kills and loses it when hit', () => {
    const s = newRange({ seed: 3 });
    startRange(s);
    s.enemies.push(...[-6, -3, 0, 3].map((x, i) => ({ id: 900 + i, kind: 'drone', x, y: EYE, z: -30, vx: 0, vy: 0, vz: 0, hp: 1, r: RANGE.r.drone, t: 0, seed: 0 })));
    let combo = 0;
    for (const e of s.enemies.filter((q) => q.id >= 900)) {
      s.input.aim = aimAt({ x: s.x, y: EYE, z: 0 }, e);
      s.input.firing = true;
      s.cooldown = 0;
      for (const ev of stepRange(s, DT)) if (ev.type === 'kill') combo = ev.combo;
    }
    expect(combo).toBeGreaterThanOrEqual(3);
    s.input.firing = false;
    s.enemies.push({ id: 999, kind: 'drone', x: s.x, y: EYE, z: -0.6, vx: 0, vy: 0, vz: 20, hp: 1, r: RANGE.r.drone, t: 0, seed: 0, committed: true });
    const ev = run(s, 0.2);
    expect(ev.some((e) => e.type === 'damage')).toBe(true);
    expect(s.combo).toBe(0);
  });

  it('lets a pilot strafe out of a bolt’s way, and hits one who stays', () => {
    const shoot = (move) => {
      const s = newRange({ seed: 1 });
      startRange(s);
      s.enemies = [];
      s.spawns = [];
      s.bolts.push({ x: LANES[1], y: EYE, z: -20, vx: 0, vy: 0, vz: RANGE.boltSpeed });
      if (move) strafe(s, -1);
      return run(s, 1.5).some((e) => e.type === 'damage');
    };
    expect(shoot(false)).toBe(true);
    expect(shoot(true)).toBe(false);
  });

  it('keeps the unibeam until it is charged, then clears what is in front', () => {
    const s = newRange({ seed: 1 });
    startRange(s);
    s.enemies = [];
    s.spawns = [];
    expect(unibeam(s)).toBe(false);
    s.charge = 100;
    s.enemies.push(...[-25, -40, -55].map((z, i) => ({ id: 800 + i, kind: 'drone', x: 0, y: EYE, z, vx: 0, vy: 0, vz: 0, hp: 1, r: RANGE.r.drone, t: 0, seed: 0, hold: true })));
    s.input.aim = { x: 0, y: 0, z: -1 };
    expect(unibeam(s)).toBe(true);
    const ev = run(s, 0.6);
    expect(ev.filter((e) => e.type === 'kill').length).toBe(3);
    expect(s.charge).toBe(0);
  });

  it('plays the same way from the same seed', () => {
    const a = newRange({ seed: 9 });
    const b = newRange({ seed: 9 });
    startRange(a);
    startRange(b);
    run(a, 120, pilot);
    run(b, 120, pilot);
    expect(a.score).toBe(b.score);
    expect(a.t).toBe(b.t);
    expect(a.armor).toBe(b.armor);
  });

  it('starts over clean after a loss', () => {
    const s = newRange({ seed: 2 });
    startRange(s);
    run(s, 400);
    expect(s.phase).toBe('lost');
    startRange(s);
    expect(s.phase).toBe('wave');
    expect(s.armor).toBe(RANGE.armor);
    expect(s.score).toBe(0);
    expect(s.enemies).toEqual([]);
    expect(s.wave).toBe(0);
  });

  // wave 9 begun, nothing else on the range: Ultron Prime on its way in
  const approaching = () => {
    const s = newRange({ seed: 1 });
    startRange(s);
    Object.assign(s, { enemies: [], spawns: [], wave: WAVES.length - 2, phase: 'break', breakT: 0 });
    run(s, 0.1);
    return [s, s.enemies.find((e) => e.kind === 'prime')];
  };
  const eye = (s) => ({ x: s.x, y: EYE, z: 0 });
  const shoulderOf = (e) => ({ x: e.x + 0.82, y: e.y + 0.4, z: e.z });
  const aimShoulder = (e) => (s) => (s.input.aim = aimAt(eye(s), shoulderOf(e)));
  const touched = (ev, e) => ev.some((x) => x.id === e.id && (x.type === 'hit' || x.type === 'deflect'));

  it('cannot touch Ultron Prime on its way in, by repulsor or unibeam, and can once it has arrived', () => {
    const [s, prime] = approaching();
    expect(prime.arrived).toBe(false);
    expect(rayHit(s, aimAt(eye(s), shoulderOf(prime)))).toBeNull();
    const hp = prime.parts.map((p) => p.hp);
    s.input.firing = true;
    let ev = run(s, 1, aimShoulder(prime));
    s.input.firing = false;
    s.charge = 100;
    expect(unibeam(s)).toBe(true);
    ev = ev.concat(run(s, RANGE.beam.dur + 0.1, aimShoulder(prime)));
    expect(touched(ev, prime)).toBe(false);
    expect(prime.parts.map((p) => p.hp)).toEqual(hp);
    until(s, () => prime.arrived, 15);
    expect(rayHit(s, aimAt(eye(s), shoulderOf(prime))).e).toBe(prime);
    s.energy = RANGE.energy;
    s.input.firing = true;
    expect(touched(run(s, 0.5, aimShoulder(prime)), prime)).toBe(true); // lands as 'deflect' on the armed core
  });

  it('lets a shot through Ultron Prime on its way in, to the drone behind it', () => {
    const [s, prime] = approaching();
    const at = shoulderOf(prime);
    s.enemies.push({ id: 801, kind: 'drone', x: at.x, y: at.y, z: prime.z - 6, vx: 0, vy: 0, vz: 0, hp: 1, r: RANGE.r.drone, t: 0, seed: 0, hold: true });
    expect(rayHit(s, aimAt(eye(s), at)).e.id).toBe(801);
  });

  for (const seed of [1, 2, 3, 4]) {
    it(`makes a sensible pilot face Prime’s volleys and summons before it falls (seed ${seed})`, () => {
      const s = newRange({ seed });
      startRange(s);
      const ev = run(s, 900, pilot);
      const end = ev.findIndex((e) => e.type === 'kill' && e.kind === 'prime');
      expect(end).toBeGreaterThan(-1);
      expect(ev.slice(0, end).some((e) => e.type === 'volley')).toBe(true);
      expect(ev.slice(0, end).some((e) => e.type === 'summon')).toBe(true);
      const boss = ev.findIndex((e) => e.type === 'boss');
      expect(ev.slice(0, boss).some((e) => e.type === 'hit' && e.kind === 'prime')).toBe(false);
    });
  }
});

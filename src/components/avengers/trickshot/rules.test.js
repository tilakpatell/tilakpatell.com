import { describe, expect, it } from 'vitest';
import { BOW, EYE, ROUNDS, STONE_SCORE, aimFor, draw, drawCap, drawFor, letDown, newRange, nockTrick, pathAt, ringScore, speedFor, startRound, stepRange, targetAt, toggleLob } from './rules';

const DT = 1 / 120;
const steps = (g, secs, brain) => {
  const ev = [];
  for (let t = 0; t < secs && g.phase === 'live'; t += DT) {
    brain?.(g);
    ev.push(...stepRange(g, DT));
  }
  return ev;
};

// draw fully, aim, loose, and let it fly
function shoot(g, aim, { hold = BOW.drawTime + 0.05, fly = 2 } = {}) {
  draw(g, true);
  steps(g, hold, (q) => (q.s.aim = aim));
  g.s.aim = aim;
  draw(g, false);
  return steps(g, fly);
}

// A good archer: shoots clays while they're up (leading them, allowing for
// their fall), otherwise works along the boards, leading movers, allowing
// for the wind, lobbing over the hay wall with a gentle draw, and uses trick
// arrows as they come.
export function archer(g, { noise = 0 } = {}) {
  const s = g.s;
  const wind = s.wind * s.windDir;
  let p = null;
  let vel = null;
  let acc = null;
  let speed = BOW.maxSpeed;
  const clay = s.clays.find((c) => c.alive && c.y > 1.5);
  if (clay) {
    p = clay;
    vel = { x: clay.vx, y: clay.vy, z: clay.vz };
    acc = { x: 0, y: -9.81 };
  } else {
    const t = s.targets[s.shots % s.targets.length];
    p = targetAt(t, s);
    if (t.kind === 'mover') {
      const later = targetAt(t, { ...s, moveT: s.moveT + 0.05 });
      vel = { x: (later.x - p.x) / 0.05, y: 0, z: 0 };
    }
    if (t.behind) speed = BOW.lobSpeed;
  }
  // a half draw for the board behind the wall, a full one for everything else
  if (!s.drawing && s.lob !== (speed === BOW.lobSpeed)) toggleLob(g);
  if (!s.drawing && s.arrows > 0 && !s.flying.length) {
    if (s.tricks.length && !s.nocked) nockTrick(g);
    draw(g, true);
  }
  if (s.drawing) {
    const a = aimFor(p, { wind, vel, acc, speed });
    s.aim = noise ? { x: a.x + (Math.sin(s.t * 91) * noise), y: a.y + Math.cos(s.t * 73) * noise, z: a.z } : a;
  }
  if (s.drawing && s.draw >= drawFor(speed) - 1e-9) draw(g, false);
}

describe('Trick Shot: the bow', () => {
  it('puts a full-draw arrow in the gold at 18 m, aimed for drop and wind', () => {
    const g = newRange({ seed: 1 });
    startRound(g, 0);
    g.s.wind = 0.3;
    const t = g.s.targets[0];
    const ev = shoot(g, aimFor(targetAt(t, g.s), { wind: g.s.wind * g.s.windDir }));
    const ring = ev.find((e) => e.type === 'ring');
    expect(ring).toBeTruthy();
    expect(ring.ring).toBeGreaterThanOrEqual(8);
  });

  it('drops the arrow over distance: aimed level, it lands low and short', () => {
    const g = newRange({ seed: 1 });
    startRound(g, 0);
    g.s.wind = 0;
    const ev = shoot(g, { x: 0, y: 0, z: -1 }, { fly: 3 });
    const miss = ev.find((e) => e.type === 'miss' || e.type === 'ring');
    expect(miss.type === 'miss' && miss.ground).toBe(true);
  });

  it('lets the wind carry it sideways', () => {
    const run = (wind) => {
      const g = newRange({ seed: 1 });
      startRound(g, 0);
      g.s.targets = [];
      g.s.wind = wind;
      g.s.windDir = 1;
      return shoot(g, { x: 0, y: 0.08, z: -1 }, { fly: 3 }).find((e) => e.type === 'miss');
    };
    expect(run(1.5).x).toBeGreaterThan(run(0).x + 1);
  });

  it('does nothing with a half-hearted draw (the arrow is kept)', () => {
    const g = newRange({ seed: 1 });
    startRound(g, 0);
    const before = g.s.arrows;
    draw(g, true);
    steps(g, 0.05);
    const ev = [...(draw(g, false) ?? []), ...steps(g, 0.1)];
    expect(ev.some((e) => e.type === 'dud')).toBe(true);
    expect(g.s.arrows).toBe(before);
  });

  it('lets a full draw down without loosing, keeping the arrow and the trick on it', () => {
    const g = newRange({ seed: 1 });
    startRound(g, 0);
    g.s.tricks = ['emp'];
    nockTrick(g);
    draw(g, true);
    steps(g, 1);
    letDown(g);
    const ev = steps(g, 0.2);
    expect(g.s.drawing).toBe(false);
    expect(g.s.arrows).toBe(ROUNDS[0].arrows);
    expect(g.s.flying.length).toBe(0);
    expect(g.s.nocked).toBe('emp');
    expect(ev.some((e) => e.type === 'letDown')).toBe(true);
  });

  it('shakes the aim after holding a full draw too long', () => {
    const g = newRange({ seed: 1 });
    startRound(g, 0);
    draw(g, true);
    steps(g, BOW.drawTime + BOW.shakeAfter + 2);
    expect(g.s.full).toBeGreaterThan(BOW.shakeAfter);
  });

  it('scores rings from 10 at the middle to 1 at the edge', () => {
    expect(ringScore(0, 0.5)).toEqual({ score: 10, x: true });
    expect(ringScore(0.49, 0.5).score).toBe(1);
    expect(ringScore(0.6, 0.5)).toBe(0);
  });
});

describe('Trick Shot: trick arrows', () => {
  it('earns one every three hits in a row', () => {
    const g = newRange({ seed: 3 });
    startRound(g, 0);
    g.s.wind = 0;
    const t = g.s.targets[0];
    for (let i = 0; i < 3; i++) shoot(g, aimFor(targetAt(t, g.s)));
    expect(g.s.tricks).toEqual(['explosive']);
  });

  it('splits into three', () => {
    const g = newRange({ seed: 3 });
    startRound(g, 0);
    g.s.tricks = ['split'];
    nockTrick(g);
    draw(g, true);
    steps(g, 1);
    draw(g, false);
    expect(g.s.flying.length).toBe(3);
    expect(g.s.arrows).toBe(ROUNDS[0].arrows - 1);
  });

  it('stops everything moving with an EMP, then lets it go', () => {
    const g = newRange({ seed: 3 });
    startRound(g, 1);
    g.s.tricks = ['emp'];
    nockTrick(g);
    g.s.wind = 0;
    const board = g.s.targets[2];
    shoot(g, aimFor(targetAt(board, g.s)), { fly: 1.2 });
    expect(g.s.emp).toBeGreaterThan(0);
    const mover = g.s.targets[0];
    const a = targetAt(mover, g.s).x;
    steps(g, 1);
    expect(targetAt(mover, g.s).x).toBeCloseTo(a, 6);
    steps(g, 4);
    expect(targetAt(mover, g.s).x).not.toBeCloseTo(a, 2);
  });

  it('blows up everything near an explosive arrow’s hit', () => {
    const g = newRange({ seed: 3 });
    startRound(g, 2);
    g.s.tricks = ['explosive'];
    nockTrick(g);
    g.s.wind = 0;
    // a drone right next to the far board
    const board = g.s.targets[2];
    const p = targetAt(board, g.s);
    g.s.drones = [{ id: 0, x: p.x + 1, y: p.y + 0.5, z: p.z, alive: true, phase: 0 }];
    g.s.emp = 99; // hold it still
    const ev = shoot(g, aimFor(p), { fly: 1.5 });
    expect(ev.some((e) => e.type === 'blast')).toBe(true);
    expect(ev.some((e) => e.type === 'hit' && e.kind === 'drone')).toBe(true);
  });
});

describe('Trick Shot: rounds', () => {
  it('lobs a half draw over the hay wall onto the hidden board', () => {
    const g = newRange({ seed: 1 });
    startRound(g, 2);
    g.s.wind = 0;
    toggleLob(g);
    const hidden = g.s.targets[0];
    const p = targetAt(hidden, g.s);
    const aim = aimFor(p, { speed: speedFor(drawCap(g.s)) });
    const ev = shoot(g, aim, { hold: 2, fly: 3 });
    expect(ev.some((e) => e.type === 'wall')).toBe(false);
    expect(ev.find((e) => e.type === 'ring')?.target).toBe(hidden.id);
  });

  it('holds a half draw steady at the half', () => {
    const g = newRange({ seed: 1 });
    startRound(g, 0);
    toggleLob(g);
    draw(g, true);
    steps(g, 1.5);
    expect(g.s.draw).toBeCloseTo(drawFor(BOW.lobSpeed), 6);
    expect(speedFor(g.s.draw)).toBeCloseTo(BOW.lobSpeed, 3);
  });

  it('puts the sight’s pins where the arrow goes', () => {
    const g = newRange({ seed: 1 });
    startRound(g, 0);
    g.s.targets = [];
    g.s.wind = 0.8;
    g.s.windDir = 1;
    const aim = { x: 0.02, y: 0.06, z: -1 };
    const ev = shoot(g, aim, { fly: 4 });
    const miss = ev.find((e) => e.type === 'miss');
    const at = pathAt(aim, BOW.maxSpeed, miss.z, 0.8);
    expect(at.x).toBeCloseTo(miss.x, 1);
    expect(at.y).toBeCloseTo(miss.y, 1);
  });

  it('stops an arrow in the hay wall in front of a hidden board', () => {
    const g = newRange({ seed: 1 });
    startRound(g, 2);
    g.s.wind = 0;
    const hidden = g.s.targets[0];
    const p = targetAt(hidden, g.s);
    // straight at it (a flat shot): the wall takes it
    const flat = { x: p.x, y: p.y - EYE, z: p.z };
    const l = Math.hypot(flat.x, flat.y, flat.z);
    const ev = shoot(g, { x: flat.x / l, y: flat.y / l + 0.01, z: flat.z / l }, { fly: 1.5 });
    expect(ev.some((e) => e.type === 'wall')).toBe(true);
  });

  it('ends a round when the arrows run out', () => {
    const g = newRange({ seed: 1 });
    startRound(g, 0);
    let ev = [];
    for (let i = 0; i < ROUNDS[0].arrows; i++) ev = ev.concat(shoot(g, { x: 0, y: -0.3, z: -1 }, { fly: 0.2 }));
    expect(ev.some((e) => e.type === 'roundEnd')).toBe(true);
    expect(g.phase).toBe('roundEnd');
    expect(g.s.time).toBeGreaterThan(0);
  });

  it('ends a round when time runs out, and an idle archer scores nothing', () => {
    const g = newRange({ seed: 1 });
    startRound(g, 0);
    const ev = steps(g, ROUNDS[0].time + 1);
    expect(ev.find((e) => e.type === 'roundEnd').score).toBe(0);
  });

  for (const seed of [1, 2, 3]) {
    it(`gives a good archer Clint’s half of the Soul Stone (seed ${seed})`, () => {
      const g = newRange({ seed });
      let ev = [];
      for (let r = 0; r < ROUNDS.length; r++) {
        ev = ev.concat(startRound(g, r));
        ev = ev.concat(steps(g, ROUNDS[r].time + 5, archer));
      }
      const end = ev.filter((e) => e.type === 'roundEnd').at(-1);
      expect(end.last).toBe(true);
      expect(g.total).toBeGreaterThanOrEqual(STONE_SCORE);
      expect(end.stone).toBe(true);
    });
  }

  it('plays the same way from the same seed', () => {
    const play = () => {
      const g = newRange({ seed: 7 });
      startRound(g, 1);
      steps(g, 30, archer);
      return [g.s.score, g.s.hits, g.s.shots];
    };
    expect(play()).toEqual(play());
  });

  const FAIR = 0.0125; // the tests’ archer at about 71 % hits: §9’s “fair player”
  const game = (seed, noise) => {
    const g = newRange({ seed });
    for (let r = 0; r < ROUNDS.length; r++) {
      startRound(g, r);
      steps(g, ROUNDS[r].time + 5, (q) => archer(q, { noise }));
    }
    return g;
  };
  const wins = (noise) => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((seed) => game(seed, noise).total >= STONE_SCORE).length;

  for (const noise of [0, FAIR]) {
    it(`keeps an archer shooting until the clock ends, every round (noise ${noise})`, () => {
      const g = newRange({ seed: 1 });
      for (let r = 0; r < ROUNDS.length; r++) {
        startRound(g, r);
        steps(g, ROUNDS[r].time + 5, (q) => archer(q, { noise }));
        expect(g.s.t).toBeGreaterThanOrEqual(40);
        expect(g.s.t).toBeGreaterThanOrEqual(ROUNDS[r].time);
        expect(g.s.arrows).toBeGreaterThan(0);
      }
    });
  }
  it('keeps the stone from an archer who does nothing', () => {
    const g = newRange({ seed: 1 });
    let ev = [];
    for (let r = 0; r < ROUNDS.length; r++) ev = ev.concat(startRound(g, r), steps(g, ROUNDS[r].time + 1));
    const end = ev.filter((e) => e.type === 'roundEnd').at(-1);
    expect(end.last).toBe(true);
    expect(end.stone).toBe(false);
    expect(g.total).toBe(0);
  });
  it('gives a fair archer the stone about once in two or three tries', () => {
    const n = wins(FAIR);
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(5); // 3 of 10 here; 16 of 40 over seeds 1–40
  });
  it('gives a steadier archer the stone on most seeds', () => {
    expect(wins(0.01)).toBeGreaterThanOrEqual(8); // 10 of 10: totals 640–841 over seeds 1–40
  });
});

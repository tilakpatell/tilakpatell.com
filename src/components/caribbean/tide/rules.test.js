import { describe, expect, it } from 'vitest';
import { ARM, CHAPTERS, ISLES, SHIPS, STEP_BOUND, TIDE, UPS, bearing, choose, fire, fitted, newGame, progress, shipStep, step, wrap } from './rules';
import { readStep, writeStep } from '../../middleearth/towns/travellers';
import { autopilot } from './pilot';

const DT = 1 / 60;
const run = (g, seconds, each) => {
  for (let i = 0; i < seconds / DT; i++) {
    each?.(g);
    step(g, DT);
  }
};
// sink everything afloat, as if the player had
const sinkAll = (g) => {
  g.reserve = [];
  for (const s of g.ships) if (!s.sunk) s.hp = 0;
  for (const s of g.ships) if (!s.sunk) s.sunk = 0.001;
};
// straight to chapter i, with whatever it spawns
const at = (i, opts) => {
  const g = newGame(opts);
  g.ships.length = 0;
  g.pickups.length = 0;
  g.chapter = i - 1;
  step(g, DT);
  choose(g, g.offer[0]);
  g.events.length = 0;
  return g;
};
const foe = (g, kind, x, y, a = 0) => {
  const k = SHIPS[kind];
  const s = { id: g.id++, kind, x, y, a, v: 0, rudder: 0, sail: 1, hp: k.hp, max: k.hp, len: k.len, beam: k.beam, r: k.len * 0.4, speed: 0, turn: 0, guns: k.guns, dmg: k.dmg, reloadTime: 99, reload: [99, 99], hit: 0, sunk: 0, under: 0, side: 1, flip: 99, aim: null, ram: 0 };
  g.ships.push(s);
  return s;
};
// a game with the navy cleared away, to try one thing at a time (one hulk
// left far off, so the chapter isn't over)
const calm = (opts) => {
  const g = newGame(opts);
  g.ships.length = 0;
  foe(g, 'sloop', -480, -200);
  g.events.length = 0;
  return g;
};

describe('the chart', () => {
  it('keeps the islands on the sea and apart', () => {
    for (const a of ISLES) {
      expect(Math.hypot(a.x, a.y) + a.r).toBeLessThan(TIDE.R);
      for (const b of ISLES) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.r + b.r + 60);
    }
  });
  it('starts you clear of every island', () => {
    const g = newGame();
    for (const i of ISLES) expect(Math.hypot(g.p.x - i.x, g.p.y - i.y)).toBeGreaterThan(i.r + 60);
  });
  it('wraps an angle into -π…π', () => {
    expect(wrap(Math.PI * 3)).toBeCloseTo(-Math.PI);
    expect(wrap(-0.2)).toBeCloseTo(-0.2);
    expect(wrap(Math.PI * 2 + 0.3)).toBeCloseTo(0.3);
  });
});

describe('sailing', () => {
  it('plays the same way twice from a seed', () => {
    const a = newGame({ seed: 7 });
    const b = newGame({ seed: 7 });
    run(a, 20, autopilot);
    run(b, 20, autopilot);
    expect([a.p.x, a.p.y, a.p.hp, a.gold, a.ships.length]).toEqual([b.p.x, b.p.y, b.p.hp, b.gold, b.ships.length]);
  });
  it('gathers way under sail and loses it furled', () => {
    const g = calm();
    g.input.sail = 2;
    run(g, 8);
    const full = g.p.v;
    expect(full).toBeGreaterThan(SHIPS.pearl.speed * 0.7);
    g.input.sail = 0;
    run(g, 8);
    expect(g.p.v).toBeLessThan(full * 0.1);
  });
  it('is faster before the wind than into it', () => {
    const speed = (a) => {
      const g = calm();
      g.p.x = 0;
      g.p.y = 0;
      g.p.a = a;
      g.input.sail = 2;
      run(g, 10);
      return g.p.v;
    };
    const g = calm();
    expect(speed(g.wind.a)).toBeGreaterThan(speed(g.wind.a + Math.PI) * 1.3);
  });
  it('turns to starboard on a positive helm', () => {
    const g = calm();
    const a0 = g.p.a;
    g.input.sail = 2;
    g.input.steer = 1;
    run(g, 2);
    expect(wrap(g.p.a - a0)).toBeGreaterThan(0.3);
  });
  it('stops at an island and hurts if you hit it at speed', () => {
    const g = calm();
    const isle = ISLES[3];
    g.p.x = isle.x - isle.r - 70;
    g.p.y = isle.y;
    g.p.a = 0;
    g.input.sail = 2;
    run(g, 9);
    expect(Math.hypot(g.p.x - isle.x, g.p.y - isle.y)).toBeGreaterThanOrEqual(isle.r);
    expect(g.p.hp).toBeLessThan(g.p.max);
    expect(g.events.some((e) => e.type === 'aground')).toBe(true);
  });
  it('is turned back by the fog at the edge', () => {
    const g = calm();
    g.p.x = TIDE.R - 20;
    g.p.y = 0;
    g.p.a = 0;
    g.input.sail = 2;
    run(g, 6);
    expect(Math.hypot(g.p.x, g.p.y)).toBeLessThanOrEqual(TIDE.R + 0.01);
  });
});

describe('the guns', () => {
  it('fires one ball a gun, then has to reload', () => {
    const g = calm();
    expect(fire(g, 1)).toBe(true);
    expect(fire(g, 1)).toBe(false);
    run(g, 1);
    expect(g.stats.shots).toBe(fitted(g).guns);
    expect(g.events.filter((e) => e.type === 'gun')).toHaveLength(fitted(g).guns);
    run(g, fitted(g).reload);
    expect(fire(g, 1)).toBe(true);
  });
  it('loads each side on its own', () => {
    const g = calm();
    fire(g, 1);
    expect(fire(g, -1)).toBe(true);
  });
  it('sees what is abeam and not what is ahead', () => {
    const g = calm();
    g.p.x = 0;
    g.p.y = 0;
    g.p.a = 0;
    const s = foe(g, 'sloop', 0, 90); // off the starboard beam (y is south, starboard of east)
    expect(bearing(g).star?.m.ship).toBe(s);
    expect(bearing(g).port).toBeNull();
    s.x = 90;
    s.y = 0;
    expect(bearing(g).star).toBeNull();
    s.x = 0;
    s.y = -90;
    expect(bearing(g).port?.m.ship).toBe(s);
    s.y = -(fitted(g).range + 60);
    expect(bearing(g).port).toBeNull();
  });
  it('sinks a sloop with broadsides and floats up a chest', () => {
    const g = calm();
    g.p.x = 0;
    g.p.y = 0;
    g.p.a = 0;
    g.input.sail = 0;
    const s = foe(g, 'sloop', 0, 80, 0);
    run(g, 14, () => fire(g, 1));
    expect(s.sunk).toBeGreaterThan(0);
    expect(g.stats.hits).toBeGreaterThan(4);
    expect(g.gold).toBeGreaterThan(0);
    expect(g.pickups.some((c) => c.kind === 'chest')).toBe(true);
  });
  it('leads a ship that is under way', () => {
    const g = calm();
    g.p.x = 0;
    g.p.y = 0;
    g.p.a = 0;
    g.input.sail = 0;
    const s = foe(g, 'navy', -30, 100, 0);
    s.speed = 16;
    s.v = 16;
    s.hp = 999;
    const sailOn = () => {
      s.x += s.v * DT;
    };
    fire(g, 1);
    run(g, 2, sailOn);
    expect(g.stats.hits).toBeGreaterThan(1);
  });
  it('is stopped by an island in the way', () => {
    const g = calm();
    const isle = ISLES[4];
    g.p.x = isle.x;
    g.p.y = isle.y - isle.r - 40;
    g.p.a = 0; // starboard beam points south, at the island
    g.input.sail = 0;
    fire(g, 1);
    run(g, 2);
    expect(g.events.some((e) => e.type === 'thud')).toBe(true);
  });
});

describe('the navy', () => {
  it('closes, warns, and fires on you', () => {
    const g = newGame({ seed: 3 });
    g.input.sail = 0;
    run(g, 50);
    expect(g.events.some((e) => e.type === 'aim')).toBe(true);
    expect(g.events.some((e) => e.type === 'broadside' && e.owner === 'e')).toBe(true);
    expect(g.p.hp).toBeLessThan(g.p.max);
  });
  it('keeps off the islands', () => {
    const g = newGame({ seed: 11 });
    run(g, 60, autopilot);
    for (const s of g.ships) for (const i of ISLES) expect(Math.hypot(s.x - i.x, s.y - i.y)).toBeGreaterThanOrEqual(i.r);
  });
  it('sinks you when the hull is gone, after a moment', () => {
    const g = newGame();
    g.p.hp = 1;
    g.balls.push({ id: 999, x: g.p.x, y: g.p.y, vx: 0, vy: 0, t: 0, life: 1, owner: 'e', dmg: 50 });
    step(g, DT);
    expect(g.p.sunk).toBeGreaterThan(0);
    expect(g.status).toBe('sail');
    run(g, 4);
    expect(g.status).toBe('lost');
    expect(g.result.won).toBe(false);
  });
});

describe('the voyage', () => {
  it('offers three refits after a chapter and moves on when one is picked', () => {
    const g = newGame();
    sinkAll(g);
    step(g, DT);
    expect(g.status).toBe('pick');
    expect(g.offer).toHaveLength(3);
    for (const id of g.offer) expect(UPS[id]).toBeTruthy();
    expect(choose(g, 'nonsense')).toBe(false);
    const id = g.offer[0];
    expect(choose(g, id)).toBe(true);
    expect(g.ups[id]).toBe(1);
    expect(g.status).toBe('sail');
    expect(g.chapter).toBe(1);
    expect(g.pickups.filter((c) => c.quest)).toHaveLength(4);
    expect(progress(g)).toEqual([0, 4]);
  });
  it('makes the refits count', () => {
    const g = newGame();
    const before = fitted(g);
    g.ups = { guns: 2, reload: 1, shot: 1, range: 1, hull: 1, sails: 1 };
    const after = fitted(g);
    expect(after.guns).toBe(before.guns + 2);
    expect(after.reload).toBeLessThan(before.reload);
    expect(after.dmg).toBeGreaterThan(before.dmg);
    expect(after.range).toBeGreaterThan(before.range);
    expect(after.max).toBe(before.max + 30);
    expect(after.speed).toBeGreaterThan(before.speed);
  });
  it('ends the chest chapter when the last chest is aboard', () => {
    const g = newGame();
    sinkAll(g);
    step(g, DT);
    choose(g, g.offer[0]);
    for (const c of g.pickups.filter((q) => q.quest)) {
      g.p.x = c.x;
      g.p.y = c.y;
      step(g, DT);
    }
    expect(g.stats.chests).toBe(4);
    expect(g.status).toBe('pick');
    expect(g.ships.every((s) => s.sunk || s.flee)).toBe(true);
  });
  it('has the fort drop mortars where you are going', () => {
    const g = at(2, { seed: 5 });
    expect(CHAPTERS[g.chapter].id).toBe('fort');
    g.ships.length = 0;
    g.p.x = g.fort.x - 200;
    g.p.y = g.fort.y;
    g.input.sail = 0;
    run(g, 12);
    expect(g.events.some((e) => e.type === 'mortar')).toBe(true);
    expect(g.events.some((e) => e.type === 'boom')).toBe(true);
    expect(g.p.hp).toBeLessThan(g.p.max);
  });
  it('has the kraken warn, raise an arm, and bring it down on a ship that stays put', () => {
    const g = at(4, { seed: 9 });
    expect(CHAPTERS[g.chapter].id).toBe('kraken');
    g.input.sail = 0;
    g.p.v = 0;
    const hp = g.p.hp;
    run(g, 4 + ARM.warn + ARM.rise + ARM.hold + ARM.slam + 1.5);
    for (const type of ['arms', 'arm', 'slam']) expect(g.events.some((e) => e.type === type)).toBe(true);
    expect(g.p.hp).toBeLessThan(hp);
  });
  it('is won when the kraken dies', () => {
    const g = at(4, { seed: 9 });
    g.kraken.phase = 'head';
    g.kraken.up = 1;
    g.kraken.t = 99;
    g.kraken.hp = 5;
    g.p.x = g.kraken.x;
    g.p.y = g.kraken.y - 70;
    g.p.a = 0;
    g.input.sail = 0;
    run(g, 6, () => fire(g, 1));
    expect(g.status).toBe('won');
    expect(g.result.won).toBe(true);
    expect(g.result.gold).toBeGreaterThan(3000);
  });
});

// The whole voyage, played by the autopilot: it should get through on the
// easy setting, in a sensible time, and meet every chapter on the way.
describe('a voyage by the autopilot', () => {
  const voyage = (seed, level) => {
    const g = newGame({ seed, level });
    const seen = new Set();
    for (let i = 0; i < (15 * 60) / DT && g.status !== 'won' && g.status !== 'lost'; i++) {
      if (g.status === 'pick') choose(g, g.offer[0]);
      autopilot(g);
      step(g, DT);
      seen.add(g.chapter);
      g.events.length = 0;
    }
    return { g, seen };
  };
  it('wins as a deckhand', () => {
    let wins = 0;
    for (const seed of [1, 2, 3, 4]) {
      const { g, seen } = voyage(seed, 'easy');
      if (g.status === 'won') {
        wins += 1;
        expect(seen.size).toBe(CHAPTERS.length);
        expect(g.stats.time).toBeGreaterThan(150);
        expect(g.stats.time).toBeLessThan(13 * 60);
      }
    }
    expect(wins).toBeGreaterThanOrEqual(3);
  });
  it('never hangs: a game is always won or lost', () => {
    for (const level of ['normal', 'hard']) {
      const { g } = voyage(21, level);
      expect(['won', 'lost']).toContain(g.status);
    }
  });
});

describe('Dead man’s tide: the other players', () => {
  it('sends a ship as a traveller’s step, and reads it back where she is', () => {
    // out at the edge of the sea, after a lot of turning
    const s = { x: TIDE.R * 0.6, y: -TIDE.R * 0.8, a: 7.4, v: 21.5 };
    const step = shipStep(s);
    expect(step).toMatchObject({ x: s.x, z: s.y, speed: 21.5 });
    expect(Math.abs(step.face)).toBeLessThanOrEqual(Math.PI);
    // the model's bow (its −x) turned by the facing points the way she's heading
    expect(-Math.cos(step.face)).toBeCloseTo(Math.cos(s.a), 9);
    expect(Math.sin(step.face)).toBeCloseTo(Math.sin(s.a), 9);
    const back = readStep(writeStep(step), STEP_BOUND);
    expect(back.x).toBeCloseTo(s.x, 2);
    expect(back.z).toBeCloseTo(s.y, 2);
    expect(Math.cos(back.face - step.face)).toBeGreaterThan(0.9999);
    expect(back.moving).toBe(true);
  });
  it('keeps the whole sea inside the room’s bound', () => {
    expect(STEP_BOUND).toBeGreaterThan(TIDE.R);
    const back = readStep(writeStep(shipStep({ x: -TIDE.R, y: TIDE.R * 0.01, a: 0, v: 0 })), STEP_BOUND);
    expect(back.x).toBe(-TIDE.R);
    expect(back.moving).toBe(false);
  });
});

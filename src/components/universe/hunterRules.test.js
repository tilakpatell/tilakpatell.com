import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hullOf } from '../../lib/combat/hulls';
import { BOMB, FACTIONS, FIGHT, HOLDOFF, HUNTER_KINDS, HUNTER_SENSES, LOSE, NAMES, SHIP_R, TRAITS, blocked, clearOf, createHunt, entryPoint, fightSpeed, hitRadius, packPlan, shipVelocity, slotsFor, turnRate, turnRateAt, turnToward } from './hunterRules';
import { KINDS as GALAXY_KINDS, FACTIONS as GALAXY_FACTIONS } from '../galaxy/hunted';
import { PACE, SHIP } from './ship';
import { nose, sweptHit } from './targeting';
import { POWERS } from './shipPowers';

// a seeded random, so a fight is the same every time
const seeded = (seed = 7) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const DT = 1 / 60;
const start = (over = {}) => ({ x: 0, y: 0, z: 0, heading: 0, pitch: 0, speed: 0, vy: 0, ...over });
// the ship a frame on, flying along its nose
const move = (s) => {
  const level = Math.cos(s.pitch);
  const vy = Math.sin(s.pitch) * s.speed;
  return { ...s, x: s.x - Math.sin(s.heading) * level * s.speed * DT, y: s.y + vy * DT, z: s.z - Math.cos(s.heading) * level * s.speed * DT, vy };
};
// a fight flown for `seconds`: fly(ship, t) steers; each(hunt, ship, t) looks
// at every frame. Returns what happened, counted.
function fight({ seed = 7, seconds = 60, fly = (s) => s, opts = { size: 4, ace: false }, faction = 'empire', solids = [], ship = start(), each = null, kinds, factions } = {}) {
  const hunt = createHunt({ rand: seeded(seed), solids, kinds, factions });
  let s = ship;
  hunt.pack(faction, s, opts);
  const seen = { shots: 0, hits: 0, events: [], hunt };
  for (let t = 0; t < seconds; t += DT) {
    s = move(fly(s, t));
    for (const e of hunt.update(DT, s)) {
      if (e.type === 'shot') seen.shots += 1;
      else if (e.type === 'laser') seen.hits += 1;
      else seen.events.push(e.type);
    }
    each?.(hunt, s, t);
  }
  seen.ship = s;
  return seen;
}
const apart = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe('who comes', () => {
  it('sends a small pack with no ace the first time, and more of them the more trouble you make', () => {
    const f = FACTIONS.empire;
    for (let i = 0; i < 40; i++) {
      const first = packPlan(f, { first: true, heat: 5, rand: seeded(i + 1) });
      expect(first).toHaveLength(f.size[0]);
      expect(first).not.toContain(f.ace);
    }
    const mean = (heat) => {
      let n = 0;
      let aces = 0;
      for (let i = 0; i < 300; i++) {
        const kinds = packPlan(f, { heat, rand: seeded(i * 13 + 5) });
        expect(kinds.length).toBeGreaterThanOrEqual(f.size[0]);
        expect(kinds.length).toBeLessThanOrEqual(f.size[1]);
        n += kinds.length;
        aces += kinds.includes(f.ace) ? 1 : 0;
      }
      return { n: n / 300, aces: aces / 300 };
    };
    const calm = mean(0);
    const hot = mean(5);
    expect(hot.n).toBeGreaterThan(calm.n + 0.6);
    expect(hot.aces).toBeGreaterThan(calm.aces * 2);
    expect(calm.aces).toBeGreaterThan(0.03);
  });

  it('takes a size and an ace as given', () => {
    expect(packPlan(FACTIONS.empire, { size: 3, ace: true, rand: seeded() })).toEqual(['tieadvanced', expect.any(String), expect.any(String)]);
    expect(packPlan(FACTIONS.bugs, { size: 2, ace: true, rand: seeded() })).toEqual(['gromflomite', 'gromflomite']); // (no ace to send)
    expect(packPlan(FACTIONS.empire, { size: 4, ace: false, heat: 5, rand: seeded() })).not.toContain('tieadvanced');
  });

  it('lets only some of a pack attack at once', () => {
    expect([1, 2, 3, 4, 5, 6].map(slotsFor)).toEqual([1, 2, 2, 2, 3, 3]);
  });

  it('knows every kind a faction can send, here and in the galaxy', () => {
    for (const [factions, kinds] of [
      [FACTIONS, HUNTER_KINDS],
      [GALAXY_FACTIONS, GALAXY_KINDS],
    ]) {
      for (const f of Object.values(factions)) for (const k of [...f.kinds.map(([id]) => id), f.ace].filter(Boolean)) expect(kinds[k], k).toBeTruthy();
      // (each turns quicker than you do, 2 radians a second, so you can't just out-turn one)
      for (const type of Object.values(kinds)) expect(turnRate(type)).toBeGreaterThan(2);
    }
  });
});

describe('a bounty hunter', () => {
  it('comes alone, tough and quick, for either universe', () => {
    expect(packPlan(FACTIONS.fett, { size: 1, rand: seeded() })).toEqual(['slave1']);
    expect(packPlan(FACTIONS.phoenix, { size: 1, rand: seeded() })).toEqual(['phoenixperson']);
    expect(FACTIONS.fett.family).toBe('starwars');
    expect(FACTIONS.phoenix.family).toBe('rickmorty');
    for (const kind of ['slave1', 'phoenixperson']) {
      expect(HUNTER_KINDS[kind].hp).toBeGreaterThanOrEqual(5);
      expect(HUNTER_KINDS[kind].speed).toBeGreaterThan(SHIP.boost); // (faster than you boost: no outrunning one)
      expect(NAMES[kind]).toBeTruthy();
    }
    // and Slave I lands shots, and takes every one of its hits
    const seen = fight({ faction: 'fett', opts: { size: 1 }, seconds: 60 });
    expect(seen.shots).toBeGreaterThan(5);
    const h = seen.hunt.live[0];
    const through = () => seen.hunt.hit({ x: h.pos.x - 3, y: h.pos.y, z: h.pos.z }, { x: h.pos.x + 3, y: h.pos.y, z: h.pos.z }, 1);
    for (let i = 0; i < HUNTER_KINDS.slave1.hp - 1; i++) expect(through()?.down).toBeFalsy();
    expect(through()?.down).toBe(true);
  });
});

describe('where they come in', () => {
  const moon = { id: 'moon', at: [0, 0, 30], r: 9 };
  it('comes in behind you, ahead of you or out of portals, and never inside anything solid', () => {
    const ship = start();
    for (const mode of [{}, { ahead: true }, { portal: true }]) {
      for (let i = 0; i < 5; i++) {
        const p = entryPoint(ship, i, 5, { ...mode, rand: seeded(i + 3), solids: [moon, { id: 'rock', at: [0, 0, -40], r: 12 }] });
        const ahead = -p.z; // (the nose is along −z)
        if (mode.ahead || mode.portal) expect(ahead).toBeGreaterThan(5);
        else expect(ahead).toBeLessThan(-15);
        expect(apart(p, { x: 0, y: 0, z: 30 })).toBeGreaterThanOrEqual(moon.r + 1.99);
        expect(apart(p, { x: 0, y: 0, z: -40 })).toBeGreaterThanOrEqual(12 + 1.99);
      }
    }
  });

  it('waits round a point it is given (an ambush at your off-ramp), never inside anything solid', () => {
    const ship = start({ x: 500, z: 500, heading: 1.2 });
    const at = { x: -40, y: 10, z: 60 };
    const solids = [moon, { id: 'rock', at: [-40, 10, 85], r: 14 }];
    for (let i = 0; i < 6; i++) {
      const p = entryPoint(ship, i, 6, { at, rand: seeded(i + 1), solids });
      expect(apart(p, at), `${i}`).toBeLessThanOrEqual(40);
      for (const o of solids) expect(apart(p, { x: o.at[0], y: o.at[1], z: o.at[2] }), `${i} ${o.id}`).toBeGreaterThanOrEqual(o.r + 1.99);
    }
    // (spread round it, not stacked)
    const ps = Array.from({ length: 4 }, (_, i) => entryPoint(ship, i, 4, { at, rand: seeded(9) }));
    for (let i = 1; i < ps.length; i++) expect(apart(ps[i], ps[i - 1])).toBeGreaterThan(4);
  });

  it('lays an ambush `lead` further along, where you will be once they have the drive down', () => {
    const ship = start();
    const near = entryPoint(ship, 0, 3, { ahead: true, rand: seeded(5) });
    const far = entryPoint(ship, 0, 3, { ahead: true, lead: 250, rand: seeded(5) });
    expect(-far.z - -near.z).toBeCloseTo(250, 6);
    expect(far.x).toBeCloseTo(near.x, 6);
    // (behind you, a lead's nothing to do with it)
    expect(entryPoint(ship, 0, 3, { lead: 250, rand: seeded(5) })).toEqual(entryPoint(ship, 0, 3, { rand: seeded(5) }));
  });

  it('moves a point out of a solid the way it already is from its middle', () => {
    const p = clearOf({ x: 1, y: 0, z: 30 }, [moon], 2);
    expect(apart(p, { x: 0, y: 0, z: 30 })).toBeCloseTo(11, 6);
    expect(p.x).toBeCloseTo(11, 6);
    expect(clearOf({ x: 50, y: 0, z: 0 }, [moon])).toEqual({ x: 50, y: 0, z: 0 });
    // out of one and into its neighbour: out of that too
    const pair = [moon, { id: 'twin', at: [12, 0, 30], r: 9 }];
    const q = clearOf({ x: 5, y: 0.5, z: 30 }, pair, 2);
    for (const o of pair) expect(apart(q, { x: o.at[0], y: o.at[1], z: o.at[2] })).toBeGreaterThanOrEqual(o.r + 2 - 1e-6);
  });
});

describe('how they turn', () => {
  it('turns a direction toward another by no more than it may, the short way', () => {
    const d = [0, 0, -1];
    expect(turnToward(d, [1, 0, 0], 0.1)).toBeCloseTo(0.1, 6);
    expect(Math.atan2(d[0], -d[2])).toBeCloseTo(0.1, 6);
    expect(Math.hypot(...d)).toBeCloseTo(1, 6);
    // near enough: all the way, and no further
    const e = [0, 0, -1];
    turnToward(e, [Math.sin(0.05), 0, -Math.cos(0.05)], 0.1);
    expect(e[0]).toBeCloseTo(Math.sin(0.05), 6);
  });

  it('turns a small angle toward it too, however little it may turn in a frame', () => {
    // (a 240 Hz frame: the angle left is tiny, and so is the turn allowed)
    const d = [Math.sin(0.018), 0, -Math.cos(0.018)];
    turnToward(d, [0, 0, -1], 0.01);
    expect(Math.atan2(d[0], -d[2])).toBeCloseTo(0.008, 6);
  });

  it('comes round from dead astern, level, to its own side', () => {
    for (const side of [1, -1]) {
      const d = [0, 0, -1];
      let turned = 0;
      for (let i = 0; i < 400 && turned < Math.PI - 1e-3; i++) turned += turnToward(d, [0, 0, 1], 0.05, side);
      expect(d[2]).toBeCloseTo(1, 3);
      expect(turned).toBeCloseTo(Math.PI, 2);
      const first = [0, 0, -1];
      turnToward(first, [0, 0, 1], 0.05, side);
      expect(Math.sign(first[0])).toBe(side);
      expect(first[1]).toBeCloseTo(0, 6);
    }
  });
});

describe('what they know of you', () => {
  it('reads the way you are really going, climbing and diving too', () => {
    expect(shipVelocity({ heading: 0, pitch: 0, speed: 10, vy: 0 })).toEqual([-0, 0, -10]);
    const up = shipVelocity({ heading: 0, pitch: 1, speed: 10 }); // (no vy given: along the nose)
    expect(up[1]).toBeCloseTo(10 * Math.sin(1), 6);
    expect(up[2]).toBeCloseTo(-10 * Math.cos(1), 6);
    expect(shipVelocity({ heading: 0, pitch: 1, speed: 10, vy: 3 })[1]).toBe(3); // (the ship's own word for it)
  });

  it('knows when something solid is in the way', () => {
    const moon = [{ at: [0, 0, 0], r: 5 }];
    expect(blocked({ x: -20, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }, moon)).toBe(true);
    expect(blocked({ x: -20, y: 6, z: 0 }, { x: 20, y: 6, z: 0 }, moon)).toBe(false);
    expect(blocked({ x: -20, y: 0, z: 0 }, { x: -10, y: 0, z: 0 }, moon)).toBe(false); // (it stops short of it)
  });
});

describe('the pace of a fight', () => {
  const tie = HUNTER_KINDS.tie;
  const interceptor = HUNTER_KINDS.interceptor;
  it('flies the fight at a little over your speed, never under its floor nor over its top', () => {
    // at cruise, close in: near you, not its top
    expect(fightSpeed(tie, SHIP.cruise, 8)).toBeLessThan(11 * PACE);
    expect(fightSpeed(tie, SHIP.cruise, 8)).toBeGreaterThan(SHIP.cruise);
    // sitting still: the floor
    expect(fightSpeed(tie, 0, 8)).toBeCloseTo(tie.speed * FIGHT.floor, 9);
    // boosting: a TIE flat out (you can outrun one), an interceptor with you
    expect(fightSpeed(tie, SHIP.boost, 8)).toBe(tie.speed);
    expect(fightSpeed(interceptor, SHIP.boost, 8)).toBeGreaterThan(SHIP.boost);
    expect(fightSpeed(interceptor, SHIP.boost, 8)).toBeLessThanOrEqual(interceptor.speed);
    // far off, it comes in flat out whatever you're doing; between, in between
    expect(fightSpeed(tie, 0, FIGHT.closeFrom + 5)).toBe(tie.speed);
    const mid = fightSpeed(tie, 0, (FIGHT.engageAt + FIGHT.closeFrom) / 2);
    expect(mid).toBeGreaterThan(tie.speed * FIGHT.floor);
    expect(mid).toBeLessThan(tie.speed);
  });

  it('turns a little quicker than you at the fight’s speed, and less at its top', () => {
    for (const type of Object.values(HUNTER_KINDS)) {
      expect(turnRate(type)).toBeGreaterThan(2);
      expect(turnRate(type)).toBeLessThan(3.3);
      expect(turnRateAt(type, type.speed * FIGHT.floor)).toBeCloseTo(turnRate(type), 9);
      expect(turnRateAt(type, type.speed)).toBeCloseTo(turnRate(type) * (1 - FIGHT.stiff), 9);
      expect(turnRateAt(type, type.speed * 2)).toBeCloseTo(turnRate(type) * (1 - FIGHT.stiff), 9);
    }
  });

  it('is flown at your pace: at cruise, the ones coming at you are slow enough to follow, and still shoot', () => {
    const near = { run: [0, 0], set: [0, 0] };
    let fastestRun = 0;
    let shots = 0;
    for (const seed of [7, 12]) {
      const seen = fight({
        seed,
        seconds: 50,
        fly: (s) => ({ ...s, speed: SHIP.cruise, heading: s.heading + 0.3 * DT }),
        each: (hunt, s, t) => {
          if (t < 6) return; // (in from where they came)
          for (const h of hunt.live) {
            if (apart(h.pos, s) > FIGHT.engageAt) continue;
            const v = Math.hypot(h.vel.x, h.vel.y, h.vel.z);
            const k = h.mode === 'set' ? 'set' : 'run';
            near[k][0] += v;
            near[k][1] += 1;
            if (k === 'run') fastestRun = Math.max(fastestRun, v);
          }
        },
      });
      shots += seen.shots;
    }
    expect(near.run[1]).toBeGreaterThan(200);
    expect(near.run[0] / near.run[1]).toBeLessThan(10 * PACE); // (on a run at you: near your own speed)
    expect(fastestRun).toBeLessThan(HUNTER_KINDS.tie.speed * 0.8);
    expect(near.set[0] / near.set[1]).toBeLessThan(13 * PACE); // (swinging out past you: quicker, but not flat out)
    expect(shots).toBeGreaterThan(40);
  });

  it('gets out ahead of you to turn in: a run starts in front of you, even while you turn', () => {
    let runs = 0;
    let ahead = 0;
    for (const seed of [3, 9, 20]) {
      const mode = new Map();
      fight({
        seed,
        seconds: 60,
        fly: (s) => ({ ...s, speed: SHIP.cruise, heading: s.heading + 0.3 * DT }),
        each: (hunt, s) => {
          for (const h of hunt.live) {
            if (mode.get(h.id) === 'set' && h.mode === 'run') {
              runs += 1;
              if ((h.pos.x - s.x) * -Math.sin(s.heading) + (h.pos.z - s.z) * -Math.cos(s.heading) > 0) ahead += 1;
            }
            mode.set(h.id, h.mode);
          }
        },
      });
    }
    expect(runs).toBeGreaterThan(60);
    expect(ahead / runs).toBeGreaterThan(0.8);
  });

  it('opens up with you when you boost: the pack keeps pace, an interceptor faster than a TIE', () => {
    // a fight at cruise, then the boost: the same pack, near you, before and after
    const cruise = [0, 0];
    const boost = [0, 0];
    let tie = 0;
    let fast = 0;
    fight({
      seconds: 24,
      opts: { size: 4, ace: false },
      fly: (s, t) => ({ ...s, speed: t < 10 ? SHIP.cruise : SHIP.boost }),
      each: (hunt, s, t) => {
        for (const h of hunt.live) {
          if (apart(h.pos, s) > 45 || h.mode === 'tail') continue;
          const v = Math.hypot(h.vel.x, h.vel.y, h.vel.z);
          if (t > 4 && t < 10) {
            cruise[0] += v;
            cruise[1] += 1;
          }
          if (t > 13) {
            boost[0] += v;
            boost[1] += 1;
            if (h.kind === 'tie') tie = Math.max(tie, v);
            else fast = Math.max(fast, v);
          }
        }
      },
    });
    expect(cruise[1]).toBeGreaterThan(100);
    expect(boost[1]).toBeGreaterThan(100);
    expect(boost[0] / boost[1]).toBeGreaterThan(cruise[0] / cruise[1] + 5 * PACE); // (they open up with you)
    expect(tie).toBeGreaterThan(15 * PACE);
    expect(tie).toBeLessThanOrEqual(HUNTER_KINDS.tie.speed + 1e-6);
    if (fast > 0) expect(fast).toBeGreaterThan(tie);
  });

  it('flies after prey at its floor, not flat out', () => {
    const hunt = createHunt({ rand: seeded(5) });
    const prey = { at: { x: 0, y: 0, z: -12 }, dir: (out) => ((out[0] = 0), (out[1] = 0), (out[2] = -1)), alive: () => true };
    let s = start();
    hunt.pack('bugs', s, { prey, size: 2 });
    let fastest = 0;
    for (let t = 0; t < 20; t += DT) {
      s = move(s);
      hunt.update(DT, s);
      if (t < 6) continue;
      for (const h of hunt.live) if (Math.hypot(h.pos.x - prey.at.x, h.pos.y - prey.at.y, h.pos.z - prey.at.z) < FIGHT.engageAt) fastest = Math.max(fastest, Math.hypot(h.vel.x, h.vel.y, h.vel.z));
    }
    expect(fastest).toBeGreaterThan(0);
    expect(fastest).toBeLessThan(HUNTER_KINDS.gromflomite.speed * 0.75);
  });
});

describe('a fight', () => {
  it('says they are coming, and they shoot at you however you fly', () => {
    const flying = {
      still: (s) => s,
      cruising: (s) => ({ ...s, speed: SHIP.cruise }),
      // (these two shook the old ones off entirely: their station swung round with your nose)
      spinning: (s) => ({ ...s, heading: s.heading + 2 * DT }),
      circling: (s) => ({ ...s, speed: SHIP.cruise, heading: s.heading + DT }),
      looping: (s, t) => ({ ...s, speed: 12 * PACE, heading: s.heading + Math.sin(t * 1.3) * 1.4 * DT, pitch: Math.sin(t * 0.9) * 0.6 }),
    };
    for (const [name, fly] of Object.entries(flying)) {
      let shots = 0;
      let hits = 0;
      for (const seed of [3, 11, 29]) {
        const seen = fight({ seed, fly });
        expect(seen.events[0], name).toBe('hunted');
        shots += seen.shots;
        hits += seen.hits;
      }
      expect(shots, `${name}: shots`).toBeGreaterThan(30); // (ten a minute at the very least)
      expect(hits, `${name}: hits`).toBeGreaterThan(0);
      // a cloud of lasers, not a wall: most miss
      expect(hits / shots, `${name}: accuracy`).toBeLessThan(0.4);
    }
  });

  it('is as dangerous at any frame rate', () => {
    const at = (hz) => {
      const hunt = createHunt({ rand: seeded(21) });
      let s = start({ speed: SHIP.cruise });
      hunt.pack('empire', s, { size: 4, ace: false });
      let shots = 0;
      for (let t = 0; t < 120; t += 1 / hz) {
        s = { ...s, z: s.z - s.speed / hz };
        for (const e of hunt.update(1 / hz, s)) if (e.type === 'shot') shots += 1;
      }
      return shots;
    };
    const slow = at(30);
    const fast = at(144);
    expect(slow).toBeGreaterThan(40);
    expect(slow / fast).toBeGreaterThan(0.6);
    expect(slow / fast).toBeLessThan(1.6);
  });

  it('puts no more of a pack on a run at once than it has places for', () => {
    let most = 0;
    const seen = fight({
      opts: { size: 5, ace: false },
      fly: (s) => ({ ...s, speed: SHIP.cruise, heading: s.heading + 0.5 * DT }),
      each: (hunt) => {
        const on = hunt.live.filter((h) => h.mode !== 'set').length;
        most = Math.max(most, on);
        expect(on).toBeLessThanOrEqual(slotsFor(5));
        expect(hunt.packs[0].attacking).toBe(on);
      },
    });
    expect(most).toBe(slotsFor(5));
    expect(seen.shots).toBeGreaterThan(10);
  });

  it('keeps them apart from each other', () => {
    let nearest = Infinity;
    fight({
      opts: { size: 5, ace: false },
      seconds: 40,
      each: (hunt, s, t) => {
        if (t < 2) return; // (out of the formation they came in)
        for (const a of hunt.live) for (const b of hunt.live) if (a.id < b.id) nearest = Math.min(nearest, apart(a.pos, b.pos));
      },
    });
    expect(nearest).toBeGreaterThan(0.35); // (more than one of them is wide)
  });

  it('flies round a planet, never through it, and holds its fire behind it', () => {
    // you sit one side of a moon; they come in on the far side of it
    const moon = { id: 'moon', at: [0, 0, 22], r: 8 };
    let deepest = Infinity;
    const seen = fight({
      solids: [moon],
      seconds: 30,
      each: (hunt) => {
        for (const h of hunt.live) deepest = Math.min(deepest, apart(h.pos, { x: 0, y: 0, z: 22 }) - moon.r);
        for (const l of hunt.lasers) if (l.on) expect(apart(l, { x: 0, y: 0, z: 22 })).toBeGreaterThan(moon.r - 0.7); // (a frame's flight at most)
      },
    });
    expect(deepest).toBeGreaterThan(0);
    expect(seen.shots).toBeGreaterThan(3); // (they got round it to you)
  });

  it('comes in after you when you are down in something (a trench)', () => {
    // inside the solid's own radius, as the Death Star's trench is: it isn't in their way
    const station = { id: 'station', at: [0, -30, 0], r: 30.5 }; // (you're half a unit under its skin)
    const seen = fight({ solids: [station], seconds: 30 });
    expect(seen.shots).toBeGreaterThan(3);
  });

  it('gives up once you have outrun them, and flies off', () => {
    const seen = fight({ fly: (s) => ({ ...s, speed: 60 * PACE }), seconds: LOSE.after + 30 });
    expect(seen.events).toContain('escaped');
    expect(seen.hunt.active).toBe(false);
    expect(seen.hunt.targets).toHaveLength(0);
    expect(seen.hunt.count).toBe(0); // (out of sight, and gone)
  });

  it('leave() sends them all off without a moment’s vanishing, gone once well away from whoever’s looking', () => {
    const hunt = createHunt({ rand: seeded(3) });
    const you = start();
    hunt.pack('empire', you, { size: 3, ace: false });
    for (let t = 0; t < 3; t += DT) hunt.update(DT, you);
    hunt.leave();
    hunt.update(DT, you);
    expect(hunt.count).toBe(3); // (still there)
    expect(hunt.active).toBe(false);
    expect(hunt.targets).toHaveLength(0); // (nothing for the guns: they're leaving)
    let shots = 0;
    let t = 0;
    for (; t < 60 && hunt.count; t += DT) for (const e of hunt.update(DT, you)) if (e.type === 'shot') shots += 1;
    expect(shots).toBe(0);
    expect(hunt.count).toBe(0);
    expect(t).toBeGreaterThan(2);
  });

  it('all leave when you stop flying', () => {
    const hunt = createHunt({ rand: seeded() });
    hunt.pack('federation', start(), { size: 3 });
    hunt.update(DT, start());
    expect(hunt.count).toBe(3);
    hunt.update(DT, null);
    expect(hunt.count).toBe(0);
    expect(hunt.active).toBe(false);
  });

  it('has the quick ones sit on your tail now and then, and lets go of the place when they break off', () => {
    let tailed = 0;
    for (const seed of [2, 5, 9, 14]) {
      fight({
        seed,
        opts: { size: 2, ace: true },
        fly: (s) => ({ ...s, speed: SHIP.cruise }),
        each: (hunt) => {
          for (const h of hunt.live) {
            if (h.mode !== 'tail') continue;
            tailed += 1;
            expect(h.type.tail).toBeGreaterThan(0);
            expect(h.clock).toBeLessThanOrEqual(FIGHT.tailFor[1] + DT);
          }
          expect(hunt.packs[0].attacking).toBe(hunt.live.filter((h) => h.mode !== 'set').length);
        },
      });
    }
    expect(tailed).toBeGreaterThan(20); // (a third of a second of it, at the least)
  });

  it('goes after prey instead, until you shoot at them or it gets away', () => {
    const prey = { at: { x: 30, y: 0, z: -30 }, there: true, alive: () => prey.there, dir: (out) => Object.assign(out, [0, 0, 1]) };
    const hunt = createHunt({ rand: seeded(4) });
    hunt.pack('bugs', start(), { prey, size: 2, ace: false });
    let atYou = 0;
    const flown = (seconds) => {
      for (let t = 0; t < seconds; t += DT) for (const e of hunt.update(DT, start())) if (e.type === 'shot' || e.type === 'laser') atYou += 1;
    };
    flown(20);
    expect(atYou).toBe(0);
    expect(hunt.active).toBe(false); // (not after you)
    expect(hunt.targets.every((c) => c.threat === 0)).toBe(true);
    expect(hunt.lasers.some((l) => l.on && l.at === 'prey') || hunt.count === 2).toBe(true);
    // a shot of yours into one: they turn on you
    const h = hunt.live[0];
    const got = hunt.hit({ x: h.pos.x, y: h.pos.y, z: h.pos.z - 1 }, h.pos, 1);
    expect(got).toMatchObject({ kind: 'gromflomite', down: true });
    expect(hunt.active).toBe(true);
    flown(30);
    expect(atYou).toBeGreaterThan(0);
    // and a pack whose prey got away, unprovoked, leaves
    const other = createHunt({ rand: seeded(4) });
    other.pack('bugs', start(), { prey, size: 2, ace: false });
    other.update(DT, start());
    prey.there = false;
    const events = [];
    for (let t = 0; t < 1; t += DT) events.push(...other.update(DT, start()).map((e) => e.type));
    expect(other.targets).toHaveLength(0);
    expect(events).not.toContain('escaped'); // (they weren't after you)
  });
});

describe('shooting them', () => {
  it('takes a hit along the whole of a bolt’s way, the tough ones more than one, and says when the pack is cleared', () => {
    const hunt = createHunt({ rand: seeded() });
    const [ace, tie] = hunt.pack('empire', start(), { size: 2, ace: true });
    hunt.update(DT, start());
    expect(ace.kind).toBe('tieadvanced');
    const through = (h) => hunt.hit({ x: h.pos.x - 3, y: h.pos.y, z: h.pos.z }, { x: h.pos.x + 3, y: h.pos.y, z: h.pos.z }, 1);
    expect(hunt.hit({ x: 500, y: 0, z: 0 }, { x: 503, y: 0, z: 0 })).toBeNull();
    const first = through(ace);
    expect(first).toMatchObject({ id: ace.id, kind: 'tieadvanced', down: false });
    expect(hunt.targets.find((c) => c.id === ace.id)).toMatchObject({ hp: HUNTER_KINDS.tieadvanced.hp - 1, hpMax: HUNTER_KINDS.tieadvanced.hp });
    // a fusion cannon's bolt is worth three
    expect(hunt.hit({ x: ace.pos.x - 3, y: ace.pos.y, z: ace.pos.z }, { x: ace.pos.x + 3, y: ace.pos.y, z: ace.pos.z }, 3)).toMatchObject({ down: false });
    // (and one worth what it has left downs it)
    expect(hunt.hit({ x: ace.pos.x - 3, y: ace.pos.y, z: ace.pos.z }, { x: ace.pos.x + 3, y: ace.pos.y, z: ace.pos.z }, ace.hp)).toMatchObject({ down: true, at: { x: ace.pos.x, y: ace.pos.y, z: ace.pos.z } });
    expect(hunt.count).toBe(1);
    // (whatever the other is, a TIE, an interceptor or a bomber: a hit worth all it has downs it)
    expect(hunt.hit({ x: tie.pos.x - 3, y: tie.pos.y, z: tie.pos.z }, { x: tie.pos.x + 3, y: tie.pos.y, z: tie.pos.z }, tie.hp)).toMatchObject({ kind: tie.kind, down: true });
    expect(hunt.update(DT, start()).map((e) => e.type)).toContain('cleared');
    expect(hunt.active).toBe(false);
  });

  it('counts a shot passing within its hit radius, and not one just outside it', () => {
    const hunt = createHunt({ rand: seeded(4) });
    const [h] = hunt.pack('empire', start(), { size: 1, ace: false });
    const r = hitRadius(h.type);
    expect(r).toBeGreaterThan(h.type.size);
    const past = (off) => hunt.hit({ x: h.pos.x - 3, y: h.pos.y + off, z: h.pos.z }, { x: h.pos.x + 3, y: h.pos.y + off, z: h.pos.z }, 1);
    expect(past(r + 0.02)).toBeNull();
    expect(past(r - 0.02)).toMatchObject({ down: true });
  });

  it('takes a hit told to it by number (another pilot’s shot), and nothing for one it doesn’t have', () => {
    const hunt = createHunt({ rand: seeded() });
    const [a, b] = hunt.pack('federation', start(), { size: 2 });
    expect(hunt.damage(999)).toBeNull();
    // (a patrol fighter or a gunship: either takes more than one)
    expect(hunt.damage(a.id, a.hp - 1)).toMatchObject({ id: a.id, kind: a.kind, down: false });
    expect(hunt.damage(a.id, 1)).toMatchObject({ down: true });
    expect(hunt.damage(a.id, 1)).toBeNull(); // (it's gone)
    expect(hunt.wire()).toEqual([[b.id, b.kind, b.pos.x, b.pos.y, b.pos.z, b.vel.x, b.vel.y, b.vel.z, b.type.hp]]);
  });

  it('gives the guns everyone in the fight, the ones on a run as threats', () => {
    let threats = 0;
    fight({
      seconds: 20,
      each: (hunt) => {
        const t = hunt.targets;
        expect(t).toHaveLength(hunt.count);
        for (const c of t) {
          const h = hunt.live.find((o) => o.id === c.id);
          expect(c.at).toBe(h.pos);
          expect(c.threat).toBe(h.mode === 'set' ? 0 : 1);
          threats += c.threat;
        }
      },
    });
    expect(threats).toBeGreaterThan(0);
  });
});

// one kind with a trait, in a faction of its own, for a fight of just them
const withTrait = (trait, over = {}) => ({
  kinds: { ...HUNTER_KINDS, odd: { ...HUNTER_KINDS.tie, hp: 3, ...over, trait } },
  factions: { odd: { kinds: [['odd', 1]], laser: [1, 1, 1], size: [1, 3] } },
});
// a fight of one side's own kind, flown frame by frame: each(hunt, ship, events, t)
function traitFight(trait, { seed = 7, seconds = 60, size = 2, over, fly = (s) => ({ ...s, speed: SHIP.cruise }), each } = {}) {
  const { kinds, factions } = withTrait(trait, over);
  const hunt = createHunt({ rand: seeded(seed), kinds, factions });
  let s = start();
  hunt.pack('odd', s, { size });
  const seen = { shots: 0, hits: 0, damage: 0, events: [], runs: 0, hunt };
  const was = new Map();
  for (let t = 0; t < seconds; t += DT) {
    s = move(fly(s, t));
    const events = hunt.update(DT, s);
    for (const e of events) {
      if (e.type === 'shot') seen.shots += 1;
      else if (e.type === 'laser') {
        seen.hits += 1;
        seen.damage = Math.max(seen.damage, e.damage);
      } else seen.events.push(e.type);
    }
    for (const h of hunt.live) {
      if (h.mode === 'run' && was.get(h.id) !== 'run') seen.runs += 1;
      was.set(h.id, h.mode);
    }
    each?.(hunt, s, events, t);
  }
  return seen;
}

describe('traits: how some kinds fight their own way', () => {
  it('knows every trait a side gives a kind', () => {
    for (const [k, type] of Object.entries(HUNTER_KINDS)) if (type.trait) expect(TRAITS, k).toContain(type.trait);
    expect(HUNTER_KINDS.suvace.trait).toBe('spotlight');
    expect(HUNTER_KINDS.cousins.trait).toBe('quietUntilFired');
  });

  it('has a bomber fly a slow straight run, drop one heavy slow bomb, and break off', () => {
    const top = HUNTER_KINDS.tie.speed;
    let fastest = 0;
    let bombs = 0;
    const seen = traitFight('bomber', {
      seconds: 90,
      each: (hunt) => {
        for (const h of hunt.live) if (h.mode === 'run') fastest = Math.max(fastest, Math.hypot(h.vel.x, h.vel.y, h.vel.z));
        for (const m of hunt.lasers) if (m.on && m.bomb) bombs += 1;
      },
    });
    expect(seen.runs).toBeGreaterThan(2);
    expect(seen.shots).toBeGreaterThan(0);
    expect(seen.shots).toBeLessThanOrEqual(seen.runs); // (one bomb a run, at most)
    expect(bombs).toBeGreaterThan(0);
    expect(fastest).toBeLessThan(top * 0.7 + 1e-6);
    // and one that lands is a heavy one
    for (const seed of [3, 5, 9, 13]) {
      const s = traitFight('bomber', { seed, seconds: 90, fly: (o) => o });
      if (s.hits) expect(s.damage).toBe(BOMB.damage);
    }
  });

  it('bursts a bomb that passes near you, where a laser that close would miss', () => {
    const pass = (bomb) => {
      const hunt = createHunt({ rand: seeded() });
      const m = hunt.lasers[0];
      Object.assign(m, { on: true, x: 1, y: 0, z: -4, vx: 0, vy: 0, vz: 14, life: 2, at: 'you', faction: 'empire', bomb, r: bomb ? BOMB.burst : null, damage: bomb ? BOMB.damage : null });
      const out = [];
      for (let i = 0; i < 60; i++) out.push(...hunt.update(DT, start()));
      return out.filter((e) => e.type === 'laser');
    };
    expect(pass(false)).toHaveLength(0);
    expect(pass(true)).toEqual([expect.objectContaining({ damage: BOMB.damage })]);
  });

  it('has one that holds off never close in on you, and still fire from range', () => {
    let nearest = Infinity;
    let plainNearest = Infinity;
    let shots = 0;
    for (const seed of [3, 7, 11]) {
      const seen = traitFight('holdoff', {
        seed,
        each: (hunt, s) => {
          for (const h of hunt.live) nearest = Math.min(nearest, apart(h.pos, s));
        },
      });
      shots += seen.shots;
      traitFight(null, {
        seed,
        each: (hunt, s) => {
          for (const h of hunt.live) plainNearest = Math.min(plainNearest, apart(h.pos, s));
        },
      });
    }
    expect(shots).toBeGreaterThan(10);
    expect(plainNearest).toBeLessThan(FIGHT.pass * 2);
    expect(nearest).toBeGreaterThan(FIGHT.near * 1.5);
  });

  it('has the quiet ones never fire until one of them has been hit', () => {
    let hitAt = null;
    let before = 0;
    let after = 0;
    traitFight('quietUntilFired', {
      over: { hp: 9 },
      seconds: 60,
      each: (hunt, s, events, t) => {
        const shots = events.filter((e) => e.type === 'shot').length;
        if (hitAt === null) before += shots;
        else after += shots;
        if (hitAt === null && t > 30) {
          hitAt = t;
          expect(hunt.damage(hunt.live[1].id, 1)).toMatchObject({ down: false });
        }
      },
    });
    expect(before).toBe(0);
    expect(after).toBeGreaterThan(3);
  });

  it('has one that flickers vanish when it is hit: off the guns and unhittable a while, then back', () => {
    const { kinds, factions } = withTrait('flicker');
    const hunt = createHunt({ rand: seeded(), kinds, factions });
    const [h] = hunt.pack('odd', start(), { size: 1 });
    hunt.update(DT, start());
    expect(hunt.damage(h.id, 1)).toMatchObject({ down: false });
    expect(h.hidden).toBeGreaterThan(0);
    expect(hunt.targets).toHaveLength(0);
    expect(hunt.wire()).toHaveLength(0);
    expect(hunt.hit({ x: h.pos.x - 3, y: h.pos.y, z: h.pos.z }, { x: h.pos.x + 3, y: h.pos.y, z: h.pos.z })).toBeNull();
    for (let t = 0; t < 1.9; t += DT) hunt.update(DT, start());
    expect(hunt.targets).toHaveLength(0);
    for (let t = 0; t < 0.2; t += DT) hunt.update(DT, start());
    expect(h.hidden).toBe(0);
    expect(hunt.targets).toHaveLength(1);
    // and a kind without the trait just takes the hit
    const plain = createHunt({ rand: seeded() });
    const [p] = plain.pack('federation', start(), { size: 1 });
    plain.damage(p.id, 1);
    expect(p.hidden ?? 0).toBe(0);
    expect(plain.targets).toHaveLength(1);
  });

  it('has one with a spotlight pin you once a run, from close enough', () => {
    let lit = 0;
    let far = 0;
    const seen = traitFight('spotlight', {
      seconds: 60,
      each: (hunt, s, events) => {
        for (const e of events) {
          if (e.type !== 'spotlit') continue;
          lit += 1;
          if (!hunt.live.some((h) => h.mode === 'run' && apart(h.pos, s) < FIGHT.range * 0.6 + 0.5)) far += 1;
        }
      },
    });
    expect(lit).toBeGreaterThan(1);
    expect(lit).toBeLessThanOrEqual(seen.runs);
    expect(far).toBe(0);
  });
});

describe('an ace with stages', () => {
  const staged = Object.entries(HUNTER_KINDS).filter(([, k]) => k.stages);
  const flyStill = (s) => s;
  // a fight with one ace of `kind` alone, hurt to just under its stage, by hand
  const hurtInto = (kind, { seed = 3 } = {}) => {
    const type = HUNTER_KINDS[kind];
    const faction = Object.entries(FACTIONS).find(([, f]) => f.kinds.some(([k]) => k === kind) || f.ace === kind)[0];
    const hunt = createHunt({ rand: seeded(seed) });
    let s = start();
    hunt.pack(faction, s, { size: 1, ace: type === HUNTER_KINDS[FACTIONS[faction].ace] });
    // (a bounty's pack of one is the kind itself; an ace's pack has it: find it)
    let ace = hunt.live.find((h) => h.kind === kind);
    if (!ace) {
      hunt.clear();
      // sent as the faction's only kind
      const kinds = { ...HUNTER_KINDS };
      const factions = { solo: { role: 'hunt', weight: 1, kinds: [[kind, 1]], laser: [1, 1, 1], size: [1, 1], family: 'test' } };
      const h2 = createHunt({ rand: seeded(seed), kinds, factions });
      h2.pack('solo', s, { size: 1, ace: false });
      ace = h2.live[0];
      return { hunt: h2, ace, s };
    }
    return { hunt, ace, s };
  };

  it('every stage names what changes, within reason, and summons only a faction that exists', () => {
    expect(staged.length).toBeGreaterThanOrEqual(8);
    for (const [kind, k] of staged) {
      let last = 1;
      for (const st of k.stages) {
        expect(st.below, kind).toBeGreaterThan(0);
        expect(st.below, kind).toBeLessThan(last);
        last = st.below;
        const { summon, ...over } = st;
        delete over.below;
        expect(Object.keys(over).length + (summon ? 1 : 0), kind).toBeGreaterThan(0);
        if (over.trait) expect(TRAITS, kind).toContain(over.trait);
        if (summon) expect(FACTIONS[summon], `${kind} summons ${summon}`).toBeTruthy();
        if (over.fire) expect(over.fire[0], kind).toBeLessThan(over.fire[1]);
      }
    }
  });

  it('changes its ways once hurt past the stage, once, and says so (with whom it calls in)', () => {
    for (const [kind, k] of staged) {
      const { hunt, ace } = hurtInto(kind);
      const was = { ...ace.type };
      const st = k.stages[0];
      // hurt to just above the stage: nothing yet
      const toStage = ace.hp - Math.floor(k.hp * st.below);
      for (let i = 0; i < toStage - 1; i++) hunt.damage(ace.id, 1);
      let events = hunt.update(DT, start());
      expect(events.some((e) => e.type === 'stage'), kind).toBe(false);
      expect(ace.type.speed, kind).toBe(was.speed);
      // and past it
      hunt.damage(ace.id, 1);
      expect(ace.hp / k.hp).toBeLessThanOrEqual(st.below);
      events = hunt.update(DT, start());
      const got = events.find((e) => e.type === 'stage');
      expect(got, kind).toMatchObject({ kind, stage: 1, of: k.stages.length, summon: st.summon ?? null });
      for (const [key, v] of Object.entries(st)) if (key !== 'below' && key !== 'summon') expect(ace.type[key], `${kind} ${key}`).toEqual(v);
      expect(ace.type.hp, kind).toBe(k.hp); // (its hull is what it was)
      expect(ace.alive).toBe(true);
      // never twice
      hunt.damage(ace.id, 1);
      expect(hunt.update(DT, start()).some((e) => e.type === 'stage'), kind).toBe(false);
    }
  });

  it('fights on the new way: Vader faster and firing quicker, Fett dropping charges, Bossk holding off', () => {
    const quick = (kind, seconds = 25) => {
      const { hunt, ace } = hurtInto(kind);
      const st = HUNTER_KINDS[kind].stages[0];
      const n = ace.hp - Math.floor(HUNTER_KINDS[kind].hp * st.below);
      for (let i = 0; i < n; i++) hunt.damage(ace.id, 1);
      let s = start();
      const seen = { shots: 0, bombs: 0, nearest: Infinity, fastest: 0 };
      for (let t = 0; t < seconds; t += DT) {
        s = move(flyStill(s, t));
        for (const e of hunt.update(DT, s)) if (e.type === 'shot') seen.shots += 1;
        for (const l of hunt.lasers) if (l.on && l.bomb) seen.bombs += 1;
        if (ace.alive) {
          seen.nearest = Math.min(seen.nearest, apart(ace.pos, s));
          seen.fastest = Math.max(seen.fastest, Math.hypot(ace.vel.x, ace.vel.y, ace.vel.z));
        }
      }
      return seen;
    };
    const plain = (kind, seconds = 25) => {
      const { hunt, ace } = hurtInto(kind);
      let s = start();
      const seen = { shots: 0, nearest: Infinity, fastest: 0 };
      for (let t = 0; t < seconds; t += DT) {
        s = move(flyStill(s, t));
        for (const e of hunt.update(DT, s)) if (e.type === 'shot') seen.shots += 1;
        if (ace.alive) {
          seen.nearest = Math.min(seen.nearest, apart(ace.pos, s));
          seen.fastest = Math.max(seen.fastest, Math.hypot(ace.vel.x, ace.vel.y, ace.vel.z));
        }
      }
      return seen;
    };
    const vader = quick('tieadvanced');
    const calm = plain('tieadvanced');
    expect(vader.shots).toBeGreaterThan(calm.shots * 1.2);
    expect(vader.fastest).toBeGreaterThan(calm.fastest);
    expect(quick('slave1').bombs).toBeGreaterThan(0);
    expect(plain('slave1', 10).shots).toBeGreaterThan(0);
    expect(quick('houndstooth').nearest).toBeGreaterThan(HOLDOFF.near * 0.8);
  });
});

describe('a pack on the toolkit', () => {
  it('knows you only as it sees you: a moon between hides you, and its guess of you drifts the way you went', () => {
    // you, behind a big moon from a hangar the pack comes out of; you fly east, then back west once they can only guess
    const moon = { id: 'moon', at: [0, 0, 46], r: 36 };
    const hangar = { x: 0, y: 0, z: 100 };
    let unseenAtFirst = null;
    let guessed = 0;
    let guessApart = 0;
    fight({
      solids: [moon],
      seconds: 4.5,
      ship: start({ heading: -Math.PI / 2, speed: 12 * PACE }),
      opts: { size: 3, ace: false, from: hangar },
      fly: (s, t) => ({ ...s, heading: t < 3 ? -Math.PI / 2 : Math.PI / 2, speed: 12 * PACE }),
      each: (hunt, s, t) => {
        if (Math.abs(t - 0.2) < DT / 2) unseenAtFirst = hunt.live.every((h) => !h.seesYou);
        if (t < 3.5) return;
        // past intuition and still blind: its guess, drifting east while you've turned back west
        for (const h of hunt.live) {
          if (h.seesYou || !h.belief || h.me.now - h.belief.seenAt <= HUNTER_SENSES.intuition) continue;
          guessed += 1;
          guessApart = Math.max(guessApart, apart(h.belief.at, s));
          expect(h.belief.at.x).toBeGreaterThan(s.x);
        }
      },
    });
    expect(unseenAtFirst).toBe(true);
    expect(guessed).toBeGreaterThan(0);
    expect(guessApart).toBeGreaterThan(5);
  });

  it('loses its nerve: a pack that has lost most of itself breaks off together, and says why', () => {
    const hunt = createHunt({ rand: seeded(4) });
    let s = start({ speed: 5 * PACE });
    const members = hunt.pack('empire', s, { size: 4, ace: false });
    const whys = [];
    for (let t = 0; t < 20; t += DT) {
      s = move(s);
      if (Math.abs(t - 5) < DT / 2) for (const h of members.slice(0, 3)) hunt.damage(h.id, 99);
      for (const e of hunt.update(DT, s)) if (e.type === 'escaped') whys.push(e.why);
    }
    expect(whys).toEqual(['broke']);
    expect(hunt.active).toBe(false);
    // (a pair, or a bounty hunter alone, never loses its nerve; and a hunt told not to never does)
    const pair = createHunt({ rand: seeded(4) });
    s = start({ speed: 5 * PACE });
    const two = pair.pack('empire', s, { size: 2, ace: false });
    const pairWhys = [];
    for (let t = 0; t < 8; t += DT) {
      s = move(s);
      if (Math.abs(t - 2) < DT / 2) pair.damage(two[0].id, 99);
      for (const e of pair.update(DT, s)) if (e.type === 'escaped') pairWhys.push(e.why);
    }
    expect(pairWhys).toEqual([]);
    expect(pair.active).toBe(true);
  });

  it('never has two on your tail at once, and a hunter without a run flanks or blocks rather than idling', () => {
    const roles = new Set();
    let flanks = 0;
    let moving = true;
    for (const seed of [3, 8]) {
      const seen = fight({
        seed,
        opts: { size: 5, ace: false },
        fly: (s) => ({ ...s, speed: 12 * PACE }),
        seconds: 30,
        each: (hunt) => {
          expect(hunt.live.filter((h) => h.mode === 'tail').length).toBeLessThanOrEqual(1);
          for (const h of hunt.live) {
            if (h.mode === 'set' && h.role !== 'wait') {
              roles.add(h.role);
              if (Math.hypot(h.vel.x, h.vel.y, h.vel.z) < 1) moving = false;
            }
          }
        },
      });
      flanks += seen.events.filter((e) => e === 'flank').length;
    }
    expect(roles.has('flank')).toBe(true);
    expect(moving).toBe(true);
    expect(flanks).toBeGreaterThan(0);
  });

  it('says who hit you', () => {
    const seen = fight({ seconds: 30, opts: { size: 3, ace: false } });
    expect(seen.hits).toBeGreaterThan(0);
    const hunt = createHunt({ rand: seeded(7) });
    let s = start();
    hunt.pack('empire', s, { size: 3, ace: false });
    let by = null;
    for (let t = 0; t < 30 && by === null; t += DT) for (const e of hunt.update(DT, s)) if (e.type === 'laser') by = e.by;
    expect(typeof by).toBe('number');
  });
});

// (the crews' ship powers: shipPowers.js says what each does, these are its hooks in the hunters)
describe('what the crews’ ship powers do to them', () => {
  // a pack of four on you, flown in a gentle turn: `power(hunt, ship, t)` once
  // each frame from `at`, the ship handed to them as `ship(s, t)` makes it.
  // Returns the hunt, and the lasers each hunter fired from `at` on, by when
  function flown({ seed, at = 15, seconds = 20, power = null, ship = (s) => s, each = null }) {
    const hunt = createHunt({ rand: seeded(seed) });
    let s = start({ speed: 6 });
    hunt.pack('empire', s, { size: 4, ace: false });
    const fired = []; // [{ by, t }]
    for (let t = 0; t < seconds; t += DT) {
      s = move({ ...s, heading: s.heading + 0.3 * DT });
      if (t >= at) power?.(hunt, s, t);
      const was = hunt.lasers.map((m) => m.on);
      const events = hunt.update(DT, ship(s, t));
      if (t >= at) hunt.lasers.forEach((m, i) => m.on && !was[i] && m.life > LASER_NEW && fired.push({ by: m.by, t }));
      each?.(hunt, s, t, events);
    }
    return { hunt, fired };
  }
  const LASER_NEW = 0.9; // (a laser this fresh was fired this frame: LASER.life is 1.1)
  const ahead = (s, d) => {
    const [nx, ny, nz] = nose(s);
    return { x: s.x + nx * d, y: s.y + ny * d, z: s.z + nz * d };
  };

  // (as the galaxy steps them while Force Focus is on: their clock at its
  // `slow`, the ship as it is; it reads your speed, not how far you moved,
  // so their leads on you stay true)
  it('lands at most half the hits on you while Force Focus slows their clock, over twenty fights', () => {
    const hits = (slow) => {
      let n = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const hunt = createHunt({ rand: seeded(seed) });
        let s = start({ speed: 6 });
        hunt.pack('empire', s, { size: 4, ace: false });
        for (let t = 0; t < 20; t += DT) {
          s = move({ ...s, heading: s.heading + 0.3 * DT });
          for (const e of hunt.update(DT * (t >= 15 ? slow : 1), s)) if (t >= 15 && e.type === 'laser') n++;
        }
      }
      return n;
    };
    const normal = hits(1);
    expect(normal).toBeGreaterThan(5);
    expect(hits(POWERS.focus.slow)).toBeLessThanOrEqual(normal / 2);
  });

  it('lets a ghost’s lasers fly on past: no hits while it jinks, and a laser that crossed it is still going', () => {
    let normal = 0;
    let ghosted = 0;
    let crossed = 0;
    for (let seed = 1; seed <= 20; seed++) {
      flown({ seed, each: (h, s, t, events) => t > 15 && (normal += events.filter((e) => e.type === 'laser').length) });
      let was = null;
      let lasers = [];
      flown({
        seed,
        ship: (s, t) => (t > 15 ? { ...s, ghost: true } : s),
        each: (h, s, t, events) => {
          if (t > 15) {
            ghosted += events.filter((e) => e.type === 'laser').length;
            h.lasers.forEach((m, i) => lasers[i] && m.on && sweptHit(lasers[i], m, was, s, SHIP_R) !== null && crossed++);
          }
          was = { ...s };
          lasers = h.lasers.map((m) => m.on && { x: m.x, y: m.y, z: m.z });
        },
      });
    }
    expect(normal).toBeGreaterThan(0);
    expect(ghosted).toBe(0);
    expect(crossed).toBeGreaterThan(0);
  });

  it('breaks off the ones on a run or on your tail to swing round again, and frees their places', () => {
    let broke = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const { hunt } = flown({ seed, seconds: 12 });
      const on = hunt.live.filter((h) => h.mode !== 'set');
      expect(hunt.breakOff()).toBe(on.length);
      broke += on.length;
      expect(hunt.live.every((h) => h.mode === 'set')).toBe(true);
      expect(hunt.packs[0].attacking).toBe(0);
      // (and none of them fires in the moment it takes to swing away)
      for (const h of on) expect(h.cool).toBeGreaterThanOrEqual(0.6);
    }
    expect(broke).toBeGreaterThan(0);
  });

  it('holds them in a magnet: they are dragged to it, off the guns’ threats, and hold their fire', () => {
    for (let seed = 1; seed <= 8; seed++) {
      let held = [];
      let magnet = null;
      const { fired } = flown({
        seed,
        seconds: 19,
        power: (hunt, s) => {
          magnet = ahead(s, 6);
          if (held.length) return;
          expect(hunt.pull(magnet, 22, 16, 4, 1)).toBe(hunt.live.filter((h) => apart(h.pos, magnet) < 22).length);
          held = hunt.live.filter((h) => h.held > 0);
        },
        ship: (s, t) => (t >= 15 ? { ...s, magnet } : s),
        each: (hunt, s, t) => {
          if (t < 15.5) return;
          for (const tg of hunt.targets) if (held.some((h) => h.id === tg.id)) expect(tg.threat, `seed ${seed}`).toBe(0);
          // two seconds on, every one of them is in a ball round it
          if (t >= 17) for (const h of held) expect(apart(h.pos, magnet), `seed ${seed} at ${t.toFixed(2)}`).toBeLessThan(3);
        },
      });
      expect(held.length, `seed ${seed}`).toBeGreaterThan(0);
      expect(fired.filter((f) => held.some((h) => h.id === f.by))).toEqual([]);
    }
  });

  it('lets them go after the hold: a second dazed with their guns quiet, then they come round and shoot again', () => {
    let after = 0;
    for (let seed = 1; seed <= 8; seed++) {
      let held = [];
      const { fired, hunt } = flown({
        seed,
        seconds: 40,
        power: (h, s) => {
          if (held.length) return;
          h.pull(ahead(s, 6), 22, 16, 4, 1);
          held = h.live.filter((o) => o.held > 0).map((o) => o.id);
        },
        ship: (s, t) => (t >= 15 && t < 19 ? { ...s, magnet: ahead(s, 6) } : s),
      });
      const theirs = fired.filter((f) => held.includes(f.by));
      expect(theirs.filter((f) => f.t < 20), `seed ${seed}`).toEqual([]);
      after += theirs.length;
      expect(hunt.live.every((h) => !(h.held > 0))).toBe(true);
    }
    expect(after).toBeGreaterThan(0);
  });

  it('lets them all go when you stop flying', () => {
    const hunt = createHunt({ rand: seeded(3) });
    const s = start({ speed: 6 });
    hunt.pack('empire', s, { size: 3, ace: false });
    hunt.update(DT, s);
    expect(hunt.pull(ahead(s, 6), 40, 16, 4, 1)).toBe(3);
    hunt.update(DT, null);
    expect(hunt.live.every((h) => !(h.held > 0))).toBe(true);
  });

  it('swallows the lasers near a portal’s mouth, and no others', () => {
    const hunt = createHunt({ rand: seeded(3), lasers: 4 });
    const fly = (m, x, z) => Object.assign(m, { on: true, x, y: 0, z, vx: 0, vy: 0, vz: 34, life: 1 });
    fly(hunt.lasers[0], 1, 0);
    fly(hunt.lasers[1], 0, 5.5);
    fly(hunt.lasers[2], 0, 7);
    expect(hunt.swallow({ x: 0, y: 0, z: 0 }, 6)).toBe(2);
    expect(hunt.lasers.map((m) => m.on)).toEqual([false, false, true, false]);
  });
});

describe('the hulls (the galaxy’s hulls design)', () => {
  it('your shot meets a hunter on its hull, turned as it flies: over its back it misses, through its body it hits', () => {
    const bin = readFileSync(new URL('../../../scripts/fixtures/bf2017/physics/xwing-hull.bin', import.meta.url));
    const XW = hullOf(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
    const hulls = { get: (kind) => (kind === 'xwing' ? XW : null) };
    const hunt = createHunt({ rand: seeded(9), kinds: GALAXY_KINDS, factions: GALAXY_FACTIONS, hulls });
    hunt.pack('rebellion', start(), { size: 3, ace: false });
    for (let t = 0; t < 2; t += DT) hunt.update(DT, start());
    const h = hunt.live.find((o) => o.kind === 'xwing');
    expect(h).toBeTruthy();
    // held level, flying along +z, so its hull's frame is the world's
    Object.assign(h.pos, { x: 40, y: 3, z: -20 });
    Object.assign(h.prev, h.pos);
    Object.assign(h.vel, { x: 0, y: 0, z: 10 });
    h.bank = 0;
    const over = h.type.size * 0.2; // (above its box, 0.095 of its length tall, and inside its sphere)
    const across = (y) => hunt.hit({ x: h.pos.x - 1, y: h.pos.y + y, z: h.pos.z }, { x: h.pos.x + 1, y: h.pos.y + y, z: h.pos.z }, 0.01);
    expect(across(over)).toBeNull();
    const hit = across(0);
    expect(hit).toMatchObject({ id: h.id, kind: 'xwing', property: 68 });
    expect(hit.at.y).toBeCloseTo(3, 3);
    // and a kind with no hull is hit as its sphere
    const plain = createHunt({ rand: seeded(9), kinds: GALAXY_KINDS, factions: GALAXY_FACTIONS, hulls: { get: () => null } });
    plain.pack('rebellion', start(), { size: 3, ace: false });
    for (let t = 0; t < 2; t += DT) plain.update(DT, start());
    const g = plain.live.find((o) => o.kind === 'xwing');
    Object.assign(g.pos, { x: 40, y: 3, z: -20 });
    Object.assign(g.prev, g.pos);
    expect(plain.hit({ x: 39, y: 3 + over, z: -20 }, { x: 41, y: 3 + over, z: -20 }, 0.01)).toMatchObject({ id: g.id });
  });
});

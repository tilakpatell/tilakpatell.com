import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE, WIDTH, createBattle, inSights, perSide, turnToward } from './battle';
import { FIGHTERS, WARS } from './wars';
import { hullOf, segmentHit } from '../../lib/combat/hulls';
import { set } from './battleKit';
import { capitalPose } from '../../lib/combat/pose';

// a seeded random, so every run of a battle is the same
const seeded = (seed = 7) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const war = WARS.starwars;
const make = (o = {}) => createBattle({ war, attacker: 0, at: [0, 0, 0], axis: [1, 0], perSide: 8, rand: seeded(), ...o });
const run = (b, seconds, you = null, dt = 1 / 30) => {
  const events = [];
  for (let t = 0; t < seconds && !b.over; t += dt) events.push(...b.update(dt, you));
  return events;
};
const flagOf = (b, team) => b.capitals.find((c) => c.team === team && c.role === 'flagship');
// a shot from 2 units off straight through a point
const shotAt = (b, p, damage = 1) => b.hit({ x: p.x, y: p.y + 2, z: p.z }, { x: p.x, y: p.y - 0.01, z: p.z }, damage);

describe('the flagships’ objectives', () => {
  // A shot stops at the first thing it meets, and a hull's spheres are among
  // them, so an objective buried in one can't be hit. Bolts at each from all
  // round its outer side, a frame's flight at a time (a bolt's 60 a second
  // and the ship's own, at 60 frames a second), through your guns' own hit():
  // a fair share of those that meet the flagship itself must meet the
  // objective (Home One's reactor, reached mostly from astern, is the least).
  it('can each be shot from outside: a fair share of bolts that meet the flagship from round an objective’s outer side meet it', () => {
    for (const w of Object.values(WARS))
      for (const attacker of [0, 1]) {
        const b = createBattle({ war: w, attacker, at: [0, 0, 0], axis: [1, 0], perSide: 4, rand: seeded() });
        b.setYou(attacker);
        const flag = flagOf(b, b.defender);
        const rand = seeded(11);
        for (const phase of [1, 2, 3]) {
          for (const s of flag.subs.filter((o) => o.phase === phase)) {
            const out = { x: s.pos.x - flag.pos.x, y: s.pos.y - flag.pos.y, z: s.pos.z - flag.pos.z };
            let reached = 0;
            let stopped = 0;
            for (let n = 0; n < 80; n++) {
              let d;
              do d = { x: rand() * 2 - 1, y: rand() * 2 - 1, z: rand() * 2 - 1 };
              while (Math.hypot(d.x, d.y, d.z) > 1 || d.x * out.x + d.y * out.y + d.z * out.z <= 0);
              const l = Math.hypot(d.x, d.y, d.z);
              let p = { x: s.pos.x + (d.x / l) * 40, y: s.pos.y + (d.y / l) * 40, z: s.pos.z + (d.z / l) * 40 };
              let hit = null;
              for (let f = 0; f < 30 && !hit; f++) {
                const q = { x: p.x - (d.x / l) * 2, y: p.y - (d.y / l) * 2, z: p.z - (d.z / l) * 2 };
                hit = b.hit(p, q, 0);
                p = q;
              }
              if (hit?.sub === s.id) reached++;
              else if ((hit?.shield || hit?.capital) && hit.id === flag.id) stopped++; // (its own hull, not an escort in the way)
            }
            expect(reached / (reached + stopped), `${w.id}: ${flag.kind} ${s.id}`).toBeGreaterThan(0.25);
          }
          // (then on to the next phase: each taken out point-blank, whatever's round it)
          for (const s of flag.subs.filter((o) => o.phase === phase)) for (let i = 0; i < 400 && s.alive; i++) b.hit(s.pos, { x: s.pos.x, y: s.pos.y - 0.01, z: s.pos.z }, 5);
          run(b, 0.1);
          expect(b.phase, `${w.id}: ${flag.kind} past phase ${phase}`).toBe(phase + 1);
        }
      }
  });
});

describe('the objectives on an Interdictor', () => {
  // the Empire's line with an Interdictor among its escorts
  const withInterdictor = { ...war, sides: [war.sides[0], { ...war.sides[1], capitals: [...war.sides[1].capitals, { kind: 'interdictor', role: 'escort', size: 11, hull: 220 }] }] };
  it('puts the defender’s objectives on the Interdictor, and leaves the flagship its hull', () => {
    const b = make({ war: withInterdictor, objectivesOn: 'interdictor' });
    const inter = b.capitals.find((c) => c.kind === 'interdictor');
    const flag = flagOf(b, 1);
    expect(inter.subs.map((x) => x.id)).toEqual(['gen-port', 'gen-star', 'bridge', 'reactor']);
    expect(flag.subs).toEqual([]);
    expect(flag.tracked).toBe(true);
    expect(inter.tracked).toBe(false);
    b.setYou(0);
    expect(b.targets.filter((t) => t.kind === 'subsystem').length).toBe(2);
  });
  it('wins the battle for the attacker when the Interdictor’s down', () => {
    const b = make({ war: withInterdictor, objectivesOn: 'interdictor', perSide: 0 });
    b.setYou(0);
    const inter = b.capitals.find((c) => c.kind === 'interdictor');
    for (const phase of [1, 2, 3]) {
      for (const s of inter.subs.filter((o) => o.phase === phase)) for (let i = 0; i < 400 && s.alive; i++) b.hit(s.pos, { x: s.pos.x, y: s.pos.y - 0.01, z: s.pos.z }, 5);
      run(b, 0.1);
    }
    const events = run(b, BATTLE.dying + 1);
    expect(b.over).toMatchObject({ winner: 0, why: 'interdictor' });
    expect(events.some((e) => e.type === 'over' && e.why === 'interdictor')).toBe(true);
    expect(flagOf(b, 1).alive).toBe(true);
  });
  it('without an Interdictor, they stay on the flagship', () => {
    const b = make({ objectivesOn: 'interdictor' });
    expect(flagOf(b, 1).subs.length).toBe(4);
  });
});

describe('an ace', () => {
  it('is one of its side’s fighters, of its own kind, named, with its own hull', () => {
    const b = make({ ace: { 1: { kind: 'tieadvanced', name: 'Darth Vader', hp: 14 } } });
    const aces = b.fighters.filter((f) => f.ace);
    expect(aces).toHaveLength(1);
    const [a] = aces;
    expect(a).toMatchObject({ team: 1, kind: 'tieadvanced' });
    expect(a.tgt.name).toBe('Darth Vader');
    expect(a.hp).toBe(14);
    expect(a.tgt.hpMax).toBe(14);
  });
  it('down, says so, and doesn’t come back', () => {
    const b = make({ ace: { 1: { kind: 'tieadvanced', name: 'Darth Vader', hp: 3 } } });
    b.setYou(0);
    const a = b.fighters.find((f) => f.ace);
    for (let i = 0; i < 10 && a.alive; i++) shotAt(b, a.pos, 1);
    const events = run(b, 0.1);
    expect(events.find((e) => e.type === 'down' && e.mine)).toMatchObject({ ace: true, kind: 'tieadvanced' });
    expect(a.respawn).toBe(Infinity);
  });
});

describe('runners', () => {
  it('escaping, win the battle for their side', () => {
    const b = make({ perSide: 0, runners: { team: 1, kind: 'transport', size: 2.2, hp: 34, count: 4, need: 3, speed: 20, every: 0.5, from: [0, 0, 0], to: [0, 30, 0] } });
    const events = run(b, 20);
    expect(events.filter((e) => e.type === 'escaped' && e.team === 1).length).toBe(3);
    expect(b.over).toMatchObject({ winner: 1, why: 'runners' });
  });
  it('all down, lose it', () => {
    const b = make({ perSide: 0, runners: { team: 1, kind: 'transport', size: 2.2, hp: 2, count: 2, need: 2, speed: 2, every: 0.5, from: [0, 0, 0], to: [0, 400, 0] } });
    b.setYou(0);
    for (let t = 0; t < 4 && !b.over; t += 1 / 30) {
      for (const r of b.runners) if (r.alive) shotAt(b, r.pos, 5);
      b.update(1 / 30, null);
    }
    expect(b.runners.length).toBe(2);
    expect(b.over).toMatchObject({ winner: 0, why: 'runners' });
  });
});

describe('the fixed step', () => {
  // The battle moves on BATTLE.step at a time whatever the frame rate (a
  // frame's time owed carried to the next), so the same seed fights the same
  // battle on a 144 Hz screen, a 60 Hz one, a phone at 30 and a browser
  // check at 10: the same events in the same order, every fighter in the
  // same place.
  const transports = { team: 1, kind: 'transport', size: 2.2, hp: 34, count: 4, need: 4, speed: 6, every: 25, from: [60, 0, 0], to: [60, 0, -300] };
  const stateOf = (b) =>
    JSON.stringify({
      clock: b.clock,
      phase: b.phase,
      over: b.over,
      tickets: b.teams.map((t) => t.tickets),
      fighters: b.fighters.map((f) => [f.alive, f.hp, ...[f.pos.x, f.pos.y, f.pos.z].map((x) => Math.round(x * 1e6))]),
      subs: b.capitals.flatMap((c) => c.subs.map((s) => s.hp)),
      hulls: b.capitals.map((c) => c.hull),
      runners: b.runners.map((r) => [r.alive, r.hp, ...[r.pos.x, r.pos.y, r.pos.z].map((x) => Math.round(x * 1e6))]),
    });
  const fight = (dt) => {
    const b = make({ perSide: 8, rand: seeded(21), runners: transports });
    const log = [];
    for (let i = 0, n = Math.round(120 / dt); i < n; i++) for (const e of b.update(dt, null)) log.push(e);
    return { log: JSON.stringify(log), state: stateOf(b), events: log.length };
  };
  it('fights the same battle at any frame rate: same seed, same events and state after 120 s at 1/144, 1/60, 1/30 and 0.1 s a frame', () => {
    const base = fight(1 / 30);
    expect(base.events).toBeGreaterThan(50); // (a battle, not a quiet sky)
    for (const dt of [1 / 144, 1 / 60, 0.1]) {
      const other = fight(dt);
      expect(other.state, `state at dt ${dt}`).toBe(base.state);
      expect(other.log, `events at dt ${dt}`).toBe(base.log);
    }
  });
  it('carries a frame shorter than a step over to the next, and says how far ahead the drawing is', () => {
    const b = make();
    b.update(0.02, null);
    expect(b.clock).toBe(0);
    expect(b.ahead).toBeCloseTo(0.02, 9);
    b.update(0.02, null);
    expect(b.clock).toBeCloseTo(BATTLE.step, 9);
    expect(b.ahead).toBeCloseTo(0.04 - BATTLE.step, 9);
  });
  it('takes at most BATTLE.steps a frame: a long frame’s rest is dropped, so the battle slows rather than leaping', () => {
    const b = make();
    b.update(2, null);
    expect(b.clock).toBeCloseTo(BATTLE.steps * BATTLE.step, 9);
    expect(b.ahead).toBeLessThan(BATTLE.step);
  });
  it('locks on to a fighter where it’s drawn: between its last two steps, by how far the frame is into the next', () => {
    const b = make();
    b.setYou(0);
    b.update(0.05, null);
    const f = b.fighters.find((o) => o.team === 1 && o.alive);
    const t = b.targets.find((o) => o.id === f.id);
    const a = b.ahead / BATTLE.step;
    expect(b.behind).toBeCloseTo(BATTLE.step - b.ahead, 9);
    expect(t.at.x).toBeCloseTo(f.prev.x + (f.pos.x - f.prev.x) * a, 9);
    expect(t.at.z).toBeCloseTo(f.prev.z + (f.pos.z - f.prev.z) * a, 9);
    // and a shot through where it's drawn hits it
    expect(shotAt(b, t.at)?.id).toBe(f.id);
  });
});

describe('the battle’s modules', () => {
  // (battle.js was one file over a thousand lines: it's split by what each
  // part does, the fighters' flying, the capital ships, the runners, so each
  // stays under the health check's warning line, scripts/health/big-files.mjs)
  it('each stay under 800 lines', () => {
    // (and the galaxy's shared battle beside them: its director, its plan, its stages in the sim)
    for (const file of ['battle.js', 'battleKit.js', 'battleAi.js', 'battleCapitals.js', 'battleRunners.js', 'battleDirector.js', 'battlePlan.js', 'battleStages.js', 'battleObjectives.js', 'battleProps.js', 'battleScene.js', 'battleFx.js']) {
      const lines = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8').split('\n').length;
      expect(lines, file).toBeLessThan(800);
    }
  });
});

describe('perSide', () => {
  it('is 32 a side on a strong desktop, 20 on a middling one, 10 on a phone', () => {
    expect(perSide('high')).toBe(32);
    expect(perSide('mid')).toBe(20);
    expect(perSide('low')).toBe(10);
    expect(perSide(undefined)).toBe(20);
  });
});

describe('turnToward and inSights', () => {
  it('turns the nose toward where it wants to go, no faster than it can', () => {
    const f = turnToward({ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }, 0.5);
    expect(Math.acos(f.z)).toBeCloseTo(0.5, 5);
    expect(Math.hypot(f.x, f.y, f.z)).toBeCloseTo(1, 9);
    const g = turnToward({ x: 0, y: 0, z: 1 }, { x: 0.1, y: 0, z: 1 }, 0.5);
    expect(g.x / g.z).toBeCloseTo(0.1, 5);
  });

  it('fires only with the target inside its cone and in range', () => {
    const type = FIGHTERS.xwing;
    expect(inSights({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 10 }, type)).toBe(true);
    expect(inSights({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: type.range + 1 }, type)).toBe(false);
    expect(inSights({ x: 0, y: 0, z: 1 }, { x: 3, y: 0, z: 10 }, type)).toBe(false);
  });
});

describe('a battle', () => {
  it('puts each side’s fleet in its line, and its fighters up', () => {
    const b = make();
    for (const team of [0, 1]) {
      const side = war.sides[team];
      const fighters = b.fighters.filter((f) => f.team === team);
      expect(fighters).toHaveLength(8);
      for (const f of fighters) expect(side.fighters.map((o) => o.kind)).toContain(f.kind);
      expect(b.capitals.filter((c) => c.team === team)).toHaveLength(side.capitals.length);
      expect(b.teams[team].tickets).toBe(BATTLE.tickets);
    }
    // the attacker's line is on the −axis side, the defender's on the +axis side
    expect(flagOf(b, 0).pos.x).toBeLessThan(0);
    expect(flagOf(b, 1).pos.x).toBeGreaterThan(0);
  });

  it('a fighter takes as many hits as it has hp, then it’s down and a ticket’s gone', () => {
    const b = make();
    b.setYou(0);
    const f = b.fighters.find((o) => o.team === 1);
    const hp = f.hp;
    let r = null;
    for (let i = 0; i < hp; i++) r = shotAt(b, f.pos);
    expect(r.down).toBe(true);
    expect(f.alive).toBe(false);
    expect(b.teams[1].tickets).toBe(BATTLE.tickets - 1);
    const events = run(b, 0.1);
    expect(events.some((e) => e.type === 'down' && e.team === 1 && e.mine)).toBe(true);
    // (and says what it was: the galaxy's war counts a bomber down as an intercept)
    expect(events.find((e) => e.type === 'down' && e.mine).role).toBe(f.role);
  });

  it('your shots don’t touch your own side', () => {
    const b = make();
    b.setYou(0);
    const f = b.fighters.find((o) => o.team === 0);
    expect(shotAt(b, f.pos)).toBeNull();
    expect(f.alive).toBe(true);
  });

  it('only the defender’s flagship has objectives', () => {
    const b = make();
    b.setYou(0);
    expect(flagOf(b, 0).subs).toHaveLength(0);
    expect(flagOf(b, 1).subs).toHaveLength(4);
    const subs = b.targets.filter((t) => t.sub);
    expect(subs.length).toBe(2); // phase 1: the two shield generators
    for (const t of subs) expect(flagOf(b, 1).subs.map((s) => s.id)).toContain(t.sub);
  });

  it('the shield holds everything off the flagship till both generators are down', () => {
    const b = make();
    b.setYou(0);
    const flag = flagOf(b, 1);
    const bridge = flag.subs.find((s) => s.kind === 'bridge');
    const before = bridge.hp;
    shotAt(b, bridge.pos, 5);
    expect(bridge.hp).toBe(before);
    const gens = flag.subs.filter((s) => s.kind === 'shieldgen');
    for (const g of gens) while (g.alive) shotAt(b, g.pos, 5);
    const events = run(b, 0.1);
    expect(b.phase).toBe(2);
    expect(events.some((e) => e.type === 'shield' && e.down)).toBe(true);
    expect(events.some((e) => e.type === 'phase' && e.phase === 2)).toBe(true);
    shotAt(b, bridge.pos, 5);
    expect(bridge.hp).toBe(before - 5 * BATTLE.youShare);
  });

  it('takes the phases only in order', () => {
    const b = make();
    b.setYou(0);
    const flag = flagOf(b, 1);
    const reactor = flag.subs.find((s) => s.kind === 'reactor');
    const hp = reactor.hp;
    for (let i = 0; i < 20; i++) shotAt(b, reactor.pos, 5);
    expect(reactor.hp).toBe(hp);
    expect(b.phase).toBe(1);
  });

  it('breaks the flagship and ends the battle when the reactor goes', () => {
    const b = make();
    b.setYou(0);
    const flag = flagOf(b, 1);
    for (const phase of [1, 2, 3]) {
      for (const s of flag.subs.filter((o) => o.phase === phase)) while (s.alive) shotAt(b, s.pos, 5);
      run(b, 0.1);
    }
    expect(flag.dying).toBeGreaterThan(0);
    const events = run(b, 10);
    expect(events.some((e) => e.type === 'capital' && e.team === 1)).toBe(true);
    expect(b.over).toEqual({ winner: 0, why: 'flagship' });
  });

  it('a dead player is not targeted', () => {
    const b = make();
    b.setYou(1);
    const you = { x: -60, y: 0, z: 0, alive: false };
    run(b, 6, you);
    expect(b.fighters.some((f) => f.target === b.you)).toBe(false);
  });

  it('the player is targeted only by the other side', () => {
    const b = make();
    b.setYou(0);
    const you = { x: 0, y: 0, z: 0, alive: true };
    run(b, 8, you);
    expect(b.fighters.filter((f) => f.team === 0).some((f) => f.target === b.you)).toBe(false);
    expect(b.fighters.filter((f) => f.team === 1).some((f) => f.target === b.you)).toBe(true);
  });

  it('hurts you with the other side’s fire', () => {
    const b = make();
    b.setYou(0);
    const you = { x: 0, y: 0, z: 0, alive: true };
    const events = run(b, 30, you);
    expect(events.some((e) => e.type === 'hurt' && e.damage > 0)).toBe(true);
  });

  it('no respawn without tickets', () => {
    const b = make();
    b.setYou(1);
    b.teams[0].tickets = 0;
    const f = b.fighters.find((o) => o.team === 0);
    while (f.alive) shotAt(b, f.pos, 5);
    run(b, 15);
    expect(f.alive).toBe(false);
    expect(b.teams[0].tickets).toBe(0);
  });

  it('brings a fighter back from its side’s tickets after a while', () => {
    const b = make();
    b.setYou(1);
    const f = b.fighters.find((o) => o.team === 0);
    while (f.alive) shotAt(b, f.pos, 5);
    const events = run(b, BATTLE.respawn[1] + 0.5);
    expect(f.alive).toBe(true);
    expect(events.some((e) => e.type === 'arrive' && e.team === 0)).toBe(true);
  });

  it('counts your shots on a subsystem for more than an AI’s torpedo', () => {
    const b = make();
    b.setYou(0);
    const g = flagOf(b, 1).subs.find((s) => s.kind === 'shieldgen');
    const hp = g.hp;
    shotAt(b, g.pos, 1);
    expect(hp - g.hp).toBeCloseTo(BATTLE.youShare, 9);
    // a torpedo from just off it, straight in
    const h2 = g.hp;
    b.fire(0, { x: g.pos.x, y: g.pos.y + 3, z: g.pos.z }, { x: 0, y: -1, z: 0 }, 'torpedo');
    run(b, 1);
    expect(h2 - g.hp).toBeCloseTo(BATTLE.bolts.torpedo.damage * BATTLE.aiShare, 6);
    expect(BATTLE.youShare).toBeGreaterThan(BATTLE.aiShare);
  });

  it('a battle left to itself ends within its clock', () => {
    const b = make({ perSide: 10, rand: seeded(11) });
    run(b, BATTLE.clock + 1, null, 1 / 20);
    expect(b.over).not.toBeNull();
    expect([0, 1]).toContain(b.over.winner);
    expect(b.clock).toBeLessThanOrEqual(BATTLE.clock + 0.1);
  });

  it('flies 64 fighters a frame quickly enough', () => {
    const b = make({ perSide: 32 });
    const t0 = performance.now();
    for (let i = 0; i < 1200; i++) b.update(1 / 60, { x: 0, y: 0, z: 0, alive: true });
    expect(performance.now() - t0).toBeLessThan(4000);
  });

  it('names what your guns lock on to', () => {
    const b = make();
    b.setYou(0);
    for (const t of b.targets) expect(typeof t.name).toBe('string');
    expect(b.targets.find((t) => t.kind === 'tie')?.name).toBe('TIE fighter');
    expect(b.targets.find((t) => t.sub === 'gen-port')?.name).toBe('Shield generator');
  });

  it('ends at once when asked (a dev hook)', () => {
    const b = make();
    b.end(1);
    expect(b.over).toEqual({ winner: 1, why: 'forced' });
  });

  // ── a battle in the galaxy (galaxy/warfront.js): its own size, round its planet, shared ──
  it('takes its own lines and radius', () => {
    const b = make({ lines: 120, radius: 200 });
    expect(flagOf(b, 0).pos.x).toBeCloseTo(-120);
    expect(flagOf(b, 1).pos.x).toBeCloseTo(120);
    expect(b.radius).toBe(200);
  });

  it('keeps a big fleet’s capital ships clear of each other', () => {
    const big = {
      ...war,
      sides: [
        { ...war.sides[0], capitals: [{ kind: 'moncal', role: 'flagship', size: 26, hull: 500 }, ...Array.from({ length: 6 }, (_, i) => ({ kind: i % 2 ? 'nebulon' : 'moncal', role: 'escort', size: i % 2 ? 6 : 22, hull: 200 }))] },
        { ...war.sides[1], capitals: [{ kind: 'executor', role: 'flagship', size: 110, hull: 2000 }, ...Array.from({ length: 5 }, () => ({ kind: 'destroyer', role: 'escort', size: 30, hull: 600 }))] },
      ],
    };
    const b = make({ war: big, lines: 100 });
    // side by side across the line, each as wide as it is (WIDTH: a share of its length)
    for (const team of [0, 1]) {
      const caps = b.capitals.filter((c) => c.team === team);
      for (let i = 0; i < caps.length; i++)
        for (let j = i + 1; j < caps.length; j++) {
          const across = Math.abs(caps[i].pos.z - caps[j].pos.z);
          const w = (WIDTH[caps[i].kind] * caps[i].size + WIDTH[caps[j].kind] * caps[j].size) / 2;
          expect(across, `${caps[i].kind} ${i} and ${caps[j].kind} ${j}`).toBeGreaterThan(w);
        }
    }
  });

  it('steers its fighters clear of what it’s told to keep out of (a planet, a shield)', () => {
    const inside = (avoid) => {
      const b = make({ perSide: 12, rand: seeded(5), avoid });
      const ball = { c: { x: 0, y: 0, z: 0 }, r: 30 };
      let n = 0;
      for (let i = 0; i < 600; i++) {
        b.update(1 / 30, null);
        for (const f of b.fighters) if (f.alive && Math.hypot(f.pos.x - ball.c.x, f.pos.y - ball.c.y, f.pos.z - ball.c.z) < ball.r) n++;
      }
      return n;
    };
    const free = inside([]);
    const kept = inside([{ c: { x: 0, y: 0, z: 0 }, r: 30 }]);
    expect(kept).toBeLessThan(free * 0.25);
  });

  it('counts what other pilots did to an objective, and tells what you did', () => {
    const done = new Map([['gen-port', 1000]]);
    const mine = [];
    const b = make({ shared: (id) => done.get(id) ?? 0, onMine: (id, dmg) => mine.push([id, dmg]) });
    b.setYou(0);
    const events = run(b, 0.1);
    expect(events.some((e) => e.type === 'sub' && e.sub === 'gen-port' && !e.mine)).toBe(true);
    const g = flagOf(b, 1).subs.find((s) => s.id === 'gen-star');
    shotAt(b, g.pos, 2);
    expect(mine).toEqual([['gen-star', 2 * BATTLE.youShare]]);
    done.set('gen-star', 1000);
    run(b, 0.1);
    expect(b.phase).toBe(2);
  });

  it('starts its clock where the shared schedule is, and ends on its own clock', () => {
    const b = make({ elapsed: 300, clock: 320, perSide: 4 });
    expect(b.clock).toBe(300);
    run(b, 30, null, 1 / 10);
    expect(b.over?.why).toBe('clock');
    expect(b.info.left).toBe(0);
  });

  it('ends on tickets as it always has, unless told not to', () => {
    const b = make({ perSide: 2 });
    b.teams[0].tickets = 0;
    for (const f of b.fighters) if (f.team === 0) (f.alive = false), (f.respawn = Infinity);
    run(b, 0.2);
    expect(b.over?.why).toBe('tickets');
  });

  it('without tickets (the galaxy’s), brings a fighter back even once its side’s are spent', () => {
    // (tickets: false is a battle fought to its clock: the fighters keep
    // coming, and the count's only a count)
    const b = make({ tickets: false });
    b.setYou(1);
    b.teams[0].tickets = 0;
    const f = b.fighters.find((o) => o.team === 0);
    while (f.alive) shotAt(b, f.pos, 5);
    const events = run(b, BATTLE.respawn[1] + 0.5);
    expect(f.alive).toBe(true);
    expect(events.some((e) => e.type === 'arrive' && e.team === 0)).toBe(true);
    expect(b.teams[0].tickets).toBe(0);
  });

  it('lets the defender hold out: no tickets end when told so', () => {
    const b = make({ tickets: false, perSide: 2 });
    b.teams[0].tickets = 0;
    for (const f of b.fighters) if (f.team === 0) (f.alive = false), (f.respawn = Infinity);
    run(b, 2);
    expect(b.over).toBeNull();
  });

  // ── the set pieces' hooks (galaxy/warpieces/) ──
  it('lets an ion cannon disable a capital ship a while: its guns quiet, hits on it counting more', () => {
    const b = make({ perSide: 2 });
    b.setYou(0);
    const esc = b.capitals.find((c) => c.team === 1 && c.role === 'escort');
    const events = [];
    b.disable(esc.id, 5);
    events.push(...b.update(0.1, null));
    expect(events.some((e) => e.type === 'disabled' && e.id === esc.id)).toBe(true);
    expect(esc.disabled).toBeGreaterThan(0);
    // (its batteries hold their fire)
    for (const tu of esc.turrets) tu.turbo = tu.flak = 0;
    const firing = () => b.bolts.filter((o) => o.on && o.team === 1).length;
    const before = firing();
    b.update(0.05, null);
    const after = b.bolts.filter((o) => o.on && o.team === 1 && Math.hypot(o.x - esc.pos.x, o.y - esc.pos.y, o.z - esc.pos.z) < esc.size).length;
    expect(after).toBe(0);
    expect(before).toBeGreaterThanOrEqual(0);
    const hull = esc.hull;
    const sp = esc.spheres[0].c;
    b.hit({ x: sp.x, y: sp.y + 30, z: sp.z }, { x: sp.x, y: sp.y - 0.01, z: sp.z }, 1);
    expect(hull - esc.hull).toBeCloseTo(BATTLE.youShare * BATTLE.youHull * 3, 6);
    run(b, 6, null, 0.1);
    expect(esc.disabled).toBe(0);
  });

  it('makes its batteries targets: shot out, they’re quiet for good', () => {
    const b = make({ perSide: 2 });
    b.setYou(0);
    const cap = b.capitals.find((c) => c.team === 1 && c.role === 'escort');
    const tu = cap.turrets[0];
    expect(tu.alive).toBe(true);
    let hit = null;
    for (let i = 0; i < 20 && tu.alive; i++) hit = b.hit({ x: tu.at.x, y: tu.at.y + 2, z: tu.at.z }, { x: tu.at.x, y: tu.at.y - 0.01, z: tu.at.z }, 1);
    expect(tu.alive).toBe(false);
    expect(hit.kind).toBe('turret');
    const events = b.update(0.05, null);
    expect(events.some((e) => e.type === 'turret' && e.mine)).toBe(true);
    // the ones near you, on the lock's list
    b.update(0.05, { x: cap.pos.x, y: cap.pos.y + 4, z: cap.pos.z, alive: true });
    const near = b.targets.filter((t) => t.kind === 'turret');
    expect(near.length).toBeGreaterThan(0);
    expect(near.every((t) => t.id !== tu.num)).toBe(true);
  });

  it('moves and turns a capital ship with everything on it (its hull, batteries, objectives)', () => {
    const b = make({ perSide: 2 });
    const flag = flagOf(b, 1);
    const sub = flag.subs[0].pos;
    const was = { ...sub };
    const sp = { ...flag.spheres[0].c };
    b.moveCapital(flag, { x: 5, y: -2, z: 1 });
    expect(sub.x - was.x).toBeCloseTo(5);
    expect(flag.spheres[0].c.y - sp.y).toBeCloseTo(-2);
    const d0 = Math.hypot(sub.x - flag.pos.x, sub.y - flag.pos.y, sub.z - flag.pos.z);
    b.turnCapital(flag, { x: 0, y: 1, z: 0 }, 0.6);
    expect(Math.hypot(sub.x - flag.pos.x, sub.y - flag.pos.y, sub.z - flag.pos.z)).toBeCloseTo(d0, 6);
    expect(Math.hypot(flag.fwd.x, flag.fwd.y, flag.fwd.z)).toBeCloseTo(1, 6);
  });

  it('flies runners for the jump (Hoth’s transports): the other side goes for them, and they get away or don’t', () => {
    const b = make({ perSide: 8, rand: seeded(3) });
    const r = b.addRunner({ team: 0, kind: 'transport', size: 2.2, hp: 30, from: { x: -20, y: 0, z: 0 }, to: { x: -20, y: 0, z: -150 }, speed: 8 });
    expect(r.alive).toBe(true);
    const events = run(b, 24, null, 0.05);
    const done = events.find((e) => (e.type === 'escaped' || e.type === 'runner') && e.id === r.id);
    expect(done).toBeTruthy();
    // (the other side went after it)
    expect(r.hitBy).toBeGreaterThan(0);
  });
});

describe('a ram on one of the other side’s fighters', () => {
  it('is a shot’s hit on that one: down at its hp, told as yours', () => {
    const b = make();
    b.setYou(0);
    run(b, 1);
    const f = b.fighters.find((o) => o.alive && o.team === 1 && !o.ace);
    const hp = f.hp;
    const r = b.strike(f.id, hp);
    expect(r).toMatchObject({ id: f.id, kind: f.kind, size: f.size, down: true });
    expect(f.alive).toBe(false);
    const events = b.update(1 / 30, null);
    expect(events.some((e) => e.type === 'down' && e.mine && e.kind === f.kind)).toBe(true);
  });

  it('is nothing on your own side’s, one already down, or before you have joined', () => {
    const b = make();
    run(b, 1);
    const enemy = b.fighters.find((o) => o.alive && o.team === 1);
    expect(b.strike(enemy.id, 1)).toBeNull(); // (not joined)
    b.setYou(0);
    const mine = b.fighters.find((o) => o.alive && o.team === 0);
    expect(b.strike(mine.id, 1)).toBeNull();
    enemy.alive = false;
    expect(b.strike(enemy.id, 1)).toBeNull();
  });
});

describe('the hulls (the galaxy’s hulls design: a bolt meets a ship on its shapes)', () => {
  const hullBin = (name) => {
    const b = readFileSync(new URL(`../../../scripts/fixtures/bf2017/physics/${name}-hull.bin`, import.meta.url));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  };
  const HULLS = { destroyer: hullOf(hullBin('destroyer')), xwing: hullOf(hullBin('xwing')) };
  const hulls = { get: (kind) => HULLS[kind] ?? null };
  // a point in a capital's own frame (shares of its length: right, up, forward), where it's drawn (its bob included)
  const on = (cap, [r, u, f]) => {
    const { at0 } = capitalPose(cap, 0, false);
    return { x: at0[0] + (cap.right.x * r + cap.up.x * u + cap.fwd.x * f) * cap.size, y: at0[1] + (cap.right.y * r + cap.up.y * u + cap.fwd.y * f) * cap.size, z: at0[2] + (cap.right.z * r + cap.up.z * u + cap.fwd.z * f) * cap.size };
  };

  it('a bolt at a Star Destroyer’s wing edge meets its hull, where the spheres missed', () => {
    const b = make({ hulls });
    b.setYou(0);
    const sd = b.capitals.find((c) => c.team === 1 && c.kind === 'destroyer');
    expect(sd).toBeTruthy();
    // the wing, a quarter of its length out from the centre line, astern: nothing of the spheres' chain reaches it
    // (a bolt straight down through it: the wing's plane sits under the box's middle, the tower raising it)
    const down = (bt, p) => bt.hit({ x: p.x, y: p.y + 3, z: p.z }, { x: p.x, y: p.y - 3, z: p.z }, 0);
    const spheres = make();
    spheres.setYou(0);
    const sd2 = spheres.capitals.find((c) => c.team === 1 && c.kind === 'destroyer');
    expect(down(spheres, on(sd2, [0.25, 0, -0.35]))).toBeNull();
    const hit = down(b, on(sd, [0.25, 0, -0.35]));
    expect(hit).toMatchObject({ id: sd.id, shield: true }); // (the defender's flagship, its shield up in phase 1: the hull decided where)
    expect(hit.part).toBeGreaterThanOrEqual(0);
    expect(hit.property).toBe(132); // (the Star Destroyer's hull material: damage.json's parts)
    // and the space beside the wing is still open
    expect(down(b, on(sd, [0.5, 0, -0.35]))).toBeNull();
  });

  it('a bolt over an X-wing’s back misses it where its sphere would have hit, and one through its hull hits', () => {
    const b = make({ hulls });
    b.setYou(1);
    const f = b.fighters.find((o) => o.team === 0 && o.kind === 'xwing' && o.alive);
    expect(f).toBeTruthy();
    // level flight, so the hull's frame is the world's
    Object.assign(f.fwd, { x: 0, y: 0, z: 1 });
    f.bank = 0;
    f.vel.x = f.vel.y = f.vel.z = 0;
    b.update(0, null); // (seen = pos)
    const over = f.size * 0.2; // (above its box, 0.095 of its length tall, and inside its 0.35 sphere)
    const across = (y) => b.hit({ x: f.seen.x - 1, y: f.seen.y + y, z: f.seen.z }, { x: f.seen.x + 1, y: f.seen.y + y, z: f.seen.z }, 0);
    expect(across(over)).toBeNull();
    const hit = across(0);
    expect(hit).toMatchObject({ id: f.id, kind: 'xwing' });
    expect(hit.property).toBe(68); // (the X-wing's parts' material pair)
    expect(hit.at.y).toBeCloseTo(f.seen.y, 3);
  });

  it('a ship whose kind has no hull is still hit as its sphere', () => {
    const b = make({ hulls: { get: () => null } });
    b.setYou(1);
    const f = b.fighters.find((o) => o.team === 0 && o.kind === 'xwing' && o.alive);
    Object.assign(f.fwd, { x: 0, y: 0, z: 1 });
    f.vel.x = f.vel.y = f.vel.z = 0;
    b.update(0, null);
    const over = f.size * 0.2;
    expect(b.hit({ x: f.seen.x - 1, y: f.seen.y + over, z: f.seen.z }, { x: f.seen.x + 1, y: f.seen.y + over, z: f.seen.z }, 0)).toMatchObject({ id: f.id });
  });

  it('the AI’s bolts meet a fighter on its hull too', () => {
    const b = make({ hulls });
    const f = b.fighters.find((o) => o.team === 0 && o.kind === 'xwing' && o.alive);
    Object.assign(f.fwd, { x: 0, y: 0, z: 1 });
    f.bank = 0;
    const hp = f.hp;
    // a bolt of the other side's over its back, this step: it flies on
    const over = f.size * 0.2;
    const bolt = b.fire(1, { x: f.pos.x - 1, y: f.pos.y + over, z: f.pos.z }, { x: 1, y: 0, z: 0 }, 'laser');
    // (the fighter held still for the step, so the bolt's path and the hull's frame are known)
    f.speed = 0;
    f.vel.x = f.vel.y = f.vel.z = 0;
    const turn = f.type.turn;
    f.type = { ...f.type, turn: 0 };
    b.update(1 / 30, null);
    f.type = { ...f.type, turn };
    expect(bolt.on).toBe(true);
    expect(f.hp).toBe(hp);
  });

  it('a fighter flying through a Star Destroyer’s wing is put back out of it by the step, not left to fly through', () => {
    const b = make({ hulls });
    const sd = b.capitals.find((c) => c.team === 1 && c.kind === 'destroyer');
    const f = b.fighters.find((o) => o.team === 0 && o.kind === 'xwing' && o.alive);
    const pose = capitalPose(sd, 0, false);
    // the wing's upper face, a quarter of the length out, astern
    const p = on(sd, [0.25, 0, -0.35]);
    const top = segmentHit(HULLS.destroyer, pose, [p.x, p.y + 3, p.z], [p.x, p.y - 3, p.z]).point[1];
    // the fighter just over it, diving straight at it at its speed: a step's way (0.67) is through the plate
    Object.assign(f.pos, { x: p.x, y: top + 0.3, z: p.z });
    Object.assign(f.prev, f.pos);
    Object.assign(f.fwd, { x: 0, y: -1, z: 0 });
    f.bank = 0;
    f.speed = 20;
    set(f.vel, 0, -20, 0);
    f.type = { ...f.type, turn: 0, speed: 20 };
    const without = make();
    const g = without.fighters.find((o) => o.team === 0 && o.kind === 'xwing' && o.alive);
    Object.assign(g.pos, f.pos);
    Object.assign(g.prev, f.pos);
    Object.assign(g.fwd, f.fwd);
    g.speed = 20;
    set(g.vel, 0, -20, 0);
    g.type = { ...g.type, turn: 0, speed: 20 };
    without.update(1 / 30, null);
    b.update(1 / 30, null);
    expect(g.pos.y).toBeLessThan(top - 0.2); // (through it, on the spheres)
    expect(f.pos.y).toBeGreaterThan(top - 0.01); // (held on the wing's face)
    expect(f.fwd.y).toBeGreaterThan(-1); // (its nose eased along the face)
  });
});

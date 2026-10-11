import { describe, expect, it } from 'vitest';
import { createSolids } from '../walker';
import { ASSAULTS, sidesFor } from './assaults';
import { REACH } from '../terrain';
import { siteOf } from '../sites';
import { BATTLE_BODY, RULES, SOLDIERS, TACTICS, battleView, canDeploy, chooseSide, coverFrom, deploy, endBattle, forwardOf, hitSoldier, newBattle, objectiveFor, sideFor, soldierBody, stepBattle, warSideOf, youDown } from './assault';
import { bodyFrom } from '../../../../lib/ai/body';
import { EARN, offersFor } from './points';
import { turnAt } from '../sites/turnSite';
import { SITES as FOREST } from '../sites/forest';

// (a point on Kashyyyk back into its site's own frame)
const TURN = FOREST.kashyyyk.turn;
const U = ([x, z]) => turnAt({ yaw: -TURN.yaw })([x - TURN.by[0], z - TURN.by[1]]);

// a small map: the attackers come from the west, two posts to take, then a last one
const MAP = {
  id: 'assault',
  system: 'test',
  kind: 'assault',
  name: 'A test battle',
  start: [-120, 0],
  yaw: 0,
  stars: [300, 480],
  sides: {
    attack: { id: 'empire', name: 'The Empire', short: 'Empire', colour: '#9fd0ff', kinds: [['snowtrooper', 1]] },
    defend: { id: 'rebels', name: 'The Rebellion', short: 'Rebellion', colour: '#ff8a5a', kinds: [['hothtrooper', 1]] },
  },
  posts: [
    { id: 'line', name: 'The line', at: [-120, 0], r: 20, fixed: 'attack' },
    { id: 'a', name: 'Post A', at: [0, 30], r: 16 },
    { id: 'b', name: 'Post B', at: [0, -30], r: 16 },
    { id: 'c', name: 'Post C', at: [120, 0], r: 16 },
    { id: 'base', name: 'The base', at: [220, 0], r: 20, fixed: 'defend' },
  ],
  phases: [
    { name: 'The front', posts: ['a', 'b'], tickets: 60 },
    { name: 'The last stand', posts: ['c'], tickets: 50 },
  ],
  tickets: { attack: 60, defend: 90 },
  ends: { won: 'Won', lost: 'Lost', why: { tickets: 'Out of reinforcements.', posts: 'The last post fell.' } },
};
const env = { solids: createSolids(), reach: 600 };
const run = (b, secs, you = null, dt = 0.1) => {
  const out = [];
  for (let t = 0; t < secs - 1e-9; t += dt) out.push(...stepBattle(b, dt, you, env));
  return out;
};
const post = (b, id) => b.posts.find((p) => p.id === id);
const up = (b, side) => b.soldiers.filter((s) => s.side === side && s.up);

describe('the battle, laid out', () => {
  it('starts at the choose card with the posts the defenders’ and nobody up', () => {
    const b = newBattle(MAP, { n: 6, seed: 3 });
    expect(b.phase).toBe('choose');
    expect(b.soldiers).toHaveLength(12);
    expect(b.soldiers.every((s) => !s.up)).toBe(true);
    for (const id of ['a', 'b', 'c']) expect(post(b, id).owner).toBe('defend');
    expect(post(b, 'line').owner).toBe('attack');
    expect(post(b, 'base').owner).toBe('defend');
    expect(b.tickets).toEqual({ attack: 60, defend: 90 });
    expect(SOLDIERS.high).toBeGreaterThan(SOLDIERS.mid);
    expect(SOLDIERS.mid).toBeGreaterThan(SOLDIERS.low);
  });

  it('chosen, it runs: the defenders inside the live posts, the attackers on their staging line short of the front', () => {
    const b = newBattle(MAP, { n: 6, seed: 3 });
    chooseSide(b, 'attack');
    expect(b.phase).toBe('run');
    expect(b.you.side).toBe('attack');
    expect(up(b, 'attack')).toHaveLength(6);
    expect(up(b, 'defend')).toHaveLength(6);
    for (const s of up(b, 'defend')) expect(['a', 'b'].some((id) => Math.hypot(s.x - post(b, id).at[0], s.z - post(b, id).at[1]) <= post(b, id).r)).toBe(true);
    // (RULES.firstWave times RULES.forward short of post A or B, or at their
    // line at x = −120 where that's nearer: the first wave has further to
    // come than the waves after it)
    const lineToPost = Math.hypot(120, 30);
    for (const s of up(b, 'attack')) {
      const near = Math.min(Math.hypot(s.x, s.z - 30), Math.hypot(s.x, s.z + 30));
      expect(near).toBeLessThan(lineToPost + 22);
      expect(near).toBeGreaterThan(Math.min(RULES.forward * RULES.firstWave, lineToPost) - 24);
    }
    // (no ticket spent on the first wave)
    expect(b.tickets).toEqual({ attack: 60, defend: 90 });
    // (a kind each, from the side's list)
    for (const s of b.soldiers) expect(s.kind).toBe(s.side === 'attack' ? 'snowtrooper' : 'hothtrooper');
  });

  it('spends nothing and moves nobody before a side is chosen', () => {
    const b = newBattle(MAP, { n: 4, seed: 1 });
    run(b, 5);
    expect(b.t).toBe(0);
    expect(b.soldiers.every((s) => !s.up)).toBe(true);
  });
});

// a battle with no soldiers at all, so the posts answer only to `you`
const empty = (side = 'attack') => {
  const b = newBattle(MAP, { n: 0, seed: 1 });
  chooseSide(b, side);
  return b;
};

describe('a command post', () => {
  it('is neutralised by one soldier alone in 1 / 0.08 s, and taken in as long again', () => {
    const b = empty('attack');
    b.you.up = true;
    const you = { x: 0, z: 30 }; // inside post A
    const T = 1 / RULES.capture;
    run(b, T - 0.3, you);
    expect(post(b, 'a').owner).toBe('defend');
    expect(post(b, 'a').meter).toBeLessThan(0.05);
    const ev = run(b, 0.6, you);
    expect(post(b, 'a').owner).toBeNull();
    expect(ev.some((e) => e.type === 'neutral' && e.post === 'a' && e.by === 'attack')).toBe(true);
    const ev2 = run(b, T + 0.3, you);
    expect(post(b, 'a').owner).toBe('attack');
    expect(ev2.some((e) => e.type === 'capture' && e.post === 'a' && e.side === 'attack' && e.you === true)).toBe(true);
    expect(b.you.captures).toBe(1);
  });

  it('flips no faster than four soldiers’ worth, however many stand in it', () => {
    const b = newBattle(MAP, { n: 8, seed: 2 });
    chooseSide(b, 'defend');
    // every attacker put inside post B, every defender far away and still
    for (const s of b.soldiers) {
      if (s.side === 'attack') Object.assign(s, { x: 0, z: -30 });
      else Object.assign(s, { x: 220, z: 0 });
      s.frozen = true;
    }
    run(b, 1);
    expect(post(b, 'b').meter).toBeCloseTo(1 - RULES.capture * RULES.advantage, 1);
  });

  it('holds while the numbers are even', () => {
    const b = newBattle(MAP, { n: 2, seed: 2 });
    chooseSide(b, 'attack');
    for (const s of b.soldiers) {
      Object.assign(s, { x: 0, z: 30, frozen: true, unarmed: true });
    }
    run(b, 5);
    expect(post(b, 'a').owner).toBe('defend');
    expect(post(b, 'a').meter).toBe(1);
  });

  it('recovers for its owner once the attackers are gone', () => {
    const b = empty('attack');
    b.you.up = true;
    run(b, 6, { x: 0, z: 30 });
    expect(post(b, 'a').meter).toBeLessThan(0.6);
    // a defender alone in it now
    b.soldiers.push({ id: 99, side: 'defend', kind: 'hothtrooper', x: 0, z: 30, yaw: 0, hp: 100, up: true, down: 0, post: 'a', cool: 1, wait: 0, frozen: true });
    run(b, 20, null);
    expect(post(b, 'a').meter).toBe(1);
  });
});

describe('the soldiers', () => {
  it('reach their post across an empty field', () => {
    const b = newBattle(MAP, { n: 1, seed: 4 });
    chooseSide(b, 'defend');
    const a = up(b, 'attack')[0];
    // (the defender sent off the field, so nothing stops the attacker)
    for (const s of up(b, 'defend')) Object.assign(s, { x: 500, z: 0, frozen: true, unarmed: true });
    const d = Math.hypot(a.x, a.z - 30); // to post A, or B (the same distance)
    run(b, d / RULES.walk + 8);
    const inA = Math.hypot(a.x - 0, a.z - 30) <= 16;
    const inB = Math.hypot(a.x - 0, a.z + 30) <= 16;
    expect(inA || inB).toBe(true);
  });

  it('steer round what’s solid', () => {
    const solids = createSolids();
    for (let z = -12; z <= 12; z += 2) solids.box(-60, z, 1, 1); // a wall across the way, with a way round
    const b = newBattle({ ...MAP, phases: [{ name: 'One', posts: ['a'], tickets: 60 }] }, { n: 1, seed: 5 });
    chooseSide(b, 'defend');
    for (const s of up(b, 'defend')) Object.assign(s, { x: 500, z: 0, frozen: true, unarmed: true });
    const a = up(b, 'attack')[0];
    Object.assign(a, { x: -120, z: 0 });
    for (let t = 0; t < 70; t += 0.1) {
      stepBattle(b, 0.1, null, { solids, reach: 600 });
      for (const s of solids.all) expect(Math.abs(a.x - s.x) < 1.3 && Math.abs(a.z - s.z) < 1.3, `through the wall at ${t.toFixed(1)}s`).toBe(false);
    }
    expect(Math.hypot(a.x, a.z - 30)).toBeLessThanOrEqual(16);
  });

  it('go down after three of your shots, and you’re credited', () => {
    const b = newBattle(MAP, { n: 2, seed: 6 });
    chooseSide(b, 'attack');
    const d = up(b, 'defend')[0];
    expect(hitSoldier(b, d.id)).toBeNull();
    expect(d.hp).toBe(RULES.hp - RULES.yours);
    expect(hitSoldier(b, d.id)).toBeNull();
    const ev = hitSoldier(b, d.id);
    expect(ev).toMatchObject({ type: 'down', id: d.id, by: 'you' });
    expect(d.up).toBe(false);
    expect(b.you.kills).toBe(1);
    expect(hitSoldier(b, d.id)).toBeNull(); // (already down: nothing more)
    expect(b.you.kills).toBe(1);
  });

  it('come back at a post of theirs after a while, with the next wave, for a ticket, and stay down without one', () => {
    const b = newBattle(MAP, { n: 1, seed: 7 });
    chooseSide(b, 'attack');
    const d = up(b, 'defend')[0];
    for (let i = 0; i < 4; i++) hitSoldier(b, d.id);
    const before = b.tickets.defend;
    run(b, RULES.respawn - 0.5);
    expect(d.up).toBe(false);
    const ev = run(b, RULES.waveDefend + 1);
    expect(d.up).toBe(true);
    expect(ev.some((e) => e.type === 'spawn' && e.id === d.id)).toBe(true);
    expect(b.tickets.defend).toBe(before - 1);
    expect(['a', 'b', 'base'].some((id) => Math.hypot(d.x - post(b, id).at[0], d.z - post(b, id).at[1]) <= post(b, id).r)).toBe(true);
    b.tickets.defend = 0;
    for (let i = 0; i < 4; i++) hitSoldier(b, d.id);
    run(b, RULES.respawn + RULES.waveDefend + 2);
    expect(d.up).toBe(false);
  });

  it('come back in waves, together, and the attackers on a staging line short of their objective', () => {
    const b = newBattle(MAP, { n: 8, seed: 17 });
    chooseSide(b, 'attack');
    for (const s of b.soldiers) Object.assign(s, { frozen: true, unarmed: true });
    const attackers = up(b, 'attack');
    // four of them down at once
    run(b, 0.3);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) hitSoldier(b, attackers[i].id);
    const spawns = [];
    for (let t = 0; t < RULES.respawn + RULES.wave + 1; t += 0.1) for (const e of stepBattle(b, 0.1, null, env)) if (e.type === 'spawn') spawns.push(+b.t.toFixed(1));
    expect(spawns).toHaveLength(4);
    expect(new Set(spawns).size).toBe(1); // (one wave)
    // on the staging line: RULES.forward short of post A or B (at x = 0), not back at the line (x = −120)
    for (const s of attackers.slice(0, 4)) {
      expect(s.x).toBeGreaterThan(-120 + 20);
      const toA = Math.hypot(s.x, s.z - 30);
      const toB = Math.hypot(s.x, s.z + 30);
      expect(Math.min(toA, toB)).toBeLessThan(RULES.forward + 12);
    }
  });

  it('comes back inside the post itself when the objective is nearer than the staging line', () => {
    const b = newBattle(MAP, { n: 1, seed: 18 });
    chooseSide(b, 'attack');
    expect(forwardOf(b, post(b, 'line'), [-100, 0])).toEqual(expect.any(Array));
    const near = forwardOf(b, post(b, 'line'), [-100, 0]);
    expect(Math.hypot(near[0] + 120, near[1])).toBeLessThanOrEqual(20);
    // (an objective well past the line: the spot is RULES.forward short of it, on the way from the post)
    const far = forwardOf(b, post(b, 'line'), [120, 0]);
    expect(far[0]).toBeCloseTo(-120 + (240 - RULES.forward), 0);
  });

  it('shoot at an enemy in range, and at most three of them at you', () => {
    const b = newBattle(MAP, { n: 6, seed: 8 });
    chooseSide(b, 'attack');
    b.you.up = true;
    for (const s of b.soldiers) Object.assign(s, { frozen: true });
    // every defender within range of you, every attacker far away
    for (const s of up(b, 'defend')) Object.assign(s, { x: 20, z: 30 });
    for (const s of up(b, 'attack')) Object.assign(s, { x: -400, z: 0 });
    // (they take turns: never more than three in any one step, and no more
    // fire than three soldiers could put out)
    let most = 0;
    let shots = 0;
    for (let i = 0; i < 30; i++) {
      const ev = run(b, 0.1, { x: 0, z: 30 });
      const atYou = ev.filter((e) => e.type === 'shot' && e.atYou);
      shots += atYou.length;
      most = Math.max(most, new Set(atYou.map((e) => e.id)).size);
      for (const e of atYou) expect(e.side).toBe('defend');
    }
    expect(shots).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(RULES.atYouMax);
    expect(shots).toBeLessThanOrEqual(Math.ceil((RULES.atYouMax * 3) / (RULES.every * 0.7)) + 1);
  });

  it('shoot each other: a hit does damage, and a kill is told', () => {
    const b = newBattle(MAP, { n: 4, seed: 9 });
    chooseSide(b, 'attack');
    for (const s of b.soldiers) Object.assign(s, { frozen: true, x: s.side === 'attack' ? -10 : 10, z: 30 });
    const ev = run(b, 30);
    const shots = ev.filter((e) => e.type === 'shot' && !e.atYou);
    expect(shots.length).toBeGreaterThan(10);
    expect(shots.some((e) => e.hit)).toBe(true);
    expect(ev.some((e) => e.type === 'down' && e.by !== 'you')).toBe(true);
    expect(ev.some((e) => e.type === 'kill')).toBe(true);
  });
});

describe('fire, nerve and cover', () => {
  it('suppresses whoever a bolt is fired at, and the nerve comes back', () => {
    const b = newBattle(MAP, { n: 1, seed: 13 });
    chooseSide(b, 'attack');
    for (const s of b.soldiers) Object.assign(s, { frozen: true, x: s.side === 'attack' ? -10 : 10, z: 30 });
    const d = up(b, 'defend')[0];
    run(b, 4);
    expect(d.suppress).toBeGreaterThan(0);
    for (const s of b.soldiers) s.unarmed = true;
    run(b, 1 / RULES.suppressFade + 1);
    expect(d.suppress).toBe(0);
  });

  it('shoots worse with its head down', () => {
    const shots = (suppress) => {
      const b = newBattle(MAP, { n: 1, seed: 14 });
      chooseSide(b, 'attack');
      for (const s of b.soldiers) Object.assign(s, { frozen: true, x: s.side === 'attack' ? -5 : 5, z: 30 });
      const a = up(b, 'attack')[0];
      const d = up(b, 'defend')[0];
      d.unarmed = true;
      let hits = 0;
      let fired = 0;
      for (let t = 0; t < 200; t += 0.1) {
        a.suppress = suppress;
        d.hp = RULES.hp;
        for (const e of stepBattle(b, 0.1, null, env))
          if (e.type === 'shot') {
            fired++;
            if (e.hit) hits++;
          }
      }
      return hits / fired;
    };
    expect(shots(1)).toBeLessThan(shots(0) * 0.75);
  });

  it('finds cover on the far side of the nearest rock from the shooter, and nothing too small or too big', () => {
    const solids = createSolids();
    solids.circle(10, 0, 1); // a rock, between them and off to the side
    solids.circle(-3, 0, 0.2); // a stone: no cover
    solids.box(0, 20, 30, 30); // a hall: too big to get round
    const me = { x: 0, z: 0 };
    const c = coverFrom(solids, me, 40, 0);
    expect(c).toBeTruthy();
    // (behind the rock, on the side away from the shooter at +x: so at x < 10)
    expect(c[0]).toBeCloseTo(10 - 1.9, 5);
    expect(c[1]).toBeCloseTo(0, 5);
    expect(coverFrom(createSolids(), me, 40, 0)).toBeNull();
  });

  it('takes cover under fire, and a bolt finds it there less often', () => {
    const solids = createSolids();
    solids.circle(14, 30, 1.2); // a rock by the defender, between it and the attackers
    const b = newBattle(MAP, { n: 1, seed: 15 });
    chooseSide(b, 'attack');
    const a = up(b, 'attack')[0];
    const d = up(b, 'defend')[0];
    Object.assign(a, { frozen: true, x: 30, z: 30 });
    Object.assign(d, { x: 10, z: 30, spot: [10, 30], post: 'a', wait: 99, unarmed: true });
    let took = null;
    for (let t = 0; t < 30 && !took; t += 0.1) {
      stepBattle(b, 0.1, null, { solids, reach: 600 });
      d.hp = RULES.hp;
      if (d.inCover) took = t;
    }
    expect(took).not.toBeNull();
    // (behind the rock: on the far side from the attacker at +x)
    expect(d.x).toBeLessThan(14);
    // (its cover point is a step out from the rock, and it stops a pace short of that)
    expect(Math.hypot(d.x - 14, d.z - 30)).toBeLessThan(1.2 + 0.9 + 1.6);
    // and hits land at half the rate on a soldier in cover
    const rate = (inCover) => {
      let hits = 0;
      let fired = 0;
      for (let t = 0; t < 150; t += 0.1) {
        d.inCover = inCover;
        d.cover = inCover ? [d.x, d.z] : null;
        d.coverAt = b.t;
        d.hp = RULES.hp;
        for (const e of stepBattle(b, 0.1, null, { solids, reach: 600 }))
          if (e.type === 'shot') {
            fired++;
            if (e.hit) hits++;
          }
      }
      return hits / fired;
    };
    a.suppress = 0;
    const open = rate(false);
    a.suppress = 0;
    const covered = rate(true);
    expect(covered).toBeLessThan(open * 0.75);
  });

  it('moves at a crouch with its head down', () => {
    const b = newBattle(MAP, { n: 1, seed: 16 });
    chooseSide(b, 'defend');
    for (const s of up(b, 'defend')) Object.assign(s, { x: 500, z: 0, frozen: true, unarmed: true });
    const a = up(b, 'attack')[0];
    a.target = null;
    const walk = (suppress) => {
      Object.assign(a, { x: -120, z: 0, suppress, cover: null });
      run(b, 2);
      return Math.hypot(a.x + 120, a.z);
    };
    const upright = walk(0);
    const crouched = walk(1);
    expect(crouched).toBeLessThan(upright * 0.7);
  });
});

describe('the phases, the tickets and the end', () => {
  it('moves on when the attackers hold every post of the phase, topping their tickets up', () => {
    const b = empty('attack');
    b.tickets.attack = 20;
    post(b, 'a').owner = 'attack';
    post(b, 'b').owner = null;
    post(b, 'b').meter = 0.99;
    post(b, 'b').taking = 'attack';
    b.you.up = true;
    const ev = run(b, 0.5, { x: 0, z: -30 });
    expect(post(b, 'b').owner).toBe('attack');
    expect(ev.some((e) => e.type === 'phase' && e.phase === 1 && e.name === 'The last stand')).toBe(true);
    expect(b.phaseIndex).toBe(1);
    expect(b.tickets.attack).toBe(50);
    // the last phase's post is live now, the first phase's are not
    const v = battleView(b);
    expect(v.posts.find((p) => p.id === 'c').live).toBe(true);
    expect(v.posts.find((p) => p.id === 'a').live).toBe(false);
  });

  it('is won by the attackers when the last phase falls', () => {
    const b = empty('attack');
    b.phaseIndex = 1;
    post(b, 'c').owner = null;
    post(b, 'c').meter = 0.99;
    post(b, 'c').taking = 'attack';
    b.you.up = true;
    const ev = run(b, 0.5, { x: 120, z: 0 });
    expect(b.result).toMatchObject({ won: true, why: 'posts' });
    expect(ev.some((e) => e.type === 'end' && e.won === true)).toBe(true);
    expect(b.result.stars).toBe(3);
    // (and it holds there)
    run(b, 5, { x: 120, z: 0 });
    expect(b.t).toBeLessThan(2);
  });

  it('is lost by a side with no tickets and nobody up, unless you’re up on it', () => {
    const b = newBattle(MAP, { n: 2, seed: 10 });
    chooseSide(b, 'attack');
    b.tickets.attack = 0;
    b.you.up = true;
    for (const s of up(b, 'attack')) {
      s.up = false;
      s.down = 0;
    }
    run(b, RULES.respawn + 1, { x: -120, z: 0 });
    expect(b.result).toBeNull();
    youDown(b);
    const ev = run(b, 0.2, null);
    expect(b.result).toMatchObject({ won: false, why: 'tickets' });
    expect(ev.some((e) => e.type === 'end' && e.won === false)).toBe(true);
  });

  it('is won by the defenders when the attackers run dry', () => {
    const b = newBattle(MAP, { n: 2, seed: 11 });
    chooseSide(b, 'defend');
    b.tickets.attack = 0;
    for (const s of up(b, 'attack')) {
      s.up = false;
      s.down = 0;
    }
    run(b, RULES.respawn + 1, null);
    expect(b.result).toMatchObject({ won: true, why: 'tickets' });
  });

  it('takes a long frame in short steps', () => {
    const b = empty('attack');
    b.you.up = true;
    stepBattle(b, 1, { x: 0, z: 30 }, env);
    expect(post(b, 'a').meter).toBeCloseTo(1 - RULES.capture, 5);
    expect(b.t).toBeCloseTo(1, 5);
  });

  it('ends by hand, for the dev hooks', () => {
    const b = empty('defend');
    endBattle(b, false, 'posts');
    expect(b.result).toMatchObject({ won: false, why: 'posts' });
    expect(battleView(b).phase).toBe('end');
  });
});

describe('you', () => {
  it('can deploy at a post your side holds, for a ticket, and nowhere else', () => {
    const b = newBattle(MAP, { n: 0, seed: 12 });
    chooseSide(b, 'attack');
    expect(canDeploy(b, post(b, 'a'))).toBe(false);
    expect(deploy(b, 'a')).toBeNull();
    expect(b.tickets.attack).toBe(60);
    const at = deploy(b, 'line');
    expect(at).toBeTruthy();
    expect(Math.hypot(at.x + 120, at.z)).toBeLessThanOrEqual(20);
    expect(typeof at.yaw).toBe('number');
    expect(b.you.up).toBe(true);
    expect(b.tickets.attack).toBe(59);
    // a contested post of yours: not while the enemy's in it
    post(b, 'a').owner = 'attack';
    post(b, 'a').inside = { attack: 0, defend: 2 };
    expect(canDeploy(b, post(b, 'a'))).toBe(false);
    post(b, 'a').inside = { attack: 0, defend: 0 };
    expect(canDeploy(b, post(b, 'a'))).toBe(true);
  });

  it('are pointed at your side’s objective', () => {
    const b = empty('attack');
    expect(objectiveFor(b, 'attack', -120, 0)).toEqual([0, 30]);
    expect(objectiveFor(b, 'defend', 0, 30)).toEqual([0, 30]);
    post(b, 'a').owner = 'attack';
    expect(objectiveFor(b, 'attack', -120, 0)).toEqual([0, -30]);
  });

  it('see the battle as the HUD does: every post lettered, a key that changes with it', () => {
    const b = empty('attack');
    const v = battleView(b);
    expect(v.phase).toBe('run');
    expect(v.phaseName).toBe('The front');
    expect(v.phaseCount).toBe(2);
    expect(v.posts.map((p) => p.letter)).toEqual(['', 'A', 'B', 'C', '']);
    expect(v.tickets).toEqual({ attack: 60, defend: 90 });
    expect(v.you).toMatchObject({ side: 'attack', up: false, kills: 0, captures: 0, in: null });
    const k = v.key;
    post(b, 'a').owner = null;
    expect(battleView(b).key).not.toBe(k);
    b.you.up = true;
    run(b, 0.1, { x: 0, z: 30 });
    expect(battleView(b).you.in).toBe('a');
    expect(battleView(b).you.state).toBe('taking');
  });
});

describe('your Battle Points', () => {
  // (the spawn screen's offers on the test map, for so many points)
  const offer = (b, id) => offersFor({ mission: MAP, side: b.you.side, points: b.you.points }).find((o) => o.id === id);

  it('start at none in a new battle, and a kill of yours earns the game’s hundred', () => {
    const b = newBattle(MAP, { n: 2, seed: 6 });
    expect(b.you.points).toBe(0);
    chooseSide(b, 'attack');
    const d = up(b, 'defend')[0];
    for (let i = 0; i < 3; i++) hitSoldier(b, d.id);
    expect(b.you.kills).toBe(1);
    expect(b.you.points).toBe(EARN.kill);
    // (another's kill earns you nothing)
    const a = up(b, 'attack')[0];
    const d2 = up(b, 'defend')[0];
    for (let i = 0; i < 5; i++) hitSoldier(b, d2.id, RULES.damage, a);
    expect(b.you.points).toBe(EARN.kill);
    expect(newBattle(MAP).you.points).toBe(0);
  });

  it('a post taken with you in it pays its capture, and every second you take it a tick', () => {
    const b = empty('attack');
    b.you.up = true;
    const T = 1 / RULES.capture;
    run(b, 2 * T + 1, { x: 0, z: 30 }); // inside post A, alone: draining it, then taking it
    expect(post(b, 'a').owner).toBe('attack');
    expect(b.you.captures).toBe(1);
    // (2T seconds of ticks before it fell, give or take a step; none once it's quietly yours)
    expect(b.you.points).toBeGreaterThan(EARN.capture + EARN.objectiveTick * (2 * T - 1));
    expect(b.you.points).toBeLessThan(EARN.capture + EARN.objectiveTick * (2 * T + 0.5));
    const was = b.you.points;
    run(b, 3, { x: 0, z: 30 });
    expect(b.you.points).toBe(was);
    expect(battleView(b).you.points).toBe(Math.floor(was + 1e-6));
  });

  it('pays the tick while you hold a post of yours with the enemy inside, and nothing outside a post', () => {
    const b = empty('defend');
    b.you.up = true;
    b.soldiers.push({ id: 99, side: 'attack', kind: 'snowtrooper', x: 0, z: 30, yaw: 0, hp: 100, up: true, down: 0, post: 'a', cool: 1, wait: 0, frozen: true, unarmed: true });
    run(b, 2, { x: 0, z: 30 });
    expect(b.you.points).toBeCloseTo(EARN.objectiveTick * 2, 5);
    run(b, 2, { x: 60, z: 0 });
    expect(b.you.points).toBeCloseTo(EARN.objectiveTick * 2, 5);
  });

  it('deploying as a class costs nothing; as a hero it spends their price, and you’re them until you go down', () => {
    const b = empty('attack');
    expect(deploy(b, 'line', offer(b, 'trooper-empire-heavy'))).toBeTruthy();
    expect(b.you.as).toBe('trooper-empire-heavy');
    expect(battleView(b).you.as).toBe('trooper-empire-heavy');
    youDown(b);
    expect(b.you.as).toBeNull();
    b.you.points = 4100;
    const vader = offer(b, 'vader');
    expect(vader).toMatchObject({ kind: 'hero', cost: 4000, affordable: true });
    expect(deploy(b, 'line', vader)).toBeTruthy();
    expect(b.you.points).toBe(100);
    expect(b.you.as).toBe('vader');
    expect(b.tickets.attack).toBe(58);
    youDown(b);
    expect(b.you.as).toBeNull();
    // (kept through the death)
    expect(b.you.points).toBe(100);
  });

  it('can’t deploy as a hero you can’t afford: nothing spent, not even the ticket', () => {
    const b = empty('attack');
    b.you.points = 3999;
    const vader = { ...offer(b, 'vader'), affordable: true }; // (whatever the screen thought)
    expect(deploy(b, 'line', vader)).toBeNull();
    expect(b.you.points).toBe(3999);
    expect(b.tickets.attack).toBe(60);
    expect(b.you.up).toBe(false);
  });

  it('are whole in the HUD’s view, and the key doesn’t change as they tick', () => {
    const b = empty('attack');
    b.you.points = 12.7;
    const v = battleView(b);
    expect(v.you.points).toBe(12);
    b.you.points = 950.2;
    expect(battleView(b).key).toBe(v.key);
  });
});

describe('a whole battle, with nobody playing', () => {
  const sim = (tickets, n, seed) => {
    const b = newBattle({ ...MAP, tickets }, { n, seed });
    chooseSide(b, 'attack');
    for (let t = 0; t < 900 && !b.result; t += 0.1) stepBattle(b, 0.1, null, env);
    return b;
  };
  it('is won by the attackers with the reinforcements on their side', () => {
    const b = sim({ attack: 400, defend: 12 }, 6, 21);
    expect(b.result?.won).toBe(true);
  });
  it('is won by the defenders when the attackers run out', () => {
    const b = sim({ attack: 8, defend: 400 }, 6, 22);
    expect(b.result?.won).toBe(false);
  });
});

describe('the squads', () => {
  const squadsOf = (b, side) => Object.values(b.tactics[side]);
  const soldiersOf = (b, side) => b.soldiers.filter((s) => s.side === side && s.up);

  it('a losing squad falls back in halves while the rest hold and cover', () => {
    const b = newBattle(MAP, { n: 8, seed: 3 });
    chooseSide(b, 'attack');
    run(b, 12, null);
    // the defenders take losses: half of them down, the rest hurt
    const def = soldiersOf(b, 'defend');
    for (const s of def.slice(0, 4)) hitSoldier(b, s.id, 999, 'you');
    for (const s of soldiersOf(b, 'defend')) s.hp = 30;
    const events = run(b, TACTICS.every * 2.5, null);
    const retreating = squadsOf(b, 'defend').filter((q) => q.posture === 'retreat');
    expect(retreating.length).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'posture' && e.side === 'defend' && e.posture === 'retreat')).toBe(true);
    const q = retreating[0];
    const members = q.members.map((id) => b.soldiers.find((s) => s.id === id));
    const going = members.filter((s) => s.fallback);
    const holding = members.filter((s) => s.hold);
    expect(going.length).toBeGreaterThan(0);
    if (members.length > 1) expect(holding.length).toBeGreaterThan(0);
    // the ones going go back, away from the enemy
    for (const s of going) expect((s.fallback[0] - s.x) * q.front.dir.x + (s.fallback[1] - s.z) * q.front.dir.z).toBeLessThan(0);
  });

  it('a winning squad presses, and the soldiers at its lane ends go round the flank', () => {
    const b = newBattle(MAP, { n: 8, seed: 3 });
    chooseSide(b, 'defend');
    run(b, 34, null); // (the attackers have come up to the posts)
    // the attackers have the defenders on the ropes
    for (const s of soldiersOf(b, 'defend').slice(0, 5)) hitSoldier(b, s.id, 999, 'you');
    for (const s of soldiersOf(b, 'defend')) s.hp = 30;
    run(b, TACTICS.every * 2.5, null);
    const pressing = squadsOf(b, 'attack').filter((q) => q.posture === 'press' && q.members.length >= 2);
    expect(pressing.length).toBeGreaterThan(0);
    const flanking = soldiersOf(b, 'attack').filter((s) => s.flankTo);
    expect(flanking.length).toBeGreaterThan(0);
    for (const s of flanking) expect(s.hold).toBe(false);
  });

  it('a holding squad of the defenders keeps behind its frontline’s buffer', () => {
    const b = newBattle(MAP, { n: 6, seed: 5 });
    chooseSide(b, 'attack');
    run(b, 2, null);
    // the attackers stood frozen 20 m short of post A's defenders, both sides tough: the defenders hold
    for (const s of soldiersOf(b, 'attack')) Object.assign(s, { x: -24, z: 30 + (s.id % 3) * 3, frozen: true, hp: 1000 });
    for (const s of soldiersOf(b, 'defend')) Object.assign(s, { x: 0, z: 30 + (s.id % 3) * 3, hp: 1000 });
    let crossings = 0;
    let checks = 0;
    for (let i = 0; i < 30; i++) {
      run(b, 0.5, null);
      for (const q of squadsOf(b, 'defend')) {
        if (q.posture !== 'hold' || !q.front) continue;
        for (const id of q.members) {
          const s = b.soldiers.find((o) => o.id === id);
          if (!s?.up || s.flankTo) continue;
          checks += 1;
          if ((s.x - q.front.line.x) * q.front.dir.x + (s.z - q.front.line.z) * q.front.dir.z > RULES.walk * RULES.step + 0.5) crossings += 1;
        }
      }
    }
    expect(checks).toBeGreaterThan(0);
    expect(crossings).toBe(0);
    // (and the line itself is the buffer short of the nearest attacker)
    const q = squadsOf(b, 'defend').find((x) => x.front);
    expect(q.front.line.x).toBeGreaterThan(-24 + TACTICS.buffer - 0.5);
  });

  it('at most three fire at you at once, taking turns', () => {
    const b = newBattle(MAP, { n: 10, seed: 2 });
    chooseSide(b, 'attack');
    run(b, 5, null);
    const you = { x: 60, z: 0 };
    deploy(b, 'line');
    for (const s of soldiersOf(b, 'defend')) {
      s.x = 70 + (s.id % 5) * 3;
      s.z = (s.id % 3) * 3;
      s.frozen = true;
    }
    const who = new Set();
    for (let i = 0; i < 60; i++) {
      const out = run(b, 0.1, you);
      const shooters = new Set(out.filter((e) => e.type === 'shot' && e.atYou).map((e) => e.id));
      expect(b.tokens.count('shot')).toBeLessThanOrEqual(RULES.atYouMax);
      for (const id of shooters) who.add(id);
    }
    expect(who.size).toBeGreaterThan(RULES.atYouMax);
  });
});

describe('the battle on the ground, in the galaxy’s war', () => {
  it('the result counts each post once for the side that took it while you were up', () => {
    const b = empty('attack');
    b.you.up = true;
    const you = { x: 0, z: 30 }; // inside post A
    const T = 1 / RULES.capture;
    run(b, 2 * T + 1, you);
    expect(post(b, 'a').owner).toBe('attack');
    // taken back and forth again: still the one post
    post(b, 'a').owner = 'defend';
    post(b, 'a').meter = 1;
    run(b, 2 * T + 1, you);
    expect(post(b, 'a').owner).toBe('attack');
    endBattle(b, true, 'forced');
    expect(b.result.posts).toEqual({ attack: 1, defend: 0 });
  });
  it('a post taken while you were down isn’t yours to count', () => {
    const b = newBattle(MAP, { n: 1, seed: 3 });
    chooseSide(b, 'attack');
    const T = 1 / RULES.capture;
    const s = b.soldiers.find((o) => o.side === 'attack');
    for (const o of b.soldiers) if (o !== s) (o.up = false), (o.down = 1e9);
    s.up = true;
    // (held there: told to stand in post B)
    for (let t = 0; t < 2 * T + 1; t += 0.1) {
      s.x = 0;
      s.z = -30;
      stepBattle(b, 0.1, null, env);
    }
    expect(post(b, 'b').owner).toBe('attack');
    endBattle(b, true, 'forced');
    expect(b.result.posts).toEqual({ attack: 0, defend: 0 });
  });
  it('sideFor maps the war’s side to the map’s, and warSideOf back', () => {
    expect(sideFor(MAP, 'empire')).toBe('attack');
    expect(sideFor(MAP, 'rebel')).toBe('defend');
    expect(sideFor(MAP, 'republic')).toBeNull();
    expect(sideFor(MAP, null)).toBeNull();
    expect(warSideOf(MAP, 'defend')).toBe('rebel');
    expect(warSideOf(MAP, 'attack')).toBe('empire');
    expect(warSideOf(MAP, null)).toBeNull();
  });
});

describe('the three worlds’ battles', () => {
  it('every assault’s posts are on its site within reach, its start too, and its phases name its posts', () => {
    for (const [id, m] of Object.entries(ASSAULTS)) {
      const site = siteOf(id);
      expect(site, id).toBeTruthy();
      for (const p of m.posts) expect(Math.hypot(...p.at), `${id} ${p.id}`).toBeLessThan(REACH);
      expect(Math.hypot(...m.start), `${id} start`).toBeLessThan(REACH);
      const ids = new Set(m.posts.map((p) => p.id));
      for (const ph of m.phases) for (const pid of ph.posts) expect(ids.has(pid), `${id} ${pid}`).toBe(true);
      expect(m.posts.some((p) => p.fixed === 'attack')).toBe(true);
      expect(m.posts.some((p) => p.fixed === 'defend')).toBe(true);
    }
  });
  it('sidesFor gives the theatre’s two sides, the dark side attacking unless said', () => {
    expect(sidesFor('clone').attack.id).toBe('separatists');
    expect(sidesFor('clone').defend.id).toBe('republic');
    expect(sidesFor('gcw').attack.id).toBe('empire');
    expect(sidesFor('gcw', { attack: 'light' }).attack.id).toBe('rebels');
    expect(sidesFor('remnant').defend.id).toBe('newrepublic');
    expect(sidesFor('nope').attack.id).toBe('empire');
    expect(ASSAULTS.coruscant.sides.attack.id).toBe('separatists');
    expect(ASSAULTS.bespin.sides.attack.id).toBe('rebels');
  });
  it('every attackers’ fixed post is clear of the first objectives, with a staging line between', () => {
    for (const [id, m] of Object.entries(ASSAULTS)) {
      const fixed = m.posts.find((p) => p.fixed === 'attack');
      for (const obj of m.posts.filter((p) => m.phases[0].posts.includes(p.id))) {
        const d = Math.hypot(fixed.at[0] - obj.at[0], fixed.at[1] - obj.at[1]);
        expect(d, `${id} ${obj.id}`).toBeGreaterThan(fixed.r + obj.r);
        if (m.forward != null) expect(d, `${id} ${obj.id} forward`).toBeGreaterThan(m.forward + fixed.r);
      }
    }
  });
  it('soldiers don’t walk into water too deep to wade, when the world has some', () => {
    const b = newBattle(ASSAULTS.kashyyyk, { n: 6, seed: 3 });
    chooseSide(b, 'defend');
    // (the droids start in the shallows at z 105 and march for z 52: a deep band across z < 70 holds them back;
    // z in the site's own frame, before it turns to the game's map: turnSite.js)
    const env2 = { solids: createSolids(), reach: 600, deep: (x, z) => U([x, z])[1] < 70 };
    for (let t = 0; t < 60; t += 0.1) stepBattle(b, 0.1, null, env2);
    const past = b.soldiers.filter((s) => s.up && s.side === 'attack' && U([s.x, s.z])[1] < 69);
    expect(past.length).toBe(0);
    // (and without the band they do go through: in one of a few battles,
    // since which side a seed's fight goes depends on where its spawns fall)
    const through = [3, 4, 5, 6, 7].some((seed) => {
      const c = newBattle(ASSAULTS.kashyyyk, { n: 6, seed });
      chooseSide(c, 'defend');
      for (let t = 0; t < 60; t += 0.1) stepBattle(c, 0.1, null, env);
      return c.soldiers.some((s) => s.up && s.side === 'attack' && U([s.x, s.z])[1] < 69);
    });
    expect(through).toBe(true);
  });
  it('Kashyyyk: the droids come for the beach, the gun line and Kachirho', () => {
    const m = ASSAULTS.kashyyyk;
    expect(m.sides.attack.id).toBe('separatists');
    expect(m.sides.defend.kinds.map(([k]) => k)).toEqual(expect.arrayContaining(['clone', 'wookiee']));
    expect(m.phases.map((p) => p.posts.length).every((n) => n > 0)).toBe(true);
    const b = newBattle(m, { n: 6, seed: 3 });
    expect(b.posts.find((p) => p.fixed === 'attack')).toBeTruthy();
  });
});

describe('the soldiers’ bodies: what the drawing reads (soldierBody, BATTLE_BODY)', () => {
  it('reads a soldier’s mode from what the rules have it doing, and aims at its target', () => {
    const b = newBattle(MAP, { n: 2, seed: 3 });
    chooseSide(b, 'attack');
    const [a] = up(b, 'attack');
    const [d] = up(b, 'defend');
    Object.assign(a, { x: -10, z: 30, target: d.id, suppress: 0, inCover: false, fallback: null, hold: false, flankTo: null });
    Object.assign(d, { x: 10, z: 30 });
    expect(soldierBody(b, a)).toMatchObject({ x: -10, z: 30, mode: 'fight', aim: { x: 10, z: 30 } });
    a.target = 'you';
    Object.assign(b.you, { x: 3, z: 4 });
    expect(soldierBody(b, a).aim).toEqual({ x: 3, z: 4 });
    a.target = null;
    expect(soldierBody(b, a)).toMatchObject({ mode: 'advance', aim: null });
    a.flankTo = [0, 0];
    expect(soldierBody(b, a).mode).toBe('flank');
    a.hold = true;
    expect(soldierBody(b, a).mode).toBe('covering');
    a.fallback = [-30, 30];
    expect(soldierBody(b, a).mode).toBe('retreat');
    a.suppress = 1;
    expect(soldierBody(b, a).mode).toBe('pinned');
    a.inCover = true;
    expect(soldierBody(b, a).mode).toBe('cover');
    a.up = false;
    expect(soldierBody(b, a)).toMatchObject({ mode: 'down', down: 1 });
  });

  it('comes up to fire a moment before its shot, and only with a target and a gun', () => {
    const b = newBattle(MAP, { n: 1, seed: 3 });
    chooseSide(b, 'attack');
    const [a] = up(b, 'attack');
    const [d] = up(b, 'defend');
    Object.assign(a, { target: d.id, cool: 1 });
    expect(soldierBody(b, a).fire).toBe(false);
    a.cool = 0.1;
    expect(soldierBody(b, a).fire).toBe(true);
    a.unarmed = true;
    expect(soldierBody(b, a).fire).toBe(false);
    a.unarmed = false;
    a.target = null;
    expect(soldierBody(b, a).fire).toBe(false);
  });

  it('reads, never changes: a battle with its bodies read every step goes exactly as one without', () => {
    const play = (read) => {
      const b = newBattle(MAP, { n: 6, seed: 4 });
      chooseSide(b, 'attack');
      const out = [];
      for (let i = 0; i < 400; i++) {
        out.push(...stepBattle(b, 0.1, { x: -20, z: 30 }, env).map((e) => e.type));
        if (read) for (const s of b.soldiers) soldierBody(b, s);
      }
      return { out, at: b.soldiers.map((s) => [s.x, s.z, s.hp, s.up, s.yaw]), tickets: b.tickets, posts: b.posts.map((p) => [p.owner, p.meter]) };
    };
    expect(play(true)).toEqual(play(false));
  });

  it('tells where a killing shot came from (a soldier’s place, or yours), and whom a soldier’s shot was at', () => {
    const b = newBattle(MAP, { n: 4, seed: 9 });
    chooseSide(b, 'attack');
    for (const s of b.soldiers) Object.assign(s, { frozen: true, x: s.side === 'attack' ? -10 : 10, z: 30 + (s.id % 4) * 2 });
    let downs = 0;
    let shots = 0;
    // (each step's events against where everyone is after it: the frozen don't move, the ones coming back are placed before they're shot at)
    for (let i = 0; i < 300; i++)
      for (const e of stepBattle(b, 0.1, null, env)) {
        if (e.type === 'down') {
          downs++;
          const by = b.soldiers.find((s) => s.id === e.by);
          expect(e.from).toEqual([by.x, by.z]);
        } else if (e.type === 'shot' && !e.atYou) {
          shots++;
          const at = b.soldiers.find((s) => s.id === e.target);
          expect(at.side).not.toBe(e.side);
          expect(e.to).toEqual([at.x, at.z]);
        }
      }
    expect(downs).toBeGreaterThan(0);
    expect(shots).toBeGreaterThan(0);
    Object.assign(b.you, { x: 50, z: -7 });
    const d = b.soldiers.find((s) => s.side === 'defend' && s.up);
    expect(hitSoldier(b, d.id, 999)).toMatchObject({ type: 'down', by: 'you', from: [50, -7] });
  });

  it('looks as the battle reads: crouched in cover and up to fire, the covering half on a knee, its head on its target', () => {
    const at = { x: 0, z: 0, yaw: 0 };
    const step = (mode, extra = {}) => bodyFrom(at, { ...at, mode, aim: { x: 0, z: 20 }, ...extra }, 0.1, { table: BATTLE_BODY });
    expect(step('cover')).toMatchObject({ base: 'crouch', look: { x: 0, z: 20 } });
    expect(step('cover', { fire: true }).base).toBeNull();
    expect(step('covering').base).toBe('crouch');
    for (const mode of ['fight', 'retreat', 'flank', 'pinned']) expect(step(mode)).toMatchObject({ base: null, look: { x: 0, z: 20 } });
    expect(step('advance', { aim: null }).look).toBeNull();
    // (and every mode soldierBody gives has a row)
    for (const mode of ['down', 'cover', 'pinned', 'retreat', 'covering', 'flank', 'fight', 'advance']) expect(BATTLE_BODY[mode], mode).toBeTruthy();
  });
});

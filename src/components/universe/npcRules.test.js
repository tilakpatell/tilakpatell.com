import { describe, expect, it } from 'vitest';
import { BRAINS, NPC, createBrains, dodge } from './npcRules';
import { SENSES } from './npcs/index';
import { createTrace } from '../../lib/ai/trace';

// a seeded random, so a meeting is the same every time
const seeded = (seed = 7) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const DT = 1 / 60;
const apart = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const finite = (p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
// you, flying along your nose at `speed` (heading 0 is −z)
const you = (over = {}) => ({ x: 0, y: 0, z: 0, heading: 0, pitch: 0, speed: 0, ...over });
const fly = (s) => ({ ...s, x: s.x - Math.sin(s.heading) * s.speed * DT, z: s.z - Math.cos(s.heading) * s.speed * DT });

// a character of our own, for the engine alone (the registry's are npcs/index.js's)
const spec = (brain, over = {}) => ({ id: `test-${brain}`, side: 'breakingbad', role: 'neutral', ship: 'saulcaddy', brain, relations: { fears: [], hunts: [] }, stats: { speed: 16, accel: 14, turn: 2.4, hp: 6, fire: [0.6, 1.1], damage: 6 }, ...over });

// a meeting flown for `seconds`: each(brains, ship, out, t) looks at every frame; world(t) gives what's about
function meet(npc, { at = { x: 30, y: 0, z: 0 }, seconds = 30, ship = you(), steer = (s) => s, world = () => ({}), seed = 3, each } = {}) {
  const brains = createBrains({ rand: seeded(seed) });
  const n = brains.add(npc, at);
  let s = ship;
  const seen = { says: [], events: [], shots: [], n, brains };
  for (let t = 0; t < seconds; t += DT) {
    s = fly(steer(s, t));
    const out = brains.update(DT, { you: s, hunters: [], stations: [], ...world(t, s) });
    for (const e of out.events) {
      seen.events.push(e);
      if (e.type === 'say') seen.says.push(e.key);
      if (e.type === 'shot') seen.shots.push(e);
    }
    for (const m of brains.live) expect(finite(m.pos)).toBe(true);
    each?.(brains, s, out, t);
  }
  seen.ship = s;
  return seen;
}
const types = (seen) => seen.events.map((e) => e.type);

describe('the brains', () => {
  it('has a brain for each kind of character, and takes no character without one', () => {
    for (const b of ['wingman', 'bounty', 'merchant', 'informant', 'rival']) expect(typeof BRAINS[b], b).toBe('function');
    const brains = createBrains({ rand: seeded() });
    expect(brains.add(spec('nonsense'), { x: 0, y: 0, z: 0 })).toBeNull();
    const n = brains.add(spec('merchant'), { x: 0, y: 0, z: 0 });
    expect(brains.live.map((m) => m.n)).toEqual([n]);
    brains.remove(n);
    expect(brains.live).toHaveLength(0);
  });

  it('hands a wingman to the wing and a bounty hunter to the hunt, and flies neither itself', () => {
    const wing = meet(spec('wingman', { ship: 'birdperson' }), { seconds: 2 });
    expect(wing.events).toContainEqual(expect.objectContaining({ type: 'delegate', via: 'wing', kind: 'birdperson', n: wing.n }));
    const bounty = meet(spec('bounty', { faction: 'fett', ship: 'slave1' }), { seconds: 2 });
    expect(bounty.events).toContainEqual(expect.objectContaining({ type: 'delegate', via: 'hunt', faction: 'fett', n: bounty.n }));
    // (once only, and they stay where they were put: the wing and the hunt fly them)
    expect(types(wing).filter((t) => t === 'delegate')).toHaveLength(1);
    expect(wing.brains.live[0].pos).toEqual({ x: 30, y: 0, z: 0 });
  });

  it('says it has seen you once, the first time you come near', () => {
    const seen = meet(spec('merchant'), { at: { x: NPC.seen + 20, y: 0, z: 0 }, ship: you({ heading: -Math.PI / 2, speed: 6 }), seconds: 12 });
    expect(seen.says.filter((k) => k === 'seen')).toHaveLength(1);
  });
});

describe('the order of things', () => {
  it('says hello before its news: an offer or a tip comes after the greeting, in the same frame', () => {
    for (const [brain, news, world] of [
      ['informant', 'tip', () => ({ next: { id: 'hunt', in: 20 } })],
      ['merchant', 'offer', () => ({})],
    ]) {
      const seen = meet(spec(brain), { at: { x: 12, y: 0, z: 0 }, seconds: 20, world });
      const order = seen.events.map((e) => (e.type === 'say' ? e.key : e.type));
      expect(order.indexOf('hello'), brain).toBeGreaterThanOrEqual(0);
      expect(order.indexOf(news), brain).toBeGreaterThan(order.indexOf('hello'));
    }
  });

  it('hands a wingman to the wing even with one it hunts about, and never flies or fires it itself', () => {
    const hunter = { id: 9, at: { x: 5, y: 0, z: -10 }, faction: 'federation' };
    const seen = meet(spec('wingman', { ship: 'birdperson', relations: { fears: [], hunts: ['federation'] } }), { seconds: 3, world: () => ({ hunters: [hunter] }) });
    expect(types(seen)).toContain('delegate');
    expect(seen.shots).toHaveLength(0);
  });
});

describe('a merchant', () => {
  const stations = [
    { id: 'far', at: { x: 400, y: 0, z: 0 }, r: 4 },
    { id: 'near', at: { x: 60, y: 0, z: -20 }, r: 4 },
  ];
  it('flies to the nearest station and parks there, then offers you a part once when you come by', () => {
    let parked = null;
    const seen = meet(spec('merchant'), {
      at: { x: 20, y: 0, z: 0 },
      seconds: 40,
      // (you sit still a while, then fly over to it)
      steer: (s, t) => (t < 20 ? s : { ...s, heading: Math.atan2(-(60 - s.x), -(-20 - s.z)), speed: apart(s, { x: 60, y: 0, z: -20 }) > 8 ? 10 : 0 }),
      world: () => ({ stations }),
      each: (brains, s, out, t) => {
        if (t > 18 && t < 19) parked = { ...brains.live[0].pos };
      },
    });
    expect(apart(parked, stations[1].at)).toBeLessThan(stations[1].r + NPC.park + 1);
    const offers = seen.events.filter((e) => e.type === 'offer');
    expect(offers).toHaveLength(1);
    expect(seen.says).toContain('hello');
  });

  it('parks where it is when the nearest station is too far to fly to, and still offers when you come by', () => {
    const far = [{ id: 'far', at: { x: 900, y: 0, z: 0 }, r: 20 }];
    let start = null;
    let end = null;
    const seen = meet(spec('merchant'), {
      at: { x: 30, y: 0, z: 0 },
      seconds: 25,
      steer: (s, t) => (t < 8 ? s : { ...s, heading: -Math.PI / 2, speed: apart(s, { x: 30, y: 0, z: 0 }) > 6 ? 8 : 0 }),
      world: () => ({ stations: far }),
      each: (brains, s, out, t) => {
        const m = brains.live[0];
        if (!m) return;
        start ??= { ...m.pos };
        if (t < 8) end = { ...m.pos };
      },
    });
    expect(apart(start, end)).toBeLessThan(2);
    expect(types(seen)).toContain('offer');
  });

  it('runs from a fight, says so, and is gone once well away', () => {
    let left = false;
    const seen = meet(spec('merchant'), {
      at: { x: 10, y: 0, z: 0 },
      seconds: 30,
      world: (t) => ({ stations, hunters: t > 5 ? [{ id: 1, at: { x: 58, y: 0, z: -14 }, faction: 'empire' }] : [] }), // (a fight comes to its station)
      each: (brains) => {
        if (brains.live[0]?.leaving) left = true;
      },
    });
    expect(left).toBe(true);
    expect(seen.says).toContain('leaving');
    expect(types(seen)).toContain('gone');
    expect(seen.brains.live).toHaveLength(0);
  });
});

describe('an informant', () => {
  it('flies up to you, says hello and tells you what’s coming, then leaves', () => {
    let closest = Infinity;
    const seen = meet(spec('informant'), {
      at: { x: 80, y: 4, z: 30 },
      ship: you({ speed: 5 }),
      seconds: 50,
      world: () => ({ next: { id: 'roadblock', in: 40 } }),
      each: (brains, s) => {
        for (const m of brains.live) closest = Math.min(closest, apart(m.pos, s));
      },
    });
    expect(closest).toBeLessThan(NPC.alongside + 2);
    expect(closest).toBeGreaterThan(1); // (alongside, not into you)
    expect(seen.events).toContainEqual(expect.objectContaining({ type: 'tip', next: { id: 'roadblock', in: 40 } }));
    const say = seen.says;
    expect(say.indexOf('hello')).toBeGreaterThanOrEqual(0);
    expect(say.indexOf('leaving')).toBeGreaterThan(say.indexOf('hello'));
    expect(types(seen)).toContain('gone');
  });
});

describe('a rival', () => {
  it('dogfights you: stays in the fight, shoots at you (a cloud, not a wall), and is on the guns', () => {
    let near = 0;
    let frames = 0;
    const seen = meet(spec('rival', { role: 'enemy' }), {
      at: { x: 0, y: 0, z: 40 },
      ship: you({ speed: 8 }),
      steer: (s) => ({ ...s, heading: s.heading + 0.4 * DT }),
      seconds: 25,
      each: (brains, s, out, t) => {
        const m = brains.live[0];
        if (!m || t < 6) return;
        frames += 1;
        if (apart(m.pos, s) < 25) near += 1;
        expect(brains.targets.map((c) => c.id)).toEqual([m.id]);
      },
    });
    expect(near / frames).toBeGreaterThan(0.7);
    const atYou = seen.shots.filter((e) => e.at === 'you');
    // (circling you, it fires as its nose comes round onto you: NPC.cone,
    // backlog 41; before the cone it fired 26 times here, from anywhere)
    expect(atYou.length).toBeGreaterThan(5);
    const hits = atYou.filter((e) => e.hit).length;
    expect(hits).toBeGreaterThan(0);
    expect(hits / atYou.length).toBeLessThan(0.5);
  });

  it('calls it a draw once you have hurt it enough, and goes without another shot', () => {
    let hurtAt = null;
    let shotsAfter = 0;
    const seen = meet(spec('rival', { role: 'enemy' }), {
      at: { x: 0, y: 0, z: 30 },
      ship: you({ speed: 6 }),
      seconds: 30,
      each: (brains, s, out, t) => {
        const m = brains.live[0];
        if (m && hurtAt === null && t > 5) {
          hurtAt = t;
          expect(brains.hit(m.id, 1)).toMatchObject({ down: false });
          expect(brains.hit(m.id, 2)).toMatchObject({ down: false });
        }
        if (hurtAt !== null && t > hurtAt + 0.1) shotsAfter += out.events.filter((e) => e.type === 'shot').length;
      },
    });
    expect(seen.says).toContain('hit');
    expect(types(seen)).toContain('draw');
    expect(seen.says).toContain('leaving');
    expect(shotsAfter).toBe(0);
    expect(seen.brains.targets).toHaveLength(0);
  });

  it('goes down to a hit that takes the last of it', () => {
    const brains = createBrains({ rand: seeded() });
    brains.add(spec('rival', { role: 'enemy', stats: { ...spec('rival').stats, hp: 2 } }), { x: 0, y: 0, z: 20 });
    brains.update(DT, { you: you(), hunters: [], stations: [] });
    const [m] = brains.live;
    expect(brains.hit(m.id, 5)).toMatchObject({ down: true, kind: 'saulcaddy' });
    expect(brains.update(DT, { you: you(), hunters: [], stations: [] }).events).toContainEqual(expect.objectContaining({ type: 'downed' }));
    expect(brains.live).toHaveLength(0);
    expect(brains.hit(m.id, 1)).toBeNull();
  });
});

describe('relations', () => {
  it('has one that fears a faction leave when that faction turns up near it, and not for anyone else', () => {
    const fearful = spec('informant', { relations: { fears: ['dea'], hunts: [] } });
    const go = (faction) =>
      meet(fearful, {
        at: { x: 20, y: 0, z: 0 },
        seconds: 4,
        world: (t) => ({ hunters: t > 1 ? [{ id: 7, at: { x: 25, y: 0, z: 0 }, faction }] : [] }),
      });
    const scared = go('dea');
    expect(scared.events).toContainEqual(expect.objectContaining({ type: 'fled', faction: 'dea' }));
    expect(scared.brains.live[0]?.leaving ?? true).toBe(true);
    const calm = go('cartel');
    expect(types(calm)).not.toContain('fled');
    expect(calm.brains.live[0].leaving).toBe(false);
  });

  it('has one that hunts a faction go after one near you and shoot at it, not at you', () => {
    const hunter = { id: 42, at: { x: 10, y: 0, z: -20 }, faction: 'federation' };
    let closest = Infinity;
    const seen = meet(spec('informant', { relations: { fears: [], hunts: ['federation'] } }), {
      at: { x: 40, y: 0, z: 10 },
      seconds: 20,
      world: () => ({ hunters: [hunter] }),
      each: (brains) => {
        const m = brains.live[0];
        if (m) closest = Math.min(closest, apart(m.pos, hunter.at));
      },
    });
    expect(closest).toBeLessThan(15);
    expect(seen.shots.length).toBeGreaterThan(3);
    expect(seen.shots.every((e) => e.at === 42)).toBe(true);
  });
});

describe('being careful', () => {
  it('keeps every one of them out of anything solid, however it flies', () => {
    const solids = [{ at: [40, 0, -10], r: 12 }];
    for (const brain of ['merchant', 'informant', 'rival']) {
      meet(spec(brain, { role: brain === 'rival' ? 'enemy' : 'neutral' }), {
        at: { x: 70, y: 0, z: -10 },
        ship: you({ speed: 7 }),
        steer: (s) => ({ ...s, heading: s.heading + 0.3 * DT }),
        seconds: 30,
        world: () => ({ solids, stations: [{ id: 'st', at: { x: 40, y: 0, z: -10 }, r: 12 }] }),
        each: (brains) => {
          for (const m of brains.live) expect(Math.hypot(m.pos.x - 40, m.pos.y, m.pos.z + 10), brain).toBeGreaterThan(12);
        },
      });
    }
  });

  it('lets go of one you have left far behind', () => {
    const seen = meet(spec('merchant'), { at: { x: 0, y: 0, z: 0 }, ship: you({ speed: 40 }), seconds: NPC.forget + 12 });
    expect(types(seen)).toContain('gone');
    expect(seen.brains.live).toHaveLength(0);
  });
});

// the newer brains: the law pulling you over, a nemesis who remembers, a
// friend who tags along, a pirate with a toll to collect; and the memory
// every character keeps of you
describe('an inspector', () => {
  const law = (over = {}) => spec('inspector', { ship: 'suvace', faction: 'dea', stats: { speed: 20, accel: 16, turn: 2.6, hp: 6, fire: [0.5, 0.9], damage: 6 }, ...over });

  it('comes in off your wing, tells you to stop, scans you when you do, and lets a clean ship go', () => {
    const seen = meet(law(), { at: { x: 0, y: 0, z: -40 }, seconds: 30, world: () => ({ heat: 0 }) });
    expect(seen.says).toEqual(expect.arrayContaining(['hello', 'clean', 'leaving']));
    expect(seen.says.indexOf('hello')).toBeLessThan(seen.says.indexOf('clean'));
    expect(types(seen)).not.toContain('busted');
    expect(seen.shots).toHaveLength(0);
  });

  it('finds a ship with heat on it wanted: it calls its friends in and fights you itself, on the guns', () => {
    const seen = meet(law(), { at: { x: 0, y: 0, z: -40 }, seconds: 20, world: () => ({ heat: 5 }) });
    expect(seen.says).toContain('busted');
    expect(seen.says).not.toContain('clean');
    const busted = seen.events.find((e) => e.type === 'busted');
    expect(busted).toMatchObject({ faction: 'dea', why: 'busted' });
    expect(types(seen).filter((t) => t === 'busted')).toHaveLength(1);
    expect(seen.shots.length).toBeGreaterThan(0);
    expect(seen.brains.targets.length + (seen.brains.live.length ? 0 : 1)).toBeGreaterThan(0); // (hostile: on the guns while it's there)
  });

  it('comes after you if you run from it, or keep it waiting', () => {
    // run: flat out, away
    const ran = meet(law(), { at: { x: 0, y: 0, z: -40 }, seconds: 16, ship: you({ speed: 0 }), steer: (s, t) => ({ ...s, speed: t > 4 ? 30 : 0 }), world: () => ({ heat: 0 }) });
    expect(ran.says).toContain('run');
    expect(types(ran)).toContain('busted');
    // dawdle: never under NPC.hold, never far
    const slow = meet(law(), { at: { x: 0, y: 0, z: -40 }, seconds: NPC.patience + 8, ship: you({ speed: 5 }), world: () => ({ heat: 0 }) });
    expect(slow.says).toContain('run');
  });

  it('turns on you when shot, and remembers it: next time you are wanted on sight', () => {
    const memory = {};
    const brains = createBrains({ rand: seeded(), memory });
    const n = brains.add(law(), { x: 0, y: 0, z: -40 });
    let s = you();
    const got = [];
    for (let t = 0; t < 8; t += DT) {
      if (Math.abs(t - 3) < DT / 2) brains.hit(n, 1);
      got.push(...brains.update(DT, { you: s, hunters: [], stations: [], heat: 0 }).events);
    }
    expect(got.map((e) => e.type)).toContain('busted');
    expect(got.find((e) => e.type === 'busted').why).toBe('shot');
    expect(memory[law().id]).toMatchObject({ met: 1, shot: 1, grudge: 1 });
    brains.remove(n);
    // next time, clean heat or not
    brains.add(law(), { x: 0, y: 0, z: -40 });
    const says = [];
    for (let t = 0; t < 20; t += DT) for (const e of brains.update(DT, { you: s, hunters: [], stations: [], heat: 0 }).events) if (e.type === 'say') says.push(e.key);
    expect(memory[law().id].met).toBe(2);
    expect(says).toContain('busted');
    expect(says).not.toContain('clean');
  }, 20000);
});

describe('a nemesis', () => {
  const foe = (over = {}) => spec('nemesis', { role: 'enemy', ship: 'tieadvanced', faction: 'empire', stats: { speed: 26, accel: 22, turn: 3, hp: 10, fire: [0.45, 0.8], damage: 8 }, ...over });

  it('comes for you, says so, circles and fires, and is on the guns', () => {
    const seen = meet(foe(), { at: { x: 0, y: 0, z: -45 }, seconds: 20 });
    expect(seen.says).toContain('hello');
    expect(seen.says).not.toContain('again');
    expect(seen.shots.length).toBeGreaterThan(5);
    for (const shot of seen.shots) expect(shot.at).toBe('you');
    expect(seen.brains.targets).toHaveLength(1);
    // never far, never still
    const me = seen.brains.live[0];
    expect(apart(me.pos, seen.ship)).toBeLessThan(NPC.orbit * 3);
  });

  it('jinks away when it has been in front of your nose too long', () => {
    // it starts dead ahead and close: in your sights
    let evaded = false;
    meet(foe(), {
      at: { x: 0, y: 0, z: -12 },
      seconds: 12,
      each: (brains, s, out) => {
        for (const e of out.events) if (e.type === 'say' && e.key === 'evade') evaded = true;
      },
    });
    expect(evaded).toBe(true);
  });

  it('has a word when your shields fail and when it is hurt to half, breaks off nearly dead and remembers', () => {
    const memory = {};
    const brains = createBrains({ rand: seeded(), memory });
    const n = brains.add(foe(), { x: 0, y: 0, z: -30 });
    const says = [];
    const events = [];
    let s = you();
    for (let t = 0; t < 30; t += DT) {
      if (Math.abs(t - 6) < DT / 2) brains.hit(n, 5); // half
      if (Math.abs(t - 12) < DT / 2) brains.hit(n, 4); // under NPC.retreat
      const out = brains.update(DT, { you: s, hunters: [], stations: [], shield: t > 2 ? 20 : 100 });
      for (const e of out.events) {
        events.push(e.type);
        if (e.type === 'say') says.push(e.key);
      }
    }
    expect(says).toEqual(expect.arrayContaining(['hello', 'weak', 'hit', 'half', 'retreat', 'leaving']));
    expect(events).toContain('retreat');
    expect(brains.live).toHaveLength(0); // (gone)
    expect(memory[foe().id]).toMatchObject({ met: 1, shot: 2, grudge: 1 });
    // back, tougher, with friends, and it knows you
    const n2 = brains.add(foe(), { x: 0, y: 0, z: -30 });
    const me = brains.live.find((m) => m.n === n2);
    const got = [];
    for (let t = 0; t < 6; t += DT) got.push(...brains.update(DT, { you: s, hunters: [], stations: [] }).events);
    expect(me.hpMax).toBe(13);
    expect(me.hp).toBe(13);
    expect(got.find((e) => e.type === 'say' && e.key === 'again')).toBeTruthy();
    expect(got.find((e) => e.type === 'calls')).toMatchObject({ faction: 'empire' });
    expect(brains.targets[0].hpMax).toBe(13);
  });

  it('breaks off of its own accord after long enough', () => {
    const seen = meet(foe(), { at: { x: 0, y: 0, z: -30 }, seconds: NPC.nemesis + 20 });
    expect(seen.says).toContain('retreat');
    expect(seen.brains.live).toHaveLength(0);
  }, 20000);
});

describe('a tagalong', () => {
  const pal = () => spec('tagalong', { role: 'ally', ship: 'saucer', stats: { speed: 20, accel: 14, turn: 2.4, hp: 3, fire: [0.8, 1.4], damage: 0 } });

  it('comes up on your wing, says hello, chats now and then, never fires, and goes home in the end', () => {
    const seen = meet(pal(), { at: { x: 20, y: 0, z: 0 }, seconds: NPC.tag + 20, ship: you({ speed: 4 }) });
    expect(seen.says).toEqual(expect.arrayContaining(['hello', 'chat1', 'chat2', 'chat3', 'leaving']));
    expect(seen.shots).toHaveLength(0);
    expect(seen.brains.live).toHaveLength(0);
    expect(seen.brains.targets).toHaveLength(0);
  }, 20000);

  it('panics and runs when hunters come near you, and comes back once they have gone', () => {
    const hunters = (t) => (t > 12 && t < 20 ? [{ id: 5, at: { x: 0, y: 0, z: -10 }, faction: 'federation' }] : []);
    let furthest = 0;
    const seen = meet(pal(), {
      at: { x: 20, y: 0, z: 0 },
      seconds: 32,
      world: (t) => ({ hunters: hunters(t) }),
      each: (brains, s, out, t) => {
        if (t > 14 && t < 20 && brains.live[0]) furthest = Math.max(furthest, apart(brains.live[0].pos, s));
      },
    });
    expect(seen.says).toEqual(expect.arrayContaining(['hello', 'panic', 'back']));
    expect(seen.says.indexOf('panic')).toBeLessThan(seen.says.indexOf('back'));
    expect(furthest).toBeGreaterThan(NPC.hide * 0.6);
    // close again at the end
    expect(apart(seen.brains.live[0].pos, seen.ship)).toBeLessThan(12);
  });
});

describe('a trickster', () => {
  const pirate = () => spec('trickster', { ship: 'skiff', faction: 'weequay', stats: { speed: 19, accel: 15, turn: 2.4, hp: 5, fire: [0.7, 1.2], damage: 6 } });

  it('names its toll, and paid in patience it hands over word of what is coming and goes', () => {
    const seen = meet(pirate(), { at: { x: 0, y: 0, z: -40 }, seconds: 24, world: () => ({ next: { id: 'hunt', in: 30 } }) });
    expect(seen.says).toEqual(expect.arrayContaining(['hello', 'paid', 'leaving']));
    const tip = seen.events.find((e) => e.type === 'tip');
    expect(tip?.next?.id).toBe('hunt');
    expect(types(seen)).not.toContain('busted');
    expect(BRAINS.trickster.tells).toBe(true);
  });

  it('calls its friends in and fights when you run, keep it waiting or shoot it', () => {
    const ran = meet(pirate(), { at: { x: 0, y: 0, z: -40 }, seconds: 16, steer: (s, t) => ({ ...s, speed: t > 4 ? 30 : 0 }) });
    expect(ran.says).toContain('angry');
    expect(ran.events.find((e) => e.type === 'busted')).toMatchObject({ faction: 'weequay', size: 3 });
    const shot = meet(pirate(), { at: { x: 0, y: 0, z: -40 }, seconds: 10, each: (brains, s, out, t) => Math.abs(t - 5) < DT / 2 && brains.hit(brains.live[0]?.n, 1) });
    expect(shot.events.find((e) => e.type === 'busted')?.why).toBe('shot');
    expect(shot.shots.length).toBeGreaterThan(0);
  });
});

describe('what they remember', () => {
  it('counts meetings, hits and knockdowns by character, and a merchant you shot has nothing for you', () => {
    const memory = {};
    const brains = createBrains({ rand: seeded(), memory });
    const saul = spec('merchant');
    const n = brains.add(saul, { x: 30, y: 0, z: 0 });
    brains.update(DT, { you: you(), hunters: [], stations: [] });
    brains.hit(n, 1);
    expect(memory[saul.id]).toMatchObject({ met: 1, shot: 1, downed: 0 });
    brains.hit(n, 10);
    expect(memory[saul.id].downed).toBe(1);
    expect(brains.live).toHaveLength(0);
    // next time: parked, you come by, and it's a grudge, not an offer
    const n2 = brains.add(saul, { x: 30, y: 0, z: 0 });
    const says = [];
    for (let t = 0; t < 20; t += DT) for (const e of brains.update(DT, { you: you({ x: 28 }), hunters: [], stations: [] }).events) if (e.type === 'say') says.push(e.key);
    expect(memory[saul.id].met).toBe(2);
    expect(says).toContain('grudge');
    expect(says).not.toContain('hello');
    expect(brains.live.find((m) => m.n === n2)).toBeUndefined();
  });

  it('every brain names the lines a crew must have for it, and the informant and the trickster tell', () => {
    for (const b of ['merchant', 'inspector', 'nemesis', 'tagalong', 'trickster']) expect(Array.isArray(BRAINS[b].lines), b).toBe(true);
    expect(BRAINS.informant.tells).toBe(true);
    expect(BRAINS.rival.tells).toBeUndefined();
  });
});

describe('a nemesis’s phases, and dodging', () => {
  const foe = () => spec('nemesis', { role: 'enemy', ship: 'tieadvanced', faction: 'empire', stats: { speed: 26, accel: 22, turn: 3, hp: 20, fire: [0.45, 0.8], damage: 8 } });

  it('falls back and calls its friends at NPC.summon, comes back in, and goes into a fury at NPC.fury, firing faster', () => {
    const brains = createBrains({ rand: seeded(5) });
    const n = brains.add(foe(), { x: 0, y: 0, z: -30 });
    const me = brains.live[0];
    const s = you();
    const says = [];
    const calls = [];
    const shots = { duel: 0, fallback: 0, fury: 0 };
    let furthest = 0;
    for (let t = 0; t < 60; t += DT) {
      if (Math.abs(t - 15) < DT / 2) brains.hit(n, 9); // under NPC.summon of 20
      if (Math.abs(t - 40) < DT / 2) brains.hit(n, 5); // under NPC.fury
      const out = brains.update(DT, { you: s, hunters: [], stations: [] });
      for (const e of out.events) {
        if (e.type === 'say') says.push(e.key);
        if (e.type === 'calls') calls.push(e);
        if (e.type === 'shot') shots[t < 15 ? 'duel' : t < 40 ? 'fallback' : 'fury'] += 1;
      }
      if (t > 16 && t < 15 + NPC.fallback) furthest = Math.max(furthest, apart(me.pos, s));
    }
    expect(says).toEqual(expect.arrayContaining(['hello', 'hit', 'half', 'fury']));
    expect(says.indexOf('half')).toBeLessThan(says.indexOf('fury'));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ faction: 'empire', size: 2 });
    expect(furthest).toBeGreaterThan(NPC.orbit * 1.6); // (out of your reach while it waits for them)
    expect(me.hp).toBe(6);
    expect(brains.live).toHaveLength(1); // (not yet retreating: 6/20 is over NPC.retreat)
    // the fury fires faster than the duel, over the same stretch of time
    expect(shots.fury / 20).toBeGreaterThan((shots.duel / 15) * 1.3);
  });

  it('loads the dice: a ship turning hard or boosting is hit less often than one flying straight', () => {
    const land = (ship) => {
      const brains = createBrains({ rand: seeded(9) });
      brains.add(foe(), { x: 0, y: 0, z: -12 });
      let hits = 0;
      let fired = 0;
      for (let t = 0; t < 40; t += DT) {
        for (const e of brains.update(DT, { you: ship, hunters: [], stations: [] }).events) {
          if (e.type === 'shot') {
            fired += 1;
            if (e.hit) hits += 1;
          }
        }
      }
      return { hits, fired, rate: hits / Math.max(1, fired) };
    };
    const still = land(you());
    const turning = land(you({ rate: 2, tipRate: 1 }));
    const boosting = land(you({ speed: 20 }));
    expect(still.fired).toBeGreaterThan(10);
    expect(turning.rate).toBeLessThan(still.rate * 0.6);
    expect(boosting.rate).toBeLessThan(still.rate);
    expect(dodge(you({ rate: 9, tipRate: 9, speed: 99 }))).toBe(NPC.dodge);
    expect(dodge(null)).toBe(0);
  });
});

describe('what your standing does to them', () => {
  it('an inspector finds a wanted pilot on every scan, a merchant shuns a feared one, and Hondo waves a friend of pirates through', () => {
    const law = spec('inspector', { ship: 'suvace', faction: 'dea' });
    const wanted = meet(law, { at: { x: 0, y: 0, z: -40 }, seconds: 20, world: () => ({ heat: 0, wanted: true }) });
    expect(wanted.says).toContain('busted');
    const feared = meet(spec('merchant'), { at: { x: 30, y: 0, z: 0 }, ship: you({ x: 28 }), seconds: 10, world: () => ({ feared: true }) });
    expect(feared.says).toContain('shunned');
    expect(feared.says).not.toContain('hello');
    expect(types(feared)).not.toContain('offer');
    const friend = meet(spec('trickster', { ship: 'skiff', faction: 'weequay' }), { at: { x: 0, y: 0, z: -40 }, seconds: 12, world: () => ({ friend: true, next: { id: 'comet', in: 10 } }) });
    expect(friend.says).toContain('friend');
    expect(friend.says).not.toContain('hello');
    expect(friend.events.find((e) => e.type === 'tip')?.next?.id).toBe('comet');
  });
});

describe('what a character knows of you', () => {
  // a planet between you: it loses sight of you, keeps the truth a moment, then guesses, and fires at the guess
  const planet = { at: [0, 0, -60], r: 20 };
  it('knows where you are when it comes, but can’t see you through a planet, and says it has seen you only in sight', () => {
    let knewAt = null;
    let sawAt = null;
    let seenAt = null;
    meet(spec('rival', { role: 'enemy' }), {
      at: { x: 0, y: 0, z: -120 },
      seconds: 12,
      ship: you({ x: 0, y: 0, z: 0, speed: 0 }),
      world: () => ({ solids: [planet] }),
      each: (brains, s, out, t) => {
        const me = brains.live[0];
        if (!me) return;
        if (me.you && knewAt === null) knewAt = t;
        if (me.sees && sawAt === null) sawAt = t;
        if (seenAt === null && out.events.some((e) => e.type === 'say' && e.key === 'seen')) seenAt = t;
      },
    });
    // sent to you, it knew where you were at once; the planet was between you, so it saw you only once round it
    expect(knewAt).toBeLessThan(0.1);
    expect(sawAt).toBeGreaterThan(1);
    expect(seenAt).toBeGreaterThanOrEqual(sawAt);
  });

  it('keeps the truth for a moment after losing you, then guesses, and shots at a guess go to the guess', () => {
    // a gun that sits where it's put and fires at you: the engine's firing, nothing else
    const turret = () => ({ fire: 'you' });
    const brains = createBrains({ rand: seeded(3), brains: { ...BRAINS, turret } });
    const n = brains.add(spec('turret', { role: 'enemy' }), { x: 0, y: 0, z: 0 });
    const me = brains.live[0];
    let guessing = null;
    const shots = [];
    for (let t = 0; t < 12; t += DT) {
      // in sight, 10 off; a moon drops in between at 3 s; you slip 8 to the side at 6 s, still hidden
      const s = you({ x: t > 6 ? 8 : 0, y: 0, z: 10 });
      const out = brains.update(DT, { you: s, hunters: [], stations: [], solids: t > 3 ? [{ at: [0, 0, 5], r: 4 }] : [] });
      if (me.you?.guessed && guessing === null) guessing = t;
      for (const e of out.events) if (e.type === 'shot') shots.push({ t, to: e.to, you: s, guessed: Boolean(me.you?.guessed), hit: e.hit });
    }
    expect(n).not.toBeNull();
    expect(guessing).toBeGreaterThan(3 + SENSES.intuition - 0.1);
    expect(guessing).toBeLessThan(3 + SENSES.intuition + 0.3);
    const atGuess = shots.filter((x) => x.guessed && x.t > 6);
    expect(atGuess.length).toBeGreaterThan(2);
    for (const x of atGuess) expect(apart(x.to, x.you)).toBeGreaterThan(3);
    // (and hardly any land: it's a guess)
    expect(atGuess.filter((x) => x.hit).length / atGuess.length).toBeLessThan(0.3);
  });

  it('a brain with no belief of you behaves as with no you, and a shot of yours is heard', () => {
    // a merchant parked at a station, you 300 off: it has nothing for you
    const seen = meet(spec('merchant'), { at: { x: 300, y: 0, z: 0 }, seconds: 20, world: () => ({ stations: [{ id: 's', at: { x: 310, y: 0, z: 0 }, r: 4 }] }) });
    expect(types(seen)).not.toContain('offer');
    // forgotten behind a planet for long enough, a merchant that hears a shot of yours knows where it came from
    let known = null;
    let heard = null;
    const shot = { x: 170, y: 0, z: 60 };
    meet(spec('merchant'), {
      at: { x: 300, y: 0, z: 0 },
      seconds: 24,
      ship: you({ x: 170, y: 0, z: 0 }), // (near enough not to be let go of, behind the planet)
      world: (t) => ({ stations: [{ id: 's', at: { x: 310, y: 0, z: 0 }, r: 4 }], solids: [{ at: [235, 0, 0], r: 20 }], stims: t > 20 && t < 20.1 ? [{ type: 'shot', at: shot, radius: 200, from: 'you', loudness: 1 }] : [] }),
      each: (brains, s, out, t) => {
        const me = brains.live[0];
        if (!me) return;
        if (t > 19 && t < 20) known = Boolean(me.you);
        if (t > 20.2 && heard === null) heard = Boolean(me.you) && apart(me.you, shot) < 1;
      },
    });
    expect(known).toBe(false);
    expect(heard).toBe(true);
  });
});

describe('on the schedule, and traced', () => {
  const nemesis = (over = {}) => spec('nemesis', { role: 'enemy', ship: 'tieadvanced', faction: 'empire', stats: { speed: 26, accel: 22, turn: 3, hp: 10, fire: [0.45, 0.8], damage: 8 }, ...over });
  // a brain that counts how often it's asked, flying the nemesis's way
  const counted = () => {
    const calls = { n: 0 };
    const brain = (...a) => {
      calls.n += 1;
      return BRAINS.nemesis(...a);
    };
    return { calls, brains: { ...BRAINS, nemesis: brain } };
  };

  it('a brain not due keeps its intent and still moves', () => {
    const trace = createTrace();
    const { calls, brains: table } = counted();
    const brains = createBrains({ rand: seeded(3), trace, brains: table });
    const n = brains.add(nemesis(), { x: 0, y: 0, z: -30 });
    let s = you({ speed: 10 });
    for (let t = 0; t < 1; t += DT) {
      s = fly(s);
      brains.update(DT, { you: s, hunters: [], stations: [], t });
    }
    const me = brains.live[0];
    const notes = trace.history(n, 600).length;
    const asked = calls.n;
    const now = me.now;
    expect(notes).toBeGreaterThan(0);
    const at = { ...me.pos };
    const vel = { ...me.vel };
    s = fly(s);
    brains.update(DT, { you: s, hunters: [], stations: [], t: 1 }, { due: new Set() });
    // not asked, not noted, nothing sensed: and still flying, along the way it was going
    expect(calls.n).toBe(asked);
    expect(trace.history(n, 600).length).toBe(notes);
    expect(me.now).toBe(now);
    const moved = { x: me.pos.x - at.x, y: me.pos.y - at.y, z: me.pos.z - at.z };
    expect(Math.hypot(moved.x, moved.y, moved.z)).toBeGreaterThan(0);
    expect((moved.x * vel.x + moved.y * vel.y + moved.z * vel.z) / (Math.hypot(moved.x, moved.y, moved.z) * Math.hypot(vel.x, vel.y, vel.z))).toBeGreaterThan(0.9);
    // and due again, it thinks with all the time it missed
    s = fly(s);
    brains.update(DT, { you: s, hunters: [], stations: [], t: 1 + DT }, { due: new Set([n]) });
    expect(calls.n).toBe(asked + 1);
    expect(me.now).toBeCloseTo(now + 2 * DT, 9);
  });

  it('a due brain notes its scores and mode', () => {
    const trace = createTrace();
    const brains = createBrains({ rand: seeded(3), trace });
    const n = brains.add(nemesis(), { x: 0, y: 0, z: -30 });
    let s = you({ speed: 10 });
    for (let t = 0; t < 2; t += DT) {
      s = fly(s);
      brains.update(DT, { you: s, hunters: [], stations: [], t });
    }
    const last = trace.last(n);
    expect(Object.keys(last.scores).sort()).toEqual(['bait', 'fallback', 'jink', 'orbit', 'pass']);
    expect(typeof last.mode).toBe('string');
    expect(last.belief).toMatchObject({ visible: true });
    expect(last.belief.confidence).toBeGreaterThan(0);
    expect(last.t).toBeGreaterThan(1.9);
  });

  it('senses only, when only its senses are due', () => {
    const trace = createTrace();
    const { calls, brains: table } = counted();
    const brains = createBrains({ rand: seeded(3), trace, brains: table });
    const n = brains.add(nemesis(), { x: 0, y: 0, z: -30 });
    brains.update(DT, { you: you(), hunters: [], stations: [], t: 0 });
    const me = brains.live[0];
    const asked = calls.n;
    brains.update(DT, { you: you(), hunters: [], stations: [], t: DT }, { due: new Map([[n, { sense: true, think: false, dt: DT }]]) });
    expect(calls.n).toBe(asked);
    expect(me.now).toBeCloseTo(2 * DT, 9);
  });

  it('one paused a long while comes back with a quarter second’s step, not a backlog', () => {
    // (a hunter 110 off: sight takes half a second at that range, so a
    // quarter second's look is half sure, and a 30 s one would be certain)
    const dts = [];
    const idle = { idle: (npc, me, view, dt) => (dts.push(dt), {}) };
    const brains = createBrains({ rand: seeded(3), brains: idle });
    const n = brains.add(spec('idle'), { x: 0, y: 0, z: 0 });
    const me = brains.live[0];
    const world = () => ({ you: you({ z: 10 }), hunters: [{ id: 1, at: { x: me.pos.x + 110, y: me.pos.y, z: me.pos.z }, faction: 'rebel' }], stations: [] });
    for (let t = 0; t < 30; t += DT) brains.update(DT, world(), { due: new Set() });
    expect(me.beliefs['h:1']).toBeUndefined();
    brains.update(DT, world(), { due: new Set([n]) });
    expect(me.now).toBeCloseTo(0.25, 9);
    expect(me.beliefs['h:1'].confidence).toBeCloseTo(0.5, 6);
    expect(dts).toEqual([0.25]);
    // and on the schedule's own step (0.1 s, at full rate): still a quarter second, at most
    for (let t = 0; t < 30; t += DT) brains.update(DT, world(), { due: new Set() });
    brains.update(DT, world(), { due: new Map([[n, { sense: true, think: true, dt: 0.1 }]]) });
    expect(me.now).toBeCloseTo(0.5, 9);
    expect(dts).toEqual([0.25, 0.25]);
  });

  it('one thinking at a quarter rate keeps real time: its 0.4 s step is all given it', () => {
    const dts = [];
    const idle = { idle: (npc, me, view, dt) => (dts.push(dt), {}) };
    const brains = createBrains({ rand: seeded(3), brains: idle });
    const n = brains.add(spec('idle'), { x: 0, y: 0, z: 0 });
    const me = brains.live[0];
    const world = { you: you({ z: 10 }), hunters: [], stations: [] };
    const quarter = new Map([[n, { sense: true, think: true, dt: 0.4 }]]);
    brains.update(DT, world, { due: quarter });
    const now = me.now;
    // 0.4 s of frames, the last one due
    for (let i = 1; i < 24; i++) brains.update(DT, world, { due: new Set() });
    brains.update(DT, world, { due: quarter });
    expect(me.now - now).toBeCloseTo(0.4, 9);
    expect(dts[1]).toBeCloseTo(0.4, 9);
  });

  it('a brain taken off the map is taken out of the trace too', () => {
    const trace = createTrace();
    const brains = createBrains({ rand: seeded(3), trace });
    const n = brains.add(nemesis(), { x: 0, y: 0, z: -30 });
    for (let t = 0; t < 0.5; t += DT) brains.update(DT, { you: you(), hunters: [], stations: [], t });
    expect(trace.agents()).toContain(n);
    brains.remove(n);
    expect(trace.agents()).not.toContain(n);
  });
});

describe('the fire cone', () => {
  // a brain flying slowly along +z, firing at you whenever it may
  const gunner = { gunner: (npc, me) => ({ to: { x: me.pos.x, y: me.pos.y, z: me.pos.z + 50 }, speed: 1, fire: 'you' }) };
  const flown = (place) => {
    const brains = createBrains({ rand: seeded(4), brains: gunner });
    brains.add(spec('gunner', { role: 'enemy' }), { x: 0, y: 0, z: 0 });
    const shots = [];
    for (let t = 0; t < 4; t += DT) {
      const me = brains.live[0];
      const out = brains.update(DT, { you: you(place(me)), hunters: [], stations: [], t });
      for (const e of out.events) if (e.type === 'shot') shots.push(e);
    }
    return shots;
  };

  it('a brain fires only inside its forward cone', () => {
    expect(NPC.cone).toBe(0.5);
    // abeam: never
    expect(flown((me) => ({ x: 8, z: me.pos.z }))).toEqual([]);
    // ahead: it does
    expect(flown((me) => ({ x: 0, z: me.pos.z + 8 })).length).toBeGreaterThan(0);
    // behind: never
    expect(flown((me) => ({ x: 0, z: me.pos.z - 8 }))).toEqual([]);
  });
});

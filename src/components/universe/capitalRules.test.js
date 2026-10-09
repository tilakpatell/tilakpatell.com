import { describe, expect, it } from 'vitest';
import { CAPITAL, JUMP, LENGTH, PARTS, createCapital, jumpSmear } from './capitalRules';
import { SIDES } from './sides';

// a seeded random, so a fight is the same every time
const seeded = (seed = 7) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const DT = 1 / 60;
// a ship arriving by you: you at the origin facing −z, it 28 ahead and 10 to the right, broadside on
const arrive = (kind = 'destroyer', rand = seeded()) => {
  const cap = createCapital({ rand });
  cap.arrive(kind, [10, -0.5, -28], Math.PI / 2 + 0.3);
  return cap;
};
const run = (cap, seconds, you = null) => {
  const got = [];
  for (let t = 0; t < seconds; t += DT) {
    cap.update(DT, you);
    got.push(...cap.events.splice(0));
  }
  return got;
};
const settle = (cap) => run(cap, JUMP + 0.1);
const types = (events) => events.map((e) => e.type);
// a shot straight through a point (from well before it to well past it)
const through = (cap, p, punch = 1) => cap.hit([p[0], p[1] + 30, p[2]], [p[0], p[1] - 30, p[2]], punch);
const part = (cap, id) => cap.parts.find((p) => p.id === id);

describe('the jump', () => {
  it('arriving, the nose never gets ahead of where the ship comes to rest, and comes to rest there', () => {
    const len = 16;
    let lastNose = -Infinity;
    for (let k = 0; k <= 1; k += 0.02) {
      const { stretch, shift } = jumpSmear('in', k, len);
      const nose = shift + (len * stretch) / 2;
      expect(nose).toBeLessThanOrEqual(len / 2 + 1e-9);
      expect(nose).toBeGreaterThanOrEqual(lastNose - 1e-9); // (it only ever comes forward)
      lastNose = nose;
    }
    expect(jumpSmear('in', 1, len)).toEqual({ stretch: 1, shift: 0 });
    expect(jumpSmear('in', 0, len).stretch).toBeGreaterThan(10);
  });

  it('leaving, the stern never slides back from where it was: the nose streaks away and the stern follows', () => {
    const len = 16;
    let lastStern = -Infinity;
    for (let k = 0; k <= 1; k += 0.02) {
      const { stretch, shift } = jumpSmear('out', k, len);
      const stern = shift - (len * stretch) / 2;
      expect(stern).toBeGreaterThanOrEqual(-len / 2 - 1e-9);
      expect(stern).toBeGreaterThanOrEqual(lastStern - 1e-9);
      lastStern = stern;
    }
    expect(jumpSmear('out', 0, len)).toEqual({ stretch: 1, shift: 0 });
    // and well away by the end
    const end = jumpSmear('out', 1, len);
    expect(end.shift - (len * end.stretch) / 2).toBeGreaterThan(len);
  });

  it('draws the ship as it is at rest, and never with a stretch under one', () => {
    for (const state of ['here', 'dying', null]) expect(jumpSmear(state, 0.5, 16)).toEqual({ stretch: 1, shift: 0 });
    for (const state of ['in', 'out']) for (const k of [-1, 0, 0.3, 1, 2]) expect(jumpSmear(state, k, 16).stretch).toBeGreaterThanOrEqual(1);
  });
});

describe('the capital ship', () => {
  it('has parts for every side’s capital ship: shields over a bridge, a hull, batteries', () => {
    for (const side of Object.values(SIDES)) {
      const def = PARTS[side.capitalShip];
      expect(def, side.id).toBeTruthy();
      expect(def.shields.length).toBeGreaterThanOrEqual(2);
      expect(def.bridge.id).toBe('bridge');
      expect(def.hull.length).toBeGreaterThanOrEqual(3);
      expect(def.batteries.length).toBeGreaterThanOrEqual(4);
      expect(LENGTH[side.capitalShip]).toBeGreaterThan(0);
      for (const p of [...def.shields, def.bridge]) for (const v of p.at) expect(Math.abs(v)).toBeLessThanOrEqual(0.5);
    }
  });

  it('streaks in, is here, launches its fighters from its belly, and jumps away in time', () => {
    const cap = arrive();
    expect(cap.state).toBe('in');
    expect(cap.here).toBe(true);
    let events = settle(cap);
    expect(cap.state).toBe('here');
    expect(types(events)).not.toContain('launch');
    events = run(cap, CAPITAL.launchAt);
    const launch = events.find((e) => e.type === 'launch');
    expect(launch?.wave).toBe(1);
    expect(launch.from[1]).toBeLessThan(cap.at[1]); // (the hangar's under it)
    events = run(cap, CAPITAL.stay - CAPITAL.launchAt + 0.2);
    expect(types(events)).toContain('leaving');
    expect(events.find((e) => e.type === 'leaving').reason).toBe('left');
    expect(cap.state).toBe('out');
    events = run(cap, JUMP + 0.1);
    expect(types(events)).toContain('gone');
    expect(cap.state).toBeNull();
    expect(cap.here).toBe(false);
  });

  it('drifts across your way along its nose while it is here, its parts carried with it', () => {
    const cap = arrive();
    settle(cap);
    const was = [...cap.at];
    const dome = [...part(cap, 'dome0').at];
    run(cap, 2);
    const moved = Math.hypot(cap.at[0] - was[0], cap.at[2] - was[2]);
    expect(moved).toBeCloseTo(CAPITAL.drift * 2, 0);
    // along forward(heading)
    const fx = -Math.sin(cap.heading);
    const fz = -Math.cos(cap.heading);
    expect((cap.at[0] - was[0]) * fz - (cap.at[2] - was[2]) * fx).toBeCloseTo(0, 5);
    const now = part(cap, 'dome0').at;
    expect(Math.hypot(now[0] - dome[0], now[2] - dome[2])).toBeCloseTo(moved, 5);
  });

  it('puts its parts above the hull, the domes astern on a Star Destroyer, and its hangar under it', () => {
    const cap = arrive();
    settle(cap);
    for (const p of cap.parts) expect(p.at[1]).toBeGreaterThan(cap.at[1]);
    // astern: against its nose
    const fx = -Math.sin(cap.heading);
    const fz = -Math.cos(cap.heading);
    const d = part(cap, 'dome0');
    expect((d.at[0] - cap.at[0]) * fx + (d.at[2] - cap.at[2]) * fz).toBeLessThan(0);
    expect(cap.hangar[1]).toBeLessThan(cap.at[1]);
  });

  it('cannot be hit while it is a streak', () => {
    const cap = arrive();
    const d = part(cap, 'dome0');
    expect(through(cap, d.at)).toBeNull();
    expect(cap.targets).toHaveLength(0);
    settle(cap);
    expect(through(cap, d.at)).toBeTruthy();
  });

  it('shields its hull and its bridge while a dome stands, and a shot into the hull splashes off', () => {
    const cap = arrive();
    settle(cap);
    const bridge = part(cap, 'bridge');
    expect(cap.targets.map((t) => t.name)).toEqual(['Shield dome', 'Shield dome']);
    // the hull, under the shield
    const hull = through(cap, cap.at);
    expect(hull?.type).toBe('shielded');
    expect(hull.down).toBe(false);
    // the bridge is under it too: a shot there is the shield's
    const b = through(cap, bridge.at);
    expect(b?.type).toBe('shielded');
    expect(bridge.hp).toBe(CAPITAL.bridgeHp);
    // nothing well away from it
    expect(cap.hit([100, 100, 100], [101, 101, 101])).toBeNull();
  });

  it('loses a dome to enough hits, then the other, and then its bridge is open and it starts to run', () => {
    const cap = arrive();
    settle(cap);
    const [d0, d1] = [part(cap, 'dome0'), part(cap, 'dome1')];
    for (let i = 0; i < CAPITAL.shieldHp - 1; i++) expect(through(cap, d0.at)).toMatchObject({ type: 'part', part: 'dome0', down: false });
    expect(through(cap, d0.at)).toMatchObject({ type: 'part', part: 'dome0', down: true, left: 1 });
    expect(d0.alive).toBe(false);
    expect(through(cap, d0.at)?.type ?? 'nothing').not.toBe('part'); // (gone: nothing there to hit but the hull, shielded still)
    let events = cap.events.splice(0);
    expect(events).toContainEqual({ type: 'part', part: 'dome0', left: 1 });
    expect(types(events)).not.toContain('open');
    // two heavy rounds for the other
    expect(through(cap, d1.at, 8).down).toBe(false);
    expect(through(cap, d1.at, 8).down).toBe(true);
    events = cap.events.splice(0);
    expect(types(events)).toContain('open');
    expect(cap.shielded).toBe(false);
    expect(cap.targets.map((t) => t.name)).toEqual(['Bridge']);
    // the hull sparks now, no shield
    expect(through(cap, cap.at)?.type).toBe('hull');
    // and it runs FLEE seconds on
    events = run(cap, CAPITAL.flee - 1);
    expect(types(events)).not.toContain('leaving');
    events = run(cap, 1.2);
    expect(events.find((e) => e.type === 'leaving')?.reason).toBe('fled');
  });

  it('dies when its bridge goes with the shields down: it lists, goes up along its length and is gone', () => {
    const cap = arrive();
    settle(cap);
    for (const id of ['dome0', 'dome1']) for (let i = 0; i < CAPITAL.shieldHp; i++) through(cap, part(cap, id).at);
    cap.events.length = 0;
    const bridge = part(cap, 'bridge');
    for (let i = 0; i < CAPITAL.bridgeHp - 1; i++) expect(through(cap, bridge.at)).toMatchObject({ type: 'bridge', down: false });
    expect(through(cap, bridge.at)).toMatchObject({ type: 'bridge', down: true });
    expect(cap.state).toBe('dying');
    expect(cap.here).toBe(true);
    expect(types(cap.events.splice(0))).toContain('dying');
    expect(through(cap, cap.at)).toBeNull(); // (nothing more to shoot)
    expect(cap.targets).toHaveLength(0);
    const events = run(cap, CAPITAL.die + 0.1);
    const blasts = events.filter((e) => e.type === 'blast');
    expect(blasts.length).toBeGreaterThan(8);
    for (const b of blasts) expect(Math.hypot(b.at[0] - cap.at[0], b.at[2] - cap.at[2])).toBeLessThan(cap.len * 0.6);
    expect(cap.roll).toBeGreaterThan(0.5);
    expect(types(events)).toContain('dead');
    expect(types(events)).not.toContain('leaving');
    expect(cap.state).toBeNull();
  });

  it('fires its turbolasers at you when you are in range, and a bolt that passes near enough lands', () => {
    const cap = arrive();
    settle(cap);
    run(cap, CAPITAL.launchAt);
    const you = { x: 0, y: 0, z: 0, heading: 0, speed: 0 };
    const events = run(cap, 12, you);
    const volleys = events.filter((e) => e.type === 'volley');
    expect(volleys.length).toBeGreaterThan(4);
    expect(volleys.length).toBeLessThan(12 / CAPITAL.volley[0] + 1);
    for (const v of volleys) expect(Math.hypot(v.to[0] - you.x, v.to[1] - you.y, v.to[2] - you.z)).toBeLessThan(CAPITAL.bolt.spread * 1.5);
    const hits = events.filter((e) => e.type === 'hit');
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) expect(h.damage).toBe(CAPITAL.bolt.damage);
    // (sitting still right in front of it, most land; a bolt lands once)
    expect(hits.length).toBeLessThanOrEqual(volleys.length);
    // out of range, nothing
    const far = createCapital({ rand: seeded() });
    far.arrive('destroyer', [10, -0.5, -28], Math.PI / 2);
    settle(far);
    run(far, CAPITAL.launchAt);
    expect(types(run(far, 10, { x: 0, y: 0, z: 200, heading: 0, speed: 0 }))).not.toContain('volley');
  });

  it('bolts fly on past you and die of old age', () => {
    const cap = arrive();
    settle(cap);
    run(cap, CAPITAL.launchAt);
    // you off to one side, in range: the bolts fly, and some miss
    let most = 0;
    const you = { x: 40, y: 0, z: 0, heading: 0, speed: 0 };
    for (let t = 0; t < 6; t += DT) {
      cap.update(DT, you);
      most = Math.max(most, cap.bolts.length);
    }
    expect(most).toBeGreaterThan(0);
    expect(cap.events.some((e) => e.type === 'volley')).toBe(true);
    cap.events.length = 0;
    // (gone: nothing for them to hit, and they die of old age)
    run(cap, CAPITAL.bolt.life + 0.5, null);
    expect(cap.bolts).toHaveLength(0);
  });

  it('launches a second wave when the first is seen off with its shields up, and goes once that one is too', () => {
    const cap = arrive();
    settle(cap);
    run(cap, CAPITAL.launchAt);
    cap.cleared();
    const events = run(cap, CAPITAL.relaunch + 0.1);
    expect(events.find((e) => e.type === 'launch')?.wave).toBe(2);
    cap.cleared();
    expect(cap.events.splice(0).find((e) => e.type === 'leaving')?.reason).toBe('done');
  });

  it('goes at once when its fighters are seen off with its shields down', () => {
    const cap = arrive();
    settle(cap);
    run(cap, CAPITAL.launchAt);
    for (const id of ['dome0', 'dome1']) for (let i = 0; i < CAPITAL.shieldHp; i++) through(cap, part(cap, id).at);
    cap.cleared();
    expect(cap.state).toBe('out');
  });

  it('can be told to leave, once, and not while it is a streak out', () => {
    const cap = arrive();
    settle(cap);
    cap.leave();
    expect(cap.state).toBe('out');
    cap.leave();
    expect(cap.events.filter((e) => e.type === 'leaving')).toHaveLength(1);
    expect(cap.arrive('destroyer', [0, 0, 0], 0)).toBeNull(); // (one at a time)
  });

  it('is each side’s own ship, at its own length', () => {
    for (const side of Object.values(SIDES)) {
      const cap = arrive(side.capitalShip);
      expect(cap.len).toBe(LENGTH[side.capitalShip]);
      settle(cap);
      expect(cap.targets.length).toBe(PARTS[side.capitalShip].shields.length);
      for (const t of cap.targets) expect(t.id.startsWith('cap:')).toBe(true);
    }
  });
});

describe('its hull as solids (ship.js’s), for flying into it', () => {
  it('is one sphere a hull sphere, where the hull is, once it’s here, and follows it as it drifts', () => {
    const cap = arrive();
    expect(cap.solids).toEqual([]); // (jumping in: a smear, not solid)
    settle(cap);
    const s = cap.solids;
    expect(s).toHaveLength(PARTS.destroyer.hull.length);
    s.forEach((o, i) => {
      expect(o.id).toBe(`cap:hull:${i}`);
      expect(o.ship).toBe(true);
      expect(o.r).toBeCloseTo(PARTS.destroyer.hull[i][3] * LENGTH.destroyer, 6);
      expect(o.reach).toBe(o.r);
    });
    const was = [...s[0].at];
    run(cap, 1);
    expect(cap.solids[0].at).not.toEqual(was); // (it drifts, and its hull with it)
    expect(Math.hypot(cap.solids[0].at[0] - cap.at[0], cap.solids[0].at[2] - cap.at[2])).toBeLessThan(LENGTH.destroyer);
  });

  it('is nothing once it’s jumping away', () => {
    const cap = arrive();
    settle(cap);
    cap.leave();
    run(cap, DT);
    expect(cap.state).toBe('out');
    expect(cap.solids).toEqual([]);
  });
});

describe('each side’s capital ship, on its own parts', () => {
  it('lays a Venator and a Mon Cal out on their own parts, and as long as they are', () => {
    for (const kind of ['venator', 'moncal']) {
      expect(PARTS[kind], kind).toBeDefined();
      expect(PARTS[kind].shields.length, kind).toBeGreaterThanOrEqual(2);
      expect(PARTS[kind].batteries.length, kind).toBeGreaterThanOrEqual(4);
      expect(LENGTH[kind], kind).toBeLessThan(LENGTH.destroyer);
    }
  });
});

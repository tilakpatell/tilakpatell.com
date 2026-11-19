import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BEACONS, ZONE, createFront, frontAt, zoneOf } from './front';
import { NODES } from './waypoints';
import { SIDES } from './sides';
import { WARS } from './wars';
import { contested } from './war';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};

describe('zoneOf', () => {
  it('is in the fight close up, near within sight of it, out beyond', () => {
    expect(zoneOf(100, 'out')).toBe('in');
    expect(zoneOf(ZONE.in + 1, 'out')).toBe('near');
    expect(zoneOf(ZONE.near + 1, 'out')).toBe('out');
  });
  it('lets go of the fight only well out of it', () => {
    expect(zoneOf(ZONE.in + 50, 'in')).toBe('in');
    expect(zoneOf(ZONE.out + 1, 'in')).toBe('near');
  });
});

// a front with stand-ins for the battle and its drawing
const stubbed = () => {
  const made = [];
  const emitted = [];
  const makeBattle = (opts) => {
    const b = { opts, over: null, you: null, setYou: (t) => (b.you = t), update: () => [], hit: () => null, targets: [], info: {}, end: (w) => (b.over = { winner: w, why: 'forced' }) };
    made.push(b);
    return b;
  };
  const draws = [];
  const makeScene = () => {
    const d = { shown: 0, hidden: 0, show: () => (d.shown += 1), hide: () => (d.hidden += 1), update: () => true, dispose() {} };
    draws.push(d);
    return d;
  };
  // (the Star Wars war, as a war here: it's fought in the galaxy, so it isn't one ready on the map)
  const front = createFront(new THREE.Group(), { side: SIDES.starwars, war: { ...WARS.starwars, ready: true }, models: { want() {} }, storage: memory(), emit: (e) => emitted.push(e), makeBattle, makeScene, tier: 'low' });
  return { front, made, draws, emitted };
};
const at = (front, d) => {
  const [x, y, z] = front.where().at;
  return { x: x + d, y, z };
};

describe('createFront', () => {
  it('only fights a war that’s ready (the Star Wars crews’ is in the galaxy)', () => {
    for (const side of [SIDES.rickmorty, SIDES.breakingbad]) {
      const f = createFront(new THREE.Group(), { side, models: { want() {} }, storage: memory(), emit() {}, makeScene: () => ({ show() {}, hide() {}, update: () => true, dispose() {} }) });
      expect(f, side.id).not.toBeNull();
      f.dispose();
    }
    expect(createFront(new THREE.Group(), { side: SIDES.starwars, models: {}, storage: memory(), emit() {} })).toBeNull();
    expect(createFront(new THREE.Group(), { side: null, models: {}, storage: memory(), emit() {} })).toBeNull();
  });

  it('is at the war’s contested sector, and puts you in on your crew’s side as you arrive (no side to pick)', () => {
    const { front, made, emitted } = stubbed();
    const war = WARS.starwars;
    expect(front.where().at).toEqual(war.sectors[contested({ front: 3, attacker: 0 })].at);
    front.update(0.1, 0, null, new THREE.Vector3(), at(front, 50));
    expect(made).toHaveLength(1);
    expect(emitted.some((e) => e.type === 'battle' && e.what === 'ask')).toBe(false);
    expect(emitted.some((e) => e.type === 'event' && e.id === 'battle' && e.sub === 'front')).toBe(true);
    expect(front.inZone).toBe(true);
    expect(made[0].you).toBe(0);
    expect(front.joined).toBe(0);
  });

  it('holds the drive all the way down in the fight, easing it on coming in, and not for a ship flying past or away', () => {
    const { front } = stubbed();
    const p = (d) => at(front, d);
    const toward = [-1, 0, 0]; // (from out along +x, back toward it)
    expect(front.holdAt(...Object.values(p(ZONE.in * 0.5)), toward)).toBe(1);
    const halfway = front.holdAt(...Object.values(p((ZONE.in + ZONE.near) / 2)), toward);
    expect(halfway).toBeGreaterThan(0.05);
    expect(halfway).toBeLessThan(0.95);
    expect(front.holdAt(...Object.values(p(ZONE.near + 50)), toward)).toBe(0);
    // going away, or by it wide of the fight, it's open
    expect(front.holdAt(...Object.values(p(ZONE.in + 120)), [1, 0, 0])).toBeLessThan(0.05);
    expect(front.holdAt(...Object.values(p(ZONE.in + 120)), [0, 0, 1])).toBeLessThan(0.05);
  });

  it('leaving pauses and coming back resumes the same battle', () => {
    const { front, made, draws } = stubbed();
    front.update(0.1, 0, null, new THREE.Vector3(), at(front, 50));
    front.update(0.1, 0, null, new THREE.Vector3(), at(front, ZONE.near + 400));
    expect(front.inZone).toBe(false);
    expect(draws[0].hidden).toBeGreaterThan(0);
    front.update(0.1, 0, null, new THREE.Vector3(), at(front, 50));
    expect(made).toHaveLength(1);
    expect(draws[0].shown).toBe(2);
  });

  it('moves the front when a battle’s won, and saves it', () => {
    const { front, made, emitted } = stubbed();
    front.update(0.1, 0, null, new THREE.Vector3(), at(front, 50));
    front.join(0);
    made[0].update = () => [{ type: 'over', winner: 0, why: 'flagship' }];
    made[0].over = { winner: 0, why: 'flagship' };
    front.update(0.1, 0, null, new THREE.Vector3(), at(front, 50));
    expect(front.info.state.front).toBe(4);
    const card = emitted.find((e) => e.type === 'battle' && e.what === 'over');
    expect(card.over.winner).toBe(0);
    expect(card.over.sectors).toHaveLength(7);
    expect(emitted.some((e) => e.type === 'event' && e.sub === 'won')).toBe(true);
  });
});

describe('frontAt', () => {
  const mid = (a, b) => a.map((v, i) => (v + b[i]) / 2);
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  it('is the lanes’ beacons by default', () => {
    expect(BEACONS.length).toBeGreaterThan(4);
    expect(BEACONS.every((b) => b.kind === 'beacon' && NODES.includes(b))).toBe(true);
  });

  it('puts the Rick and Morty war at the beacon nearest the middle of the Council’s picket and Earth C-137', () => {
    const war = WARS.rickmorty;
    const picket = war.sectors.find((s) => s.id === 'picket').at;
    const c137 = war.sectors.find((s) => s.id === 'c137').at;
    const m = mid(picket, c137);
    const b = frontAt(war);
    expect(b.kind).toBe('beacon');
    for (const o of BEACONS) expect(d(b.at, m)).toBeLessThanOrEqual(d(o.at, m));
    expect(b.id).toBe('beacon:rickmorty'); // (the sectors run past Rick and Morty’s world, in the Curve Rift)
  });

  it('takes the beacons it’s given', () => {
    const war = WARS.breakingbad;
    const m = mid(war.sectors[0].at, war.sectors[war.sectors.length - 1].at);
    const near = { id: 'b:near', kind: 'beacon', at: [m[0] + 10, m[1], m[2]] };
    const far = { id: 'b:far', kind: 'beacon', at: [m[0] + 9000, m[1], m[2]] };
    expect(frontAt(war, [far, near])).toBe(near);
    expect(frontAt(war, [])).toBeNull();
  });
});

describe('createFront at a beacon', () => {
  it('fights its battles at the war’s beacon, and says so to the nav map', () => {
    const made = [];
    const makeBattle = (opts) => {
      const b = { opts, over: null, setYou() {}, update: () => [], hit: () => null, targets: [], info: {} };
      made.push(b);
      return b;
    };
    const makeScene = () => ({ show() {}, hide() {}, update: () => true, dispose() {} });
    const front = createFront(new THREE.Group(), { side: SIDES.rickmorty, beacons: BEACONS, models: { want() {} }, storage: memory(), emit() {}, makeBattle, makeScene });
    const b = frontAt(WARS.rickmorty);
    expect(front.where().at).toEqual(b.at);
    expect(front.where().beacon).toBe(b.id);
    expect(front.goal().at).toEqual(b.at);
    // (and the sectors still go from the picket to Earth C-137, the one fought over named)
    expect(front.where().sectors).toHaveLength(7);
    expect(front.where().name).toBe(WARS.rickmorty.battleName(WARS.rickmorty.sectors[contested({ front: 3, attacker: 0 })]));
    const [x, y, z] = b.at;
    front.update(0.1, 0, null, new THREE.Vector3(), { x: x + 50, y, z });
    expect(made).toHaveLength(1);
    expect(made[0].opts.at).toEqual(b.at);
    expect(front.inZone).toBe(true);
    front.dispose();
  });
});

describe('the front, as bodies for ship contact', () => {
  const fighter = (id, team, alive = true) => ({ id, team, alive, kind: 'tie', size: 0.3, seen: { x: id, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 8 } });
  it('answers the other side’s fighters once you are in the fight, a ram on one the battle’s strike', () => {
    const { front, made } = stubbed();
    front.update(0.1, 0, null, new THREE.Vector3(), at(front, ZONE.near - 10)); // (in sight, not in it)
    const b = made[0];
    b.fighters = [fighter(1, 0), fighter(2, 1), fighter(3, 1, false)];
    b.strike = (id, n) => ({ id, n, down: true });
    expect(front.bodies).toEqual([]); // (watching, not in it)
    front.join(0);
    const bodies = front.bodies;
    expect(bodies.map((o) => o.key)).toEqual(['f:2']);
    expect(bodies[0]).toMatchObject({ id: 2, kind: 'tie', size: 0.3, side: 'foe', at: { x: 2, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 8 } });
    expect(bodies[0].hit(3)).toEqual({ id: 2, n: 3, down: true });
    b.over = { winner: 0 };
    expect(front.bodies).toEqual([]);
    front.dispose();
  });
});

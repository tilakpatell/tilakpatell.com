import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient } from './client';
import { createAllies } from './allies';
import { STOCK_LOADOUT } from '../outfit';
import { PUNCH_MAX } from './protocol';

// An in-memory room: what one client sends, the others get straight away.
// room(id) on its own is a pilot with no client, sending whatever it likes.
function createBus() {
  const rooms = [];
  const room = (id) => {
    const actions = {};
    const r = {
      id,
      onPeerJoin: null,
      onPeerLeave: null,
      makeAction(ns) {
        const a = {
          onMessage: null,
          send(data, opts) {
            const to = opts?.target;
            for (const o of rooms) {
              if (o === r || (to && to !== o.id)) continue;
              o.actions[ns]?.onMessage?.(JSON.parse(JSON.stringify(data)), { peerId: id });
            }
            return Promise.resolve();
          },
        };
        actions[ns] = a;
        return a;
      },
      leave: () => Promise.resolve(),
      actions,
    };
    rooms.push(r);
    return r;
  };
  return {
    room,
    load: (id) => () => Promise.resolve({ selfId: id, joinRoom: () => room(id) }),
    // everyone meets everyone
    meet() {
      for (const a of rooms) for (const b of rooms) if (a !== b) a.onPeerJoin?.(b.id);
    },
    // one of them says goodbye
    gone(id) {
      for (const o of rooms) if (o.id !== id) o.onPeerLeave?.(id);
    },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

// Han (A) and Rick (B), and Morty (C) if asked for
async function pair({ three = false } = {}) {
  const bus = createBus();
  let t = 1000;
  const now = () => t;
  const a = createClient({ name: 'Han', kind: 'falcon', load: bus.load('A'), now });
  const b = createClient({ name: 'Rick', kind: 'cruiser', load: bus.load('B'), now });
  const c = three ? createClient({ name: 'Morty', kind: 'cruiser', load: bus.load('C'), now }) : null;
  await flush();
  bus.meet();
  const seen = { a: [], b: [], c: [] };
  a.on((e) => seen.a.push(e));
  b.on((e) => seen.b.push(e));
  c?.on((e) => seen.c.push(e));
  return { a, b, c, bus, seen, tick: (ms) => (t += ms) };
}

const ship = (x = 0) => ({ x, y: 0, z: 0, heading: 0, pitch: 0, bank: 0, speed: 0, vy: 0 });
// B flying at the middle, A just off it, firing straight at B
const lineUp = (a, b) => {
  b.pose(ship(0));
  a.pose(ship(3));
  a.shot({ x: 3, y: 0, z: 0 }, [-20, 0, 0]);
};
const feeds = (list) => list.filter((e) => e.type === 'feed').map((e) => e.text);

afterEach(() => vi.useRealTimers());

describe('createClient', () => {
  it('each sees the other, by name and ship', async () => {
    const { a, b } = await pair();
    expect(a.snapshot().status).toBe('online');
    expect(a.snapshot().peers).toEqual([{ id: 'B', name: 'Rick', kind: 'cruiser', loadout: STOCK_LOADOUT, build: null, looks: null, kills: 0, where: '/universe', level: 1, factions: { side: 'rickmorty', standing: null, war: null, oath: null, rank: null }, ally: 'none', blocked: false }]);
    expect(b.snapshot().peers[0].name).toBe('Han');
  });

  it('shows each what the other has fitted, and any refit', async () => {
    const { a, b, seen } = await pair();
    const fit = { ...STOCK_LOADOUT, paint: 'aws', booster: 'srb', guns: 'twin' };
    a.setProfile({ loadout: fit });
    expect(b.peers.get('A').loadout).toEqual(fit);
    expect(b.snapshot().peers[0].loadout).toEqual(fit);
    expect(seen.b.some((e) => e.type === 'roster')).toBe(true);
    // the same again is no news
    const before = seen.b.length;
    a.setProfile({ loadout: { ...fit } });
    expect(seen.b.length).toBe(before);
    // and their shots come with their guns and colours
    a.pose(ship(3));
    a.shot({ x: 3, y: 0, z: 0 }, [-20, 0, 0]);
    expect(b.takeShots()[0]).toMatchObject({ paint: 'aws', guns: 'twin' });
  });

  it('carries each one\'s level and factions, and a change of them', async () => {
    const { a, b, seen } = await pair();
    // (the wallet's marks: Han flies the Falcon, so his side is the Star Wars one)
    const calm = { law: null, civil: null, outlaw: null };
    const marks = { standing: { starwars: { ...calm, law: 'wanted' }, rickmorty: calm, breakingbad: calm }, oath: { war: 'gcw', side: 'rebel', rank: 'pilot' } };
    const factions = { side: 'starwars', standing: { ...calm, law: 'wanted' }, war: 'gcw', oath: 'rebel', rank: 'pilot' };
    a.setProfile({ level: 4, marks });
    expect(b.peers.get('A')).toMatchObject({ level: 4, factions });
    expect(b.snapshot().peers[0]).toMatchObject({ level: 4, factions });
    expect(a.snapshot().self).toMatchObject({ level: 4, factions });
    // the same again is no news
    const before = seen.b.length;
    a.setProfile({ level: 4, marks: JSON.parse(JSON.stringify(marks)) });
    expect(seen.b.length).toBe(before);
    a.setProfile({ marks: { ...marks, oath: { ...marks.oath, rank: 'captain' } } });
    expect(b.peers.get('A').factions.rank).toBe('captain');
    expect(b.peers.get('A').level).toBe(4);
    // another ship, another universe's standing
    a.setProfile({ kind: 'rv' });
    expect(b.peers.get('A').factions).toMatchObject({ side: 'breakingbad', standing: null }); // (nothing to say of it: none sent)
  });

  it('shows each the garage build the other flies, and a change of it', async () => {
    const { a, b, seen } = await pair();
    const build = { hull: 'saucer', cockpit: 'bubble', wings: 'stub', engines: 'twincans', tail: 'fin', extras: 'dish' };
    a.setProfile({ build: { ...build, seed: 9 } });
    expect(b.peers.get('A').build).toEqual(build);
    expect(b.snapshot().peers[0].build).toEqual(build);
    const before = seen.b.length;
    a.setProfile({ build: { ...build, seed: 10 } }); // (the same ship: no news)
    expect(seen.b.length).toBe(before);
    a.setProfile({ build: null });
    expect(b.peers.get('A').build).toBeNull();
  });

  it('shows each how the other dresses their Rick and Morty', async () => {
    const { a, b, seen } = await pair();
    const looks = { rick: { body: 'suitrick', colors: { hair: 'voidblack' }, gear: { head: 'none', face: 'shades', hand: 'none' } }, morty: { body: 'morty', colors: {}, gear: { head: 'crown', face: 'none', hand: 'plumbus' } } };
    a.setProfile({ looks });
    expect(b.peers.get('A').looks).toEqual(looks);
    expect(b.snapshot().peers[0].looks).toEqual(looks);
    const before = seen.b.length;
    a.setProfile({ looks: JSON.parse(JSON.stringify(looks)) }); // (the same again: no news)
    expect(seen.b.length).toBe(before);
  });

  it('passes poses along, read and timed', async () => {
    const { a, b } = await pair();
    a.pose(ship(4));
    const p = b.peers.get('A');
    expect(p.pose.x).toBe(4);
    expect(p.snaps).toHaveLength(1);
    expect(p.pose.at).toBe(1000);
  });

  it('passes a crew on foot along, and says when they are back in', async () => {
    const { a, b, tick } = await pair();
    const w = { who: 'han', n: [0, 1, 0], f: [0, 0, 1], h: 0, speed: 0, side: 0, aim: 0 };
    a.foot({ planet: 'marvel', kind: 'falcon', ship: { n: [0, 1, 0], f: [1, 0, 0] }, lead: w, mate: null });
    const p = b.peers.get('A');
    expect(p.foot.planet).toBe('marvel');
    expect(p.foot.lead.who).toBe('han');
    expect(p.foot.at).toBe(1000);
    // no more than ten a second
    a.foot({ planet: 'marvel', kind: 'falcon', ship: { n: [0, 1, 0], f: [1, 0, 0] }, lead: { ...w, speed: 0.1 }, mate: null });
    expect(p.foot.lead.speed).toBe(0);
    tick(120);
    a.foot(null);
    expect(p.foot).toBeNull();
    b.block('A', true);
    expect(b.peers.get('A').foot).toBeNull();
  });

  it('passes a crew down on a world in the galaxy along, and says when they take off', async () => {
    const { a, b, tick } = await pair();
    const w = { who: 'han', x: 5, y: 3, z: -8, yaw: 0.5, speed: 3 };
    a.walk({ world: 'tatooine', kind: 'falcon', lead: w, mate: { ...w, who: 'chewie' }, ride: null });
    const p = b.peers.get('A');
    expect(p.walk.world).toBe('tatooine');
    expect(p.walk.lead).toMatchObject({ who: 'han', x: 5, z: -8 });
    expect(p.walk.mate.who).toBe('chewie');
    // no more than ten a second
    a.walk({ world: 'tatooine', kind: 'falcon', lead: { ...w, x: 6 }, mate: null, ride: 'landspeeder' });
    expect(p.walk.lead.x).toBe(5);
    tick(120);
    a.walk({ world: 'tatooine', kind: 'falcon', lead: { ...w, x: 6 }, mate: null, ride: 'landspeeder' });
    expect(p.walk.ride).toBe('landspeeder');
    a.walk(null);
    expect(p.walk).toBeNull();
  });

  it('says when you are just back, so nobody wastes a shot on you', async () => {
    const { a, b, tick } = await pair();
    a.pose(ship(4), { safe: true });
    expect(b.peers.get('A').pose.safe).toBe(true);
    tick(120);
    a.pose(ship(4));
    expect(b.peers.get('A').pose.safe).toBe(false);
  });

  it('says when you are riding a lane, and keeps where each pilot was last seen for the roster', async () => {
    const { a, b, tick } = await pair();
    expect(b.poseOf('A')).toBeNull(); // (not seen yet)
    a.pose({ ...ship(4), z: -48000 }, { lane: true });
    expect(b.peers.get('A').pose.lane).toBe(true);
    expect(b.poseOf('A')).toEqual({ x: 4, y: 0, z: -48000 });
    tick(120);
    a.pose(ship(4));
    expect(b.peers.get('A').pose.lane).toBe(false);
    expect(b.poseOf('nobody')).toBeNull();
  });

  it('shows the others the hunters after you, a few times a second, and says when they are gone', async () => {
    const { a, b, tick } = await pair();
    let asked = 0;
    const wire = () => {
      asked += 1;
      return [[3, 'tie', 5, 0, 0, 19, 0, 0, 1]];
    };
    a.pack(wire);
    expect(b.peers.get('A').hunters).toEqual({ at: 1000, list: [{ id: 3, kind: 'tie', x: 5, y: 0, z: 0, vx: 19, vy: 0, vz: 0, hp: 1 }] });
    // no more often than it should (and the hunters aren't even asked for)
    tick(50);
    a.pack(wire);
    expect(asked).toBe(1);
    tick(200);
    a.pack(wire);
    expect(asked).toBe(2);
    expect(b.peers.get('A').hunters.at).toBe(1250);
    // gone: said once
    tick(250);
    a.pack(() => []);
    expect(b.peers.get('A').hunters).toBeNull();
    const sent = vi.fn(() => []);
    tick(250);
    a.pack(sent);
    expect(sent).toHaveBeenCalledTimes(1);
    // a blocked pilot's are dropped
    tick(250);
    a.pack(wire);
    expect(b.peers.get('A').hunters).not.toBeNull();
    b.block('A', true);
    expect(b.peers.get('A').hunters).toBeNull();
  });

  it('keeps the hunters to itself when nobody is in the same place', async () => {
    const { a, b } = await pair();
    b.setProfile({ where: '/projects' });
    const wire = vi.fn(() => [[3, 'tie', 5, 0, 0, 19, 0, 0, 1]]);
    a.pack(wire);
    expect(wire).not.toHaveBeenCalled();
    expect(b.peers.get('A').hunters).toBeNull();
  });

  it('takes a friend’s hit on one of your hunters, once it could have been one', async () => {
    const { a, b, seen, tick } = await pair();
    const hits = () => seen.a.filter((e) => e.type === 'hunterHit');
    a.pose(ship(0));
    a.pack(() => [[3, 'tieadvanced', 5, 0, 0, 19, 0, 0, 5]]);
    b.pose(ship(8));
    // not from someone who hasn't fired
    b.hunterHit('A', 3, 1);
    expect(hits()).toHaveLength(0);
    b.shot({ x: 8, y: 0, z: 0 }, [-60, 0, 0]);
    b.hunterHit('A', 3, 3);
    expect(hits()).toEqual([{ type: 'hunterHit', from: 'B', id: 3, damage: 3 }]);
    // not one you never had, and never worth more than a bolt can be
    tick(150);
    b.hunterHit('A', 99, 1);
    expect(hits()).toHaveLength(1);
    b.hunterHit('A', 3, 500);
    expect(hits()[1]).toMatchObject({ damage: PUNCH_MAX }); // (capped)
    // two in the same moment both count (they come in bundles)
    b.hunterHit('A', 3, 1);
    expect(hits()).toHaveLength(3);
    // but no more of them than the guns could fire
    for (let i = 0; i < 40; i++) b.hunterHit('A', 3, 1);
    expect(hits().length).toBeLessThanOrEqual(13);
    tick(3000);
    b.shot({ x: 8, y: 0, z: 0 }, [-60, 0, 0]);
    const before = hits().length;
    // nor from across the map
    b.pose(ship(500));
    b.hunterHit('A', 3, 1);
    expect(hits()).toHaveLength(before);
    // and the one who helped is named
    a.helped('B', 'TIE Advanced');
    expect(feeds(seen.a)).toContain('Rick shot down a TIE Advanced that was after you');
  });

  it('makes an alliance only when both want one', async () => {
    const { a, b, seen } = await pair();
    a.ally('B', 'ask');
    expect(a.peers.get('B').ally).toBe('sent');
    expect(b.peers.get('A').ally).toBe('got');
    expect(seen.b.some((e) => e.type === 'feed' && /wants to be allies/.test(e.text))).toBe(true);
    b.ally('A', 'accept');
    expect(a.peers.get('B').ally).toBe('ally');
    expect(b.peers.get('A').ally).toBe('ally');
    // each side is told it's made, with who it's with (the wallet pays for it)
    expect(seen.a.filter((e) => e.type === 'allied')).toEqual([{ type: 'allied', id: 'B' }]);
    expect(seen.b.filter((e) => e.type === 'allied')).toEqual([{ type: 'allied', id: 'A' }]);
    b.ally('A', 'end');
    expect(a.peers.get('B').ally).toBe('none');
    expect(seen.a.filter((e) => e.type === 'allied')).toHaveLength(1);
  });

  it('a hit counts after a shot, and not between allies', async () => {
    const { a, b, seen, tick } = await pair();
    lineUp(a, b);
    a.hit('B');
    expect(seen.b.filter((e) => e.type === 'hit')).toHaveLength(1);
    // allies can't hurt each other
    a.ally('B', 'ask');
    b.ally('A', 'accept');
    tick(300);
    a.shot({ x: 3, y: 0, z: 0 }, [-20, 0, 0]);
    a.hit('B');
    expect(seen.b.filter((e) => e.type === 'hit')).toHaveLength(1);
  });

  it('a ram is told to the pilot rammed, as hard as both your speeds allow, and not between allies', async () => {
    const { a, b, seen, tick } = await pair();
    b.pose({ ...ship(0), speed: 4 });
    a.pose({ ...ship(0.6), speed: 6 });
    a.ram('B', 400);
    const got = seen.b.filter((e) => e.type === 'rammed');
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ from: 'A', into: 10 });
    // not again inside the contact's cool, and never from far off
    a.ram('B', 8);
    expect(seen.b.filter((e) => e.type === 'rammed')).toHaveLength(1);
    tick(400);
    a.pose({ ...ship(30), speed: 6 });
    a.ram('B', 8);
    expect(seen.b.filter((e) => e.type === 'rammed')).toHaveLength(1);
    // allies can't hurt each other
    a.pose({ ...ship(0.6), speed: 6 });
    a.ally('B', 'ask');
    b.ally('A', 'accept');
    tick(400);
    a.ram('B', 8);
    expect(seen.b.filter((e) => e.type === 'rammed')).toHaveLength(1);
  });

  it('a pilot rammed out of the sky is the rammer’s, and said as a ram', async () => {
    const { a, b, seen } = await pair();
    b.pose({ ...ship(0), speed: 4 });
    a.pose({ ...ship(0.6), speed: 6 });
    a.ram('B', 10);
    b.down('A', true);
    expect(feeds(seen.a)).toContain('You rammed Rick out of the sky');
    expect(feeds(seen.b)).toContain('Han rammed you out of the sky');
  });

  it('a heavy round hits harder, and its shot carries the weapon', async () => {
    const { a, b, seen } = await pair();
    b.pose(ship(0));
    a.pose(ship(3));
    a.shot({ x: 3, y: 0, z: 0 }, [-20, 0, 0], 2);
    expect(b.takeShots().at(-1).w).toBe(2);
    a.hit('B', 30);
    expect(seen.b.filter((e) => e.type === 'hit').at(-1).damage).toBe(30);
  });

  it('passes the Citadel siege along, only to pilots in the same place', async () => {
    const { a, b, seen } = await pair();
    const msg = { e: 0, m: [3, 0, 0, 0, 0], t: [3, 0, 0, 0, 0], x: 0, l: Date.now() };
    a.siege(msg);
    const got = seen.b.filter((e) => e.type === 'siege');
    expect(got).toHaveLength(1);
    expect(got[0].from).toBe('A');
    expect(got[0].msg.m[0]).toBe(3);
    b.setProfile({ where: '/galaxy/hoth' });
    a.siege(msg);
    expect(seen.b.filter((e) => e.type === 'siege')).toHaveLength(1);
    a.siege({ e: 'nope' });
    expect(seen.b.filter((e) => e.type === 'siege')).toHaveLength(1);
  });

  it('passes the galaxy’s war along from anywhere, and a battle’s only to pilots in the same place', async () => {
    const { a, b, seen } = await pair();
    const msg = { e: 'c2', m: { 'hoth:5': 3 }, t: { 'hoth:5': 3 } };
    a.setProfile({ where: '/galaxy/hoth' });
    a.war(msg);
    expect(seen.b.filter((e) => e.type === 'war')).toHaveLength(1);
    expect(seen.b.find((e) => e.type === 'war').msg).toEqual(msg);
    const fight = { e: 'c2.hoth.5', m: { 'gen-port': 8 }, t: { 'gen-port': 8 } };
    a.fight(fight);
    expect(seen.b.filter((e) => e.type === 'fight')).toHaveLength(0);
    b.setProfile({ where: '/galaxy/hoth' });
    a.fight(fight);
    expect(seen.b.filter((e) => e.type === 'fight')).toHaveLength(1);
    a.war({ e: 'c2', m: { 'Bad Key': 1 }, t: {} });
    a.fight({ e: 'c2.hoth.5', m: [], t: {} });
    expect(seen.b.filter((e) => e.type === 'war')).toHaveLength(1);
    expect(seen.b.filter((e) => e.type === 'fight')).toHaveLength(1);
  });

  it('a hit from someone somewhere else does nothing (another of the galaxy\'s systems)', async () => {
    const { a, b, seen } = await pair();
    a.setProfile({ where: '/galaxy/hoth' });
    b.setProfile({ where: '/galaxy/endor' });
    lineUp(a, b);
    a.hit('B');
    expect(seen.b.filter((e) => e.type === 'hit')).toHaveLength(0);
    a.setProfile({ where: '/galaxy/endor' });
    lineUp(a, b);
    a.hit('B');
    expect(seen.b.filter((e) => e.type === 'hit')).toHaveLength(1);
  });

  it('sends no pointer from a system in the galaxy, where you fly', async () => {
    const { a, b } = await pair();
    a.setProfile({ where: '/galaxy/hoth' });
    a.cursor(10, 200);
    expect(b.peers.get('A').cur).toBe(null);
    a.setProfile({ where: '/galaxy/hoth/mission' });
    a.cursor(10, 200);
    expect(b.peers.get('A').cur?.y).toBe(200);
  });

  it('a hit from a shot fired the other way does nothing', async () => {
    const { a, b, seen } = await pair();
    b.pose(ship(0));
    a.pose(ship(3));
    a.shot({ x: 3, y: 0, z: 0 }, [20, 0, 0]); // away from b
    a.hit('B');
    expect(seen.b.filter((e) => e.type === 'hit')).toHaveLength(0);
  });

  it('a hit with no shot first does nothing', async () => {
    const { a, b, seen } = await pair();
    b.pose(ship(0));
    a.pose(ship(3));
    a.hit('B');
    expect(seen.b.filter((e) => e.type === 'hit')).toHaveLength(0);
  });

  it('hits on a ship that is down or just back do nothing', async () => {
    const { a, b, seen } = await pair();
    b.pose(ship(0), { safe: true });
    a.pose(ship(3));
    a.shot({ x: 3, y: 0, z: 0 }, [0, 0, -20]);
    a.hit('B');
    expect(seen.b.filter((e) => e.type === 'hit')).toHaveLength(0);
  });

  it('credits the kill to whoever shot you down', async () => {
    const { a, b, seen } = await pair();
    lineUp(a, b);
    a.hit('B');
    b.down('A');
    expect(a.snapshot().self.kills).toBe(1);
    expect(b.peers.get('A').kills).toBe(1); // b saw it: it was a's hit
    expect(feeds(seen.a)).toContain('You shot down Rick');
    expect(feeds(seen.b)).toContain('Han shot you down');
    expect(seen.a.some((e) => e.type === 'downed' && e.id === 'B' && e.by === 'A')).toBe(true);
  });

  it('a kill handed to someone who never hit them is not believed', async () => {
    const { a, b, seen } = await pair();
    b.down('A'); // (b going down "by a", to pad a's score)
    expect(a.snapshot().self.kills).toBe(0);
    expect(seen.a.some((e) => e.type === 'downed' && e.id === 'B' && e.by === null)).toBe(true);
    expect(feeds(seen.a)).not.toContain('You shot down Rick');
  });

  it('a kill between two others counts if the killer was just firing, close by', async () => {
    const { a, b, c, seen, tick } = await pair({ three: true });
    lineUp(a, b);
    a.hit('B');
    b.down('A');
    expect(c.peers.get('A').kills).toBe(1);
    expect(feeds(seen.c)).toContain('Han shot down Rick');
    // and not once a has been quiet a while
    tick(10000);
    b.pose(ship(0));
    b.down('A');
    expect(c.peers.get('A').kills).toBe(1);
  });

  it('takes no one at their word on their own kills', async () => {
    const { a, bus } = await pair();
    const x = bus.room('X');
    x.makeAction('hi').send({ n: 'Ace', k: null, c: 999, w: '/universe' });
    expect(a.peers.get('X').kills).toBe(0);
  });

  it('mutes a pilot who floods the room', async () => {
    const { a, bus, seen } = await pair();
    const x = bus.room('X');
    x.makeAction('hi').send({ n: 'Spam', k: null, c: 0, w: '/universe' });
    const pose = x.makeAction('pose');
    for (let i = 0; i < 200; i++) pose.send([i, 0, 0, 0, 0, 0, 0, 0, 0, 100]);
    const p = a.peers.get('X');
    expect(p.blocked).toBe(true);
    expect(p.snaps.length).toBe(0);
    expect(feeds(seen.a)).toContain('Muted Spam: too many messages');
  });

  it('once turned down, they cannot ask again straight away', async () => {
    const { a, b, seen, tick } = await pair();
    a.ally('B', 'ask');
    b.ally('A', 'decline');
    expect(a.peers.get('B').ally).toBe('none');
    a.ally('B', 'ask');
    expect(b.peers.get('A').ally).toBe('none'); // turned away without a word to b
    expect(a.peers.get('B').ally).toBe('none');
    expect(feeds(seen.b).filter((t) => /wants to be allies/.test(t))).toHaveLength(1);
    tick(61000);
    a.ally('B', 'ask');
    expect(b.peers.get('A').ally).toBe('got');
  });

  it('keeps a pilot who sits still, and drops one who goes quiet', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { a, b, seen, tick } = await pair();
    const beat = () => {
      tick(15000);
      vi.advanceTimersByTime(15000);
    };
    for (let i = 0; i < 4; i++) beat(); // a minute of nothing but heartbeats
    expect(a.peers.has('B')).toBe(true);
    b.leave(); // a tab that froze: no goodbye
    for (let i = 0; i < 4; i++) beat();
    expect(a.peers.has('B')).toBe(false);
    expect(feeds(seen.a)).toContain('Rick went offline');
  });

  it('is online only once the room is listening, and says when it is out of reach', async () => {
    let listening;
    const r = { selfId: 'A', ready: new Promise((res) => (listening = res)), makeAction: () => ({ send: () => Promise.resolve() }), leave: () => Promise.resolve() };
    const c = createClient({ name: 'Han', load: () => Promise.resolve({ joinRoom: () => r }) });
    await flush();
    expect(c.snapshot().status).toBe('connecting');
    listening();
    await flush();
    expect(c.snapshot().status).toBe('online');
    r.onStatus('connecting');
    expect(c.snapshot().status).toBe('connecting');
    r.onStatus('online');
    expect(c.snapshot().status).toBe('online');
    c.leave();
  });

  it('fails when no relay answers', async () => {
    const r = { selfId: 'A', ready: Promise.reject(new Error('none')), makeAction: () => ({ send: () => Promise.resolve() }), leave: () => Promise.resolve() };
    const c = createClient({ name: 'Han', load: () => Promise.resolve({ joinRoom: () => r }) });
    await flush();
    expect(c.snapshot().status).toBe('failed');
    c.leave();
  });

  it('says so if it cannot connect', async () => {
    const c = createClient({ name: 'X', load: () => Promise.reject(new Error('offline')) });
    await flush();
    expect(c.snapshot().status).toBe('failed');
  });
});

// Han and Rick by their keys (a pilot's id online; allies.js keeps only
// those), each with a store of saved allies and blocks of their own, set up
// as asked before they meet
const HAN = 'a'.repeat(64);
const RICK = 'b'.repeat(64);
async function friends({ han = () => {}, rick = () => {} } = {}) {
  const bus = createBus();
  let t = 1000;
  const now = () => t;
  const stores = { han: createAllies({ saves: null, now }), rick: createAllies({ saves: null, now }) };
  han(stores.han);
  rick(stores.rick);
  const a = createClient({ name: 'Han', kind: 'falcon', load: bus.load(HAN), now, allies: stores.han });
  const b = createClient({ name: 'Rick', kind: 'cruiser', load: bus.load(RICK), now, allies: stores.rick });
  await flush();
  const seen = { a: [], b: [] };
  a.on((e) => seen.a.push(e));
  b.on((e) => seen.b.push(e));
  bus.meet();
  return { a, b, bus, seen, stores, tick: (ms) => (t += ms) };
}

describe('allies that last (allies.js)', () => {
  it('two saved allies are allies again after both say hello', async () => {
    const { a, b, seen } = await friends({ han: (s) => s.saveAlly(RICK, 'Rick'), rick: (s) => s.saveAlly(HAN, 'Han') });
    expect(a.peers.get(RICK).ally).toBe('ally');
    expect(b.peers.get(HAN).ally).toBe('ally');
    // nobody was asked, and an alliance made long ago isn't paid for again
    expect([...feeds(seen.a), ...feeds(seen.b)].some((t) => /wants to be allies/.test(t))).toBe(false);
    expect(feeds(seen.a)).toContain('You and Rick are allies again');
    expect(feeds(seen.b)).toContain('You and Han are allies again');
    expect([...seen.a, ...seen.b].some((e) => e.type === 'allied')).toBe(false);
  });

  it('one-sided: the other sees an ordinary request', async () => {
    const { a, b, seen, stores } = await friends({ han: (s) => s.saveAlly(RICK, 'Rick') });
    expect(a.peers.get(RICK).ally).toBe('sent');
    expect(b.peers.get(HAN).ally).toBe('got');
    expect(feeds(seen.b)).toContain('Han wants to be allies');
    b.ally(HAN, 'accept');
    expect(a.peers.get(RICK).ally).toBe('ally');
    // a new alliance for Rick (saved, and paid for); Han's was kept all along
    expect(stores.rick.isAlly(HAN)).toBe(true);
    expect(seen.b.filter((e) => e.type === 'allied')).toEqual([{ type: 'allied', id: HAN }]);
    expect(seen.a.filter((e) => e.type === 'allied')).toEqual([]);
  });

  it('a no forgets the ally', async () => {
    const { a, b, stores } = await friends({ han: (s) => s.saveAlly(RICK, 'Rick') });
    b.ally(HAN, 'decline');
    expect(a.peers.get(RICK).ally).toBe('none');
    expect(stores.han.isAlly(RICK)).toBe(false);
  });

  it('an alliance made is saved by both, and an end forgets it on both sides', async () => {
    const { a, b, stores } = await friends();
    expect(a.peers.get(RICK).ally).toBe('none'); // (strangers: nobody asks)
    a.ally(RICK, 'ask');
    b.ally(HAN, 'accept');
    expect(stores.han.allies()).toMatchObject([{ id: RICK, name: 'Rick' }]);
    expect(stores.rick.allies()).toMatchObject([{ id: HAN, name: 'Han' }]);
    b.ally(HAN, 'end');
    expect(stores.han.isAlly(RICK)).toBe(false);
    expect(stores.rick.isAlly(HAN)).toBe(false);
  });

  it('a blocked pilot’s hello starts blocked', async () => {
    const { a, b, stores, tick } = await friends({ han: (s) => s.block(RICK, 'Rick') });
    const p = a.peers.get(RICK);
    expect(p.blocked).toBe(true);
    expect(a.snapshot().peers).toMatchObject([{ id: RICK, blocked: true }]); // (listed, to be unblocked)
    b.pose(ship(4));
    expect(p.pose).toBeNull();
    a.block(RICK, false);
    expect(stores.han.isBlocked(RICK)).toBe(false);
    tick(120);
    b.pose(ship(5));
    expect(p.pose.x).toBe(5);
    // and a block made is saved, and ends a saved alliance
    a.ally(RICK, 'ask');
    b.ally(HAN, 'accept');
    a.block(RICK, true);
    expect(stores.han.isBlocked(RICK)).toBe(true);
    expect(stores.han.isAlly(RICK)).toBe(false);
    expect(stores.rick.isAlly(HAN)).toBe(false); // (they're told it's ended)
  });

  it('lists the saved allies who aren’t here as away, last seen as they went', async () => {
    const LEIA = 'c'.repeat(64);
    const { a, bus, seen, stores, tick } = await friends({
      han: (s) => {
        s.saveAlly(RICK, 'Rick');
        s.saveAlly(LEIA, 'Leia');
      },
      rick: (s) => s.saveAlly(HAN, 'Han'),
    });
    expect(a.snapshot().away).toEqual([{ id: LEIA, name: 'Leia', seen: 1000 }]);
    tick(5000);
    bus.gone(RICK);
    expect(a.snapshot().away).toEqual([
      { id: RICK, name: 'Rick', seen: 6000 },
      { id: LEIA, name: 'Leia', seen: 1000 },
    ]);
    // one taken off the list: the roster hears of it
    const before = seen.a.length;
    stores.han.dropAlly(LEIA);
    expect(seen.a.slice(before)).toContainEqual({ type: 'roster' });
    expect(a.snapshot().away.map((x) => x.id)).toEqual([RICK]);
  });

  it('a guest tab, or a new identity, doesn’t ask saved allies again: they don’t know the key it flies', async () => {
    const OLD = 'f'.repeat(64); // (the key Han flew when the alliance was made: the browser's own, or his before a new one)
    const { a, b, seen, stores } = await friends({ han: (s) => s.saveAlly(RICK, 'Rick', OLD), rick: (s) => s.saveAlly(OLD, 'Han') });
    expect(a.peers.get(RICK).ally).toBe('none');
    expect(b.peers.get(HAN).ally).toBe('none');
    expect(feeds(seen.b).some((t) => /wants to be allies/.test(t))).toBe(false);
    // asked for by hand: an ordinary request, and once made, kept for the key Han flies now
    a.ally(RICK, 'ask');
    expect(feeds(seen.b)).toContain('Han wants to be allies');
    b.ally(HAN, 'accept');
    expect(a.peers.get(RICK).ally).toBe('ally');
    expect(stores.han.madeAs(RICK)).toBe(HAN.slice(0, 16));
    expect(stores.han.allies()).toHaveLength(1);
  });

  it('a flood’s mute is for the visit: a saved alliance is kept, and they’re told nothing', async () => {
    const { a, b, bus, seen, stores } = await friends({ han: (s) => s.saveAlly(RICK, 'Rick'), rick: (s) => s.saveAlly(HAN, 'Han') });
    expect(a.peers.get(RICK).ally).toBe('ally');
    // Rick's ship floods Han's room
    const pose = bus.room(RICK).makeAction('pose');
    for (let i = 0; i < 200; i++) pose.send([i, 0, 0, 0, 0, 0, 0, 0, 0, 100]);
    expect(a.peers.get(RICK).blocked).toBe(true);
    expect(feeds(seen.a)).toContain('Muted Rick: too many messages');
    expect(stores.han.isAlly(RICK)).toBe(true);
    expect(stores.han.isBlocked(RICK)).toBe(false);
    expect(b.peers.get(HAN).ally).toBe('ally');
    expect(stores.rick.isAlly(HAN)).toBe(true);
  });

  it('going offline, the saved allies who were here were last seen then', async () => {
    const { a, stores, tick } = await friends({ han: (s) => s.saveAlly(RICK, 'Rick'), rick: (s) => s.saveAlly(HAN, 'Han') });
    tick(3000);
    a.leave();
    expect(stores.han.allies()).toMatchObject([{ id: RICK, seen: 4000 }]);
  });
});

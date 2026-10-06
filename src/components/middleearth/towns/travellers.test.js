import { describe, expect, it } from 'vitest';
import { QUIET_MS, createTravellers, readStep, writeStep } from './travellers';

// a room in memory: what one sends, the rest get
function fakeRelay() {
  const members = new Set();
  let n = 0;
  const joinRoom = () => {
    const id = `t${++n}`;
    const acts = {};
    const m = {
      selfId: id,
      ready: Promise.resolve(),
      makeAction(ns) {
        const a = { onMessage: null, send: (data) => members.forEach((o) => o !== m && o.deliver(ns, JSON.parse(JSON.stringify(data)), id)) };
        acts[ns] = a;
        return a;
      },
      deliver: (ns, data, from) => acts[ns]?.onMessage?.(data, { peerId: from }),
      leave() {
        members.delete(m);
        members.forEach((o) => o.onPeerLeave?.(id));
      },
    };
    members.add(m);
    return m;
  };
  return () => Promise.resolve(joinRoom);
}
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('steps', () => {
  it('go and come back, kept in bounds', () => {
    expect(readStep(writeStep({ x: 3.456, z: -2, face: 1, speed: 3 }, { ring: true }))).toEqual({ x: 3.46, z: -2, face: 1, moving: true, inside: false, ring: true, ride: false });
    expect(readStep([1e9, 0, 0], 50).x).toBe(50);
    expect(readStep(['a', 0, 0])).toBe(null);
  });

  it('carry how fast and how high, for a world where people run and jump, and not otherwise', () => {
    const step = readStep(writeStep({ x: 220, z: 170, face: 1, speed: 9.46, y: 1.234 }, { motion: true }), 260);
    expect(step).toMatchObject({ x: 220, z: 170, speed: 9.5, y: 1.23, moving: true });
    expect(writeStep({ x: 0, z: 0, face: 0, speed: 3 })).toHaveLength(5);
    expect(readStep(writeStep({ x: 0, z: 0, face: 0, speed: 3 }))).not.toHaveProperty('speed');
    expect(readStep([0, 0, 0, 1, 0, 999, -5]).speed).toBe(45);
    expect(readStep([0, 0, 0, 1, 0, 2, 999]).y).toBe(80);
    expect(readStep([0, 0, 0, 1, 0, 2, -5]).y).toBe(0);
  });
});

describe('travellers', () => {
  it('in a bigger town, are seen out as far as it goes (Albuquerque’s, out to its fence)', async () => {
    const load = fakeRelay();
    const now = () => 1000;
    const a = createTravellers({ town: 'abq', name: 'Heisenberg', load, now, bound: 440 });
    const b = createTravellers({ town: 'abq', name: 'Cap’n Cook', load, now, bound: 440 });
    await settle();
    await settle();
    a.pose({ x: 405.5, z: -390, face: -3, speed: 20 });
    expect(b.list()[0]).toMatchObject({ name: 'Heisenberg', x: 405.5, z: -390, moving: true });
  });

  it('see each other, by name, and lose those who go quiet or leave', async () => {
    const load = fakeRelay();
    let t = 1000;
    const now = () => t;
    const a = createTravellers({ town: 'bree', name: 'Rosie', load, now });
    const b = createTravellers({ town: 'bree', name: 'Fatty', load, now });
    await settle();
    await settle();
    a.pose({ x: 1, z: 2, face: 0, speed: 3 });
    b.pose({ x: -4, z: 5, face: 1, speed: 0 }, { inside: true });
    expect(b.list().map((p) => [p.name, p.x, p.z, p.moving])).toEqual([['Rosie', 1, 2, true]]);
    expect(a.list()[0]).toMatchObject({ name: 'Fatty', inside: true });
    // walking: a new pose a fifth of a second later
    t += 100;
    a.pose({ x: 1.5, z: 2, face: 0, speed: 3 });
    expect(b.list()[0].x).toBe(1);
    t += 150;
    a.pose({ x: 1.5, z: 2, face: 0, speed: 3 });
    expect(b.list()[0].x).toBe(1.5);
    // quiet: gone
    t += QUIET_MS + 10;
    expect(b.list()).toEqual([]);
    a.pose({ x: 2, z: 2, face: 0, speed: 0 });
    expect(b.list()).toHaveLength(1);
    a.leave();
    expect(b.list()).toEqual([]);
    b.leave();
  });

  it('send a pose at once when asked (going indoors), and run and jump in a wide world', async () => {
    const load = fakeRelay();
    let t = 1000;
    const now = () => t;
    const a = createTravellers({ town: 'avengers', name: 'Peter', load, now, bound: 260, motion: true });
    const b = createTravellers({ town: 'avengers', name: 'Ned', load, now, bound: 260, motion: true });
    await settle();
    await settle();
    a.pose({ x: 230, z: 175, face: 0, speed: 9.5, y: 1.5 });
    expect(b.list()[0]).toMatchObject({ x: 230, z: 175, speed: 9.5, y: 1.5 });
    t += 20;
    a.pose({ x: 230, z: 175, face: 0, speed: 0, y: 0 }, { inside: true });
    expect(b.list()[0].inside).toBe(false);
    a.pose({ x: 230, z: 175, face: 0, speed: 0, y: 0 }, { inside: true }, { force: true });
    expect(b.list()[0].inside).toBe(true);
    a.leave();
    b.leave();
  });

  it('leave out anyone the roster has blocked, and bring them back once they’re not', async () => {
    const load = fakeRelay();
    const now = () => 1000;
    const blocked = new Set();
    const a = createTravellers({ town: 'bree', name: 'Rosie', load, now });
    const b = createTravellers({ town: 'bree', name: 'Fatty', load, now, hidden: (id) => blocked.has(id) });
    await settle();
    await settle();
    a.pose({ x: 1, z: 2, face: 0, speed: 3 });
    const [rosie] = b.list();
    expect(rosie.name).toBe('Rosie');
    blocked.add(rosie.id);
    expect(b.list()).toEqual([]);
    blocked.delete(rosie.id);
    expect(b.list()).toHaveLength(1);
    a.leave();
    b.leave();
  });

  it('see only those in the same area of a world, each area its own ground', async () => {
    const load = fakeRelay();
    let t = 1000;
    const now = () => t;
    const a = createTravellers({ town: 'c-137', name: 'Morty', load, now });
    const b = createTravellers({ town: 'c-137', name: 'Summer', load, now });
    await settle();
    await settle();
    a.pose({ x: 1, z: 2, face: 0, speed: 0 }, { area: 'street' });
    b.pose({ x: 5, z: 5, face: 0, speed: 0 }, { area: 'street' });
    expect(b.list().map((p) => p.name)).toEqual(['Morty']);
    expect(a.list().map((p) => p.name)).toEqual(['Summer']);
    // Morty goes in: a new area goes out at once, and the street loses him
    t += 10;
    a.pose({ x: 1, z: 2, face: 0, speed: 0 }, { area: 'arcade' });
    expect(b.list()).toEqual([]);
    expect(a.list()).toEqual([]);
    // and a world without areas sees everyone without one
    t += 2000;
    a.pose({ x: 1, z: 2, face: 0, speed: 0 });
    b.pose({ x: 5, z: 5, face: 0, speed: 0 });
    expect(b.list()).toHaveLength(1);
    a.leave();
    b.leave();
  });
});

describe('steps riding something', () => {
  it('say so (a car, a ship, a cruiser in the air), apart from the Ring', () => {
    expect(readStep(writeStep({ x: 0, z: 0, face: 0 }, { ride: true }))).toMatchObject({ ride: true, ring: false, inside: false });
    expect(readStep(writeStep({ x: 0, z: 0, face: 0 }, { ring: true }))).toMatchObject({ ride: false, ring: true });
  });
});

describe('steps with an area', () => {
  it('carry it, cleaned, and leave a step without one as it was', () => {
    expect(readStep(writeStep({ x: 1, z: 2, face: 0, speed: 0 }, { area: 'arcade' }))).toMatchObject({ x: 1, z: 2, area: 'arcade' });
    expect(readStep(writeStep({ x: 1, z: 2, face: 0, speed: 3, y: 4 }, { motion: true, area: 'sky' }))).toMatchObject({ speed: 3, y: 4, area: 'sky' });
    expect(readStep([0, 0, 0, 0, 0, 0, 0, '<script>'])).not.toHaveProperty('area');
    expect(readStep([0, 0, 0, 0, 0, 0, 0, 'x'.repeat(40)])).not.toHaveProperty('area');
    expect(writeStep({ x: 0, z: 0, face: 0 })).toHaveLength(5);
  });
});

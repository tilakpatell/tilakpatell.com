import { describe, expect, it } from 'vitest';
import { SHARED_KEYS, createSharedWorld } from './shared';
import { TERRAIN_VERSION } from '../../../lib/land/flight/planetSpec';
import { BOLT, TURRET } from './turretRules';

const flush = () => new Promise((r) => setTimeout(r, 0));
const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

// the loader as lib/durable's createEntityLoader answers, its events by hand
function fakeLoader() {
  const l = { listeners: new Set(), held: new Map(), placed: [], removed: [], damaged: [], refetched: [], updates: 0 };
  Object.assign(l, {
    on: (fn) => (l.listeners.add(fn), () => l.listeners.delete(fn)),
    emit: (e) => {
      if (e.type === 'remove') l.held.delete(e.id);
      else if (e.entity) l.held.set(e.entity.id, e.entity);
      l.listeners.forEach((fn) => fn(e));
    },
    update: () => l.updates++,
    all: () => [...l.held.values()],
    get: (id) => l.held.get(id) ?? null,
    refetch: (key) => l.refetched.push(key),
    async place(e) {
      l.placed.push(e);
      const entity = { id: ID, owner: 'me', ...e };
      l.emit({ type: 'add', entity });
      return entity;
    },
    async remove(id) {
      l.removed.push(id);
      l.emit({ type: 'remove', id });
      return true;
    },
    async damage(id, amount) {
      l.damaged.push([id, amount]);
      return 92;
    },
    dispose: () => {},
  });
  return l;
}
function fakeOnline() {
  const o = { sent: [], listeners: new Set(), list: [] };
  Object.assign(o, {
    status: 'online',
    update: () => {},
    peers: () => o.list,
    shot: (p, v) => o.sent.push(['shot', p, v]),
    built: (id, cell) => o.sent.push(['built', id, cell]),
    gone: (id) => o.sent.push(['gone', id]),
    cell: () => 'hoth/0,0',
    selfId: () => 'n-me',
    on: (fn) => (o.listeners.add(fn), () => o.listeners.delete(fn)),
    hear: (e) => o.listeners.forEach((fn) => fn(e)),
    stats: () => ({}),
    leave: () => (o.left = true),
  });
  return o;
}
function fakeDraw() {
  const d = { structures: new Map(), aims: new Map(), peers: [], bolts: [] };
  return Object.assign(d, {
    makeStructures: () => ({ set: (e) => d.structures.set(e.id, e), remove: (id) => d.structures.delete(id), has: (id) => d.structures.has(id), aim: (id, y, p) => d.aims.set(id, [y, p]), draw: () => {}, count: () => d.structures.size, dispose: () => {} }),
    makePeers: () => ({ draw: (list) => (d.peers = list), count: () => d.peers.length, dispose: () => {} }),
    makeBolts: () => ({ draw: (list) => (d.bolts = list), dispose: () => {} }),
  });
}

const hoth = { id: 'hoth', pois: [{ id: 'echo-base', name: 'Echo Base', at: [1200, -800], r: 220, edge: 160, h: 12 }] };
const low = (extra = {}) => ({ x: 0, y: 20, z: 0, pitch: 0, yaw: 0, roll: 0, speed: 60, ...extra });
const snap = (pressed = [], held = []) => ({ pressed: new Set(pressed), action: (name) => held.includes(name) });

function world({ durable = true, loader = fakeLoader(), online = fakeOnline(), groundAt = () => 0, spec = hoth } = {}) {
  const draw = fakeDraw();
  const told = [];
  let respawned = 0;
  const shared = createSharedWorld({
    parent: null,
    spec,
    palette: [],
    groundAt,
    tell: (type, data) => told.push([type, data]),
    respawn: () => respawned++,
    durable: durable ? {} : null,
    makeLoader: () => loader,
    makeOnline: () => online,
    signIn: async () => 'me',
    ...draw,
  });
  shared.join('Alpha');
  const toasts = () => told.filter(([t]) => t === 'toast').map(([, d]) => d.text);
  return { shared, loader, online, draw, told, toasts, respawns: () => respawned };
}

describe('the shared world’s keys', () => {
  it('are B to build, X to take down and Space to fire', () => {
    expect(SHARED_KEYS).toEqual({ build: ['KeyB'], unbuild: ['KeyX'], fire: ['Space'] });
  });
});

describe('building', () => {
  it('places a turret on the ground under the ship, on this ground’s version, then hints its cell', async () => {
    const w = world();
    await flush();
    w.shared.step(0.016, low(), snap(['KeyB']));
    await flush();
    expect(w.loader.placed).toHaveLength(1);
    expect(w.loader.placed[0]).toMatchObject({ type: 'turret', x: 0, y: 0, z: 0, hp: 100, terrainVersion: TERRAIN_VERSION, metadata: { pilot: 'Alpha', by: 'n-me' } });
    expect(w.online.sent).toContainEqual(['built', ID, 'hoth/0,0']);
    expect(w.toasts()).toEqual(['Turret built.']);
    expect(w.draw.structures.has(ID)).toBe(true);
  });

  it('says why not, and places nothing, too high', async () => {
    const w = world();
    await flush();
    w.shared.step(0.016, low({ y: 400 }), snap(['KeyB']));
    await flush();
    expect(w.loader.placed).toHaveLength(0);
    expect(w.toasts()[0]).toMatch(/under 60 m/);
  });

  it('builds nothing on a cloud deck, whose ground is fog', async () => {
    const w = world({ spec: { id: 'bespin', pois: [], soft: true } });
    await flush();
    w.shared.step(0.016, low(), snap(['KeyB']));
    await flush();
    expect(w.loader.placed).toHaveLength(0);
    expect(w.toasts()).toEqual(['Nothing stands on a cloud deck.']);
  });

  it('with no durable layer, says so once and builds a turret of this visit’s own', async () => {
    const w = world({ durable: false });
    await flush();
    w.shared.step(0.016, low(), snap(['KeyB']));
    w.shared.step(0.016, low({ x: 100 }), snap(['KeyB']));
    await flush();
    expect(w.toasts()).toEqual(['Nothing is kept on this build.', 'Turret built.']);
    expect(w.draw.structures.size).toBe(2);
    // and X takes your own down
    w.shared.step(0.016, low({ x: 100 }), snap(['KeyX']));
    await flush();
    expect(w.draw.structures.size).toBe(1);
  });

  it('takes your own nearest down with X, and hints it gone', async () => {
    const w = world();
    await flush();
    w.shared.step(0.016, low(), snap(['KeyB']));
    await flush();
    w.shared.step(0.016, low({ x: 10 }), snap(['KeyX']));
    await flush();
    expect(w.loader.removed).toEqual([ID]);
    expect(w.online.sent).toContainEqual(['gone', ID]);
    expect(w.draw.structures.has(ID)).toBe(false);
  });
});

describe('what others build', () => {
  it('a built hint asks the loader for that cell again (the loader ignores a cell it doesn’t hold)', async () => {
    const w = world();
    await flush();
    w.online.hear({ type: 'built', id: ID, cell: 'hoth/4,4', key: '4,4' });
    expect(w.loader.refetched).toEqual(['4,4']);
  });

  it('a turret worn to nothing by someone else leaves, its slot let go of', async () => {
    const w = world();
    await flush();
    w.loader.emit({ type: 'add', entity: { id: 't1', type: 'turret', owner: 'you', x: 0, y: 0, z: -300, rot: [0, 0, 0], hp: 100, terrainVersion: TERRAIN_VERSION } });
    expect(w.draw.structures.has('t1')).toBe(true);
    w.loader.emit({ type: 'remove', id: 't1' });
    expect(w.draw.structures.has('t1')).toBe(false);
  });

  it('a thing built on an older ground is drawn on the ground there is now', async () => {
    const w = world({ groundAt: () => 40 });
    await flush();
    w.loader.emit({ type: 'add', entity: { id: 'old', type: 'beacon', owner: 'you', x: 5, y: 2, z: 5, rot: [0, 0, 0], terrainVersion: TERRAIN_VERSION - 1 } });
    w.loader.emit({ type: 'add', entity: { id: 'new', type: 'beacon', owner: 'you', x: 5, y: 2, z: 5, rot: [0, 0, 0], terrainVersion: TERRAIN_VERSION } });
    expect(w.draw.structures.get('old').y).toBe(40);
    expect(w.draw.structures.get('new').y).toBe(2);
  });
});

describe('turrets', () => {
  const theirs = { id: 't1', type: 'turret', owner: 'you', x: 0, y: 0, z: -200, rot: [0, Math.PI, 0], hp: 100, metadata: { by: 'n-you' }, terrainVersion: TERRAIN_VERSION };

  it('fire at your ship, and their bolts wear your shield down till you’re put back up', async () => {
    const w = world();
    await flush();
    w.loader.emit({ type: 'add', entity: theirs });
    // the ship hangs at the barrel’s height, straight down its line
    const ship = low({ y: TURRET.height, speed: 40 });
    for (let i = 0; i < 60 * 60 && !w.respawns(); i++) w.shared.step(1 / 60, ship, snap());
    expect(w.respawns()).toBe(1);
    expect(w.toasts().at(-1)).toMatch(/^Shot down/);
  });

  it('never fire at their owner', async () => {
    const w = world();
    await flush();
    w.loader.emit({ type: 'add', entity: { ...theirs, owner: 'me' } });
    for (let i = 0; i < 600; i++) w.shared.step(1 / 60, low({ y: TURRET.height }), snap());
    expect(w.shared.stats().bolts).toBe(0);
    expect(w.respawns()).toBe(0);
  });

  it('take your bolts’ damage through the database', async () => {
    const w = world();
    await flush();
    w.loader.emit({ type: 'add', entity: { ...theirs, z: -100 } });
    // nose at it (yaw 0 is −z), Space held a while
    for (let i = 0; i < 30; i++) w.shared.step(1 / 60, low({ y: TURRET.height, speed: 40 }), snap([], ['fire']));
    await flush();
    expect(w.loader.damaged.length).toBeGreaterThan(0);
    expect(w.loader.damaged[0]).toEqual(['t1', TURRET.damage]);
    expect(w.online.sent.some(([t]) => t === 'shot')).toBe(true);
    expect(BOLT.speed).toBeGreaterThan(0);
  });
});

describe('the other pilots', () => {
  it('are drawn from the room’s peers each frame', async () => {
    const w = world();
    await flush();
    w.online.list = [{ id: 'b', name: 'Bravo', pose: { x: 1, y: 2, z: 3, pitch: 0, yaw: 0, roll: 0, speed: 100 } }];
    w.shared.step(0.016, low(), snap());
    w.shared.draw([0, 0, 0]);
    expect(w.draw.peers.map((p) => p.id)).toEqual(['b']);
  });

  it('give the map the pilots near you and what’s built round you', async () => {
    const w = world();
    await flush();
    w.online.list = [{ id: 'b', name: 'Bravo', pose: { x: 1, y: 2, z: 3, pitch: 0, yaw: 0, roll: 0, speed: 100 } }];
    w.loader.emit({ type: 'add', entity: { id: 't1', type: 'turret', owner: 'you', x: 5, y: 0, z: 6, rot: [0, 0, 0], hp: 100, terrainVersion: TERRAIN_VERSION } });
    expect(w.shared.pilots().map((p) => [p.id, p.name, p.pose.x])).toEqual([['b', 'Bravo', 1]]);
    expect(w.shared.built().map((e) => [e.id, e.type, e.x, e.z])).toEqual([['t1', 'turret', 5, 6]]);
    w.shared.join(null);
    expect(w.shared.pilots()).toEqual([]);
  });

  it('go when you leave the room', async () => {
    const w = world();
    await flush();
    w.shared.join(null);
    expect(w.online.left).toBe(true);
  });
});

describe('a world nothing may be built on', () => {
  const generated = { id: 'e:3,-2:0:1', pois: [], buildable: false };

  it('says so, and places nothing, kept or not', async () => {
    const w = world({ spec: generated });
    await flush();
    w.shared.step(0.016, low(), snap(['KeyB']));
    await flush();
    expect(w.loader.placed).toHaveLength(0);
    expect(w.toasts()).toEqual(['Nothing can be built on this world.']);
    expect(w.draw.structures.size).toBe(0);
  });

  it('never reaches the durable world: no loader, nothing held', async () => {
    const w = world({ spec: generated });
    await flush();
    w.shared.step(0.016, low(), snap());
    expect(w.loader.updates).toBe(0);
    expect(w.shared.prompt(low())).toMatchObject({ build: false, unbuild: false, kept: false });
    expect(w.shared.built()).toEqual([]);
  });

  it('keeps the room: shots still go out', async () => {
    const w = world({ spec: generated });
    await flush();
    w.shared.step(0.016, low(), snap([], ['fire']));
    expect(w.online.sent.some(([t]) => t === 'shot')).toBe(true);
  });
});

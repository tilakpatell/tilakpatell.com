import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { STALE_MS, TRIP_HOLD_MS } from './protocol';
import * as glsl from './pilots';
import * as nodes from './pilotsNodes';

// (pilots.bodies.test.js's fakes: the ships as plain groups, no model fetched)
const stubShip = () => ({ group: new THREE.Group(), pivot: new THREE.Object3D(), dispose() {}, paint() {}, outfit() {}, park() {}, dress() {}, mount: () => false, update() {}, setThrottle() {}, drive() {} });
vi.mock('../shipModels', () => ({ SHIP_MODELS: {}, buildShip: () => stubShip() }));
vi.mock('../shipModelsNodes', () => ({ SHIP_MODELS: {}, buildShip: () => stubShip() }));
vi.mock('../../../lib/three/gltf', () => ({ gltfLoader: () => ({ loadAsync: () => Promise.reject(new Error('no network in a test')) }) }));
import { HUNTER_KINDS } from '../hunterRules';
import { STOCK_LOADOUT } from '../outfit';

const fakeFleet = () => ({
  want: vi.fn(),
  loaded: () => false,
  make: (kind) => ({ kind, group: new THREE.Group(), size: new THREE.Vector3(1, 1, 1), fit: 1, update() {}, dispose: vi.fn() }),
});
// a pilot told of twice, at 0 and 100 ms, flying along x at 6, then heard no more
const snaps = (extra = {}) => [0, 100].map((at) => ({ at, x: at * 0.006, y: 0, z: -5, heading: 0, pitch: 0, bank: 0, speed: 6, vy: 0, hidden: false, safe: false, shield: 100, ...extra }));
const peer = (id, extra = {}) => ({ id, kind: 'xwing', name: id, snaps: snaps(), ally: 'none', hitAt: -Infinity, loadout: STOCK_LOADOUT, ...extra });
const client = (...peers) => ({ peers: new Map(peers.map((p) => [p.id, p])), takeShots: () => [] });
// (both paints: the GLSL pilots and the node renderer's)
describe.each([
  ['GLSL', glsl],
  ['nodes', nodes],
])('a trip to another pilot, through a gap in what’s heard of them (%s)', (_, { createPilots }) => {
  const make = () => createPilots(new THREE.Group(), { fleet: fakeFleet(), kinds: HUNTER_KINDS });

  it('keeps where they were last seen for the trip a while after their ship is hidden', () => {
    const pilots = make();
    const c = client(peer('ann'));
    pilots.update(1 / 60, 150, c, null);
    expect(pilots.pose('ann')).toMatchObject({ name: 'ann', z: -5 });
    // (unheard past STALE_MS: a frame of this page or theirs a few seconds
    // long in software, or the network, and they're hidden, as before)
    const later = 100 + STALE_MS + 1500;
    pilots.update(1 / 60, later, c, null);
    expect(pilots.bodies.find((b) => b.id === 'ann')).toBeUndefined();
    // but the trip to them goes on, to where they were
    expect(pilots.pose('ann')).toMatchObject({ name: 'ann', z: -5 });
    pilots.dispose();
  });

  it('lets go of them once they’ve been unheard longer than the hold', () => {
    const pilots = make();
    const c = client(peer('bo'));
    pilots.update(1 / 60, 150, c, null);
    pilots.update(1 / 60, 150 + TRIP_HOLD_MS + 1, c, null);
    expect(pilots.pose('bo')).toBeNull();
    pilots.dispose();
  });

  it('lets go at once of a pilot who’s gone (offline, out of the room) or hidden', () => {
    const pilots = make();
    const c = client(peer('cy'), peer('di'));
    pilots.update(1 / 60, 150, c, null);
    c.peers.delete('cy');
    c.peers.get('di').snaps = snaps({ hidden: true });
    pilots.update(1 / 60, 200, c, null);
    expect(pilots.pose('cy')).toBeNull();
    expect(pilots.pose('di')).toBeNull();
    pilots.dispose();
  });

  it('lets go at once of a pilot who’s come down on a planet', () => {
    const pilots = make();
    const c = client(peer('ed'));
    pilots.update(1 / 60, 150, c, null);
    c.peers.get('ed').foot = { at: 190, planet: 'home', ship: { n: [0, 1, 0], f: [0, 0, -1] } };
    pilots.update(1 / 60, 200, c, null);
    expect(pilots.pose('ed')).toBeNull();
    pilots.dispose();
  });

  it('holds for less time than a peer takes to be dropped from the room, and more than a slow frame', () => {
    expect(TRIP_HOLD_MS).toBeGreaterThan(STALE_MS * 3);
    expect(TRIP_HOLD_MS).toBeLessThanOrEqual(20000);
  });
});

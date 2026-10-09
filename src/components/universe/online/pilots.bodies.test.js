import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createPilots } from './pilots';

// the ships as plain groups (shipModels' are painted on a canvas, which Node
// has none of), and no model ever fetched
vi.mock('../shipModels', () => ({
  SHIP_MODELS: {},
  buildShip: () => ({ group: new THREE.Group(), pivot: new THREE.Object3D(), dispose() {}, paint() {}, outfit() {}, park() {}, dress() {}, mount: () => false, update() {}, setThrottle() {}, drive() {} }),
}));
vi.mock('../../../lib/three/gltf', () => ({ gltfLoader: () => ({ loadAsync: () => Promise.reject(new Error('no network in a test')) }) }));
import { HUNTER_KINDS } from '../hunterRules';
import { STOCK_LOADOUT } from '../outfit';

// a fleet as glbFleet.js is one, its models only groups (hunters.test.js's)
const fakeFleet = () => ({
  want: vi.fn(),
  loaded: () => false,
  make: (kind) => ({ kind, group: new THREE.Group(), size: new THREE.Vector3(1, 1, 1), fit: 1, update() {}, dispose: vi.fn() }),
});
// a pilot flying along x at 6, told of twice
const snaps = (x) => [0, 100].map((at) => ({ at, x: x + at * 0.006, y: 0, z: -5, heading: 0, pitch: 0, bank: 0, speed: 6, vy: 0, hidden: false, safe: false, shield: 100 }));
const peer = (id, extra = {}) => ({ id, kind: 'xwing', name: id, snaps: snaps(0), ally: 'none', hitAt: -Infinity, loadout: STOCK_LOADOUT, ...extra });
const client = (...peers) => ({ peers: new Map(peers.map((p) => [p.id, p])), takeShots: () => [] });
const flown = (pilots, c, frames = 2) => {
  for (let i = 0; i < frames; i++) pilots.update(1 / 60, 150 + i * 16, c, null);
};

describe('the pilots online, as bodies for ship contact', () => {
  it('answers a pilot flying here, a ram on them no hit of the scene’s (it’s told them over the wire)', () => {
    const pilots = createPilots(new THREE.Group(), { fleet: fakeFleet(), kinds: HUNTER_KINDS });
    const c = client(peer('ann'), peer('bo', { ally: 'ally' }));
    flown(pilots, c);
    const bodies = pilots.bodies;
    const ann = bodies.find((b) => b.id === 'ann');
    expect(ann).toMatchObject({ key: 'p:ann', kind: 'xwing', side: 'pilot', size: 0.3 });
    expect(Object.keys(ann.prev).filter((k) => 'xyz'.includes(k))).toHaveLength(3);
    expect(ann.hit(3)).toBeNull();
    expect(bodies.find((b) => b.id === 'bo').side).toBe('friend');
    pilots.dispose();
  });

  it('leaves out a pilot whose ship is parked on a planet, their crew out walking', () => {
    const pilots = createPilots(new THREE.Group(), { fleet: fakeFleet(), kinds: HUNTER_KINDS });
    const c = client(peer('cy', { foot: { at: 150, planet: 'home', ship: { n: [0, 1, 0], f: [0, 0, -1] } } }));
    flown(pilots, c);
    expect(pilots.bodies.filter((b) => b.side !== 'foe')).toEqual([]);
    pilots.dispose();
  });

  it('answers the hunters after another pilot as foes, a ram on one counted as a shot’s hit is', () => {
    const pilots = createPilots(new THREE.Group(), { fleet: fakeFleet(), kinds: HUNTER_KINDS });
    const c = client(peer('di', { hunters: { at: 150, list: [{ id: 5, kind: 'tie', x: 1, y: 0, z: -2, vx: 0, vy: 0, vz: 8, hp: 1 }] } }));
    flown(pilots, c);
    const g = pilots.bodies.find((b) => b.side === 'foe');
    expect(g).toMatchObject({ key: 'g:di:5', kind: 'tie', size: 0.3 });
    const r = g.hit(1);
    expect(r).toMatchObject({ id: 'di', hunter: 5, kind: 'tie', down: true });
    expect(pilots.bodies.filter((b) => b.side === 'foe')).toEqual([]); // (off the sky until its pilot says)
    pilots.dispose();
  });
});

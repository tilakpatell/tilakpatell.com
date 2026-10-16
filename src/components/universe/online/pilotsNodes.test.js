import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import * as glsl from './pilots';
import * as nodes from './pilotsNodes';
import { STOCK_LOADOUT } from '../outfit';
import { HUNTER_KINDS } from '../hunterRules';

// the ships as plain groups (shipModels' are painted on a canvas, which Node
// has none of), the same stub on both sides, and no model ever fetched
const stubShip = () => ({ group: new THREE.Group(), pivot: new THREE.Object3D(), dispose() {}, paint() {}, outfit() {}, park() {}, dress() {}, mount: () => false, update() {}, setThrottle() {}, drive() {} });
vi.mock('../shipModels', () => ({ SHIP_MODELS: {}, buildShip: () => stubShip() }));
vi.mock('../shipModelsNodes', () => ({ SHIP_MODELS: {}, buildShip: () => stubShip() }));
vi.mock('../../../lib/three/gltf', () => ({ gltfLoader: () => ({ loadAsync: () => Promise.reject(new Error('no network in a test')) }) }));

const FLAGS = ['transparent', 'blending', 'side', 'depthWrite', 'depthTest', 'toneMapped'];
const flags = (m) => Object.fromEntries(FLAGS.map((k) => [k, m[k]]));

const fleet = () => ({ want() {}, loaded: () => false, make: (kind) => ({ kind, group: new THREE.Group(), size: new THREE.Vector3(1, 1, 1), fit: 1, update() {}, dispose() {} }) });
const snaps = (x) => [0, 100].map((at) => ({ at, x: x + at * 0.006, y: 0, z: -5, heading: 0, pitch: 0, bank: 0, speed: 6, vy: 0, hidden: false, safe: false, shield: 100 }));
const peer = (id, extra = {}) => ({ id, kind: 'xwing', name: id, snaps: snaps(0), ally: 'none', hitAt: -Infinity, loadout: STOCK_LOADOUT, ...extra });
// their shots: a blaster bolt, a spread and a heavy round
const shots = () => [
  { p: [0, 0, 0], v: [0, 0, -20], kind: 'xwing', paint: 'stock', w: 0 },
  { p: [1, 0, 0], v: [0, 0, -20], kind: 'tie', paint: 'stock', w: 1 },
  { p: [2, 0, 0], v: [0, 0, -20], kind: 'xwing', paint: 'stock', w: 2 },
];

const make = (P) => {
  const parent = new THREE.Group();
  const pilots = P.createPilots(parent, { colors: { xwing: '#ff4a3d', tie: '#4aff6a' }, fleet: fleet(), kinds: HUNTER_KINDS });
  let fired = false;
  const client = {
    peers: new Map([peer('ann'), peer('di', { hunters: { at: 150, list: [{ id: 5, kind: 'tie', x: 1, y: 0, z: -2, vx: 0, vy: 0, vz: 8, hp: 1 }] } })].map((p) => [p.id, p])),
    takeShots: () => (fired ? [] : ((fired = true), shots())),
  };
  for (let i = 0; i < 3; i++) pilots.update(1 / 60, 150 + i * 16, client, null);
  return { parent, pilots };
};

describe('pilotsNodes, the twin of pilots', () => {
  it('exports what pilots exports, the same size', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
    expect(nodes.SIZE).toBe(glsl.SIZE);
  });

  it('builds the same objects, each bolt under a node material with the same flags and colour', () => {
    const a = make(glsl);
    const n = make(nodes);
    const kids = (w) => w.parent.children;
    expect(kids(n).map((o) => o.type)).toEqual(kids(a).map((o) => o.type));
    kids(n).forEach((o, i) => {
      const b = kids(a)[i];
      expect(o.visible).toBe(b.visible);
      expect(o.position.toArray()).toEqual(b.position.toArray());
      expect(o.scale.toArray()).toEqual(b.scale.toArray());
      if (!o.isMesh) return;
      expect(o.material.isNodeMaterial).toBe(true);
      expect(flags(o.material)).toEqual(flags(b.material));
      expect(o.material.color.toArray()).toEqual(b.material.color.toArray());
    });
    expect(kids(n).filter((o) => o.isMesh && o.visible)).toHaveLength(7); // (one, five in a fan, one heavy)
  });

  it('answers the same for the guns, the hits and the chart', () => {
    const a = make(glsl);
    const n = make(nodes);
    const plain = (x) => JSON.parse(JSON.stringify(x));
    expect(plain(n.pilots.targets)).toEqual(plain(a.pilots.targets));
    expect(plain(n.pilots.chart)).toEqual(plain(a.pilots.chart));
    expect(n.pilots.count).toBe(a.pilots.count);
    const from = new THREE.Vector3(0.9, 0, 0);
    const to = new THREE.Vector3(0.9, 0, -10);
    expect(plain(n.pilots.hit(from, to))).toEqual(plain(a.pilots.hit(from, to)));
  });

  it('takes everything away again', () => {
    const { parent, pilots } = make(nodes);
    pilots.dispose();
    expect(parent.children).toHaveLength(0);
  });
});

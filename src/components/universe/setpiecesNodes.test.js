import * as THREE from 'three';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as glsl from './setpieces';
import * as nodes from './setpiecesNodes';

const FLAGS = ['transparent', 'blending', 'side', 'depthWrite', 'depthTest', 'toneMapped', 'premultipliedAlpha', 'forceSinglePass', 'fog', 'opacity'];
const flags = (m) => Object.fromEntries(FLAGS.map((k) => [k, m[k]]));
const plain = (v) => (v?.toArray ? v.toArray() : v);

// (a canvas to paint the glow on, in node: the test only needs it to take the calls)
beforeAll(() => {
  const g = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} };
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => g }) });
});
afterAll(() => vi.unstubAllGlobals());
afterEach(() => vi.restoreAllMocks());

// a fleet that makes a plain box for any ship (its materials are the fleet's, not the set pieces')
const fleet = () => ({
  loaded: () => true,
  want() {},
  make: () => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 1), new THREE.MeshBasicMaterial()));
    group.userData.fleet = true;
    return { group, model: true, update() {}, dispose() {} };
  },
});

// what's drawn, as plain numbers: each thing's kind, flags, place and uniforms
const snap = (root) => {
  const out = [];
  root.updateWorldMatrix(true, true);
  const walk = (o) => {
    if (o.userData.fleet) return;
    if (o.material) {
      const u = o.material.uniforms ?? {};
      out.push({
        type: o.type,
        node: Boolean(o.material.isNodeMaterial),
        flags: flags(o.material),
        at: [o.renderOrder, o.visible, o.frustumCulled],
        matrix: o.matrixWorld.toArray().map((x) => +x.toFixed(9)),
        color: o.material.uniforms ? null : (o.material.color?.toArray() ?? null), // (a shader’s colour is its uniforms)
        uniforms: Object.fromEntries(Object.keys(u).map((k) => [k, plain(u[k].value)])),
      });
    }
    o.children.forEach(walk);
  };
  walk(root);
  return out;
};

// a seeded Math.random, the same draws on both sides
let seed = 7;
// (spied on before the set pieces are made, so the capital's rules take it;
// seeded again after, as a node's making draws on Math.random for its uuid)
const seeded = () => {
  seed = 7;
  vi.spyOn(Math, 'random').mockImplementation(() => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646);
};

const run = (S) => {
  seeded();
  const parent = new THREE.Group();
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(3, 4, 30);
  camera.lookAt(0, 0, 0);
  const pieces = S.createSetPieces(parent, { fleet: fleet(), solids: () => [] });
  const ship = { x: 0, y: 0, z: 400, heading: 0, speed: 3 }; // (well clear of the sun, so the rift opens)
  seed = 7;
  const said = [pieces.destroyer(ship), pieces.roadblock(ship), pieces.rift(ship), pieces.flare({ at: [0, 0, -60], r: 6, color: '#ffcc88' }, ship)];
  pieces.portals([new THREE.Vector3(1, 2, 3), new THREE.Vector3(-4, 0, 2)]);
  pieces.comet(ship);
  const steps = [];
  for (let i = 0; i < 40; i++) {
    const busy = pieces.update(0.1, i * 0.1, camera, ship);
    if (i % 4 === 0) steps.push([busy, snap(parent), pieces.targets.length]);
  }
  return { parent, pieces, said, steps };
};

describe('setpiecesNodes, the twin of setpieces', () => {
  it('exports what setpieces exports, where a capital ship drops in the same', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
    expect(nodes.STAR_DESTROYER).toBe(glsl.STAR_DESTROYER);
    const planet = { at: [0, 0, 0], r: 40 };
    for (const side of [-1, 1]) {
      expect(nodes.destroyerSpot({ x: 0, y: 14, z: 90, heading: 0.3 }, side, [planet])).toEqual(glsl.destroyerSpot({ x: 0, y: 14, z: 90, heading: 0.3 }, side, [planet]));
      expect(nodes.destroyerSpot({ x: 5, y: 0, z: 1000, heading: 2 }, side)).toEqual(glsl.destroyerSpot({ x: 5, y: 0, z: 1000, heading: 2 }, side));
    }
  });

  it('plays every set piece under node materials, the same flags, uniforms and places, frame by frame', () => {
    const a = run(glsl);
    const n = run(nodes);
    expect(JSON.parse(JSON.stringify(n.said))).toEqual(JSON.parse(JSON.stringify(a.said)));
    n.steps.forEach(([busy, list, targets], i) => {
      const [busyA, listA, targetsA] = a.steps[i];
      expect([busy, targets]).toEqual([busyA, targetsA]);
      expect(list.every((o) => o.node)).toBe(true);
      // (what's drawn alike, but the material's kind)
      const bare = (l) => l.map((o) => ({ ...o, node: null }));
      expect(bare(list)).toEqual(bare(listA));
    });
    expect(Boolean(n.pieces.cometAt)).toBe(Boolean(a.pieces.cometAt));
    n.pieces.dispose();
  });
});

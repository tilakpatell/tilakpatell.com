import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from './shipModels';
import * as nodes from './shipModelsNodes';

const lit = (root) => {
  const out = [];
  root.traverse((o) => {
    if (o.isMesh && o.material?.isMeshStandardMaterial) out.push(o.material);
  });
  return out;
};

describe('shipModelsNodes, the twin of shipModels', () => {
  it('the same exports, the same numbers', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
    for (const k of ['BUILT', 'CREW_INK', 'ENGINES', 'LENGTH', 'SHIP_MODELS']) expect(nodes[k]).toBe(glsl[k]);
  });

  // (the X-wing and the Falcon paint their panels on a canvas: a browser's)
  for (const kind of ['rv', 'cruiser']) {
    it(`a ${kind} built the same, its hull painted in nodes`, () => {
      const a = glsl.buildShip(kind);
      const b = nodes.buildShip(kind);
      expect(lit(b.group).length).toBe(lit(a.group).length);
      expect(lit(a.group).every((m) => !m.isNodeMaterial && m.userData.painted)).toBe(true);
      expect(lit(b.group).every((m) => m.isNodeMaterial && m.userData.painted)).toBe(true);
      expect(b.engines).toEqual(a.engines);
      b.paint({ hull: '#336699', trim: '#ffcc00', glow: '#88ccff' });
      b.rim({ colour: [0.2, 0.3, 0.9], dir: [0, 0, 1] });
      b.setThrottle(0.5);
      b.dispose();
      a.dispose();
    });
  }

  it('a model dressed and mounted wears the paint as nodes', () => {
    const ship = nodes.buildShip('rv');
    const model = new THREE.Group();
    model.add(new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 2), new THREE.MeshStandardMaterial({ name: 'Body' })));
    ship.dress(model, { clone: true });
    expect(ship.mount(model)).toBe(true);
    expect(model.children[0].material.isMeshStandardNodeMaterial).toBe(true);
    ship.dispose();
  });
});

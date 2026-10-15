import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from '../spacePieces';
import * as nodes from './spacePieces';

// a stand-in model for every file: a box, its geometry without normals (the far copy makes them)
const load = async () => {
  const scene = new THREE.Group();
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.deleteAttribute('normal');
  scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#888888' })));
  return { scene };
};

const shape = (o) => {
  const list = [];
  o.traverse((x) => list.push([x.type, x.position.toArray(), x.quaternion.toArray(), x.scale.toArray()]));
  return list;
};

describe('nodes/spacePieces, the twin of spacePieces', () => {
  it('exports what spacePieces.js exports, the same tiers', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
    expect(nodes.TIERS).toEqual(glsl.TIERS);
    expect(nodes.NEAR).toBe(glsl.NEAR);
  });

  for (const detail of ['low', 'mid', 'high', 'ultra']) {
    it(`places Endor’s level at ${detail} as spacePieces.js does, under node materials`, async () => {
      const a = glsl.createSpacePieces('endor', { detail, load });
      const n = nodes.createSpacePieces('endor', { detail, load });
      expect(Object.keys(n).sort()).toEqual(Object.keys(a).sort());
      expect(n.goals).toEqual(a.goals);
      await Promise.all([a.ready, n.ready]);
      expect(n.group.name).toBe(a.group.name);
      expect(shape(n.group)).toEqual(shape(a.group));
      if (detail !== 'low') expect(n.group.children.length).toBeGreaterThan(0);
      const mats = (g) => {
        const list = [];
        g.traverse((x) => x.isMesh && list.push(x.material));
        return list;
      };
      const ma = mats(a.group);
      mats(n.group).forEach((m, i) => {
        // (a far copy's material is the level's own; a near cut keeps the model's, or the placed rocks' twin's)
        if (ma[i].type === 'MeshStandardMaterial' && ma[i].vertexColors) {
          expect(m.isNodeMaterial).toBe(true);
          for (const k of ['vertexColors', 'roughness', 'metalness']) expect(m[k]).toBe(ma[i][k]);
        }
      });
      a.update(12);
      n.update(12);
      expect(shape(n.group)).toEqual(shape(a.group));
      a.dispose();
      n.dispose();
    });
  }
});

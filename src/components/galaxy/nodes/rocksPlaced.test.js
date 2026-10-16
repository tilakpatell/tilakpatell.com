import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from '../rocksPlaced';
import * as nodes from './rocksPlaced';
import TRACKS from '../../../data/galaxy/space/tracks.json';

const flags = ['transparent', 'blending', 'side', 'depthWrite', 'depthTest', 'flatShading', 'roughness', 'metalness'];
const arr = (a) => Array.from(a.array);

// two models of a part or two each, one part moved in its model
const model = (color) => {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color, roughness: 0.9 })));
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: '#555', flatShading: true }));
  b.position.set(0.8, 0.2, 0);
  scene.add(b);
  return scene;
};
const MODELS = { a: { scene: model('#8a7f72'), size: 2 }, b: { scene: model('#6f6a64'), size: 1 } };
const PIECES = Array.from({ length: 9 }, (_, i) => ({
  model: i % 3 ? 'a' : 'b',
  at: [i * 3 - 12, (i % 2) * 2, -i],
  quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(i * 0.3, i * 0.7, 0)).toArray(),
  scale: [1 + i * 0.1, 1, 1 + (i % 3) * 0.2],
  track: ['large', 'medium', 'small', 'other'][i % 4],
}));

describe('nodes/rocksPlaced, the twin of rocksPlaced', () => {
  it('exports what rocksPlaced.js exports, and trackTurn the same, number for number', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
    for (const size of ['large', 'medium', 'small'])
      for (const t of [0, 3.3, 17, 41.5]) expect(nodes.trackTurn(TRACKS[size], t).toArray()).toEqual(glsl.trackTurn(TRACKS[size], t).toArray());
    expect(nodes.trackTurn(undefined, 2).toArray()).toEqual([0, 0, 0, 1]);
  });

  for (const keep of [1, 0.5]) {
    it(`places the pieces (keep ${keep}) as the original does, under node materials`, () => {
      const a = glsl.createPlacedRocks({ pieces: PIECES, models: MODELS, tracks: TRACKS, keep });
      const n = nodes.createPlacedRocks({ pieces: PIECES, models: MODELS, tracks: TRACKS, keep });
      expect(Object.keys(n).sort()).toEqual(Object.keys(a).sort());
      expect(n.count).toBe(a.count);
      expect(n.solids).toEqual(a.solids);
      expect(n.group.children.length).toBe(a.group.children.length);
      n.group.children.forEach((o, i) => {
        const g = a.group.children[i];
        expect(o.count).toBe(g.count);
        expect(o.material.isNodeMaterial).toBe(true);
        // (its own copy: the model's material is left as it was)
        expect(o.material).not.toBe(g.material);
        for (const k of flags) expect(o.material[k], `${i} ${k}`).toBe(g.material[k]);
        expect(o.material.color.toArray()).toEqual(g.material.color.toArray());
        expect(arr(o.instanceMatrix)).toEqual(arr(g.instanceMatrix));
        for (const k of ['position', 'aTrack']) expect(arr(o.geometry.attributes[k])).toEqual(arr(g.geometry.attributes[k]));
      });
      n.update(7.5);
      a.update(7.5);
      const parent = new THREE.Group().add(n.group);
      n.dispose();
      a.dispose();
      expect(parent.children).toHaveLength(0);
    });
  }

  it('turns each size on its track: its uniform array holds the track’s turn', () => {
    const n = nodes.createPlacedRocks({ pieces: PIECES, models: MODELS, tracks: TRACKS });
    n.update(9);
    const turns = n.group.children[0].material.userData.placedRock.uTurn.array;
    ['large', 'medium', 'small'].forEach((size, k) => expect(turns[k].toArray()).toEqual(glsl.trackTurn(TRACKS[size], 9).toArray()));
    n.dispose();
  });
});

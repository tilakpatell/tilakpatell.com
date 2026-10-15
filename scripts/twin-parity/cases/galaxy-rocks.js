// The galaxy’s rocks in space: ../../../src/components/galaxy/rocks.js and
// rocksPlaced.js against their twins, nodes/rocks.js and nodes/rocksPlaced.js.
// A field, a ring and a planet’s debris (its hot chunks glowing), each from
// the same seed and tumbled to the same moment, and a game level’s placed
// rocks (two made-up models of two parts each) turned on the asteroid
// tracks for their sizes.
import * as THREE from 'three';
import * as RO from '../../../src/components/galaxy/rocks.js';
import * as RN from '../../../src/components/galaxy/nodes/rocks.js';
import TRACKS from '../../../src/data/galaxy/space/tracks.json';

const look = (camera, from, to = [0, 0, 0]) => {
  camera.position.set(...from);
  camera.lookAt(...to);
  camera.far = 400;
  camera.updateProjectionMatrix();
};

const field = (R, opts, from, t = 23.5) => ({ scene, camera }) => {
  look(camera, from);
  const r = R.createRocks({ seed: 3, ...opts });
  r.update(t);
  scene.add(r.group);
};

// two models, each a lump and a block set off it (a part placed in its
// model, so the turn is about the model’s origin, not the part’s)
const model = (color, s) => {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true })));
  const b = new THREE.Mesh(new THREE.BoxGeometry(s * 0.7, s * 0.5, s * 0.6), new THREE.MeshStandardMaterial({ color: '#7a7470', roughness: 0.8 }));
  b.position.set(s * 0.9, s * 0.2, 0);
  b.rotation.set(0.3, 0.5, 0);
  scene.add(b);
  return scene;
};
const placed = (R) => ({ scene, camera }) => {
  look(camera, [0, 4, 16]);
  const models = { a: { scene: model('#8a7f72', 1), size: 2 }, b: { scene: model('#6f6a64', 0.6), size: 1.2 } };
  const pieces = Array.from({ length: 12 }, (_, i) => ({
    model: i % 3 ? 'a' : 'b',
    at: [(i % 4) * 4 - 6, Math.floor(i / 4) * 3.2 - 3, -(i % 3) * 2],
    quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(i * 0.4, i * 0.9, i * 0.2)).toArray(),
    scale: [1 + (i % 3) * 0.2, 1, 1 + (i % 2) * 0.3],
    track: ['large', 'medium', 'small'][i % 3],
  }));
  const r = R.createRocks({ kind: 'placed', at: [0.5, 0, 0], pieces, models, tracks: TRACKS });
  r.update(7.3);
  scene.add(r.group);
};

const pair = (make, ...args) => ({ node: make(RN, ...args), classic: make(RO, ...args) });

export default {
  'galaxy-rocks:field': pair(field, { kind: 'field', radius: 14, count: 160 }, [0, 6, 26]),
  'galaxy-rocks:ring': pair(field, { kind: 'ring', inner: 8, outer: 13, thickness: 2, count: 260, tilt: [0.35, 0.1] }, [0, 9, 22]),
  'galaxy-rocks:debris': pair(field, { kind: 'debris', radius: 10, count: 200, seed: 5 }, [0, 8, 34]),
  'galaxy-rocks:small': pair(field, { kind: 'field', radius: 12, count: 160, small: true }, [0, 5, 22], 41),
  'galaxy-rocks:placed': pair(placed),
};

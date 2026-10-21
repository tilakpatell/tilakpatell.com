// Moria's environments (nightEnv, caveEnv,
// envFrom: the room a metal sees, prefiltered) for the node renderer: the
// same, line for line, but for the PMREMGenerator, the node renderer's
// (three/webgpu's), since the classic one's passes are GLSL and threw on it.

import * as THREE from 'three';
import { PMREMGenerator } from 'three/webgpu';
import { mix } from '../../../../../lib/paint';

// What polished metal and wet hide see at night in the open: a dark sky,
// the moon's glow high on one side, the cliff's black below.
export function nightEnv(renderer) {
  return envFrom(renderer, [0.012, 0.016, 0.03], [0.05, 0.07, 0.12], [
    [0xc8d6f4, 2.2, 6, 5, [-6, 9, 4]],
    [0x8a9ab8, 0.6, 16, 4, [0, 4, -9]],
  ]);
}
// And in the deeps: near black, a cold light overhead, fire far below.
export function caveEnv(renderer) {
  return envFrom(renderer, [0.006, 0.006, 0.008], [0.02, 0.022, 0.03], [
    [0xdfe8ff, 1.6, 3, 3, [2, 9, 5]],
    [0xff6a20, 1.2, 14, 3, [0, -9, 0]],
    [0x9aa8c0, 0.4, 10, 2, [-8, 2, -4]],
  ]);
}
export function envFrom(renderer, low, high, lamps) {
  const room = new THREE.Scene();
  const walls = new THREE.BoxGeometry(20, 20, 20);
  const shade = [];
  const p = walls.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = (p.getY(i) + 10) / 20;
    shade.push(mix(low[0], high[0], k), mix(low[1], high[1], k), mix(low[2], high[2], k));
  }
  walls.setAttribute('color', new THREE.Float32BufferAttribute(shade, 3));
  room.add(new THREE.Mesh(walls, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  for (const [hex, k, w, h, pos] of lamps) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    room.add(m);
  }
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(room, 0.04).texture;
  pmrem.dispose();
  room.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  return env;
}

// The home system's stations' orbits on the universe map: one faint circle
// a station round the sun, all in one draw (the far planets don't orbit it:
// they're worlds of their own out in deep space).
//
// orbits() → THREE.LineSegments, in the map's space

import * as THREE from 'three';
import { ORDER, POSITIONS } from './layout';
import { byId } from './universes';

export function orbits() {
  const SEG = 160;
  const pts = [];
  for (const id of ORDER) {
    if (byId(id).kind !== 'core') continue;
    const [x, y, z] = POSITIONS[id];
    const R = Math.hypot(x, z);
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      const b = ((i + 1) / SEG) * Math.PI * 2;
      pts.push(Math.cos(a) * R, y, Math.sin(a) * R, Math.cos(b) * R, y, Math.sin(b) * R);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#9fb0d0', transparent: true, opacity: 0.05, depthWrite: false }));
}

// The chase's rings over the street (./games/chase.js's course): glow
// markers, as the doors' rings are (./fx.js), not props a model would stand
// for. Built by ./street.js: in its noInk at build (the scene keeps that
// list from the first time the street's shown) and see-through, so the
// ground's light bake passes them by. Shown only while the cruiser flies:
// the ring to fly through next bright and pulsing, the rest faint, the ones
// flown hidden.
//
//   createChaseRings(rings) → { group, noInk, update(t, chase, flying), dispose() }

import * as THREE from 'three';
import { hot } from '../stage';
import { COURSE, TUNING } from './games/chase';

const LOOK = { next: 0.75, pulse: 0.2, rate: 6, rest: 0.25, tube: 0.22 };

export function createChaseRings(rings = COURSE) {
  const group = new THREE.Group();
  group.name = 'chase-rings';
  group.visible = false;
  const geo = new THREE.TorusGeometry(TUNING.r, LOOK.tube, 8, 48);
  const meshes = rings.map((r) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: hot(0x9dff5a, 1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: LOOK.rest }));
    m.position.set(r.x, r.y, r.z);
    m.rotation.y = r.yaw; // (its hole along the way through)
    group.add(m);
    return m;
  });
  return {
    group,
    noInk: meshes,
    update(t, chase, flying) {
      group.visible = Boolean(flying && chase);
      if (!group.visible) return;
      const next = chase.phase === 'run' ? chase.next : 0;
      for (let i = 0; i < meshes.length; i++) {
        const m = meshes[i];
        m.visible = i >= next;
        m.material.opacity = i === next ? LOOK.next + LOOK.pulse * Math.sin(t * LOOK.rate) : LOOK.rest;
      }
    },
    dispose() {
      geo.dispose();
      for (const m of meshes) m.material.dispose();
    },
  };
}

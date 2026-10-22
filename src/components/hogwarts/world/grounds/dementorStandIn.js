// A dementor, stood in (the design’s §4.8): Lane B’s figure, the robe on
// the shared skeleton, isn’t made yet, so until it is this is the one file
// that draws one in code, and world/grounds/dementors.js swaps it for the
// figure in one line. A tall cloak with its hood up and nothing in it, its
// hem in rags that stir as it drifts, two long grey hands out of the
// sleeves. In the house look, so the cold’s grey shade falls on it too.
//
//   createDementorFigure({ house }) → { group, set({ t, fade, reach }), dispose() }
//     t: seconds (the rags’ stir); fade: 0…1 (gone … there); reach: 0…1 (the hands raised toward you)

import * as THREE from 'three';

const H = 2.9; // m, hood to hem
const ROBE = '#0d0f12';
const LINING = '#1b1e24';
const HAND = '#6f6d6a';

// the cloak’s half-profile from the hem up to the hood’s peak: [r, y]
const PROFILE = [
  [0.62, 0],
  [0.56, 0.5],
  [0.47, 1.1],
  [0.42, 1.6],
  [0.44, 2.0],
  [0.4, 2.25],
  [0.3, 2.45],
  [0.26, 2.62],
  [0.2, 2.76],
  [0.1, 2.86],
  [0.01, H],
];

function robeGeometry() {
  const pts = PROFILE.map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 28);
  const pos = g.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const dark = new THREE.Color(ROBE);
  const lift = new THREE.Color(LINING);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // (the hood’s opening: the front of the head pressed in, a hollow with nothing in it)
    if (y > 2.3 && y < 2.8 && z > 0) {
      const k = Math.max(0, 1 - Math.abs(x) / 0.2) * Math.min(1, (y - 2.3) / 0.15) * Math.min(1, (2.8 - y) / 0.15);
      pos.setZ(i, z * (1 - 0.75 * k));
    }
    c.copy(dark).lerp(lift, Math.max(0, Math.min(1, (y - 1.6) / 1.2)) * 0.5);
    c.toArray(colours, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  g.computeVertexNormals();
  g.userData.rest = pos.array.slice();
  return g;
}

function handGeometry() {
  // a long hand and its fingers as one thin tapering shape, pointing out
  const g = new THREE.ConeGeometry(0.06, 0.5, 6, 1);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, 0.25);
  const colours = new Float32Array(g.attributes.position.count * 3);
  const c = new THREE.Color(HAND);
  for (let i = 0; i < g.attributes.position.count; i++) c.toArray(colours, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return g;
}

export function createDementorFigure({ house = null } = {}) {
  const group = new THREE.Group();
  group.name = 'dementor';
  const material = house?.material ? house.material({ vertexColors: true, transparent: true, side: THREE.DoubleSide }) : new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide });
  const robe = new THREE.Mesh(robeGeometry(), material);
  const handGeo = handGeometry();
  const hands = [-1, 1].map((s) => {
    const h = new THREE.Mesh(handGeo, material);
    h.position.set(0.3 * s, 1.75, 0.25);
    return h;
  });
  group.add(robe, ...hands);
  const pos = robe.geometry.attributes.position;
  const rest = robe.geometry.userData.rest;

  return {
    group,
    set({ t = 0, fade = 1, reach = 0 } = {}) {
      material.opacity = Math.max(0, Math.min(1, fade));
      group.visible = fade > 0.01;
      // the rags: the hem’s rings stirred by a slow wave round the cloak, more the lower they hang
      for (let i = 0; i < pos.count; i++) {
        const y = rest[i * 3 + 1];
        if (y > 1.2) continue;
        const x = rest[i * 3];
        const z = rest[i * 3 + 2];
        const a = Math.atan2(z, x);
        const low = 1 - y / 1.2;
        const k = 1 + low * (0.18 * Math.sin(t * 1.7 + a * 3) + 0.1 * Math.sin(t * 2.9 - a * 5));
        pos.setX(i, x * k);
        pos.setZ(i, z * k);
        // (a ragged hem: some rags hang lower than others)
        pos.setY(i, y - low * 0.22 * (0.5 + 0.5 * Math.sin(a * 7 + 1.3)));
      }
      pos.needsUpdate = true;
      for (const [i, h] of hands.entries()) {
        const s = i ? 1 : -1;
        h.rotation.set(-0.9 + reach * 0.8 + Math.sin(t * 1.1 + i) * 0.08, s * 0.25, 0);
        h.position.y = 1.55 + reach * 0.35;
      }
    },
    dispose() {
      robe.geometry.dispose();
      handGeo.dispose();
      material.dispose();
    },
  };
}

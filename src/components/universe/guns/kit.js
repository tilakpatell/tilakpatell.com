// The few materials and shapes every gun in the hand is built from, in
// code (gunplay.js's GUNS, and the skill tree's four in unique.js):
// everything in metres, the gun's +z its muzzle, +y its sights.
//
//   mats(owned) → the materials (each made once a gun, kept in `owned` to dispose)
//   kit(g, owned) → { box, tube, cone, drum, ball, ring, point } adding to `g`

import * as THREE from 'three';

export const mats = (owned) => {
  const make = (c, extra) => {
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.2, ...extra });
    owned.push(m);
    return m;
  };
  return {
    gunmetal: make('#2a2d33', { metalness: 0.75, roughness: 0.35 }),
    steel: make('#9ea4ad', { metalness: 0.85, roughness: 0.3 }),
    black: make('#141518', { metalness: 0.3, roughness: 0.6 }),
    brown: make('#4a2f1a', { roughness: 0.7, metalness: 0 }),
    wood: make('#6b4a2b', { roughness: 0.65, metalness: 0 }),
    bone: make('#d9d2c2', { roughness: 0.55, metalness: 0.05 }),
    grey: make('#aeb6bf', { metalness: 0.5, roughness: 0.4 }),
    olive: make('#4b5a46', { metalness: 0.4, roughness: 0.55 }),
    navy: make('#1b2538', { metalness: 0.5, roughness: 0.45 }),
    glow: (c, k = 2.5) => make(c, { emissive: new THREE.Color(c), emissiveIntensity: k, roughness: 0.3 }),
    glass: (c) => make(c, { transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0 }),
    paint: (c, metalness = 0.6) => make(c, { metalness, roughness: 0.35 }),
  };
};
// a small kit: everything in metres, the gun's +z its muzzle, +y its sights
export const kit = (g, owned) => {
  const add = (geo, m, [x, y, z] = [0, 0, 0], rot = null) => {
    owned.push(geo);
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    if (rot) o.rotation.set(rot[0] ?? 0, rot[1] ?? 0, rot[2] ?? 0);
    o.castShadow = true;
    g.add(o);
    return o;
  };
  return {
    box: (w, h, d, m, at, rot) => add(new THREE.BoxGeometry(w, h, d), m, at, rot),
    tube: (r, l, m, at, rot, seg = 12) => add(new THREE.CylinderGeometry(r, r, l, seg).rotateX(Math.PI / 2), m, at, rot),
    cone: (r1, r2, l, m, at, rot, seg = 12) => add(new THREE.CylinderGeometry(r2, r1, l, seg).rotateX(Math.PI / 2), m, at, rot), // r1 at the back, r2 at the front
    drum: (r, l, m, at, rot, seg = 12) => add(new THREE.CylinderGeometry(r, r, l, seg), m, at, rot), // along y
    ball: (r, m, at) => add(new THREE.SphereGeometry(r, 12, 8), m, at),
    ring: (r, t, m, at, rot) => add(new THREE.TorusGeometry(r, t, 6, 16), m, at, rot),
    point: (name, [x, y, z]) => {
      const o = new THREE.Object3D();
      o.name = name;
      o.position.set(x, y, z);
      g.add(o);
      return o;
    },
  };
};

// A planet's water: one wide sheet at its level (the sites' own: Scarif's sea
// at 0, Mustafar's lava at 2.5, Dagobah's swamp), following the ship in
// whole kilometres so it always reaches the fog. Sea and lake catch the sun
// (smooth, a little see-through over the shallows); swamp is murky; lava
// glows. Its colour leans on the planet's palette; a generated planet's
// water has a colour of its own.
//
//   createWater(scene, spec) → { place(ship, at), dispose() } | null (no water)

import * as THREE from 'three';
import { WATER_LOOKS as LOOKS } from '../../../lib/land/flight/planetTables';

const SIZE = 60000; // m: past the fog's far edge either way
const SNAP = 1000;

export function createWater(scene, spec) {
  const w = spec.water;
  const look = w && LOOKS[w.kind];
  if (!look) return null;
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(w.colour ?? look.color).lerp(new THREE.Color(spec.palette.accent), 0.15),
    roughness: look.roughness,
    metalness: 0,
    transparent: look.opacity < 1,
    opacity: look.opacity,
    ...(look.glow ? { emissive: new THREE.Color(look.glow), emissiveIntensity: 0.9 } : {}),
  });
  material.name = `flight-water-${w.kind}`;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE, 1, 1), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.name = 'flight-water';
  // (drawn after the ground, so the shallows show what's under them)
  mesh.renderOrder = 1;
  scene.add(mesh);
  return {
    mesh,
    place(ship, at) {
      mesh.position.set(Math.round(ship.x / SNAP) * SNAP - at[0], w.level - at[1], Math.round(ship.z / SNAP) * SNAP - at[2]);
    },
    dispose() {
      scene.remove(mesh);
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}

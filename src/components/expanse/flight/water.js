// A planet's water: one wide sheet at its level (the sites' own: Scarif's sea
// at 0, Mustafar's lava at 2.5, Dagobah's swamp), following the ship in
// whole kilometres so it always reaches the fog. Sea and lake catch the sun
// (smooth, a little see-through over the shallows); swamp is murky; lava
// glows. Its colour leans on the planet's palette.
//
//   createWater(scene, spec) → { place(ship, at), dispose() } | null (no water)

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';

const SIZE = 60000; // m: past the fog's far edge either way
const SNAP = 1000;

const LOOKS = {
  sea: { color: '#1f5a6e', roughness: 0.12, opacity: 0.86 },
  lake: { color: '#2a4f5a', roughness: 0.16, opacity: 0.9 },
  swamp: { color: '#2e3322', roughness: 0.35, opacity: 0.95 },
  lava: { color: '#3a0c02', roughness: 0.6, opacity: 1, glow: '#ff4a0a' },
};

export function createWater(scene, spec) {
  const w = spec.water;
  const look = w && LOOKS[w.kind];
  if (!look) return null;
  const material = new MeshStandardNodeMaterial({
    color: new THREE.Color(look.color).lerp(new THREE.Color(spec.palette.accent), 0.15),
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

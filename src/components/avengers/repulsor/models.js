// The things in Repulsor Range, built from code: Ultron's drones, missiles,
// practice discs and bolts (each drawn instanced, so a swarm costs a handful
// of draw calls), Ultron Prime's armour plates, and Iron Man's gauntlets for
// the first-person view.

import * as THREE from 'three';
import { PartBuilder, lathe, rbox, taper } from '../hq/kit/shapes';
import { hot } from '../hq/stage';
import { instanced as pool } from '../hq/kit/instanced';

// ── Ultron's drone: a silver orb in a ring, four thrusters, a red stare ──
export function droneGeometries() {
  const b = new PartBuilder();
  b.add('body', new THREE.SphereGeometry(0.38, 28, 20), { s: [1, 0.86, 1] });
  b.add('body', taper(rbox(0.5, 0.16, 0.36, 0.06), 1, 0.8), { p: [0, 0.2, -0.04] }); // brow
  b.add('dark', new THREE.TorusGeometry(0.5, 0.055, 10, 40), { r: [Math.PI / 2, 0, 0] });
  b.add('dark', rbox(0.34, 0.1, 0.12, 0.03), { p: [0, 0.02, 0.33] }); // visor housing
  b.add('eye', rbox(0.27, 0.04, 0.05, 0.015), { p: [0, 0.03, 0.38] });
  b.add('dark', new THREE.SphereGeometry(0.09, 16, 12), { p: [0, -0.32, 0] }); // sensor
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const x = Math.cos(a) * 0.5;
    const z = Math.sin(a) * 0.5;
    b.add('body', new THREE.CylinderGeometry(0.075, 0.095, 0.26, 16), { p: [x, -0.06, z] });
    b.add('dark', new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16), { p: [x, -0.2, z] });
    b.add('thrust', new THREE.CircleGeometry(0.055, 16), { p: [x, -0.222, z], r: [Math.PI / 2, 0, 0] });
  }
  b.add('body', rbox(0.03, 0.14, 0.18, 0.01), { p: [0, 0.36, -0.06], r: [0.3, 0, 0] }); // fin
  return b.geometries();
}

// ── a missile, nose to +z ──
export function missileGeometries() {
  const b = new PartBuilder();
  const len = 1.5;
  b.add('shell', new THREE.CylinderGeometry(0.15, 0.15, len, 20), { r: [Math.PI / 2, 0, 0] });
  b.add('shell', lathe([[0.15, 0], [0.13, 0.18], [0.08, 0.34], [0.0, 0.46]], 20), { p: [0, 0, len / 2], r: [Math.PI / 2, 0, 0] });
  b.add('band', new THREE.CylinderGeometry(0.153, 0.153, 0.14, 20), { p: [0, 0, 0.35], r: [Math.PI / 2, 0, 0] });
  b.add('band', new THREE.CylinderGeometry(0.153, 0.153, 0.05, 20), { p: [0, 0, -0.2], r: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    b.add('dark', new THREE.BoxGeometry(0.02, 0.36, 0.34), { p: [Math.cos(a) * 0.22, Math.sin(a) * 0.22, -len / 2 + 0.2], r: [0, 0, a] });
  }
  b.add('dark', new THREE.CylinderGeometry(0.1, 0.13, 0.14, 20), { p: [0, 0, -len / 2 - 0.05], r: [Math.PI / 2, 0, 0] });
  b.add('thrust', new THREE.CircleGeometry(0.09, 16), { p: [0, 0, -len / 2 - 0.125], r: [0, Math.PI, 0] });
  return b.geometries();
}

// ── a practice disc: a shallow dome, orange, with white rings ──
export function discGeometries() {
  const b = new PartBuilder();
  b.add('disc', lathe([[0.0, 0.11], [0.2, 0.1], [0.42, 0.06], [0.55, 0.0], [0.5, -0.03], [0.0, -0.03]], 36));
  for (const r of [0.22, 0.38]) b.add('ring', new THREE.TorusGeometry(r, 0.012, 6, 40), { p: [0, 0.1 - r * 0.1, 0], r: [Math.PI / 2, 0, 0] });
  b.add('ring', new THREE.CylinderGeometry(0.07, 0.07, 0.02, 20), { p: [0, 0.112, 0] });
  return b.geometries();
}

// ── a bolt: a stretched red glow, along +z ──
export const boltGeometry = () => new THREE.CapsuleGeometry(0.06, 1.2, 4, 10).rotateX(Math.PI / 2);

export function repulsorMaterials({ steel, gun, red, gold }) {
  return {
    body: steel,
    dark: gun,
    eye: new THREE.MeshBasicMaterial({ color: hot(0xff2a1a, 3.2), toneMapped: false }),
    thrust: new THREE.MeshBasicMaterial({ color: hot(0x9fdcff, 2.6), toneMapped: false, side: THREE.DoubleSide }),
    shell: new THREE.MeshStandardMaterial({ color: 0xd9dcdf, metalness: 0.3, roughness: 0.45 }),
    band: new THREE.MeshStandardMaterial({ color: 0xb0261c, metalness: 0.2, roughness: 0.5 }),
    disc: new THREE.MeshStandardMaterial({ color: 0xf06a1c, metalness: 0, roughness: 0.55 }),
    ring: new THREE.MeshStandardMaterial({ color: 0xf4efe6, metalness: 0, roughness: 0.6 }),
    bolt: new THREE.MeshBasicMaterial({ color: hot(0xff2a18, 3), toneMapped: false }),
    red,
    gold,
  };
}

// An instanced set of a model: one InstancedMesh per material part (the
// glowing parts cast no shadow).
export const instanced = (geos, mats, max, opts = {}) => pool(geos, mats, max, { noShadow: ['eye', 'thrust', 'bolt'], ...opts });

// ── Iron Man's gauntlet, for the first-person view: the hand raised palm
// forward (the repulsor pose), fingers up and flexed back a little; the
// forearm runs back toward the camera (+z). `side` 1 is the right hand. ──
export function buildGauntlet(side, mats) {
  const b = new PartBuilder();
  // the forearm, thicker toward the elbow, a gold panel along the top
  b.add('red', taper(rbox(0.1, 0.088, 0.3, 0.034), 0.86, 1, { axis: 'z' }), { p: [0, -0.004, 0.175] });
  b.add('gold', rbox(0.048, 0.012, 0.2, 0.005), { p: [side * 0.006, 0.042, 0.17] });
  b.add('dark', rbox(0.104, 0.01, 0.006, 0.002), { p: [0, 0.03, 0.28] });
  b.add('dark', new THREE.TorusGeometry(0.047, 0.009, 8, 24), { p: [0, 0, 0.03] }); // the cuff
  // the back of the hand, the knuckles, the palm's emitter on the far side
  b.add('red', rbox(0.088, 0.1, 0.036, 0.012), { p: [0, 0.052, -0.004] });
  b.add('gold', rbox(0.086, 0.02, 0.04, 0.008), { p: [0, 0.103, -0.004] });
  b.add('dark', new THREE.CylinderGeometry(0.025, 0.025, 0.008, 22), { p: [0, 0.052, -0.023], r: [Math.PI / 2, 0, 0] });
  b.add('glow', new THREE.CircleGeometry(0.019, 22), { p: [0, 0.052, -0.0275], r: [0, Math.PI, 0] });
  // four fingers in two plates each, close together
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.0215;
    const len = [0.04, 0.046, 0.044, 0.036][i];
    b.add('red', rbox(0.0185, len, 0.019, 0.005), { p: [x, 0.116 + len / 2, 0.002], r: [0.18, 0, 0] });
    b.add('red', rbox(0.017, len * 0.8, 0.017, 0.005), { p: [x, 0.118 + len + len * 0.38, 0.012], r: [0.42, 0, 0] });
    b.add('dark', rbox(0.0175, 0.006, 0.018, 0.002), { p: [x, 0.117 + len, 0.006] });
  }
  b.add('red', rbox(0.02, 0.05, 0.02, 0.006), { p: [side * -0.054, 0.045, 0.002], r: [0.1, 0, side * 0.75] }); // the thumb
  return b.build({ red: mats.red, gold: mats.gold, dark: mats.dark, glow: mats.palm }, { shadows: false });
}

// ── Ultron Prime's plates (hung on its bones by the scene) ──
export function plateGeometry(kind) {
  if (kind === 'shoulder') return taper(rbox(0.34, 0.2, 0.36, 0.08), 1.1, 0.8);
  return taper(rbox(0.24, 0.22, 0.1, 0.04), 0.9, 1.05);
}

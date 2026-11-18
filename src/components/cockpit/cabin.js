// What a cockpit's metal and glass reflect: the cabin itself, as a game
// lights an interior from a probe of the place rather than from a
// photographer's studio. three's RoomEnvironment, which every cockpit
// reflected before, is a white room hung with light panels of 17 to 100: at a
// cockpit's 0.35 to 0.6 a polished toggle or lever caught thirty times the
// light of the paint beside it, and the bloom made each a white bar.
//
// This is a sphere round the seat, coloured by direction (cabinLight): the
// canopy's glass ahead and above showing the sky outside, dim; the cabin's
// dark paint round the rest, a little lighter overhead; the consoles' warm
// light low in front; and the lights that are really there as soft discs
// (the sun through the glass, the dome over the seats), each about as bright
// as it lights the scene, so a glint on the chrome is where a light is and
// no brighter than it. Made once a vehicle is built, through the scene's
// PMREM, and the vehicle's own (scene.js frees it with the vehicle).
//
//   cabinLight(dir, look) → [r, g, b], linear: the cabin seen along `dir` (a
//     unit [x, y, z]; −z ahead, +y up), without its discs. Pure, for tests.
//   cabinEnvironment(pmrem, look) → a PMREM texture
//
//   look: { sky, wall, ceiling, floor, glow: [r, g, b] (all linear),
//           glass: { dir, spread } (the canopy's middle, and the cosine of
//           its half-width), front: { dir, spread } (where the consoles' light
//           comes from), lamps: [{ dir, colour, size }] (size: the disc's
//           angular radius in radians) }

import * as THREE from 'three';

export const CABIN = {
  sky: [0.025, 0.03, 0.05],
  wall: [0.03, 0.028, 0.026],
  ceiling: [0.05, 0.046, 0.042],
  floor: [0.012, 0.011, 0.01],
  glow: [0.12, 0.08, 0.04],
  glass: { dir: [0, 0.35, -1], spread: 0.45 },
  front: { dir: [0, -0.45, -1], spread: 0.72 },
  lamps: [],
};

const norm = ([x, y, z]) => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const step = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

export function cabinLight(dir, look = CABIN) {
  const d = norm(dir);
  const o = { ...CABIN, ...look };
  // the paint: the floor's dark under you, the walls round, lighter overhead
  let c = mix(o.floor, o.wall, step(-0.7, -0.1, d[1]));
  c = mix(c, o.ceiling, step(0.3, 0.9, d[1]));
  // the glass, a soft-edged window on the sky
  const g = step(o.glass.spread - 0.12, o.glass.spread + 0.08, dot(d, norm(o.glass.dir)));
  c = mix(c, o.sky, g);
  // and the consoles' light, low in front
  const f = step(o.front.spread - 0.1, o.front.spread + 0.15, dot(d, norm(o.front.dir)));
  return [c[0] + o.glow[0] * f, c[1] + o.glow[1] * f, c[2] + o.glow[2] * f];
}

export function cabinEnvironment(pmrem, look = CABIN) {
  const o = { ...CABIN, ...look };
  const scene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 64, 32);
  const pos = geo.attributes.position;
  const colour = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) colour.set(cabinLight([pos.getX(i), pos.getY(i), pos.getZ(i)], o), i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colour, 3));
  const owned = [geo];
  const shell = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, toneMapped: false });
  owned.push(shell);
  scene.add(new THREE.Mesh(geo, shell));
  // the lights that are there, as soft discs facing the seat
  for (const lamp of o.lamps) {
    const d = new THREE.Vector3(...norm(lamp.dir));
    const r = Math.tan(lamp.size ?? 0.08) * 9.5;
    const disc = new THREE.CircleGeometry(r, 24);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...lamp.colour), side: THREE.DoubleSide, toneMapped: false });
    owned.push(disc, mat);
    const m = new THREE.Mesh(disc, mat);
    m.position.copy(d).multiplyScalar(9.5);
    m.lookAt(0, 0, 0);
    scene.add(m);
  }
  const target = pmrem.fromScene(scene, 0.02);
  for (const x of owned) x.dispose();
  // (whoever frees the texture frees its target, framebuffer and all)
  const tex = target.texture;
  tex.dispose = () => target.dispose();
  return tex;
}

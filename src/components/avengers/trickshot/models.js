// Trick Shot's models: Hawkeye's recurve bow and arrows, straw target bosses
// with painted faces on wooden stands, the rail and the swing, hay walls,
// clay pigeons and practice drones, and wind flags.

import * as THREE from 'three';
import { hot } from '../hq/engine';
import { PartBuilder, canvasTexture, lathe, rbox } from '../hq/kit/shapes';
import { RINGS } from './rules';

export const TRICK_COLORS = { explosive: 0xff5a2a, emp: 0x4ab8ff, split: 0xffc93a };

// The boss is a little bigger than the face's scoring rings: a straw edge.
export const BOSS_EDGE = 1.06;

// A target face: ten rings, the X, and the straw edge round them. The rings
// fill 1/BOSS_EDGE of the picture, so they score exactly where they're drawn.
export function faceTexture() {
  return canvasTexture(1024, 1024, (x, w) => {
    const c = w / 2;
    const R = c / BOSS_EDGE;
    x.fillStyle = '#c9a85e';
    x.fillRect(0, 0, w, w);
    for (let i = 0; i < 10; i++) {
      const r = (1 - i / 10) * R;
      x.fillStyle = RINGS[i];
      x.beginPath();
      x.arc(c, c, r, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = i >= 2 && i <= 3 ? 'rgba(255,255,255,0.5)' : 'rgba(20,20,20,0.45)';
      x.lineWidth = 2;
      x.stroke();
    }
    x.strokeStyle = 'rgba(20,20,20,0.6)';
    x.lineWidth = 1.5;
    x.beginPath();
    x.arc(c, c, R * 0.05, 0, Math.PI * 2);
    x.stroke();
    x.beginPath();
    x.moveTo(c - 6, c);
    x.lineTo(c + 6, c);
    x.moveTo(c, c - 6);
    x.lineTo(c, c + 6);
    x.stroke();
    // a little wear
    let s = 9;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 260; i++) {
      x.fillStyle = `rgba(60,40,20,${0.04 + r() * 0.08})`;
      x.beginPath();
      x.arc(r() * w, r() * w, 1 + r() * 4, 0, Math.PI * 2);
      x.fill();
    }
  });
}

// A boss: the straw drum with the face on it, centred at the origin, facing +z.
export function buildBoss(r, mats) {
  const g = new THREE.Group();
  const depth = 0.32;
  const R = r * BOSS_EDGE;
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(R, R, depth, 40, 1, true).rotateX(Math.PI / 2), mats.straw);
  drum.castShadow = true;
  drum.receiveShadow = true;
  g.add(drum);
  const face = new THREE.Mesh(new THREE.CircleGeometry(R, 48), mats.face);
  face.position.z = depth / 2 + 0.001;
  face.castShadow = true;
  face.receiveShadow = true;
  g.add(face);
  const back = new THREE.Mesh(new THREE.CircleGeometry(R, 32), mats.straw);
  back.rotation.y = Math.PI;
  back.position.z = -depth / 2;
  g.add(back);
  return g;
}

// The easel a boss stands on: two uprights just behind it, braces running
// back to the ground, and a shelf under the drum. The face is at z = 0, the
// boss's centre `y` up.
export function buildStand(r, y, mats) {
  const b = new PartBuilder();
  const top = y + r * 0.7;
  const run = 0.95;
  const braceTop = top * 0.85;
  const brace = Math.hypot(braceTop, run);
  for (const sd of [-1, 1]) {
    const x = sd * r * 0.62;
    b.add('wood', rbox(0.08, top, 0.08, 0.015), { p: [x, top / 2, -0.38] });
    b.add('wood', rbox(0.07, brace, 0.07, 0.015), { p: [x, braceTop / 2, -0.38 - run / 2], r: [Math.atan2(run, braceTop), 0, 0] });
  }
  b.add('wood', rbox(r * 1.5, 0.07, 0.42, 0.015), { p: [0, y - r * BOSS_EDGE - 0.035, -0.18] });
  b.add('wood', rbox(r * 1.5, 0.07, 0.07, 0.015), { p: [0, top - 0.1, -0.38] });
  b.add('wood', rbox(r * 1.3, 0.06, 0.06, 0.015), { p: [0, braceTop * 0.3, -0.38 - run * 0.7] });
  return b.build(mats);
}

// a recurve limb: a flat strip bent back, then forward at the tip
function limbGeometry(len, side) {
  const geo = new THREE.BoxGeometry(0.034, len, 0.012, 1, 24, 1).translate(0, len / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const k = y / len;
    // bends away from the archer, then the tip curls forward again
    const z = -0.09 * Math.sin(k * Math.PI * 0.8) + 0.05 * Math.max(0, k - 0.78) ** 2 * 30;
    const w = 1 - k * 0.55; // narrower toward the tip
    p.setX(i, p.getX(i) * w);
    p.setZ(i, p.getZ(i) + z);
    p.setY(i, y * side);
  }
  geo.computeVertexNormals();
  return geo;
}

// Hawkeye's bow, vertical, the arrow along −z, the grip at the origin.
// `setDraw(k)` bends the limbs and pulls the string back (0 at brace, 1 at
// full draw) and returns where the nock is, for the arrow on the string.
const BOW_LIMB = 0.52;
const BRACE = 0.19;
const DRAW_LENGTH = 0.55;
export function buildBow(mats) {
  const bow = new THREE.Group();
  const riser = new PartBuilder();
  riser.add('riser', rbox(0.045, 0.34, 0.06, 0.015), { p: [0, 0, 0] });
  riser.add('riser', rbox(0.04, 0.08, 0.075, 0.015), { p: [0, 0.2, -0.01] });
  riser.add('riser', rbox(0.04, 0.08, 0.075, 0.015), { p: [0, -0.2, -0.01] });
  riser.add('grip', rbox(0.05, 0.12, 0.07, 0.02), { p: [0, -0.02, 0.012] });
  riser.add('trim', rbox(0.047, 0.012, 0.062, 0.004), { p: [0, 0.12, 0] });
  riser.add('trim', rbox(0.047, 0.012, 0.062, 0.004), { p: [0, -0.12, 0] });
  riser.add('trim', rbox(0.012, 0.03, 0.012, 0.004), { p: [0.03, 0.05, -0.01] }); // the rest
  // a sight bar off the side, with its pins lit
  riser.add('trim', rbox(0.008, 0.008, 0.11, 0.003), { p: [-0.03, 0.09, -0.06] });
  riser.add('riser', rbox(0.01, 0.07, 0.02, 0.004), { p: [-0.03, 0.09, -0.12] });
  bow.add(riser.build({ riser: mats.riser, grip: mats.grip, trim: mats.trim }, { shadows: false }));
  const pins = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.05, 0.004), mats.pin ?? mats.trim);
  pins.position.set(-0.03, 0.09, -0.125);
  bow.add(pins);
  const limbs = [];
  for (const side of [1, -1]) {
    const limb = new THREE.Mesh(limbGeometry(BOW_LIMB, side), mats.limb);
    limb.position.y = side * 0.22;
    limb.userData.side = side;
    bow.add(limb);
    limbs.push(limb);
  }
  // where a limb's tip is, before it bends (the curl at the end of limbGeometry)
  const tipZ = -0.09 * Math.sin(Math.PI * 0.8) + 0.05 * 0.22 ** 2 * 30;
  // the string: two halves meeting at the nock point
  const stringMat = new THREE.MeshBasicMaterial({ color: 0x1c1c1e });
  const halves = [0, 1].map(() => {
    // thin at the nock end, which comes right up to your eye at full draw
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0011, 1, 5).translate(0, 0.5, 0), stringMat);
    bow.add(m);
    return m;
  });
  const up = new THREE.Vector3(0, 1, 0);
  const tip = new THREE.Vector3();
  const d = new THREE.Vector3();
  const nock = new THREE.Vector3();
  const setDraw = (k) => {
    nock.set(0, 0.05, BRACE + DRAW_LENGTH * k);
    limbs.forEach((limb, i) => {
      const side = limb.userData.side;
      // the limbs bend back toward the archer as the string comes back
      limb.rotation.x = side * 0.2 * k;
      limb.updateMatrix();
      tip.set(0, BOW_LIMB * side, tipZ).applyMatrix4(limb.matrix);
      const h = halves[i];
      d.copy(tip).sub(nock);
      h.position.copy(nock);
      h.scale.set(1, d.length(), 1);
      h.quaternion.setFromUnitVectors(up, d.normalize());
    });
    return nock;
  };
  setDraw(0);
  return { bow, limbs, setDraw };
}

// An arrow along −z, its nock at the origin, `len` long.
export function arrowGeometries(len = 0.78) {
  const b = new PartBuilder();
  b.add('shaft', new THREE.CylinderGeometry(0.0045, 0.0045, len, 6).rotateX(Math.PI / 2), { p: [0, 0, -len / 2] });
  b.add('head', lathe([[0, 0], [0.012, 0.012], [0.009, 0.05], [0, 0.07]], 8).rotateX(-Math.PI / 2), { p: [0, 0, -len] });
  b.add('nock', new THREE.CylinderGeometry(0.006, 0.006, 0.02, 6).rotateX(Math.PI / 2), { p: [0, 0, 0.005] });
  const vane = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -0.03), new THREE.Vector3(0, 0, -0.13), new THREE.Vector3(0, 0.022, -0.05)]);
  vane.setIndex([0, 1, 2, 0, 2, 1]);
  vane.computeVertexNormals();
  for (let i = 0; i < 3; i++) b.add('vane', vane, { r: [0, 0, (i * Math.PI * 2) / 3] });
  return b.geometries();
}

// A clay pigeon: a shallow orange dome.
export const clayGeometry = () => lathe([[0, 0.025], [0.06, 0.024], [0.1, 0.012], [0.11, 0], [0.1, -0.006], [0, -0.006]], 24);

// A practice drone: a body, four rotors, a little target on its belly.
export function droneGeometries() {
  const b = new PartBuilder();
  b.add('body', rbox(0.3, 0.08, 0.3, 0.03));
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const x = Math.cos(a) * 0.3;
    const z = Math.sin(a) * 0.3;
    b.add('body', rbox(0.3, 0.025, 0.03, 0.008), { p: [x / 2, 0, z / 2], r: [0, -a, 0] });
    b.add('dark', new THREE.CylinderGeometry(0.03, 0.03, 0.05, 10), { p: [x, 0.03, z] });
    b.add('rotor', new THREE.CylinderGeometry(0.13, 0.13, 0.004, 20), { p: [x, 0.06, z] });
  }
  b.add('target', new THREE.CylinderGeometry(0.12, 0.12, 0.02, 24), { p: [0, -0.05, 0] });
  b.add('light', rbox(0.05, 0.02, 0.02, 0.006), { p: [0, 0, 0.16] });
  return b.geometries();
}

export function droneMaterials() {
  return {
    body: new THREE.MeshStandardMaterial({ color: 0x2b2e33, metalness: 0.4, roughness: 0.5 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0.6, roughness: 0.4 }),
    rotor: new THREE.MeshStandardMaterial({ color: 0x9aa2ac, transparent: true, opacity: 0.35, roughness: 0.3, depthWrite: false }),
    target: new THREE.MeshStandardMaterial({ map: faceTexture(), roughness: 0.7 }),
    light: new THREE.MeshBasicMaterial({ color: hot(0x7a4dff, 2.4), toneMapped: false }),
  };
}

// A wind flag: a cloth plane that ripples, on a pole.
export function buildFlag(mats) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 4.2, 8), mats.pole);
  pole.position.y = 2.1;
  pole.castShadow = true;
  g.add(pole);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55, 12, 4).translate(0.55, 0, 0), mats.cloth);
  cloth.position.y = 3.85;
  cloth.castShadow = true;
  g.add(cloth);
  const base = cloth.geometry.attributes.position.array.slice();
  const update = (t, wind) => {
    // the flag streams with the wind: further out and flatter in a stronger one
    const p = cloth.geometry.attributes.position;
    const k = Math.min(1, Math.abs(wind) / 1.6);
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3];
      const y = base[i * 3 + 1];
      p.setXYZ(i, x * (0.6 + 0.4 * k), y - (1 - k) * x * 0.55, Math.sin(t * (4 + k * 6) + x * 6) * 0.08 * x * (0.4 + k));
    }
    p.needsUpdate = true;
    cloth.geometry.computeVertexNormals();
    cloth.rotation.y = wind < 0 ? Math.PI : 0;
  };
  return { group: g, update };
}

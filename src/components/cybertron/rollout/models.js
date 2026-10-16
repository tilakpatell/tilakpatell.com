// Roll out's models, built from primitives at start. The Autobots and the
// Vehicons are transform rigs: every part has a pose in vehicle mode and one
// in robot mode, and a window of the transformation in which it moves, so
// the cab rises into a chest, the legs swing down out of the chassis and the
// head comes up last. Models face -Z (down the road) with +Y up.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Q = (x = 0, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

// A part of a rig: a pose for each mode, and when in the morph it moves.
export class Rig {
  constructor(root) {
    this.root = root;
    this.parts = [];
    this.limbs = [];
    this.wheels = [];
    this.k = -1;
  }

  add(obj, vehicle, robot, win = [0, 1]) {
    const pose = (p) => ({ p: V3(...(p.p ?? [0, 0, 0])), q: Q(...(p.r ?? [0, 0, 0])), s: p.s == null ? V3(1, 1, 1) : typeof p.s === 'number' ? V3(p.s, p.s, p.s) : V3(...p.s) });
    this.parts.push({ obj, v: pose(vehicle), r: pose(robot), win });
    this.root.add(obj);
    return obj;
  }

  // k: 0 vehicle … 1 robot
  set(k) {
    if (k === this.k) return;
    this.k = k;
    for (const { obj, v, r, win } of this.parts) {
      const t = easeInOut(Math.min(1, Math.max(0, (k - win[0]) / (win[1] - win[0]))));
      obj.position.lerpVectors(v.p, r.p, t);
      obj.quaternion.slerpQuaternions(v.q, r.q, t);
      obj.scale.lerpVectors(v.s, r.s, t);
      obj.visible = obj.scale.x > 0.02;
    }
  }

  // A running stride in robot mode, and wheels turning in vehicle mode.
  animate(k, phase, roll, amount = 1) {
    this.k = -1;
    this.set(k);
    const w = Math.max(0, (k - 0.85) / 0.15) * amount;
    for (const l of this.limbs) {
      const s = Math.sin(phase + l.phase) * l.swing * w;
      l.obj.rotateX(s);
      if (l.knee) l.knee.rotation.x = Math.max(0, -Math.sin(phase + l.phase + 0.9)) * 0.9 * w + l.kneeBase;
    }
    for (const wh of this.wheels) wh.rotation.x = roll;
  }
}

// ── materials ──

// panels: the Autobots' scuffed blue steel (Poly Haven blue_metal_plate);
// worn: the Decepticons' corroded plate (metal_plate_02). Each is { normal,
// rough } with AO, roughness and metalness packed in rough (glTF ORM), its
// roughness averaging 0.29 and 0.66, which the materials divide back out.
export function materials(env, panels, worn) {
  const paint = (color, extra = {}) =>
    new THREE.MeshPhysicalMaterial({ color, metalness: 0.35, roughness: 0.38, clearcoat: 0.9, clearcoatRoughness: 0.12, envMapIntensity: 1.1, ...extra });
  // a robot's paint: the plate's seams and scuffs under a smooth clearcoat
  const livery = (color, extra = {}) =>
    paint(color, panels ? { normalMap: panels.normal, normalScale: new THREE.Vector2(0.22, 0.22), roughnessMap: panels.rough, roughness: 0.38 / 0.29, ...extra } : extra);
  const armour = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.42, normalMap: panels?.normal ?? null, roughnessMap: panels?.rough ?? null, normalScale: new THREE.Vector2(0.6, 0.6), ...extra });
  // Decepticon steel: pitted, duller, its metal showing where it's worn
  const scarred = (color, { roughness = 0.45, metalness = 0.7, ...extra } = {}) =>
    worn
      ? new THREE.MeshStandardMaterial({ color, metalness, metalnessMap: worn.rough, roughness: roughness / 0.66, roughnessMap: worn.rough, normalMap: worn.normal, normalScale: new THREE.Vector2(0.9, 0.9), ...extra })
      : armour(color, { roughness, metalness, ...extra });
  return {
    paint,
    livery,
    armour,
    scarred,
    chrome: new THREE.MeshStandardMaterial({ color: 0xe8ecf1, metalness: 1, roughness: 0.12 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8b929c, metalness: 0.85, roughness: 0.32, normalMap: panels?.normal ?? null, normalScale: new THREE.Vector2(0.4, 0.4) }),
    dark: new THREE.MeshStandardMaterial({ color: 0x23262c, metalness: 0.6, roughness: 0.45 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x151517, metalness: 0, roughness: 0.92 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0b1420, metalness: 0.2, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6 }),
    lamp: (hex, k = 2.4) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), toneMapped: false }),
  };
}

function rbox(w, h, d, r = 0.06) {
  return new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
}
function mesh(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
const group = (...kids) => {
  const g = new THREE.Group();
  kids.forEach((k) => k && g.add(k));
  return g;
};

// A wheel: tyre with tread, a rim on the outside face. Spins about its own
// X axis, so it sits in a holder that turns it side on.
function wheel(r, w, M, tex, outward = 1) {
  const tyreMats = [new THREE.MeshStandardMaterial({ map: tex.tread, color: 0xffffff, roughness: 0.9 }), new THREE.MeshStandardMaterial({ map: tex.rim, metalness: 0.7, roughness: 0.3 }), M.rubber];
  const geo = new THREE.CylinderGeometry(r, r, w, 24, 1);
  geo.rotateZ(Math.PI / 2);
  const tyre = new THREE.Mesh(geo, outward > 0 ? [tyreMats[0], tyreMats[1], tyreMats[2]] : [tyreMats[0], tyreMats[2], tyreMats[1]]);
  tyre.castShadow = true;
  const spin = new THREE.Group();
  spin.add(tyre);
  return spin;
}

function decal(tex, size) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: tex, transparent: true, metalness: 0.4, roughness: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  return m;
}

// ── Optimus Prime: a cab-over truck and the robot inside it ──

export function buildOptimus(M, tex) {
  const root = new THREE.Group();
  const rig = new Rig(root);
  const red = M.livery(0xb5121b);
  const blue = M.livery(0x1d3f9a);
  const greyA = M.armour(0x9aa3ad);
  const blueA = M.armour(0x1f4aa8, { roughness: 0.35 });
  const redA = M.armour(0xc0141f, { roughness: 0.3 });
  const eye = M.lamp(0x6fd8ff, 3.2);
  const head = M.lamp(0xfff2c8, 3);
  const amber = M.lamp(0xffa630, 2.2);
  const tail = M.lamp(0xff2a2a, 2.4);

  // the cab front: windscreen above the grille. In robot mode, the chest.
  const chest = group(
    mesh(rbox(1.6, 0.62, 1.0, 0.07), red, 0, 0, 0),
    mesh(rbox(0.66, 0.42, 0.06, 0.03), M.glass, -0.38, 0.04, -0.5),
    mesh(rbox(0.66, 0.42, 0.06, 0.03), M.glass, 0.38, 0.04, -0.5),
    mesh(new THREE.BoxGeometry(0.06, 0.48, 0.05), M.chrome, 0, 0.04, -0.52),
    // roof lights
    ...[-0.5, -0.25, 0, 0.25, 0.5].map((x) => mesh(new THREE.BoxGeometry(0.1, 0.05, 0.06), amber, x, 0.33, -0.42)),
  );
  rig.add(chest, { p: [0, 1.2, -1.2] }, { p: [0, 2.28, -0.05] }, [0.25, 0.75]);

  // the grille and bumper: the abdomen
  const grille = group(mesh(rbox(1.52, 0.5, 0.5, 0.04), M.chrome, 0, 0, 0), ...Array.from({ length: 9 }, (_, i) => mesh(new THREE.BoxGeometry(0.05, 0.42, 0.03), M.dark, -0.6 + i * 0.15, 0, -0.26)), mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 16).rotateX(Math.PI / 2), head, -0.66, 0.02, -0.27), mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 16).rotateX(Math.PI / 2), head, 0.66, 0.02, -0.27));
  rig.add(grille, { p: [0, 0.62, -1.48] }, { p: [0, 1.72, -0.06], s: [0.78, 0.9, 0.9] }, [0.2, 0.7]);
  const bumper = mesh(rbox(1.72, 0.18, 0.22, 0.05), M.chrome);
  rig.add(bumper, { p: [0, 0.32, -1.7] }, { p: [0, 1.38, -0.12], s: [0.62, 1, 1] }, [0.15, 0.6]);

  // the shoulders: the cab's sides
  for (const sd of [-1, 1]) {
    const sh = group(mesh(rbox(0.42, 0.42, 0.62, 0.06), red, 0, 0, 0));
    if (sd > 0) {
      const ins = decal(tex.autobot, 0.34);
      ins.position.set(0.215, 0, 0);
      ins.rotation.y = Math.PI / 2;
      sh.add(ins);
    }
    rig.add(sh, { p: [sd * 0.58, 0.85, -0.78] }, { p: [sd * 0.98, 2.42, 0] }, [0.3, 0.8]);
  }

  // arms: folded along the chassis, then down from the shoulders
  for (const sd of [-1, 1]) {
    const arm = new THREE.Group();
    arm.add(mesh(rbox(0.34, 0.62, 0.36, 0.05), redA, 0, -0.34, 0));
    arm.add(mesh(rbox(0.36, 0.56, 0.38, 0.05), blueA, 0, -0.92, 0));
    const fist = mesh(rbox(0.3, 0.26, 0.32, 0.06), greyA, 0, -1.28, 0);
    arm.add(fist);
    if (sd > 0) {
      // the ion blaster
      const gun = group(mesh(rbox(0.18, 0.24, 0.7, 0.04), M.dark, 0, 0, -0.2), mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 12).rotateX(Math.PI / 2), M.steel, 0, 0.04, -0.68));
      gun.position.set(0, -1.3, -0.1);
      arm.add(gun);
    }
    rig.add(arm, { p: [sd * 0.5, 0.85, 0.25], r: [-Math.PI / 2, 0, 0], s: 0.85 }, { p: [sd * 1.0, 2.5, 0], r: [-0.12, 0, sd * 0.1] }, [0.35, 0.9]);
    rig.limbs.push({ obj: arm, phase: sd > 0 ? 0 : Math.PI, swing: 0.55 });
  }

  // legs: the chassis behind the cab
  for (const sd of [-1, 1]) {
    const leg = new THREE.Group();
    leg.add(mesh(rbox(0.46, 0.62, 0.5, 0.05), blueA, 0, -0.32, 0));
    const knee = new THREE.Group();
    knee.position.y = -0.66;
    knee.add(mesh(rbox(0.56, 0.7, 0.6, 0.06), blueA, 0, -0.36, 0));
    knee.add(mesh(rbox(0.4, 0.34, 0.06, 0.03), greyA, 0, -0.3, -0.31));
    // the shin's wheel: folded back, it's the truck's rear axle
    const w = wheel(0.36, 0.26, M, tex, sd);
    w.position.set(sd * 0.4, -0.5, -0.26);
    knee.add(w);
    rig.wheels.push(w);
    knee.add(mesh(rbox(0.5, 0.18, 0.78, 0.05), greyA, 0, -0.78, -0.1));
    // folded back, the soles face the road behind: tail lights and a mud flap
    knee.add(mesh(rbox(0.3, 0.04, 0.12, 0.01), tail, sd * 0.06, -0.88, 0.12));
    knee.add(mesh(new THREE.BoxGeometry(0.46, 0.02, 0.5), M.rubber, 0, -0.9, -0.3));
    // fuel tank down the outside of the shin
    knee.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 14), M.chrome, sd * 0.36, -0.12, -0.05));
    leg.add(knee);
    rig.add(leg, { p: [sd * 0.45, 0.62, 0.15], r: [-Math.PI / 2, 0, 0] }, { p: [sd * 0.38, 1.48, 0.02] }, [0.1, 0.7]);
    rig.limbs.push({ obj: leg, knee, phase: sd > 0 ? Math.PI : 0, swing: 0.75, kneeBase: 0 });
  }

  // the waist
  const waist = mesh(rbox(0.86, 0.26, 0.5, 0.05), greyA);
  rig.add(waist, { p: [0, 0.6, 0.2] }, { p: [0, 1.52, 0.02] }, [0.1, 0.6]);

  // smokestacks: behind the cab, then up his back
  for (const sd of [-1, 1]) {
    const st = group(mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.25, 12), M.chrome, 0, 0, 0), mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.1, 12), M.chrome, 0, 0.63, 0));
    rig.add(st, { p: [sd * 0.74, 1.22, -0.62] }, { p: [sd * 0.5, 2.82, 0.36], r: [0.12, 0, 0] }, [0.3, 0.85]);
  }

  // the trailer deck and rear wheels in vehicle mode, packed away as he stands
  const deck = group(mesh(rbox(1.5, 0.22, 1.6, 0.04), blue, 0, 0, 0), mesh(rbox(1.6, 0.08, 0.5, 0.02), M.chrome, 0, -0.08, 0.8));
  rig.add(deck, { p: [0, 0.52, 0.8] }, { p: [0, 1.72, 0.42], s: [0.8, 0.6, 0.35] }, [0, 0.55]);
  // the front axle, under the cab, packs away into the chest
  for (const sd of [-1, 1]) {
    const w = wheel(0.37, 0.28, M, tex, sd);
    rig.wheels.push(w);
    rig.add(w, { p: [sd * 0.74, 0.37, -1.2] }, { p: [sd * 0.62, 2.1, 0.2], s: 0.01 }, [0, 0.35]);
  }

  // the head comes up last
  const headG = group(
    mesh(rbox(0.42, 0.4, 0.42, 0.08), blueA, 0, 0, 0),
    mesh(rbox(0.3, 0.16, 0.08, 0.02), M.steel, 0, -0.1, -0.21),
    mesh(new THREE.BoxGeometry(0.28, 0.05, 0.03), eye, 0, 0.03, -0.22),
    mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.32, 8), blueA, -0.24, 0.12, 0),
    mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.32, 8), blueA, 0.24, 0.12, 0),
    mesh(rbox(0.1, 0.18, 0.06, 0.02), greyA, 0, 0.16, -0.21),
  );
  rig.add(headG, { p: [0, 0.9, -0.9], s: 0.01 }, { p: [0, 2.83, -0.02] }, [0.7, 1]);
  return { group: root, rig, eye, height: 3.05 };
}

// ── Bumblebee: a yellow muscle car with black stripes ──

// Knock Out, the Decepticons' medic: Bumblebee's build in crimson and chrome
export const KNOCKOUT = { body: 0xa30d1b, stripe: 0xc9ced6, armour: 0xb5121f, dark: 0x24262c, grey: 0xb4bac3, eye: 0xff3b3b, metal: 0.55 };

export function buildBumblebee(M, tex, look = {}) {
  const root = new THREE.Group();
  const rig = new Rig(root);
  const L = { body: 0xf2b705, stripe: 0x161616, armour: 0xf0b400, dark: 0x1d1f22, grey: 0x8b929c, eye: 0x61c8ff, metal: 0.35, ...look };
  const yellow = M.livery(L.body, { metalness: L.metal });
  const black = M.livery(L.stripe, { metalness: look.stripe != null ? 0.85 : 0.2, roughness: look.stripe != null ? 0.25 : 0.38 / 0.29 });
  const yellowA = M.armour(L.armour, { roughness: 0.3 });
  const blackA = M.armour(L.dark);
  const greyA = M.armour(L.grey);
  const eye = M.lamp(L.eye, 3.4);
  const head = M.lamp(0xfff4d6, 3);
  const tail = M.lamp(0xff2a2a, 2.2);

  // the hood: in robot mode, the chest, headlights and all
  const hood = group(mesh(rbox(1.56, 0.42, 1.15, 0.12), yellow, 0, 0, 0), mesh(new THREE.BoxGeometry(0.16, 0.02, 1.16), black, -0.18, 0.215, 0), mesh(new THREE.BoxGeometry(0.16, 0.02, 1.16), black, 0.18, 0.215, 0), mesh(rbox(0.3, 0.1, 0.05, 0.02), head, -0.56, 0.02, -0.58), mesh(rbox(0.3, 0.1, 0.05, 0.02), head, 0.56, 0.02, -0.58), mesh(rbox(0.7, 0.12, 0.04, 0.02), M.dark, 0, -0.04, -0.59));
  rig.add(hood, { p: [0, 0.62, -1.05] }, { p: [0, 1.82, -0.1], r: [-Math.PI / 2 + 0.25, 0, 0], s: [0.86, 1, 0.68] }, [0.2, 0.7]);

  // the cabin: roof and glass, folding into the back
  const cabin = group(mesh(rbox(1.36, 0.42, 1.05, 0.14), M.glass, 0, 0, 0), mesh(rbox(1.3, 0.06, 0.8, 0.03), yellow, 0, 0.22, 0.05), mesh(new THREE.BoxGeometry(0.16, 0.02, 0.8), black, -0.18, 0.255, 0.05), mesh(new THREE.BoxGeometry(0.16, 0.02, 0.8), black, 0.18, 0.255, 0.05));
  rig.add(cabin, { p: [0, 1.03, 0.1] }, { p: [0, 1.8, 0.4], s: [0.7, 0.6, 0.5] }, [0, 0.6]);

  // the body sill and trunk
  const body = group(mesh(rbox(1.6, 0.4, 3.2, 0.1), yellow, 0, 0, 0), mesh(rbox(1.62, 0.08, 3.22, 0.03), black, 0, -0.17, 0));
  rig.add(body, { p: [0, 0.48, 0] }, { p: [0, 1.32, 0.15], s: [0.55, 0.6, 0.18] }, [0, 0.45]);
  const trunk = group(mesh(rbox(1.5, 0.3, 0.9, 0.1), yellow, 0, 0, 0), mesh(new THREE.BoxGeometry(0.16, 0.02, 0.9), black, -0.18, 0.155, 0), mesh(new THREE.BoxGeometry(0.16, 0.02, 0.9), black, 0.18, 0.155, 0), mesh(rbox(1.5, 0.06, 0.12, 0.02), black, 0, 0.2, 0.42), mesh(rbox(0.32, 0.08, 0.04, 0.01), tail, -0.55, -0.02, 0.46), mesh(rbox(0.32, 0.08, 0.04, 0.01), tail, 0.55, -0.02, 0.46));
  rig.add(trunk, { p: [0, 0.82, 1.15] }, { p: [0, 1.25, 0.32], s: [0.6, 0.6, 0.3] }, [0, 0.5]);

  // the doors: the wings on his back
  for (const sd of [-1, 1]) {
    const door = group(mesh(rbox(0.06, 0.5, 1.0, 0.03), yellow, 0, 0, 0), mesh(rbox(0.07, 0.22, 0.62, 0.03), M.glass, 0, 0.18, -0.05));
    rig.add(door, { p: [sd * 0.79, 0.78, -0.05] }, { p: [sd * 0.5, 2.12, 0.42], r: [0.3, sd * 0.55, sd * 0.45] }, [0.3, 0.85]);
  }

  // arms with a blaster on the right forearm
  for (const sd of [-1, 1]) {
    const arm = new THREE.Group();
    arm.add(mesh(rbox(0.3, 0.32, 0.34, 0.08), yellowA, 0, -0.06, 0));
    arm.add(mesh(rbox(0.22, 0.42, 0.24, 0.05), blackA, 0, -0.38, 0));
    arm.add(mesh(rbox(0.26, 0.46, 0.28, 0.06), yellowA, 0, -0.78, 0));
    arm.add(mesh(rbox(0.22, 0.2, 0.24, 0.05), blackA, 0, -1.08, 0));
    if (sd > 0) {
      const gun = group(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.52, 12).rotateX(Math.PI / 2), blackA, 0, 0, -0.1), mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 10).rotateX(Math.PI / 2), M.steel, 0, 0, -0.42), mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 16), M.lamp(0x8fe3ff, 2.6), 0, 0, -0.36));
      gun.position.set(0.02, -0.82, -0.12);
      arm.add(gun);
    }
    rig.add(arm, { p: [sd * 0.45, 0.7, 0.6], r: [-Math.PI / 2, 0, 0], s: 0.7 }, { p: [sd * 0.78, 2.02, 0], r: [-0.15, 0, sd * 0.12] }, [0.35, 0.9]);
    rig.limbs.push({ obj: arm, phase: sd > 0 ? 0 : Math.PI, swing: 0.6 });
  }

  // legs with the rear wheels at the calves
  for (const sd of [-1, 1]) {
    const leg = new THREE.Group();
    leg.add(mesh(rbox(0.34, 0.5, 0.38, 0.06), blackA, 0, -0.26, 0));
    const knee = new THREE.Group();
    knee.position.y = -0.54;
    knee.add(mesh(rbox(0.44, 0.62, 0.48, 0.08), yellowA, 0, -0.32, 0));
    knee.add(mesh(rbox(0.36, 0.14, 0.62, 0.05), blackA, 0, -0.68, -0.08));
    const w = wheel(0.33, 0.22, M, tex, sd);
    w.position.set(sd * 0.36, -0.3, -0.24);
    knee.add(w);
    rig.wheels.push(w);
    leg.add(knee);
    rig.add(leg, { p: [sd * 0.4, 0.57, 0.22], r: [-Math.PI / 2, 0, 0] }, { p: [sd * 0.3, 1.25, 0.04] }, [0.1, 0.7]);
    rig.limbs.push({ obj: leg, knee, phase: sd > 0 ? Math.PI : 0, swing: 0.8, kneeBase: 0 });
  }
  // front wheels, onto his shoulders
  for (const sd of [-1, 1]) {
    const w = wheel(0.32, 0.22, M, tex, sd);
    rig.wheels.push(w);
    rig.add(w, { p: [sd * 0.72, 0.33, -1.05] }, { p: [sd * 0.72, 2.12, 0.05], r: [0, 0, sd * 0.4], s: 0.7 }, [0.2, 0.75]);
  }

  // the waist
  rig.add(mesh(rbox(0.66, 0.24, 0.4, 0.06), greyA), { p: [0, 0.5, 0.4], s: 0.5 }, { p: [0, 1.3, 0.04] }, [0.1, 0.6]);

  // the head: round helmet, two horns, blue optics
  const headG = group(
    mesh(new THREE.SphereGeometry(0.23, 20, 14), blackA, 0, 0, 0),
    mesh(rbox(0.3, 0.12, 0.08, 0.02), greyA, 0, -0.08, -0.19),
    mesh(new THREE.SphereGeometry(0.05, 10, 8), eye, -0.09, 0.03, -0.2),
    mesh(new THREE.SphereGeometry(0.05, 10, 8), eye, 0.09, 0.03, -0.2),
    mesh(new THREE.ConeGeometry(0.035, 0.2, 8), yellowA, -0.17, 0.2, 0, 0, 0, 0.35),
    mesh(new THREE.ConeGeometry(0.035, 0.2, 8), yellowA, 0.17, 0.2, 0, 0, 0, -0.35),
  );
  rig.add(headG, { p: [0, 0.7, -0.4], s: 0.01 }, { p: [0, 2.35, -0.05] }, [0.7, 1]);
  return { group: root, rig, eye, height: 2.55 };
}

// ── a Vehicon: a dark sedan that stands up as a Decepticon trooper ──

// Breakdown: a Vehicon's build, bigger, in his blue and grey with a yellow
// optic; and the Autobots' sentries, white and red with blue visors
export const BREAKDOWN = { shell: 0x2c4a7c, trim: 0xc9a227, grey: 0x707784, accent: 0x34405a, visor: 0xffcc33, scale: 1.12 };
export const SENTRY = { shell: 0xd9dde3, trim: 0xb3121f, grey: 0x7a818c, accent: 0x1f4aa8, visor: 0x4fd8ff, lights: 0xfff2d6, mark: 'autobot' };

export function buildVehicon(M, tex, look = {}) {
  const root = new THREE.Group();
  const rig = new Rig(root);
  const L = { shell: 0x2b2d38, trim: 0x5a2a86, grey: 0x6c7280, accent: 0x4b2475, visor: 0xff2b3a, lights: 0xff3b3b, mark: 'decepticon', scale: 1, ...look };
  const shell = M.livery(L.shell, { metalness: 0.55 });
  const trim = M.livery(L.trim, { metalness: 0.5 });
  const greyA = M.scarred(L.grey);
  const purpleA = M.scarred(L.accent, { metalness: 0.5 });
  const visor = M.lamp(L.visor, 3.2);
  const head = M.lamp(L.lights, 2.4);
  root.scale.setScalar(L.scale);

  const hood = group(mesh(rbox(1.6, 0.38, 1.2, 0.1), shell, 0, 0, 0), mesh(rbox(0.32, 0.08, 0.05, 0.02), head, -0.56, 0.02, -0.6), mesh(rbox(0.32, 0.08, 0.05, 0.02), head, 0.56, 0.02, -0.6));
  const ins = decal(tex[L.mark], 0.46);
  ins.rotation.x = -Math.PI / 2;
  ins.position.set(0, 0.2, 0.05);
  hood.add(ins);
  rig.add(hood, { p: [0, 0.6, -1.1] }, { p: [0, 1.85, -0.08], r: [-Math.PI / 2 + 0.15, 0, 0], s: [0.8, 1, 0.7] }, [0.2, 0.7]);
  rig.add(group(mesh(rbox(1.4, 0.4, 1.1, 0.12), M.glass), mesh(rbox(1.34, 0.06, 0.85, 0.03), shell, 0, 0.21, 0.05)), { p: [0, 1.0, 0.1] }, { p: [0, 1.75, 0.35], s: [0.7, 0.5, 0.5] }, [0, 0.55]);
  rig.add(group(mesh(rbox(1.66, 0.42, 3.4, 0.1), shell), mesh(rbox(1.68, 0.06, 3.42, 0.02), trim, 0, -0.12, 0)), { p: [0, 0.46, 0] }, { p: [0, 1.3, 0.12], s: [0.5, 0.6, 0.16] }, [0, 0.45]);
  for (const sd of [-1, 1]) {
    const arm = new THREE.Group();
    arm.add(mesh(rbox(0.28, 0.5, 0.3, 0.05), purpleA, 0, -0.25, 0));
    arm.add(mesh(rbox(0.26, 0.5, 0.28, 0.05), greyA, 0, -0.75, 0));
    if (sd > 0) arm.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 10).rotateX(Math.PI / 2), M.dark, 0, -0.9, -0.2));
    rig.add(arm, { p: [sd * 0.5, 0.7, 0.4], r: [-Math.PI / 2, 0, 0], s: 0.7 }, { p: [sd * 0.75, 2.05, 0], r: [-0.4, 0, sd * 0.1] }, [0.35, 0.9]);
    rig.limbs.push({ obj: arm, phase: sd > 0 ? 0 : Math.PI, swing: 0.4 });
    const leg = new THREE.Group();
    leg.add(mesh(rbox(0.32, 0.55, 0.36, 0.05), greyA, 0, -0.28, 0));
    const knee = new THREE.Group();
    knee.position.y = -0.58;
    knee.add(mesh(rbox(0.38, 0.6, 0.42, 0.06), purpleA, 0, -0.3, 0));
    knee.add(mesh(rbox(0.36, 0.14, 0.56, 0.04), M.dark, 0, -0.62, -0.06));
    leg.add(knee);
    rig.add(leg, { p: [sd * 0.4, 0.62, 0.2], r: [-Math.PI / 2, 0, 0], s: 0.85 }, { p: [sd * 0.3, 1.25, 0.04] }, [0.1, 0.7]);
    rig.limbs.push({ obj: leg, knee, phase: sd > 0 ? Math.PI : 0, swing: 0.5, kneeBase: 0 });
  }
  for (const sd of [-1, 1]) {
    for (const z of [-1.1, 1.1]) {
      const w = wheel(0.33, 0.22, M, tex, sd);
      rig.wheels.push(w);
      rig.add(w, { p: [sd * 0.74, 0.33, z] }, { p: [sd * 0.55, 1.7, 0.3], s: z < 0 ? 0.6 : 0.01 }, [0, 0.5]);
    }
  }
  const headG = group(mesh(new THREE.SphereGeometry(0.24, 18, 14), greyA), mesh(rbox(0.36, 0.1, 0.08, 0.02), visor, 0, 0.02, -0.2), mesh(rbox(0.08, 0.2, 0.3, 0.02), purpleA, 0, 0.2, 0));
  rig.add(headG, { p: [0, 0.7, -0.4], s: 0.01 }, { p: [0, 2.38, -0.05] }, [0.7, 1]);
  return { group: root, rig, eye: visor, height: 2.6, mats: [shell, trim, greyA, purpleA] };
}

// ── jets: Decepticon seekers, and Starscream in his colours ──

export function buildJet(M, { body = 0x5b5f6a, accent = 0x5a2a86, accent2 = null, scale = 1, tex, mark = 'decepticon' } = {}) {
  const g = new THREE.Group();
  const hull = M.scarred(body, { metalness: 0.65, roughness: 0.38 });
  const acc = M.scarred(accent, { metalness: 0.5, roughness: 0.38 });
  const acc2 = accent2 != null ? M.scarred(accent2, { metalness: 0.5, roughness: 0.38 }) : acc;
  const flame = M.lamp(0x7fc8ff, 3);
  // fuselage
  const fus = new THREE.CylinderGeometry(0.28, 0.36, 3.2, 10);
  fus.rotateX(Math.PI / 2);
  g.add(mesh(fus, hull, 0, 0, 0.1));
  const nose = new THREE.ConeGeometry(0.28, 1.2, 10);
  nose.rotateX(-Math.PI / 2);
  g.add(mesh(nose, hull, 0, 0, -2.1));
  g.add(mesh(new THREE.SphereGeometry(0.24, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.9, 2.4), M.glass, 0, 0.18, -1.0));
  // swept wings
  const wing = new THREE.Shape();
  wing.moveTo(0, -0.6);
  wing.lineTo(2.3, 0.7);
  wing.lineTo(2.3, 1.15);
  wing.lineTo(0, 1.2);
  const wg = new THREE.ExtrudeGeometry(wing, { depth: 0.06, bevelEnabled: false });
  for (const sd of [-1, 1]) {
    const w = mesh(wg, sd > 0 ? acc : acc2, 0, -0.03, 0);
    w.rotation.x = Math.PI / 2;
    w.scale.x = sd;
    g.add(w);
    // tail fins
    const fin = mesh(rbox(0.05, 0.8, 0.7, 0.02), acc, sd * 0.45, 0.42, 1.25, 0, 0, sd * -0.35);
    g.add(fin);
    // intakes and engines
    g.add(mesh(rbox(0.36, 0.32, 1.0, 0.05), hull, sd * 0.42, -0.06, -0.2));
    g.add(mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.3, 12).rotateX(Math.PI / 2), M.dark, sd * 0.24, 0, 1.75));
    const fl = mesh(new THREE.CircleGeometry(0.15, 12), flame, sd * 0.24, 0, 1.91);
    g.add(fl);
  }
  if (tex?.[mark]) {
    for (const sd of [-1, 1]) {
      const d = decal(tex[mark], 0.6);
      d.rotation.x = -Math.PI / 2;
      d.position.set(sd * 1.3, 0.04, 0.55);
      g.add(d);
    }
  }
  g.scale.setScalar(scale);
  return { group: g, flame, mats: [hull, acc, acc2] };
}

// A big robot for the bosses: Shockwave (one optic, an arm cannon) or
// Megatron (silver, the bucket helm, the fusion cannon).
// How each boss is painted: its colours, its head (one optic, the bucket
// helm, or a Prime's helmet with antennae), whose mark it wears, and which
// arm holds the cannon (Shockwave's left; everyone else's right).
export const BOSS_LOOK = {
  shockwave: { main: 0x6c2fb0, second: 0x3a3d48, third: 0xb2a46a, metal: 0.45, rough: 0.38, eye: 0xffd23a, glow: 0xb07bff, head: 'optic', mark: 'decepticon', left: true },
  megatron: { main: 0x7f8792, second: 0x3a3d45, third: 0x6a6f78, metal: 0.8, rough: 0.36, eye: 0xff2a2a, glow: 0xff5a3a, head: 'bucket', mark: 'decepticon' },
  magnus: { main: 0x2a5fc0, second: 0xe2e5ea, third: 0xb3121f, metal: 0.55, rough: 0.34, eye: 0x6fd8ff, glow: 0x7fd0ff, head: 'prime', mark: 'autobot', crest: 0xb3121f },
  optimus: { main: 0xb5121b, second: 0x1f4aa8, third: 0x9aa3ad, metal: 0.5, rough: 0.34, eye: 0x6fd8ff, glow: 0x6fc8ff, head: 'prime', mark: 'autobot' },
};

export function buildBoss(M, kind, tex) {
  const g = new THREE.Group();
  const rig = new Rig(g);
  const L = BOSS_LOOK[kind] ?? BOSS_LOOK.megatron;
  const finish = L.mark === 'autobot' ? M.armour : M.scarred;
  const main = finish(L.main, { metalness: L.metal, roughness: L.rough });
  const second = finish(L.second);
  const third = finish(L.third, { metalness: 0.6 });
  const eye = M.lamp(L.eye, 3.6);
  const glowC = M.lamp(L.glow, 3);
  const add = (obj) => {
    rig.add(obj, { p: [obj.position.x, obj.position.y, obj.position.z], r: [obj.rotation.x, obj.rotation.y, obj.rotation.z] }, { p: [obj.position.x, obj.position.y, obj.position.z], r: [obj.rotation.x, obj.rotation.y, obj.rotation.z] });
    return obj;
  };
  // the body faces +Z: toward the player behind him
  add(mesh(rbox(1.5, 1.1, 0.9, 0.12), main, 0, 2.6, 0));
  add(mesh(rbox(1.1, 0.5, 0.7, 0.1), second, 0, 1.85, 0));
  add(mesh(rbox(1.2, 0.4, 0.75, 0.1), third, 0, 1.45, 0));
  const ins = decal(tex[L.mark], 0.6);
  ins.position.set(0, 2.75, 0.46);
  g.add(ins);
  for (const sd of [-1, 1]) add(mesh(rbox(0.6, 0.5, 0.8, 0.12), main, sd * 1.0, 3.05, 0));
  // head
  if (L.head === 'prime') {
    // a Prime's helmet: the faceplate, blue optics, two antennae
    add(mesh(rbox(0.56, 0.56, 0.56, 0.12), second, 0, 3.6, 0));
    add(mesh(rbox(0.36, 0.2, 0.1, 0.03), M.steel, 0, 3.46, 0.29));
    add(mesh(new THREE.BoxGeometry(0.36, 0.06, 0.04), eye, 0, 3.64, 0.3));
    for (const sd of [-1, 1]) add(mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.42, 8), second, sd * 0.32, 3.86, 0, 0, 0, sd * -0.12));
    if (L.crest) add(mesh(rbox(0.1, 0.3, 0.5, 0.03), M.armour(L.crest), 0, 3.95, 0));
  } else if (L.head === 'optic') {
    add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.6, 18).rotateX(Math.PI / 2), main, 0, 3.55, 0));
    add(mesh(new THREE.CircleGeometry(0.22, 20), eye, 0, 3.55, 0.31));
    for (const sd of [-1, 1]) add(mesh(rbox(0.12, 0.5, 0.3, 0.04), third, sd * 0.4, 3.75, 0, 0, 0, sd * -0.25));
  } else {
    add(mesh(rbox(0.6, 0.6, 0.6, 0.12), main, 0, 3.6, 0));
    add(mesh(rbox(0.34, 0.24, 0.1, 0.03), M.steel, 0, 3.48, 0.3));
    add(mesh(new THREE.BoxGeometry(0.34, 0.06, 0.04), eye, 0, 3.64, 0.31));
    add(mesh(rbox(0.12, 0.34, 0.6, 0.04), second, 0, 3.98, 0));
  }
  // arms: the right one is the cannon
  const cannonTip = new THREE.Object3D();
  for (const sd of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sd * 1.15, 3.0, 0);
    arm.add(mesh(rbox(0.42, 0.8, 0.5, 0.1), second, 0, -0.45, 0));
    arm.add(mesh(rbox(0.48, 0.8, 0.56, 0.1), main, 0, -1.2, 0));
    if ((L.left && sd < 0) || (!L.left && sd > 0)) {
      const barrel = mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.4, 18).rotateX(Math.PI / 2), M.dark, 0, -1.25, 0.65);
      arm.add(barrel);
      const ring = mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 20), glowC, 0, -1.25, 1.36);
      arm.add(ring);
      cannonTip.position.set(0, -1.25, 1.5);
      arm.add(cannonTip);
      arm.rotation.x = -0.9; // aimed down the road at you
    } else arm.add(mesh(rbox(0.36, 0.3, 0.4, 0.08), third, 0, -1.7, 0));
    rig.add(arm, { p: [sd * 1.15, 3.0, 0], r: [arm.rotation.x, 0, sd * 0.12] }, { p: [sd * 1.15, 3.0, 0], r: [arm.rotation.x, 0, sd * 0.12] });
    if (arm.rotation.x === 0) rig.limbs.push({ obj: arm, phase: sd > 0 ? 0 : Math.PI, swing: 0.4 });
  }
  for (const sd of [-1, 1]) {
    const leg = new THREE.Group();
    leg.add(mesh(rbox(0.5, 0.75, 0.55, 0.1), second, 0, -0.38, 0));
    const knee = new THREE.Group();
    knee.position.y = -0.78;
    knee.add(mesh(rbox(0.6, 0.62, 0.66, 0.1), main, 0, -0.32, 0));
    knee.add(mesh(rbox(0.6, 0.18, 0.86, 0.06), third, 0, -0.62, 0.08));
    leg.add(knee);
    rig.add(leg, { p: [sd * 0.42, 1.4, 0] }, { p: [sd * 0.42, 1.4, 0] });
    rig.limbs.push({ obj: leg, knee, phase: sd > 0 ? Math.PI : 0, swing: 0.45, kneeBase: 0 });
  }
  rig.set(1);
  g.scale.setScalar(2.1);
  return { group: g, rig, eye, cannonTip, glow: glowC, mats: [main, second, third] };
}

// ── civilian traffic: a few body styles, any colour ──

const CAR_COLOURS = [0xd9dde2, 0x2a3a5a, 0x8a1c1c, 0x3c5a3a, 0x1e1e22, 0xb7b39a, 0x6d7b8c, 0xc96a1d];

export function buildCar(M, tex, look = 0, hover = false) {
  const g = new THREE.Group();
  const paint = M.paint(CAR_COLOURS[look % CAR_COLOURS.length], { clearcoat: 0.6 });
  const head = M.lamp(0xfff2d6, 2.4);
  const tail = M.lamp(0xff2a2a, 2);
  const kind = look % 3; // sedan, pickup, van
  if (hover) {
    // Cybertron: a hover-car on blue jets
    g.add(mesh(rbox(1.7, 0.5, 3.6, 0.2), paint, 0, 0.75, 0));
    g.add(mesh(rbox(1.2, 0.36, 1.5, 0.16), M.glass, 0, 1.12, 0.1));
    for (const z of [-1.2, 1.2]) g.add(mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.12, 16), M.lamp(0x5fd3ff, 2.4), 0, 0.42, z));
    g.add(mesh(rbox(1.5, 0.1, 0.05, 0.02), head, 0, 0.8, -1.81));
    g.add(mesh(rbox(1.5, 0.1, 0.05, 0.02), tail, 0, 0.8, 1.81));
    return { group: g, blinkers: [] };
  }
  const H = kind === 2 ? 1.45 : 0.5;
  g.add(mesh(rbox(1.72, H, 3.7, 0.1), paint, 0, 0.35 + H / 2, 0));
  if (kind === 0) g.add(mesh(rbox(1.5, 0.42, 1.8, 0.14), M.glass, 0, 1.0, 0.15), mesh(rbox(1.46, 0.06, 1.5, 0.04), paint, 0, 1.22, 0.2));
  if (kind === 1) {
    g.add(mesh(rbox(1.6, 0.5, 1.4, 0.12), M.glass, 0, 1.08, -0.4), mesh(rbox(1.56, 0.06, 1.3, 0.04), paint, 0, 1.34, -0.4));
    g.add(mesh(new THREE.BoxGeometry(1.6, 0.06, 1.6), M.dark, 0, 0.84, 1.0));
  }
  if (kind === 2) g.add(mesh(rbox(1.62, 0.4, 0.06, 0.04), M.glass, 0, 1.55, -1.83));
  for (const sd of [-1, 1]) {
    g.add(mesh(rbox(0.32, 0.12, 0.04, 0.02), head, sd * 0.6, 0.62, -1.86));
    g.add(mesh(rbox(0.28, 0.12, 0.04, 0.02), tail, sd * 0.62, 0.66, 1.86));
    for (const z of [-1.2, 1.2]) {
      const w = wheel(0.33, 0.22, M, tex, sd);
      w.position.set(sd * 0.78, 0.33, z);
      g.add(w);
    }
  }
  // indicators, for pulling over
  const blinkMat = M.lamp(0xffa020, 3);
  const blinkers = [];
  for (const sd of [-1, 1]) {
    const b = mesh(new THREE.BoxGeometry(0.12, 0.08, 0.05), blinkMat.clone(), sd * 0.82, 0.66, 1.87);
    b.userData.side = sd;
    b.visible = false;
    g.add(b);
    blinkers.push(b);
  }
  return { group: g, blinkers };
}

// ── things to hit ──


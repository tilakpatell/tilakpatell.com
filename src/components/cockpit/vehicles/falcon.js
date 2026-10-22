// The Millennium Falcon's cockpit, from the pilot's seat (on the left; Chewie
// is in the co-pilot's, on the right). The canopy is the Falcon's: a cone of
// glass ahead held in a spider's web of frame (rings, and struts between
// them, staggered ring to ring), over a wraparound console of switches,
// little screens and dials, the two yokes, and the hyperdrive levers between
// the seats (click them to go). Out of the glass, a desert planet under two
// suns. Going: the levers go forward, Chewie roars, the stars stretch into
// lines, the blue tunnel, and the flash.
//
// The cockpit's floor is y = 0; the canopy's axis runs down −z at x = 0,
// between the seats. Units are metres.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { blinkers, consoleMaps, consoleMat, glassMat, glowSprite, plated, platingMaps, rng, roundedBox, screen, tubeAlong } from '../kit';
import { hyperspace, planet, sky } from '../space';
import { loadCrew, loadGameCrew, nudge, nudgeWorld, prefetchGameCrew } from '../crew';
import { clamp01, smooth } from '../timeline';
import { shadowRadius } from '../levels';
import { dimmer } from '../dim';
import { loadTexture } from '../../../lib/three/textures';

const EYE = [-0.42, 1.16, 0.3];
// the canopy: a cone down −z, from its back ring to its front
const AXIS_Y = 1.24;
const Z0 = -0.32;
const Z1 = -1.86;
const R0 = 1.12;
const R1 = 0.34;
const GLASS = (100 * Math.PI) / 180; // the glass reaches this far round from the top, each side
const SUNS = [
  [-0.4, 0.3, -1],
  [-0.34, 0.25, -1],
];

// the launch: the stars stretch until SNAP (ms), then the tunnel
const SNAP = 2150;

const coneR = (u) => R0 + (R1 - R0) * u;
const coneZ = (u) => Z0 + (Z1 - Z0) * u;
// a point on the cone: `u` along it (0 back, 1 front), `a` round from the top
const conePoint = (u, a, inset = 0) => {
  const r = coneR(u) - inset;
  return new THREE.Vector3(Math.sin(a) * r, AXIS_Y + Math.cos(a) * r, coneZ(u));
};

export function prefetch() {
  prefetchGameCrew('chewie');
}

// a box from a to b, `w` wide and `d` deep, its width lying along `side`
function beam(a, b, w, d, side) {
  const len = a.distanceTo(b);
  const g = new THREE.BoxGeometry(w, d, len);
  const m = new THREE.Matrix4();
  const z = new THREE.Vector3().subVectors(b, a).normalize();
  const x = side.clone().sub(z.clone().multiplyScalar(side.dot(z))).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  m.makeBasis(x, y, z).setPosition(a.clone().add(b).multiplyScalar(0.5));
  return g.applyMatrix4(m);
}

// a flat ring perpendicular to the axis, `r` round, from angle a0 to a1
function hoop(u, width, depth, a0 = -Math.PI, a1 = Math.PI, segs = 72) {
  const r = coneR(u);
  const s = new THREE.Shape();
  s.absarc(0, 0, r + width / 2, a0, a1, false);
  s.absarc(0, 0, r - width / 2, a1, a0, true);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: segs });
  // the shape's angle 0 is +x; ours is the top, turning towards +x
  g.rotateZ(Math.PI / 2);
  g.scale(-1, 1, 1);
  g.translate(0, AXIS_Y, coneZ(u) - depth / 2);
  return g;
}

function canopyFrame() {
  const parts = [];
  const RINGS = [0, 0.4, 0.74, 1];
  parts.push(hoop(0, 0.1, 0.1));
  parts.push(hoop(0.4, 0.045, 0.06));
  parts.push(hoop(0.74, 0.04, 0.06));
  parts.push(hoop(1, 0.06, 0.07));
  // struts between the rings, staggered from one ring to the next: a web
  const SPOKES = [12, 12, 6];
  for (let k = 0; k < 3; k++) {
    const n = SPOKES[k];
    const off = k === 1 ? Math.PI / n : 0;
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2;
      // below the glass the console hides them
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > GLASS + 0.2) continue;
      const p = conePoint(RINGS[k], a, -0.005);
      const q = conePoint(RINGS[k + 1], a, -0.005);
      const side = new THREE.Vector3(Math.cos(a), -Math.sin(a), 0);
      parts.push(beam(p, q, k === 2 ? 0.03 : 0.038, 0.055, side));
    }
  }
  // the front window's cross
  for (const a of [0, Math.PI / 2]) {
    const p = conePoint(1, a);
    const q = conePoint(1, a + Math.PI);
    parts.push(beam(p, q, 0.03, 0.04, new THREE.Vector3(Math.cos(a), -Math.sin(a), 0)));
  }
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)).map((p) => {
    for (const k of Object.keys(p.attributes)) if (!['position', 'normal', 'uv'].includes(k)) p.deleteAttribute(k);
    return p;
  }));
  parts.forEach((p) => p.dispose());
  return g;
}

// the cone's surface between two of its rings, from angle a0 round to a1
function coneShell(u0, u1, a0, a1, inset = 0, segs = 64) {
  const r0 = coneR(u0) - inset;
  const r1 = coneR(u1) - inset;
  const h = Math.abs(coneZ(u1) - coneZ(u0));
  const g = new THREE.CylinderGeometry(r1, r0, h, segs, 1, true, a0, a1 - a0);
  g.rotateX(-Math.PI / 2);
  g.translate(0, AXIS_Y, (coneZ(u0) + coneZ(u1)) / 2);
  return g;
}

// one stretch of the console: a sloped face of switches towards you over a
// body, `w` wide, centred at x, turned `yaw` to face the seats
function consoleSegment({ x, w, yaw, faceMat, bodyMat, trimMat, z = -0.62, y0 = 0.68, rise = 0.28, run = 0.3 }) {
  const g = new THREE.Group();
  const slope = Math.hypot(rise, run);
  const tilt = Math.atan2(run, rise); // from upright
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, slope), faceMat);
  face.rotation.x = -tilt;
  face.position.set(0, y0 + rise / 2, z - run / 2);
  g.add(face);
  // the body behind and below, and the lip along its edge
  const body = new THREE.Mesh(roundedBox(w + 0.02, y0 - 0.1, 0.42, 0.02), bodyMat);
  body.position.set(0, 0.05 + (y0 - 0.1) / 2, z - 0.17);
  g.add(body);
  const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, rise + 0.06, run + 0.1), bodyMat);
  back.position.set(0, y0 + rise / 2 - 0.04, z - run / 2 - 0.05 - 0.04);
  back.rotation.x = -tilt;
  back.scale.z = 0.5;
  back.position.z -= 0.05;
  g.add(back);
  const lip = new THREE.Mesh(roundedBox(w + 0.03, 0.035, 0.05, 0.01), trimMat);
  lip.position.set(0, y0 + 0.005, z + 0.01);
  g.add(lip);
  const shelf = new THREE.Mesh(roundedBox(w + 0.03, 0.03, 0.16, 0.01), trimMat);
  shelf.position.set(0, y0 + rise + 0.01, z - run - 0.05);
  g.add(shelf);
  g.position.x = x;
  g.rotation.y = yaw;
  return { group: g, face, shelf };
}

// little screens: a scope with a sweep, a tactical grid, a column of numbers
const AMBER = '#ffb347';
const GREEN = '#7dffa8';
function scope(g, w, h, t) {
  g.fillStyle = '#05100a';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(125,255,168,0.35)';
  g.lineWidth = 1;
  const cx = w / 2;
  const cy = h / 2;
  for (let r = 1; r <= 3; r++) {
    g.beginPath();
    g.arc(cx, cy, (r * Math.min(w, h)) / 7, 0, Math.PI * 2);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(0, cy);
  g.lineTo(w, cy);
  g.moveTo(cx, 0);
  g.lineTo(cx, h);
  g.stroke();
  const a = t * 1.6;
  const gr = g.createConicGradient ? g.createConicGradient(a - 0.6, cx, cy) : null;
  if (gr) {
    gr.addColorStop(0, 'rgba(125,255,168,0)');
    gr.addColorStop(0.09, 'rgba(125,255,168,0.45)');
    gr.addColorStop(0.1, 'rgba(125,255,168,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(cx, cy, Math.min(w, h) * 0.45, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = GREEN;
  for (const [bx, by] of [
    [0.3, 0.32],
    [0.66, 0.6],
    [0.55, 0.25],
  ]) {
    g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + bx * 9);
    g.fillRect(bx * w - 2, by * h - 2, 4, 4);
  }
  g.globalAlpha = 1;
}
function grid(g, w, h, t) {
  g.fillStyle = '#100802';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,179,71,0.75)';
  g.lineWidth = 1.2;
  // a wireframe trench, scrolling
  const vy = h * 0.3;
  for (let i = -6; i <= 6; i++) {
    g.beginPath();
    g.moveTo(w / 2 + i * 6, vy);
    g.lineTo(w / 2 + i * w * 0.18, h);
    g.stroke();
  }
  for (let k = 0; k < 8; k++) {
    const f = ((k + (t * 1.5) % 1) / 8) ** 2;
    const y = vy + f * (h - vy);
    g.beginPath();
    g.moveTo(w / 2 - (w * 0.5 + 10) * f - 6, y);
    g.lineTo(w / 2 + (w * 0.5 + 10) * f + 6, y);
    g.stroke();
  }
  g.fillStyle = AMBER;
  g.font = `${Math.round(h * 0.12)}px monospace`;
  g.fillText(String(1000 + Math.floor(t * 37) % 9000).padStart(4, '0'), 6, h * 0.16);
}
function numbers(g, w, h, t) {
  g.fillStyle = '#04080c';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#9fd8ff';
  g.font = `${Math.round(h * 0.11)}px monospace`;
  const r = rng(Math.floor(t * 2));
  for (let i = 0; i < 7; i++) {
    const s = Array.from({ length: 6 }, () => '0123456789ABCDEF'[Math.floor(r() * 16)]).join('');
    g.globalAlpha = i === 6 ? 0.5 + 0.5 * Math.sin(t * 8) : 0.85;
    g.fillText(s, 8, (i + 1) * h * 0.135);
  }
  g.globalAlpha = 1;
}

export async function build({ rich, level, coarse, renderer }) {
  const inside = new THREE.Group();
  const outside = new THREE.Group();
  const r = rng(7);

  // ── materials ──
  const hullMaps = platingMaps({ base: '#8f8b82', cols: 5, rows: 4, seed: 12, grime: 0.45, scuffs: 70 });
  const darkMaps = platingMaps({ base: '#4a4b4d', cols: 3, rows: 2, seed: 4, grime: 0.3, rivets: false });
  const hull = plated(hullMaps, { rx: 3, ry: 2, metalness: 0.3 });
  const darkHull = plated(darkMaps, { rx: 2, ry: 2, metalness: 0.45, color: 0xd8d8d8 });
  const frameMat = plated(darkMaps, { rx: 6, ry: 6, metalness: 0.7, color: 0xc4c6ca, bump: 0.3 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x2b2c2f, roughness: 0.5, metalness: 0.7 });
  const black = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.7, metalness: 0.3 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd9dce0, roughness: 0.2, metalness: 1 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, metalness: 0 });
  const redPlastic = new THREE.MeshStandardMaterial({ color: 0x9c2219, roughness: 0.35, metalness: 0 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 0.72, metalness: 0 });
  const faces = [0, 1, 2, 3, 4].map((k) => consoleMat(consoleMaps({ w: 512, h: 320, seed: 30 + k, base: k % 2 ? '#2c2d30' : '#34322e', lit: 0.3 + k * 0.04 }), { glow: 1.5 }));

  // ── the canopy ──
  const frame = new THREE.Mesh(canopyFrame(), frameMat);
  frame.castShadow = true;
  inside.add(frame);
  const glassM = glassMat({ opacity: 0.05, rim: 0.28, smudge: 0.45 });
  const glass = new THREE.Mesh(coneShell(0, 1, -GLASS - 0.15, GLASS + 0.15, 0.004, 96), glassM);
  glass.renderOrder = 10;
  inside.add(glass);
  const nose = new THREE.Mesh(new THREE.CircleGeometry(R1, 48), glassM);
  nose.position.set(0, AXIS_Y, Z1);
  nose.renderOrder = 10;
  inside.add(nose);
  // the hull under the glass, and the cockpit's tube behind the canopy
  const lower = new THREE.Mesh(coneShell(0, 1, GLASS, Math.PI * 2 - GLASS, 0.01, 48), darkHull);
  lower.material.side = THREE.DoubleSide;
  inside.add(lower);
  const tubeLen = 1.9;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(R0, R0, tubeLen, 64, 1, true), hull);
  tube.geometry.rotateX(-Math.PI / 2);
  tube.geometry.translate(0, AXIS_Y, Z0 + tubeLen / 2);
  tube.material.side = THREE.BackSide;
  inside.add(tube);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2), plated(platingMaps({ base: '#3a3936', cols: 6, rows: 8, seed: 2, grime: 0.6 }), { rx: 1, ry: 1, metalness: 0.5 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.02, 0.2);
  inside.add(floor);

  // ── overhead: switch banks arcing over your head, behind the canopy ──
  const over = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const a = -0.75 + i * 0.5;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.7), faces[(i + 2) % faces.length]);
    const rr = R0 - 0.03;
    p.position.set(Math.sin(a) * rr, AXIS_Y + Math.cos(a) * rr, 0.12);
    p.lookAt(0, AXIS_Y, 0.12);
    over.add(p);
  }
  inside.add(over);

  // ── the console, wrapping round the front ──
  const segs = [
    { x: -0.98, w: 0.46, yaw: 0.66, z: -0.36, y0: 0.74, rise: 0.32, run: 0.16 },
    { x: -0.5, w: 0.6, yaw: 0.16, z: -0.6 },
    { x: 0, w: 0.4, yaw: 0, z: -0.72, y0: 0.7, rise: 0.24, run: 0.28 },
    { x: 0.5, w: 0.6, yaw: -0.16, z: -0.6 },
    { x: 0.98, w: 0.46, yaw: -0.66, z: -0.36, y0: 0.74, rise: 0.32, run: 0.16 },
  ];
  const consoleFaces = segs.map((sg, i) => {
    const seg = consoleSegment({ ...sg, faceMat: faces[i], bodyMat: darkHull, trimMat: trim });
    inside.add(seg.group);
    return { face: seg.face, shelf: seg.shelf, w: sg.w };
  });
  inside.updateMatrixWorld(true);
  // a place on a console's face: (u, v) from its middle, in metres, lifted off it by `lift`
  const onFace = (k, u, v, lift = 0) => {
    const f = consoleFaces[k].face;
    return new THREE.Vector3(u, v, lift).applyMatrix4(f.matrixWorld);
  };
  const faceQuat = (k) => new THREE.Quaternion().setFromRotationMatrix(consoleFaces[k].face.matrixWorld);

  // screens on the console, raised in little hoods
  const screens = [];
  const addScreen = (draw, w, h, k, u, v, fps) => {
    const s = screen(w, h, draw, { px: 256, fps });
    const hood = new THREE.Mesh(roundedBox(w + 0.03, h + 0.03, 0.04, 0.008), black);
    hood.add(s.mesh);
    s.mesh.position.z = 0.021;
    hood.position.copy(onFace(k, u, v, 0.02));
    hood.quaternion.copy(faceQuat(k));
    inside.add(hood);
    screens.push(s);
  };
  addScreen(scope, 0.13, 0.105, 1, 0.12, 0.04, 24);
  addScreen(grid, 0.13, 0.1, 2, 0, 0.03, 20);
  addScreen(numbers, 0.12, 0.1, 3, -0.12, 0.04, 4);
  addScreen(scope, 0.1, 0.08, 0, 0.06, 0.06, 24);

  // rows of toggles on the faces: one draw for all of them
  const togGeo = mergeGeometries([new THREE.CylinderGeometry(0.0028, 0.0028, 0.026, 6).translate(0, 0.013, 0), new THREE.SphereGeometry(0.005, 8, 6).translate(0, 0.027, 0)]);
  togGeo.rotateX(Math.PI / 2); // standing out of the face (its +z)
  const togs = [];
  // [face, across, up, how many]
  const rows = [
    [0, 0, -0.08, 9],
    [0, 0, -0.12, 9],
    [1, -0.12, -0.08, 9],
    [1, -0.12, -0.12, 9],
    [1, 0.13, -0.1, 6],
    [2, 0, -0.13, 11],
    [3, 0.12, -0.08, 9],
    [3, 0.12, -0.12, 9],
    [3, -0.13, -0.1, 6],
    [4, 0, -0.08, 9],
    [4, 0, -0.12, 9],
  ];
  const flip = new THREE.Quaternion();
  for (const [k, u0, v, n] of rows) {
    const q = faceQuat(k);
    for (let i = 0; i < n; i++) {
      flip.setFromEuler(new THREE.Euler(r() < 0.45 ? 0.35 : -0.35, 0, 0));
      togs.push(new THREE.Matrix4().compose(onFace(k, u0 + (i - (n - 1) / 2) * 0.021, v, 0.004), q.clone().multiply(flip), new THREE.Vector3(1, 1, 1)));
    }
  }
  const toggles = new THREE.InstancedMesh(togGeo, chrome, togs.length);
  togs.forEach((m, i) => toggles.setMatrixAt(i, m));
  inside.add(toggles);

  // status lights along the shelves under the glass
  const spots = [];
  for (const { shelf, w } of consoleFaces) {
    const n = Math.round(w / 0.05);
    for (let i = 0; i < n; i++) {
      const p = new THREE.Vector3((i / (n - 1) - 0.5) * (w - 0.04), 0.0165, (i % 2 ? 0.03 : -0.02)).applyMatrix4(shelf.matrixWorld);
      spots.push([p.x, p.y, p.z]);
    }
  }
  const lights = blinkers(spots, { size: 0.0045, normal: [0, 1, 0.2], seed: 3 });
  inside.add(lights.mesh);

  // ── the yokes ──
  const yokes = new THREE.Group();
  for (const sx of [-0.42, 0.42]) {
    const col = tubeAlong(
      [
        [sx, 0.84, -0.6],
        [sx, 0.85, -0.5],
      ],
      0.018,
      { segs: 2, radial: 12 },
    );
    const bar = tubeAlong(
      [
        [sx - 0.13, 0.96, -0.48],
        [sx - 0.13, 0.88, -0.49],
        [sx - 0.08, 0.85, -0.5],
        [sx + 0.08, 0.85, -0.5],
        [sx + 0.13, 0.88, -0.49],
        [sx + 0.13, 0.96, -0.48],
      ],
      0.012,
      { segs: 40, radial: 10 },
    );
    yokes.add(new THREE.Mesh(col, trim), new THREE.Mesh(bar, black));
    for (const gx of [-0.13, 0.13]) {
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.07, 12), rubber);
      grip.position.set(sx + gx, 0.93, -0.48);
      const button = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.01, 8), redPlastic);
      button.position.set(sx + gx, 0.968, -0.48);
      yokes.add(grip, button);
    }
  }
  inside.add(yokes);

  // ── the hyperdrive levers, between the seats ──
  const pedestal = new THREE.Mesh(roundedBox(0.22, 0.86, 0.3, 0.03), darkHull);
  pedestal.position.set(0, 0.43, -0.5);
  inside.add(pedestal);
  const pedTop = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.28), faces[2]);
  pedTop.rotation.x = -Math.PI / 2 + 0.3;
  pedTop.position.set(0, 0.87, -0.5);
  inside.add(pedTop);
  const slotMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 });
  const levers = [];
  const leverHit = [];
  for (let i = 0; i < 3; i++) {
    const x = -0.045 + i * 0.045;
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 0.12), slotMat);
    slot.position.set(x, 0.875, -0.5);
    slot.rotation.x = 0.3;
    inside.add(slot);
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.86, -0.5);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.007, 0.15, 10), chrome);
    arm.position.y = 0.075;
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.034, 14), i === 1 ? redPlastic : black);
    knob.position.y = 0.16;
    pivot.add(arm, knob);
    pivot.rotation.x = 0.45; // pulled back, towards you
    inside.add(pivot);
    levers.push(pivot);
    leverHit.push(knob, arm);
  }
  // an easy thing to hit: a box round all three
  const hitBox = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.24), new THREE.MeshBasicMaterial({ visible: false }));
  hitBox.position.set(0, 0.97, -0.44);
  inside.add(hitBox);
  // a ring of light round their base, so the eye finds them
  const leverRing = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.084, 48), new THREE.MeshBasicMaterial({ color: '#ffb35c', toneMapped: false, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  leverRing.rotation.x = -Math.PI / 2 + 0.3;
  leverRing.position.set(0, 0.879, -0.5);
  leverRing.scale.set(1.25, 1.6, 1);
  inside.add(leverRing);

  // ── the seats: Chewie's beside you, the edge of your own ──
  const seat = (x, z) => {
    const g = new THREE.Group();
    const back = new THREE.Mesh(roundedBox(0.54, 0.78, 0.14, 0.05), leather);
    back.position.set(0, 0.95, 0.3);
    back.rotation.x = -0.12;
    const head = new THREE.Mesh(roundedBox(0.34, 0.22, 0.12, 0.05), leather);
    head.position.set(0, 1.44, 0.36);
    const base = new THREE.Mesh(roundedBox(0.54, 0.14, 0.52, 0.05), leather);
    base.position.set(0, 0.46, 0.04);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.4, 12), trim);
    post.position.set(0, 0.2, 0.06);
    const armL = new THREE.Mesh(roundedBox(0.07, 0.06, 0.42, 0.02), black);
    armL.position.set(-0.3, 0.68, 0.04);
    const armR = armL.clone();
    armR.position.x = 0.3;
    g.add(back, head, base, post, armL, armR);
    g.position.set(x, 0, z);
    return { group: g, head };
  };
  inside.add(seat(0.52, 0.0).group);
  const mine = seat(-0.42, 0.28);
  mine.head.visible = false; // behind your eyes
  inside.add(mine.group);

  // side walls: switch banks beside each seat
  for (const sx of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.4), faces[sx < 0 ? 0 : 4]);
    wall.position.set(sx * 1.0, 0.95, 0.12);
    wall.rotation.y = -sx * (Math.PI / 2 - 0.4);
    wall.rotation.x = -0.12;
    inside.add(wall);
  }

  // ── Chewie ──
  // (sat up, head turned a little towards the window; as the launch comes
  // he leans in over the console, his arm out to the levers with yours,
  // and his head comes round to the stars: `launch`, 0…1, set each frame)
  const launch = { k: 0 };
  // (the 2017 game's own Chewbacca, sat at the controls by the game's
  // driver's clip; the cockpit's Meshy one stands in if he won't load. The
  // same lean, look and reach on either: on the game's skeleton, about the
  // cockpit's own directions, as its bones' axes are not Meshy's)
  const across = new THREE.Vector3(1, 0, 0); // (to his right: he faces −z)
  const up = new THREE.Vector3(0, 1, 0);
  const seatAt = { height: 2.28, hips: [0.52, 0.6, 0.06] };
  const chewie =
    (await loadGameCrew('chewie', {
      ...seatAt,
      // (the X-34 driver's clip sits him a quarter turn from the way he
      // stands: a quarter back, and he faces down −z, to the window)
      clip: 'ride.landspeeder',
      face: Math.PI / 2,
      pose: (b) => {
        const k = launch.k;
        // (a turn about `across` that's less than nothing leans him forward, over the console:
        // hunched from the small of his back, as a Wookiee sits under that roof, or his head is
        // at the headrest's height and out of the pilot's sight; his head lifted back to the window)
        nudgeWorld(b.Spine, across, -0.3);
        nudgeWorld(b.Spine1, across, -(0.3 + k * 0.22));
        nudgeWorld(b.Spine2, across, -(k * 0.1));
        nudgeWorld(b.Head, up, 0.12 - k * 0.3);
        nudgeWorld(b.Head, across, 0.4 - k * 0.12);
        // the left arm (toward the middle of the console) forward and down to the levers
        // (his hand on them at the full reach, measured: within 6 cm of their knobs)
        nudgeWorld(b.LeftArm, across, k * 0.8);
        nudgeWorld(b.LeftArm, up, k * 0.7);
        nudgeWorld(b.LeftForeArm, across, k * 0.5);
      },
    })) ??
    (await loadCrew('chewie', {
      clip: 'sit',
      ...seatAt,
      rough: 0.95,
      pose: (b) => {
        const k = launch.k;
        nudge(b.Spine01, -0.08 + k * 0.22, 0, -k * 0.06);
        nudge(b.Spine02, k * 0.1, 0, 0);
        nudge(b.Head, -0.05 - k * 0.12, 0.12 - k * 0.3, 0);
        // the left arm (toward the middle of the console) forward and down to the levers
        nudge(b.LeftArm, -k * 1.1, k * 0.25, k * 0.2);
        nudge(b.LeftForeArm, -k * 0.35, 0, 0);
      },
    }));
  if (chewie) inside.add(chewie.group);

  // ── light ──
  const hemi = new THREE.HemisphereLight(0x8fa4c8, 0x2a2018, 0.35);
  inside.add(hemi);
  const sunDir = new THREE.Vector3(...SUNS[0]).normalize();
  const key = new THREE.DirectionalLight(0xffe2b8, 2.4);
  key.position.copy(sunDir).multiplyScalar(-4).add(new THREE.Vector3(0, 1.2, 0));
  key.position.set(-1.6, 3.2, -3.2);
  key.target.position.set(0, 0.9, -0.3);
  inside.add(key, key.target);
  if (rich) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    key.castShadow = true;
    // (the level's map, ./levels.js; softened over the same width at any size)
    const map = level?.shadows || 1024;
    key.shadow.mapSize.set(map, map);
    key.shadow.radius = shadowRadius(level);
    const c = key.shadow.camera;
    c.left = -1.6;
    c.right = 1.6;
    c.top = 1.6;
    c.bottom = -1.6;
    c.near = 0.5;
    c.far = 8;
    key.shadow.bias = -0.0008;
    key.shadow.normalBias = 0.02;
    frame.castShadow = true;
    inside.traverse((o) => {
      if (o.isMesh && o !== glass && o !== nose) o.receiveShadow = true;
    });
    // he throws a shadow on the console, but takes none (fur and shadow maps
    // make speckles)
    if (chewie)
      chewie.group.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = false;
      });
  }
  const panelGlow = new THREE.PointLight(0xffc98a, 0.9, 2.2, 1.6);
  panelGlow.position.set(0, 1.0, -0.55);
  inside.add(panelGlow);
  const dome = new THREE.PointLight(0xffe0c0, 1.6, 3.2, 1.4);
  dome.position.set(0, 1.95, 0.6);
  inside.add(dome);
  const rim = new THREE.DirectionalLight(0x9db8ff, 0.6);
  rim.position.set(2, 1.5, -2);
  inside.add(rim);
  const jump = new THREE.DirectionalLight(0x8fb6ff, 0);
  jump.position.set(0, 1.4, -3);
  jump.target.position.set(0, 1, 0);
  inside.add(jump, jump.target);

  // ── outside: the desert planet and its two suns ──
  const space = sky({ seed: 11, nebula: ['#23356a', '#5b2a5e'], band: [0.6, 1, -0.2], count: Math.round(5200 * (level?.stars ?? 1)) });
  outside.add(space.group);
  const small = coarse || Math.min(window.innerWidth, window.innerHeight) < 600;
  // (decoded off the main thread, and shared with the universe map's planets)
  const tex = await loadTexture(`/textures/universe/breakingbad${small ? '-sm' : ''}.webp`, { color: true }).catch(() => null);
  const world = planet({ map: tex, radius: 900, sun: [-0.7, 0.45, 0.55], atmosphere: '#ffd9a0', strength: 1.1, tint: 0xf3dcc0 });
  world.group.position.set(820, -820, -1900);
  world.body.rotation.set(0.3, 2.2, 0.15);
  outside.add(world.group);
  // (faded with the suns as the jump takes them, not gone in a frame)
  const dimWorld = dimmer(world.group);
  const suns = SUNS.map((d, i) => {
    const s = glowSprite(i ? '#ffd9a8' : '#fff4dc', i ? 150 : 210, 1);
    s.position.set(...d).normalize().multiplyScalar(1500);
    outside.add(s);
    return s;
  });
  const sunHalo = glowSprite('#ffcf8f', 900, 0.22);
  sunHalo.position.copy(suns[0].position);
  outside.add(sunHalo);
  const hyper = hyperspace({ count: level?.streaks ?? (rich ? 2200 : 1300) });
  outside.add(hyper.group);
  // the brighter sun, for the lens's glare (scene.js): as bright as it's drawn
  const glare = { at: suns[0].position, color: '#fff3dc', k: 1, size: 0.013 };

  // the cockpit, as it stands still
  let leverK = 0;
  const jumpColor = new THREE.Color();
  const glassLight = new THREE.Color();
  const blue = new THREE.Color(0.55, 0.75, 1.3);

  return {
    inside,
    outside,
    eye: EYE,
    rest: [-0.16, -0.05],
    range: [1.25, 0.42],
    hfov: 88,
    vmin: 56,
    vmax: 96,
    exposure: 1.05,
    envIntensity: 0.6,
    bloom: [0.6, 0.45, 0.8],
    flash: '#eef5ff',
    glance: -0.75, // over at Chewie
    rumble: 1,
    glare,
    triggers: [hitBox, ...leverHit],
    resize(w, h, px) {
      hyper.resize(w, h, px);
      space.set({ px });
    },
    launch() {},
    update(dt, t, { launching, t: lt, throttle }) {
      // (the screens drawn again till the jump's light washes them out)
      if (!launching || throttle < 0.3) for (const s of screens) s.tick(t);
      lights.tick(t);
      // the levers: pushed forward in the first moments of the launch
      const want = launching ? smooth(lt / 380) : 0;
      // (Chewie in over them a moment ahead of you, and easing back once the ship's away)
      launch.k += ((launching ? smooth((lt + 500) / 900) * (1 - smooth((lt - 6000) / 3000)) : 0) - launch.k) * Math.min(1, dt * 3);
      chewie?.update(dt);
      world.spin(dt);
      leverK += (want - leverK) * Math.min(1, dt * 18);
      levers.forEach((l, i) => (l.rotation.x = 0.45 - leverK * (0.95 + i * 0.04)));
      leverRing.material.opacity = launching ? Math.max(0, leverRing.material.opacity - dt * 3) : 0.18 + 0.14 * Math.sin(t * 2.4);

      // the jump: stars, the tunnel, its light on everything inside
      const tunnel = launching ? smooth((lt - SNAP) / 220) : 0;
      // the snap into the tunnel: a burst of light, gone in a moment
      const snap = launching ? Math.max(0, 1 - Math.abs(lt - SNAP - 60) / 180) : 0;
      const pre = launching ? 1 - smooth((throttle - 0.3) / 0.35) : 1;
      hyper.update(dt, t, { throttle: launching ? throttle : 0, tunnel, shown: 1 });
      space.set({ fade: 0.15 + 0.85 * pre });
      if (launching) dimWorld(pre);
      world.group.visible = pre > 0.01;
      for (const s of suns) s.material.opacity = pre;
      sunHalo.material.opacity = 0.22 * pre;
      glare.k = pre;
      const k = hyper.light(jumpColor, { throttle: launching ? throttle : 0, tunnel });
      jump.color.copy(jumpColor);
      jump.intensity = (k > 0 ? 1.6 : 0) + snap * 6;
      key.intensity = 2.4 * (0.3 + 0.7 * pre);
      glassLight.setRGB(1, 0.95, 0.88).lerp(blue, clamp01(tunnel + throttle * 0.3));
      glassM.userData.setLight?.(glassLight);
      panelGlow.intensity = 0.9 + (launching ? 0.6 * Math.sin(t * 40) * Math.min(1, throttle * 3) : 0);
    },
    dispose() {
      chewie?.dispose();
      renderer.shadowMap.enabled = false;
      tex?.dispose();
      togGeo.dispose();
    },
  };
}

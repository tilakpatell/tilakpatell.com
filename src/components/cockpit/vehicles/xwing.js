// Red Five: an X-wing's cockpit, from the pilot's seat. A narrow canopy of
// flat panes in a dark frame, the instrument panel under the windscreen
// (a scope, the targeting display's trench and a radar), the throttle on
// the left console and the stick between your knees, the targeting computer
// folded up overhead; ahead, the long white nose with its red markings, and
// to each side, behind you, the upper wings with their engines and cannons.
// Outside, Yavin and the Death Star beyond it, and two of Red Squadron
// alongside. Going: Artoo whistles, the S-foils close, the wingmates jump
// first, then you: the stars stretch, the tunnel, the flash.
//
// The cockpit's floor is y = 0, the nose down −z; units are metres.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { blinkers, consoleMaps, consoleMat, glassMat, glowSprite, plated, platingMaps, rng, roundedBox, screen, tubeAlong } from '../kit';
import { hyperspace, planet, sky } from '../space';
import { clamp01, smooth } from '../timeline';
import { shadowRadius } from '../levels';
import { dimmer } from '../dim';
import { loadTexture } from '../../../lib/three/textures';

const EYE = [0, 1.02, 0.18];
const SNAP = 1950; // ms into the launch: the stars stretched, the tunnel

export function prefetch() {
  for (const f of ['music', 'starwars', 'starwars-glow']) fetch(`/textures/universe/${f}.webp`).catch(() => {});
}

// A quad from four corners (a, b, c, d round the edge), as a geometry.
function quad(a, b, c, d) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
  g.computeVertexNormals();
  return g;
}

// A bar of frame between two points, a rounded rectangle in section.
function bar(a, b, w = 0.035, d = 0.03) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const g = roundedBox(w, d, A.distanceTo(B), Math.min(w, d) * 0.35, 2);
  const m = new THREE.Matrix4().lookAt(A, B, new THREE.Vector3(0, 1, 0));
  m.setPosition(A.clone().add(B).multiplyScalar(0.5));
  return g.applyMatrix4(m);
}

// A box whose two ends are different sizes: `back` and `front` are
// [halfWidth, top, bottom] at z0 and z1. For the nose.
function taper(back, front, z0, z1) {
  const g = new THREE.BoxGeometry(1, 1, 1, 1, 1, 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const f = p.getZ(i) + 0.5; // 0 at the back (+z), 1 at the front
    const k = 1 - f;
    const w = back[0] * k + front[0] * f;
    const top = back[1] * k + front[1] * f;
    const bot = back[2] * k + front[2] * f;
    p.setX(i, p.getX(i) * 2 * w);
    p.setY(i, p.getY(i) > 0 ? top : bot);
    p.setZ(i, z0 + (z1 - z0) * f);
  }
  g.computeVertexNormals();
  return g;
}

// one of the wingmates: an X-wing from a few shapes, seen from far off
function wingmate(mats) {
  const parts = [];
  parts.push(new THREE.BoxGeometry(0.9, 0.7, 6).translate(0, 0, -1));
  parts.push(new THREE.ConeGeometry(0.45, 3, 4).rotateX(-Math.PI / 2).rotateZ(Math.PI / 4).translate(0, 0, -5.4));
  const red = [];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      const w = new THREE.BoxGeometry(5, 0.08, 1.6).translate(sx * 2.8, 0, 1.2);
      w.rotateZ(sx * sy * 0.22);
      w.translate(0, sy * 0.3, 0);
      parts.push(w);
      parts.push(new THREE.CylinderGeometry(0.06, 0.06, 4.2, 6).rotateX(Math.PI / 2).translate(sx * 5.3, sy * (0.3 + 0.22 * 5.3 * 0.98), -0.4));
      parts.push(new THREE.CylinderGeometry(0.34, 0.34, 2.4, 10).rotateX(Math.PI / 2).translate(sx * 0.85, sy * 0.45, 1.6));
      red.push(new THREE.BoxGeometry(0.9, 0.1, 1.62).translate(sx * 3.6, 0, 1.2).rotateZ(sx * sy * 0.22).translate(0, sy * 0.3, 0));
    }
  const strip = (gs) => gs.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
    return g;
  });
  const body = new THREE.Mesh(mergeGeometries(strip(parts)), mats.hull);
  const stripes = new THREE.Mesh(mergeGeometries(strip(red)), mats.red);
  const g = new THREE.Group();
  g.add(body, stripes);
  // its four engines' glow
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      const e = glowSprite('#ff8a6a', 1.6, 0.9);
      e.position.set(sx * 0.85, sy * 0.45, 2.9);
      g.add(e);
    }
  return g;
}

export async function build({ rich, level, coarse, renderer }) {
  const inside = new THREE.Group();
  const outside = new THREE.Group();
  const r = rng(5);

  // ── materials ──
  const whiteMaps = platingMaps({ base: '#d9d8d1', cols: 4, rows: 6, seed: 21, grime: 0.28, scuffs: 50, seam: 0.4 });
  const greyMaps = platingMaps({ base: '#5a5c60', cols: 3, rows: 3, seed: 8, grime: 0.3, rivets: false });
  const hullWhite = plated(whiteMaps, { rx: 1, ry: 3, metalness: 0.15 });
  const hullGrey = plated(greyMaps, { rx: 2, ry: 2, metalness: 0.4, color: 0xd0d0d0 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3b3d42, roughness: 0.45, metalness: 0.65 });
  const black = new THREE.MeshStandardMaterial({ color: 0x151518, roughness: 0.7, metalness: 0.3 });
  const red = new THREE.MeshStandardMaterial({ color: 0xa62a1f, roughness: 0.55, metalness: 0.1 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.25, metalness: 1 });
  const panelMats = [0, 1, 2].map((k) => consoleMat(consoleMaps({ w: 512, h: 320, seed: 60 + k, base: '#2a2b2e', lit: 0.28 }), { glow: 1.4 }));

  // ── the canopy: flat panes in a dark frame ──
  const S = { y: 0.82, zb: 0.6, zf: -0.42, xb: 0.37, xf: 0.32 }; // the sill
  const T = { y: 1.26, zf: -0.16, xf: 0.19, yb: 1.33, zb: 0.6, xb: 0.24 }; // the top edges
  const sillF = (sx) => [sx * S.xf, S.y, S.zf];
  const sillB = (sx) => [sx * S.xb, S.y, S.zb];
  const topF = (sx) => [sx * T.xf, T.y, T.zf];
  const topB = (sx) => [sx * T.xb, T.yb, T.zb];
  const mid = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const bars = [];
  bars.push(bar(sillF(-1), sillF(1), 0.05, 0.04)); // the windscreen's foot
  bars.push(bar(topF(-1), topF(1), 0.036, 0.03));
  for (const sx of [-1, 1]) {
    bars.push(bar(sillF(sx), topF(sx), 0.032, 0.03)); // the windscreen's sides
    bars.push(bar(topF(sx), topB(sx), 0.03, 0.03)); // along the top
    bars.push(bar(sillF(sx), sillB(sx), 0.05, 0.05)); // the sills
    const k = 0.42;
    bars.push(bar(mid(sillF(sx), sillB(sx), k), mid(topF(sx), topB(sx), k), 0.028, 0.026)); // the side panes' divider
  }
  const frame = new THREE.Mesh(mergeGeometries(bars.map((g) => (g.index ? g.toNonIndexed() : g))), frameMat);
  inside.add(frame);
  const glassM = glassMat({ opacity: 0.045, rim: 0.3, smudge: 0.5, seed: 4 });
  const panes = [quad(sillF(-1), sillF(1), topF(1), topF(-1)), quad(topF(-1), topF(1), topB(1), topB(-1))];
  for (const sx of [-1, 1]) panes.push(quad(sillF(sx), sillB(sx), topB(sx), topF(sx)));
  const glass = new THREE.Mesh(mergeGeometries(panes), glassM);
  glass.renderOrder = 10;
  inside.add(glass);

  // the tub: walls to the sills, the floor, the seat's edge
  for (const sx of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.82), hullGrey);
    wall.position.set(sx * 0.4, 0.41, 0.08);
    wall.rotation.y = -sx * Math.PI / 2;
    inside.add(wall);
    // the side consoles, sloping in under the sills
    const con = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.16), panelMats[sx < 0 ? 0 : 2]);
    con.position.set(sx * 0.34, 0.74, 0.02);
    con.rotation.order = 'YXZ';
    con.rotation.y = -sx * Math.PI / 2;
    con.rotation.x = -0.9;
    inside.add(con);
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.6), black);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.05, 0.1);
  inside.add(floor);

  // ── the instrument panel, under the windscreen ──
  const panelGeo = quad([-0.3, 0.64, -0.24], [0.3, 0.64, -0.24], [0.33, 0.86, -0.42], [-0.33, 0.86, -0.42]);
  const panel = new THREE.Mesh(panelGeo, panelMats[1]);
  panel.material.side = THREE.DoubleSide;
  inside.add(panel);
  const cowl = new THREE.Mesh(roundedBox(0.68, 0.025, 0.07, 0.01), frameMat);
  cowl.position.set(0, 0.875, -0.43);
  inside.add(cowl);
  // a frame under the panel, down to the floor
  const under = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.05), black);
  under.position.set(0, 0.32, -0.25);
  inside.add(under);

  // its displays
  const screens = [];
  const panelN = new THREE.Vector3(0, 0.63, 0.78).normalize();
  const onPanel = (u, v) => new THREE.Vector3(u, 0.86 - 0.22 * v, -0.42 + 0.18 * v);
  const addScreen = (draw, w, h, u, v, fps) => {
    const s = screen(w, h, draw, { px: 256, fps });
    const hood = new THREE.Mesh(roundedBox(w + 0.025, h + 0.025, 0.03, 0.006), black);
    hood.add(s.mesh);
    s.mesh.position.z = 0.016;
    hood.position.copy(onPanel(u, v)).addScaledVector(panelN, 0.012);
    hood.lookAt(hood.position.clone().add(panelN));
    inside.add(hood);
    screens.push(s);
  };
  const sensor = (g, w, h, t) => {
    g.fillStyle = '#04110a';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,255,160,0.45)';
    g.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      g.beginPath();
      g.moveTo(0, (i * h) / 6);
      g.lineTo(w, (i * h) / 6);
      g.stroke();
    }
    g.strokeStyle = '#7dffa8';
    g.lineWidth = 2;
    g.beginPath();
    for (let x = 0; x <= w; x += 3) {
      const y = h * 0.55 + Math.sin(x * 0.05 + t * 3) * h * 0.2 * Math.sin(t * 0.7 + x * 0.01);
      if (x) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
  };
  const trench = (g, w, h, t) => {
    g.fillStyle = '#120700';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,170,60,0.9)';
    g.lineWidth = 1.4;
    const vx = w / 2;
    const vy = h * 0.42;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(vx + s * w * 0.06, vy);
      g.lineTo(vx + s * w * 0.5, h);
      g.moveTo(vx + s * w * 0.06, vy);
      g.lineTo(vx + s * w * 0.06, vy - h * 0.25);
      g.stroke();
    }
    for (let k = 0; k < 7; k++) {
      const f = ((k + ((t * 1.2) % 1)) / 7) ** 2;
      const x = w * 0.06 + (w * 0.44) * f;
      const y = vy + (h - vy) * f;
      g.beginPath();
      g.moveTo(vx - x, y);
      g.lineTo(vx - x, y - (h * 0.25 + (h - vy) * 0.6 * f) * 0.4);
      g.moveTo(vx + x, y);
      g.lineTo(vx + x, y - (h * 0.25 + (h - vy) * 0.6 * f) * 0.4);
      g.stroke();
    }
    g.fillStyle = '#ffb347';
    g.font = `${Math.round(h * 0.12)}px monospace`;
    g.fillText(`${String(Math.max(0, 9999 - Math.floor(t * 211) % 9999)).padStart(4, '0')}`, 6, h * 0.15);
  };
  const radar = (g, w, h, t) => {
    g.fillStyle = '#060a10';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(140,200,255,0.5)';
    for (let i = 1; i <= 3; i++) {
      g.beginPath();
      g.arc(w / 2, h / 2, (i * w) / 7, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = '#ff6a5a';
    g.beginPath();
    g.arc(w / 2 + Math.cos(t * 0.6) * w * 0.25, h / 2 + Math.sin(t * 0.6) * h * 0.2, 3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#9fd8ff';
    for (const [a, d] of [
      [2.2, 0.3],
      [0.9, 0.35],
    ]) {
      g.beginPath();
      g.arc(w / 2 + Math.cos(a) * w * d, h / 2 + Math.sin(a) * h * d, 2.5, 0, Math.PI * 2);
      g.fill();
    }
  };
  addScreen(sensor, 0.13, 0.095, -0.17, 0.5, 20);
  addScreen(trench, 0.14, 0.1, 0.0, 0.42, 20);
  addScreen(radar, 0.1, 0.095, 0.17, 0.5, 12);
  // rows of little lights along the panel's top
  const spots = [];
  for (let i = 0; i < 22; i++) {
    const p = onPanel(-0.28 + (i / 21) * 0.56, 0.1 + (i % 2) * 0.05).addScaledVector(panelN, 0.004);
    spots.push([p.x, p.y, p.z]);
  }
  const lights = blinkers(spots, { size: 0.004, normal: [0, 0.6, 0.8], seed: 9 });
  inside.add(lights.mesh);

  // the stick, between your knees
  const stick = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.34, 10), chrome);
  shaft.position.y = 0.17;
  const grip = new THREE.Mesh(roundedBox(0.045, 0.12, 0.05, 0.015), black);
  grip.position.set(0, 0.38, 0.01);
  const trig = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.02), red);
  trig.position.set(0, 0.38, -0.03);
  const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.06, 12), black);
  stick.add(shaft, grip, trig, boot);
  stick.position.set(0, 0.32, -0.02);
  stick.rotation.x = 0.15;
  inside.add(stick);
  // the throttle, on the left console: push it to go
  const throttle = new THREE.Group();
  const tArm = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.09, 8), chrome);
  tArm.position.y = 0.045;
  const tKnob = new THREE.Mesh(roundedBox(0.03, 0.022, 0.045, 0.008), black);
  tKnob.position.y = 0.094;
  throttle.add(tArm, tKnob);
  throttle.position.set(-0.31, 0.74, -0.12);
  throttle.rotation.x = 0.5;
  inside.add(throttle);
  const tHit = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.16), new THREE.MeshBasicMaterial({ visible: false }));
  tHit.position.set(-0.31, 0.8, -0.13);
  inside.add(tHit);
  const tGlow = new THREE.Mesh(new THREE.RingGeometry(0.038, 0.042, 32), new THREE.MeshBasicMaterial({ color: '#ffb35c', toneMapped: false, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
  tGlow.rotation.x = -Math.PI / 2;
  tGlow.scale.set(1, 1.6, 1);
  tGlow.position.set(-0.31, 0.745, -0.12);
  inside.add(tGlow);

  // the targeting computer, folded up overhead on its arm
  const tc = new THREE.Group();
  const tcBox = new THREE.Mesh(roundedBox(0.17, 0.1, 0.06, 0.012), black);
  const tcScreen = screen(0.13, 0.07, trench, { px: 192, fps: 15, glow: 1.6 });
  tcScreen.mesh.position.set(0, 0, 0.031);
  tcBox.add(tcScreen.mesh);
  screens.push(tcScreen);
  tc.add(tcBox);
  const tcArm = new THREE.Mesh(tubeAlong([[0, 0.05, -0.04], [0, 0.12, -0.08], [0, 0.16, -0.06]], 0.01, { segs: 8, radial: 6 }), frameMat);
  tc.add(tcArm);
  tc.scale.setScalar(0.85);
  tc.position.set(0, T.y - 0.07, T.zf + 0.2);
  tc.rotation.x = -1.15;
  inside.add(tc);

  // ── the ship around you: the nose ahead, the upper wings behind ──
  const nose = new THREE.Mesh(taper([0.4, 0.8, 0.15], [0.13, 0.44, 0.18], -0.45, -5.2), hullWhite);
  inside.add(nose);
  const tip = new THREE.Mesh(taper([0.13, 0.44, 0.18], [0.07, 0.36, 0.24], -5.2, -5.7), hullGrey);
  inside.add(tip);
  // Red Five's markings on the nose
  for (const z of [-3.2, -3.55]) {
    const k = (-z - 0.45) / 4.75;
    const w = 0.4 + (0.13 - 0.4) * k;
    const y = 0.8 + (0.44 - 0.8) * k;
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.9, 0.18), red);
    mark.rotation.x = -Math.PI / 2 - Math.atan2(0.36, 4.75);
    mark.position.set(0, y + 0.006, z);
    inside.add(mark);
  }
  // the upper wings, with their engines and cannons, and their stripes
  const wings = [];
  const ROOT = [0.42, 0.62, 1.0];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * ROOT[0], ROOT[1], ROOT[2]);
    const wingGeo = new THREE.BoxGeometry(5.2, 0.06, 1.7, 8, 1, 1);
    const wp = wingGeo.attributes.position;
    for (let i = 0; i < wp.count; i++) {
      const f = wp.getX(i) / 5.2 + 0.5; // root 0 → tip 1
      wp.setZ(i, wp.getZ(i) * (1 - 0.45 * f) - 0.35 * f);
    }
    wingGeo.computeVertexNormals();
    wingGeo.translate(sx * 2.6, 0, 0);
    const wing = new THREE.Mesh(wingGeo, hullWhite);
    pivot.add(wing);
    for (const off of [3.4, 4.1]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.065, 1.02), red);
      st.position.set(sx * off, 0.002, -0.3);
      pivot.add(st);
    }
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.3, 20), hullGrey);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(sx * 0.45, 0.25, 0.6);
    pivot.add(engine);
    const intake = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.04, 8, 24), black);
    intake.position.set(sx * 0.45, 0.25, -0.55);
    pivot.add(intake);
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 4.0, 10), hullGrey);
    cannon.rotation.x = Math.PI / 2;
    cannon.position.set(sx * 5.25, 0.02, -1.2);
    pivot.add(cannon);
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 10), black);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(sx * 5.25, 0.02, -3.2);
    pivot.add(muzzle);
    pivot.rotation.z = sx * 0.24; // the S-foils open, in attack position
    inside.add(pivot);
    wings.push({ pivot, sx });
  }

  // ── light: Yavin's orange from below, a hard white sun ──
  const hemi = new THREE.HemisphereLight(0x9fb4d8, 0x8a4a1c, 0.7);
  inside.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e8, 2.6);
  sun.position.set(3, 4, -2);
  sun.target.position.set(0, 0.8, -0.5);
  inside.add(sun, sun.target);
  if (rich) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    sun.castShadow = true;
    // (the level's map, ./levels.js; softened over the same width at any size)
    const map = level?.shadows || 1024;
    sun.shadow.mapSize.set(map, map);
    sun.shadow.radius = shadowRadius(level);
    Object.assign(sun.shadow.camera, { left: -1.5, right: 1.5, top: 1.5, bottom: -1.5, near: 0.5, far: 9 });
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    frame.castShadow = true;
    inside.traverse((o) => {
      if (o.isMesh && o !== glass) o.receiveShadow = true;
    });
  }
  const panelGlow = new THREE.PointLight(0xffc98a, 0.5, 1.4, 1.6);
  panelGlow.position.set(0, 0.86, -0.25);
  inside.add(panelGlow);
  const jump = new THREE.DirectionalLight(0x8fb6ff, 0);
  jump.position.set(0, 1.2, -3);
  jump.target.position.set(0, 0.8, 0);
  inside.add(jump, jump.target);

  // ── outside: Yavin, the Death Star beyond it, Red Squadron ──
  const space = sky({ seed: 23, nebula: ['#1d2c55', '#3a2350'], band: [-0.4, 1, 0.3], count: Math.round(5200 * (level?.stars ?? 1)) });
  outside.add(space.group);
  const small = coarse || Math.min(window.innerWidth, window.innerHeight) < 600;
  // (decoded off the main thread, and shared with the universe map's planets)
  const load = (n) => loadTexture(`/textures/universe/${n}${small && n !== 'starwars-glow' ? '-sm' : ''}.webp`, { color: true }).catch(() => null);
  const [yavinTex, dsTex, dsGlow] = await Promise.all([load('music'), load('starwars'), load('starwars-glow')]);
  const yavin = planet({ map: yavinTex, radius: 1100, sun: [0.8, 0.5, 0.3], atmosphere: '#ffb070', strength: 0.9, tint: 0xffe2c4 });
  yavin.group.position.set(-700, -1150, -2100);
  yavin.body.rotation.set(0.25, 0.4, -0.18);
  outside.add(yavin.group);
  const ds = new THREE.Mesh(
    new THREE.SphereGeometry(60, 64, 40),
    new THREE.MeshStandardMaterial({ map: dsTex, color: dsTex ? 0xffffff : 0x8a8f96, emissive: 0xffffff, emissiveMap: dsGlow, emissiveIntensity: dsGlow ? 0.8 : 0, roughness: 0.8, metalness: 0.2 }),
  );
  ds.position.set(520, 260, -1500);
  ds.rotation.y = 0.9;
  outside.add(ds);
  const dsLight = new THREE.DirectionalLight(0xffffff, 2);
  dsLight.position.set(1000, 500, -1000);
  dsLight.target = ds;
  outside.add(dsLight);
  // (faded as the jump takes them, not gone in a frame)
  const dimWorld = dimmer(yavin.group, ds, dsLight);
  const mates = [
    { at: new THREE.Vector3(-14, 2.5, -26), roll: 0.12 },
    { at: new THREE.Vector3(19, -4, -44), roll: -0.18 },
  ].map((m) => {
    const g = wingmate({ hull: new THREE.MeshStandardMaterial({ color: 0xd8d6cf, roughness: 0.6, metalness: 0.2 }), red });
    g.position.copy(m.at);
    g.rotation.z = m.roll;
    outside.add(g);
    return { g, ...m, phase: r() * 6 };
  });
  outside.add(new THREE.AmbientLight(0x8090b0, 0.25));
  const mateSun = new THREE.DirectionalLight(0xfff4e8, 2.2);
  mateSun.position.set(3, 4, -2);
  outside.add(mateSun);
  // the hard white sun that lights you, off to the right: seen when you
  // look round at it, and the lens's glare (scene.js) when you do (lower
  // than the light's own way, which is past where the view turns)
  const sunDisc = glowSprite('#fff6ea', 170, 1);
  sunDisc.position.set(3, 1.8, -2.4).normalize().multiplyScalar(1500);
  const sunHalo = glowSprite('#ffe6c4', 760, 0.16);
  sunHalo.position.copy(sunDisc.position);
  outside.add(sunDisc, sunHalo);
  const glare = { at: sunDisc.position, color: '#fff6ea', k: 1, size: 0.012 };
  const hyper = hyperspace({ count: level?.streaks ?? (rich ? 2200 : 1300), seed: 31 });
  outside.add(hyper.group);

  let foil = 0;
  const jumpColor = new THREE.Color();
  const glassLight = new THREE.Color();
  const blue = new THREE.Color(0.55, 0.75, 1.3);

  return {
    inside,
    outside,
    eye: EYE,
    rest: [0, -0.14],
    range: [1.4, 0.45],
    hfov: 90,
    vmin: 58,
    vmax: 98,
    exposure: 1.0,
    envIntensity: 0.55,
    bloom: [0.6, 0.45, 0.8],
    flash: '#eef5ff',
    rumble: 0.9,
    glare,
    triggers: [tHit, throttle, stick],
    resize(w, h, px) {
      hyper.resize(w, h, px);
      space.set({ px });
    },
    launch() {},
    update(dt, t, { launching, t: lt, throttle: thr }) {
      // (the screens drawn again till the jump's light washes them out)
      if (!launching || thr < 0.3) for (const s of screens) s.tick(t);
      lights.tick(t);
      yavin.spin(dt);
      ds.rotation.y += dt * 0.01;
      // the S-foils close for the jump, and the throttle goes forward
      foil += ((launching ? 1 : 0) - foil) * Math.min(1, dt * 3.5);
      for (const w of wings) w.pivot.rotation.z = w.sx * 0.24 * (1 - foil);
      throttle.rotation.x = 0.5 - (launching ? smooth(lt / 300) : 0) * 1.0;
      tGlow.material.opacity = launching ? Math.max(0, tGlow.material.opacity - dt * 3) : 0.2 + 0.15 * Math.sin(t * 2.4);
      // the wingmates bob along; in the launch they go first, streaking ahead
      for (const m of mates) {
        const away = launching ? Math.pow(clamp01((lt - 900) / 900), 3) : 0;
        m.g.position.set(m.at.x + Math.sin(t * 0.6 + m.phase) * 0.4, m.at.y + Math.sin(t * 0.9 + m.phase) * 0.3, m.at.z - away * 4000);
        m.g.scale.set(1, 1, 1 + away * 30);
        m.g.visible = away < 0.98;
      }
      // the jump
      const tunnel = launching ? smooth((lt - SNAP) / 220) : 0;
      const snap = launching ? Math.max(0, 1 - Math.abs(lt - SNAP - 60) / 180) : 0;
      const pre = launching ? 1 - smooth((thr - 0.3) / 0.35) : 1;
      hyper.update(dt, t, { throttle: launching ? thr : 0, tunnel, shown: 1 });
      space.set({ fade: 0.15 + 0.85 * pre });
      if (launching) dimWorld(pre);
      yavin.group.visible = ds.visible = pre > 0.01;
      sunDisc.material.opacity = glare.k = pre;
      sunHalo.material.opacity = 0.16 * pre;
      const k = hyper.light(jumpColor, { throttle: launching ? thr : 0, tunnel });
      jump.color.copy(jumpColor);
      jump.intensity = (k > 0 ? 1.6 : 0) + snap * 6;
      sun.intensity = 2.6 * (0.3 + 0.7 * pre);
      glassLight.setRGB(1, 0.95, 0.88).lerp(blue, clamp01(tunnel + thr * 0.3));
      glassM.userData.setLight?.(glassLight);
    },
    dispose() {
      renderer.shadowMap.enabled = false;
      for (const tx of [yavinTex, dsTex, dsGlow]) tx?.dispose();
    },
  };
}

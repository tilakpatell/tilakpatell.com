// Minas Morgul, its bridge of statues and its beam. Moved out of props.js
// as it was; its ghost-lit stone, the beam and the splash come from the
// kit (K.shaders).

import * as THREE from 'three';
import { clamp01, fbm, makeNoise, mix, smooth } from '../../../../lib/paint';
import { hot } from '../../../../lib/three/canvasTexture';
import { boxUV, rng } from '../../shire/build';
import { C, facet, lump, noise3, oneGeo, rod, spikeAt, sweep, TAU, tint, V3 } from './helpers';

// ── Minas Morgul ──

const DARK = { base: C(0x2a2b2d), dark: C(0x0b0c0d), green: C(0x2c4a38), moss: C(0x262b24), pale: C(0x4a4c4c) };
const GHOST = { base: C(0xb4c4b8), pale: C(0xe2ecdc), dark: C(0x6c7c72), bone: C(0xdce4d8) };

// The ground under the city, from the gate (y = 0) up its spur to the north.
const spurAt = (x, z) => (z > -4 ? 0 : 64 * smooth(-4, -150, z)) * (1 - smooth(52, 104, Math.abs(x)));

// A twisted figure in pale stone on its plinth, about 5 m: a body writhing
// up from a robe, its head thrown back, arms clawing at the air.
export function statueGeo(seed) {
  const r = rng(seed * 7 + 3);
  const list = [];
  list.push(new THREE.BoxGeometry(1.5, 1.4, 1.5, 1, 1, 1).translate(0, 0.7, 0));
  list.push(new THREE.BoxGeometry(1.8, 0.25, 1.8).translate(0, 1.5, 0));
  const tw = (r() - 0.5) * 1.6;
  const pts = [];
  for (let i = 0; i <= 5; i++) {
    const k = i / 5;
    const a = tw * k * 3 + r() * 0.4;
    pts.push([Math.sin(a) * 0.22 * k + (r() - 0.5) * 0.12, 1.6 + k * 2.6, Math.cos(a) * 0.2 * k - 0.1]);
  }
  list.push(sweep(pts, [[0.5, 0.55], [0.38, 0.42], [0.3, 0.36], [0.32, 0.4], [0.24, 0.3], [0.16, 0.18]], { seg: 8, radial: 6 }));
  const top = V3(...pts[5]);
  // the head, thrown back and to one side
  list.push(lump(0.2, { p: [top.x - 0.12, top.y + 0.22, top.z + (r() - 0.5) * 0.2], s: [1, 1.15, 0.9] }, { detail: 0, seed }));
  // the arms: one up and clawing, one across the body or out
  for (const s of [-1, 1]) {
    const sh = V3(...pts[4]).add(V3(0, -0.1, s * 0.32));
    const up = r() < 0.6;
    const el = sh.clone().add(V3((r() - 0.5) * 0.5, up ? 0.7 : 0.1, s * (0.35 + r() * 0.3)));
    const wr = el.clone().add(V3((r() - 0.5) * 0.6, up ? 0.75 : -0.5, s * (up ? -0.1 : 0.3)));
    list.push(sweep([sh, el, wr], [[0.13], [0.1], [0.08]], { seg: 4, radial: 5 }));
    for (let f = 0; f < 3; f++) list.push(spikeAt(wr, V3((r() - 0.5) * 1.2, up ? 1 : -0.4, s * (r() - 0.2)), 0.32, 0.035, 3));
  }
  // ribs and spines down the back
  for (let i = 0; i < 4; i++) list.push(spikeAt(V3(...pts[1 + i]).add(V3(-0.28, 0, 0)), V3(-1, 0.4 + r() * 0.5, (r() - 0.5) * 0.8), 0.4 + r() * 0.3, 0.06, 3));
  const n = makeNoise(seed);
  const g = oneGeo(list.map((x) => facet(x)));
  tint(g, (x, y, z, out) => {
    out.copy(GHOST.bone).multiplyScalar(0.85 + noise3(n, x * 3, y * 3, z * 3) * 0.3);
    if (y < 1.62) out.lerp(GHOST.dark, 0.35);
  });
  return g;
}

// Minas Morgul, the dead city, seen across its valley from about 250 m: its
// walls and towers climbing a spur of rock, the tower in the midst 130 m
// high with its crown turning slowly; the bridge 70 m long over the
// Morgulduin's gorge, pale statues writhing along it; the dark walls of the
// valley rising either side. The gate is the origin, the bridge running out
// from it along +z. update(t, { beam, glow }).
export function morgul(K) {
  const { mats } = K;
  const U = { uTime: { value: 0 }, uGlow: { value: 1 }, uBeam: { value: 0 }, uNoise: K.U.uNoise, uGhost: { value: new THREE.Color(0.3, 1.0, 0.46) } };
  const ghost = K.shaders.ghost(U);
  const g = new THREE.Group();
  g.name = 'minasMorgul';
  const r = rng(1201);
  const n = makeNoise(1203);
  const stone = [];
  const lights = [];
  const add = (geo) => stone.push(geo);
  const box = (w, h, d, x, y, z) => add(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  // a square tier from y0 to y1, `a` across at its foot and `b` at its head
  const tier = (a, b, y0, y1, x, z, sides = 4) => add(new THREE.CylinderGeometry((b * Math.SQRT2) / 2, (a * Math.SQRT2) / 2, y1 - y0, sides, 1).rotateY(Math.PI / 4).translate(x, (y0 + y1) / 2, z));
  const cap = (w, h, x, y, z) => add(new THREE.ConeGeometry((w * Math.SQRT2) / 2, h, 4).rotateY(Math.PI / 4).translate(x, y + h / 2, z));
  const slit = (x, y, z, w = 0.5, h = 3, dir = 'z') => lights.push(dir === 'z' ? new THREE.BoxGeometry(w, h, 0.5).translate(x, y, z) : new THREE.BoxGeometry(0.5, h, w).translate(x, y, z));
  const merlons = (x0, x1, y, z, d, step = 3.4) => {
    for (let x = x0 + step / 2; x < x1; x += step) {
      box(step * 0.5, 1.6, d, x, y + 0.8, z);
      add(new THREE.ConeGeometry(step * 0.36, 2.6, 4).rotateY(Math.PI / 4).scale(1, 1, d / (step * 0.5)).translate(x, y + 2.9, z));
    }
  };
  // a tower: square, battlemented, its cap a steep spike, slits in its face
  const tower = (x, z, y0, w, h, capH = w * 1.6) => {
    tier(w, w * 0.92, y0, y0 + h, x, z);
    box(w * 1.06, 1.4, w * 1.06, x, y0 + h - 4, z);
    cap(w * 0.8, capH * 1.25, x, y0 + h, z);
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(spikeAt(V3(x + (cx * w) / 2.2, y0 + h, z + (cz * w) / 2.2), V3(cx * 0.2, 1, cz * 0.2), capH * 0.45, w * 0.08, 4));
    for (let y = y0 + 12; y < y0 + h - 6; y += 9) if (r() < 0.45) slit(x + (r() - 0.5) * w * 0.4, y, z + w / 2 + 0.05, 0.45, 3.2);
  };

  // ── the front wall and its gate
  {
    const sh = new THREE.Shape();
    sh.moveTo(-62, -8);
    sh.lineTo(62, -8);
    sh.lineTo(62, 20);
    sh.lineTo(-62, 20);
    sh.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-5, -0.01);
    hole.lineTo(5, -0.01);
    hole.lineTo(5, 12);
    hole.quadraticCurveTo(4.6, 16.5, 0, 19);
    hole.quadraticCurveTo(-4.6, 16.5, -5, 12);
    hole.closePath();
    sh.holes.push(hole);
    add(new THREE.ExtrudeGeometry(sh, { depth: 6, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -6));
    merlons(-62, 62, 20, -1, 2);
    // buttresses, wedge-shaped, down the face
    for (let x = -57; x <= 57; x += 7.5) if (Math.abs(x) > 19 && Math.abs(Math.abs(x) - 36) > 5) add(new THREE.CylinderGeometry(0.25, 1.9, 23, 3).translate(x, 3.5, 0.2));
    for (const s of [-1, 1]) tower(s * 36, -2, -8, 8, 36, 15);
    // the gate's frame: a pointed arch of stone stepped out from the wall,
    // and the glow beyond it
    const arch = new THREE.Shape();
    arch.moveTo(-8, 0);
    arch.lineTo(-8, 13);
    arch.quadraticCurveTo(-7.4, 20, 0, 24);
    arch.quadraticCurveTo(7.4, 20, 8, 13);
    arch.lineTo(8, 0);
    arch.lineTo(5, 0);
    arch.lineTo(5, 12);
    arch.quadraticCurveTo(4.6, 16.5, 0, 19);
    arch.quadraticCurveTo(-4.6, 16.5, -5, 12);
    arch.lineTo(-5, 0);
    arch.closePath();
    add(new THREE.ExtrudeGeometry(arch, { depth: 1.6, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, 0));
    add(spikeAt(V3(0, 23.5, 0.8), V3(0, 1, 0.15), 9, 1.2, 4));
    const glow = new THREE.Shape();
    glow.moveTo(-5, 0);
    glow.lineTo(5, 0);
    glow.lineTo(5, 12);
    glow.quadraticCurveTo(4.6, 16.5, 0, 19);
    glow.quadraticCurveTo(-4.6, 16.5, -5, 12);
    glow.closePath();
    lights.push(new THREE.ShapeGeometry(glow, 4).translate(0, 0, -4));
    // the gate towers either side, and the corner towers
    for (const s of [-1, 1]) {
      tower(s * 13, -1, -8, 10, 50, 18);
      tower(s * 62, -4, -8, 13, 40, 18);
    }
  }
  // ── the side walls, stepping up the spur
  const wallRun = (ax, az, bx, bz, h, thick = 5) => {
    const len = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.round(len / 8));
    const a = Math.atan2(-(bz - az), bx - ax);
    for (let i = 0; i < steps; i++) {
      const k = (i + 0.5) / steps;
      const x = mix(ax, bx, k);
      const z = mix(az, bz, k);
      const base = spurAt(x, z);
      const seg = len / steps + 0.6;
      add(new THREE.BoxGeometry(seg, h + 12, thick).rotateY(a).translate(x, base + (h - 12) / 2, z));
      for (let m = 0; m < 2; m++) add(new THREE.BoxGeometry(seg * 0.22, 2, thick * 0.7).translate(-seg / 4 + (m * seg) / 2, 0, 0).rotateY(a).translate(x, base + h + 1, z));
    }
  };
  for (const s of [-1, 1]) {
    wallRun(s * 62, -4, s * 52, -58, 20);
    wallRun(s * 52, -58, s * 34, -124, 18);
    tower(s * 52, -58, spurAt(52, -58) - 6, 11, 38, 16);
    tower(s * 34, -124, spurAt(34, -124) - 6, 10, 34, 14);
  }
  // ── the inner walls, tier on tier
  const inner = (z, x0, h, towersAt) => {
    const base = spurAt(0, z);
    box(x0 * 2, h + 10, 4, 0, base + (h - 10) / 2, z);
    merlons(-x0, x0, base + h, z, 3);
    for (let x = -x0 + 6; x < x0; x += 10) if (r() < 0.6) slit(x, base + h - 5, z + 2.05, 0.7, 2.2);
    for (const tx of towersAt) tower(tx, z, base - 6, 8, h + 18, 13);
  };
  inner(-48, 50, 16, [-50, -22, 22, 50]);
  inner(-88, 34, 14, [-34, -12, 12, 34]);
  // ── the houses of the dead city, crowding up the tiers
  const houses = [
    [-56, -10, -44, 56, 8, 20],
    [-46, -54, -84, 46, 10, 26],
    [-32, -94, -130, 32, 12, 30],
  ];
  for (const [x0, z0, z1, x1, h0, h1] of houses) {
    for (let z = z0 - 4; z > z1; z -= 9) {
      for (let x = x0 + 4; x < x1 - 2; x += 8 + r() * 4) {
        if (Math.abs(x) < 4 && z0 === -10) continue; // the street up from the gate
        if (Math.abs(x) < 16 && z < -94 && z > -126) continue; // the tower's foot
        const w = 5 + r() * 5;
        const d = 5 + r() * 4;
        const cx = x + (r() - 0.5) * 2;
        const cz = z + (r() - 0.5) * 2;
        const base = spurAt(cx, cz) - 4;
        const mid = 1 - Math.abs(cx) / Math.max(x1, 1);
        const h = mix(h0, h1, r() * 0.6 + mid * 0.4);
        box(w, h, d, cx, base + h / 2, cz);
        if (r() < 0.65) {
          const rh = h * (0.7 + r() * 0.8);
          add(new THREE.ConeGeometry((Math.max(w, d) * Math.SQRT2) / 2, rh, 4).rotateY(Math.PI / 4).scale(w / Math.max(w, d), 1, d / Math.max(w, d)).rotateZ((r() - 0.5) * 0.12).translate(cx, base + h + rh / 2, cz));
        }
        else {
          add(new THREE.CylinderGeometry(d * 0.62, d * 0.62, w, 3, 1).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).translate(cx, base + h + d * 0.31, cz));
        }
        if (r() < 0.3) add(spikeAt(V3(cx, base + h, cz), V3((r() - 0.5) * 0.1, 1, 0), h * (0.8 + r() * 0.6), 0.9, 4));
        if (r() < 0.3) slit(cx + (r() - 0.5) * w * 0.4, base + h * (0.55 + r() * 0.3), cz + d / 2 + 0.05, 0.4, 2.2);
      }
    }
  }
  // ── the tower in the midst
  const TX = 0;
  const TZ = -110;
  const TB = spurAt(TX, TZ) - 8;
  const dy = TB - 26;
  const TOP = 128 + dy;
  const markS = stone.length;
  const markL = lights.length;
  {
    tier(24, 21, 26, 72, TX, TZ);
    tier(25, 25, 72, 74, TX, TZ);
    tier(17, 14.4, 74, 102, TX, TZ);
    tier(17.6, 17.6, 102, 103.6, TX, TZ);
    tier(12, 9.2, 103.6, 122, TX, TZ);
    add(new THREE.CylinderGeometry(2.6, 3.4, 6, 8).translate(TX, 125, TZ));
    add(new THREE.CylinderGeometry(5.2, 3.2, 1.4, 8).translate(TX, TOP - 0.7, TZ));
    // fins up its corners, running on past each tier as horns
    const fin = (y0, y1, hw0, hw1, horn) => {
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const a = V3(TX + cx * hw0, y0, TZ + cz * hw0);
        const b = V3(TX + cx * hw1, y1, TZ + cz * hw1);
        add(rod(a, b, 1.3, 0.9, 3));
        add(spikeAt(b, V3(cx * 0.35, 1, cz * 0.35), horn, 0.9, 3));
      }
    };
    fin(26, 72, 12.3, 10.8, 9);
    fin(74, 102, 8.8, 7.4, 8);
    fin(103.6, 122, 6.2, 4.8, 7);
    // ribs up the middle of each face
    for (const [fx, fz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      add(rod(V3(TX + fx * 12.2, 30, TZ + fz * 12.2), V3(TX + fx * 10.6, 70, TZ + fz * 10.6), 0.8, 0.6, 3));
      add(rod(V3(TX + fx * 8.6, 76, TZ + fz * 8.6), V3(TX + fx * 7.3, 100, TZ + fz * 7.3), 0.6, 0.5, 3));
    }
    // its windows, slits of light up every face
    for (const [y, hw, w] of [[36, 11.8, 0.6], [52, 11.2, 0.6], [84, 8.2, 0.5], [112, 5.6, 0.45]]) {
      for (const dx of [-0.45, 0.45]) {
        slit(TX + dx * hw, y, TZ + hw + 0.15, w, 3.2);
        slit(TX + dx * hw, y, TZ - hw - 0.15, w, 3.2);
        slit(TX + hw + 0.15, y, TZ + dx * hw, w, 3.2, 'x');
        slit(TX - hw - 0.15, y, TZ + dx * hw, w, 3.2, 'x');
      }
    }
    for (let i = markS; i < stone.length; i++) stone[i].translate(0, dy, 0);
    for (let i = markL; i < lights.length; i++) lights[i].translate(0, dy, 0);
  }
  // ── the bridge: a deck 70 m long on four pointed arches over the gorge,
  // a parapet each side, and the statues along it
  const BW = 9;
  {
    const sh = new THREE.Shape();
    sh.moveTo(0, -27);
    sh.lineTo(70, -27);
    sh.lineTo(70, 0);
    sh.lineTo(0, 0);
    sh.closePath();
    const piers = [0, 17.5, 35, 52.5, 70];
    for (let i = 0; i < 4; i++) {
      const a = piers[i] + (i === 0 ? 4.5 : 2.4);
      const b = piers[i + 1] - (i === 3 ? 4.5 : 2.4);
      const m = (a + b) / 2;
      const hole = new THREE.Path();
      hole.moveTo(a, -27.5);
      hole.lineTo(b, -27.5);
      hole.lineTo(b, -15);
      hole.quadraticCurveTo(b - 0.5, -8.5, m, -5.2);
      hole.quadraticCurveTo(a + 0.5, -8.5, a, -15);
      hole.closePath();
      sh.holes.push(hole);
    }
    add(new THREE.ExtrudeGeometry(sh, { depth: BW, bevelEnabled: false, curveSegments: 5 }).rotateY(-Math.PI / 2).translate(BW / 2, 0, 0));
    // cutwaters on the piers
    for (const z of [17.5, 35, 52.5]) for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.2, 2.6, 26, 3).rotateY(s < 0 ? Math.PI : 0).translate(s * (BW / 2 + 0.6), -14, z));
    // the parapets, with a post under each statue
    for (const s of [-1, 1]) {
      box(0.7, 1.3, 70, s * (BW / 2 - 0.35), 0.65, 35);
      box(1.1, 0.5, 70, s * (BW / 2 - 0.2), -0.35, 35);
    }
  }
  const statues = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const z = 6.5 + i * 11.4;
      const geo = statueGeo(i * 2 + (s > 0 ? 1 : 0) + 3).clone();
      geo.rotateY(s > 0 ? Math.PI : 0).translate(s * (BW / 2 + 0.2), 0, z);
      statues.push(geo);
    }
  }
  const stoneGeo = oneGeo(stone.map((x) => facet(x)));
  boxUV(stoneGeo, 0.1);
  tint(stoneGeo, (x, y, z, out, nx, ny) => {
    out.copy(GHOST.base).multiplyScalar(0.78 + noise3(n, x * 0.05, y * 0.05, z * 0.05) * 0.4);
    out.lerp(GHOST.pale, smooth(0.5, 0.9, ny) * 0.5);
    out.lerp(GHOST.dark, (1 - smooth(-20, 6, y)) * 0.5);
  });
  const city = new THREE.Mesh(stoneGeo, ghost);
  city.name = 'city';
  g.add(city);
  const statueMesh = new THREE.Mesh(oneGeo(statues), mats.statue);
  statueMesh.name = 'statues';
  g.add(statueMesh);
  const lightMat = new THREE.MeshBasicMaterial({ color: hot(0x86ffa4, 2.2), fog: true });
  const lit = new THREE.Mesh(oneGeo(lights), lightMat);
  lit.name = 'windows';
  g.add(lit);

  // ── the crown, turning slowly: eight curved blades round a light
  const crown = new THREE.Group();
  crown.name = 'crown';
  crown.position.set(TX, TOP, TZ);
  crown.scale.setScalar(1.35);
  g.add(crown);
  {
    const blades = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const R = (rr, y) => V3(Math.cos(a) * rr, y, Math.sin(a) * rr);
      const side = [-Math.sin(a), 0, Math.cos(a)];
      const tall = i % 2 ? 0.8 : 1;
      blades.push(sweep([R(3.4, 0), R(6.2, 6 * tall), R(5.6, 12 * tall), R(2.6, 19 * tall)], [[0.5, 1.4, 0.5], [0.45, 1.2, 0.45], [0.3, 0.8, 0.3], [0.05, 0.08, 0.05]], { seg: 8, radial: 6, side }));
      blades.push(spikeAt(R(6.2, 6 * tall), V3(Math.cos(a), 0.6, Math.sin(a)), 4, 0.35, 3));
    }
    blades.push(new THREE.TorusGeometry(3.8, 0.5, 4, 16).rotateX(Math.PI / 2).translate(0, 0.4, 0));
    blades.push(new THREE.TorusGeometry(5.6, 0.35, 4, 16).rotateX(Math.PI / 2).translate(0, 9, 0));
    const cg = oneGeo(blades.map((x) => facet(x)));
    tint(cg, (x, y, z, out) => out.copy(GHOST.pale).multiplyScalar(0.85 + noise3(n, x * 0.3, y * 0.3, z * 0.3) * 0.3));
    const cm = new THREE.Mesh(cg, ghost);
    cm.name = 'crownBlades';
    crown.add(cm);
  }
  const ORB_Y = TOP + 9;
  const orbMat = new THREE.MeshBasicMaterial({ color: hot(0xa0ffb8, 2.6) });
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 2), orbMat);
  orb.position.set(TX, ORB_Y, TZ);
  orb.name = 'orb';
  g.add(orb);
  const flareMat = new THREE.SpriteMaterial({ map: K.tex.glow, color: hot(0x6aff8e, 1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const flare = new THREE.Sprite(flareMat);
  flare.position.copy(orb.position);
  flare.scale.setScalar(26);
  flare.renderOrder = 6;
  g.add(flare);

  // ── the beam, in three: a white-hot thread, the beam, and its haze
  const H = 340;
  const beam = new THREE.Group();
  beam.name = 'beam';
  beam.position.set(TX, ORB_Y, TZ);
  g.add(beam);
  const layer = (r0, r1, mat) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, H, 20, 1, true).translate(0, H / 2, 0), mat);
    m.frustumCulled = false;
    m.renderOrder = 7;
    beam.add(m);
    return m;
  };
  layer(1.1, 1.7, K.shaders.beam(U, { k: 1, core: 5, edge: 1.2 }));
  layer(3.0, 4.6, K.shaders.beam(U, { k: 0.8, core: 1.7, edge: 2.6 }));
  layer(8, 13, K.shaders.beam(U, { k: 0.14, core: 0.8, edge: 1.6 }));
  const splash = new THREE.Mesh(new THREE.CircleGeometry(110, 32).rotateX(Math.PI / 2), K.shaders.splash(U));
  splash.position.y = H * 0.82;
  splash.renderOrder = 7;
  splash.frustumCulled = false;
  beam.add(splash);

  // ── the land: the spur under the city, the valley's walls rising either
  // side and behind, the gorge of the Morgulduin, its black water
  const land = [];
  {
    const nx = 72;
    const nz = 40;
    const x0 = -360;
    const z0 = -360;
    const z1 = 4;
    const pos = [];
    const idx = [];
    const h = (x, z) => {
      const ax = Math.abs(x);
      const near = smooth(4, -45, z);
      const walls = 240 * smooth(80, 300, ax + (n(x * 0.008, z * 0.008) - 0.5) * 90) * near;
      const back = 190 * smooth(-150, -350, z + (n(x * 0.01 + 4, 2) - 0.5) * 60) * (0.45 + 0.55 * smooth(0, 140, ax));
      const crag = (fbm(n, x * 0.02, z * 0.02, { octaves: 4 }) - 0.5) * 50 * smooth(20, 120, walls + back);
      return Math.max(spurAt(x, z) - 2.5 + (n(x * 0.1, z * 0.1) - 0.5) * 2, walls + back + crag - 1.5);
    };
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        const x = x0 + (i / nx) * 720 + (i > 0 && i < nx ? (r() - 0.5) * 4 : 0);
        const z = z0 + (j / nz) * (z1 - z0) + (j > 0 && j < nz ? (r() - 0.5) * 3 : 0);
        pos.push(x, h(x, z), z);
      }
    }
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i;
        idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    land.push(facet(geo));
    // the far walls on the near side of the valley, left and right
    for (const s of [-1, 1]) {
      const p2 = [];
      const i2 = [];
      const mx = 14;
      const mz = 16;
      for (let j = 0; j <= mz; j++) {
        for (let i = 0; i <= mx; i++) {
          const x = s * (170 + (i / mx) * 190);
          const z = 66 + (j / mz) * 260;
          const ax = Math.abs(x);
          const y = 230 * smooth(190, 340, ax + (n(x * 0.01, z * 0.01) - 0.5) * 70) * smooth(66, 120, z) + (fbm(n, x * 0.02 + 9, z * 0.02, { octaves: 3 }) - 0.5) * 30 * smooth(190, 260, ax) - 1.5;
          p2.push(x, y, z);
        }
      }
      for (let j = 0; j < mz; j++) {
        for (let i = 0; i < mx; i++) {
          const a = j * (mx + 1) + i;
          if (s > 0) i2.push(a, a + mx + 1, a + 1, a + 1, a + mx + 1, a + mx + 2);
          else i2.push(a, a + 1, a + mx + 1, a + 1, a + mx + 2, a + mx + 1);
        }
      }
      const g2 = new THREE.BufferGeometry();
      g2.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3));
      g2.setIndex(i2);
      land.push(facet(g2));
    }
    // the gorge's walls: from the lip (y −1.5) down to the river, jagged
    for (const [zt, zb, sgn] of [[4, 9, 1], [66, 61, -1]]) {
      const p3 = [];
      const i3 = [];
      const cols = 120;
      const rows = 6;
      for (let j = 0; j <= rows; j++) {
        for (let i = 0; i <= cols; i++) {
          const x = -360 + (i / cols) * 720;
          const k = j / rows;
          const y = mix(-1.5, -27, k);
          const z = mix(zt, zb, Math.pow(k, 0.7)) + (fbm(n, x * 0.06, y * 0.12 + zt, { octaves: 3 }) - 0.5) * 5 * Math.sin(Math.PI * k) * sgn;
          p3.push(x, y, z);
        }
      }
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const a = j * (cols + 1) + i;
          if (sgn < 0) i3.push(a, a + 1, a + cols + 1, a + 1, a + cols + 2, a + cols + 1);
          else i3.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2);
        }
      }
      const g3 = new THREE.BufferGeometry();
      g3.setAttribute('position', new THREE.Float32BufferAttribute(p3, 3));
      g3.setIndex(i3);
      land.push(facet(g3));
    }
    // a lip of ground on the near bank, where the bridge lands
    land.push(new THREE.PlaneGeometry(320, 14, 1, 1).rotateX(-Math.PI / 2).translate(0, -1.5, 73));
  }
  const landGeo = oneGeo(land);
  boxUV(landGeo, 0.05);
  tint(landGeo, (x, y, z, out, nx, ny, nz) => {
    out.copy(DARK.base).multiplyScalar(0.45 + noise3(n, x * 0.02, y * 0.02, z * 0.02) * 0.5);
    out.lerp(DARK.dark, smooth(0.6, 0.95, ny) * 0.4 + (1 - smooth(-26, -8, y)) * 0.4);
    // the faces turned to the city catch its light
    const toCity = clamp01(-(x * nx + (z + 100) * nz) / Math.max(1, Math.hypot(x, z + 100)));
    out.lerp(DARK.green, toCity * (1 - smooth(60, 260, Math.hypot(x, z + 100))) * 0.5);
  });
  const ground = new THREE.Mesh(landGeo, mats.rock);
  ground.name = 'valley';
  g.add(ground);
  const river = new THREE.Mesh(new THREE.PlaneGeometry(720, 56).rotateX(-Math.PI / 2).translate(0, -24.5, 35), mats.morgulWater);
  river.name = 'morgulduin';
  g.add(river);

  const glowBase = lightMat.color.clone();
  const orbBase = orbMat.color.clone();
  const update = (t, { beam: b = 0, glow = 1 } = {}) => {
    U.uTime.value = t;
    U.uGlow.value = glow;
    U.uBeam.value = clamp01(b);
    const on = clamp01(b);
    crown.rotation.y = t * 0.12;
    lightMat.color.copy(glowBase).multiplyScalar((0.35 + 0.65 * glow) * (1 + on * 0.5));
    orbMat.color.copy(orbBase).multiplyScalar((0.5 + 0.5 * glow) * (1 + on * 1.8));
    flareMat.color.copy(hot(0x6aff8e, 1.6)).multiplyScalar(0.5 + glow * 0.5 + on * 1.5);
    flare.scale.setScalar(22 + on * 26 + Math.sin(t * 9) * on * 3);
    beam.visible = on > 0.001;
    mats.statue.emissiveIntensity = 0.35 * glow + on * 0.25;
  };
  update(0);
  return { group: g, bridgeEnd: V3(0, 0, 70), top: V3(TX, ORB_Y, TZ), crown, update };
}

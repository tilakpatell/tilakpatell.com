// The courtyard of the Tower of Cirith Ungol. Moved out of props.js as it
// was.

import * as THREE from 'three';
import { clamp01, makeNoise, mix, smooth } from '../../../../lib/paint';
import { hot } from '../../../../lib/three/canvasTexture';
import { boxUV, rng } from '../../shire/build';
import { _kd, C, facet, noise3, oneGeo, rod, shardGeo, solid, spikeAt, sweep, TAU, tint, V3 } from './helpers';
import { deadOrcGeo, ORC } from './orcs';

// ── the Tower of Cirith Ungol ──

const TOWER = { stone: C(0x302c2a), dark: C(0x0e0c0c), soot: C(0x1a1614), pale: C(0x4c4642), red: C(0x5a2418) };

// The courtyard inside the Tower of Cirith Ungol: high black walls round a
// court `w` × `d` (x from −w/2 to w/2, z from −d/2 to d/2), square pillars
// at `pillars` [x, z], a dark doorway into the stair at `door` in the north
// wall; torches in iron brackets, dead orcs and smashed weapons on the
// flags; over the north wall the Tower climbing, horned, its slits lit
// red, into a dark red sky (the `sky` dome, which a scene with its own can
// drop). Returns the torches' flames (local) and update(t) to flicker them.
export function court(K, { w = 44, d = 30, pillars = [], door = { x: 0, z: -15 } } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'towerCourt';
  const n = makeNoise(707);
  const r = rng(709);
  const HW = 15;
  const TH = 3;
  const stone = [];
  const fire = [];
  const iron = [];
  const add = (geo) => stone.push(geo);
  const box = (bw, bh, bd, x, y, z) => add(new THREE.BoxGeometry(bw, bh, bd).translate(x, y, z));
  const hx = w / 2;
  const hz = d / 2;
  // ── the floor
  const floorGeo = new THREE.PlaneGeometry(w + 2 * TH, d + 2 * TH, 1, 1).rotateX(-Math.PI / 2);
  const fuv = floorGeo.attributes.uv;
  for (let i = 0; i < fuv.count; i++) fuv.setXY(i, (fuv.getX(i) * (w + 2 * TH)) / 5, (fuv.getY(i) * (d + 2 * TH)) / 5);
  const floor = new THREE.Mesh(floorGeo, mats.flags);
  floor.name = 'flags';
  g.add(floor);
  // ── the walls: the north one with the door in it
  const dw = 3.2;
  const dh = 4.6;
  {
    const sh = new THREE.Shape();
    sh.moveTo(-hx - TH, -0.5);
    sh.lineTo(hx + TH, -0.5);
    sh.lineTo(hx + TH, HW);
    sh.lineTo(-hx - TH, HW);
    sh.closePath();
    const hole = new THREE.Path();
    hole.moveTo(door.x - dw / 2, -0.51);
    hole.lineTo(door.x + dw / 2, -0.51);
    hole.lineTo(door.x + dw / 2, dh - 1);
    hole.quadraticCurveTo(door.x + dw / 2 - 0.1, dh - 0.2, door.x, dh + 0.3);
    hole.quadraticCurveTo(door.x - dw / 2 + 0.1, dh - 0.2, door.x - dw / 2, dh - 1);
    hole.closePath();
    sh.holes.push(hole);
    add(new THREE.ExtrudeGeometry(sh, { depth: TH, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -hz - TH));
  }
  box(w + 2 * TH, HW + 0.5, TH, 0, HW / 2 - 0.25, hz + TH / 2);
  box(TH, HW + 0.5, d, -hx - TH / 2, HW / 2 - 0.25, 0);
  box(TH, HW + 0.5, d, hx + TH / 2, HW / 2 - 0.25, 0);
  // pilasters up the inner faces, a ledge, battlements; not by the door
  const faceRun = (len, fn) => {
    for (let t = -len / 2 + 3; t <= len / 2 - 2.5; t += 5.5) fn(t);
  };
  faceRun(w, (x) => {
    if (Math.abs(x - door.x) > 3) box(0.9, HW, 0.3, x, HW / 2, -hz + 0.15);
    box(0.9, HW, 0.3, x, HW / 2, hz - 0.15);
  });
  faceRun(d, (z) => {
    box(0.3, HW, 0.9, -hx + 0.15, HW / 2, z);
    box(0.3, HW, 0.9, hx - 0.15, HW / 2, z);
  });
  box(w, 0.5, 0.5, 0, 9.5, -hz + 0.25);
  box(w, 0.5, 0.5, 0, 9.5, hz - 0.25);
  box(0.5, 0.5, d, -hx + 0.25, 9.5, 0);
  box(0.5, 0.5, d, hx - 0.25, 9.5, 0);
  const merl = (x0, x1, z0, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const cnt = Math.floor(len / 2.2);
    for (let i = 0; i < cnt; i++) {
      const k = (i + 0.5) / cnt;
      const x = mix(x0, x1, k);
      const z = mix(z0, z1, k);
      box(x0 === x1 ? 0.8 : 1.1, 1.8, x0 === x1 ? 1.1 : 0.8, x, HW + 0.9, z);
      if (i % 3 === 0) add(spikeAt(V3(x, HW + 1.8, z), V3(0, 1, 0), 1.4, 0.25, 4));
    }
  };
  merl(-hx - TH, hx + TH, -hz - 0.4, -hz - 0.4);
  merl(-hx - TH, hx + TH, hz + 0.4, hz + 0.4);
  merl(-hx - 0.4, -hx - 0.4, -hz, hz);
  merl(hx + 0.4, hx + 0.4, -hz, hz);
  // the door's frame, stepped out, and one iron leaf hanging open
  {
    const fr = new THREE.Shape();
    fr.moveTo(door.x - dw / 2 - 0.7, 0);
    fr.lineTo(door.x - dw / 2 - 0.7, dh - 0.6);
    fr.quadraticCurveTo(door.x - dw / 2 - 0.4, dh + 0.8, door.x, dh + 1.3);
    fr.quadraticCurveTo(door.x + dw / 2 + 0.4, dh + 0.8, door.x + dw / 2 + 0.7, dh - 0.6);
    fr.lineTo(door.x + dw / 2 + 0.7, 0);
    fr.lineTo(door.x + dw / 2, 0);
    fr.lineTo(door.x + dw / 2, dh - 1);
    fr.quadraticCurveTo(door.x + dw / 2 - 0.1, dh - 0.2, door.x, dh + 0.3);
    fr.quadraticCurveTo(door.x - dw / 2 + 0.1, dh - 0.2, door.x - dw / 2, dh - 1);
    fr.lineTo(door.x - dw / 2, 0);
    fr.closePath();
    add(new THREE.ExtrudeGeometry(fr, { depth: 0.35, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -hz));
    add(spikeAt(V3(door.x, dh + 1.2, -hz + 0.2), V3(0, 1, 0.3), 1.6, 0.3, 4));
    const leaf = new THREE.BoxGeometry(dw / 2, dh - 0.6, 0.12).translate(dw / 4, (dh - 0.6) / 2, 0);
    for (let i = 0; i < 4; i++) iron.push(new THREE.BoxGeometry(dw / 2, 0.12, 0.05).translate(dw / 4, 0.5 + i * 1.1, 0.07).rotateY(-1.9).translate(door.x - dw / 2, 0, -hz + 0.05));
    iron.push(leaf.rotateY(-1.9).translate(door.x - dw / 2, 0, -hz + 0.05));
  }
  // ── the stair inside the door: a dark well, steps going up into it
  const well = [];
  {
    const x0 = door.x;
    const z0 = -hz - TH;
    const room = new THREE.BoxGeometry(5, 9, 6).translate(x0, 4.5, z0 - 3);
    const idx = room.index.array;
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    room.computeVertexNormals();
    well.push(room);
    for (let i = 0; i < 10; i++) well.push(new THREE.BoxGeometry(1.8, 0.24, 0.5).translate(x0 - 1.4, 0.12 + i * 0.24, z0 - 0.6 - i * 0.5));
    for (let i = 0; i < 10; i++) well.push(new THREE.BoxGeometry(1.4, 0.24 * (i + 1), 0.5).translate(x0 - 1.6, (0.24 * (i + 1)) / 2, z0 - 0.6 - i * 0.5));
  }
  // ── the pillars
  for (const [x, z] of pillars) {
    box(2.1, 0.7, 2.1, x, 0.35, z);
    box(1.5, 11, 1.5, x, 6.2, z);
    box(1.8, 0.4, 1.8, x, 1.0, z);
    box(2.2, 0.9, 2.2, x, 11.9, z);
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(spikeAt(V3(x + cx * 0.9, 12.3, z + cz * 0.9), V3(cx * 0.3, 1, cz * 0.3), 1.2, 0.18, 4));
    add(spikeAt(V3(x, 12.3, z), V3(0, 1, 0), 2.2, 0.35, 4));
  }
  // ── torches: on the walls between the pilasters, and on some pillars
  const torches = [];
  const torch = (x, y, z, ox, oz) => {
    const base = V3(x, y, z);
    const tip = V3(x + ox * 0.45, y + 0.35, z + oz * 0.45);
    iron.push(rod(base, tip, 0.035, 0.03, 5));
    iron.push(new THREE.BoxGeometry(0.18, 0.3, 0.18).translate(x, y, z));
    iron.push(new THREE.CylinderGeometry(0.1, 0.06, 0.16, 6, 1, true).translate(tip.x, tip.y + 0.04, tip.z));
    iron.push(new THREE.CylinderGeometry(0.04, 0.035, 0.35, 5).translate(tip.x, tip.y + 0.15, tip.z));
    torches.push(V3(tip.x, tip.y + 0.48, tip.z));
  };
  for (const x of [-hx + 6, -hx + 17, hx - 12]) torch(x, 3.3, -hz + 0.1, 0, 1);
  torch(door.x - dw / 2 - 1.3, 3.3, -hz + 0.1, 0, 1);
  torch(door.x + dw / 2 + 1.3, 3.3, -hz + 0.1, 0, 1);
  for (const x of [-hx + 8, 0, hx - 8]) torch(x, 3.3, hz - 0.1, 0, -1);
  for (const z of [-hz + 8, hz - 8]) {
    torch(-hx + 0.1, 3.3, z, 1, 0);
    torch(hx - 0.1, 3.3, z, -1, 0);
  }
  pillars.forEach(([x, z], i) => {
    if (i % 2 === 0) torch(x, 3.0, z + 0.78, 0, 1);
  });
  // flames: a ragged tongue and a glow about it
  const flames = torches.map((p, i) => {
    const fm = new THREE.SpriteMaterial({ map: K.tex.flame, color: hot(0xffa850, 2.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const f = new THREE.Sprite(fm);
    f.position.copy(p);
    f.scale.set(0.38, 0.72, 1);
    f.renderOrder = 6;
    g.add(f);
    const gm = new THREE.SpriteMaterial({ map: K.tex.glow, color: hot(0xff6a24, 1.1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 });
    const gl = new THREE.Sprite(gm);
    gl.position.copy(p).add(V3(0, -0.1, 0));
    gl.scale.setScalar(1.8);
    gl.renderOrder = 6;
    g.add(gl);
    return { f, gl, ph: i * 1.7 };
  });
  // ── the Tower over the north wall, horned and jagged, slits of fire
  {
    const tz = -hz - TH;
    const tier = (bw, bh, bd, x, y0, z) => {
      box(bw, bh, bd, x, y0 + bh / 2, z);
      box(bw + 0.8, 0.8, bd + 0.8, x, y0 + bh - 0.4, z);
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(spikeAt(V3(x + (cx * bw) / 2, y0 + bh, z + (cz * bd) / 2), V3(cx * 0.5, 1, cz * 0.5), 3 + r() * 2.5, 0.5, 4));
    };
    tier(36, 34, 26, 2, -0.5, tz - 13);
    tier(26, 16, 18, 4, 33.5, tz - 12);
    tier(16, 14, 12, 6, 49.5, tz - 12);
    tier(9, 9, 8, 7, 63.5, tz - 11);
    // the horn on its top, hooked over, and lesser spines
    add(sweep([[7, 72, tz - 11], [8, 80, tz - 11.5], [11, 86, tz - 10], [15, 87, tz - 8]], [[1.8], [1.3], [0.7], [0.08]], { seg: 10, radial: 6 }));
    add(sweep([[4, 72, tz - 13], [2, 78, tz - 14], [0, 81, tz - 13]], [[1], [0.6], [0.05]], { seg: 6, radial: 5 }));
    // buttresses down its face, like ribs
    for (const x of [-12, -4, 8, 16]) add(rod(V3(x, 0, tz + 0.2), V3(x * 0.8 + 1, 33, tz - 1.5), 1.4, 0.8, 4));
    for (const [y, x0, x1, zf] of [[18, -12, 16, tz + 0.1], [26, -10, 14, tz + 0.1], [40, -6, 14, tz - 2.9], [56, 0, 12, tz - 5.9], [67, 4, 10, tz - 6.9]]) {
      for (let x = x0; x <= x1; x += 4.5) if (r() < 0.6) fire.push(new THREE.BoxGeometry(0.35, 1.8, 0.3).translate(x + (r() - 0.5), y, zf));
    }
    // the cliffs it is built against, either side
    for (const s of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const sg = shardGeo(800 + k + (s > 0 ? 10 : 0), { detail: 1, planes: 7, cut: 0.45, amp: 0.7 });
        sg.scale(22 + r() * 14, 60 + r() * 50, 24 + r() * 10).translate(s * (hx + 14 + k * 16), 20 + r() * 10, tz - 18 - k * 8 - r() * 10);
        add(sg);
      }
    }
  }
  const stoneGeo = oneGeo(stone.map((x) => facet(x)));
  boxUV(stoneGeo, 0.4);
  tint(stoneGeo, (x, y, z, out, nx, ny) => {
    out.copy(TOWER.stone).multiplyScalar(0.65 + noise3(n, x * 0.15, y * 0.15, z * 0.15) * 0.6);
    out.lerp(TOWER.soot, smooth(0.5, 0.75, noise3(n, x * 0.4 + 3, y * 0.2, z * 0.4)) * 0.6);
    out.lerp(TOWER.dark, (1 - smooth(0, 2.5, y)) * 0.35);
    if (ny > 0.7) out.lerp(TOWER.pale, 0.25);
  });
  const walls = new THREE.Mesh(stoneGeo, mats.blackStone);
  walls.name = 'walls';
  g.add(walls);
  const wellGeo = oneGeo(well.map((x) => facet(x)));
  boxUV(wellGeo, 0.4);
  tint(wellGeo, (x, y, z, out) => out.copy(TOWER.dark).multiplyScalar(0.8 + noise3(n, x, y, z) * 0.4));
  const wellMesh = new THREE.Mesh(wellGeo, mats.blackStone);
  wellMesh.name = 'stairwell';
  g.add(wellMesh);
  const ironMesh = new THREE.Mesh(oneGeo(iron.map((x) => solid(x, C(0x2a2624)))), mats.orcGear);
  ironMesh.name = 'iron';
  g.add(ironMesh);
  const slits = new THREE.Mesh(oneGeo(fire), mats.slit);
  slits.name = 'slits';
  g.add(slits);
  // ── the dead, and their smashed weapons
  const dead = [];
  const spots = [[-15, -4], [-6, -9], [7, 2], [-3, 8], [14, -9], [17, 10], [-18, 9], [9, 12]];
  spots.forEach(([x, z], i) => {
    for (const geo of deadOrcGeo(30 + i)) dead.push(geo.translate(x + (r() - 0.5) * 1.5, 0, z + (r() - 0.5) * 1.5));
  });
  const nW = makeNoise(77);
  for (let i = 0; i < 26; i++) {
    const x = (r() - 0.5) * (w - 4);
    const z = (r() - 0.5) * (d - 4);
    const kind = r();
    const yaw = r() * TAU;
    let parts2;
    if (kind < 0.3) {
      // a broken spear, its head still on
      const L = 0.6 + r() * 0.8;
      parts2 = [solid(new THREE.CylinderGeometry(0.018, 0.018, L, 4).rotateZ(Math.PI / 2).translate(L / 2, 0.02, 0), ORC.shaft), solid(new THREE.ConeGeometry(0.05, 0.3, 4).scale(1, 1, 0.35).rotateZ(-Math.PI / 2).translate(L + 0.15, 0.02, 0), ORC.steel)];
    } else if (kind < 0.55) {
      // a jagged blade, snapped
      const sh = new THREE.Shape();
      const L = 0.3 + r() * 0.35;
      sh.moveTo(0, 0.02);
      sh.lineTo(L, 0.04);
      sh.lineTo(L * 0.9, -0.05);
      sh.lineTo(L * 0.6, -0.07);
      sh.lineTo(L * 0.5, -0.04);
      sh.lineTo(0, -0.03);
      sh.closePath();
      parts2 = [solid(new THREE.ExtrudeGeometry(sh, { depth: 0.014, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, 0.01, 0), ORC.steel), solid(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 5).rotateZ(Math.PI / 2).translate(-0.07, 0.02, 0), ORC.leather)];
    } else if (kind < 0.75) {
      // a helm, rolled on its side
      parts2 = [solid(new THREE.SphereGeometry(0.13, 7, 4, 0, TAU, 0, Math.PI * 0.5).scale(1.15, 0.85, 1.05).rotateZ(1.2).translate(0, 0.11, 0), ORC.iron)];
    } else {
      // a round shield, split
      parts2 = [solid(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 12, 1, false, 0, Math.PI * (1.2 + r() * 0.6)).rotateX((r() - 0.5) * 0.2).translate(0, 0.03, 0), ORC.iron), solid(new THREE.SphereGeometry(0.08, 6, 3, 0, TAU, 0, Math.PI / 2).translate(0, 0.05, 0), ORC.edge)];
    }
    for (const p2 of parts2) {
      tint(p2, (px, py, pz, out) => out.multiplyScalar(0.75 + noise3(nW, px * 9 + i, py * 9, pz * 9) * 0.5));
      dead.push(p2.rotateY(yaw).translate(x, 0, z));
    }
  }
  const deadMesh = new THREE.Mesh(oneGeo(dead), mats.orc);
  deadMesh.name = 'dead';
  g.add(deadMesh);
  // ── the sky: black overhead, dull red low down, brightest in the east
  const skyGeo = new THREE.SphereGeometry(420, 32, 14, 0, TAU, 0, Math.PI / 2);
  tint(skyGeo, (x, y, z, out) => {
    const up = clamp01(y / 420);
    const east = clamp01((x / 420) * 0.5 + 0.5);
    out.setRGB(0.32, 0.06, 0.03).multiplyScalar(0.55 + east * 0.6).lerp(_kd.setRGB(0.025, 0.01, 0.01), smooth(0.02, 0.55, up));
  });
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.name = 'sky';
  sky.renderOrder = -1;
  g.add(sky);
  const update = (t) => {
    for (const { f, gl, ph } of flames) {
      const k = 1 + Math.sin(t * 13 + ph) * 0.1 + Math.sin(t * 29 + ph * 3) * 0.06;
      f.scale.set(0.38 * (2 - k), 0.72 * k, 1);
      gl.material.opacity = 0.45 + 0.12 * Math.sin(t * 17 + ph * 2);
    }
  };
  update(0);
  return { group: g, torches, sky, update };
}

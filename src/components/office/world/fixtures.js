// What a real office has that nobody notices until it's missing. On the
// ceiling: one 2×4 ft tile grid over the whole floor (anchored to the
// building, not to each room, so it runs on unbroken from room to room),
// with the troffers, the square supply diffusers, the egg-crate return
// grilles, the sprinkler heads and a smoke detector in each room all sat in
// its tiles. On the walls: outlets along the skirting, a light switch by
// every door, the thermostat, fire extinguishers and the red pull stations
// by the exits. All of it instanced: a handful of draws.
//
// ceilingPlan() → { troffers, diffusers, grilles, sprinklers, detectors }
//   (world [x, z] tile centres; the troffers are drawn by ./set.js)
// buildFixtures({ T }) → { group, dispose() }

import * as THREE from 'three';
import { CEILING, DOORS, P, ROOMS, SOLID, rect, roomAt } from './layout';
import { sharpen } from '../../../lib/three/textures';

export const TILE_X = 1.22; // the grid: 4 ft along x
const TILE_Z = 0.61; // 2 ft along z
const CEILED = ['bullpen', 'michael', 'conference', 'hallway', 'men', 'women', 'annex', 'breakroom', 'darryl', 'supplies', 'lobby'];

// every tile centre in a room (and in no smaller room inside it), clear of its walls
function tilesIn(id, margin = 0.35) {
  const m = rect(ROOMS[id]);
  const out = [];
  for (let i = Math.ceil((m.x + margin) / TILE_X - 0.5); (i + 0.5) * TILE_X <= m.x + m.w - margin; i++)
    for (let k = Math.ceil((m.z + margin) / TILE_Z - 0.5); (k + 0.5) * TILE_Z <= m.z + m.d - margin; k++) {
      const x = (i + 0.5) * TILE_X;
      const z = (k + 0.5) * TILE_Z;
      if (roomAt(x, z) === id) out.push({ i, k, x, z });
    }
  return out;
}

export function ceilingPlan() {
  const plan = { troffers: [], diffusers: [], grilles: [], sprinklers: [], detectors: [] };
  const mod = (n, m) => ((n % m) + m) % m;
  for (const id of CEILED) {
    const tiles = tilesIn(id);
    if (!tiles.length) continue;
    const small = tiles.length < 14;
    const used = new Set();
    const take = (list, t) => {
      list.push([t.x, t.z]);
      used.add(t);
    };
    // troffers every other column, every fourth row; a small room gets its middle one
    const lights = tiles.filter((t) => mod(t.i, 2) === 0 && mod(t.k, 4) === 1);
    if (small || !lights.length) {
      const m = rect(ROOMS[id]);
      const mid = tiles.reduce((a, t) => (Math.hypot(t.x - m.cx, t.z - m.cz) < Math.hypot(a.x - m.cx, a.z - m.cz) ? t : a));
      take(plan.troffers, mid);
      if (tiles.length > 6) {
        const far = tiles.filter((t) => Math.abs(t.i - mid.i) >= 2 || Math.abs(t.k - mid.k) >= 4).sort((a, b) => Math.hypot(b.x - mid.x, b.z - mid.z) - Math.hypot(a.x - mid.x, a.z - mid.z))[0];
        if (far && Math.hypot(far.x - mid.x, far.z - mid.z) > 2.2) take(plan.troffers, far);
      }
    } else for (const t of lights) take(plan.troffers, t);
    for (const t of tiles) {
      if (used.has(t)) continue;
      if (mod(t.i, 4) === 3 && mod(t.k, 4) === 3) take(plan.diffusers, t);
      else if (mod(t.i, 4) === 1 && mod(t.k, 8) === 7) take(plan.grilles, t);
      else if (mod(t.i, 2) === 0 && mod(t.k, 4) === 3) take(plan.sprinklers, t);
    }
    // a small room: one diffuser, one sprinkler
    if (small) {
      const free = tiles.filter((t) => !used.has(t));
      if (free[0]) take(plan.diffusers, free[0]);
      if (free[free.length - 1] && free.length > 1) take(plan.sprinklers, free[free.length - 1]);
    }
    // the smoke detector, on a free tile near the middle
    const m = rect(ROOMS[id]);
    const free = tiles.filter((t) => !used.has(t)).sort((a, b) => Math.hypot(a.x - m.cx, a.z - m.cz) - Math.hypot(b.x - m.cx, b.z - m.cz));
    if (free[0]) plan.detectors.push([free[0].x + 0.3, free[0].z]);
  }
  return plan;
}

// ── painted faces ──
const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const tex = (c) => {
  const t = new THREE.CanvasTexture(c);
  sharpen(t, { color: true });
  return t;
};
// a square supply diffuser: concentric louvres round a square centre
function diffuserTex() {
  const c = canvas(128, 128);
  const x = c.getContext('2d');
  x.fillStyle = '#d9d8d2';
  x.fillRect(0, 0, 128, 128);
  for (let r = 0; r < 4; r++) {
    const o = 10 + r * 12;
    x.fillStyle = '#8d8c87';
    x.fillRect(o, o, 128 - o * 2, 128 - o * 2);
    x.fillStyle = r === 3 ? '#cfcec8' : '#e8e7e2';
    x.fillRect(o + 4, o + 4, 128 - (o + 4) * 2, 128 - (o + 4) * 2);
  }
  x.strokeStyle = '#b5b4ae';
  x.lineWidth = 3;
  x.strokeRect(1.5, 1.5, 125, 125);
  return tex(c);
}
// an egg-crate return grille: a fine square lattice, dark behind
function grilleTex() {
  const c = canvas(256, 128);
  const x = c.getContext('2d');
  x.fillStyle = '#3b3c3e';
  x.fillRect(0, 0, 256, 128);
  x.fillStyle = '#dcdbd5';
  for (let i = 0; i <= 256; i += 9) x.fillRect(i, 0, 2, 128);
  for (let k = 0; k <= 128; k += 9) x.fillRect(0, k, 256, 2);
  x.strokeStyle = '#e4e3dd';
  x.lineWidth = 8;
  x.strokeRect(4, 4, 248, 120);
  return tex(c);
}
// an outlet's plate and a switch's
function plateTex(kind) {
  const c = canvas(64, 96);
  const x = c.getContext('2d');
  x.fillStyle = '#efece4';
  x.fillRect(0, 0, 64, 96);
  x.fillStyle = '#c9c5bb';
  x.fillRect(0, 0, 64, 2);
  x.fillRect(0, 94, 64, 2);
  x.fillStyle = '#2a2a2a';
  if (kind === 'outlet')
    for (const y of [22, 60]) {
      x.fillStyle = '#e4e0d6';
      x.beginPath();
      x.roundRect(14, y - 8, 36, 26, 8);
      x.fill();
      x.fillStyle = '#2a2a2a';
      x.fillRect(22, y - 2, 3, 9);
      x.fillRect(38, y - 2, 3, 11);
      x.beginPath();
      x.arc(32, y + 12, 2.6, 0, Math.PI * 2);
      x.fill();
    }
  else {
    x.fillStyle = '#d6d2c8';
    x.fillRect(26, 30, 12, 36);
    x.fillStyle = '#f7f5ef';
    x.fillRect(27, 31, 10, 18);
  }
  return tex(c);
}
function pullTex() {
  const c = canvas(96, 128);
  const x = c.getContext('2d');
  x.fillStyle = '#c4161c';
  x.fillRect(0, 0, 96, 128);
  x.fillStyle = '#fff';
  x.textAlign = 'center';
  x.font = 'bold 26px Arial';
  x.fillText('FIRE', 48, 34);
  x.fillStyle = '#e8e8e8';
  x.fillRect(24, 50, 48, 26);
  x.fillStyle = '#c4161c';
  x.font = 'bold 12px Arial';
  x.fillText('PULL', 48, 62);
  x.fillText('DOWN', 48, 74);
  x.fillStyle = '#fff';
  x.font = 'bold 13px Arial';
  x.fillText('ALARM', 48, 108);
  return tex(c);
}
function signTex(text, bg = '#c4161c') {
  const c = canvas(256, 72);
  const x = c.getContext('2d');
  x.fillStyle = bg;
  x.fillRect(0, 0, 256, 72);
  x.fillStyle = '#fff';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = 'bold 30px Arial';
  x.fillText(text, 128, 38);
  return tex(c);
}
function thermostatTex() {
  const c = canvas(96, 128);
  const x = c.getContext('2d');
  x.fillStyle = '#efede6';
  x.fillRect(0, 0, 96, 128);
  x.fillStyle = '#9fb7a0';
  x.fillRect(16, 22, 64, 34);
  x.fillStyle = '#26332a';
  x.font = 'bold 26px monospace';
  x.textAlign = 'center';
  x.fillText('68°', 48, 49);
  x.fillStyle = '#c9c6bd';
  for (const [bx, by] of [
    [30, 80],
    [66, 80],
    [48, 102],
  ]) {
    x.beginPath();
    x.arc(bx, by, 8, 0, Math.PI * 2);
    x.fill();
  }
  return tex(c);
}

export function buildFixtures({ T }) {
  const group = new THREE.Group();
  group.name = 'fixtures';
  const own = [];
  const keep = (x) => (own.push(x), x);
  const plan = ceilingPlan();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const instances = (geo, mat, list, place, { cast = false } = {}) => {
    if (!list.length) return null;
    const inst = new THREE.InstancedMesh(keep(geo), mat, list.length);
    list.forEach((it, i) => inst.setMatrixAt(i, place(it, m4)));
    inst.castShadow = cast;
    inst.receiveShadow = true;
    group.add(inst);
    return inst;
  };
  const down = (y) => (p) => m4.compose(v.set(p[0], y, p[1]), q.setFromEuler(e.set(Math.PI / 2, 0, 0)), one);

  // ── the ceiling ──
  const white = keep(new THREE.MeshStandardMaterial({ color: 0xf1efe9, roughness: 0.6 }));
  const chrome = keep(new THREE.MeshStandardMaterial({ color: 0xd8dadc, roughness: 0.2, metalness: 1 }));
  // the diffusers fill half a tile (it's 4 ft by 2), the grilles all of it
  instances(new THREE.PlaneGeometry(0.58, 0.58), keep(new THREE.MeshStandardMaterial({ map: keep(diffuserTex()), roughness: 0.7 })), plan.diffusers, (p) => down(CEILING - 0.006)([p[0] - TILE_X / 4, p[1]]));
  instances(new THREE.PlaneGeometry(1.18, 0.57), keep(new THREE.MeshStandardMaterial({ map: keep(grilleTex()), roughness: 0.8 })), plan.grilles, down(CEILING - 0.006));
  {
    const parts = [new THREE.CylinderGeometry(0.018, 0.022, 0.035, 10).translate(0, -0.0175, 0), new THREE.CylinderGeometry(0.032, 0.032, 0.004, 14).translate(0, -0.045, 0), new THREE.CylinderGeometry(0.004, 0.004, 0.012, 6).translate(0, -0.038, 0)];
    const geo = mergeAll(parts);
    instances(geo, chrome, plan.sprinklers, (p) => m4.makeTranslation(p[0] + 0.3, CEILING, p[1]));
  }
  {
    const geo = mergeAll([new THREE.CylinderGeometry(0.066, 0.07, 0.03, 24).translate(0, -0.015, 0), new THREE.CylinderGeometry(0.04, 0.045, 0.012, 20).translate(0, -0.036, 0)]);
    instances(geo, white, plan.detectors, (p) => m4.makeTranslation(p[0], CEILING, p[1]));
    instances(new THREE.CircleGeometry(0.005, 8), keep(new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2a1a, emissiveIntensity: 3 })), plan.detectors, (p) => m4.compose(v.set(p[0] + 0.03, CEILING - 0.0425, p[1]), q.setFromEuler(e.set(Math.PI / 2, 0, 0)), one));
  }

  // ── the walls ──
  // where a point on a wall's face is: along a run, on one side of it
  const faceAt = (x0, z0, x1, z1, t, side, y) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const nx = (-(z1 - z0) / len) * side;
    const nz = ((x1 - x0) / len) * side;
    const off = T / 2 + 0.004;
    return { x: x0 + (x1 - x0) * t + nx * off, y, z: z0 + (z1 - z0) * t + nz * off, rotY: Math.atan2(nx, nz), room: roomAt(x0 + (x1 - x0) * t + nx * 0.4, z0 + (z1 - z0) * t + nz * 0.4) };
  };
  const outlets = [];
  for (const [x0, z0, x1, z1] of SOLID) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 1.6) continue;
    for (const side of [-1, 1])
      for (let d = 1.1 + (Math.abs(x0 * 7 + z0 * 3) % 1.3); d < len - 0.8; d += 3.4) {
        const f = faceAt(x0, z0, x1, z1, d / len, side, 0.32);
        if (f.room && f.room !== 'stairs') outlets.push(f);
      }
  }
  const switches = [];
  for (const d of DOORS) {
    if (d.w < 0.6) continue;
    for (const side of [-1, 1]) {
      // beside the door, on the latch side
      const half = d.w / 2 + 0.16;
      const [x0, z0, x1, z1] = d.along === 'x' ? [d.x - 1, d.z, d.x + 1, d.z] : [d.x, d.z - 1, d.x, d.z + 1];
      const f = faceAt(x0, z0, x1, z1, (1 + half) / 2, side, 1.2);
      if (f.room && f.room !== 'stairs') switches.push(f);
    }
  }
  const onFace = (f, w, h) => m4.compose(v.set(f.x, f.y, f.z), q.setFromEuler(e.set(0, f.rotY, 0)), v2.set(w, h, 1));
  const v2 = new THREE.Vector3();
  const plate = new THREE.PlaneGeometry(1, 1);
  instances(plate.clone(), keep(new THREE.MeshStandardMaterial({ map: keep(plateTex('outlet')), roughness: 0.45 })), outlets, (f) => onFace(f, 0.07, 0.115));
  instances(plate.clone(), keep(new THREE.MeshStandardMaterial({ map: keep(plateTex('switch')), roughness: 0.45 })), switches, (f) => onFace(f, 0.07, 0.115));
  plate.dispose();

  // single pieces on particular walls
  const E = Math.PI / 2;
  const Wst = -Math.PI / 2;
  const at = (px, py, y, face) => {
    const a = P(px, py);
    return { x: a.x + Math.sin(face) * (T / 2 + 0.006), y, z: a.z + Math.cos(face) * (T / 2 + 0.006), rotY: face };
  };
  const box = (w, h, d, mat, f, extra = 0) => {
    const o = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), mat);
    o.position.set(f.x + Math.sin(f.rotY) * (d / 2 + extra), f.y, f.z + Math.cos(f.rotY) * (d / 2 + extra));
    o.rotation.y = f.rotY;
    o.castShadow = o.receiveShadow = true;
    group.add(o);
    return o;
  };
  const face = (map, w, h, f, out, emissive = 0) => {
    const o = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, h)), keep(new THREE.MeshStandardMaterial({ map, roughness: 0.5, ...(emissive ? { emissive: 0xffffff, emissiveMap: map, emissiveIntensity: emissive } : {}) })));
    o.position.set(f.x + Math.sin(f.rotY) * out, f.y, f.z + Math.cos(f.rotY) * out);
    o.rotation.y = f.rotY;
    group.add(o);
    return o;
  };
  // the thermostat, in the bullpen by the men's room wall
  {
    const f = at(514, 318, 1.5, Wst);
    box(0.09, 0.12, 0.028, white, f);
    face(keep(thermostatTex()), 0.088, 0.118, f, 0.0285);
  }
  // fire extinguishers: in the bullpen under the clock, and in the annex
  const red = keep(new THREE.MeshStandardMaterial({ color: 0xb3141a, roughness: 0.32, metalness: 0.15 }));
  const black = keep(new THREE.MeshStandardMaterial({ color: 0x1a1b1d, roughness: 0.5 }));
  const signMat = keep(signTex('FIRE EXTINGUISHER'));
  for (const [px, py, face0] of [
    [514, 165, Wst],
    [739, 300, E],
  ]) {
    const f = at(px, py, 0, face0);
    const out = (d) => ({ x: f.x + Math.sin(f.rotY) * d, z: f.z + Math.cos(f.rotY) * d });
    const c = out(0.1);
    const body = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.075, 0.075, 0.42, 20)), red);
    body.position.set(c.x, 1.02, c.z);
    const dome = new THREE.Mesh(keep(new THREE.SphereGeometry(0.075, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), red);
    dome.position.set(c.x, 1.23, c.z);
    const valve = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.022, 0.026, 0.07, 10)), black);
    valve.position.set(c.x, 1.33, c.z);
    const lever = new THREE.Mesh(keep(new THREE.BoxGeometry(0.12, 0.012, 0.03)), black);
    lever.position.set(c.x, 1.375, c.z);
    lever.rotation.y = f.rotY;
    const hose = new THREE.Mesh(keep(new THREE.TorusGeometry(0.07, 0.009, 6, 16, Math.PI)), black);
    hose.position.set(c.x + Math.cos(f.rotY) * 0.06, 1.2, c.z - Math.sin(f.rotY) * 0.06);
    hose.rotation.set(0, f.rotY + Math.PI / 2, Math.PI / 2);
    for (const o of [body, dome, valve, lever, hose]) {
      o.castShadow = o.receiveShadow = true;
      group.add(o);
    }
    box(0.05, 0.08, 0.04, black, { ...f, y: 1.18 });
    face(signMat, 0.3, 0.085, { ...f, y: 1.62 }, 0.002);
  }
  // the pull stations, beside the exits
  const pull = keep(pullTex());
  for (const [px, py, face0] of [
    [680, 175, 0],
    [514, 232, Wst],
    [142, 76, E],
  ]) {
    const f = at(px, py, 1.22, face0);
    box(0.1, 0.13, 0.04, red, f);
    face(pull, 0.096, 0.126, f, 0.0405);
  }

  return {
    group,
    plan,
    dispose() {
      for (const o of own) o.dispose?.();
    },
  };
}

// a few shapes as one, whatever they were built as
function mergeAll(list) {
  const flat = list.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
    return n;
  });
  const geo = new THREE.BufferGeometry();
  for (const k of ['position', 'normal']) {
    const total = flat.reduce((s, g) => s + g.attributes[k].array.length, 0);
    const a = new Float32Array(total);
    let o = 0;
    for (const g of flat) {
      a.set(g.attributes[k].array, o);
      o += g.attributes[k].array.length;
    }
    geo.setAttribute(k, new THREE.BufferAttribute(a, 3));
  }
  for (const g of [...list, ...flat]) g.dispose();
  return geo;
}

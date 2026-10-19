// Shelob's lair: the tunnels, the webs and the bones in them. Moved out of
// props.js as they were.

import * as THREE from 'three';
import { clamp01, fbm, makeNoise, mix, smooth } from '../../../../lib/paint';
import { boxUV, rng, tube } from '../../shire/build';
import { _kc, facet, lump, noise3, oneGeo, rod, TAU, tint, V3 } from './helpers';
import { ROCK } from './stairs';

// ── Shelob's lair ──

// A sheet of web about 3 m across and 2 high, strung across a corner: its
// top edge and sides anchored, its belly sagging out (+z) and down, torn
// at its lower edge, a few thick cables along it. One geometry for
// mats.web.
export function webGeo(seed = 1) {
  const r = rng(seed * 11 + 3);
  const n = makeNoise(seed + 21);
  const nu = 10;
  const nv = 7;
  const w = 2.6 + r() * 0.8;
  const h = 1.7 + r() * 0.6;
  const pos = [];
  const uv = [];
  const idx = [];
  const tear = [];
  for (let i = 0; i <= nu; i++) tear.push(r() * 0.35 * Math.sin((Math.PI * i) / nu));
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      const v = j / nv;
      const belly = Math.sin(Math.PI * u) * Math.sin((Math.PI * (1 - v)) / 2 + Math.PI / 2) * (0.5 + r() * 0.08);
      const vv = Math.max(0, v - (j === 0 ? tear[i] : 0));
      const x = (u - 0.5) * w + (n(u * 5, v * 5) - 0.5) * 0.15;
      const y = h * (1 - vv) - Math.sin(Math.PI * u) * 0.35 * (1 - vv) + (n(u * 4 + 3, v * 4) - 0.5) * 0.1;
      const z = belly * (0.7 - 0.5 * vv);
      pos.push(x, h - y, z);
      uv.push(u * 0.94, vv);
    }
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      if (j < 2 && r() < 0.12) continue;
      idx.push(a, a + 1, a + nu + 1, a + 1, a + nu + 2, a + nu + 1);
    }
  }
  const sheet = new THREE.BufferGeometry();
  sheet.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  sheet.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  sheet.setIndex(idx);
  sheet.computeVertexNormals();
  const list = [sheet];
  // cables along its edges and across it: thin ribbons of solid thread
  const cable = (pts, wd) => {
    const c = new THREE.CatmullRomCurve3(pts);
    const seg = 8;
    const p2 = [];
    const u2 = [];
    const i2 = [];
    for (let k = 0; k <= seg; k++) {
      const pt = c.getPoint(k / seg);
      const tg = c.getTangent(k / seg);
      const sd = V3(-tg.y, tg.x, 0.3).normalize().multiplyScalar(wd);
      p2.push(pt.x - sd.x, pt.y - sd.y, pt.z - sd.z, pt.x + sd.x, pt.y + sd.y, pt.z + sd.z);
      u2.push(0.97, k / seg, 0.99, k / seg);
    }
    for (let k = 0; k < seg; k++) i2.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2);
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3));
    gg.setAttribute('uv', new THREE.Float32BufferAttribute(u2, 2));
    gg.setIndex(i2);
    gg.computeVertexNormals();
    list.push(gg);
  };
  const at = (u, v) => {
    const i = Math.round(u * nu);
    const j = Math.round(v * nv);
    const k = (j * (nu + 1) + i) * 3;
    return V3(pos[k], pos[k + 1], pos[k + 2]);
  };
  cable([at(0.1, 1), at(0.3, 0.9), at(0.5, 0.95), at(0.7, 0.9), at(0.9, 1)], 0.009);
  cable([at(0.05, 0.8), at(0.3, 0.5), at(0.55, 0.35), at(0.75, 0.5), at(0.95, 0.75)], 0.007);
  for (let k = 0; k < 3; k++) {
    const u = 0.15 + r() * 0.7;
    cable([at(u, 0), at(u + (r() - 0.5) * 0.2, 0.5), at(u + (r() - 0.5) * 0.3, 1)], 0.008);
  }
  const g = oneGeo(list);
  tint(g, (x, y, z, out) => out.setRGB(0.86, 0.87, 0.84).multiplyScalar(0.8 + noise3(n, x * 2, y * 2, z * 2) * 0.35));
  return g;
}

// Bones on the floor of the lair: long bones, ribs, skulls, all old and
// gnawed, yellowed, dirt in their hollows. Pieces as one geometry each,
// laid on y = 0.
function longBone(len, r0) {
  const list = [rod([0, 0, 0], [len, 0, 0], r0, r0 * 0.8, 5), lump(r0 * 1.7, { p: [0, 0, 0], s: [1, 0.9, 1.3] }, { detail: 0, amp: 0.15 }), lump(r0 * 1.5, { p: [len, 0, 0], s: [1, 0.9, 1.4] }, { detail: 0, amp: 0.15 })];
  return oneGeo(list);
}
function skullGeo(seed, k = 1) {
  const list = [lump(0.1 * k, { p: [0, 0.09 * k, 0], s: [1.2, 1, 0.92] }, { detail: 1, amp: 0.06, seed }).toNonIndexed(), lump(0.06 * k, { p: [0.09 * k, 0.04 * k, 0], s: [0.9, 0.85, 1] }, { detail: 0, amp: 0.1, seed: seed + 1 })];
  const g = oneGeo(list);
  // the sockets and the nose, dark
  tint(g, (x, y, z, out) => {
    const eye = Math.min(Math.hypot(x - 0.12 * k, y - 0.09 * k, z - 0.045 * k), Math.hypot(x - 0.12 * k, y - 0.09 * k, z + 0.045 * k));
    out.setRGB(0.72, 0.66, 0.54).multiplyScalar(eye < 0.035 * k ? 0.15 : 1);
  });
  return g;
}

// Shelob's tunnels: rough black rock round the corridors in `list` (each
// [x0, z0, x1, z1] along its middle, 3 m wide, all at y = 0). A floor, and
// walls that rise sheer to 1.1 m and arch over to 3.2 m, one surface over
// the whole network so the joins don't show. The two ways out, at (0, 0)
// and (80, −8), stay open, each in a rough face of rock. Inside: web in
// sheets across the corners and over the roof, strands hanging, bones and
// skulls along the walls.
export function tunnels(K, list, { r: rad = 1.6 } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'lair';
  const n = makeNoise(503);
  const rr = rng(505);
  const T = 1.5;
  const G = 0.25;
  // inside the corridors' rectangles (as layout.js inTunnels)
  const inside = (x, z) => list.some(([x0, z0, x1, z1]) => x >= Math.min(x0, x1) - T && x <= Math.max(x0, x1) + T && z >= Math.min(z0, z1) - T && z <= Math.max(z0, z1) + T);
  const ends = [
    [0, 0, -1, 0],
    [80, -8, 1, 0],
  ];
  // the corridors, run on past the two ways out, for the arch's shape
  const long = list.map(([x0, z0, x1, z1]) => {
    const q = [x0, z0, x1, z1];
    for (const [ex, ez, dx, dz] of ends) {
      if (x0 === ex && z0 === ez) [q[0], q[1]] = [x0 + dx * 4, z0 + dz * 4];
      if (x1 === ex && z1 === ez) [q[2], q[3]] = [x1 + dx * 4, z1 + dz * 4];
    }
    return q;
  });
  // how far a point is in from the nearest wall
  const inDist = (x, z) => {
    let best = -Infinity;
    for (const [x0, z0, x1, z1] of long) {
      const dx = Math.max(Math.min(x0, x1) - T - x, x - Math.max(x0, x1) - T);
      const dz = Math.max(Math.min(z0, z1) - T - z, z - Math.max(z0, z1) - T);
      best = Math.max(best, -Math.max(dx, dz));
    }
    return best;
  };
  const openAt = (x, z) => ends.some(([ex, ez, dx, dz]) => (dx ? Math.abs(x - (ex + dx * T)) < 0.01 && Math.abs(z - ez) <= T + 0.01 : Math.abs(z - (ez + dz * T)) < 0.01 && Math.abs(x - ex) <= T + 0.01));
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x0, z0, x1, z1] of list) {
    minX = Math.min(minX, x0, x1);
    maxX = Math.max(maxX, x0, x1);
    minZ = Math.min(minZ, z0, z1);
    maxZ = Math.max(maxZ, z0, z1);
  }
  const ox = minX - T;
  const oz = minZ - T;
  const NX = Math.round((maxX - minX + 2 * T) / G);
  const NZ = Math.round((maxZ - minZ + 2 * T) / G);
  const cellIn = (i, j) => i >= 0 && j >= 0 && i < NX && j < NZ && inside(ox + (i + 0.5) * G, oz + (j + 0.5) * G);
  const cells = new Uint8Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) cells[j * NX + i] = cellIn(i, j) ? 1 : 0;
  const isIn = (i, j) => i >= 0 && j >= 0 && i < NX && j < NZ && cells[j * NX + i] === 1;
  // a corner of the lattice: on the wall if any cell round it is rock
  const onWall = (i, j) => !(isIn(i - 1, j - 1) && isIn(i, j - 1) && isIn(i - 1, j) && isIn(i, j));
  const out = rad - T;
  const roofH = 3.2;
  const verts = new Map();
  // the roof over a corner of the lattice: the arch, rough, pushed out a
  // little at the walls (and the wall's foot further, bulging)
  const roofAt = (i, j) => {
    const key = i * 100003 + j;
    if (verts.has(key)) return verts.get(key);
    const x = ox + i * G;
    const z = oz + j * G;
    const e = Math.max(0, inDist(x, z)) + out;
    const k = clamp01((rad - e) / rad);
    let y = roofH * Math.sqrt(Math.max(0, 1 - k * k));
    y += (fbm(n, x * 0.45, z * 0.45, { octaves: 3 }) - 0.5) * 0.95 * smooth(0, 0.6, e) + (n(x * 2.1, z * 2.1) - 0.5) * 0.18;
    let px = x;
    let pz = z;
    if (onWall(i, j)) {
      // push the wall out from the corridor, along the way out of it
      const gx = inDist(x + 0.05, z) - inDist(x - 0.05, z);
      const gz = inDist(x, z + 0.05) - inDist(x, z - 0.05);
      const gl = Math.hypot(gx, gz) || 1;
      const push = out + (n(x * 0.8 + 3, z * 0.8) - 0.3) * 0.45;
      px -= (gx / gl) * push;
      pz -= (gz / gl) * push;
    }
    const v = { x: px, y, z: pz };
    verts.set(key, v);
    return v;
  };
  const rp = [];
  const tri = (a, b, c) => {
    rp.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  // the roof: two triangles a cell, facing down
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      if (!isIn(i, j)) continue;
      const a = roofAt(i, j);
      const b = roofAt(i + 1, j);
      const c = roofAt(i + 1, j + 1);
      const d = roofAt(i, j + 1);
      tri(a, b, c);
      tri(a, c, d);
    }
  }
  // the walls: down from the roof's edge to the floor, bulging, between
  // each pair of wall corners, except across the two ways out
  const wallDown = (a, b, ax, az, bx, bz) => {
    if (openAt((ax + bx) / 2, (az + bz) / 2)) return;
    const foot = (v, x, z) => {
      const mx = v.x + (v.x - x) * 0.25;
      const mz = v.z + (v.z - z) * 0.25;
      const bulge = (n(x * 1.3 + 7, z * 1.3) - 0.4) * 0.35;
      const dx = v.x - x;
      const dz = v.z - z;
      const l = Math.hypot(dx, dz) || 1;
      return [
        { x: v.x + (dx / l) * bulge, y: v.y * 0.5, z: v.z + (dz / l) * bulge },
        { x: mx, y: -0.08, z: mz },
      ];
    };
    const [am, af] = foot(a, ax, az);
    const [bm, bf] = foot(b, bx, bz);
    tri(a, b, am);
    tri(b, bm, am);
    tri(am, bm, af);
    tri(bm, bf, af);
  };
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      if (!isIn(i, j)) continue;
      const x0 = ox + i * G;
      const z0 = oz + j * G;
      if (!isIn(i, j - 1)) wallDown(roofAt(i + 1, j), roofAt(i, j), x0 + G, z0, x0, z0);
      if (!isIn(i + 1, j)) wallDown(roofAt(i + 1, j + 1), roofAt(i + 1, j), x0 + G, z0 + G, x0 + G, z0);
      if (!isIn(i, j + 1)) wallDown(roofAt(i, j + 1), roofAt(i + 1, j + 1), x0, z0 + G, x0 + G, z0 + G);
      if (!isIn(i - 1, j)) wallDown(roofAt(i, j), roofAt(i, j + 1), x0, z0, x0, z0 + G);
    }
  }
  const shell = new THREE.BufferGeometry();
  shell.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  const sh = facet(shell);
  tint(sh, (x, y, z, out2) => {
    out2.copy(ROCK.base).multiplyScalar(0.5 + noise3(n, x * 0.8, y * 0.8, z * 0.8) * 0.5);
    out2.lerp(ROCK.wet, smooth(0.5, 0.7, noise3(n, x * 0.3 + 5, y * 2, z * 0.3)) * 0.7);
    out2.lerp(ROCK.dark, (1 - smooth(0, 1.2, y)) * 0.3);
  });
  // the floor: a little rough, dark grit, under the walls' feet
  const fl = [];
  const FG = 0.5;
  for (let j = 0; j < NZ; j += 2) {
    for (let i = 0; i < NX; i += 2) {
      if (!isIn(i, j) && !isIn(i + 1, j) && !isIn(i, j + 1) && !isIn(i + 1, j + 1)) continue;
      const x = ox + i * G;
      const z = oz + j * G;
      const corner = (cx, cz) => {
        const e = inDist(cx, cz);
        const y = (n(cx * 1.7, cz * 1.7) - 0.5) * 0.06 - smooth(0.4, -0.2, e) * 0.04;
        let px = cx;
        let pz = cz;
        if (e < 0.05) {
          const gx = inDist(cx + 0.05, cz) - inDist(cx - 0.05, cz);
          const gz = inDist(cx, cz + 0.05) - inDist(cx, cz - 0.05);
          const gl = Math.hypot(gx, gz) || 1;
          px -= (gx / gl) * (out + 0.5);
          pz -= (gz / gl) * (out + 0.5);
        }
        return { x: px, y, z: pz };
      };
      const a = corner(x, z);
      const b = corner(x + FG, z);
      const c = corner(x + FG, z + FG);
      const d = corner(x, z + FG);
      fl.push(a.x, a.y, a.z, d.x, d.y, d.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
    }
  }
  const floor = new THREE.BufferGeometry();
  floor.setAttribute('position', new THREE.Float32BufferAttribute(fl, 3));
  floor.computeVertexNormals();
  tint(floor, (x, y, z, out2) => {
    out2.copy(ROCK.base).multiplyScalar(0.45 + noise3(n, x * 1.5, y, z * 1.5) * 0.4);
    out2.lerp(ROCK.rust, smooth(0.55, 0.7, n(x * 0.7, z * 0.7)) * 0.3);
  });
  // the ways out, each in a rough face of rock round an arch
  const mouths = [];
  for (const [ex, ez, dx] of ends) {
    const shp = new THREE.Shape();
    shp.moveTo(-9, -1);
    shp.lineTo(9, -1);
    shp.lineTo(9, 9);
    shp.lineTo(-9, 9);
    shp.closePath();
    const hole = new THREE.Path();
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const a = (k / 16) * Math.PI;
      pts.push([Math.cos(a) * rad * 0.92, roofH * 0.9 * Math.sin(a)]);
    }
    hole.moveTo(rad * 0.92, -1.01);
    for (const [hx, hy] of pts) hole.lineTo(hx, hy);
    hole.lineTo(-rad * 0.92, -1.01);
    hole.closePath();
    shp.holes.push(hole);
    const mg = new THREE.ShapeGeometry(shp, 6);
    const mp = mg.attributes.position;
    for (let k = 0; k < mp.count; k++) {
      const x = mp.getX(k);
      const y = mp.getY(k);
      const far = smooth(rad * 1.1, 6, Math.hypot(x, (y - 1) * 0.6));
      mp.setZ(k, -(fbm(n, x * 0.4 + ex, y * 0.4, { octaves: 3 }) - 0.3) * 1.6 * far);
    }
    mg.computeVertexNormals();
    // turn it to face out of the tunnel, at its end
    mg.rotateY(dx > 0 ? Math.PI / 2 : -Math.PI / 2).translate(ex + dx * (T + 0.05), 0, ez);
    mouths.push(mg);
  }
  const mouthGeo = oneGeo(mouths.map((x) => facet(x)));
  tint(mouthGeo, (x, y, z, out2) => out2.copy(ROCK.base).multiplyScalar(0.55 + noise3(n, x * 0.6, y * 0.6, z * 0.6) * 0.5));
  const rockAll = oneGeo([sh, floor, mouthGeo]);
  boxUV(rockAll, 0.4);
  const rockMesh = new THREE.Mesh(rockAll, mats.rock);
  rockMesh.name = 'lairRock';
  g.add(rockMesh);

  // ── web: sheets across the corners and over the roof, strands hanging
  const webs = [];
  const segs = list.map(([x0, z0, x1, z1]) => ({ x0, z0, x1, z1, len: Math.hypot(x1 - x0, z1 - z0), ax: x1 !== x0 }));
  // at every bend and joint, sheets across the corner up under the roof
  const joints = new Map();
  for (const s of segs) {
    for (const [x, z] of [[s.x0, s.z0], [s.x1, s.z1]]) {
      const k = `${x},${z}`;
      joints.set(k, (joints.get(k) || 0) + 1);
    }
  }
  let ws = 1;
  const place = (geo, x, y, z, yaw, tiltX = 0, k = 1) => {
    const m4 = new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, yaw, 0, 'YXZ')), V3(k, k, k));
    webs.push(geo.clone().applyMatrix4(m4));
  };
  for (const [key] of joints) {
    const [jx, jz] = key.split(',').map(Number);
    if ((jx === 0 && jz === 0) || (jx === 80 && jz === -8)) continue;
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = jx + cx * (T - 0.25);
      const z = jz + cz * (T - 0.25);
      if (inside(x + cx * 0.6, z) || inside(x, z + cz * 0.6) || rr() < 0.2) continue;
      // across the corner, its belly sagging back into it
      place(webGeo(ws++), jx + cx * 0.78, 0.25 + rr() * 0.5, jz + cz * 0.78, Math.atan2(cx, cz), -0.1, 0.72 + rr() * 0.1);
    }
  }
  // along the corridors: sheets up under the roof, slung from wall to
  // wall, and a few lower down across the walls' corners
  for (const s of segs) {
    const count = Math.floor(s.len / 4.5);
    for (let i = 0; i < count; i++) {
      const t = (i + 0.3 + rr() * 0.4) / count;
      const x = mix(s.x0, s.x1, t);
      const z = mix(s.z0, s.z1, t);
      const yaw = s.ax ? Math.PI / 2 : 0;
      // slung under the roof from wall to wall, sagging
      if (rr() < 0.5) place(webGeo(ws++), x, 2.3 + rr() * 0.2, z, yaw + (rr() < 0.5 ? Math.PI : 0), 1.3 + rr() * 0.2, 0.66);
      else {
        // in the angle of wall and roof, leaning into it
        const side = rr() < 0.5 ? -1 : 1;
        const px = s.ax ? x : x + side * 0.85;
        const pz = s.ax ? z + side * 0.85 : z;
        place(webGeo(ws++), px, 0.9 + rr() * 0.3, pz, s.ax ? (side > 0 ? 0 : Math.PI) : side > 0 ? Math.PI / 2 : -Math.PI / 2, 0.4, 0.55);
      }
    }
    // strands hanging from the roof
    for (let i = 0; i < s.len / 2.2; i++) {
      const t = rr();
      const x = mix(s.x0, s.x1, t) + (s.ax ? 0 : (rr() - 0.5) * 2);
      const z = mix(s.z0, s.z1, t) + (s.ax ? (rr() - 0.5) * 2 : 0);
      const e = inDist(x, z) + out;
      const kk = clamp01((rad - e) / rad);
      const yTop = roofH * Math.sqrt(Math.max(0, 1 - kk * kk)) - 0.1;
      const L = 0.5 + rr() * 1.6;
      const wd = 0.003 + rr() * 0.005;
      const strand = new THREE.PlaneGeometry(wd * 2, L, 1, 3).translate(0, yTop - L / 2, 0);
      const up = strand.attributes.uv;
      for (let q = 0; q < up.count; q++) up.setXY(q, 0.98, up.getY(q));
      strand.rotateY(rr() * Math.PI).translate(x, 0, z);
      webs.push(strand);
    }
  }
  const webGeoAll = oneGeo(webs);
  tint(webGeoAll, (x, y, z, out2) => out2.setRGB(0.86, 0.87, 0.84).multiplyScalar(0.82 + noise3(n, x * 2, y * 2, z * 2) * 0.3));
  const webMesh = new THREE.Mesh(webGeoAll, mats.web);
  webMesh.name = 'webs';
  webMesh.renderOrder = 3;
  g.add(webMesh);

  // ── bones along the walls, and old skulls
  const bones = [];
  for (const s of segs) {
    const count = Math.floor(s.len / 3);
    for (let i = 0; i < count; i++) {
      const t = rr();
      const side = rr() < 0.5 ? -1 : 1;
      const off = (0.8 + rr() * 0.6) * side;
      const x = mix(s.x0, s.x1, t) + (s.ax ? 0 : off);
      const z = mix(s.z0, s.z1, t) + (s.ax ? off : 0);
      const kind = rr();
      let geo;
      if (kind < 0.45) geo = longBone(0.3 + rr() * 0.25, 0.018 + rr() * 0.01);
      else if (kind < 0.7) geo = skullGeo(Math.floor(rr() * 50), 0.9 + rr() * 0.4);
      else {
        // ribs, curving up out of the grit
        const ribs = [];
        for (let q = 0; q < 4; q++) ribs.push(tube([[q * 0.08, 0, 0], [q * 0.08, 0.1, 0.12], [q * 0.08 + 0.02, 0.04, 0.26]], 0.012, 0.006, { seg: 4, radial: 3 }));
        ribs.push(rod([0, 0.01, 0], [0.32, 0.01, 0], 0.02, 0.02, 4));
        geo = oneGeo(ribs);
      }
      geo.rotateY(rr() * TAU).rotateZ((rr() - 0.5) * 0.3).translate(x, 0.01, z);
      bones.push(geo);
    }
  }
  const boneGeo = oneGeo(bones);
  const bc = boneGeo.attributes.color;
  const bp = boneGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    _kc.setRGB(bc.getX(i), bc.getY(i), bc.getZ(i));
    if (_kc.r > 0.95) _kc.setRGB(0.74, 0.68, 0.56);
    _kc.multiplyScalar(0.75 + noise3(n, bp.getX(i) * 9, bp.getY(i) * 9, bp.getZ(i) * 9) * 0.35);
    bc.setXYZ(i, _kc.r, _kc.g, _kc.b);
  }
  const boneMesh = new THREE.Mesh(boneGeo, mats.bone);
  boneMesh.name = 'bones';
  g.add(boneMesh);
  return { group: g, rock: rockMesh, webs: webMesh, bones: boneMesh };
}

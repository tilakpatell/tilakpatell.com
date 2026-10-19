// The endless stairs up their black cliff, and its boulders. Moved out of
// props.js as they were.

import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { clamp01, fbm, makeNoise, mix, smooth } from '../../../../lib/paint';
import { boxUV, rng } from '../../shire/build';
import { STAIRS } from './rules';
import { _kc, C, facet, noise3, oneGeo, shardGeo, TAU, tint, V3 } from './helpers';

// ── the endless stairs ──

export const ROCK = { base: C(0x4a4743), dark: C(0x141312), pale: C(0x6e6a63), wet: C(0x26262a), rust: C(0x4a3428), worn: C(0x7a7468), fresh: C(0x8e8678) };

// A jagged black boulder about 2 m across: broken flat-faced rock, a
// little paler where its faces turn up. One geometry.
export function rockGeo(seed = 1) {
  const n = makeNoise(seed + 5);
  const g = shardGeo(seed * 7 + 1, { detail: 2, planes: 9, cut: 0.5, amp: 0.6 });
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) * 1.5 + 0.55;
    p.setXYZ(i, p.getX(i) * 2.1, y < -0.05 ? -0.05 + (y + 0.05) * 0.2 : y, p.getZ(i) * 1.8);
  }
  g.computeVertexNormals();
  boxUV(g, 0.7);
  tint(g, (x, y, z, out, nx, ny) => {
    out.copy(ROCK.base).multiplyScalar(0.6 + noise3(n, x * 2, y * 2, z * 2) * 0.6);
    out.lerp(ROCK.pale, smooth(0.4, 0.9, ny) * 0.35);
    out.lerp(ROCK.dark, (1 - smooth(-0.05, 0.5, y)) * 0.5);
    out.lerp(ROCK.rust, smooth(0.6, 0.75, noise3(n, x * 1.5 + 3, y * 1.5, z * 1.5)) * 0.3);
  });
  g.computeBoundingSphere();
  return g;
}

// The endless stairs up a sheer black cliff, its face the plane z = 0
// facing +z, 60 m across and 80 high (its rim 72 to 86 m up, notched where
// the stair comes out at the top), running on down out of sight below the
// foot. The stair follows at(s) exactly, `steps` narrow worn steps 1.24 m
// across, cut into the face: the rock rises sheer behind each tread and
// falls away beneath it, no rail. Wider on the ledges where you rest; on
// the crumbling stretches (rules.js STAIRS) the steps are cracked, tilted
// and broken back at their edges, rubble lying on them. A landing at each
// turn, a shelf at the foot.
export function stairs(K, { at, len = STAIRS.len, steps = 260 } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'stairs';
  const n = makeNoise(311);
  const r = rng(313);
  const P = (s) => at(Math.max(0, Math.min(len, s)));
  const crumbleAt = (s) => STAIRS.crumble.some(([a, b]) => s >= a && s <= b);
  const ledgeAt = (s) => STAIRS.ledges.some((l) => Math.abs(s - l) < 2.5);
  // the stair's line, finely, binned along x for the cliff to find
  const line = [];
  const bins = new Map();
  const BIN = 0.5;
  for (let i = 0; i <= len * 4; i++) {
    const s = i / 4;
    const [x, y, z] = P(s);
    const pt = { s, x, y, z, crumble: crumbleAt(s), ledge: ledgeAt(s) };
    line.push(pt);
    const k = Math.floor(x / BIN);
    if (!bins.has(k)) bins.set(k, []);
    bins.get(k).push(pt);
  }
  const near = (x) => {
    const k = Math.floor(x / BIN);
    return [...(bins.get(k - 1) || []), ...(bins.get(k) || []), ...(bins.get(k + 1) || [])].filter((p) => Math.abs(p.x - x) < 0.5);
  };
  const top = P(len);

  // ── the cliff
  const W = 60;
  const hw = W / 2;
  const below = 40;
  const cuts = [-hw - 2];
  while (cuts[cuts.length - 1] < hw + 2) cuts.push(cuts[cuts.length - 1] + 1.2 + r() * 3.4);
  const slabs = cuts.map(() => ({ out: (r() - 0.5) * 0.9, layer: 2.5 + r() * 4, phase: r() * 6, deep: r() < 0.1, tilt: (r() - 0.5) * 0.5 }));
  const slabAt = (x) => {
    let i = 0;
    while (i < cuts.length - 2 && x > cuts[i + 1]) i++;
    return [i, Math.min(x - cuts[i], cuts[i + 1] - x)];
  };
  // the rock's own face, before the stair is cut: never proud of z = 0.2
  const baseFace = (x, y) => {
    const [i, edge] = slabAt(x);
    const sl = slabs[i];
    // the joints wander, and fade in and out up the face
    const crack = (1 - smooth(0.04, 0.4, edge)) * smooth(0.3, 0.55, n(x * 0.2 + 4, y * 0.05));
    const L = Math.floor((y + sl.phase + x * sl.tilt) / sl.layer);
    let z = -0.55 + sl.out * 0.6 + (n(L * 1.73 + i * 7.1, 9.3) - 0.5) * 0.8;
    z -= crack * (sl.deep ? 1.8 : 0.7);
    z += (fbm(n, x * 0.05 + 3, y * 0.04, { octaves: 3 }) - 0.5) * 1.6;
    z += (fbm(n, x * 0.7 + 9, y * 0.5, { octaves: 2 }) - 0.5) * 0.3;
    z -= smooth(hw - 9, hw, Math.abs(x)) * 7;
    return [Math.min(0.2, z), crack];
  };
  // the cut: rock up behind each tread to its back edge, rock falling away
  // under it, and always clear headroom over a tread
  const face = (x, y) => {
    let [z, crack] = baseFace(x, y);
    let cut = 0;
    let clear = Infinity;
    for (const p of near(x)) {
      const dy = y - p.y;
      const back = p.z - 0.62;
      const wall = 2.4 + n(p.s * 0.4, 3.3) * 1.6;
      if (dy > -0.3 && dy < wall) {
        const k = 1 - smooth(wall - 0.9, wall, dy);
        z = Math.max(z, mix(z, back - 0.02 - n(x * 1.3, y * 1.3) * 0.18, k));
        cut = Math.max(cut, k);
      }
      if (dy <= -0.3 && dy > -3.4) {
        const lip = p.crumble ? 0.05 : 0.42;
        z = Math.max(z, mix(z, p.z + lip - (n(x * 0.9 + 5, y * 0.9) - 0.5) * 0.3, smooth(-3.4, -0.35, dy)));
      }
      if (dy > -0.05 && dy < 2.1) clear = Math.min(clear, back - 0.02);
    }
    return [Math.min(z, clear), crack, cut];
  };
  // the rim: jagged teeth, low where the stair comes out at the top
  const tops = [];
  for (let x = -hw; x < hw; x += 1.8 + r() * 3) tops.push([x, 1 + r() * 7, 0.8 + r() * 1.8]);
  const notch = (x) => 1 - smooth(3, 7, Math.abs(x - top[0]));
  const rimAt = (x) => {
    let y = 0;
    for (const [px, ph, pw] of tops) y = Math.max(y, ph * (1 - Math.abs(x - px) / pw));
    return mix(78 + y, top[1] + 1.4, notch(x)) - smooth(hw - 10, hw, Math.abs(x)) * 6;
  };
  const nx = 80;
  const nLow = 12;
  const nHigh = 124;
  const nf = nLow + nHigh;
  const nt = 8;
  const back = 10;
  const Wc = nx + 1;
  const rows = nf + nt + 1;
  const pos = new Float32Array(Wc * rows * 3);
  const col = new Float32Array(Wc * rows * 3);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i <= nx; i++) {
      let x = -hw + (i / nx) * W;
      const rim = rimAt(x);
      let y;
      let z;
      let crack = 0;
      let cut = 0;
      if (j <= nf) {
        y = j <= nLow ? mix(-below, -2, j / nLow) : mix(-2, rim, (j - nLow) / nHigh);
        [z, crack, cut] = face(x, y);
      } else {
        const d = ((j - nf) / nt) * back;
        const tooth = (n(x * 0.4, d * 0.3 + 7) - 0.5) * 3 * smooth(0.5, 3, d) * (1 - notch(x));
        y = rim + tooth - smooth(0, back, d) * 2;
        z = face(x, rim)[0] - d;
        x += (r() - 0.5) * 0.2;
      }
      const k = (j * Wc + i) * 3;
      pos[k] = x;
      pos[k + 1] = y;
      pos[k + 2] = z;
      // black rock, darker in the joints, wet streaks down it; worn paler
      // where the stair is cut
      const v = fbm(n, x * 0.3 + 11, y * 0.3, { octaves: 3 });
      _kc.copy(ROCK.base).multiplyScalar(0.6 + v * 0.6);
      _kc.lerp(ROCK.dark, crack * 0.55);
      _kc.lerp(ROCK.wet, smooth(0.55, 0.78, n(x * 1.4 + 2, 0.5)) * 0.6);
      _kc.lerp(ROCK.worn, cut * 0.25);
      _kc.lerp(ROCK.dark, clamp01(-y / below) * 0.6);
      col[k] = _kc.r;
      col[k + 1] = _kc.g;
      col[k + 2] = _kc.b;
    }
  }
  const idx = [];
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * Wc + i;
      if ((i + j) % 2) idx.push(a, a + 1, a + Wc, a + 1, a + Wc + 1, a + Wc);
      else idx.push(a, a + 1, a + Wc + 1, a, a + Wc + 1, a + Wc);
    }
  }
  let cliff = new THREE.BufferGeometry();
  cliff.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  cliff.setAttribute('color', new THREE.BufferAttribute(col, 3));
  cliff.setIndex(idx);
  cliff = facet(cliff);
  {
    const p = cliff.attributes.position;
    const nr = cliff.attributes.normal;
    const cc = cliff.attributes.color;
    for (let i = 0; i < p.count; i++) {
      const ny = nr.getY(i);
      if (ny > 0.5) {
        _kc.setRGB(cc.getX(i), cc.getY(i), cc.getZ(i)).lerp(ROCK.pale, smooth(0.5, 0.95, ny) * 0.35);
        cc.setXYZ(i, _kc.r, _kc.g, _kc.b);
      } else if (ny < -0.3) {
        _kc.setRGB(cc.getX(i), cc.getY(i), cc.getZ(i)).multiplyScalar(0.6);
        cc.setXYZ(i, _kc.r, _kc.g, _kc.b);
      }
    }
  }
  const rock = [cliff];

  // ── the steps
  const step = [];
  const rubble = [];
  const tone = (geo, fresh = 0) =>
    tint(geo, (x, y, z, out, nx2, ny) => {
      out.copy(ROCK.base).multiplyScalar(0.75 + noise3(n, x * 3, y * 3, z * 3) * 0.5);
      if (ny > 0.6) out.lerp(ROCK.worn, 0.45 * (1 - Math.abs(z - P((y / 70) * len)[2]) * 0.6));
      else out.lerp(ROCK.dark, 0.3);
      out.lerp(ROCK.fresh, fresh);
    });
  const ds = len / steps;
  for (let i = 0; i < steps; i++) {
    const s0 = i * ds;
    const s1 = s0 + ds;
    const a = P(s0);
    const b = P(s1);
    const m = P(s0 + ds / 2);
    const rise = Math.abs(b[1] - a[1]);
    const run = Math.max(0.12, Math.abs(b[0] - a[0]));
    const crumble = crumbleAt(s0);
    const ledge = ledgeAt(s0);
    const depthOut = ledge ? 1.7 : 0.62;
    let front = m[2] + depthOut;
    let tilt = 0;
    let drop = 0;
    let fresh = 0;
    if (crumble) {
      const roll = r();
      if (roll < 0.45) {
        front = m[2] + 0.12 + r() * 0.3;
        fresh = 0.3;
      } else if (roll < 0.7) {
        tilt = (r() - 0.5) * 0.14;
        drop = 0.03 + r() * 0.05;
      }
    }
    const backZ = m[2] - 0.62;
    const depth = front - backZ;
    const thick = 0.32 + rise;
    const geo = new THREE.BoxGeometry(run + 0.05, thick, depth, 1, 1, 3);
    const p = geo.attributes.position;
    const dir = Math.sign(b[0] - a[0]) || 1;
    for (let v = 0; v < p.count; v++) {
      let x = p.getX(v);
      let y = p.getY(v);
      const z = p.getZ(v);
      const zw = (z + depth / 2) / depth;
      if (y > 0) {
        // worn hollow down the middle of the tread, the nosing rounded off
        y -= 0.035 * Math.sin(Math.PI * clamp01((zw * depth) / 1.24));
        if (x * dir < 0) y -= 0.025;
        y -= Math.max(0, zw - 0.85) * 0.12;
      }
      x += (n(i * 1.7 + v, 2.1) - 0.5) * 0.04;
      y += (n(i * 1.3 + v, 5.7) - 0.5) * 0.03;
      p.setXYZ(v, x, y, z + (n(i * 0.9 + v, 8.3) - 0.5) * 0.05);
    }
    geo.rotateX(tilt);
    geo.translate((a[0] + b[0]) / 2, m[1] - thick / 2 - drop, backZ + depth / 2);
    step.push(tone(facet(geo), fresh));
    // cracked: a split across the tread, its far half dropped
    if (crumble && r() < 0.35) {
      const shard = shardGeo(900 + i, { detail: 0, planes: 5, cut: 0.4 });
      shard.scale(run * 0.7, 0.2, 0.5).translate(m[0], m[1] - 0.18, front + 0.1);
      rubble.push(tone(shard, 0.4));
    }
    // loose stones on the crumbling stretches, and at the foot of the wall
    if ((crumble && r() < 0.5) || r() < 0.06) {
      const k = 0.08 + r() * 0.14;
      const st = shardGeo(1300 + i, { detail: 0, planes: 4, cut: 0.4 });
      st.scale(k * 1.4, k, k * 1.2).rotateY(r() * TAU).translate(m[0] + (r() - 0.5) * run, m[1] + k * 0.25, backZ + 0.12 + r() * (crumble ? 0.5 : 0.2));
      rubble.push(tone(st, crumble ? 0.35 : 0));
    }
  }
  // a landing at each turn, where the stair doubles back
  for (let s = 0; s <= len; s += 0.25) {
    const a = P(s - 0.5);
    const b = P(s);
    const c = P(s + 0.5);
    if ((b[0] - a[0]) * (c[0] - b[0]) < 0) {
      const out = Math.sign(b[0]) || 1;
      const slab = new THREE.BoxGeometry(1.8, 0.6, 1.4).translate(b[0] + out * 0.5, b[1] - 0.3, b[2]);
      rubble.push(tone(facet(slab)));
      s += 2;
    }
  }
  // the shelf at the foot, and the top where the stair comes out
  for (const [p, wx] of [[P(0), 1], [top, -1]]) {
    const pts = [];
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * TAU;
      pts.push(V3(p[0] + Math.cos(a) * (2.6 + r() * 0.8) - wx * 1.2, p[1] - (k % 2 ? 0 : 2.4 + r()), p[2] - 0.5 + Math.sin(a) * (2.2 + r() * 0.5)));
    }
    for (let k = 0; k < 8; k++) pts.push(V3(p[0] - wx * 1.2 + (r() - 0.5) * 4, p[1] - 0.02 - r() * 0.04, p[2] - 0.5 + (r() - 0.5) * 3.2));
    rubble.push(tone(facet(new ConvexGeometry(pts))));
  }
  const rockGeo2 = oneGeo([...rock, ...step, ...rubble]);
  boxUV(rockGeo2, 0.35);
  const mesh = new THREE.Mesh(rockGeo2, mats.rock);
  mesh.name = 'cliffAndStair';
  g.add(mesh);
  return { group: g, mesh };
}

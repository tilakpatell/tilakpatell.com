// The Emyn Muil: the razor spires, the sheer cliff with its spurs, and
// Sam’s elven rope. Moved out of props.js as they were.

import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { clamp01, fbm, makeNoise, mix, smooth } from '../../../../lib/paint';
import { boxUV, rng } from '../../shire/build';
import { _kc, C, facet, noise3, oneGeo, TAU, tint, V3 } from './helpers';

// ── the Emyn Muil ──

const ROCK = { base: C(0xaeaeaa), dark: C(0x3a3c40), wet: C(0x606268), pale: C(0xd2d2ca), lichen: C(0xb8ba9e), moss: C(0x6e785e) };

// A razor spire of rock, about 3 m: a few blade-thin shards leaning
// together, flat-faced and sharp. One geometry for instancing.
export function spikeGeo(seed = 1) {
  const r = rng(seed * 13 + 1);
  const n = makeNoise(seed + 3);
  const list = [];
  const count = 3 + Math.floor(r() * 3);
  for (let k = 0; k < count; k++) {
    const main = k === 0;
    const H = main ? 2.8 + r() * 0.5 : 0.9 + r() * 1.5;
    const R = main ? 0.6 : 0.28 + r() * 0.3;
    const a = r() * TAU;
    const off = main ? 0 : 0.35 + r() * 0.4;
    const bx = Math.cos(a) * off;
    const bz = Math.sin(a) * off;
    const lx = (r() - 0.5) * 0.25 + (main ? 0 : Math.cos(a) * 0.3);
    const lz = (r() - 0.5) * 0.25 + (main ? 0 : Math.sin(a) * 0.3);
    const blade = r() * TAU;
    const cb = Math.cos(blade);
    const sb = Math.sin(blade);
    const at = (u, v, y) => V3(bx + u * cb - v * sb + lx * y, y, bz + u * sb + v * cb + lz * y);
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const t = (i / 6) * TAU + r() * 0.5;
      const rr = R * (0.75 + r() * 0.4);
      pts.push(at(Math.cos(t) * rr, Math.sin(t) * rr * 0.5, -0.5));
    }
    for (let i = 0; i < 4; i++) {
      const t = (i / 4) * TAU + r() * 0.8;
      const rr = R * (0.4 + r() * 0.25);
      pts.push(at(Math.cos(t) * rr, Math.sin(t) * rr * 0.4, H * (0.3 + r() * 0.3)));
    }
    pts.push(at((r() - 0.5) * R * 0.3, 0, H));
    if (r() < 0.6) pts.push(at(R * (0.25 + r() * 0.2) * (r() < 0.5 ? -1 : 1), 0, H * (0.72 + r() * 0.12)));
    list.push(new ConvexGeometry(pts));
  }
  const g = oneGeo(list.map((x) => facet(x)));
  boxUV(g, 0.6);
  tint(g, (x, y, z, out, nx, ny) => {
    const v = noise3(n, x * 1.4, y * 1.4, z * 1.4);
    out.copy(ROCK.base).multiplyScalar(0.7 + v * 0.55);
    out.lerp(ROCK.dark, clamp01(0.5 - y * 0.35) * 0.7);
    if (ny > 0.45) out.lerp(ROCK.pale, 0.35);
    out.lerp(ROCK.lichen, smooth(0.62, 0.7, noise3(n, x * 3 + 4, y * 3, z * 3)) * 0.4);
  });
  g.computeBoundingSphere();
  return g;
}

// A jagged spur of rock about `out` proud of the face, for the rope to
// knock against.
function spurGeo(seed, cx, cy, side, out = 0.8) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + r() * 0.5;
    pts.push(V3(cx + Math.cos(a) * (0.6 + r() * 0.25), cy + Math.sin(a) * (0.5 + r() * 0.2), -0.5 + r() * 0.15));
  }
  for (let i = 0; i < 3; i++) pts.push(V3(cx + (r() - 0.5) * 0.6, cy + 0.15 - r() * 0.35, 0.2 + r() * 0.2));
  // a fang, pointing out and down, a lesser one beside it
  pts.push(V3(cx + side * 0.12, cy - 0.38, out));
  pts.push(V3(cx - side * 0.3, cy - 0.1, out * 0.7));
  pts.push(V3(cx + side * 0.05, cy + 0.12, out * 0.45));
  return facet(new ConvexGeometry(pts));
}

// The cliff: a sheer grey face `w` across and `h` high, its foot on y = 0,
// facing +z. Tall slabs split by vertical joints, set forward and back,
// layers stepping into ledges, the ends turning back into the hills; a
// jagged rim and rock crowding behind it. Down the middle (x = 0 ± 3) it
// is kept smooth and flush with z = 0 for the rope and for Gollum, but for
// the spurs in `outcrops`.
export function cliff(K, { w = 60, h = 34, outcrops = [] } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'cliff';
  const n = makeNoise(71);
  const hw = w / 2;
  const below = 4;
  const nx = Math.round(w / 0.5);
  const nf = Math.round((h + below) / 0.6);
  const nt = 10;
  const back = 10;
  // the face in tall slabs between vertical joints, each its own way out
  const cr = rng(72);
  const cuts = [-hw - 2];
  while (cuts[cuts.length - 1] < hw + 2) cuts.push(cuts[cuts.length - 1] + 1.6 + cr() * 3.6);
  const slabs = cuts.map(() => ({ out: (cr() - 0.5) * 1.8, lean: (cr() - 0.5) * 0.04, layer: 3.2 + cr() * 3.5, phase: cr() * 6, step: cr() }));
  const slabAt = (x) => {
    let i = 0;
    while (i < cuts.length - 2 && x > cuts[i + 1]) i++;
    return [i, Math.min(x - cuts[i], cuts[i + 1] - x)];
  };
  const calmAt = (x) => smooth(2.4, 5.5, Math.abs(x - 0.6));
  // spires along the skyline, none over the rope's head
  const tops = [];
  for (let x = -hw; x < hw; x += 2.2 + cr() * 3.5) tops.push([x, 1.5 + cr() * 5.5, 0.9 + cr() * 1.6]);
  const skyline = (x) => {
    let y = 0;
    for (const [px, ph, pw] of tops) y = Math.max(y, ph * (1 - Math.abs(x - px) / pw));
    return y * smooth(2.6, 5.5, Math.abs(x - 0.5)) * (1 - smooth(hw - 6, hw, Math.abs(x)) * 0.7) - smooth(hw - 18, hw, Math.abs(x)) * 24;
  };
  const face = (x, y) => {
    const [i, edge] = slabAt(x);
    const sl = slabs[i];
    const crack = 1 - smooth(0.05, 0.45, edge);
    // each slab steps back in layers up its height: the ledges
    const L = Math.floor((y + sl.phase) / sl.layer);
    let z = sl.out + (n(L * 1.73 + i * 7.1, 9.3) - 0.5) * 1.3 + sl.lean * y;
    z -= crack * 0.9;
    z += (fbm(n, x * 0.04 + 3, y * 0.045, { octaves: 3 }) - 0.5) * 3.2;
    z += (fbm(n, x * 0.6 + 9, y * 0.35, { octaves: 2 }) - 0.5) * 0.18;
    z -= smooth(hw - 14, hw, Math.abs(x)) * 16;
    const calm = calmAt(x);
    const quiet = -0.12 - crack * 0.18 + (fbm(n, x * 0.8, y * 0.4, { octaves: 2 }) - 0.5) * 0.1;
    return [mix(quiet, z, calm), crack * (0.35 + 0.65 * calm), i];
  };
  // the rim's teeth, and what's behind it; flat where Sam stands
  const calmTop = (x, d) => Math.max(smooth(2.4, 5, Math.abs(x - 0.5)), smooth(3, 5, d));
  const rim = (x, d) => {
    const s = x / 2.6 + n(x * 0.2, 7) * 1.6;
    const fr = s - Math.floor(s);
    const tooth = Math.pow(1 - Math.abs(fr * 2 - 1), 1.6) * (1 + n(Math.floor(s) * 3.1, 2) * 2.4);
    return (tooth * smooth(0.4, 1.6, d) * (1 - smooth(5, 9, d) * 0.6) + (fbm(n, x * 0.2, d * 0.3 + 5, { octaves: 2 }) - 0.5) * 1.2 * smooth(0, 3, d)) * calmTop(x, d);
  };
  const W = nx + 1;
  const pos = new Float32Array(W * (nf + nt + 1) * 3);
  const col = new Float32Array(W * (nf + nt + 1) * 3);
  const jr = rng(77);
  for (let j = 0; j <= nf + nt; j++) {
    for (let i = 0; i <= nx; i++) {
      let x = -hw + (i / nx) * w;
      const top = h + skyline(x);
      let y;
      let z;
      let joint = 0;
      let slab = 0;
      if (j <= nf) {
        y = -below + (j / nf) * (top + below);
        [z, joint, slab] = face(x, y);
      } else {
        const d = ((j - nf) / nt) * back;
        y = top + rim(x, d) - smooth(0, back, d) * Math.max(0, top - h) * 0.6;
        z = face(x, top)[0] - d;
        x += (jr() - 0.5) * 0.2;
      }
      const k = (j * W + i) * 3;
      pos[k] = x;
      pos[k + 1] = y;
      pos[k + 2] = z;
      // grey, darker in the joints and down the wet streaks
      const v = fbm(n, x * 0.3 + 11, y * 0.3, { octaves: 3 });
      _kc.copy(ROCK.base).multiplyScalar((0.72 + v * 0.5) * (0.82 + n(slab * 3.7, 1.1) * 0.36));
      _kc.lerp(ROCK.dark, joint * 0.75);
      const streak = smooth(0.55, 0.78, n(x * 1.4 + 2, 0.5)) * (0.4 + 0.6 * (1 - clamp01(y / h)));
      _kc.lerp(ROCK.wet, streak * 0.55);
      _kc.lerp(ROCK.dark, clamp01(-y / below) * 0.5);
      if (j > nf) _kc.lerp(ROCK.moss, smooth(0.55, 0.7, n(x * 0.5, y * 0.5 + 3)) * 0.4);
      col[k] = _kc.r;
      col[k + 1] = _kc.g;
      col[k + 2] = _kc.b;
    }
  }
  const idx = [];
  for (let j = 0; j < nf + nt; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * W + i;
      if ((i + j) % 2) idx.push(a, a + 1, a + W, a + 1, a + W + 1, a + W);
      else idx.push(a, a + 1, a + W + 1, a, a + W + 1, a + W);
    }
  }
  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo = facet(geo);
  // ledges pale with lichen where they face the sky
  const p = geo.attributes.position;
  const nr = geo.attributes.normal;
  const cc = geo.attributes.color;
  for (let i = 0; i < p.count; i++) {
    const ny = nr.getY(i);
    if (ny > 0.4) {
      _kc.setRGB(cc.getX(i), cc.getY(i), cc.getZ(i)).lerp(ny > 0.75 ? ROCK.lichen : ROCK.pale, smooth(0.4, 0.9, ny) * 0.55);
      cc.setXYZ(i, _kc.r, _kc.g, _kc.b);
    } else if (nr.getZ(i) < -0.2) {
      _kc.setRGB(cc.getX(i), cc.getY(i), cc.getZ(i)).multiplyScalar(0.7);
      cc.setXYZ(i, _kc.r, _kc.g, _kc.b);
    }
  }
  const list = [geo];
  // the spurs the rope swings against
  outcrops.forEach((o, i) => {
    const s = spurGeo(300 + i * 7, (o.side ?? 1) * 1.4, h - o.y, o.side ?? 1);
    tint(s, (x, y, z, out, nx2, ny) => out.copy(ROCK.base).multiplyScalar(0.8 + z * 0.3).lerp(ny > 0.4 ? ROCK.pale : ROCK.dark, ny > 0.4 ? 0.4 : clamp01(-ny) * 0.5));
    list.push(s);
  });
  // spires crowding the rim, clear of the rope's head
  const r = rng(91);
  for (let i = 0; i < 16; i++) {
    let x = (r() - 0.5) * (w - 6);
    if (Math.abs(x - 0.5) < 5) x += x < 0.5 ? -5 : 5;
    const d = 1.5 + r() * 7;
    const s = spikeGeo(20 + i).clone();
    const k = 0.9 + r() * 1.6;
    s.applyMatrix4(new THREE.Matrix4().compose(V3(x, h + skyline(x) * 0.5 + rim(x, d) - 0.3, face(x, h)[0] - d), new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.2, r() * TAU, (r() - 0.5) * 0.2)), V3(k, k * (0.8 + r() * 0.6), k)));
    list.push(s);
  }
  const all = oneGeo(list);
  boxUV(all, 0.3);
  const mesh = new THREE.Mesh(all, mats.rock);
  mesh.name = 'cliffFace';
  g.add(mesh);
  return { group: g, mesh };
}

// Sam's elven rope: thin, silver-grey, a tube that set([a, b]) lays from a
// to b with a little sag, rewritten in place.
export function rope(K) {
  const SEG = 28;
  const RAD = 6;
  const R = 0.026;
  const W = RAD + 1;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array((SEG + 1) * W * 3);
  const nrm = new Float32Array((SEG + 1) * W * 3);
  const uv = new Float32Array((SEG + 1) * W * 2);
  const idx = [];
  for (let k = 0; k < SEG; k++) {
    for (let j = 0; j < RAD; j++) {
      const a = k * W + j;
      idx.push(a, a + W, a + 1, a + 1, a + W, a + W + 1);
    }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, K.mats.elvenRope);
  mesh.name = 'elvenRope';
  mesh.frustumCulled = false;
  const a = V3();
  const b = V3();
  const d = V3();
  const sag = V3();
  const p = V3();
  const q = V3();
  const T = V3();
  const N = V3();
  const Bn = V3();
  const ref = V3();
  const at = (t, out) => out.copy(a).lerp(b, t).addScaledVector(sag, 4 * t * (1 - t));
  const set = ([A, Bv]) => {
    a.copy(A);
    b.copy(Bv);
    d.subVectors(b, a);
    const len = Math.max(0.01, d.length());
    d.divideScalar(len);
    // it sags across its line, and bows a little out from the rock
    sag.set(0, -1, 0).addScaledVector(d, d.y);
    sag.multiplyScalar(0.05 * len).add(q.set(0, 0, 1).addScaledVector(d, -d.z).multiplyScalar(0.012 * len));
    let run = 0;
    for (let k = 0; k <= SEG; k++) {
      const t = k / SEG;
      at(t, p);
      at(Math.min(1, t + 0.02), q);
      at(Math.max(0, t - 0.02), T);
      T.subVectors(q, T).normalize();
      ref.set(Math.abs(T.z) > 0.9 ? 1 : 0, 0, Math.abs(T.z) > 0.9 ? 0 : 1);
      N.crossVectors(T, ref).normalize();
      Bn.crossVectors(T, N);
      if (k) run += len / SEG;
      for (let j = 0; j <= RAD; j++) {
        const th = (j / RAD) * TAU;
        const cx = Math.cos(th);
        const sx = Math.sin(th);
        const i = k * W + j;
        const nx = N.x * cx + Bn.x * sx;
        const ny = N.y * cx + Bn.y * sx;
        const nz = N.z * cx + Bn.z * sx;
        nrm[i * 3] = nx;
        nrm[i * 3 + 1] = ny;
        nrm[i * 3 + 2] = nz;
        pos[i * 3] = p.x + nx * R;
        pos[i * 3 + 1] = p.y + ny * R;
        pos[i * 3 + 2] = p.z + nz * R;
        uv[i * 2] = j / RAD;
        uv[i * 2 + 1] = run * 6;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
    geo.attributes.uv.needsUpdate = true;
    geo.computeBoundingSphere();
  };
  set([V3(0, 2, 0), V3(0, 0, 0)]);
  return { mesh, group: mesh, set };
}

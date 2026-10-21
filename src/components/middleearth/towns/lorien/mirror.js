// Galadriel’s Mirror in its hollow, and what it shows. Moved out of
// props.js as it was; its water comes from the kit (K.shaders).

import * as THREE from 'three';
import { clamp01, fbm, makeNoise, mix, smooth } from '../../../../lib/paint';
import { lathe, parts, rng, roundBox, tube } from '../../shire/build';
import { fernGeo, flowersGeo } from './flets';
import { C, geoOf, gridIdx, leafBlade, noise3, paintGeo, polar, slab, TAU, tint, V3 } from './helpers';
import { barkTint, weldSeam } from './mallorn';

// ── Galadriel's Mirror ──

// Galadriel's Mirror in its hollow: a dell whose floor is at y = 0, ringed
// by a bank rising to a crest about 1.7 m high some 7.2 m out and falling
// away outside to the ground by 13.5 m. Great silver roots arch over the
// bank and down into the hollow, ferns and small star-flowers grow on it,
// and on the +z side a short curved flight of pale stone steps comes down
// from the crest. In the middle, on a low round dais, a carved pedestal
// holds the shallow silver basin (its rim 1 m up and 1.45 m across), and
// beside it a silver ewer stands on a low stand. The water's shader shows
// visions: vision(k, kind), k from 0 (still water) to 1, kind 'still'
// (stars), 'eye' or 'shire'. update(t) runs it.
export function mirror(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'mirror';
  const bk = parts();
  const rand = rng(77);
  const n = makeNoise(78);
  const FLOOR = 4.8;
  const CREST = 7.2;
  const RIM = 1.7;
  const FOOT = 13.5;
  // the steps' line in plan, from the crest (k = 0) down to the floor (1)
  const stepRho = (k) => mix(CREST + 0.6, FLOOR - 0.4, k);
  const stepA = (k) => mix(Math.PI / 2 + 0.5, Math.PI / 2 - 0.12, k);
  const stepAt = (k, out = V3()) => out.set(Math.cos(stepA(k)) * stepRho(k), RIM * (1 - k), Math.sin(stepA(k)) * stepRho(k));
  const path = [];
  for (let i = 0; i <= 40; i++) path.push(stepAt(i / 40));
  const nearSteps = (x, z) => {
    let best = 1e9;
    let bk2 = 0;
    path.forEach((p, i) => {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < best) {
        best = d;
        bk2 = i / 40;
      }
    });
    return [best, bk2];
  };
  const crestY = (a) => RIM * (1 + (n(Math.cos(a) * 1.4 + 4, Math.sin(a) * 1.4 + 2) - 0.5) * 0.45);
  const bankY = (rho, a) => {
    const top = crestY(a);
    let y;
    if (rho <= FLOOR) y = 0;
    else if (rho <= CREST) y = top * smooth(FLOOR, CREST, rho);
    else y = top * (1 - smooth(CREST, FOOT, rho));
    const x = Math.cos(a) * rho;
    const z = Math.sin(a) * rho;
    const bell = smooth(FLOOR - 0.2, FLOOR + 0.8, rho) * (1 - smooth(FOOT - 1.8, FOOT, rho));
    y += (noise3(n, x * 0.45, 3.3, z * 0.45) - 0.5) * 0.55 * bell + (n(x * 1.3 + 7, z * 1.3) - 0.5) * 0.06;
    // the cut the steps come down in
    const [d, k] = nearSteps(x, z);
    const want = RIM * (1 - k) - 0.08;
    const w = 1 - smooth(0.95, 1.8, d);
    return mix(y, Math.min(y, want), w);
  };
  // the ground: rings out from under the dais to the bank's outer foot
  const rings = [1.6, 2.4, 3.2, 3.9, 4.4, 4.8, 5.1, 5.4, 5.7, 6.0, 6.3, 6.6, 6.9, 7.2, 7.5, 7.9, 8.4, 9.0, 9.8, 10.7, 11.7, 12.6, 13.5];
  const AR = 112;
  const pos = [];
  for (const rho of rings) {
    for (let i = 0; i <= AR; i++) {
      const a = (i / AR) * TAU;
      pos.push(Math.cos(a) * rho, bankY(rho, a), Math.sin(a) * rho);
    }
  }
  const ground = weldSeam(geoOf(pos, gridIdx(rings.length - 1, AR)), rings.length, AR);
  const moss = C(0x46522a);
  const mossLit = C(0x76843e);
  const earthC = C(0x4e4030);
  const litter = C(0xbc9c4c);
  ground.computeVertexNormals();
  weldSeam(ground, rings.length, AR);
  paintGeo(ground, (p, nrm, out) => {
    const rho = Math.hypot(p.x, p.z);
    out.copy(moss).lerp(mossLit, smooth(0.3, 0.8, n(p.x * 0.4 + 2, p.z * 0.4)) * 0.7);
    // bare earth where the bank is steep
    out.lerp(earthC, smooth(0.85, 0.55, nrm.y) * 0.75);
    // gold leaves lying in drifts, thicker on the floor
    const drift = smooth(0.4, 0.66, fbm(n, p.x * 0.35 + 5, p.z * 0.35, { octaves: 3 }));
    out.lerp(litter, drift * (rho < FLOOR + 0.3 ? 0.85 : 0.6));
  });
  bk.add(mats.earth, ground, { uv: 0.35 });
  // the dais, with a line of silver inlaid round it
  bk.add(mats.paleStone, lathe([[0.001, 0.08], [1.85, 0.08], [1.95, 0.06], [2.0, 0.02], [2.03, -0.15]], 56), { uv: 0.7 });
  bk.add(mats.silver, new THREE.TorusGeometry(1.62, 0.012, 3, 72).rotateX(Math.PI / 2), { p: [0, 0.08, 0] });
  // the pedestal, carved stone, with three stems twining up it
  const P0 = 0.08;
  bk.add(mats.paleStone, lathe([[0.46, 0], [0.46, 0.06], [0.4, 0.1], [0.38, 0.14], [0.27, 0.2], [0.2, 0.28], [0.15, 0.4], [0.14, 0.52], [0.15, 0.6], [0.2, 0.66], [0.3, 0.7], [0.36, 0.73]].map(([rr, y]) => [rr, y + P0]), 28), { uv: 1.4 });
  for (let k = 0; k < 3; k++) {
    const vine = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const y = mix(0.16, 0.68, t);
      const rr = (y < 0.28 ? mix(0.26, 0.19, (y - 0.16) / 0.12) : y > 0.6 ? mix(0.15, 0.22, (y - 0.6) / 0.08) : 0.15) + 0.018;
      vine.push(polar((k / 3) * TAU + t * TAU * 0.8, rr, y + P0));
    }
    bk.add(mats.paleStone, tube(vine, 0.022, 0.014, { seg: 36, radial: 4 }), { uv: 2 });
    for (let i = 4; i < 24; i += 5) {
      const [vx, vy, vz] = vine[i];
      const a = Math.atan2(vz, vx);
      bk.add(mats.paleStone, leafBlade(0.1, 0.045, { curl: 0.9, seg: 3, thick: 0.006 }), { p: [vx, vy, vz], r: [0, Math.PI / 2 - a, (i % 10 ? 0.7 : -0.7)], uv: 2 });
    }
  }
  // the basin: a shallow bowl of silver, a ring of silver leaves under its lip
  const B0 = P0 + 0.72;
  bk.add(mats.silver, lathe([[0.1, 0], [0.3, 0.02], [0.48, 0.07], [0.62, 0.14], [0.7, 0.19], [0.725, 0.2], [0.72, 0.215], [0.69, 0.215], [0.66, 0.19], [0.5, 0.13], [0.3, 0.09], [0.001, 0.08]].map(([rr, y]) => [rr, y + B0]), 48));
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU;
    bk.add(mats.silver, leafBlade(0.16, 0.06, { curl: 0.7, seg: 3, thick: 0.006 }).rotateX(Math.PI - 0.5), { p: polar(a, 0.69, B0 + 0.175), r: [0, Math.PI / 2 - a, 0] });
  }
  const WY = B0 + 0.175;
  const uniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uTime: { value: 0 },
    uK: { value: 0 },
    uKind: { value: 0 },
    uNight: K.night,
    uShire: { value: K.tex.shire },
  };
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.625, 48).rotateX(-Math.PI / 2), K.shaders.mirrorWater(uniforms));
  water.name = 'mirrorWater';
  water.position.y = WY;
  water.renderOrder = 1;
  g.add(water);
  // the ewer's stand, and the ewer on it, its spout towards the basin
  const SA = 0.32;
  const [sx, , sz] = polar(SA, 1.32, 0);
  bk.add(mats.paleStone, lathe([[0.22, 0], [0.22, 0.05], [0.15, 0.09], [0.11, 0.2], [0.11, 0.34], [0.16, 0.4], [0.2, 0.43], [0.2, 0.46], [0.001, 0.47]].map(([rr, y]) => [rr, y + P0]), 20), { p: [sx, 0, sz], uv: 1.4 });
  const ewer = new THREE.Group();
  ewer.name = 'ewer';
  ewer.position.set(sx, P0 + 0.47, sz);
  ewer.rotation.y = Math.atan2(sz, -sx);
  const ek = parts();
  ek.add(mats.silver, lathe([[0.001, 0], [0.065, 0], [0.07, 0.012], [0.05, 0.03], [0.06, 0.05], [0.1, 0.1], [0.115, 0.16], [0.105, 0.22], [0.07, 0.27], [0.042, 0.31], [0.036, 0.36], [0.04, 0.4], [0.056, 0.43], [0.05, 0.442], [0.034, 0.42], [0.03, 0.38]], 20));
  ek.add(mats.silver, tube([[0.08, 0.15, 0], [0.15, 0.22, 0], [0.2, 0.33, 0], [0.25, 0.4, 0]], 0.02, 0.009, { seg: 10, radial: 6 }));
  ek.add(mats.silver, tube([[-0.035, 0.39, 0], [-0.13, 0.38, 0], [-0.16, 0.28, 0], [-0.1, 0.15, 0]], 0.012, 0.011, { seg: 12, radial: 5 }));
  ek.add(mats.silver, leafBlade(0.1, 0.04, { curl: -0.8, seg: 3, thick: 0.005 }), { p: [-0.12, 0.39, 0], r: [0, Math.PI / 2, 0] });
  ek.build(ewer);
  ewer.userData.spout = V3(0.25, 0.4, 0);
  g.add(ewer);
  // the steps down from the crest: curved treads following the flight,
  // a low stepped parapet either side
  const N = 8;
  const side = (k, off) => {
    const p = stepAt(k);
    const q = stepAt(Math.min(1, k + 0.01));
    const o = stepAt(Math.max(0, k - 0.01));
    const tx = q.x - o.x;
    const tz = q.z - o.z;
    const l = Math.hypot(tx, tz) || 1;
    return [p.x - (tz / l) * off, p.z + (tx / l) * off];
  };
  for (let i = 0; i < N; i++) {
    const k0 = Math.max(0, i / N - 0.02);
    const k1 = Math.min(1, (i + 1) / N + 0.02);
    const top = (RIM * (N - i)) / (N + 1);
    const pts = [];
    for (let j = 0; j <= 4; j++) pts.push(side(mix(k0, k1, j / 4), -0.8));
    for (let j = 4; j >= 0; j--) pts.push(side(mix(k0, k1, j / 4), 0.8));
    const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
    bk.add(mats.paleStone, slab(shape, 0.36 + (i === N - 1 ? 0 : 0.12), 0.03).translate(0, top, 0), { uv: 0.8 });
    for (const off of [-0.98, 0.98]) {
      const [ax, az] = side(k0, off);
      const [bx, bz] = side(k1, off);
      const ry = Math.atan2(bx - ax, bz - az);
      const len2 = Math.hypot(bx - ax, bz - az) + 0.06;
      bk.add(mats.paleStone, roundBox(0.26, 0.9, len2, 0.04), { p: [(ax + bx) / 2, top - 0.05, (az + bz) / 2], r: [0, ry, 0], uv: 0.8 });
    }
  }
  // stepping stones on to the dais
  const sb = stepAt(1);
  for (let i = 1; i <= 2; i++) {
    const f = i / 3;
    bk.add(mats.paleStone, roundBox(0.7, 0.12, 0.55, 0.05), { p: [mix(sb.x, 0, f * 0.75), 0.03, mix(sb.z, 0, f * 0.75)], r: [0, 0.3 * i, 0], uv: 0.8 });
  }
  // great roots arching over the bank into the hollow
  const rootAt = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + rand() * 0.35;
    const [d] = nearSteps(Math.cos(a) * 7, Math.sin(a) * 7);
    if (d < 2.2) continue;
    rootAt.push(a);
  }
  const barkC = barkTint(n, 50);
  rootAt.forEach((a, i) => {
    const wob = (rand() - 0.5) * 0.35;
    // a root humps up out of the ground and sinks again as it goes
    const rhos = [12.6, 11.2, 9.9, 8.7, 7.7, 6.8, 6.0, 5.2, 4.4];
    const lift = [-0.6, 0.0, -0.22, 0.18, 0.12, -0.12, 0.1, -0.05, -0.38];
    const pts = rhos.map((rho, j) => {
      const b = a + wob * (j / 8) + Math.sin(j * 1.3 + i) * 0.035;
      return polar(b, rho, bankY(rho, b) + lift[j]);
    });
    const r0 = 0.46 + rand() * 0.16;
    bk.add(mats.bark, tint(tube(pts, r0, 0.09, { seg: 22, radial: 7, gnarl: 0.16, seed: 300 + i, uvK: 0.45 }), (x, y, z, out) => barkC(x, y * 0.5, z, out).multiplyScalar(0.8)));
    // and a lesser root off it
    const j = 3 + (i % 3);
    const [bx, by, bz] = pts[j];
    const b2 = a + (i % 2 ? 0.25 : -0.25);
    const end = polar(b2, rhos[j] - 2.2, bankY(rhos[j] - 2.2, b2) - 0.2);
    const midR = polar((a + b2) / 2, rhos[j] - 1.1, bankY(rhos[j] - 1.1, (a + b2) / 2) + 0.12);
    bk.add(mats.bark, tint(tube([[bx, by - 0.1, bz], midR, end], r0 * 0.45, 0.05, { seg: 8, radial: 5, gnarl: 0.15, seed: 340 + i, uvK: 0.45 }), (x, y, z, out) => barkC(x, y * 0.5, z, out).multiplyScalar(0.8)));
  });
  // ferns and flowers on the bank and round the floor's edge
  const fernGeos = [fernGeo(1), fernGeo(2), fernGeo(3)];
  const flowers = [];
  let tries = 0;
  let placed = 0;
  while (placed < 30 && tries < 500) {
    tries++;
    const a = rand() * TAU;
    const rho = mix(4.3, 11.5, Math.pow(rand(), 0.8));
    const x = Math.cos(a) * rho;
    const z = Math.sin(a) * rho;
    if (nearSteps(x, z)[0] < 1.3) continue;
    const y = bankY(rho, a);
    const geo = fernGeos[placed % 3].clone();
    const s = 0.8 + rand() * 0.7;
    bk.add(mats.fern, geo, { p: [x, y - 0.04, z], r: [0, rand() * TAU, 0], s });
    placed++;
  }
  for (let i = 0; i < 70; i++) {
    const a = rand() * TAU;
    const rho = mix(2.4, 7.8, rand());
    const x = Math.cos(a) * rho;
    const z = Math.sin(a) * rho;
    if (nearSteps(x, z)[0] < 1.0) continue;
    flowers.push([x, bankY(rho, a), z]);
  }
  bk.add(mats.petal, flowersGeo(flowers, 5));
  bk.build(g);
  const KIND = { still: 0, stars: 0, eye: 1, shire: 2 };
  return {
    group: g,
    water: V3(0, WY, 0),
    ewer,
    uniforms,
    vision(k, kind) {
      uniforms.uK.value = clamp01(k);
      if (kind != null && KIND[kind] != null) uniforms.uKind.value = KIND[kind];
    },
    update(t) {
      uniforms.uTime.value = t;
    },
    steps: { at: stepAt, top: stepAt(0), bottom: stepAt(1) },
    rim: { r: CREST, y: RIM },
    floor: FLOOR,
    outer: FOOT,
  };
}

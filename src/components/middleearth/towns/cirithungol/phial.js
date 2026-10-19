// The phial of Galadriel, and Frodo bound in silk. Moved out of props.js
// as they were.

import * as THREE from 'three';
import { clamp01, makeNoise, smooth } from '../../../../lib/paint';
import { hot } from '../../../../lib/three/canvasTexture';
import { rng, tube } from '../../shire/build';
import { noise3, oneGeo, sweep, tint } from './helpers';

// ── the phial, Frodo in silk ──

// Galadriel's phial: a little crystal flask, 12 cm, the light of Eärendil
// in it. set(k): 0 dark, 1 blazing white-blue, with rays like a star.
export function phial(K) {
  const g = new THREE.Group();
  g.name = 'phial';
  const prof2 = [[0, 0], [0.022, 0.002], [0.032, 0.014], [0.035, 0.034], [0.03, 0.056], [0.016, 0.072], [0.009, 0.082], [0.009, 0.098], [0.013, 0.102], [0.013, 0.11], [0.007, 0.114], [0.006, 0.12]];
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xdfeaff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.45, emissive: hot(0xbfd4ff, 1), emissiveIntensity: 0.4, depthWrite: false });
  const glass = new THREE.Mesh(new THREE.LatheGeometry(prof2.map(([x, y]) => new THREE.Vector2(x, y)), 14), glassMat);
  glass.name = 'flask';
  g.add(glass);
  const coreMat = new THREE.MeshBasicMaterial({ color: hot(0xeaf2ff, 3) });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.02, 1), coreMat);
  core.position.y = 0.035;
  g.add(core);
  const S = (map, hex) => {
    const m = new THREE.SpriteMaterial({ map, color: hot(hex, 1), transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending });
    const s = new THREE.Sprite(m);
    s.position.y = 0.035;
    s.renderOrder = 8;
    g.add(s);
    return s;
  };
  const halo = S(K.tex.glow, 0xd6e4ff);
  const star = S(K.tex.star, 0xeef4ff);
  const wide = S(K.tex.glow, 0x8eb4ff);
  const set = (k) => {
    const t = clamp01(k);
    const e = t * t;
    coreMat.color.copy(hot(0xeaf2ff, 0.6 + 9 * e));
    glassMat.emissiveIntensity = 0.15 + 2.2 * e;
    const f = e * e;
    halo.scale.setScalar(0.1 + 0.5 * t + 0.6 * f);
    halo.material.color.copy(hot(0xd6e4ff, 0.5 + 2.5 * e));
    halo.material.opacity = 0.4 + 0.6 * t;
    star.scale.setScalar(0.1 + 0.5 * e + 1.9 * f);
    star.material.color.copy(hot(0xeef4ff, 1 + 3 * e));
    star.material.opacity = smooth(0.25, 0.8, t);
    wide.scale.setScalar(0.4 + 1.2 * e + 2.4 * f);
    wide.material.color.copy(hot(0x8eb4ff, 0.6 * f));
    wide.material.opacity = 0.5 * f;
    for (const s of [halo, star, wide]) s.visible = t > 0.001;
  };
  set(0.5);
  return { group: g, glass, core, set };
}

// Frodo bound in Shelob's silk: a cocoon 1.4 m long lying along x on the
// ground, his head at +x; wound round and round in grey-white silk,
// tighter at the neck and ankles, a few loose strands trailing.
export function silk(K) {
  const g = new THREE.Group();
  g.name = 'silk';
  const n = makeNoise(611);
  const r = rng(613);
  const rows = [
    [-0.7, 0.05, 0.06],
    [-0.62, 0.09, 0.11],
    [-0.4, 0.12, 0.14],
    [-0.1, 0.15, 0.19],
    [0.2, 0.16, 0.22],
    [0.34, 0.15, 0.2],
    [0.44, 0.1, 0.11],
    [0.56, 0.12, 0.12],
    [0.66, 0.1, 0.1],
    [0.72, 0.03, 0.03],
  ];
  const pts = rows.map(([x, ry]) => [x, ry + 0.005, 0]);
  const geo = sweep(pts, rows.map(([, ry, rz]) => [ry, rz, ry]), { seg: 46, radial: 18 });
  const p = geo.attributes.position;
  const nr = geo.attributes.normal;
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k);
    const y = p.getY(k);
    const z = p.getZ(k);
    const a = Math.atan2(z, y - 0.15);
    // the winding: ridges spiralling round it, and lumps where it's thick
    const wind = Math.sin(a * 1 + x * 52) * 0.5 + Math.sin(-a * 1 + x * 37 + 1.3) * 0.5;
    const d = wind * 0.012 + (noise3(n, x * 6, y * 6, z * 6) - 0.5) * 0.03;
    p.setXYZ(k, x + nr.getX(k) * d, Math.max(0, y + nr.getY(k) * d), z + nr.getZ(k) * d);
  }
  geo.computeVertexNormals();
  const list = [geo];
  // loose strands trailing from it to the ground
  for (let k = 0; k < 6; k++) {
    const x = (r() - 0.5) * 1.2;
    const s = r() < 0.5 ? -1 : 1;
    list.push(tube([[x, 0.16, s * 0.17], [x + (r() - 0.5) * 0.2, 0.06, s * (0.3 + r() * 0.2)], [x + (r() - 0.5) * 0.4, 0.005, s * (0.45 + r() * 0.35)]], 0.006, 0.002, { seg: 6, radial: 3 }));
  }
  const all = oneGeo(list);
  tint(all, (x, y, z, out, nx, ny) => {
    const a = Math.atan2(z, y - 0.15);
    const wind = Math.sin(a + x * 52) * 0.5 + 0.5;
    out.setRGB(0.84, 0.83, 0.78).multiplyScalar(0.72 + wind * 0.22 + noise3(n, x * 9, y * 9, z * 9) * 0.15);
    out.multiplyScalar(0.75 + 0.25 * smooth(-0.6, 0.6, ny));
  });
  const mesh = new THREE.Mesh(all, K.mats.silk);
  mesh.name = 'cocoon';
  g.add(mesh);
  return { group: g, mesh };
}

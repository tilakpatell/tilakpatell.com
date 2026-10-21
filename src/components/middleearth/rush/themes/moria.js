// The forges of Khazad-dûm: dark stone halls, great banded pillars,
// braziers, anvils, quenching troughs, crucibles, and a channel of molten
// rock lighting it all from below.

import * as THREE from 'three';
import { hot } from '../../../../lib/three/stage3dNodes';
import { B, cyl } from '../../shire/props';
import { V, motes, stream } from './common';

export const MORIA = {
  sky: { background: 0x07070a, fog: [0x0c0a0a, 14, 34], hemi: [0x9aa8c8, 0x2a160c, 0.75], sun: [0xb8c8ff, 1.0] },
  setup({ mats }) {
    // dark stone for Moria's halls
    const deep = mats.ashlar.clone();
    deep.color = new THREE.Color(0x5a5652);
    const coals = new THREE.MeshBasicMaterial({ color: hot(0xff5a1a, 2.2) });
    const leather = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 });
    return { deep, coals, leather };
  },
  room({ bk, mats, W, D, Z, wallH, lamps }, { deep }) {
    bk.add(deep, B(W + 2, 0.1, D + 2), { p: [0, -0.05, 0.5], uv: 0.4 });
    const zb = Z(0) - 0.2;
    bk.add(deep, B(W + 2, wallH + 1.2, 0.4), { p: [0, (wallH + 1.2) / 2, zb - 0.1], uv: 0.4 });
    // great square pillars, banded, and a band of carving along the wall
    for (let n = 0; n <= 4; n++) {
      const x = -W / 2 + n * (W / 4);
      bk.add(deep, B(0.62, wallH + 1.2, 0.62), { p: [x, (wallH + 1.2) / 2, zb + 0.2], uv: 1 });
      for (const y of [0.5, 2.2, 3.6]) bk.add(mats.iron, B(0.7, 0.1, 0.7), { p: [x, y, zb + 0.2] });
    }
    bk.add(mats.brass, B(W + 2, 0.06, 0.04), { p: [0, 2.6, zb + 0.12] });
    bk.add(mats.brass, B(W + 2, 0.06, 0.04), { p: [0, 2.9, zb + 0.12] });
    for (const sx of [-1, 1]) {
      bk.add(deep, B(0.4, wallH + 1.2, D + 1), { p: [sx * (W / 2 + 0.2), (wallH + 1.2) / 2, 0], uv: 0.4 });
      for (let k = 0; k <= 3; k++) bk.add(deep, B(0.5, wallH + 1.2, 0.5), { p: [sx * (W / 2 + 0.1), (wallH + 1.2) / 2, -D / 2 + k * (D / 3)], uv: 1 });
    }
    // braziers on the pillars
    for (let n = 0; n <= 4; n++) lamps.push(V(-W / 2 + n * (W / 4), 1.7, zb + 0.6));
  },
  counter: (c, stone, { mats, m }, { deep }) => [deep, c === 'S' ? m.darkWood : mats.ashlar],
  stations: {
    B({ bk, mats }) {
      // an anvil to crush the ore on, and a hammer
      bk.add(mats.iron, B(0.5, 0.12, 0.24), { p: [0, 0.2, -0.02] });
      bk.add(mats.iron, B(0.22, 0.16, 0.16), { p: [0, 0.07, -0.02] });
      bk.add(mats.iron, cyl(0.08, 0.02, 0.18, 8), { p: [0.3, 0.2, -0.02], r: [0, 0, Math.PI / 2] });
      bk.add(mats.timber, cyl(0.02, 0.02, 0.32, 6), { p: [0.05, 0.3, 0.22], r: [0, 0.3, Math.PI / 2] });
      bk.add(mats.iron, B(0.08, 0.1, 0.1), { p: [0.2, 0.3, 0.25] });
    },
    W({ bk }, { deep }) {
      // a quenching trough
      bk.add(deep, B(0.86, 0.28, 0.6), { p: [0, 0.14, 0], uv: 1 });
    },
    O({ bk, mats }, { deep, coals, leather }) {
      // a dwarf-forge: a stone hearth with its bed of coals, a hood and
      // chimney over it, and the bellows at its side
      bk.add(deep, B(0.84, 0.22, 0.72), { p: [0, 0.11, -0.04], uv: 1 });
      bk.add(coals, B(0.62, 0.03, 0.5), { p: [0, 0.235, -0.04] });
      for (let k = 0; k < 9; k++) bk.add(mats.iron, new THREE.IcosahedronGeometry(0.045, 0), { p: [Math.cos(k * 2.4) * 0.22, 0.25, -0.04 + Math.sin(k * 2.4) * 0.17], r: [k, k * 2, 0] });
      bk.add(mats.iron, new THREE.CylinderGeometry(0.1, 0.46, 0.42, 4, 1, true), { p: [0, 0.78, -0.1], r: [0, Math.PI / 4, 0] });
      bk.add(deep, B(0.18, 0.9, 0.18), { p: [0, 1.4, -0.1], uv: 1 });
      bk.add(leather, B(0.1, 0.18, 0.34), { p: [0.47, 0.16, -0.06], r: [0, 0, 0.15] });
      bk.add(mats.timber, B(0.04, 0.04, 0.34), { p: [0.52, 0.27, -0.06] });
    },
  },
  // (what's on the forge sits on its coals)
  ovenAt: { y: 0.25, out: 0.04 },
  water: (ctx, { deep }) => stream(ctx, { lava: true, kerb: deep }),
  extras(ctx) {
    const { room, scene, lamps, at, W, D, X, Z, mats } = ctx;
    // braziers on the pillars, and the molten channel's glow
    const flame = new THREE.MeshBasicMaterial({ color: hot(0xff8a2a, 3) });
    const flameGeo = new THREE.SphereGeometry(0.12, 8, 6);
    const bowlGeo = cyl(0.2, 0.1, 0.16, 10);
    for (const p of lamps) {
      const b = new THREE.Mesh(bowlGeo, mats.iron);
      b.position.copy(p);
      const f = new THREE.Mesh(flameGeo, flame);
      f.position.copy(p).add(V(0, 0.14, 0));
      f.scale.set(1, 1.5, 1);
      room.add(b, f);
    }
    const lava = [];
    for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) if (at(i, j) === '~') lava.push(V(X(i + 0.5), 0.4, Z(j + 0.5)));
    for (const k of [0.25, 0.75]) {
      const p = lava[Math.floor(lava.length * k)];
      if (!p) continue;
      const l = new THREE.PointLight(0xff5a1a, 4, 8, 1.4);
      l.position.copy(p);
      scene.add(l);
    }
    // sparks, rising off the molten rock
    const sparks = lava.length ? motes(ctx, { n: 80, colour: 0xff8a3a, size: 0.08, rise: 0.9, sway: 0.25, life: [0.8, 2.2], glow: 2, from: () => lava[Math.floor(Math.random() * lava.length)].clone().add(V((Math.random() - 0.5) * 0.9, -0.35, (Math.random() - 0.5) * 0.9)) }) : null;
    return { tick: (dt, t) => sparks?.tick(dt, t) };
  },
  // the crucibles: grey ore, molten, then mithril
  pot: (potMat) => ({ empty: potMat(0x2a2a2a), part: potMat(0x6a6a72), cooking: new THREE.MeshBasicMaterial({ color: hot(0xff6a1a, 2) }), done: new THREE.MeshStandardMaterial({ color: 0xf2f6ff, metalness: 1, roughness: 0.1, emissive: hot(0xa8c0ff, 0.6) }), burnt: potMat(0x141010) }),
};

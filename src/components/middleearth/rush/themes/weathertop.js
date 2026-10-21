// The dell under Weathertop, at night: heather and broken walls, the hill
// black against the stars with the ruined ring of Amon Sûl on top, the
// hobbits' fires (frying pans and spits, fed with wood), a kettle on a
// tripod, and five dark shapes coming up the slope as the night goes on.

import * as THREE from 'three';
import { hot } from '../../../../lib/three/stage3dNodes';
import { B, ball, cyl, lathe } from '../../shire/props';
import { campfire } from './common';

export const WEATHERTOP = {
  // (a bright moon: night, but you can see what you're cooking)
  sky: { background: 0x0e1426, fog: [0x141c30, 18, 48], hemi: [0xa8b8e8, 0x2a2a20, 1.2], sun: [0xc8d8ff, 1.8], sunAt: [5, 10, 4] },
  setup({ mats }) {
    const rock = mats.ashlar.clone();
    rock.color = new THREE.Color(0x7a766e);
    const slab = mats.ashlar.clone();
    slab.color = new THREE.Color(0x9a948a);
    return { rock, slab };
  },
  room({ bk, mats, W, D, Z }, { rock }) {
    // heather underfoot, and the broken walls of an old camp round the dell
    bk.add(mats.turf, B(W + 36, 0.1, D + 26), { p: [0, -0.05, -6], uv: 0.3, color: 0x5e6844 });
    const zb = Z(0) - 0.5;
    for (let n = 0; n < 9; n++) {
      const h = 0.6 + ((n * 7) % 5) * 0.25;
      bk.add(rock, B(W / 9 - 0.05, h, 0.5), { p: [-W / 2 + (n + 0.5) * (W / 9), h / 2, zb], uv: 1 });
    }
    for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) {
      const h = 0.4 + ((k * 5 + (sx > 0 ? 2 : 0)) % 4) * 0.2;
      bk.add(rock, B(0.5, h, D / 4 - 0.1), { p: [sx * (W / 2 + 0.6), h / 2, -D / 2 + (k + 0.5) * (D / 4)], uv: 1 });
    }
    // Weathertop itself, and the ring of Amon Sûl on its crown
    bk.add(mats.stone, new THREE.ConeGeometry(11, 9, 12), { p: [2, 3.5, Z(0) - 14], uv: 0.2 });
    bk.add(rock, new THREE.TorusGeometry(1.6, 0.35, 5, 14), { p: [2, 8.1, Z(0) - 14], r: [Math.PI / 2, 0, 0] });
  },
  counter: (c, stone, { m }, { rock, slab }) => [rock, c === 'S' ? m.darkWood : slab],
  stations: {
    O: campfire,
    P({ bk, mats, m }) {
      // a frying pan on stones over a fire
      for (let k = 0; k < 7; k++) bk.add(mats.stone, ball(0.07, 6, 4), { p: [Math.cos(k * 0.9) * 0.3, 0.03, Math.sin(k * 0.9) * 0.3] });
      for (let k = 0; k < 3; k++) bk.add(m.darkWood, cyl(0.03, 0.03, 0.36, 6), { p: [0, 0.04, 0], r: [Math.PI / 2, 0, k * 1.05] });
      bk.add(mats.iron, lathe([[0, 0.17], [0.3, 0.17], [0.34, 0.27], [0.32, 0.27], [0.285, 0.185], [0, 0.185]], 18));
      bk.add(mats.iron, cyl(0.018, 0.02, 0.4, 6), { p: [0.5, 0.25, 0], r: [0, 0, Math.PI / 2 - 0.15] });
    },
    T({ bk, mats }) {
      // a kettle hung on a tripod
      for (let k = 0; k < 3; k++) bk.add(mats.timber, cyl(0.015, 0.02, 0.85, 5), { p: [Math.cos(k * 2.1) * 0.16, 0.4, Math.sin(k * 2.1) * 0.16 - 0.12], r: [Math.sin(k * 2.1) * 0.35, 0, -Math.cos(k * 2.1) * 0.35] });
      bk.add(mats.iron, lathe([[0, 0], [0.12, 0], [0.15, 0.08], [0.12, 0.18], [0.04, 0.2], [0, 0.2]], 14), { p: [0, 0.22, -0.12] });
      bk.add(mats.iron, cyl(0.012, 0.02, 0.14, 6), { p: [0.16, 0.36, -0.12], r: [0, 0, -0.9] });
    },
  },
  pan: true,
  flame: ['O', 'P'],
  extras({ scene, room, W, Z }) {
    // stars, and the moon over the hill
    const n = 260;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 70, 6 + Math.random() * 18, Z(0) - 18 - Math.random() * 8], i * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    room.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 0.09, fog: false })));
    const moon = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), new THREE.MeshBasicMaterial({ color: hot(0xeef2ff, 1.4), fog: false }));
    moon.position.set(-W / 2 + 1, 13, Z(0) - 20);
    room.add(moon);
    // the Riders: five black shapes on the slope, closer as the night goes on
    // (black, with a cold edge of moonlight, so they read against the dark)
    const cloak = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 1, emissive: 0x0c1020 });
    const riders = Array.from({ length: 5 }, (_, k) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.8, 8), cloak);
      body.position.y = 0.9;
      const hood = new THREE.Mesh(ball(0.18, 8, 6), cloak);
      hood.position.y = 1.82;
      hood.scale.set(1, 1.3, 1);
      g.add(body, hood);
      g.userData.x = -4.4 + k * 2.2 + (k % 2) * 0.4;
      scene.add(g);
      return g;
    });
    return {
      tick(dt, t, s) {
        const k = s.level.time ? 1 - s.left / s.level.time : 0;
        // up the slope from the road, and by the end, just over the wall
        riders.forEach((g, i) => {
          const z = Z(0) - 10 + Math.min(1, k * 1.15) * 8.6 - (i % 2) * 0.6;
          g.position.set(g.userData.x, Math.max(0, (Z(0) - 3 - z) * 0.55) + Math.sin(t * 0.7 + i) * 0.03, z);
        });
      },
    };
  },
};

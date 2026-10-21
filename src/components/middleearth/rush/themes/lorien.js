// Lothlórien: flets high in the mallorns at night, silver trunks rising
// through them, blue-white lanterns, and rope bridges over the drop to the
// forest floor far below (the '~' tiles here are the drop, not water).

import * as THREE from 'three';
import { hot } from '../../../../lib/three/stage3dNodes';
import { B, cyl } from '../../shire/props';
import { V, basin, fountain, lampsAt, motes } from './common';

export const LORIEN = {
  sky: { background: 0x0a1222, fog: [0x0e1a2a, 18, 30], hemi: [0xb8ccff, 0x1a2a20, 1.05], sun: [0xc8d8ff, 1.5] },
  setup({ mats, paint }) {
    // silver-grey planks and mallorn bark (the bark's own map is brown;
    // without it the trunks come out silver)
    const bark = mats.trunk.clone();
    bark.map = null;
    bark.color = new THREE.Color(0xc4c8cc);
    return { flet: paint(0xc8c0a8), fletSide: paint(0x8e8a76), fletTop: paint(0xe8e2cc), bark, oven: mats.ashlar };
  },
  room({ bk, at, W, D, X, Z, wallH, lamps }, { flet, bark }) {
    // a plank floor everywhere but the drop
    for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) if (at(i, j) !== '~') bk.add(flet, B(1, 0.1, 1), { p: [X(i + 0.5), -0.05, Z(j + 0.5)], uv: 1 });
    // the mallorns' great silver trunks, rising through the back of the flets
    const zb = Z(0) - 0.5;
    for (const x of [-W / 2 + 0.6, -1.5, 2.5, W / 2 - 0.6]) bk.add(bark, cyl(0.55, 0.7, wallH + 3, 14), { p: [x, (wallH + 3) / 2 - 1.5, zb] });
    // a railing round the flets' outer edges
    for (const sx of [-1, 1]) {
      bk.add(flet, B(0.08, 0.08, D), { p: [sx * (W / 2 + 0.08), 0.7, 0] });
      for (let k = 0; k <= 4; k++) bk.add(flet, B(0.08, 0.7, 0.08), { p: [sx * (W / 2 + 0.08), 0.35, -D / 2 + k * (D / 4)] });
    }
    // blue-white lanterns hung from the trunks
    for (const x of [-W / 2 + 0.6, -1.5, 2.5, W / 2 - 0.6]) lamps.push(V(x + 0.7, 2.1, zb + 0.4));
  },
  counter: (c, stone, { mats, m }, { fletSide, fletTop }) => [stone ? mats.dressed : fletSide, c === 'S' ? m.darkWood : stone ? mats.dressed : fletTop],
  stations: {
    B({ bk }, { flet }) {
      // a spinning wheel
      bk.add(flet, new THREE.TorusGeometry(0.26, 0.025, 6, 20), { p: [0, 0.36, -0.1] });
      for (let k = 0; k < 6; k++) bk.add(flet, B(0.015, 0.5, 0.015), { p: [0, 0.36, -0.1], r: [0, 0, (k * Math.PI) / 6] });
      for (const sx of [-1, 1]) bk.add(flet, B(0.04, 0.4, 0.04), { p: [sx * 0.05, 0.18, -0.1] });
      bk.add(flet, B(0.5, 0.04, 0.3), { p: [0, 0.02, 0.05] });
    },
    T: (ctx) => fountain(ctx, ctx.items.M.starlight),
    W: basin,
  },
  water({ bk, room, items, at, wet, W, D, X, Z }, { flet }) {
    // the drop between the flets: the forest floor far below, and the
    // lights of Caras Galadhon among the trunks
    const below = new THREE.Mesh(new THREE.PlaneGeometry(W + 30, D + 30), new THREE.MeshBasicMaterial({ color: 0x0c1a14 }));
    below.rotation.x = -Math.PI / 2;
    below.position.y = -7;
    room.add(below);
    const lightGeo = new THREE.SphereGeometry(0.12, 6, 4);
    const lightMat = new THREE.MeshBasicMaterial({ color: hot(0xdce8ff, 2.2) });
    for (let k = 0; k < 18; k++) {
      const o = new THREE.Mesh(lightGeo, lightMat);
      o.position.set(Math.sin(k * 7.3) * (W / 2 + 4), -2 - (k % 5) * 0.9, Math.cos(k * 3.1) * (D / 2 + 3));
      room.add(o);
    }
    const rope = items.M.twine;
    for (let j = 0; j < D; j++)
      for (let i = 0; i < W; i++) {
        const c = at(i, j);
        const x = X(i + 0.5);
        const z = Z(j + 0.5);
        if (c === '~') {
          // the flet's edge, where the drop begins
          for (const sx of [-1, 1]) if (at(i + sx, j) !== '~' && at(i + sx, j) !== 'x') bk.add(flet, B(0.06, 0.18, 1), { p: [x + sx * 0.5, -0.01, z] });
        } else if (c === '.' && (wet(i, j - 1) || wet(i, j + 1) || wet(i - 1, j) || wet(i + 1, j))) {
          // a rope bridge: planks, posts and the ropes along its sides
          const wide = wet(i - 1, j) || wet(i + 1, j);
          for (let k = -2; k <= 2; k++) bk.add(flet, B(wide ? 1 : 0.18, 0.05, wide ? 0.18 : 1), { p: [x + (wide ? 0 : k * 0.2), 0.0, z + (wide ? k * 0.2 : 0)] });
          for (const side of [-1, 1]) {
            const px = wide ? 0 : side * 0.45;
            const pz = wide ? side * 0.45 : 0;
            for (const e of [-1, 1]) bk.add(flet, B(0.05, 0.6, 0.05), { p: [x + px + (wide ? e * 0.45 : 0), 0.3, z + pz + (wide ? 0 : e * 0.45)] });
            bk.add(rope, cyl(0.015, 0.015, 1, 5), { p: [x + px, 0.55, z + pz], r: wide ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0] });
          }
        }
      }
    return null;
  },
  extras(ctx) {
    const { W, D, Z } = ctx;
    lampsAt(ctx, { glow: 0xdce8ff, size: 0.1, light: 0xc8d8ff, intensity: 2.4, range: 10, y: 2.4, z: 0.8 });
    // mallorn leaves, gold, drifting down through the lantern light
    return motes(ctx, { n: 36, colour: 0xffcf6a, size: 0.13, rise: -0.32, sway: 0.6, life: [6, 10], glow: 1.1, from: () => V((Math.random() - 0.5) * (W + 2), 3.2 + Math.random(), Z(0) + Math.random() * D) });
  },
};

// The Long-expected Party: the Party Field at dusk, the pavilion's poles
// with bunting and lanterns strung between them, trestles under white
// cloths with flowers on the serving tables, Farmer Maggot's mushroom
// beds, Bilbo's presents (mathoms, all labelled) and hay bales about the
// field, his notice on its post, the Party Tree, Bag End's door in the
// Hill, and Gandalf's fireworks going up over it all.

import * as THREE from 'three';
import { hot } from '../../../../lib/three/stage3dNodes';
import { B, ball, cyl } from '../../shire/props';
import { dotTexture } from '../../towns/bake';
import { V, lampsAt, sign, skyBehind } from './common';

const FIREWORKS = [0xffd27a, 0xff7ad8, 0x8ad8ff, 0xb8ff8a, 0xffa060];

export const PARTY = {
  sky: { background: 0x2a2d4a, fog: [0x3a3550, 22, 60], hemi: [0xffe8c8, 0x3a4a2a, 1.3], sun: [0xffc890, 2.0], sunAt: [-6, 9, 5] },
  setup({ mats }) {
    const plain = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
    const flags = [0xc84a3a, 0xf0c040, 0x3a7ac8, 0x4a9a4a, 0xefe6d2].map(plain);
    return { cloth: mats.canvas, soil: plain(0x4a3220), red: plain(0xc84a3a), cream: plain(0xefe6d2), flags, straw: plain(0xd8b860), vase: plain(0x4a6aa8), lantern: new THREE.MeshBasicMaterial({ color: hot(0xffc060, 2.4) }) };
  },
  room({ bk, mats, W, D, Z, lamps }, { red, cream, flags, straw, lantern }) {
    // the Party Field, running back to the Tree and the Hill
    bk.add(mats.turf, B(W + 36, 0.1, D + 26), { p: [0, -0.05, -6], uv: 0.3, color: 0x8aa858 });
    // the pavilion: its poles, and a striped valance along the back
    const zb = Z(0) - 0.6;
    for (let n = 0; n <= 4; n++) bk.add(mats.timber, cyl(0.06, 0.07, 3.4, 8), { p: [-W / 2 + n * (W / 4), 1.7, zb] });
    for (const sx of [-1, 1]) for (let k = 1; k <= 2; k++) bk.add(mats.timber, cyl(0.06, 0.07, 3.4, 8), { p: [sx * (W / 2 + 0.5), 1.7, zb + k * 2.6] });
    for (let n = 0; n < 12; n++) bk.add(n % 2 ? cream : red, B(W / 12, 0.36, 0.04), { p: [-W / 2 + (n + 0.5) * (W / 12), 3.2, zb] });
    // lanterns strung between the poles
    for (let n = 0; n < 9; n++) lamps.push(V(-W / 2 + 0.6 + n * ((W - 1.2) / 8), 2.6 - Math.sin((n / 8) * Math.PI) * 0.3, zb + 0.05));
    // bunting, pole to pole down the sides
    for (const sx of [-1, 1]) {
      const run = [V(sx * (W / 2), 2.25, zb), V(sx * (W / 2 + 0.5), 2.25, zb + 2.6), V(sx * (W / 2 + 0.5), 2.25, zb + 5.2)];
      for (let r = 0; r < 2; r++) {
        const [a, b] = [run[r], run[r + 1]];
        for (let k = 0; k <= 7; k++) {
          const p = a.clone().lerp(b, k / 7);
          p.y -= Math.sin((k / 7) * Math.PI) * 0.25;
          bk.add(flags[(k + r * 3) % flags.length], new THREE.ConeGeometry(0.08, 0.17, 3), { p: [p.x, p.y - 0.09, p.z], r: [Math.PI, 0, 0], s: [1, 1, 0.3] });
        }
      }
    }
    // lanterns on posts at the corners of the field
    for (const [x, z] of [[-W / 2 - 0.9, Z(0) + 0.6], [W / 2 + 0.9, Z(0) + 0.6], [-W / 2 - 0.9, Z(D) - 0.6], [W / 2 + 0.9, Z(D) - 0.6]]) {
      bk.add(mats.timber, cyl(0.03, 0.04, 1.9, 6), { p: [x, 0.95, z] });
      bk.add(lantern, ball(0.1, 10, 8), { p: [x, 1.95, z] });
    }
    // Bilbo's presents, a pile of them (every one labelled), and hay bales
    for (const [x, z, k] of [[-W / 2 - 0.85, Z(0) + 1.7, 0], [-W / 2 - 0.7, Z(0) + 2.1, 1], [W / 2 + 0.8, Z(0) + 2.4, 2], [W / 2 + 0.75, Z(0) + 2.85, 3], [W / 2 + 0.95, Z(0) + 2.6, 4]]) {
      const h = 0.22 + (k % 3) * 0.08;
      bk.add(flags[k % flags.length], B(0.34, h, 0.34), { p: [x, h / 2, z], r: [0, k * 0.4, 0] });
      bk.add(flags[(k + 1) % flags.length], B(0.36, h + 0.01, 0.05), { p: [x, h / 2, z], r: [0, k * 0.4, 0] });
      bk.add(flags[(k + 1) % flags.length], ball(0.05, 6, 5), { p: [x, h + 0.03, z] });
    }
    for (const [x, z] of [[-W / 2 - 0.85, Z(D) - 2.2], [W / 2 + 0.85, Z(D) - 1.6]]) bk.add(straw, cyl(0.28, 0.28, 0.7, 12), { p: [x, 0.28, z], r: [Math.PI / 2, 0, 0] });
    // the Party Tree
    bk.add(mats.trunk, cyl(0.45, 0.7, 5, 10), { p: [W / 2 - 2, 2.5, Z(0) - 7] });
    for (const [x, y, z, r] of [[0, 5.6, 0, 2.4], [-1.6, 4.8, 0.6, 1.7], [1.5, 5, -0.4, 1.8], [0.4, 6.8, 0.2, 1.6]]) bk.add(mats.foliage, ball(r, 10, 8), { p: [W / 2 - 2 + x, y, Z(0) - 7 + z], color: 0x5a7a34 });
  },
  // trestles under white cloths (red where the guests are served); the
  // patch's beds of earth; brick for the ovens
  counter: (c, stone, { mats, m }, { cloth, soil, red }) => (c === 'G' ? [mats.barnwood, soil] : [stone ? m.brick : mats.timber, stone ? mats.dressed : c === 'S' ? red : c === '#' ? cloth : m.topWood]),
  stations: {
    S({ bk }, { vase, flags }) {
      // a little jug of flowers on each of the serving tables
      bk.add(vase, cyl(0.04, 0.05, 0.12, 8), { p: [0.36, 0.06, -0.3] });
      for (let k = 0; k < 4; k++) bk.add(flags[k % 3], ball(0.035, 6, 5), { p: [0.36 + Math.cos(k * 1.6) * 0.04, 0.15 + (k % 2) * 0.03, -0.3 + Math.sin(k * 1.6) * 0.04] });
    },
    G({ bk, mats }) {
      // a low wattle edge round the bed, and leaves coming up
      for (const [a, b, w, d] of [[0, -0.42, 0.9, 0.05], [0, 0.42, 0.9, 0.05], [-0.42, 0, 0.05, 0.9], [0.42, 0, 0.05, 0.9]]) bk.add(mats.barnwood, B(w, 0.12, d), { p: [a, 0.04, b] });
      for (let k = 0; k < 6; k++) bk.add(mats.foliage, ball(0.05, 5, 4), { p: [Math.cos(k * 2.3) * 0.28, 0.01, Math.sin(k * 2.3) * 0.28], s: [1.4, 0.4, 1.4], color: 0x4a6a2a });
    },
  },
  extras(ctx) {
    const { scene, room, W, D, Z } = ctx;
    // the dusk behind the Hill, and Bag End's round green door in it
    skyBehind(ctx, [[0, '#1a1a3a'], [0.5, '#4a3a6a'], [0.8, '#c87a5a'], [1, '#f0b070']], { z: -16, y: 5, h: 18 });
    const hill = new THREE.Mesh(new THREE.SphereGeometry(9, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4a6a34, roughness: 1 }));
    hill.scale.set(1.6, 0.5, 1);
    hill.position.set(-6, -0.2, Z(0) - 14);
    const door = new THREE.Mesh(new THREE.CircleGeometry(0.7, 20), new THREE.MeshStandardMaterial({ color: 0x2a6a3a, roughness: 0.6 }));
    door.position.set(-6, 2.6, Z(0) - 5.6);
    room.add(hill, door);
    lampsAt(ctx, { glow: 0xffc870, size: 0.08, light: 0xffb060, intensity: 2.4, range: 10, y: 2.6, z: 0.4 });
    // and his notice, by the way in
    sign(ctx, ['No admittance', 'except on', 'party business'], { at: V(-W / 2 - 0.8, 0, Z(D) - 1.1), turn: 0.35, w: 0.9, h: 0.6 });
    // Gandalf's fireworks: bursts over the field, one after another
    const spark = dotTexture();
    const bursts = FIREWORKS.map((hex) => {
      const n = 48;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: hot(hex, 3), size: 0.16, map: spark, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      pts.frustumCulled = false;
      pts.visible = false;
      scene.add(pts);
      return { pts, v: new Float32Array(n * 3), age: 0, life: 0 };
    });
    let next = 0.5;
    let k = 0;
    return {
      tick(dt) {
        next -= dt;
        if (next <= 0) {
          const b = bursts[k++ % bursts.length];
          // (low over the back of the field, where you can see them from the kitchen)
          const at = V(-W / 2 + Math.random() * W, 2.6 + Math.random() * 0.9, Z(0) - 1.6 - Math.random() * 1.6);
          const p = b.pts.geometry.attributes.position;
          for (let i = 0; i < p.count; i++) {
            const u = Math.random() * 2 - 1;
            const a = Math.random() * Math.PI * 2;
            const r = Math.sqrt(1 - u * u);
            const sp = 1.2 + Math.random() * 0.5;
            b.v.set([r * Math.cos(a) * sp, u * sp, r * Math.sin(a) * sp], i * 3);
            p.setXYZ(i, at.x, at.y, at.z);
          }
          b.age = 0;
          b.life = 1.8;
          b.pts.visible = true;
          next = 0.9 + Math.random() * 1.8;
        }
        for (const b of bursts) {
          if (!b.pts.visible) continue;
          b.age += dt;
          const p = b.pts.geometry.attributes.position;
          for (let i = 0; i < p.count; i++) {
            b.v[i * 3 + 1] -= 1.1 * dt;
            p.setXYZ(i, p.getX(i) + b.v[i * 3] * dt, p.getY(i) + b.v[i * 3 + 1] * dt, p.getZ(i) + b.v[i * 3 + 2] * dt);
          }
          p.needsUpdate = true;
          b.pts.material.opacity = Math.max(0, 1 - b.age / b.life);
          if (b.age >= b.life) b.pts.visible = false;
        }
      },
    };
  },
};

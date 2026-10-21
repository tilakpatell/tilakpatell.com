// The Houses of Healing at night: a long hall of white stone under the
// Citadel, tall windows on the dark over the Pelennor, beds along the walls
// under white linen, lamps low, and the sweet steam of kingsfoil drifting
// up from the kettles. The shared stations (./common.js) are the Pony's.

import * as THREE from 'three';
import { B, cyl } from '../../shire/props';
import { V, basin, fountain, lampsAt, motes, skyBehind } from './common';

export const HOUSES = {
  sky: { background: 0x10141e, fog: [0x141a26, 18, 46], hemi: [0xf0f0ff, 0x3a3a46, 1.3], sun: [0xe8ecff, 1.6], sunAt: [-4, 9, 5] },
  setup({ mats }) {
    const white = mats.plaster.clone();
    white.color = new THREE.Color(0xf2efe8);
    const linen = new THREE.MeshStandardMaterial({ color: 0xf4f2ec, roughness: 0.95 });
    const frame = new THREE.MeshStandardMaterial({ color: 0x6a5238, roughness: 0.85 });
    const cistern = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.8, roughness: 0.1, emissive: 0x1a3a4a });
    return { white, linen, frame, cistern };
  },
  room({ bk, mats, W, D, Z, wallH }, { white, linen, frame }) {
    // dressed stone underfoot, white walls, and the vault's ribs over the hall
    bk.add(mats.dressed, B(W + 2, 0.1, D + 2), { p: [0, -0.05, 0.5], uv: 0.45 });
    bk.add(white, B(W + 2, wallH, 0.2), { p: [0, wallH / 2, Z(0) - 0.1], uv: 0.5 });
    for (const s of [-1, 1]) bk.add(white, B(0.2, wallH, D + 1), { p: [s * (W / 2 + 0.1), wallH / 2, 0], uv: 0.5 });
    for (let x = -W / 2; x <= W / 2; x += 2) bk.add(mats.dressed, B(0.24, wallH, 0.16), { p: [x, wallH / 2, Z(0) + 0.02], uv: 1 });
    // the tall windows between the piers, open on the night
    for (let x = -W / 2 + 1; x < W / 2; x += 2) {
      bk.add(mats.dressed, B(0.9, 0.1, 0.24), { p: [x, 1.35, Z(0) + 0.06] });
      bk.add(mats.dressed, B(0.9, 0.12, 0.2), { p: [x, wallH - 0.6, Z(0) + 0.04] });
    }
    // beds along the side walls, each under white linen, a blanket folded at its foot
    for (const s of [-1, 1])
      for (let n = 0; n < 4; n++) {
        const z = Z(0) + 1 + n * ((D - 1.5) / 3);
        const x = s * (W / 2 + 1.1);
        bk.add(frame, B(0.9, 0.32, 1.9), { p: [x, 0.16, z] });
        bk.add(linen, B(0.86, 0.12, 1.86), { p: [x, 0.38, z] });
        bk.add(linen, B(0.5, 0.1, 0.3), { p: [x, 0.48, z - 0.7] });
        bk.add(mats.canvas, B(0.88, 0.06, 0.4), { p: [x, 0.47, z + 0.6], color: 0x9aa8b8 });
      }
  },
  // (pale stone, the Pony's timber only on the serving counters)
  counter: (c, stone, { mats, m }, { white }) => [stone ? mats.dressed : white, c === 'S' ? m.darkWood : c === 'B' ? m.board : mats.dressed],
  stations: {
    T: (ctx, { cistern }) => fountain(ctx, cistern),
    W: basin,
  },
  shelf: ({ mats, m }) => [m.paleWood, mats.dressed],
  extras(ctx) {
    const { scene, W, D, Z } = ctx;
    // the night over the Pelennor through the windows, the fires on the field going out
    skyBehind(ctx, [[0, '#0a0e1c'], [0.6, '#1a2038'], [0.85, '#3a2a2a'], [1, '#141018']], { z: -1.2, y: 2.4, h: 6 });
    lampsAt(ctx, { glow: 0xffe4b0, light: 0xffe0b0, intensity: 2.4, range: 10 });
    // the sweet steam of kingsfoil off the kettles, rising and drifting
    const steam = motes(ctx, { n: 22, colour: 0xe8fff0, size: 0.07, rise: 0.35, sway: 0.4, life: [2.5, 4.5], glow: 0.9, from: () => V(1.2 + Math.random() * 1.6, 1.2, Z(0) + 0.6 + Math.random() * 0.3) });
    // the King, by the beds at the hall's end, a candle at his hand
    const cloak = new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.95 });
    const king = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.7, 8), cloak);
    body.position.y = 0.85;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshStandardMaterial({ color: 0x8a6a52, roughness: 0.8 }));
    head.position.y = 1.78;
    const candle = new THREE.Mesh(cyl(0.025, 0.025, 0.14, 8), new THREE.MeshBasicMaterial({ color: 0xfff0c8 }));
    candle.position.set(0.28, 1.1, 0.1);
    king.add(body, head, candle);
    king.position.set(-W / 2 - 0.2, 0, Z(0) + D - 1.2);
    king.rotation.y = Math.PI / 2;
    scene.add(king);
    return {
      tick(dt, t) {
        steam.tick(dt, t);
        // (he goes from bed to bed down the hall as the night goes on)
        king.position.z = Z(0) + 1 + ((Math.sin(t * 0.05) + 1) / 2) * (D - 2.2);
        candle.scale.y = 1 + Math.sin(t * 9) * 0.06;
      },
    };
  },
};

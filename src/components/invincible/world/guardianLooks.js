// The Guardians of the Globe as the kit builds them (./people.js's bodies on
// the HQ games' humanoid), each in their own costume from the show's
// character pictures (the Invincible wiki's, looked at, never shipped):
// Immortal's navy with the gold front, the white lines and his beard; Rex
// Splode's red hood and goggles over yellow, a belt of charges; Dupli-Kate's
// lilac under a dark purple top, her black bob; Shrinking Rae's dark olive
// with the yellow-green chevron, her cap and glasses; Monster Girl as Amanda
// out of costume, a blue T-shirt and shorts; Robot's orange body in its
// rings, two yellow eyes and an aerial; Black Samson's silver with its slate
// plates; Bulletproof's yellow and orange, his goggles. Until a model of each
// lands (gen3d #1154 to #1161), these are them.
//
//   guardianLooks({ body, face, ball, mat, glow }) → { styles: { id: (add) => … }, dress: { id: () => materials } }

import * as THREE from 'three';
import { limb, rbox, taper } from '../../avengers/hq/kit/shapes';

export function guardianLooks({ body, face, ball, mat, glow }) {
  const sides = (add, material, w = 1) => {
    for (const sd of [-1, 1]) {
      add('chest', material, rbox(0.03, 0.26, 0.18 * w, 0.01), { p: [sd * 0.15 * w, 0.12, 0], r: [0, 0, sd * 0.14] });
      add('hips', material, rbox(0.03, 0.16, 0.18 * w, 0.01), { p: [sd * 0.135 * w, -0.03, 0] });
    }
  };
  const gloves = (add, material, w = 1, length = 0.14) => {
    for (const el of ['elbowL', 'elbowR']) add(el, material, limb(0.046 * w, length, 0.037 * w), { p: [0, -0.24, 0] });
  };
  const boots = (add, material, w = 1, length = 0.26) => {
    for (const kn of ['kneeL', 'kneeR']) add(kn, material, limb(0.062 * w, length, 0.046 * w), { p: [0, -0.44, 0] });
  };
  const tail = (add, material) => {
    add('head', material, ball(0.045, 12, 10), { p: [0, 0.17, -0.1] });
    add('head', material, limb(0.034, 0.22, 0.014, 10), { p: [0, 0.16, -0.12], r: [2.7, 0, 0] });
  };
  const crown = (add, material, s = [1.02, 0.8, 1.06]) => add('head', material, ball(0.095, 20, 14), { p: [0, 0.135, -0.014], s });

  const styles = {
    // broad, navy, a gold front from the chest to the belt, white lines over the
    // shoulders and down the sides, gold shins over white boots, white gloves; swept-back hair, a full beard
    immortal(add) {
      const w = 1.18;
      body(add, { top: 'suit', bottom: 'suit', shoe: 'white', hand: 'white', slim: false, sleeve: 'suit' });
      add('chest', 'gold', taper(rbox(0.17, 0.3, 0.02, 0.008), 0.75, 1), { p: [0, 0.12, 0.126] });
      add('hips', 'gold', rbox(0.22, 0.05, 0.21, 0.012), { p: [0, 0.03, 0] });
      for (const sd of [-1, 1]) {
        add('chest', 'white', new THREE.TorusGeometry(0.075, 0.01, 6, 22), { p: [sd * 0.16 * w, 0.25, 0], r: [0, Math.PI / 2, 0] });
        add('chest', 'white', rbox(0.014, 0.28, 0.02, 0.006), { p: [sd * 0.1, 0.12, 0.124], r: [0, 0, sd * 0.12] });
      }
      gloves(add, 'white', w, 0.1);
      boots(add, 'gold', w, 0.3);
      face(add, { w: 1.06 });
      add('head', 'hair', ball(0.096, 20, 14), { p: [0, 0.14, -0.03], s: [1.02, 0.82, 1.12] });
      add('head', 'hair', taper(rbox(0.1, 0.075, 0.075, 0.03), 0.75, 1), { p: [0, 0.045, 0.05] });
    },
    // a red hood to the shoulders, orange goggles, yellow down the front, red up the sides, brown gloves and boots, a belt of charges
    rex(add) {
      body(add, { top: 'suit', bottom: 'suit', shoe: 'brown', hand: 'brown', sleeve: 'suit' });
      sides(add, 'red');
      add('neck', 'red', new THREE.CylinderGeometry(0.075, 0.12, 0.12, 14), { p: [0, 0.0, 0] });
      gloves(add, 'brown');
      boots(add, 'brown', 1, 0.3);
      add('hips', 'brown', rbox(0.3, 0.05, 0.21, 0.012), { p: [0, 0.03, 0] });
      for (let i = 0; i < 4; i++) add('hips', 'white', limb(0.014, 0.1, 0.014, 6), { p: [-0.14 + i * 0.02, -0.04, 0.09] });
      face(add);
      add('head', 'red', ball(0.1, 20, 14), { p: [0, 0.11, -0.014], s: [1, 1.08, 1.04] });
      add('head', 'goggles', rbox(0.11, 0.035, 0.03, 0.01), { p: [0, 0.112, 0.085] });
    },
    // lilac, a dark purple top over the chest and shoulders with a pale ring on it; a black bob, its fringe straight
    kate(add) {
      body(add, { top: 'suit', bottom: 'suit', shoe: 'suit', hand: 'suit', sleeve: 'suit' });
      add('chest', 'top', taper(rbox(0.335, 0.17, 0.215, 0.08), 0.86, 1), { p: [0, 0.2, 0] });
      for (const sd of [-1, 1]) add('chest', 'top', ball(0.074, 14, 10), { p: [sd * 0.15, 0.25, -0.005], s: [1, 0.82, 1] });
      add('chest', 'white', new THREE.TorusGeometry(0.03, 0.006, 6, 20), { p: [0, 0.2, 0.112], s: [0.7, 1, 1] });
      face(add);
      add('head', 'hair', ball(0.1, 20, 14), { p: [0, 0.125, -0.016], s: [1.04, 0.98, 1.08] });
      add('head', 'hair', rbox(0.15, 0.035, 0.03, 0.01), { p: [0, 0.165, 0.07] });
      for (const sd of [-1, 1]) add('head', 'hair', rbox(0.035, 0.11, 0.09, 0.012), { p: [sd * 0.085, 0.08, 0.005] });
    },
    // dark olive, a yellow-green chevron on the chest with her R, yellow-green gloves and a cap; round glasses, a brown tail
    rae(add) {
      body(add, { top: 'suit', bottom: 'suit', shoe: 'suit', hand: 'lime', sleeve: 'suit' });
      for (const sd of [-1, 1]) add('chest', 'lime', rbox(0.17, 0.04, 0.02, 0.008), { p: [sd * 0.06, 0.11, 0.118], r: [0, 0, sd * 0.45] });
      add('chest', 'lime', taper(rbox(0.3, 0.09, 0.02, 0.01), 1, 0.5), { p: [0, 0.22, 0.112] });
      add('chest', 'dark', ball(0.022, 10, 8), { p: [0, 0.2, 0.124], s: [1, 1, 0.4] });
      gloves(add, 'lime', 1, 0.12);
      face(add);
      add('head', 'lime', ball(0.092, 20, 12), { p: [0, 0.135, -0.01], s: [1.04, 0.72, 1.08] });
      for (const sd of [-1, 1]) add('head', 'dark', new THREE.TorusGeometry(0.018, 0.004, 6, 14), { p: [sd * 0.03, 0.112, 0.088] });
      tail(add, 'hair');
    },
    // Amanda out of costume: a blue T-shirt, dark shorts to the knee, white trainers, a brown tail
    monster(add) {
      body(add, { top: 'top', bottom: 'shorts', shoe: 'white', sleeve: 'skin' });
      for (const sh of ['shoulderL', 'shoulderR']) add(sh, 'top', limb(0.058, 0.12, 0.052), { p: [0, -0.12, 0] });
      for (const kn of ['kneeL', 'kneeR']) {
        add(kn, 'skin', ball(0.057, 12, 10));
        add(kn, 'skin', limb(0.058, 0.4, 0.042), { p: [0, -0.4, 0] });
      }
      face(add);
      crown(add, 'hair', [1.02, 0.85, 1.06]);
      tail(add, 'hair');
    },
    // orange, broad, rings at the joints, a round head with two yellow eyes and an aerial
    robot(add) {
      body(add, { top: 'suit', bottom: 'suit', shoe: 'suit', hand: 'suit', slim: false, sleeve: 'suit' });
      add('chest', 'trim', taper(rbox(0.3, 0.18, 0.02, 0.01), 0.8, 1), { p: [0, 0.18, 0.13] });
      for (const b of ['elbowL', 'elbowR', 'kneeL', 'kneeR']) add(b, 'trim', new THREE.TorusGeometry(0.055, 0.012, 6, 18), { r: [Math.PI / 2, 0, 0] });
      for (let i = 0; i < 3; i++) add('spine', 'trim', new THREE.TorusGeometry(0.118, 0.008, 6, 22), { p: [0, i * 0.06, 0], r: [Math.PI / 2, 0, 0] });
      add('head', 'suit', ball(0.1, 20, 16), { p: [0, 0.1, 0.0], s: [0.95, 1.05, 0.95] });
      for (const sd of [-1, 1]) add('head', 'glow', ball(0.022, 10, 8), { p: [sd * 0.035, 0.115, 0.085], s: [1, 1, 0.5] });
      add('head', 'trim', rbox(0.06, 0.012, 0.02, 0.004), { p: [0, 0.06, 0.09] });
      add('head', 'trim', limb(0.008, 0.1, 0.006, 6), { p: [0, 0.19, -0.01] });
      add('head', 'trim', ball(0.018, 8, 6), { p: [0, 0.29, -0.01] });
    },
    // silver, broad, slate plates on the chest, the shoulders and the belt, slate gloves; bald
    samson(add) {
      const w = 1.18;
      body(add, { top: 'suit', bottom: 'suit', shoe: 'suit', hand: 'plate', slim: false, sleeve: 'suit' });
      add('chest', 'plate', taper(rbox(0.3 * w, 0.2, 0.23 * w, 0.06), 0.9, 1), { p: [0, 0.19, 0.005] });
      add('chest', 'plate', rbox(0.16, 0.1, 0.02, 0.01), { p: [0, 0.05, 0.13] });
      for (const sd of [-1, 1]) add('chest', 'plate', ball(0.085 * w, 14, 10), { p: [sd * 0.16 * w, 0.26, 0], s: [1.1, 0.75, 1.05] });
      add('hips', 'plate', rbox(0.34, 0.06, 0.23, 0.014), { p: [0, 0.03, 0] });
      add('hips', 'glow', rbox(0.04, 0.015, 0.01, 0.004), { p: [0, 0.03, 0.118] });
      gloves(add, 'plate', w, 0.1);
      face(add, { w: 1.08 });
      add('head', 'skin', ball(0.09, 20, 14), { p: [0, 0.15, -0.006], s: [0.94, 0.95, 1.02] });
    },
    // yellow, orange down the sides and on the shins, a gold buckle, yellow goggles; his hair in braids
    bulletproof(add) {
      body(add, { top: 'suit', bottom: 'suit', shoe: 'orange', hand: 'suit', sleeve: 'suit' });
      sides(add, 'orange');
      boots(add, 'orange', 1, 0.3);
      add('hips', 'gold', ball(0.035, 12, 10), { p: [0, 0.03, 0.105], s: [1.2, 1, 0.4] });
      add('hips', 'gold', rbox(0.3, 0.04, 0.21, 0.01), { p: [0, 0.03, 0] });
      face(add);
      add('head', 'goggles', rbox(0.11, 0.035, 0.03, 0.01), { p: [0, 0.112, 0.085] });
      crown(add, 'hair', [1.0, 0.72, 1.04]);
      for (let i = 0; i < 5; i++) add('head', 'hair', limb(0.012, 0.12, 0.008, 6), { p: [-0.05 + i * 0.025, 0.17, -0.07], r: [2.3, 0, 0] });
    },
  };

  const dress = {
    immortal: () => ({ suit: mat(0x283454, { roughness: 0.5 }), gold: mat(0xe9c84a, { roughness: 0.45 }), white: mat(0xf2f1ea), skin: mat(0xe0ae8c), hair: mat(0x16120f), dark: mat(0x1a1416) }),
    rex: () => ({ suit: mat(0xeed46c, { roughness: 0.5 }), red: mat(0xc7321f, { roughness: 0.5 }), brown: mat(0x6b4630), white: mat(0xe8e4da), goggles: glow(0xf2a23a, 1.3), skin: mat(0xe6b896), hair: mat(0x8a3a1e), dark: mat(0x1a1416) }),
    kate: () => ({ suit: mat(0xd7cfe8, { roughness: 0.5 }), top: mat(0x4b2f61, { roughness: 0.5 }), white: mat(0xf2eef7), skin: mat(0xeccdb0), hair: mat(0x15121a), dark: mat(0x1a1416) }),
    rae: () => ({ suit: mat(0x34362a, { roughness: 0.55 }), lime: mat(0xc9cb4c, { roughness: 0.45 }), skin: mat(0xeac2a2), hair: mat(0x6a3f22), dark: mat(0x15130f) }),
    monster: () => ({ top: mat(0x2f6f9e), shorts: mat(0x45494e), white: mat(0xe9e9e4), skin: mat(0xf0c8ac), hair: mat(0x6e4628), dark: mat(0x1a1416) }),
    robot: () => ({ suit: mat(0xe07a3e, { roughness: 0.45, metalness: 0.2 }), trim: mat(0xb2552a, { roughness: 0.45, metalness: 0.2 }), glow: glow(0xffd34a, 2.2), dark: mat(0x1a1416) }),
    samson: () => ({ suit: mat(0xb9bcc0, { roughness: 0.5 }), plate: mat(0x666784, { roughness: 0.45, metalness: 0.2 }), glow: glow(0xff6a4a, 1.6), skin: mat(0x5c3a28), dark: mat(0x140e0b) }),
    bulletproof: () => ({ suit: mat(0xf2c73c, { roughness: 0.5 }), orange: mat(0xe5842a, { roughness: 0.5 }), gold: mat(0xd8a93a, { roughness: 0.35, metalness: 0.5 }), goggles: glow(0xffe066, 1.4), skin: mat(0x6b4532), hair: mat(0x16110d), dark: mat(0x140e0b) }),
  };
  return { styles, dress };
}

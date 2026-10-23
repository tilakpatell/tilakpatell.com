// Season two's foes as the kit builds them, from the show's pictures (the
// Invincible wiki's, looked at, never shipped): Battle Beast's white lion's
// head with its mane and two beaded braids, white fur arms, the black
// plated armour with red straps, the yellow plates of his belt over red,
// red gloves and boot cuffs over yellow boots; and Angstrom Levy's dark
// maroon under grey-green armour, the great left shoulder with its red
// light, a long dark red cape, the copper cap with its earpieces and his
// beard. Until a model of each lands (gen3d #1166 for Angstrom, Battle
// Beast's issue), these are them.
//
//   villainLooks({ body, face, ball, mat, glow }) → { styles: { id: (add) => … }, dress: { id: () => materials } }

import * as THREE from 'three';
import { limb, rbox, taper } from '../../avengers/hq/kit/shapes';

export function villainLooks({ body, face, ball, mat, glow }) {
  const styles = {
    beast(add) {
      const w = 1.18;
      body(add, { top: 'suit', bottom: 'suit', shoe: 'yellow', hand: 'red', slim: false, sleeve: 'fur' });
      // the plated chest, its red straps over the shoulders
      add('chest', 'suit', taper(rbox(0.33 * w, 0.31, 0.24 * w, 0.06), 0.82, 1), { p: [0, 0.13, 0.01] });
      for (const sd of [-1, 1]) {
        add('chest', 'plate', rbox(0.1, 0.09, 0.02, 0.02), { p: [sd * 0.06, 0.17, 0.142], r: [0, 0, sd * 0.2] });
        add('chest', 'red', rbox(0.06, 0.34, 0.27 * w, 0.015), { p: [sd * 0.115, 0.17, 0.0], r: [0, 0, sd * 0.1] });
      }
      add('chest', 'plate', rbox(0.16, 0.08, 0.02, 0.02), { p: [0, 0.05, 0.14] });
      // the belt: red under the yellow plates, hanging to mid-thigh in front
      add('hips', 'red', rbox(0.36, 0.08, 0.25, 0.02), { p: [0, 0.03, 0] });
      for (const x of [-0.1, 0, 0.1]) add('hips', 'yellow', taper(rbox(0.075, 0.16, 0.02, 0.008), 1, 0.7), { p: [x, -0.04, 0.13] });
      add('hips', 'red', taper(rbox(0.3, 0.12, 0.02, 0.01), 1, 0.8), { p: [0, -0.06, -0.12] });
      // big red gloves, red cuffs over the yellow boots
      for (const ha of ['handL', 'handR']) add(ha, 'red', rbox(0.075, 0.11, 0.05, 0.02), { p: [0, -0.05, 0] });
      for (const el of ['elbowL', 'elbowR']) add(el, 'red', limb(0.055, 0.09, 0.05), { p: [0, -0.24, 0] });
      for (const kn of ['kneeL', 'kneeR']) {
        add(kn, 'yellow', limb(0.07, 0.24, 0.056), { p: [0, -0.44, 0] });
        add(kn, 'red', limb(0.075, 0.08, 0.072), { p: [0, -0.24, 0] });
      }
      // the lion's head: a white skull and muzzle, a dark nose, his eyes; the mane round and down the back; two braids
      add('head', 'fur', ball(0.1, 20, 16), { p: [0, 0.11, 0.01], s: [0.95, 1.05, 1] });
      add('head', 'fur', ball(0.06, 14, 10), { p: [0, 0.06, 0.08], s: [1.1, 0.85, 1] });
      add('head', 'dark', ball(0.018, 8, 6), { p: [0, 0.085, 0.135], s: [1.3, 0.8, 1] });
      for (const sd of [-1, 1]) {
        add('head', 'eyes', ball(0.012, 8, 6), { p: [sd * 0.035, 0.125, 0.092] });
        add('head', 'fur', ball(0.025, 8, 6), { p: [sd * 0.07, 0.2, 0.0], s: [0.7, 1, 0.6] }); // ears
      }
      add('head', 'mane', ball(0.15, 20, 16), { p: [0, 0.12, -0.05], s: [1.05, 1.05, 0.9] });
      add('head', 'mane', taper(rbox(0.26, 0.32, 0.12, 0.06), 1, 0.6), { p: [0, -0.08, -0.12] });
      for (const sd of [-1, 1]) {
        add('head', 'mane', limb(0.02, 0.2, 0.016, 8), { p: [sd * 0.07, -0.12, 0.07] });
        add('head', 'gold', ball(0.016, 8, 6), { p: [sd * 0.07, -0.1, 0.07] });
      }
    },
    angstrom(add) {
      body(add, { top: 'suit', bottom: 'suit', shoe: 'dark', hand: 'skin', sleeve: 'suit' });
      // the grey-green armour over the chest, the left shoulder's great plate with its red light
      add('chest', 'armour', taper(rbox(0.32, 0.22, 0.22, 0.05), 0.9, 1), { p: [0, 0.18, 0.005] });
      add('chest', 'armour', ball(0.1, 14, 10), { p: [0.18, 0.27, 0], s: [1.3, 0.8, 1.2] });
      add('chest', 'armour', ball(0.07, 14, 10), { p: [-0.16, 0.26, 0], s: [1, 0.7, 1] });
      add('chest', 'glow', ball(0.018, 8, 6), { p: [0.2, 0.31, 0.08] });
      // the cape from the shoulders to the ankles behind
      add('chest', 'cape', taper(rbox(0.5, 1.15, 0.03, 0.01), 0.55, 1.15), { p: [0, -0.3, -0.13], r: [0.08, 0, 0] });
      face(add);
      // the copper cap, its earpieces and their lights; a beard
      add('head', 'cap', ball(0.096, 20, 14), { p: [0, 0.13, -0.012], s: [1.02, 0.85, 1.06] });
      for (const sd of [-1, 1]) {
        add('head', 'armour', new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12), { p: [sd * 0.09, 0.11, 0], r: [0, 0, Math.PI / 2] });
        add('head', 'glow', ball(0.008, 6, 6), { p: [sd * 0.1, 0.11, 0.02] });
      }
      add('head', 'hair', taper(rbox(0.06, 0.06, 0.05, 0.02), 0.6, 1), { p: [0, 0.035, 0.07] });
    },
  };
  const dress = {
    beast: () => ({ suit: mat(0x26272c, { roughness: 0.55 }), plate: mat(0x34363d, { roughness: 0.45 }), red: mat(0xc8333a, { roughness: 0.5 }), yellow: mat(0xf0d25a, { roughness: 0.5 }), fur: mat(0xeeeef2, { roughness: 0.9 }), mane: mat(0xf6f6f8, { roughness: 0.95 }), gold: mat(0xd8a93a, { roughness: 0.35, metalness: 0.5 }), eyes: glow(0xff8a2a, 1.4), dark: mat(0x2a2224), skin: mat(0xeeeef2) }),
    angstrom: () => ({ suit: mat(0x3a2522, { roughness: 0.6 }), armour: mat(0x8c968a, { roughness: 0.45, metalness: 0.25 }), cape: mat(0x6a1a1e, { roughness: 0.7, side: THREE.DoubleSide }), cap: mat(0x7a4a32, { roughness: 0.5, metalness: 0.3 }), glow: glow(0xff3a3a, 2), skin: mat(0x6b4532), hair: mat(0x1a120e), dark: mat(0x140e0b) }),
  };
  return { styles, dress };
}

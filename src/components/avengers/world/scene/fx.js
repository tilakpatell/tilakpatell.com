// What happens on screen when something happens: a door gone through, the
// portal, a landing, a web, a trick, a backpack found.


import * as THREE from 'three';
import { ARMOUR, PLACES, PORTAL } from './rules';

export function createEvents({ A, calm, hero, packs, people, squash, swing, vfx, v3, v3b }) {
  const fx = (type, d = {}) => {
    if (type === 'enter') {
      const p = PLACES.find((x) => x.id === d.id);
      if (p) vfx.ring(v3.set(p.x, 0.2, p.z), { color: new THREE.Color(p.accent).getHex(), from: 0.5, to: 5, life: 0.5 });
    } else if (type === 'portal') {
      A.flash = 1.2;
      vfx.ring(v3.set(PORTAL.x, 0.3, PORTAL.z), { color: 0x9fdcff, from: 1, to: 14, life: 0.8 });
    } else if (type === 'land') {
      // a hard one beside them gets a look and a reaction (./castLife.js)
      for (const p of Object.values(people)) p.life.event('land', { x: d.x, z: d.z, impact: d.impact ?? 0 });
      squash.kick((d.impact ?? 0) * 0.05);
      const hard = Math.max(0, Math.min(1, ((d.impact ?? 0) - 9) / 14));
      if (!calm) vfx.smoke(v3.set(d.x, (d.y ?? 0) + 0.1, d.z), { size: 1.2 + hard * 2.2, count: 5 + Math.round(hard * 10), life: 0.7 + hard * 0.6, rise: 0.4 + hard * 0.5, opacity: 0.25 + hard * 0.15, color: 0xb8b4a4, to: 0xd8d4c4, spread: 0.8 + hard * 2.4 });
      if (hard > 0.3) {
        vfx.ring(v3.set(d.x, (d.y ?? 0) + 0.15, d.z), { color: 0xfff1d8, from: 0.4, to: 3 + hard * 4, life: 0.45, opacity: 0.5 * hard });
        A.punch = Math.max(A.punch, 3 * hard);
      }
    } else if (type === 'web' || type === 'corner') {
      // every web out: a bump in the field of view, Insomniac's heartbeat of a swing
      A.punch = Math.max(A.punch, 3.5);
      swing.webbed(d.at);
      if (!calm) vfx.smoke(v3.set(d.at[0], d.at[1], d.at[2]), { size: 0.7, count: 3, life: 0.5, rise: 0.1, opacity: 0.35, color: 0xffffff, to: 0xe8ecf2, spread: 0.3 });
    } else if (type === 'perfect') {
      A.punch = Math.max(A.punch, 5);
      vfx.ring(v3.copy(hero.position), { color: 0xff8a80, from: 0.4, to: 2.4, life: 0.35, opacity: 0.45, normal: v3b.set(d.vx ?? 0, d.vy ?? 0, d.vz ?? 1).normalize() });
    } else if (type === 'suitup') {
      A.punch = Math.max(A.punch, 4);
      vfx.ring(v3.set(ARMOUR.x, 0.4, ARMOUR.z), { color: 0x8fe9ff, from: 0.5, to: 5, life: 0.5, opacity: 0.7 });
      if (!calm) vfx.smoke(v3.set(ARMOUR.x, 0.3, ARMOUR.z), { size: 1.4, count: 6, life: 0.8, rise: 0.6, opacity: 0.3, color: 0xd8e4f0, to: 0xffffff, spread: 1.2 });
    } else if (type === 'suitoff') {
      A.punch = Math.max(A.punch, 3);
      if (!calm) vfx.smoke(v3.set(d.x ?? hero.position.x, (d.y ?? hero.position.y) + 1, d.z ?? hero.position.z), { size: 1, count: 5, life: 0.6, rise: 0.2, opacity: 0.3, color: 0xd8e4f0, to: 0xffffff, spread: 0.8 });
    } else if (type === 'trick') {
      A.punch = Math.max(A.punch, 2);
    } else if (type === 'bank') {
      // the style banked: a gold ring out from where he landed
      vfx.ring(v3.set(hero.position.x, (d.y ?? hero.position.y) + 0.2, hero.position.z), { color: 0xffd98a, from: 0.5, to: 3.5 + Math.min(4, (d.style ?? 0) / 800), life: 0.55, opacity: 0.6 });
    } else if (type === 'bail') {
      if (!calm) vfx.smoke(v3.copy(hero.position), { size: 1, count: 5, life: 0.6, rise: 0.3, opacity: 0.3, color: 0xb8b4a4, to: 0xd8d4c4, spread: 1.2 });
    } else if (type === 'point') {
      A.punch = Math.max(A.punch, 4);
      swing.webbed(d.at);
    } else if (type === 'launch') {
      A.punch = Math.max(A.punch, 6);
    } else if (type === 'glide') {
      A.punch = Math.max(A.punch, 2.5);
    } else if (type === 'zip') {
      A.punch = Math.max(A.punch, 5);
      swing.zipped(d.at);
    } else if (type === 'dive') {
      A.punch = Math.max(A.punch, 4);
    } else if (type === 'pack') {
      // a backpack found: a puff of web and a ring where it was
      const at = packs.at(d.id);
      if (at) {
        vfx.ring(at, { color: 0xbfe8ff, from: 0.3, to: 2.6, life: 0.45, opacity: 0.6 });
        if (!calm) vfx.smoke(at, { size: 0.8, count: 4, life: 0.6, rise: 0.3, opacity: 0.4, color: 0xffffff, to: 0xdde6f0, spread: 0.5 });
      }
      A.punch = Math.max(A.punch, 2);
    } else if (type === 'stick' || type === 'kick') {
      if (!calm) vfx.smoke(v3.copy(hero.position), { size: 0.6, count: 3, life: 0.5, rise: 0.1, opacity: 0.18, color: 0xd8d4c4, to: 0xeeeeee, spread: 0.4 });
    }
  };
  return fx;
}

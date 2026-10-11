// Echo Base, inside (sites/echoLayout.js has the rooms, and why): the
// corridors cut through the glacier's ice, steel arches holding them up
// every 4 m, ducting along the roof and tread-plate grates underfoot; the
// command centre with its holo-table and the tactical screen under the
// Alliance's starbird; the medical centre's bacta tank; the cavern
// widened from the wampas' den, under its dome of ice. Built high over
// Hoth as a zone (sites/index.js), lit by its own lamps.

import * as THREE from 'three';
import { box, cyl, dome, part, ring, rod } from '../kitCore';
import { insignia, scorch } from '../decals';
import { ECHO_BASE, archesOf, floorsOf, wallsOf } from '../sites/echoLayout';
import { iceMat, iceShade, meshOf, roughen } from './ice';
import { inward } from './inside';

const { PI } = Math;
const hot = (c, k = 2) => new THREE.Color(c).multiplyScalar(k);
const ICE = '#cfdceb';
const STEEL = '#6c747c';
const GRATE = '#7c848c';

export const PROPS = {
  echoinside(k) {
    const { rooms } = ECHO_BASE;
    const byId = Object.fromEntries(rooms.map((r) => [r.id, r]));
    const walls = wallsOf(rooms);

    // ── The ice: walls, roofs, the cavern's dome ──
    const ice = [];
    let seed = 1;
    for (const { box: [x, z, hw, hd, yaw], room } of walls) {
      const h = byId[room].round ? 4.4 : byId[room].h + 0.6;
      const g = new THREE.BoxGeometry(hw * 2, h, hd * 2, Math.max(1, Math.round(hw * 1.6)), Math.max(1, Math.round(h * 1.2)), 1);
      g.rotateY(yaw).translate(x, h / 2, z);
      ice.push(part(roughen(g, { amp: 0.32, scale: 2.6, seed: seed++, base: false, fine: 0.5 }), { color: ICE }));
    }
    for (const r of rooms) {
      if (r.round) {
        // (the dome over the cavern starts above the corridor's roof, so its
        // mouth stays open)
        const cap = inward(dome(r.hw + 0.7, r.h - 3.4, 44));
        cap.translate(r.at[0], 3.6, r.at[1]);
        ice.push(part(roughen(cap, { amp: 0.6, scale: 3.5, seed: 40, base: false }), { color: ICE }));
        continue;
      }
      const g = new THREE.BoxGeometry(r.hw * 2 + 1.6, 0.8, r.hd * 2 + 1.6, Math.round(r.hw * 1.2) + 1, 1, Math.round(r.hd * 1.2) + 1);
      g.translate(r.at[0], r.h + 0.4, r.at[1]);
      ice.push(part(roughen(g, { amp: 0.25, scale: 2.4, seed: seed++, base: false }), { color: ICE }));
    }
    const object = new THREE.Group();
    object.add(meshOf(k, ice, iceMat(k), { shadows: false, shade: iceShade(() => true) }));

    const parts = [];
    // ── Underfoot: grates down the corridors and rooms, packed snow in the cavern ──
    for (const r of rooms) {
      if (r.round) parts.push(part(new THREE.CylinderGeometry(r.hw + 0.4, r.hw + 0.4, 0.2, 44).translate(0, -0.1, 0), { at: [r.at[0], 0, r.at[1]], color: '#c8d2dc', to: 'concrete' }));
      else parts.push(part(new THREE.BoxGeometry(r.hw * 2, 0.2, r.hd * 2).translate(0, -0.1, 0), { at: [r.at[0], 0, r.at[1]], color: GRATE, to: 'deck' }));
    }

    // ── The corridors' steel: an arch every 4 m, a lamp under each, the ducting ──
    for (const [x, z, along] of archesOf(rooms)) {
      const r = rooms.find((q) => q.kind === 'corridor' && Math.abs(q.at[0] - x) <= q.hw && Math.abs(q.at[1] - z) <= q.hd);
      const w = along === 'z' ? r.hw : r.hd;
      const rot = [0, along === 'z' ? 0 : PI / 2, 0];
      const turn = (lx) => (along === 'z' ? [x + lx, z] : [x, z + lx]);
      for (const s of [-1, 1]) {
        const [px, pz] = turn(s * (w - 0.18));
        parts.push(part(box(0.32, r.h - 0.1, 0.32), { at: [px, 0, pz], rot, color: STEEL, to: 'metal' }));
        // (the brace from post to beam, across the corner)
        const [bx, bz] = turn(s * (w - 0.75));
        parts.push(part(box(0.16, 1.1, 0.16), { at: [bx, r.h - 1.2, bz], rot: [0, rot[1], s * 0.75], color: STEEL, to: 'metal' }));
      }
      parts.push(part(box(w * 2, 0.32, 0.32), { at: [x, r.h - 0.42, z], rot, color: STEEL, to: 'metal' }));
      parts.push(part(box(1.1, 0.07, 0.18), { at: [x, r.h - 0.5, z], rot, color: hot('#e6f0ff', 2.2), to: 'glow' }));
    }
    for (const r of rooms) {
      if (r.kind !== 'corridor') continue;
      const alongZ = r.hd > r.hw;
      const L = Math.max(r.hw, r.hd);
      const W = Math.min(r.hw, r.hd);
      for (const [off, y, rad] of [[W - 0.32, r.h - 0.3, 0.16], [-(W - 0.28), r.h - 0.25, 0.1]]) {
        const a = alongZ ? [r.at[0] + off, y, r.at[1] - L] : [r.at[0] - L, y, r.at[1] + off];
        const b = alongZ ? [r.at[0] + off, y, r.at[1] + L] : [r.at[0] + L, y, r.at[1] + off];
        parts.push(rod(a, b, rad, rad, { color: '#8a8f88', to: 'metal' }, 10));
      }
    }

    // the way out: the hangar's light through the door
    parts.push(part(box(3.0, 3.1, 0.08), { at: [0, 0, 23.95], color: hot('#eaf2ff', 1.6), to: 'glow' }));

    // ── The command centre ──
    const C = byId.command;
    const [cx, cz] = C.at;
    const solids = [];
    // the holo-table, Hoth in the air over it
    parts.push(
      part(cyl(1.5, 1.7, 0.95, 28), { at: [cx + 2, 0, cz], color: '#3c4248', to: 'metal' }),
      part(ring(1.3, 0.05, 36), { at: [cx + 2, 0.97, cz], color: hot('#7fd0ff', 1.8), to: 'glow' }),
      part(new THREE.CircleGeometry(1.25, 36).rotateX(-PI / 2), { at: [cx + 2, 0.96, cz], color: hot('#2a6a9a', 0.8), to: 'glow' }),
      part(new THREE.IcosahedronGeometry(0.42, 2), { at: [cx + 2, 1.75, cz], color: hot('#8fd8ff', 0.9), to: 'glow' }),
    );
    solids.push({ circle: [cx + 2, cz, 1.8] });
    // the tactical screen on the far wall, the starbird over it
    const wx = cx - C.hw + 0.12;
    parts.push(
      part(box(0.2, 3.2, 8.4), { at: [wx, 0.9, cz], color: '#20262c', to: 'dark' }),
      part(box(0.05, 2.7, 7.8), { at: [wx + 0.12, 1.15, cz], color: hot('#2c5e9c', 1.1), to: 'glow' }),
      part(insignia('rebel', 1.7), { at: [wx + 0.14, 4.6, cz], rot: [0, PI / 2, 0], color: '#c8452e', to: 'paint' }),
    );
    // (the screen's grid: the shield, the walkers coming)
    for (let i = 0; i < 5; i++) parts.push(part(box(0.02, 0.03, 7.6), { at: [wx + 0.16, 1.45 + i * 0.5, cz], color: hot('#9fdcff', 1.6), to: 'glow' }));
    for (let i = 0; i < 4; i++) parts.push(part(box(0.02, 0.18, 0.5), { at: [wx + 0.16, 2.1, cz + 1.8 + i * 0.6], color: hot('#ff5a3a', 2.4), to: 'glow' }));
    // consoles down both long walls, a controller's screen on each
    for (const side of [-1, 1]) {
      const z = cz + side * (C.hd - 0.55);
      for (let x = cx - C.hw + 2.2; x < cx + C.hw - 1.5; x += 1.5) {
        parts.push(part(box(1.3, 0.95, 0.8), { at: [x, 0, z], color: '#8a929a', to: 'paint' }));
        parts.push(part(box(1.0, 0.5, 0.05), { at: [x, 1.05, z + side * 0.2], rot: [side * 0.45, 0, 0], color: hot(x % 3 > 1.5 ? '#7fe0a0' : '#7fc0ff', 1.2), to: 'glow' }));
      }
      solids.push({ box: [cx, z, C.hw - 1, 0.45, 0] });
    }

    // ── The medical centre ──
    const M = byId.medical;
    const tank = [M.at[0] + 2.4, M.at[1] - 2.2];
    parts.push(
      part(cyl(1.05, 1.05, 0.5, 28), { at: [tank[0], 0, tank[1]], color: '#5a6066', to: 'metal' }),
      part(cyl(0.95, 0.95, 2.4, 28), { at: [tank[0], 0.5, tank[1]], color: '#bfe8e0', to: 'glass' }),
      part(cyl(0.88, 0.88, 2.2, 28), { at: [tank[0], 0.55, tank[1]], color: hot('#3aa88a', 0.7), to: 'glow' }),
      part(cyl(1.05, 0.9, 0.4, 28), { at: [tank[0], 2.9, tank[1]], color: '#5a6066', to: 'metal' }),
    );
    for (let i = 0; i < 6; i++) parts.push(part(new THREE.SphereGeometry(0.05, 6, 4), { at: [tank[0] + Math.sin(i * 2.4) * 0.4, 0.9 + i * 0.32, tank[1] + Math.cos(i * 2.4) * 0.4], color: hot('#cffff0', 1.4), to: 'glow' }));
    solids.push({ circle: [tank[0], tank[1], 1.15] });
    // two beds along the wall, a lamp over each
    for (const dx of [-2.6, 0]) {
      const bx = M.at[0] + dx;
      const bz = M.at[1] + M.hd - 1.3;
      parts.push(part(box(1.0, 0.7, 2.1), { at: [bx, 0, bz], color: '#d8dcdf', to: 'cloth' }), part(box(0.08, 0.05, 0.8), { at: [bx, 3.0, bz], color: hot('#f2f6ff', 2), to: 'glow' }));
      solids.push({ box: [bx, bz, 0.55, 1.1, 0] });
    }

    // ── The cavern: the stores, a speeder in for repair, the old scorch marks ──
    const V = byId.cavern;
    for (const [dx, dz, s] of [[-5.5, -3, 1.2], [-4.2, -4.6, 1], [-6.4, -1.4, 0.9], [5.2, 3.5, 1.1], [6.3, 2.0, 0.9]]) {
      parts.push(part(box(s, s * 0.8, s), { at: [V.at[0] + dx, 0, V.at[1] + dz], rot: [0, dx * 0.3, 0], color: dx < 0 ? '#7a8088' : '#6a6458', to: 'paint' }));
      solids.push({ circle: [V.at[0] + dx, V.at[1] + dz, s * 0.7] });
    }
    for (const [dx, dz] of [[4.6, -4.8], [5.6, -3.9], [3.8, -5.6]]) {
      parts.push(rod([V.at[0] + dx, 0, V.at[1] + dz], [V.at[0] + dx, 1.1, V.at[1] + dz], 0.42, 0.42, { color: '#8e7a5a', to: 'paint' }, 14));
      solids.push({ circle: [V.at[0] + dx, V.at[1] + dz, 0.5] });
    }
    for (const [dx, dz, r, s] of [[1.5, 2, 1.6, 3], [-2.5, -5, 1.1, 5]]) {
      parts.push(part(scorch(r * 1.5, s).rotateX(-PI / 2), { at: [V.at[0] + dx, 0.02, V.at[1] + dz], color: '#8c949c', to: 'paint' }));
      parts.push(part(scorch(r, s + 1).rotateX(-PI / 2), { at: [V.at[0] + dx, 0.03, V.at[1] + dz], color: '#3a3e42', to: 'paint' }));
    }
    // (the cavern's lamps, hung on cables from the ice)
    for (const [dx, dz] of [[-4, 3], [4, -2], [0, -6]]) {
      parts.push(rod([V.at[0] + dx, V.h - 0.6, V.at[1] + dz], [V.at[0] + dx, 5.2, V.at[1] + dz], 0.02, 0.02, { color: '#2a2a2a', to: 'metal' }, 4));
      parts.push(part(cyl(0.35, 0.15, 0.3, 12), { at: [V.at[0] + dx, 4.9, V.at[1] + dz], color: '#3c4248', to: 'metal' }), part(new THREE.CircleGeometry(0.3, 12).rotateX(PI / 2), { at: [V.at[0] + dx, 4.89, V.at[1] + dz], color: hot('#ffe2b0', 2.6), to: 'glow' }));
    }

    object.add(k.build(parts, { name: 'echoinside', shadows: false }));
    return { object, solids: [...walls.map(({ box: b }) => ({ box: b })), ...solids], floors: floorsOf(rooms) };
  },
};

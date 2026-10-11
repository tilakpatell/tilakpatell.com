// Tatooine's props, built in code: what a world places when
// there's no model of it (catalog/desert.js), and what there's no model of
// at all (the homestead's pit, the Sarlacc, Jabba's palace on the horizon,
// Mos Eisley's docking bay).

import * as THREE from 'three';
import { box, cyl, dome, part, ring, rockGeometry, rod } from '../kitCore';
import { loft, trap8 } from '../../../universe/trafficKit';

const { PI, cos, sin } = Math;
const ADOBE = '#e2d4bf';
const ADOBE_DARK = '#b89c76';

export const PROPS = {

  // Luke's X-34 landspeeder: an open hull, a windscreen, three engines at
  // the back (one up top), 3.4 m long, nose to +z, floating (the scene holds
  // it up)
  landspeeder(k) {
    const cream = '#d8ccb0';
    const rust = '#a4502e';
    const hull = loft([
      { z: -1.7, pts: trap8(1.9, 1.7, 0.55, 0.12, 0.3) },
      { z: 0.6, pts: trap8(1.9, 1.75, 0.6, 0.14, 0.32) },
      { z: 1.7, pts: trap8(1.1, 0.9, 0.3, 0.08, 0.22) },
    ]);
    const parts = [part(hull, { color: rust, to: 'paint' })];
    // the cockpit tub and seats
    parts.push(part(box(1.5, 0.12, 1.3), { at: [0, 0.6, -0.1], color: '#3a2a20', to: 'dark' }));
    for (const x of [-0.42, 0.42]) parts.push(part(box(0.55, 0.5, 0.15), { at: [x, 0.6, -0.65], color: '#6a5040', to: 'cloth' }));
    // the windscreen
    parts.push(part(new THREE.BoxGeometry(1.5, 0.35, 0.03), { at: [0, 0.82, 0.62], rot: [-0.5, 0, 0], color: '#a8c0c8', to: 'glass' }));
    // engines: two on the sides, one over the back
    for (const [x, y] of [
      [-1.05, 0.35],
      [1.05, 0.35],
      [0, 0.95],
    ]) {
      parts.push(part(new THREE.CylinderGeometry(0.2, 0.22, 1.5, 12), { at: [x, y, -1.2], rot: [Math.PI / 2, 0, 0], color: cream, to: 'metal' }));
      parts.push(part(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 12), { at: [x, y, -1.97], rot: [Math.PI / 2, 0, 0], color: new THREE.Color('#ff9a50').multiplyScalar(2), to: 'glow' }));
    }
    return { object: k.build(parts, { name: 'landspeeder' }) };
  },

  // a moisture vaporator: a pole with collars and condenser fins, 5 m tall
  vaporator(k, { color = '#b8b2a6' } = {}) {
    const dark = '#6e6a62';
    const parts = [
      part(cyl(0.62, 0.5, 0.45, 14), { color: dark, to: 'metal' }),
      part(cyl(0.24, 0.22, 3.6, 12), { at: [0, 0.4, 0], color, to: 'metal' }),
      part(cyl(0.42, 0.42, 0.22, 16), { at: [0, 1.1, 0], color: dark, to: 'metal' }),
      part(cyl(0.38, 0.32, 0.5, 16), { at: [0, 2.0, 0], color, to: 'metal' }),
      part(cyl(0.3, 0.3, 0.14, 14), { at: [0, 2.85, 0], color: dark, to: 'metal' }),
      part(cyl(0.16, 0.08, 0.9, 10), { at: [0, 4.0, 0], color, to: 'metal' }),
    ];
    // the condenser fins round its top
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2;
      parts.push(part(new THREE.BoxGeometry(0.05, 1.3, 0.55), { at: [cos(a) * 0.3, 3.65, sin(a) * 0.3], rot: [0, -a, 0], color, to: 'metal' }));
    }
    // its feet
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2 + 0.5;
      parts.push(rod([cos(a) * 0.3, 0.3, sin(a) * 0.3], [cos(a) * 0.95, 0, sin(a) * 0.95], 0.06, 0.06, { color: dark, to: 'metal' }));
    }
    return { object: k.build(parts, { name: 'vaporator' }), solids: [{ circle: [0, 0, 0.6] }] };
  },

  // a domed adobe house, as in Mos Eisley and Mos Espa: walls, a dome, a door
  adobe(k, { r = 4 } = {}) {
    const rand = k.rand;
    const h = r * (0.55 + rand() * 0.2);
    const parts = [part(cyl(r, r * 0.97, h, 28), { color: ADOBE, to: 'adobe' }), part(dome(r * 0.98, r * 0.75, 28), { at: [0, h, 0], color: ADOBE, to: 'adobe' })];
    // a lip round the dome, a door with its frame, a vent or two
    parts.push(part(ring(r * 0.99, 0.12, 32), { at: [0, h, 0], color: ADOBE_DARK, to: 'adobe' }));
    parts.push(part(box(1.3, 2.1, 0.6), { at: [0, 0, r - 0.15], color: '#2a2018', to: 'dark' }));
    parts.push(part(box(1.8, 2.5, 0.4), { at: [0, 0, r - 0.3], color: ADOBE_DARK, to: 'adobe' }));
    if (rand() < 0.7) parts.push(part(cyl(0.5, 0.5, 0.9, 12), { at: [r * 0.4, h + r * 0.55, -r * 0.2], color: ADOBE_DARK, to: 'adobe' }));
    // a smaller dome to one side, now and then
    const solids = [{ circle: [0, 0, r] }];
    if (rand() < 0.6) {
      const a = PI / 2 + (rand() - 0.5);
      const r2 = r * 0.55;
      const at = [cos(a) * r * 1.15, 0, sin(a) * r * 1.15];
      parts.push(part(cyl(r2, r2, h * 0.8, 20), { at, color: ADOBE, to: 'adobe' }), part(dome(r2, r2 * 0.8, 20), { at: [at[0], h * 0.8, at[2]], color: ADOBE, to: 'adobe' }));
      solids.push({ circle: [at[0], at[2], r2] });
    }
    return { object: k.build(parts, { name: 'adobe' }), solids };
  },

  // the Lars homestead: the domed hut over the sunken courtyard (the pit's
  // the land's own, a flat below the ground; this is the hut and the ring
  // round the pit's edge)
  homestead(k) {
    const parts = [
      part(cyl(3.1, 3.1, 1.2, 28), { color: ADOBE, to: 'adobe' }),
      part(dome(3.1, 2.4, 28), { at: [0, 1.2, 0], color: ADOBE, to: 'adobe' }),
      part(box(1.4, 2, 2.2), { at: [0, 0, 2.6], color: ADOBE, to: 'adobe' }),
      part(box(1.0, 1.7, 0.3), { at: [0, 0, 3.6], color: '#2a2018', to: 'dark' }),
      part(cyl(0.45, 0.45, 0.6, 12), { at: [1.2, 3.1, -0.6], color: ADOBE_DARK, to: 'adobe' }),
    ];
    return { object: k.build(parts, { name: 'homestead' }), solids: [{ circle: [0, 0, 3.1] }, { box: [0, 2.6, 0.75, 1.1, 0] }] };
  },
  // the low wall round the homestead's courtyard pit (beside the hut: put
  // where the hut is, turned with it)
  // (a low rounded lip, its faces up and into the pit: centred on the dug
  // pit's middle, 15 m behind the hut, sized to its r 6.5)
  homesteadring(k) {
    const lip = new THREE.LatheGeometry(
      [
        [9.1, 0],
        [7.5, 0.45],
        [6.7, 0.3],
        [6.2, -0.8],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      48,
    );
    return { object: k.build([part(lip, { at: [0, -0.1, -15], color: '#d8c9ae', to: 'adobe' })], { name: 'homesteadring' }) };
  },

  // a Jawa sandcrawler, 36 m long, rusted, on its treads
  sandcrawler(k) {
    const rust = '#8a6a4a';
    const dark = '#3c3026';
    const hull = loft([
      { z: -18, pts: trap8(14, 10, 9, 1.2, 7.5) },
      { z: -12, pts: trap8(16, 12, 11, 1.4, 8.5) },
      { z: 10, pts: trap8(16, 12, 11, 1.4, 8.5) },
      { z: 18, pts: trap8(15, 9, 6, 1, 6.5) },
    ]);
    const top = loft([
      { z: -14, pts: trap8(11, 7, 8, 1, 17) },
      { z: 2, pts: trap8(12, 6, 9, 1, 17.5) },
      { z: 8, pts: trap8(9, 5, 5, 0.8, 15.5) },
    ]);
    const parts = [part(hull, { color: rust, to: 'paint' }), part(top, { color: '#93745a', to: 'paint' })];
    // treads: four blocks, front and back each side
    for (const x of [-5.5, 5.5])
      for (const z of [-11, 9]) {
        parts.push(part(box(4, 3.2, 9), { at: [x, 0, z], color: dark, to: 'metal' }));
        parts.push(part(box(2.4, 2.4, 3), { at: [x, 2.6, z], color: rust, to: 'paint' }));
      }
    // the ramp, down at the front, and the command deck's windows
    parts.push(part(box(6, 0.4, 7), { at: [0, 0.6, 20.5], rot: [-0.4, 0, 0], color: '#6a5440', to: 'metal' }));
    parts.push(part(new THREE.BoxGeometry(6, 0.6, 0.3), { at: [0, 18.6, 9.4], rot: [-0.9, 0, 0], color: new THREE.Color('#ffcf7a').multiplyScalar(1.6), to: 'glow' }));
    // pipes and vents on its back
    for (let i = 0; i < 5; i++) parts.push(part(cyl(0.6, 0.6, 2.4, 10), { at: [-3 + i * 1.5, 21, -6 + (i % 2) * 3], color: dark, to: 'metal' }));
    return { object: k.build(parts, { name: 'sandcrawler' }), solids: [{ box: [0, 0, 8, 18, 0] }] };
  },

  // a krayt dragon's bones, half in the sand: the spine in a long curve,
  // the ribs arched over it, the skull at its head
  krayt(k) {
    const bone = '#e6dcc4';
    const parts = [];
    const spine = (t) => [sin(t * 2.2) * 4, 1.2 + sin(t * PI) * 1.8 - t * 1.2, -15 + t * 30];
    let prev = spine(0);
    for (let i = 1; i <= 28; i++) {
      const t = i / 28;
      const p = spine(t);
      parts.push(rod(prev, p, 0.42 * (1 - t * 0.6), 0.36 * (1 - t * 0.6), { color: bone, to: 'stone' }));
      parts.push(part(new THREE.SphereGeometry(0.55 * (1 - t * 0.6), 8, 6), { at: p, color: bone, to: 'stone' }));
      // the ribs, the biggest midway along
      if (i > 3 && i < 19 && i % 2 === 0) {
        const span = 3.2 * sin(((i - 3) / 16) * PI) + 1.2;
        const rib = new THREE.TorusGeometry(span, 0.16, 6, 14, PI * 0.85);
        parts.push(part(rib, { at: [p[0], p[1] - span * 0.25, p[2]], rot: [0, PI / 2, PI * 0.075], color: bone, to: 'stone' }));
      }
      prev = p;
    }
    // the skull: a long snout, the brow ridge, two horns
    const head = spine(0);
    parts.push(part(new THREE.SphereGeometry(1.8, 12, 8), { at: [head[0], head[1] + 0.6, head[2] - 1.5], scale: [1, 0.8, 1.6], color: bone, to: 'stone' }));
    parts.push(part(new THREE.ConeGeometry(0.9, 3.4, 8), { at: [head[0], head[1] + 0.2, head[2] - 4.5], rot: [-PI / 2, 0, 0], color: bone, to: 'stone' }));
    for (const s of [-1, 1]) parts.push(part(new THREE.ConeGeometry(0.35, 2.6, 8), { at: [head[0] + s * 1.1, head[1] + 2.2, head[2] - 0.6], rot: [0.5, 0, -s * 0.5], color: bone, to: 'stone' }));
    return { object: k.build(parts, { name: 'krayt' }), solids: [{ circle: [head[0], head[2] - 2, 2.4] }, { circle: [0, -6, 2.5] }, { circle: [2, 2, 2.5] }, { circle: [-2, 9, 2] }] };
  },

  // the escape pod Artoo and Threepio came down in, on its side in the sand
  escapepod(k) {
    const parts = [
      part(cyl(1.25, 1.1, 4.2, 20), { at: [0, 1.0, -2.1], rot: [PI / 2 - 0.25, 0, 0.2], color: '#d8d6d0', to: 'paint' }),
      part(cyl(1.32, 1.32, 0.4, 20), { at: [0, 1.0, -0.4], rot: [PI / 2 - 0.25, 0, 0.2], color: '#a03a2a', to: 'paint' }),
      part(new THREE.CylinderGeometry(0.9, 0.9, 0.2, 16), { at: [0.5, 1.6, 1.7], rot: [PI / 2 - 0.25, 0, 0.2], color: '#3a3a3a', to: 'dark' }),
    ];
    // the hatch, blown off and lying beside it
    parts.push(part(new THREE.CylinderGeometry(0.85, 0.85, 0.15, 16), { at: [2.6, 0.1, 2.2], rot: [0.1, 0, 0.15], color: '#c8c6c0', to: 'paint' }));
    return { object: k.build(parts, { name: 'escapepod' }), solids: [{ circle: [0, -1, 1.6] }, { circle: [0.4, 1.5, 1.2] }] };
  },

  // a Tusken tent: a cone of hides on poles
  // (color: its canvas, for the other worlds' camps; sides 4 for a big
  // square-cornered tent)
  tent(k, { r = 2.4, h = 3, sides = 9, color = null } = {}) {
    const varied = new THREE.Color('#a08a6a').offsetHSL(0, 0, (k.rand() - 0.5) * 0.1);
    const hide = color ? new THREE.Color(color) : varied;
    const parts = [part(new THREE.ConeGeometry(r, h, sides, 1, true).translate(0, h / 2, 0), { color: hide, to: 'cloth' })];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + 0.3;
      parts.push(rod([cos(a) * r * 0.2, h * 0.85, sin(a) * r * 0.2], [cos(a) * r * 0.5, h + 0.9, sin(a) * r * 0.5], 0.05, 0.04, { color: '#4a3a28', to: 'bark' }));
    }
    parts.push(part(box(0.9, 1.4, 0.2), { at: [0, 0, r * 0.75], color: '#1e1610', to: 'dark' }));
    return { object: k.build(parts, { name: 'tent' }), solids: [{ circle: [0, 0, r * 0.85] }] };
  },

  // Obi-Wan's hut on the edge of the Western Dune Sea
  benhut(k) {
    const parts = [
      part(cyl(3.4, 3.3, 2.6, 24), { color: '#cdb894', to: 'adobe' }),
      part(dome(3.4, 1.4, 24), { at: [0, 2.6, 0], color: '#cdb894', to: 'adobe' }),
      part(cyl(1.6, 1.6, 1.8, 16), { at: [3.2, 0, 1.2], color: '#c2ad88', to: 'adobe' }),
      part(dome(1.6, 0.9, 16), { at: [3.2, 1.8, 1.2], color: '#c2ad88', to: 'adobe' }),
      part(box(1.2, 2, 0.4), { at: [-1.4, 0, 3.2], rot: [0, -0.4, 0], color: '#241a12', to: 'dark' }),
      part(cyl(0.12, 0.12, 2.6, 6), { at: [-0.6, 2.4, -0.8], color: '#6a6458', to: 'metal' }),
    ];
    return { object: k.build(parts, { name: 'benhut' }), solids: [{ circle: [0, 0, 3.4] }, { circle: [3.2, 1.2, 1.6] }] };
  },

  // Docking Bay 94: a round walled pit open to the sky, its gate on one side
  dockingbay(k, { r = 15, h = 7 } = {}) {
    // one thick wall, seen from in the pit as well as outside: out at r+0.5,
    // a rounded lip over the top, in at r-0.4 (the gap at +z, as the solids)
    const profile = [
      [r + 0.5, 0],
      [r + 0.5, h - 0.4],
      [r + 0.1, h + 0.3],
      [r - 0.4, h - 0.2],
      [r - 0.4, 0],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const wall = new THREE.LatheGeometry(profile, 48, 0.35, PI * 2 - 0.7);
    const parts = [part(wall, { color: '#cdb592', to: 'adobe' }), part(cyl(r - 0.4, r - 0.4, 0.15, 48), { color: '#8f7f66', to: 'stone' })];
    // ribs round its wall, outside and in
    for (let i = 0; i < 14; i++) {
      const a = 0.6 + (i / 13) * (PI * 2 - 1.2);
      for (const rr of [r + 0.6, r - 0.6]) parts.push(part(box(0.6, h, 0.6), { at: [sin(a) * rr, 0, cos(a) * rr], rot: [0, a, 0], color: ADOBE_DARK, to: 'adobe' }));
    }
    // a gate block either side of the opening, capping the wall's cut ends
    for (const a of [-0.4, 0.4]) parts.push(part(box(2.4, h + 0.6, 1.6), { at: [sin(a) * r, 0, cos(a) * r], rot: [0, a, 0], color: ADOBE_DARK, to: 'adobe' }));
    // the wall, as solid boxes round the ring (leaving the gate, at +z)
    const solids = [];
    for (let i = 0; i < 22; i++) {
      const a = 0.45 + (i / 21) * (PI * 2 - 0.9);
      solids.push({ box: [sin(a) * r, cos(a) * r, 2.3, 0.5, a] });
    }
    return { object: k.build(parts, { name: 'dockingbay' }), solids };
  },

  // the cantina: a big dome, a smaller one beside it, the round door
  cantina(k) {
    const parts = [
      part(cyl(7, 7, 3.2, 32), { color: ADOBE, to: 'adobe' }),
      part(dome(7, 4.2, 32), { at: [0, 3.2, 0], color: ADOBE, to: 'adobe' }),
      part(cyl(3.8, 3.8, 2.4, 24), { at: [7.5, 0, -2], color: ADOBE, to: 'adobe' }),
      part(dome(3.8, 2.4, 24), { at: [7.5, 2.4, -2], color: ADOBE, to: 'adobe' }),
      part(box(4, 3.4, 4), { at: [0, 0, 7.2], color: ADOBE, to: 'adobe' }),
      part(new THREE.CylinderGeometry(1.2, 1.2, 0.3, 20), { at: [0, 1.4, 9.25], rot: [PI / 2, 0, 0], color: '#1e1610', to: 'dark' }),
      part(ring(7.02, 0.18, 40), { at: [0, 3.2, 0], color: '#cdbfaa', to: 'adobe' }),
      // the vaporator-like tower on its roof
      part(cyl(0.5, 0.35, 3, 10), { at: [-2.5, 6.5, -2], color: '#8a8478', to: 'metal' }),
    ];
    return { object: k.build(parts, { name: 'cantina' }), solids: [{ circle: [0, 0, 7] }, { circle: [7.5, -2, 3.8] }, { box: [0, 7.2, 2, 2, 0] }] };
  },

  // Mos Eisley's cantina, the audit lane's remake (catalog/audit.js): the
  // built one under the model, with the model's walls (the front wall at
  // z 8.75 with the arched door 2.5 m right of the middle, the dome behind
  // it, the low wing to the west; Nevarro's town keeps the old cantina)
  moscantina(k) {
    return { ...PROPS.cantina(k), solids: [{ box: [1, 0.5, 9, 8.25, 0] }, { box: [-9, -1, 2, 5.5, 0] }] };
  },

  // Greef Karga's cantina on Nevarro: the built cantina, under the grey copy
  // of its model
  nevcantina(k) {
    return PROPS.cantina(k);
  },

  // a market stall: an awning on poles over a counter
  stall(k) {
    const cloth = ['#b0552e', '#c9a04a', '#5f7a8c', '#8a4a6a'][Math.floor(k.rand() * 4)];
    const parts = [part(box(3, 1, 1.2), { color: ADOBE_DARK, to: 'adobe' }), part(new THREE.BoxGeometry(3.6, 0.06, 2.6), { at: [0, 2.5, 0.4], rot: [0.18, 0, 0], color: cloth, to: 'cloth' })];
    for (const x of [-1.7, 1.7]) for (const z of [-0.6, 1.6]) parts.push(rod([x, 0, z], [x, 2.6 - z * 0.2, z], 0.05, 0.05, { color: '#4a3a28', to: 'bark' }));
    return { object: k.build(parts, { name: 'stall' }), solids: [{ box: [0, 0, 1.6, 0.7, 0] }] };
  },

  // the Great Pit of Carkoon: the Sarlacc's maw in the bottom of a sand
  // pit (the land's own), its beak, its teeth and its tentacles, reaching
  sarlacc(k) {
    const parts = [part(new THREE.CircleGeometry(3.4, 32).rotateX(-PI / 2), { at: [0, 0.05, 0], color: '#1a0e0a', to: 'dark' }), part(ring(3.4, 0.6, 32), { color: '#7a4a3a', to: 'stone' })];
    // teeth, in rings, pointing in
    for (let row = 0; row < 2; row++)
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * PI * 2 + row * 0.17;
        const rr = 3.1 - row * 0.7;
        parts.push(part(new THREE.ConeGeometry(0.16, 0.9, 6), { color: '#e8dcc0', to: 'stone', m: new THREE.Matrix4().compose(new THREE.Vector3(cos(a) * rr, 0.35, sin(a) * rr), new THREE.Quaternion().setFromEuler(new THREE.Euler(sin(a) * 0.9, 0, -cos(a) * 0.9)), new THREE.Vector3(1, 1, 1)) }));
      }
    // the beak, up out of the middle
    parts.push(part(new THREE.ConeGeometry(0.7, 1.8, 8), { at: [0, 0.9, 0], color: '#c9b080', to: 'stone' }));
    const object = k.build(parts, { name: 'sarlacc' });
    // the tentacles, swaying
    const tentacles = [];
    const mat = k.own(new THREE.MeshStandardMaterial({ color: '#6a3a30', roughness: 0.6 }));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      const g = k.own(new THREE.CylinderGeometry(0.08, 0.22, 4.5, 8, 6).translate(0, 2.25, 0));
      const m = new THREE.Mesh(g, mat);
      m.position.set(cos(a) * 2.4, 0, sin(a) * 2.4);
      m.rotation.set(sin(a) * 0.7, 0, -cos(a) * 0.7);
      m.userData.a = a;
      m.castShadow = true;
      object.add(m);
      tentacles.push(m);
    }
    return {
      object,
      // (the pit's edge: you can go down into it, but not into the maw)
      solids: [{ circle: [0, 0, 3.6] }],
      update(t) {
        for (const m of tentacles) {
          const a = m.userData.a;
          const w = sin(t * 1.3 + a * 2) * 0.25;
          m.rotation.set(sin(a) * (0.7 + w), 0, -cos(a) * (0.7 + w));
        }
      },
    };
  },

  // Jabba's palace: the great drum and its dome, the tall tower, a smaller
  // one, the gatehouse at +z with its iron gate, and the gate's eye (a
  // droid on a stalk that asks who's knocking)
  palace(k) {
    const stone = '#bb8379';
    const parts = [
      part(cyl(40, 42, 34, 40), { color: stone, to: 'adobe' }),
      part(dome(38, 18, 40), { at: [0, 34, 0], color: stone, to: 'adobe' }),
      part(cyl(16, 17, 70, 28), { at: [44, 0, 10], color: '#b47d72', to: 'adobe' }),
      part(dome(16, 9, 28), { at: [44, 70, 10], color: '#b47d72', to: 'adobe' }),
      part(cyl(10, 12, 26, 24), { at: [-42, 0, 22], color: stone, to: 'adobe' }),
    ];
    // (its walls as the model's are, the audit lane's remake at 75 m: the
    // keep's drum a little west of the middle, the watchtower and the small
    // domed annex behind it to the east, the rocks at its west foot; the gate
    // is palacegate, in front of the keep)
    return {
      object: k.build(parts, { name: 'palace', shadows: false }),
      solids: [{ circle: [-3.5, 6.5, 20] }, { circle: [17.5, -19.2, 6] }, { circle: [19, -9, 7] }, { box: [-28, 4, 5, 14, 0] }],
    };
  },
  // Jabba's gate: the great door in its block, the ribs over it and the
  // droid's eye on its stalk; the door's face 5 m in front of where it's put
  palacegate(k) {
    const parts = [
      // (battered rough-stone sides, not a box)
      part(
        loft([
          { z: -5, pts: trap8(20, 16, 22, 0.6, 11) },
          { z: 5, pts: trap8(20, 16, 22, 0.6, 11) },
        ]),
        { color: '#9d6b60', to: 'adobe' },
      ),
      part(box(9, 12, 2), { at: [0, 0, 4.2], color: '#5a3426', to: 'metal' }),
      part(box(9.6, 0.6, 0.6), { at: [0, 12, 5.4], color: '#4a3a2a', to: 'metal' }),
      rod([2.6, 9, 5.2], [2.2, 7.4, 6.6], 0.08, 0.06, { color: '#3a3a36', to: 'metal' }),
      part(new THREE.SphereGeometry(0.32, 12, 10), { at: [2.2, 7.3, 6.7], color: '#5a5a54', to: 'metal' }),
      part(new THREE.SphereGeometry(0.12, 8, 6), { at: [2.2, 7.3, 7.0], color: '#ff2a1a', to: 'glow' }),
    ];
    // the door's horizontal ribs, and a row of round ports
    for (const y of [2, 5, 8, 11]) parts.push(part(box(9.4, 0.5, 0.5), { at: [0, y - 0.25, 5.3], color: '#3e3022', to: 'metal' }));
    for (let i = 0; i < 5; i++) parts.push(part(cyl(0.28, 0.28, 0.12, 12), { at: [-3.2 + i * 1.6, 3.5, 5.25], rot: [PI / 2, 0, 0], color: '#2a1e16', to: 'metal' }));
    return { object: k.build(parts, { name: 'palacegate' }), solids: [{ box: [0, 0, 10, 5, 0] }] };
  },

  // the Stone Needle: a spire of rock standing up out of a canyon floor
  needle(k, { color = '#9a6a44', foot = '#8e6240' } = {}) {
    const parts = [part(rockGeometry(31, { sharp: 0.25, flat: 1 }), { scale: [5, 22, 5], color, to: 'rock' }), part(rockGeometry(37, { sharp: 0.4 }), { scale: [9, 4, 8], color: foot, to: 'rock' })];
    return { object: k.build(parts, { name: 'needle' }), solids: [{ circle: [0, 0, 2.6] }] };
  },

};

export const SCATTER = {};

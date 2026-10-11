// Cloud City, built in code (props/index.js has what a builder returns;
// edge.js has Mustafar's and Scarif's, and Bespin's people): the city's top
// deck and its towers, the landing platforms off its edge with their rails,
// the walkways between, the carbon-freezing chamber, the carbonite, the
// reactor shaft and its gantry, the dining room, the weather vane under the
// city and a cargo sled. The deck wears the core kit's polished slabs and
// the platforms its tread plate (kit.js's roles).

import * as THREE from 'three';
import { box, cyl, dome, part, ring, rod } from '../kitCore';
import { upright } from '../../../universe/trafficKit';

const { PI, cos, sin, abs } = Math;
const hot = (c, k = 2) => new THREE.Color(c).multiplyScalar(k);
const shade = (c, l) => new THREE.Color(c).offsetHSL(0, 0, l);

function towerParts({ h = 60, r = 6.5, color = '#e6ddd0' } = {}) {
  const P = [
    part(upright([[r * 1.35, 0], [r * 1.2, h * 0.08], [r, h * 0.16], [r * 0.92, h * 0.7], [r * 1.12, h * 0.8], [r * 1.1, h * 0.86], [r * 0.7, h * 0.93], [r * 0.25, h * 0.97]], 24), { color, to: 'paint' }),
    part(new THREE.SphereGeometry(r * 1.13, 20, 6, 0, PI * 2, PI * 0.45, PI * 0.1), { at: [0, h * 0.83, 0], color: shade(color, -0.06), to: 'paint' }),
    rod([0, h * 0.95, 0], [0, h * 1.08, 0], 0.4, 0.12, { color: '#b8b0a6', to: 'metal' }),
  ];
  for (const [y, rr] of [[0.3, 0.97], [0.45, 0.95], [0.6, 0.93], [0.83, 1.13]]) P.push(part(new THREE.CylinderGeometry(r * rr + 0.06, r * rr + 0.06, h * 0.025, 24, 1, true), { at: [0, h * y, 0], color: hot('#ffd6a8', 1.5), to: 'glow' }));
  return P;
}

export const PROPS = {
  cloudcity(k, opts = {}) {
    return { object: k.build(towerParts(opts), { name: 'cloudcity' }), solids: [{ circle: [0, 0, 8.5] }] };
  },

  // the city's top deck: a great disc of white plating, its plazas ringed,
  // a parapet round its edge (open where the bridges go out), the bowl of
  // the city's underside going down beneath it, a band of windows round
  // its rim; you walk on it
  bespindeck(k, { r = 170, gaps = [] } = {}) {
    const cream = '#efe6da';
    const P = [
      part(cyl(r, r, 3, 96), { at: [0, -3, 0], color: cream, to: 'tiles' }),
      part(new THREE.RingGeometry(r * 0.3, r * 0.34, 72).rotateX(-PI / 2), { at: [0, 0.02, 0], color: '#bfb4a6', to: 'paint' }),
      part(new THREE.RingGeometry(r * 0.62, r * 0.65, 96).rotateX(-PI / 2), { at: [0, 0.02, 0], color: '#bfb4a6', to: 'paint' }),
      part(new THREE.RingGeometry(r * 0.88, r * 0.9, 96).rotateX(-PI / 2), { at: [0, 0.02, 0], color: '#c9a888', to: 'paint' }),
      // the underside: a bowl down to the stalk
      part(upright([[6, -250], [10, -215], [16, -120], [r * 0.22, -78], [r * 0.45, -48], [r * 0.72, -22], [r * 0.93, -16], [r, -12], [r, -3]], 64), { color: '#8c9098', to: 'paint' }),
      // the stalk's bulb, under it all
      part(new THREE.SphereGeometry(14, 24, 12), { at: [0, -252, 0], scale: [1, 0.6, 1], color: '#7e7a74', to: 'metal' }),
      // the rim's windows, lit, in three tiers
      ...[-1.7, -6, -10].map((y) => part(new THREE.CylinderGeometry(r + 0.05, r + 0.05, 1.0, 96, 1, true), { at: [0, y, 0], color: hot('#ffd2a0', 1.6), to: 'glow' })),
    ];
    // ribs down the bowl
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * PI * 2;
      const at = (rr, y) => [sin(a) * rr, y, cos(a) * rr];
      P.push(rod(at(r * 0.99, -4), at(r * 0.72, -23), 1.4, 1.2, { color: '#a8a094', to: 'metal' }, 6));
      P.push(rod(at(r * 0.72, -23), at(r * 0.45, -49), 1.2, 1.0, { color: '#a8a094', to: 'metal' }, 6));
      P.push(rod(at(r * 0.45, -49), at(r * 0.22, -79), 1.0, 0.8, { color: '#a8a094', to: 'metal' }, 6));
    }
    // the parapet: arcs between the gaps, and solid all along them
    const gap = (a) => gaps.some((g) => abs(Math.atan2(sin(a - g), cos(a - g))) < 6 / r);
    const solids = [];
    const n = Math.round((PI * 2 * r) / 7);
    let arcFrom = null;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * PI * 2;
      const open = gap(a) || i === n;
      if (!open && i < n) solids.push({ box: [sin(a) * (r - 0.6), cos(a) * (r - 0.6), 3.7, 0.6, a] });
      if (!open && arcFrom === null) arcFrom = a;
      if (open && arcFrom !== null) {
        const len = a - (PI * 2) / n - arcFrom;
        if (len > 0.001) P.push(part(new THREE.TorusGeometry(r - 0.6, 0.45, 5, Math.max(2, Math.round(len * 40)), len).rotateX(PI / 2), { at: [0, 0.75, 0], rot: [0, a - (PI * 2) / n - PI / 2, 0], scale: [1, 1, 1], color: '#ebe4da', to: 'paint', m: new THREE.Matrix4().compose(new THREE.Vector3(0, 0.75, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a - (PI * 2) / n - PI / 2), new THREE.Vector3(1, 2.4, 1)) }));
        arcFrom = null;
      }
    }
    return { object: k.build(P, { name: 'bespindeck' }), solids, floors: [{ x: 0, z: 0, r, y: 0 }] };
  },

  // a landing platform off the city's edge: a round deck, its rim lit,
  // the landing circle, a cone of supports under it
  bespinplatform(k, { r = 26, color = '#cfc8c0', gap = null } = {}) {
    const P = [
      part(cyl(r, r * 0.98, 1.6, 64), { at: [0, -1.6, 0], color, to: 'deck' }),
      part(new THREE.RingGeometry(r * 0.9, r * 0.92, 64).rotateX(-PI / 2), { at: [0, 0.02, 0], color: '#a89e90', to: 'paint' }),
      // its raised rim
      part(new THREE.TorusGeometry(r * 0.97, 0.35, 6, 64).rotateX(PI / 2), { at: [0, 0.15, 0], color: '#bfb8b0', to: 'metal' }),
      part(new THREE.ConeGeometry(r * 0.7, 16, 32, 1, true), { at: [0, -9.6, 0], rot: [PI, 0, 0], color: '#b4aca0', to: 'cloth' }),
      part(cyl(2.5, 3.5, 30, 12), { at: [0, -40, 0], color: '#a8a094', to: 'metal' }),
    ];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * PI * 2;
      P.push(part(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 8), { at: [sin(a) * r * 0.96, 0.05, cos(a) * r * 0.96], color: hot(i % 2 ? '#ffb070' : '#ff7a4a', 3), to: 'glow' }));
    }
    // the rail round the rim (the films' platforms have none; this one
    // has, for the long way down): posts and a bar, open where the bridge
    // comes in (gap: that way's azimuth, radians round from +z toward +x)
    const posts = Math.round(r * 1.2);
    for (let i = 0; i < posts; i++) {
      const a = (i / posts) * PI * 2;
      if (gap != null && abs(Math.atan2(sin(a - gap), cos(a - gap))) < 4.5 / r) continue;
      P.push(part(cyl(0.05, 0.05, 1.1, 6), { at: [sin(a) * (r - 0.4), 0, cos(a) * (r - 0.4)], color: '#d8d0c4', to: 'metal' }));
    }
    const arc = gap == null ? PI * 2 : PI * 2 - 9 / r;
    P.push(part(new THREE.TorusGeometry(r - 0.4, 0.04, 5, Math.round(r * 4), arc).rotateX(PI / 2), { at: [0, 1.1, 0], rot: [0, (gap ?? 0) + 4.5 / r - PI / 2, 0], color: '#d8d0c4', to: 'metal' }));
    return { object: k.build(P, { name: 'bespinplatform' }), floors: [{ x: 0, z: 0, r, y: 0 }] };
  },

  // a walkway between the city and a platform: a deck along +z, low walls
  // each side, white ribs arching over it
  bespinbridge(k, { len = 40, w = 6 } = {}) {
    const P = [
      part(box(w, 1.2, len), { at: [0, -1.2, 0], color: '#e2d9cc', to: 'deck' }),
      part(box(w * 0.4, 0.3, len), { at: [0, -1.5, 0], color: '#a8a094', to: 'metal' }),
    ];
    for (const s of [-1, 1]) {
      P.push(part(box(0.4, 1.1, len), { at: [s * (w / 2 + 0.2), 0, 0], color: '#ebe4da', to: 'paint' }));
      P.push(part(new THREE.BoxGeometry(0.12, 0.12, len), { at: [s * (w / 2 + 0.2), 1.15, 0], color: hot('#ffcf9a', 1.4), to: 'glow' }));
    }
    for (let z = -len / 2 + 3; z < len / 2; z += 6) P.push(part(new THREE.TorusGeometry(w / 2 + 0.3, 0.16, 5, 18, PI), { at: [0, 1.0, z], color: '#ebe4da', to: 'paint' }));
    return {
      object: k.build(P, { name: 'bespinbridge' }),
      floors: [{ x: 0, z: 0, hw: w / 2 + 0.4, hd: len / 2, y: 0 }],
      solids: [{ box: [-(w / 2 + 0.2), 0, 0.25, len / 2, 0] }, { box: [w / 2 + 0.2, 0, 0.25, len / 2, 0] }],
    };
  },

  // the carbon-freezing chamber: a dark round pit of a room, the freezing
  // platform in its middle with the hole, the hydraulic claws over it, steam
  // rising, all of it lit red
  carbonchamber(k) {
    const object = new THREE.Group();
    const P = [
      part(cyl(17, 17, 0.12, 48), { color: '#2a2626', to: 'metal' }),
      // the curved back wall, its pipes and its lights
      part(new THREE.CylinderGeometry(17, 17, 11, 48, 1, true, PI * 0.12, PI * 1.76), { at: [0, 5.5, 0], color: '#2c2828', to: 'cloth' }),
      part(new THREE.CylinderGeometry(17.4, 17.6, 11.4, 48, 1, true, PI * 0.12, PI * 1.76), { at: [0, 5.7, 0], color: '#e4dacd', to: 'adobe' }),
      part(new THREE.CylinderGeometry(17.7, 17.7, 0.15, 48, 1, true, PI * 0.12, PI * 1.76), { at: [0, 8.6, 0], color: hot('#ff8a5a', 1.4), to: 'glow' }),
      part(new THREE.TorusGeometry(16.6, 0.25, 6, 48, PI * 1.76).rotateX(PI / 2), { at: [0, 10.8, 0], rot: [0, PI * 1.38, 0], color: '#3a3434', to: 'metal' }),
      // the platform, ringed, and the hole in it
      part(cyl(6.4, 6.4, 0.3, 40), { color: '#322c2c', to: 'metal' }),
      part(cyl(5.2, 5.2, 0.5, 32), { color: '#3a3434', to: 'metal' }),
      part(new THREE.CircleGeometry(2.2, 24).rotateX(-PI / 2), { at: [0, 0.52, 0], color: '#050404', to: 'dark' }),
      part(new THREE.TorusGeometry(2.25, 0.12, 6, 32).rotateX(PI / 2), { at: [0, 0.55, 0], color: hot('#ff6a2a', 2.6), to: 'glow' }),
      part(new THREE.TorusGeometry(5.1, 0.1, 6, 40).rotateX(PI / 2), { at: [0, 0.55, 0], color: hot('#ff3a1a', 2), to: 'glow' }),
    ];
    // oblong glow slots round the dais's lower step
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * PI * 2;
      const rr = i % 2 ? 6.1 : 5.6;
      P.push(part(new THREE.BoxGeometry(0.9, 0.08, 0.3), { at: [sin(a) * rr, 0.32, cos(a) * rr], rot: [0, a + PI / 2, 0], color: hot('#ff7a2a', 2.4), to: 'glow' }));
    }
    // the claws, arching over the hole
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + PI / 4;
      const base = [sin(a) * 4.6, 0.5, cos(a) * 4.6];
      const top = [sin(a) * 3.6, 6.2, cos(a) * 3.6];
      const tip = [sin(a) * 1.6, 4.2, cos(a) * 1.6];
      P.push(rod(base, top, 0.35, 0.3, { color: '#4a4242', to: 'metal' }));
      P.push(rod(top, tip, 0.28, 0.18, { color: '#4a4242', to: 'metal' }));
      P.push(part(new THREE.SphereGeometry(0.4, 8, 6), { at: top, color: '#3a3434', to: 'metal' }));
    }
    // the pipes up the wall, and the lamps
    for (let i = 0; i < 12; i++) {
      const a = PI * 0.16 + (i / 11) * PI * 1.68;
      P.push(part(new THREE.CylinderGeometry(0.3, 0.3, 11, 8), { at: [sin(a) * 16.4, 5.5, cos(a) * 16.4], color: '#3e3838', to: 'metal' }));
      if (i % 2) P.push(part(new THREE.BoxGeometry(1.4, 0.4, 0.1), { at: [sin(a) * 16.3, 8.5, cos(a) * 16.3], rot: [0, a, 0], color: hot('#ff5a2a', 2.2), to: 'glow' }));
    }
    object.add(k.build(P, { name: 'carbonchamber' }));
    // steam, rising from the hole and fading
    const n = 10;
    const steamMat = k.own(new THREE.MeshBasicMaterial({ color: '#f4e4d8', transparent: true, opacity: 0.18, depthWrite: false }));
    const steamGeo = k.own(new THREE.IcosahedronGeometry(1, 1));
    const steam = new THREE.InstancedMesh(steamGeo, steamMat, n);
    steam.frustumCulled = false;
    object.add(steam);
    const m = new THREE.Matrix4();
    const light = new THREE.PointLight('#ff5a2a', 60, 36, 1.6);
    light.position.set(0, 6, 0);
    object.add(light);
    // the wall's solid, round the back (the open side, +z, is the way in)
    const solids = [{ circle: [0, 0, 2.3] }];
    for (let i = 0; i < 26; i++) {
      const a = PI * 0.16 + (i / 25) * PI * 1.68;
      solids.push({ box: [sin(a) * 17, cos(a) * 17, 2.2, 0.4, a] });
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + PI / 4;
      solids.push({ circle: [sin(a) * 4.6, cos(a) * 4.6, 0.5] });
    }
    return {
      object,
      solids,
      update(t) {
        for (let i = 0; i < n; i++) {
          const p = (t * 0.22 + i / n) % 1;
          const s = 0.8 + p * 3.2;
          m.makeScale(s, s * 0.8, s).setPosition(sin(i * 2.1 + t * 0.3) * p * 2, 0.8 + p * 12, cos(i * 1.7) * p * 2);
          steam.setMatrixAt(i, m);
        }
        steam.instanceMatrix.needsUpdate = true;
        light.intensity = 52 + 10 * sin(t * 3.1) * sin(t * 1.3);
      },
    };
  },

  // Han Solo in carbonite: the slab stood on end, the shape of him in it,
  // hands up, the controls down its sides lit
  carbonite(k) {
    const slab = '#4e4842';
    const P = [
      part(box(1.0, 2.2, 0.5), { at: [0, 0.2, 0], color: slab, to: 'metal' }),
      part(box(1.3, 0.25, 0.8), { color: '#2a2828', to: 'metal' }),
      // him, coming out of it
      part(new THREE.SphereGeometry(0.13, 12, 10), { at: [0, 1.95, 0.24], scale: [1, 1.15, 0.5], color: slab, to: 'metal' }),
      part(new THREE.SphereGeometry(0.3, 12, 10), { at: [0, 1.35, 0.23], scale: [0.9, 1.4, 0.3], color: slab, to: 'metal' }),
      part(new THREE.SphereGeometry(0.075, 8, 6), { at: [-0.28, 1.95, 0.27], scale: [1, 1.3, 0.6], color: slab, to: 'metal' }),
      part(new THREE.SphereGeometry(0.075, 8, 6), { at: [0.24, 1.85, 0.27], scale: [1, 1.3, 0.6], color: slab, to: 'metal' }),
      rod([-0.25, 1.6, 0.25], [-0.28, 1.88, 0.27], 0.05, 0.05, { color: slab, to: 'metal' }),
      rod([0.22, 1.55, 0.25], [0.24, 1.78, 0.27], 0.05, 0.05, { color: slab, to: 'metal' }),
      part(new THREE.SphereGeometry(0.22, 10, 8), { at: [-0.1, 0.7, 0.22], scale: [0.6, 1.5, 0.3], color: slab, to: 'metal' }),
      part(new THREE.SphereGeometry(0.22, 10, 8), { at: [0.12, 0.7, 0.22], scale: [0.6, 1.5, 0.3], color: slab, to: 'metal' }),
    ];
    for (const s of [-1, 1]) {
      P.push(part(box(0.12, 1.6, 0.4), { at: [s * 0.56, 0.5, 0], color: '#3a3634', to: 'metal' }));
      for (let i = 0; i < 4; i++) P.push(part(new THREE.BoxGeometry(0.05, 0.08, 0.05), { at: [s * 0.62, 0.8 + i * 0.25, 0.1], color: hot(i % 2 ? '#ff4a3a' : '#4aff6a', 2.2), to: 'glow' }));
    }
    return { object: k.build(P, { name: 'carbonite' }), solids: [{ box: [0, 0, 0.65, 0.4, 0] }] };
  },

  // the reactor shaft: a great well going down into the city's core, rings
  // of light down it, and the gantry sticking out into it from the
  // corridor (along +z) where Luke and Vader fought
  reactorshaft(k, { r = 15, gantry = 13 } = {}) {
    const P = [
      // the shaft, open where the corridor comes in (at −z), seen from in and out
      part(new THREE.CylinderGeometry(r + 0.6, r + 0.6, 100, 40, 1, true, PI * 0.07 + PI, PI * 1.86), { at: [0, -38, 0], color: '#cfc6ba', to: 'adobe' }),
      part(new THREE.ConeGeometry(r + 0.6, 26, 40, 1, true), { at: [0, -101, 0], rot: [PI, 0, 0], color: '#b9b0a4', to: 'adobe' }),
      part(new THREE.CircleGeometry(r - 0.5, 32).rotateX(-PI / 2), { at: [0, -86, 0], color: hot('#ffb070', 1.6), to: 'glow' }),
      part(new THREE.TorusGeometry(r, 0.7, 6, 40).rotateX(PI / 2), { at: [0, 10, 0], color: '#6a6e78', to: 'metal' }),
      // the gantry, out over the drop, its railing on one side
      part(box(1.8, 0.4, gantry), { at: [0, -0.4, -r + gantry / 2], color: '#5a5e68', to: 'metal' }),
      part(new THREE.BoxGeometry(0.06, 0.06, gantry), { at: [0.9, 1.0, -r + gantry / 2], color: '#7a7e88', to: 'metal' }),
      part(box(1.6, 1.0, 1.0), { at: [0, 0, -r + gantry - 0.6], color: '#4a4e58', to: 'metal' }),
      part(new THREE.BoxGeometry(0.5, 0.2, 0.05), { at: [0, 0.7, -r + gantry - 0.08], color: hot('#ff5a3a', 2.4), to: 'glow' }),
    ];
    for (let y = 6; y > -84; y -= 14) P.push(part(new THREE.TorusGeometry(r - 0.4, 0.22, 4, 40).rotateX(PI / 2), { at: [0, y, 0], color: hot(y > -40 ? '#a8c8ff' : '#ffb27a', 1.8), to: 'glow' }));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2 + PI / 6;
      P.push(part(new THREE.BoxGeometry(1.2, 96, 1.2), { at: [sin(a) * (r - 0.8), -38, cos(a) * (r - 0.8)], color: '#1a1e26', to: 'metal' }));
    }
    for (let i = 0; i < 4; i++) P.push(rod([0.9, 0.0, -r + 2 + i * 3], [0.9, 1.0, -r + 2 + i * 3], 0.04, 0.04, { color: '#7a7e88', to: 'metal' }));
    const object = k.build(P, { name: 'reactorshaft' });
    // the inner wall, its own mesh: dark, with the film's walls of tiny lights
    const wallMat = k.looks.litWindows(k.own(new THREE.MeshStandardMaterial({ color: '#121a26', roughness: 0.8, side: THREE.DoubleSide })), { seed: 19, density: 0.6, cell: [0.9, 1.2], warm: '#dbe8ff', cool: '#9ad4ff' });
    const wall = new THREE.Mesh(k.own(new THREE.CylinderGeometry(r, r, 100, 40, 1, true, PI * 0.07 + PI, PI * 1.86)), wallMat);
    wall.position.y = -38;
    object.add(wall);
    return {
      object,
      floors: [{ x: 0, z: -r + gantry / 2, hw: 0.95, hd: gantry / 2, y: 0 }],
      solids: [{ box: [0.95, -r + gantry / 2, 0.08, gantry / 2, 0] }],
    };
  },

  // the dining room: a white rotunda open at the front, its tall windows,
  // the long table and its chairs (and whoever's waiting at the end of it)
  diningroom(k) {
    const P = [
      part(cyl(13, 13, 0.15, 48), { color: '#cfc4b6', to: 'paint' }),
      part(new THREE.CylinderGeometry(13, 13, 9, 48, 1, true, PI * 0.22, PI * 1.56), { at: [0, 4.5, 0], color: '#ece6dc', to: 'cloth' }),
      part(new THREE.SphereGeometry(13.2, 40, 12, PI * 0.72, PI * 1.56, 0, PI * 0.5), { at: [0, 9, 0], scale: [1, 0.35, 1], color: '#e4ddd2', to: 'cloth' }),
      // the table, the chairs down each side
      part(box(1.8, 0.08, 9), { at: [0, 0.82, -1], color: '#d8d2c8', to: 'paint' }),
      part(cyl(0.3, 0.4, 0.82, 10), { at: [0, 0, -4], color: '#a8a094', to: 'metal' }),
      part(cyl(0.3, 0.4, 0.82, 10), { at: [0, 0, 2], color: '#a8a094', to: 'metal' }),
    ];
    for (let z = -4.5; z <= 2.5; z += 1.75)
      for (const s of [-1, 1]) {
        P.push(part(box(0.55, 0.5, 0.55), { at: [s * 1.35, 0, z], color: '#ece6dc', to: 'cloth' }));
        P.push(part(box(0.08, 1.6, 0.5), { at: [s * 1.62, 0.5, z], color: '#ece6dc', to: 'cloth' }));
      }
    // the tall windows, glowing with the sunset outside
    // (and a round one in the back wall, facing the open front)
    P.push(part(new THREE.CircleGeometry(2.4, 32), { at: [0, 4.6, -12.8], color: hot('#ffc89a', 1.3), to: 'glow' }));
    for (let i = 0; i < 9; i++) {
      const a = PI * 0.32 + (i / 8) * PI * 1.36;
      if (i % 2 || Math.abs(a - PI) < 0.5) continue;
      P.push(part(new THREE.BoxGeometry(1.4, 6, 0.1), { at: [sin(a) * 12.9, 4.4, cos(a) * 12.9], rot: [0, a, 0], color: hot('#ffc89a', 1.3), to: 'glow' }));
    }
    const solids = [{ box: [0, -1, 1.0, 4.6, 0], top: 0.9 }];
    for (let i = 0; i < 24; i++) {
      const a = PI * 0.24 + (i / 23) * PI * 1.52;
      solids.push({ box: [sin(a) * 13, cos(a) * 13, 1.9, 0.35, a] });
    }
    return { object: k.build(P, { name: 'diningroom' }), solids };
  },

  // the weather vane, hanging under the city: a long mast down from the
  // stalk, its crossbars and its antenna fins (where Luke hung)
  weathervane(k, { h = 70 } = {}) {
    const M = { color: '#5c5c62', to: 'metal' };
    const P = [part(cyl(0.8, 1.2, h, 10), { at: [0, -h, 0], ...M })];
    for (let i = 0; i < 6; i++) {
      const y = -h * (0.25 + i * 0.12);
      const w = 6 + i * 2.2;
      const t = (i % 2) * (PI / 2);
      P.push(part(new THREE.BoxGeometry(w * 2, 0.8, 0.8), { at: [0, y, 0], rot: [0, t, 0], ...M }));
      for (const s of [-1, 1]) {
        const [x, z] = [s * w * cos(t), -s * w * sin(t)];
        P.push(part(new THREE.BoxGeometry(0.25, 2.5, 0.25), { at: [x, y - 1.65, z], ...M }), part(box(0.6, 0.6, 0.6), { at: [x, y - 3.2, z], ...M }));
      }
    }
    P.push(part(new THREE.SphereGeometry(1.2, 8, 6), { at: [0, -h - 0.8, 0], color: hot('#ff5a3a', 3), to: 'glow' }));
    return { object: k.build(P, { name: 'weathervane', shadows: false }) };
  },

  // a hover sled, for loading cargo (a carbonite slab, say) aboard ship
  cargosled(k) {
    const P = [
      part(box(1.6, 0.3, 2.6), { at: [0, 0.5, 0], color: '#8a8478', to: 'metal' }),
      part(box(1.2, 0.08, 2.2), { at: [0, 0.8, 0], color: '#5a5650', to: 'metal' }),
      part(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 12), { at: [0, 0.32, 0], color: hot('#9ad8ff', 2), to: 'glow' }),
      rod([0, 0.8, -1.2], [0, 1.6, -1.6], 0.05, 0.05, { color: '#3a3836', to: 'metal' }),
      part(box(0.6, 0.06, 0.12), { at: [0, 1.6, -1.6], color: '#3a3836', to: 'metal' }),
    ];
    return { object: k.build(P, { name: 'cargosled' }), solids: [{ box: [0, 0, 0.8, 1.3, 0], top: 0.85 }] };
  },
};

export const SCATTER = {
  cloudblock(k, { color = '#ece4d8' } = {}) {
    const r = 7;
    const h = 7;
    const P = [
      part(cyl(r, r * 0.94, h, 28), { color, to: 'adobe' }),
      part(dome(r * 0.96, r * 0.5, 28), { at: [0, h, 0], color: shade(color, -0.04), to: 'adobe' }),
      part(ring(r * 0.97, 0.25, 28), { at: [0, h, 0], color: shade(color, -0.1), to: 'adobe' }),
      part(cyl(1.1, 1.1, 2.2, 10), { at: [r * 0.3, h + r * 0.42, -r * 0.2], color: shade(color, -0.08), to: 'adobe' }),
      part(new THREE.CylinderGeometry(r + 0.04, r * 0.99, 1.0, 28, 1, true), { at: [0, h * 0.62, 0], color: hot('#ffd6a8', 1.5), to: 'glow' }),
      part(box(2.4, 3, 0.6), { at: [0, 0, r * 0.95], color: '#3a3238', to: 'dark' }),
    ];
    const by = (to) => P.filter((p) => p.to === to);
    return {
      parts: [
        { geometry: k.geometry(by('adobe')), material: k.mats.adobe },
        { geometry: k.geometry(by('glow')), material: k.mats.glow },
        { geometry: k.geometry(by('dark')), material: k.mats.dark },
      ],
      radius: r,
    };
  },
  cloudcity(k, opts = {}) {
    const P = towerParts(opts);
    return {
      parts: [
        { geometry: k.geometry(P.filter((p) => p.to === 'paint')), material: k.mats.paint },
        { geometry: k.geometry(P.filter((p) => p.to === 'glow')), material: k.mats.glow },
        { geometry: k.geometry(P.filter((p) => p.to === 'metal')), material: k.mats.metal },
      ],
      radius: 8.5,
    };
  },
};

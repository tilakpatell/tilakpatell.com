// Props any world can have: rocks to scatter, landing pads, crates, lamps,
// a campfire. (props/index.js has what a builder returns.)

import * as THREE from 'three';
import { box, cyl, part, rockGeometry, rod } from '../kitCore';
import { loft, trap8 } from '../../../universe/trafficKit';

const { PI, cos, sin } = Math;

// a number painted flat, in strokes (seven segments a digit), `h` tall,
// read from its +z side (its top toward -z): parts for a builder
const SEGMENTS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
function numeral(text, h, { at = [0, 0, 0], color = '#ffffff' } = {}) {
  const w = h * 0.55;
  const t = h * 0.12;
  const out = [];
  // (each segment: its middle, across the digit and up it, and which way it runs)
  const seg = { a: [0, h / 2, 'x'], b: [w / 2, h / 4, 'z'], c: [w / 2, -h / 4, 'z'], d: [0, -h / 2, 'x'], e: [-w / 2, -h / 4, 'z'], f: [-w / 2, h / 4, 'z'], g: [0, 0, 'x'] };
  [...text].forEach((ch, i) => {
    const ox = at[0] + i * (w + t * 2.5);
    for (const s of SEGMENTS[ch] ?? '') {
      const [x, up, run] = seg[s];
      const g = run === 'x' ? new THREE.BoxGeometry(w, 0.02, t) : new THREE.BoxGeometry(t, 0.02, h / 2);
      out.push(part(g, { at: [ox + x, at[1], at[2] - up], color, to: 'paint' }));
    }
  });
  return out;
}

export const PROPS = {

  // an AT-AT: the body on its four long legs, the head out front on its
  // neck, 22.5 m tall; its legs walk as it goes (update's `move`, 0…1)
  atat(k, { color = '#a2a29e' } = {}) {
    const dark = '#5a5a58';
    const object = new THREE.Group();
    const body = new THREE.Group();
    body.position.y = 15.4;
    object.add(body);
    const hull = loft([
      { z: -9.5, pts: trap8(6.2, 4.6, 5.4, 0.9, 0) },
      { z: -8.6, pts: trap8(7.2, 5.4, 6.4, 1.1, 0) },
      { z: 8.2, pts: trap8(7.2, 5.4, 6.4, 1.1, 0) },
      { z: 9.4, pts: trap8(6.0, 4.4, 5.2, 0.9, 0) },
    ]);
    const parts = [part(hull, { color, to: 'paint' })];
    // the ribs along its flanks, and the hatch on top
    for (const z of [-6, -3, 0, 3, 6]) for (const x of [-3.62, 3.62]) parts.push(part(new THREE.BoxGeometry(0.15, 4.6, 0.5), { at: [x, 0.2, z], color: dark, to: 'metal' }));
    parts.push(part(new THREE.CylinderGeometry(1.0, 1.0, 0.4, 14), { at: [0, 3.35, -2], color: dark, to: 'metal' }));
    // the neck: rings of plating out to the head
    for (let i = 0; i < 4; i++) parts.push(part(new THREE.CylinderGeometry(1.1 - i * 0.05, 1.2 - i * 0.05, 0.75, 12), { at: [0, -0.4, 9.9 + i * 0.8], rot: [Math.PI / 2, 0, 0], color: i % 2 ? color : dark, to: i % 2 ? 'paint' : 'metal' }));
    // the head: a blunt box, cheek guns, the chin gun, the viewports
    const head = loft([
      { z: 12.6, pts: trap8(3.0, 2.0, 2.8, 0.4, -0.5) },
      { z: 15.8, pts: trap8(3.4, 2.4, 3.0, 0.45, -0.5) },
      { z: 17.4, pts: trap8(2.6, 1.8, 2.2, 0.35, -0.7) },
    ]);
    parts.push(part(head, { color, to: 'paint' }));
    for (const x of [-1.85, 1.85]) parts.push(part(new THREE.CylinderGeometry(0.18, 0.22, 3.4, 8), { at: [x, -1.4, 17.4], rot: [Math.PI / 2, 0, 0], color: dark, to: 'metal' }));
    for (const x of [-0.35, 0.35]) parts.push(part(new THREE.CylinderGeometry(0.12, 0.14, 2.6, 8), { at: [x, -1.9, 17.7], rot: [Math.PI / 2, 0, 0], color: dark, to: 'metal' }));
    for (const x of [-0.7, 0.7]) parts.push(part(new THREE.BoxGeometry(0.5, 0.18, 0.1), { at: [x, 0.0, 17.42], rot: [-0.3, 0, 0], color: new THREE.Color('#ffb070').multiplyScalar(1.6), to: 'glow' }));
    body.add(k.build(parts, { name: 'atat-body' }));
    // the legs: hips under the corners, a knee halfway down, a foot
    const legs = [];
    for (const [x, z, phase] of [
      [-2.7, 6.6, 0],
      [2.7, 6.6, 0.5],
      [-2.7, -6.6, 0.75],
      [2.7, -6.6, 0.25],
    ]) {
      const hip = new THREE.Group();
      hip.position.set(x * 1.06, 13.4, z);
      const thigh = k.build([part(new THREE.BoxGeometry(1.5, 6.6, 1.8).translate(0, -3.3, 0), { color, to: 'paint' }), part(new THREE.CylinderGeometry(1.1, 1.1, 2.0, 14), { rot: [0, 0, Math.PI / 2], color: dark, to: 'metal' })], { name: 'atat-thigh' });
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -6.4;
      const shin = k.build(
        [
          part(new THREE.CylinderGeometry(0.95, 0.95, 1.9, 14), { rot: [0, 0, Math.PI / 2], color: dark, to: 'metal' }),
          part(new THREE.BoxGeometry(1.3, 6.2, 1.5).translate(0, -3.2, 0), { color, to: 'paint' }),
          part(new THREE.CylinderGeometry(0.5, 0.6, 0.8, 10), { at: [0, -6.6, 0], color: dark, to: 'metal' }),
          part(new THREE.CylinderGeometry(1.5, 1.7, 0.75, 16), { at: [0, -7.3, 0], color, to: 'paint' }),
        ],
        { name: 'atat-shin' },
      );
      knee.add(shin);
      hip.add(knee);
      object.add(hip);
      legs.push({ hip, knee, phase });
    }
    let cycle = 0;
    return {
      object,
      solids: legs.map((l) => ({ circle: [l.hip.position.x, l.hip.position.z, 1.6] })),
      update(t, dt, move = 0) {
        cycle += (dt ?? 0) * 0.32 * move;
        for (const l of legs) {
          const a = (cycle + l.phase) * Math.PI * 2;
          l.hip.rotation.x = Math.sin(a) * 0.2 * move;
          l.knee.rotation.x = -Math.max(0, Math.sin(a + 0.9)) * 0.42 * move;
        }
        body.position.y = 15.4 + Math.abs(Math.sin(cycle * Math.PI * 4)) * 0.25 * move;
        body.rotation.z = Math.sin(cycle * Math.PI * 2) * 0.012 * move;
      },
    };
  },

  // a 74-Z speeder bike: a long thin body, the steering vanes out front on
  // their booms, a saddle, 3.2 m long, nose to +z
  speederbike(k, { color = '#5a5e52' } = {}) {
    const dark = '#2a2c28';
    const parts = [
      part(new THREE.CapsuleGeometry(0.22, 1.5, 4, 12), { at: [0, 0.55, -0.35], rot: [Math.PI / 2, 0, 0], scale: [1.2, 1, 1], color, to: 'paint' }),
      part(box(0.38, 0.22, 0.9), { at: [0, 0.6, -1.0], color: dark, to: 'metal' }),
      part(box(0.3, 0.12, 0.55), { at: [0, 0.78, -0.25], color: '#3a302a', to: 'cloth' }),
      part(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 12), { at: [0, 0.6, -1.47], rot: [Math.PI / 2, 0, 0], color: new THREE.Color('#ff8a40').multiplyScalar(2), to: 'glow' }),
    ];
    // the booms and the vanes on their ends
    for (const x of [-0.12, 0.12]) parts.push(rod([x, 0.55, 0.4], [x * 1.6, 0.45, 1.55], 0.03, 0.03, { color: dark, to: 'metal' }));
    for (const x of [-0.28, 0.28]) parts.push(part(box(0.05, 0.36, 0.5), { at: [x, 0.28, 1.5], color, to: 'paint' }));
    // the handlebars
    parts.push(rod([-0.3, 0.95, 0.15], [0.3, 0.95, 0.15], 0.02, 0.02, { color: dark, to: 'metal' }));
    return { object: k.build(parts, { name: 'speederbike' }) };
  },
  // a landing pad: a ring of lights round a disc, `r` across
  // (shape 'round' or 'square'; marks 'cross', or 'rings': two flat amber
  // circles, as on Endor's landing platform)
  pad(k, { r = 14, color = '#7e7a72', light = '#ffb24a', number = null, shape = 'round', marks = 'cross' } = {}) {
    const square = shape === 'square';
    const parts = square
      ? [part(box(2 * r, 0.25, 2 * r), { color, to: 'metal' }), part(box(1.92 * r, 0.27, 1.92 * r), { color: '#5c5852', to: 'metal' })]
      : [part(cyl(r, r, 0.25, 40), { color, to: 'metal' }), part(cyl(r * 0.92, r * 0.92, 0.27, 40), { color: '#5c5852', to: 'metal' })];
    const lamp = new THREE.Color(light).multiplyScalar(3);
    const lights = [];
    if (square) for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const t of [-0.75, -0.25, 0.25, 0.75]) lights.push([sx ? sx * r * 0.96 : t * r, sz ? sz * r * 0.96 : t * r]);
    else for (let i = 0; i < 16; i++) lights.push([cos((i / 16) * PI * 2) * r * 0.96, sin((i / 16) * PI * 2) * r * 0.96]);
    for (const [x, z] of lights) parts.push(part(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 8), { at: [x, 0.3, z], color: lamp, to: 'glow' }));
    // the markings: a cross of strips, or two rings laid flat
    if (marks === 'rings')
      for (const [a, b] of [[0.58, 0.64], [0.17, 0.21]]) parts.push(part(new THREE.RingGeometry(r * a, r * b, 48).rotateX(-PI / 2), { at: [0, 0.285, 0], color: '#e0a030', to: 'paint' }));
    else for (const a of [0, PI / 2]) parts.push(part(new THREE.BoxGeometry(r * 1.1, 0.02, 0.5), { at: [0, 0.28, 0], rot: [0, a, 0], color: '#d8c890', to: 'paint' }));
    // its number, painted big in its near-left quarter (Scarif's Pad 9),
    // read from the pad's +z edge
    if (number != null) parts.push(...numeral(String(number), r * 0.42, { at: [-r * 0.4, 0.29, r * 0.42], color: '#e8e2d0' }));
    return { object: k.build(parts, { name: 'pad' }), floors: [square ? { x: 0, z: 0, hw: r, hd: r, yaw: 0, y: 0.27 } : { x: 0, z: 0, r, y: 0.27 }] };
  },

  // a stack of crates
  crates(k, { color = '#8a7556' } = {}) {
    const r = k.rand;
    const parts = [];
    const n = 2 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const s = 0.8 + r() * 0.6;
      parts.push(part(box(s, s, s), { at: [(r() - 0.5) * 2.4, i > 2 ? s : 0, (r() - 0.5) * 2.4], rot: [0, r() * PI, 0], color: new THREE.Color(color).offsetHSL(0, 0, (r() - 0.5) * 0.12), to: 'paint' }));
    }
    return { object: k.build(parts, { name: 'crates' }), solids: [{ circle: [0, 0, 1.6], top: 1.4 }] };
  },

  // a lamp post, its light glowing
  lamp(k, { h = 4, light = '#ffd9a0', color = '#4a4844' } = {}) {
    const parts = [part(cyl(0.12, 0.08, h, 8), { color, to: 'metal' }), part(new THREE.SphereGeometry(0.22, 12, 8), { at: [0, h + 0.1, 0], color: new THREE.Color(light).multiplyScalar(4), to: 'glow' })];
    return { object: k.build(parts, { name: 'lamp' }), solids: [{ circle: [0, 0, 0.2] }] };
  },

  // a campfire: stones round embers, its flame flickering
  fire(k) {
    const parts = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * PI * 2;
      parts.push(part(rockGeometry(i + 3), { at: [cos(a) * 0.75, -0.05, sin(a) * 0.75], scale: 0.38, color: '#5a5048', to: 'rock' }));
    }
    for (let i = 0; i < 4; i++) parts.push(rod([cos(i) * 0.5, 0.05, sin(i) * 0.5], [-cos(i) * 0.4, 0.25, -sin(i) * 0.4], 0.06, 0.05, { color: '#3a2a1c', to: 'bark' }));
    const object = k.build(parts, { name: 'fire' });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.1, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9a3a').multiplyScalar(3), toneMapped: false, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    k.own(flame.geometry);
    k.own(flame.material);
    flame.position.y = 0.5;
    object.add(flame);
    const light = new THREE.PointLight('#ff9a4a', 6, 14, 2);
    light.position.y = 1;
    object.add(light);
    return {
      object,
      solids: [{ circle: [0, 0, 0.9], top: 0.4 }],
      update(t) {
        const f = 1 + 0.18 * sin(t * 13) + 0.1 * sin(t * 29);
        flame.scale.set(1, f, 1);
        light.intensity = 5 + f * 2;
      },
    };
  },
};

// Things scattered by the dozen (drawn instanced): each gives its
// geometries, with the material each is drawn with, and how wide its
// footprint is at scale 1 (null: you walk through it).
export const SCATTER = {
  // (`to`: the scan it wears, where a world's rock isn't grey rock face:
  // Geonosis's redrock, Endor's mossrock)
  rock(k, { seed = 1, color = '#8a7a66', sharp = 0.4, to = 'rock' } = {}) {
    const g = rockGeometry(seed, { sharp, detail: 1 });
    return { parts: [{ geometry: k.geometry([part(g, { color, to })]), material: k.mats[to] ?? k.mats.rock }], radius: 0.42 };
  },
  // pebbles and small stones you walk over
  stones(k, { seed = 2, color = '#7a6c5c', to = 'rock' } = {}) {
    const g = rockGeometry(seed, { sharp: 0.2, detail: 0, flat: 0.4 });
    return { parts: [{ geometry: k.geometry([part(g, { color, to })]), material: k.mats[to] ?? k.mats.rock }], radius: null };
  },
};

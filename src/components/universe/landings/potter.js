// Down on the Harry Potter world: the shore of the Black Lake, the night the
// first-years come. The castle stands across the water on its crag, every
// window lit (Hogwarts' own far castle, lent through hogwarts/shared, drawn
// here in the surface kit's stone, slate and glow, small and far as the
// landing's little world needs it); four boats wait at the shingle, one
// with a lantern in its prow, the way in; an owl watches from a post. On
// the moor, a stone circle; at the forest's edge, the pines close in.
// The landing's water is still, a breath of wind on it (a ripple drawn into
// a normal map and slid across it, no shader of its own).

import * as THREE from 'three';
import { box, cyl, part, rockGeometry } from '../../galaxy/surface/kit';
import { SCATTER as GENERIC } from '../../galaxy/surface/props/generic';
import { rng } from '../../galaxy/surface/noise';
import { METRE } from '../foot';
import { castleParts } from '../../hogwarts/shared/castle';

const { PI, cos, sin } = Math;

// a ripple's normal map: sums of slow sines, tiled, made once a landing
function rippleTexture(k) {
  const N = 128;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const img = g.createImageData(N, N);
  const h = (x, y) => sin((x / N) * PI * 2 * 3 + sin((y / N) * PI * 2 * 2) * 1.2) * 0.5 + sin((y / N) * PI * 2 * 5 + (x / N) * PI * 2) * 0.3 + sin(((x + y) / N) * PI * 2 * 7) * 0.2;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = h(x + 1, y) - h(x - 1, y);
      const dy = h(x, y + 1) - h(x, y - 1);
      const l = Math.hypot(dx, dy, 1);
      const i = (y * N + x) * 4;
      img.data[i] = Math.round((-dx / l) * 127 + 128);
      img.data[i + 1] = Math.round((-dy / l) * 127 + 128);
      img.data[i + 2] = Math.round((1 / l) * 127 + 128);
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = k.own(new THREE.CanvasTexture(c));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// a lantern: a little iron frame round a flame that glows, and its light (set each frame, brought to the landing's scale)
function lantern(k, at, power) {
  const parts = [part(box(0.22, 0.04, 0.22), { at: [0, 0, 0], color: '#1e1d1c', to: 'metal' }), part(box(0.24, 0.04, 0.24), { at: [0, 0.3, 0], color: '#1e1d1c', to: 'metal' }), part(new THREE.SphereGeometry(0.07, 8, 6), { at: [0, 0.14, 0], scale: [1, 1.6, 1], color: '#ffc06a', to: 'glow' })];
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(part(box(0.025, 0.3, 0.025), { at: [x * 0.1, 0.02, z * 0.1], color: '#1e1d1c', to: 'metal' }));
  const object = k.build(parts, { name: 'lantern', shadows: false });
  object.position.set(...at);
  const light = new THREE.PointLight('#ffb468', 1, 9, 2);
  light.position.y = 0.15;
  object.add(light);
  return { object, light, power };
}
const flicker = (l, t, k = 0) => (l.light.intensity = l.power * METRE * METRE * (0.88 + 0.12 * sin(t * 7.3 + k) * sin(t * 3.1 + k * 2)));

export const PROPS = {
  // the loch: from a shoreline `shore` metres ahead out past the castle, `wide` across, dark and still
  loch(k, { shore = 0, deep = 160, wide = 300 } = {}) {
    const geo = new THREE.PlaneGeometry(wide, deep, Math.ceil(wide / 4), Math.ceil(deep / 4)).rotateX(-PI / 2).translate(0, 0, shore + deep / 2);
    const ripple = rippleTexture(k);
    ripple.repeat.set(wide / 9, deep / 9);
    const mat = k.own(new THREE.MeshStandardMaterial({ color: '#0d1820', roughness: 0.1, metalness: 0.35, normalMap: ripple, normalScale: new THREE.Vector2(0.25, 0.25), transparent: true, opacity: 0.94 }));
    const mesh = new THREE.Mesh(k.own(geo), mat);
    mesh.position.y = 0.06;
    mesh.receiveShadow = true;
    const object = new THREE.Group();
    object.name = 'loch';
    object.add(mesh);
    k.bend(object);
    return {
      object,
      solids: [],
      update(t) {
        ripple.offset.set(t * 0.012, t * 0.004);
      },
    };
  },

  // the castle on its crag across the water, every window lit: Hogwarts'
  // own far silhouette (hogwarts/shared), its front to the shore
  castle(k, { scale = 0.2 } = {}) {
    const ROLE = { rock: 'rock', stone: 'stone', roof: 'dark', glass: 'glow' };
    const parts = castleParts().map((p) => part(p.g, { scale, color: p.color, to: ROLE[p.role] }));
    const object = k.build(parts, { name: 'castle', shadows: false });
    return { object, solids: [] };
  },

  // a boat drawn up at the water's edge, its bow to the castle; one with a lantern on a pole at its prow
  boat(k, { lantern: lit = false, seed = 1 } = {}) {
    const rand = rng(seed);
    const hull = new THREE.SphereGeometry(1, 16, 8, 0, PI * 2, PI / 2, PI / 2).scale(0.68, 0.48, 1.95);
    const parts = [
      part(hull, { at: [0, 0.48, 0], color: rand() < 0.5 ? '#4a3424' : '#3e2c1f', to: 'bark' }),
      ...[-0.9, 0.05, 0.95].map((z) => part(box(1.18, 0.06, 0.26), { at: [0, 0.4, z], color: '#6a5139', to: 'bark' })),
      part(box(0.08, 0.5, 0.1), { at: [0, 0.4, -1.88], color: '#4a3424', to: 'bark' }),
    ];
    if (lit) parts.push(part(cyl(0.03, 0.03, 0.8, 6), { at: [0, 0.5, -1.75], color: '#3a2c20', to: 'bark' }));
    const object = k.build(parts, { name: 'boat' });
    // (rocking a little, half afloat in the shallows)
    const holder = new THREE.Group();
    holder.add(object);
    const lamp = lit ? lantern(k, [0, 1.3, -1.75], 2.2) : null;
    if (lamp) object.add(lamp.object);
    const ph = rand() * 6;
    return {
      object: holder,
      solids: [{ box: [0, 0, 0.75, 2] }],
      update(t) {
        object.rotation.z = sin(t * 0.8 + ph) * 0.03;
        object.position.y = -0.12 + sin(t * 0.9 + ph) * 0.02;
        if (lamp) flicker(lamp, t);
      },
    };
  },

  // a post with an owl on it, watching the boats (a tawny owl, round and still, turning its head now and then)
  owlPost(k) {
    const post = k.build([part(cyl(0.09, 0.11, 1.5, 8), { color: '#4a3a2c', to: 'bark' }), part(box(0.3, 0.06, 0.24), { at: [0, 1.5, 0], color: '#4a3a2c', to: 'bark' })], { name: 'post' });
    const body = k.build(
      [
        part(new THREE.SphereGeometry(0.15, 12, 9), { at: [0, 0.2, 0], scale: [1, 1.25, 0.9], color: '#7a5a3c', to: 'cloth' }),
        part(new THREE.SphereGeometry(0.1, 12, 9), { at: [0, 0.03, 0.06], scale: [1, 1, 0.6], color: '#c8b08a', to: 'cloth' }),
        part(box(0.06, 0.12, 0.2), { at: [-0.15, 0.12, 0], rot: [0.15, 0, 0.1], color: '#5e4430', to: 'cloth' }),
        part(box(0.06, 0.12, 0.2), { at: [0.15, 0.12, 0], rot: [0.15, 0, -0.1], color: '#5e4430', to: 'cloth' }),
      ],
      { name: 'owl', shadows: false },
    );
    const head = k.build(
      [
        part(new THREE.SphereGeometry(0.12, 12, 9), { color: '#7a5a3c', to: 'cloth' }),
        part(new THREE.CircleGeometry(0.075, 12), { at: [0, 0, 0.105], color: '#d8c4a0', to: 'cloth' }),
        ...[-1, 1].map((s) => part(new THREE.SphereGeometry(0.025, 8, 6), { at: [s * 0.04, 0.015, 0.12], color: '#ffcf4a', to: 'glow' })),
        part(new THREE.ConeGeometry(0.015, 0.04, 5), { at: [0, -0.025, 0.125], rot: [PI / 2 + 0.4, 0, 0], color: '#3a3026', to: 'dark' }),
      ],
      { name: 'owl:head', shadows: false },
    );
    head.position.y = 0.42;
    body.add(head);
    body.position.y = 1.53;
    post.add(body);
    return {
      object: post,
      solids: [{ circle: [0, 0, 0.2] }],
      update(t) {
        // (a quarter turn one way, a hold, back: an owl's watch)
        const s = (t * 0.25) % 4;
        head.rotation.y = s < 1 ? sin(s * PI) * 1.2 : s > 2 && s < 3 ? -sin((s - 2) * PI) * 0.9 : 0;
      },
    };
  },

  // a lamp on a post at the water's edge, the light the boats wait under
  lanternPost(k) {
    const object = k.build([part(cyl(0.07, 0.09, 2.6, 8), { color: '#3a2c20', to: 'bark' }), part(box(0.6, 0.07, 0.07), { at: [0.27, 2.5, 0], color: '#3a2c20', to: 'bark' })], { name: 'lamp post' });
    const lamp = lantern(k, [0.5, 2.0, 0], 3);
    object.add(lamp.object);
    return { object, solids: [{ circle: [0, 0, 0.15] }], update: (t) => flicker(lamp, t, 1) };
  },

  // far in among the pines, something white and glowing that moves off
  // between the trees and comes back: the forest's unicorn, glimpsed
  glimmer(k) {
    const glow = k.build([part(new THREE.SphereGeometry(0.22, 10, 8), { scale: [1.6, 1, 0.7], color: '#f2f4ff', to: 'glow' })], { name: 'glimmer', shadows: false });
    const light = new THREE.PointLight('#dfe6ff', 1, 12, 2);
    glow.add(light);
    const object = new THREE.Group();
    object.name = 'glimmer';
    object.add(glow);
    return {
      object,
      solids: [],
      update(t) {
        glow.position.set(sin(t * 0.13) * 9, 1.2 + sin(t * 0.7) * 0.15, cos(t * 0.09) * 4);
        const seen = 0.5 + 0.5 * sin(t * 0.21);
        glow.visible = seen > 0.25;
        light.intensity = 1.6 * seen * METRE * METRE;
      },
    };
  },

  // a stone circle on the moor: a ring of standing stones, one fallen
  stoneCircle(k, { r = 7, n = 9, seed = 5 } = {}) {
    const rand = rng(seed);
    const parts = [];
    const solids = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2 + rand() * 0.15;
      const fallen = i === 3;
      const h = 1.8 + rand() * 1.4;
      const x = cos(a) * r;
      const z = sin(a) * r;
      parts.push(part(box(0.9 + rand() * 0.4, h, 0.55), { at: [x, fallen ? 0.25 : 0, z], rot: fallen ? [PI / 2, -a, 0.2] : [rand() * 0.08, -a + PI / 2, rand() * 0.08], color: rand() < 0.5 ? '#77746c' : '#6a675f', to: 'stone' }));
      solids.push({ circle: [x, z, 0.6] });
    }
    return { object: k.build(parts, { name: 'stone circle' }), solids };
  },
};

export const SCATTER = {
  rock: GENERIC.rock,
  // the shingle: flat grey stones lying on the shore
  shingle(k, { seed = 9 } = {}) {
    const rand = rng(seed);
    const parts = [];
    for (let i = 0; i < 3; i++) parts.push(part(rockGeometry(seed + i, { sharp: 0.2 }), { at: [(rand() - 0.5) * 0.5, 0, (rand() - 0.5) * 0.5], scale: [0.12 + rand() * 0.1, 0.05 + rand() * 0.04, 0.1 + rand() * 0.1], color: '#7a776f', to: 'stone' }));
    return { parts: [{ geometry: k.geometry(parts), material: k.mats.stone }], radius: null, tints: ['#7a776f', '#8a867c', '#66635c', '#9a958a'] };
  },
  // heather: low purple domes on the moor
  heather(k, { seed = 3 } = {}) {
    const rand = rng(seed);
    const parts = [];
    for (let i = 0; i < 4; i++) parts.push(part(new THREE.SphereGeometry(0.25, 8, 5, 0, PI * 2, 0, PI / 2), { at: [(rand() - 0.5) * 0.6, 0, (rand() - 0.5) * 0.6], scale: [1 + rand() * 0.5, 0.6 + rand() * 0.4, 1 + rand() * 0.5], color: '#6a4a66', to: 'leaf' }));
    return { parts: [{ geometry: k.geometry(parts), material: k.mats.leaf }], radius: null, tints: ['#6a4a66', '#7d5a74', '#5a4a3a', '#6e5a3e'] };
  },
};

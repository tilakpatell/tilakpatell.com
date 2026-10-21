// What the classes share: the station’s frame (where a lesson stands, from
// where you stood as it began), the furniture a room would have until the
// rooms’ lane’s room is there to hold it (a desk, a bench, a platform, a
// wardrobe, a board), a gauge drawn in light, what the view points at, and
// a veil for a faint.
//
//   frame(at, floorAt) → { put(x, z, y) → Vector3 (x to your right, z
//     ahead, y over the floor), yaw (the station’s: facing you, from ahead),
//     face (the way you face) }
//   furniture(kind, { house, w, d, h, colour }) → a Mesh (its feet at y = 0,
//     its front toward −z… turned by the station to face you)
//   createGauge(cards) → { ring(p, r, k, colour, axis), bar(p, right, len, k, green, colour) }
//   aimed(camera, list, range) → the thing the view points at (rules/spells.js’s pick)
//   createVeil(scene) → { set(k), update(camera), dispose() }: black round the eye
//   createBoard({ lines, title, w, h }) → { mesh, draw(lines, at), dispose() }: chalk on slate

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { pick } from '../../rules/spells';

export function frame(at, floorAt = () => 0) {
  const [ax, , az] = at.p;
  const f = [-Math.sin(at.yaw), -Math.cos(at.yaw)]; // ahead (the walk’s yaw)
  const r = [Math.cos(at.yaw), -Math.sin(at.yaw)]; // and to your right
  return {
    put(x, z, y = 0) {
      const px = ax + r[0] * x + f[0] * z;
      const pz = az + r[1] * x + f[1] * z;
      return new THREE.Vector3(px, floorAt(px, pz) + y, pz);
    },
    // a thing facing you from ahead (its +z toward you)
    yaw: at.yaw,
    face: at.yaw + Math.PI,
  };
}

function paint(g, colour) {
  const p = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(p.attributes)) if (name !== 'position' && name !== 'normal') p.deleteAttribute(name);
  const c = new THREE.Color().setStyle(colour, THREE.SRGBColorSpace);
  const a = new Float32Array(p.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) a.set([c.r, c.g, c.b], i);
  p.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return p;
}
const box = (w, h, d, x, y, z, colour) => paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), colour);

const mats = new WeakMap();
const materialOf = (house) => {
  const key = house ?? materialOf;
  if (!mats.has(key)) mats.set(key, house?.material ? house.material({ vertexColors: true }) : new THREE.MeshLambertMaterial({ vertexColors: true }));
  return mats.get(key);
};

// The furniture, the rooms’ lane’s to make properly: these stand in until
// a room gives the lesson its own
export function furniture(kind, { house = null, w = 1.4, d = 0.7, h = 0.8, colour = '#5e4029' } = {}) {
  const parts = [];
  const legs = (lw, ld, lh, c) => [-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(0.07, lh, 0.07, (sx * (lw - 0.1)) / 2, lh / 2, (sz * (ld - 0.1)) / 2, c)));
  if (kind === 'desk' || kind === 'bench') {
    parts.push(box(w, 0.06, d, 0, h, 0, colour), ...legs(w, d, h, '#4a321f'));
    if (kind === 'bench') parts.push(box(w, 0.04, d * 0.9, 0, h * 0.35, 0, '#4a321f'));
  } else if (kind === 'platform') {
    // the duelling stage: a long table, its runner down the middle
    parts.push(box(w, 0.12, d, 0, h, 0, colour), box(w * 0.98, 0.01, d * 0.4, 0, h + 0.065, 0, '#7a1f1f'), ...legs(w, d, h, '#4a321f'));
  } else if (kind === 'wardrobe') {
    parts.push(box(w, h, d, 0, h / 2, 0, colour), box(w * 1.06, 0.08, d * 1.08, 0, h + 0.04, 0, '#3e2a1a'), box(0.02, h * 0.9, 0.02, 0, h / 2, d / 2 + 0.01, '#2a1c12'));
    for (const x of [-0.06, 0.06]) parts.push(box(0.03, 0.12, 0.04, x, h * 0.55, d / 2 + 0.02, '#b08a3a'));
  } else if (kind === 'post') {
    parts.push(box(0.16, h, 0.16, 0, h / 2, 0, colour), box(w, 0.12, 0.12, 0, h * 0.85, 0, colour));
  } else throw new Error(`furniture: no '${kind}'`);
  const m = new THREE.Mesh(mergeGeometries(parts), materialOf(house));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// A gauge drawn in light (the glow cards): a ring that fills (Charms’ beat),
// a bar with its green and a marker (the Mandrakes’)
export function createGauge(cards) {
  const p = new THREE.Vector3();
  return {
    // a ring of `n` motes round `at`, the first k of it lit; `axis` the
    // ring’s two directions ([right, up])
    ring(at, r, k, colour, [u, v] = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)], n = 28) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const lit = i / n < k;
        p.copy(at)
          .addScaledVector(u, Math.sin(a) * r)
          .addScaledVector(v, Math.cos(a) * r);
        cards.spawn({ p: p.toArray(), v: [0, 0, 0], life: 0.05, size: lit ? 0.07 : 0.035, colour: lit ? colour : new THREE.Color(0.25, 0.25, 0.3), drag: 0 });
      }
    },
    // a bar from `at` along `right`, `len` long: the green [a, b] of it, and the marker at k
    bar(at, right, len, k, [a, b], colour, n = 24) {
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        const green = f >= a && f <= b;
        p.copy(at).addScaledVector(right, (f - 0.5) * len);
        cards.spawn({ p: p.toArray(), v: [0, 0, 0], life: 0.05, size: green ? 0.06 : 0.035, colour: green ? new THREE.Color(0.3, 1.4, 0.4) : new THREE.Color(0.35, 0.3, 0.3), drag: 0 });
      }
      p.copy(at).addScaledVector(right, (k - 0.5) * len);
      cards.spawn({ p: [p.x, p.y + 0.06, p.z], v: [0, 0, 0], life: 0.05, size: 0.14, colour, drag: 0 });
    },
  };
}

// what the middle of the view is on, of `list` ({ id, kind, p, r })
const eye = new THREE.Vector3();
const dir = new THREE.Vector3();
export function aimed(camera, list, range = 4) {
  camera.getWorldPosition(eye);
  camera.getWorldDirection(dir);
  return pick(list, eye.toArray(), dir.toArray(), { range, cone: 0.2 });
}

// black round the eye, for a faint (and coming round)
export function createVeil(scene) {
  const mat = new MeshBasicNodeMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: THREE.BackSide });
  mat.fog = false;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), mat);
  mesh.renderOrder = 10000;
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  return {
    set(k) {
      mat.opacity = k;
      mesh.visible = k > 0.001;
    },
    update(camera) {
      mesh.position.copy(camera.position);
    },
    dispose() {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mat.dispose();
    },
  };
}

// A blackboard in chalk: a title and the lines, the one at `at` marked
export function createBoard({ w = 1.6, h = 1.1, title = '' } = {}) {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const px = 512;
  if (canvas) {
    canvas.width = px;
    canvas.height = Math.round((px * h) / w);
  }
  const tex = canvas ? new THREE.CanvasTexture(canvas) : null;
  if (tex) tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new MeshBasicNodeMaterial({ map: tex, color: tex ? 0xffffff : 0x223322 });
  const frameG = mergeGeometries([box(w + 0.1, h + 0.1, 0.05, 0, 0, -0.03, '#5a3c25')]);
  const group = new THREE.Group();
  const slate = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  group.add(slate, new THREE.Mesh(frameG, materialOf(null)));
  return {
    mesh: group,
    draw(lines, at = -1) {
      if (!canvas) return;
      const g = canvas.getContext('2d');
      g.fillStyle = '#26342c';
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.fillStyle = '#ece6d4';
      g.font = '600 34px Georgia, serif';
      g.fillText(title, 24, 50);
      g.font = '24px Georgia, serif';
      lines.forEach((l, i) => {
        const y = 92 + i * 34;
        g.fillStyle = i < at ? 'rgba(236,230,212,0.4)' : i === at ? '#f2d58a' : '#ece6d4';
        g.fillText(`${i + 1}. ${l}`, 30, y);
      });
      tex.needsUpdate = true;
    },
    dispose() {
      tex?.dispose();
      mat.dispose();
      slate.geometry.dispose();
      frameG.dispose();
    },
  };
}

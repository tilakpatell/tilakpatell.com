// The castle’s windows from inside: tall pointed lights of leaded glass, a
// lattice of diamond quarries in lead, each pane a little different (old
// glass is never one colour), lit from outside by the hour: a cold grey-blue
// at night with the moon somewhere in it, pale and bright by day, amber at
// sunset. Every window in a room is one instanced draw.
//
//   archShape(w, h, { point }) → THREE.Shape: a pointed-arch light, its foot at y 0 (pure geometry)
//   archPanel(w, h, depth) → geometry: a slab of wall w × h with that arch cut through it,
//     centred on its depth (the stone round a window, its spandrels filled)
//   paintLeaded({ size, seed }) → canvas (in a browser)
//   createWindows(spots, { renderer }) → { group, set({ day, dusk }), dispose() }
//     spots: [{ at: [x, y, z] (the foot’s middle), w, h, ry }]

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { mix, texture, uniform, uv, vec2, vec3 } from 'three/tsl';
import { canvasTexture } from '../../../../lib/three/canvasTexture';

export function archShape(w, h, { point = 0.62 } = {}) {
  // two arcs meeting at the crown: the springing at h − w·point
  const a = w / 2;
  const spring = h - w * point;
  const s = new THREE.Shape();
  s.moveTo(-a, 0);
  s.lineTo(-a, spring);
  const N = 10;
  // (each side an arc whose centre sits on the springing line, past the middle)
  const r = (a * a + (w * point) ** 2) / (2 * a);
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const ang = Math.PI - t * Math.asin((w * point) / r);
    s.lineTo(-a + r + r * Math.cos(ang), spring + r * Math.sin(ang));
  }
  for (let i = N - 1; i >= 0; i--) {
    const t = i / N;
    const ang = Math.PI - t * Math.asin((w * point) / r);
    s.lineTo(a - r - r * Math.cos(ang), spring + r * Math.sin(ang));
  }
  s.lineTo(a, 0);
  s.closePath();
  return s;
}

export function archPanel(w, h, depth = 1, { point = 0.62, frame = 0.02 } = {}) {
  const outer = new THREE.Shape();
  outer.moveTo(-w / 2 - frame, 0);
  outer.lineTo(w / 2 + frame, 0);
  outer.lineTo(w / 2 + frame, h + frame);
  outer.lineTo(-w / 2 - frame, h + frame);
  outer.closePath();
  const hole = archShape(w, h, { point });
  outer.holes.push(new THREE.Path(hole.getPoints().slice().reverse()));
  const g = new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  return g;
}

export function paintLeaded({ size = 256, seed = 3 } = {}) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size * 2;
  const g = c.getContext('2d');
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // the quarries: diamonds, each pane its own pale tint
  const q = size / 6;
  for (let y = -q; y < c.height + q; y += q / 2)
    for (let x = -q; x < size + q; x += q) {
      const ox = ((y / (q / 2)) % 2) * (q / 2);
      const v = 200 + rnd() * 50;
      g.fillStyle = `rgb(${v * (0.9 + rnd() * 0.1)}, ${v * (0.93 + rnd() * 0.07)}, ${v})`;
      g.beginPath();
      g.moveTo(x + ox, y - q / 2);
      g.lineTo(x + ox + q / 2, y);
      g.lineTo(x + ox, y + q / 2);
      g.lineTo(x + ox - q / 2, y);
      g.closePath();
      g.fill();
    }
  // the lead between them
  g.strokeStyle = 'rgb(28, 26, 24)';
  g.lineWidth = 3;
  for (let k = -c.height; k < size + c.height; k += q) {
    g.beginPath();
    g.moveTo(k, 0);
    g.lineTo(k + c.height, c.height);
    g.stroke();
    g.beginPath();
    g.moveTo(k + c.height, 0);
    g.lineTo(k, c.height);
    g.stroke();
  }
  // the iron saddle bars across, every so often
  g.lineWidth = 6;
  for (let y = q * 2; y < c.height; y += q * 2.5) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(size, y);
    g.stroke();
  }
  return c;
}

export function createWindows(spots, { renderer = null } = {}) {
  const group = new THREE.Group();
  group.name = 'hogwarts:windows';
  // one unit light (1 wide, 2.6 high), scaled to each window
  const geo = new THREE.ShapeGeometry(archShape(1, 2.6), 6);
  const uDay = uniform(0);
  const uDusk = uniform(0);
  const tex = typeof document === 'undefined' ? null : canvasTexture(paintLeaded(), renderer, { wrap: true });
  const mat = new MeshBasicNodeMaterial({ side: THREE.DoubleSide, fog: false });
  mat.userData.noHouse = true;
  // (the shape’s uv is its own units: x −0.5…0.5 across, y 0…2.6 up)
  const lead = tex ? texture(tex, uv().mul(vec2(1.5, 0.75))).rgb : vec3(0.85);
  const night = vec3(0.03, 0.045, 0.09).add(vec3(0.03, 0.045, 0.09).mul(uv().y.div(2.6)));
  const day = vec3(0.86, 0.9, 0.96).mul(1.4);
  const dusk = vec3(1.0, 0.62, 0.36).mul(1.2);
  const sky = mix(mix(night, day, uDay), dusk, uDusk);
  mat.colorNode = sky.mul(lead);
  const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  spots.forEach((s, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.ry ?? 0);
    m4.compose(new THREE.Vector3(...s.at), q, new THREE.Vector3(s.w, s.h / 2.6, 1));
    mesh.setMatrixAt(i, m4);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  group.add(mesh);
  return {
    group,
    // day: 0 at night … 1 at noon; dusk: how much of a sunset is in it
    set({ day: d = 0, dusk: k = 0 } = {}) {
      uDay.value = d;
      uDusk.value = k;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      tex?.dispose();
      mesh.dispose?.();
      group.removeFromParent();
    },
  };
}

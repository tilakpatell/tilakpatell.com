// The gargantuans near: a mesh of its own for each, built when one first
// comes within its mesh reach (expanse/scene/giants.js's giantK) and faded in
// as the far layer's discs fade out, every material made transparent at the
// start so the fade never changes a program mid-flight. Stock materials only
// (the site's GLSL is at its budget). Each sits at its row's place in
// doubles, turned so its own up is its axis.
//
// GIANT_KINDS: the five forms
// createGiantDrawer(kind, group, { prepare, budget }) → { update(entries, camera, t), shown(), dispose() }
//   entries are lane 2's near entries ({ id, at, size, d, row }); budget a thunk giving
//   universe/budget.js's row (`gargantuan`'s detail, `thingKinds.panels` a Dyson swarm's collectors)
//   - a black hole: its shadow, a photon ring and an accretion disc burning hot inside, turning
//   - a ringworld arc: a band of land and walls along its arc, lights along its rim
//   - a derelict hulk: a spine, ribs and dead windows
//   - a supergiant: a banded ball and its thin air
//   - a Dyson swarm: its star, half hidden, and a shell of collectors facing it

import * as THREE from 'three';
import { hot } from '../../../lib/three/canvasTexture';
import { giantK } from '../../expanse/shared/levels';
import { seededRng } from './layout';
import { softDot } from './shapes';

export const GIANT_KINDS = ['hole', 'arc', 'hulk', 'giant', 'dyson'];
const DETAIL = { low: 0.5, mid: 0.75, high: 1 };
const TAU = 2 * Math.PI;
const frac = (x) => x - Math.floor(x);

const fade = (m, opacity = 1) => {
  m.transparent = true;
  m.userData.opacity = opacity;
  m.opacity = 0;
  m.depthWrite = opacity >= 1;
  return m;
};
const glow = (hex, k, opacity = 1, side = THREE.FrontSide) => fade(new THREE.MeshBasicMaterial({ color: hot(hex, k), toneMapped: false, blending: THREE.AdditiveBlending, side }), opacity);
const solid = (o) => fade(new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.3, ...o }));

// (local frame: x the arc's reference, y the third way, z the axis; the same reference as gen's arcPoints)
function frameOf(axis) {
  const ax = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const c = new THREE.Vector3(axis[1] * ax[2] - axis[2] * ax[1], axis[2] * ax[0] - axis[0] * ax[2], axis[0] * ax[1] - axis[1] * ax[0]).normalize();
  const z = new THREE.Vector3(...axis);
  const y = new THREE.Vector3().crossVectors(z, c);
  return new THREE.Matrix4().makeBasis(c, y, z);
}

function shaded(geometry, a, b, rng, bands = 9) {
  const pos = geometry.attributes.position;
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  const out = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const phase = rng() * TAU;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / Math.max(1e-6, geometry.boundingSphere?.radius ?? 1);
    const k = 0.5 + 0.5 * Math.sin(y * bands * Math.PI + phase + 0.6 * Math.sin(y * 23 + phase));
    c.copy(ca).lerp(cb, k);
    out.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return geometry;
}

function build(row, detail, panels) {
  const g = new THREE.Group();
  g.name = `gargantuan:${row.id}`;
  const spinning = new THREE.Group(); // (what turns about the axis)
  g.add(spinning);
  const seg = (n) => Math.max(8, Math.round(n * detail));
  const rng = seededRng(row.seed);
  const [c0, c1] = row.colors;
  if (row.kind === 'hole') {
    g.add(new THREE.Mesh(new THREE.SphereGeometry(row.body, seg(48), seg(32)), fade(new THREE.MeshBasicMaterial({ color: '#000000' }))));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(row.body * 1.25, row.body * 0.05, 8, seg(96)), glow(c1, 3.2, 0.9)));
    const disc = new THREE.RingGeometry(row.body * 1.6, row.size, seg(160), 6);
    const pos = disc.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const hotC = new THREE.Color(hot(c0, 3));
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      const k = Math.pow(1 - (r - row.body * 1.6) / (row.size - row.body * 1.6), 2.2);
      col.set([hotC.r * k, hotC.g * k, hotC.b * k], i * 3);
    }
    disc.setAttribute('color', new THREE.BufferAttribute(col, 3));
    spinning.add(new THREE.Mesh(disc, fade(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), 0.95)));
  } else if (row.kind === 'arc') {
    const band = new THREE.Group();
    band.rotation.z = row.mid - row.span / 2;
    band.add(new THREE.Mesh(new THREE.TorusGeometry(row.size, row.band / 2, 6, seg(240), row.span).scale(1, 1, 1.6), solid({ color: c0, flatShading: true })));
    band.add(new THREE.Mesh(new THREE.TorusGeometry(row.size - row.band * 0.55, row.band * 0.06, 4, seg(240), row.span), glow(c1, 2.4, 0.9)));
    for (const z of [-1, 1]) band.add(new THREE.Mesh(new THREE.TorusGeometry(row.size + row.band * 0.1, row.band * 0.08, 4, seg(240), row.span).translate(0, 0, z * row.band * 0.8), solid({ color: '#5e6168', metalness: 0.6 })));
    spinning.add(band);
  } else if (row.kind === 'hulk') {
    const hull = solid({ color: c0, flatShading: true, metalness: 0.5 });
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(row.size * 0.1, row.size * 0.14, row.size * 2, 10, 6).rotateX(Math.PI / 2), hull));
    for (let i = 0; i < 9; i++) {
      const z = (i / 8 - 0.5) * row.size * 1.8;
      const k = 0.2 + 0.12 * rng();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(row.size * k, row.size * k * 0.6, row.size * 0.06).translate(0, 0, z), hull));
    }
    for (let i = 0; i < 24; i++) g.add(new THREE.Mesh(new THREE.BoxGeometry(row.size * 0.01, row.size * 0.01, row.size * 0.02).translate((rng() - 0.5) * row.size * 0.25, row.size * 0.13, (rng() - 0.5) * row.size * 1.8), glow(c1, rng() < 0.3 ? 2 : 0.4, 0.9)));
  } else if (row.kind === 'giant') {
    const geo = new THREE.SphereGeometry(row.size, seg(96), seg(64));
    geo.computeBoundingSphere();
    spinning.add(new THREE.Mesh(shaded(geo, c0, c1, rng), solid({ vertexColors: true, roughness: 0.95, metalness: 0 })));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(row.size * 1.035, seg(64), seg(48)), glow(c0, 0.6, 0.25, THREE.BackSide)));
  } else {
    // a Dyson swarm: its star, and its glow behind, burning through a sparse shell of collectors,
    // each a thin dark panel turned its own way off facing the star, most dark, some catching the
    // light as glints; gaps between them
    g.add(new THREE.Mesh(new THREE.SphereGeometry(row.body, seg(48), seg(32)), glow(c0, 3)));
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fade(new THREE.MeshBasicMaterial({ map: softDot(), color: hot(c0, 1.6), toneMapped: false, blending: THREE.AdditiveBlending }), 0.8));
    halo.scale.setScalar(row.body * 7);
    halo.userData.billboard = true;
    g.add(halo);
    const n = Math.max(60, Math.round(panels * 0.45));
    const glints = Math.round(n / 12);
    const panel = new THREE.BoxGeometry(1, 0.62, 0.03);
    // (dark panels, lit by the scene at their edges; a glint is a panel catching the star, glowing)
    const mesh = new THREE.InstancedMesh(panel, solid({ color: '#ffffff', metalness: 0.85, roughness: 0.35 }), n - glints);
    const shine = new THREE.InstancedMesh(panel, glow(c0, 1.4, 0.85, THREE.DoubleSide), glints);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const tilt = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const Z = new THREE.Vector3(0, 0, 1);
    const tone = new THREE.Color();
    const spacing = row.size * Math.sqrt((4 * Math.PI) / n);
    let dark = 0;
    let lit = 0;
    for (let i = 0; i < n; i++) {
      // (a Fibonacci sphere: even, with room between; each at its own radius in the shell, turned
      // its own way off facing the star)
      const y = 1 - (2 * (i + 0.5)) / n;
      const r = Math.sqrt(1 - y * y);
      const a = i * 2.399963;
      const d = row.size * (0.8 + 0.2 * rng());
      p.set(Math.cos(a) * r * d, y * d, Math.sin(a) * r * d);
      q.setFromUnitVectors(Z, p.clone().normalize().negate());
      tilt.setFromEuler(e.set((rng() - 0.5) * 1.2, (rng() - 0.5) * 1.2, rng() * Math.PI));
      q.multiply(tilt);
      const k = spacing * (0.25 + 0.3 * rng());
      m4.compose(p, q, s.set(k, k, k));
      if (i % 12 === 5 && lit < glints) shine.setMatrixAt(lit++, m4); // (one in twelve catches the star)
      else if (dark < n - glints) {
        mesh.setMatrixAt(dark, m4);
        mesh.setColorAt(dark++, tone.set('#1e1d22').offsetHSL(0, 0, (rng() - 0.5) * 0.06));
      }
    }
    mesh.count = dark;
    shine.count = lit;
    shine.frustumCulled = false;
    spinning.add(shine);
    mesh.frustumCulled = false;
    spinning.add(mesh);
  }
  g.position.set(row.at[0], row.at[1], row.at[2]);
  g.quaternion.setFromRotationMatrix(frameOf(row.axis));
  const materials = [];
  g.traverse((o) => o.material && materials.push(o.material));
  return { group: g, spinning, materials };
}

export function createGiantDrawer(kind, group, { prepare, budget = () => null } = {}) {
  const built = new Map(); // id → { group, spinning, materials }
  let shown = 0;
  return {
    update(entries, camera, t) {
      const seen = new Set();
      shown = 0;
      for (const e of entries) {
        const k = giantK(e.d, e.row).mesh;
        if (!(k > 0.001)) continue;
        seen.add(e.id);
        let b = built.get(e.id);
        if (!b) {
          const row = budget() ?? {};
          b = build(e.row, DETAIL[row.gargantuan] ?? 0.75, row.thingKinds?.panels ?? 900);
          built.set(e.id, b);
          group.add(b.group);
          prepare?.(b.group);
        }
        b.group.visible = true;
        for (const m of b.materials) m.opacity = (m.userData.opacity ?? 1) * k;
        b.spinning.rotation.z = TAU * frac(t / 600);
        b.group.traverse((o) => {
          if (o.userData.billboard && camera) o.quaternion.copy(b.group.quaternion).invert().multiply(camera.quaternion);
        });
        shown++;
      }
      for (const [id, b] of built)
        if (!seen.has(id)) {
          b.group.removeFromParent();
          b.group.traverse((o) => {
            o.geometry?.dispose();
            o.material?.dispose();
          });
          built.delete(id);
        }
    },
    shown: () => shown,
    dispose() {
      for (const b of built.values())
        b.group.traverse((o) => {
          o.geometry?.dispose();
          o.material?.dispose();
        });
      for (const b of built.values()) b.group.removeFromParent();
      built.clear();
    },
  };
}

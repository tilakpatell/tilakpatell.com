// The livery's workings without its look (./livery.js says what a paint job
// and the rim are): which materials take a paint, the uniforms the whole
// ship shares, and what set and rim write into them. How a material is
// taught them is handed in, `teach(material, uniforms) → the material that
// wears it`: livery.js's GLSL patch, or liveryNodes.js's node hooks (which
// hand back the material's node twin, so a mesh is given what comes back).
//
// createLiveryWith(teach) → { apply(root, fit, { clone, only }), set(paint),
//   rim({ colour, dir, key }), dispose() }
// complement(key) → [r, g, b]

import * as THREE from 'three';
import { SHIP_PROFILE } from '../../lib/three/gltf';

const lit = (m) => Boolean(m && (m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshToonMaterial));

const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// The key's opposite hue at the key's own brightness: 1 − the key (taken at
// its brightest channel, so a dim key isn't read as a dark one), scaled back
// to the key's luminance. A white key has no opposite: a grey of its
// luminance.
export function complement(key) {
  const top = Math.max(key[0], key[1], key[2]);
  const l = luminance(key);
  if (top <= 0) return [0, 0, 0];
  const c = key.map((v) => 1 - v / top);
  const lc = luminance(c);
  if (lc < 1e-4) return [l, l, l];
  return c.map((v) => (v * l) / lc);
}

export function createLiveryWith(teach) {
  const shared = {
    paintHull: { value: new THREE.Color() },
    paintTrim: { value: new THREE.Color() },
    paintOn: { value: 0 },
    uRimColour: { value: new THREE.Color(0, 0, 0) },
    uRimDir: { value: new THREE.Vector3(0, 1, 0) },
    uRimStrength: { value: SHIP_PROFILE.light.rim },
    uFillScale: { value: SHIP_PROFILE.light.fill / SHIP_PROFILE.light.key },
  };
  const copies = [];
  // (a material taught in place but handed back as another, its node twin:
  // the next mesh that shares it is given the same one)
  const taught = new WeakMap();
  return {
    apply(root, fit, { clone = false, only = null } = {}) {
      const uniforms = {
        ...shared,
        paintFit: { value: new THREE.Vector4(fit.mid, fit.marks[0], fit.marks[1], fit.keep) },
        paintDark: { value: new THREE.Vector4(...(fit.dark ?? [0, 0.001, 0]), 0) },
      };
      const one = (m) => {
        if (taught.has(m)) return taught.get(m);
        if (!lit(m) || m.userData.painted || (only && !only.test(m.name))) return m;
        const p = teach(clone ? m.clone() : m, uniforms);
        if (clone) copies.push(p);
        else if (p !== m) taught.set(m, p);
        return p;
      };
      root.traverse((o) => {
        if (!o.isMesh || o.userData.noPaint || o.userData.ink) return;
        o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
      });
      return root;
    },
    // a paint from paint.js (the factory's has no hull: the texture as it is)
    set(paint) {
      shared.paintOn.value = paint?.hull ? 1 : 0;
      if (!paint?.hull) return;
      shared.paintHull.value.set(paint.hull);
      shared.paintTrim.value.set(paint.trim);
    },
    // the light on its edges (lighting.js's fill), each frame
    rim({ colour, dir, key }) {
      if (Array.isArray(colour)) shared.uRimColour.value.setRGB(colour[0], colour[1], colour[2]);
      else shared.uRimColour.value.copy(colour);
      if (key) {
        const c = complement(Array.isArray(key) ? key : [key.r, key.g, key.b]);
        const r = shared.uRimColour.value;
        r.setRGB((r.r + c[0]) / 2, (r.g + c[1]) / 2, (r.b + c[2]) / 2);
      }
      if (Array.isArray(dir)) shared.uRimDir.value.set(dir[0], dir[1], dir[2]);
      else shared.uRimDir.value.copy(dir);
    },
    dispose() {
      for (const m of copies) m.dispose();
      copies.length = 0;
    },
  };
}

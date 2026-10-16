// The models in ./catalog.js, loaded once, for the scene to draw with in
// place of the code-made ones: loadHd() fetches them all (a model that fails
// is left out, and its code-made one stays); hdCopy(kind) is a copy to place
// (geometry and maps shared, materials too unless `own`), or null before
// they're loaded or when that one isn't there.
//
// Each is finished as it arrives: shadows cast and received, the tree that
// came uncoloured painted by height, Mario's materials given the sheen of
// what they are (denim, felt, leather, glossy eyes), the Power Star lit
// from within.

import * as THREE from 'three';
import { copy, loadGltf } from '../../../lib/three/gltf';
import { MODELS } from './catalog';

const loaded = new Map(); // kind → the shared original
let pending = null;

// the actor type or prop kind → the model that draws it
export const HD_FOR = Object.fromEntries(Object.entries(MODELS).map(([kind, m]) => [m.for ?? kind, kind]));

export function loadHd() {
  pending ??= Promise.all(
    Object.entries(MODELS).map(async ([kind, spec]) => {
      const got = await loadGltf(spec.file);
      if (got?.scene) loaded.set(kind, finish(kind, spec, got.scene));
    }),
  ).then(() => loaded.size);
  return pending;
}

export function hdCopy(kind, { own = false } = {}) {
  const t = loaded.get(kind);
  if (!t) return null;
  const c = copy(t);
  if (own) c.traverse((o) => o.isMesh && (o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone()));
  return c;
}

// the shared original (for a rig to copy itself)
export const hdTemplate = (kind) => loaded.get(kind) ?? null;

// Mario's materials by what they are: [name pattern, roughness, sheen]
const MARIO_FINISH = [
  [/blu/i, 0.82, 0.35],
  [/^hat$/i, 0.62, 0.25],
  [/^material$/i, 0.68, 0.3], // the gloves
  [/shoe/i, 0.34, 0],
  [/eye/i, 0.08, 0],
  [/body_color/i, 0.52, 0],
  [/hair|eyebrows/i, 0.75, 0.2],
  [/white|tongue/i, 0.35, 0],
];

function finish(kind, spec, root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  if (spec.paint) paintByHeight(root, spec.paint);
  if (kind === 'mario')
    root.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of [].concat(o.material)) {
        const f = MARIO_FINISH.find(([re]) => re.test(m.name));
        if (!f) continue;
        m.roughness = f[1];
        m.metalness = 0;
        if (f[2] && 'sheen' in m) m.sheen = f[2];
      }
    });
  if (kind === 'star')
    root.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of [].concat(o.material))
        if (m.color && m.color.r > 0.5) {
          m.emissive?.set('#ffb000');
          m.emissiveIntensity = 0.45;
          m.metalness = 0.6;
          m.roughness = 0.2;
        }
    });
  if (kind === 'coin')
    root.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of [].concat(o.material)) {
        m.metalness = 1;
        m.roughness = 0.22;
        m.emissive?.copy(m.color).multiplyScalar(0.18);
      }
    });
  return root;
}

// An uncoloured model coloured by how high each vertex is: the trunk below
// `trunk` (of its height) in `bark`, the crown above from the first green
// to the second, darker underneath the way light falls on it.
function paintByHeight(root, { trunk, bark, leaves }) {
  const box = new THREE.Box3().setFromObject(root);
  const h = box.max.y - box.min.y || 1;
  const brown = new THREE.Color(bark);
  const low = new THREE.Color(leaves[0]);
  const high = new THREE.Color(leaves[1]);
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const k = (v.y - box.min.y) / h;
      if (k < trunk) c.copy(brown);
      else c.copy(low).lerp(high, Math.min(1, (k - trunk) / (1 - trunk)) ** 0.8);
      c.toArray(col, i * 3);
    }
    o.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    for (const m of [].concat(o.material)) {
      m.vertexColors = true;
      m.color?.set('#ffffff');
      m.roughness = 0.85;
      m.needsUpdate = true;
    }
  });
}

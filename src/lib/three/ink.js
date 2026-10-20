// The ink line round the cast, and a rim of light on them: the show's one
// line, round its figures (the Rick and Morty worlds' cast, the universe
// map, the flight down the Rick and Morty page); nothing draws a line over
// the whole picture.
//
// The line is an inverted hull: each mesh's back faces drawn again in ink,
// pushed out along its normals. A Meshy model is split at every seam of its
// texture atlas, so its own normals disagree where two pieces meet and the
// pushed-out faces part there, leaving gaps in the line. smoothNormals gives
// each mesh a second set of normals for the ink alone (`inkNormal`), the
// same for every copy of a point, weighted by the angle each face makes
// there, so the line stays whole all the way round.

import * as THREE from 'three';

const INK = 0x1b1424;
const NEAR = 0.6; // metres: no line drawn nearer the eye than this

// `inkNormal` for a geometry (once: it's kept on the geometry, which clones
// of a figure share). Returns the geometry.
export function smoothNormals(geometry) {
  if (geometry.attributes.inkNormal) return geometry;
  const pos = geometry.attributes.position;
  const n = pos.count;
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  const step = Math.max(1e-9, (geometry.boundingSphere?.radius || 1) * 1e-4);
  // which welded point each vertex is
  const keys = new Map();
  const weld = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) / step)},${Math.round(pos.getY(i) / step)},${Math.round(pos.getZ(i) / step)}`;
    let w = keys.get(k);
    if (w === undefined) keys.set(k, (w = keys.size));
    weld[i] = w;
  }
  const sum = new Float32Array(keys.size * 3);
  const index = geometry.index;
  const tris = index ? index.count / 3 : n / 3;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const face = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const corners = [a, b, c];
  for (let t = 0; t < tris; t++) {
    const ids = [0, 1, 2].map((j) => (index ? index.getX(t * 3 + j) : t * 3 + j));
    ids.forEach((id, j) => corners[j].fromBufferAttribute(pos, id));
    face.subVectors(c, b).cross(e1.subVectors(a, b));
    if (face.lengthSq() === 0) continue;
    face.normalize();
    // each corner's share: the angle the face makes there
    for (let j = 0; j < 3; j++) {
      e1.subVectors(corners[(j + 1) % 3], corners[j]);
      e2.subVectors(corners[(j + 2) % 3], corners[j]);
      const angle = e1.angleTo(e2);
      if (!Number.isFinite(angle)) continue;
      const w = weld[ids[j]] * 3;
      sum[w] += face.x * angle;
      sum[w + 1] += face.y * angle;
      sum[w + 2] += face.z * angle;
    }
  }
  const out = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const w = weld[i] * 3;
    v.set(sum[w], sum[w + 1], sum[w + 2]);
    if (v.lengthSq() === 0) v.set(0, 1, 0);
    v.normalize();
    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
  }
  geometry.setAttribute('inkNormal', new THREE.BufferAttribute(out, 3));
  return geometry;
}

// An ink line round every mesh under `root`, skinned or not: their back
// faces drawn flat, pushed out along `inkNormal` once posed, in view space
// (so `width` is in the scene's units whatever scale the model or its
// skeleton has). None above `clipY`, in the meshes' own units (the
// cruiser's glass). Returns the material, for the caller to dispose.
export function inkHull(root, width, { clipY = null, color = INK } = {}) {
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  mat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('void main() {', 'attribute vec3 inkNormal;\nvarying float vInkY;\nvarying float vInkZ;\nvoid main() {')
      // (a skinned mesh bends its normals with its bones: the ink's with them)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = inkNormal;\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3( tangent.xyz );\n#endif')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vInkY = position.y;
          #ifdef USE_SKINNING
            vec3 inkN = normalize(transformedNormal);
            // (three turns a back side's normal round: turned back, or the
            // line would sink into the figure, out of sight)
            #ifdef FLIP_SIDED
              inkN = -inkN;
            #endif
          #else
            vec3 inkN = normalize(normalMatrix * inkNormal);
          #endif
          mvPosition.xyz += inkN * ${width.toFixed(4)};
          vInkZ = -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
        }`,
      );
    // (none within NEAR metres of the eye: a camera passing through a figure
    // would otherwise see the hull's back faces all round it, a screen of ink)
    s.fragmentShader = s.fragmentShader.replace('void main() {', `varying float vInkY;\nvarying float vInkZ;\nvoid main() {\nif (vInkZ < ${NEAR.toFixed(2)}) discard;\n${clipY == null ? '' : `if (vInkY > ${clipY.toFixed(5)}) discard;`}`);
  };
  mat.customProgramCacheKey = () => `ink-${width.toFixed(4)}-${clipY}`;
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh && !o.userData.ink) meshes.push(o);
  });
  for (const o of meshes) {
    smoothNormals(o.geometry);
    let h;
    if (o.isSkinnedMesh) {
      h = new THREE.SkinnedMesh(o.geometry, mat);
      h.bind(o.skeleton, o.bindMatrix);
      h.bindMode = o.bindMode;
    } else h = new THREE.Mesh(o.geometry, mat);
    h.userData.ink = true;
    h.userData.noPaint = true;
    h.frustumCulled = false;
    h.castShadow = false;
    h.position.copy(o.position);
    h.quaternion.copy(o.quaternion);
    h.scale.copy(o.scale);
    o.parent.add(h);
  }
  return mat;
}

// A rim of light round a toon material's edges, where the surface turns away
// from the eye: it lifts a figure off a dark background the way the show's
// back light does. Kept with whatever the material already does to its
// shaders (a shirt's colour, say), on a program of its own.
export function rimToon(material, { color = 0xffffff, power = 3, strength = 0.35 } = {}) {
  const rim = { rimColor: { value: new THREE.Color(color) }, rimPower: { value: power }, rimStrength: { value: strength } };
  material.userData.rim = rim;
  const before = material.onBeforeCompile;
  const key = material.customProgramCacheKey;
  material.onBeforeCompile = (s, r) => {
    before?.call(material, s, r);
    Object.assign(s.uniforms, rim);
    s.fragmentShader = s.fragmentShader
      .replace('void main() {', 'uniform vec3 rimColor;\nuniform float rimPower;\nuniform float rimStrength;\nvoid main() {')
      .replace(
        '#include <opaque_fragment>',
        `outgoingLight += rimColor * diffuseColor.rgb * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), rimPower) * rimStrength;
        #include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => `${key.call(material)}|rim`;
  return material;
}

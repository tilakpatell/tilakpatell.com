// foliage.js on the node renderer: the light that wraps past a leaf's
// edge, both faces of a card lit as one, and the wind in a crown, as node
// hooks (./hookNodes.js) on node materials, with the same names, arguments
// and uniforms (uniform nodes under the GLSL's names: userData.wind.uWindTime…).
// spherifyNormals and liftNormals are foliage.js's, copied (they're geometry,
// not shading): importing them would bring its GLSL into a 'nodes' world's
// closure; foliage.js re-exports these once its last GLSL caller has moved.
//
//   spherifyNormals(geometry, opts), liftNormals(geometry, opts)   (pure)
//   wrapLighting(material, { wrap, backScatter })   → the node material
//   faceless(material)                              → the node material
//   wind(material, { kind, time, dir, weight, ... }) → the node material
//   WIND
//
// A classic material passed in comes back as its node twin (asNode): use
// what's returned.

import * as THREE from 'three';
import { BRDF_Lambert, attribute, clamp, diffuseColor, diffuseContribution, dot, mat3, modelWorldMatrix, normalView, normalViewGeometry, normalize, sin, transpose, vec2, vec3, vec4 } from 'three/tsl';
import { asNode, follow, instanceMatrixOf, onDirect, onNormal, onPosition } from './hookNodes';

const UP = new THREE.Vector3(0, 1, 0);

export function spherifyNormals(geometry, { centre = null, radii = null, keep = 0.25 } = {}) {
  const pos = geometry.attributes.position;
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const nrm = geometry.attributes.normal;
  let c = centre;
  let r = radii;
  if (!c || !r) {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    c ??= box.getCenter(new THREE.Vector3());
    r ??= box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  }
  const inv = new THREE.Vector3(1 / Math.max(1e-6, r.x), 1 / Math.max(1e-6, r.y), 1 / Math.max(1e-6, r.z));
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).sub(c).multiply(inv);
    if (v.lengthSq() < 1e-12) v.copy(UP);
    v.normalize();
    n.fromBufferAttribute(nrm, i);
    v.multiplyScalar(1 - keep).addScaledVector(n, keep);
    if (v.lengthSq() < 1e-12) v.copy(UP);
    v.normalize();
    nrm.setXYZ(i, v.x, v.y, v.z);
  }
  nrm.needsUpdate = true;
  return geometry;
}

export function liftNormals(geometry, { keep = 0.25 } = {}) {
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const nrm = geometry.attributes.normal;
  const n = new THREE.Vector3();
  for (let i = 0; i < nrm.count; i++) {
    n.fromBufferAttribute(nrm, i).multiplyScalar(keep).addScaledVector(UP, 1 - keep);
    if (n.lengthSq() < 1e-12) n.copy(UP);
    n.normalize();
    nrm.setXYZ(i, n.x, n.y, n.z);
  }
  nrm.needsUpdate = true;
  return geometry;
}

// ── light that wraps ──

// Each direct light as three's model has it, then the diffuse's extra: the
// cosine wrapped past the terminator by uWrap, and uBackScatter of the
// light from behind (the GLSL's two lines after `irradiance`, on every
// light, the specular left on the true cosine).
export function wrapLighting(material, { wrap = 0.5, backScatter = 0.25 } = {}) {
  if (!material || material.userData.wrap) return material;
  const m = asNode(material);
  const uniforms = { uWrap: follow(wrap), uBackScatter: follow(backScatter) };
  onDirect(
    m,
    (input, call) => {
      call();
      const { lightDirection: L, lightColor, reflectedLight } = input;
      const albedo = BRDF_Lambert({ diffuseColor: m.isMeshStandardNodeMaterial ? diffuseContribution : diffuseColor.rgb });
      const dotNL = clamp(dot(normalView, L), 0, 1);
      const dotNLWrap = clamp(dot(normalView, L).add(uniforms.uWrap).div(uniforms.uWrap.add(1)), 0, 1);
      reflectedLight.directDiffuse.addAssign(dotNLWrap.sub(dotNL).mul(lightColor).mul(albedo));
      reflectedLight.directDiffuse.addAssign(uniforms.uBackScatter.mul(clamp(dot(normalView.negate(), L), 0, 1)).mul(lightColor).mul(albedo));
    },
    'wrap',
    uniforms,
  );
  m.userData.wrap = uniforms;
  return m;
}

// ── both faces as one ──

// The normal as the geometry has it, not turned round on the back face
// (three's negateOnBackSide left out). A card with a normal map keeps
// three's own: the GLSL's swap had the map tilt the unturned normal, which
// three's node normal map has no way in for.
export function faceless(material) {
  if (!material || material.userData.faceless) return material;
  const m = asNode(material);
  onNormal(m, (n) => (m.normalMap || m.bumpMap || m.normalNode ? n : normalViewGeometry), 'faceless');
  m.userData.faceless = true;
  return m;
}

// ── the wind ──

export const WIND = {
  tree: { height: 7, strength: 0.16, trunkHz: 0.45, leafHz: 2.6, leaf: 0.025 },
  shrub: { height: 1.3, strength: 0.05, trunkHz: 0.8, leafHz: 3.4, leaf: 0.012 },
};

const GLSL_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
function checkWeight(weight) {
  if (weight != null && (typeof weight !== 'string' || !GLSL_NAME.test(weight))) throw new TypeError(`wind: weight must be an attribute's GLSL name, not ${JSON.stringify(weight)}`);
}

// windShader's lines, on the vertex before three instances it: bent along
// the wind by the square of its height, in a phase from where the instance
// stands, plus a flutter by where the vertex is.
export function wind(material, { kind = 'tree', time = { value: 0 }, dir = new THREE.Vector2(0.8, 0.6), weight = null, ...over } = {}) {
  checkWeight(weight);
  if (!material || material.userData.wind) return material;
  const m = asNode(material);
  const k = { ...(WIND[kind] ?? WIND.tree), ...over };
  const uniforms = {
    uWindTime: follow(time, 'float'),
    uWindStrength: follow(k.strength),
    uWindHeight: follow(k.height),
    uWindTrunk: follow(k.trunkHz),
    uWindLeaf: follow(k.leafHz),
    uWindLeafAmp: follow(k.leaf),
    uWindDir: follow(dir.clone().normalize()),
  };
  const u = uniforms;
  onPosition(
    m,
    (p, builder) => {
      const im = instanceMatrixOf(builder);
      const w = weight ? attribute(weight, 'float') : null;
      let base = vec3(0, 0, 0);
      let wDir = u.uWindDir;
      if (im) {
        base = im.mul(vec4(0, 0, 0, 1)).xyz;
        wDir = normalize(transpose(mat3(im)).mul(vec3(u.uWindDir.x, 0, u.uWindDir.y)).xz.add(1e-5));
      }
      const world = modelWorldMatrix.mul(vec4(base, 1)).xyz;
      const phase = dot(world.xz, vec2(0.071, 0.113));
      const h = clamp(p.y.div(u.uWindHeight), 0, 1);
      const bend = w ? h.mul(h).mul(w) : h.mul(h);
      const t = u.uWindTime.mul(u.uWindTrunk).mul(6.2832).add(phase);
      const sway = sin(t).mul(0.4).add(0.6).add(sin(t.mul(2.3).add(1.7)).mul(0.25));
      let flutter = sin(u.uWindTime.mul(u.uWindLeaf).mul(6.2832).add(dot(p, vec3(3.1, 1.7, 2.3))).add(phase)).mul(u.uWindLeafAmp).mul(h);
      if (w) flutter = flutter.mul(w);
      const xz = p.xz.add(wDir.mul(sway.mul(u.uWindStrength).mul(bend))).add(vec2(flutter, flutter.mul(-0.7)));
      return vec3(xz.x, p.y, xz.y);
    },
    `wind${weight ? `|w:${weight}` : ''}`,
    uniforms,
  );
  m.userData.wind = uniforms;
  return m;
}

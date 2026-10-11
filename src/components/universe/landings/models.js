// The GLBs a landing stands about (landings.js's `models`): through the
// site's shared loader (lib/three/gltf.js: meshopt, KTX2, cached by URL for
// the page's life), brought to the size the landing asks (by height,
// length or width, in metres), stood on y = 0 and centred; each use a copy
// whose geometry and textures are the cache's, so it's marked `shared` and
// a landing never frees them. A model that won't load is just missing.
//
// A spec's `node` takes one model out of a kit (a file of a family of
// them, sharing their textures: scripts/quaternius.mjs makes them), where
// the kit has it; its `tint` is a colour the model's own are multiplied by
// (the landing's rock, its dry grass), one tinted copy of each material a
// tint for the page's life, like the cache's own.
//
// Its leaves, flowers and grass move in the landing's wind and light as
// Bruno's crowns do (./canopy.js): each such material patched once, as it
// first comes, and each geometry drawn with one baked with what that reads.
//
// createModels({ renderer }) → { get(spec) → Promise<Object3D | null> }

import * as THREE from 'three';
import { loadGltf } from '../../../lib/three/gltf';
import { bakeCanopy, canopy, canopyK, canopyLevel, canopyShader, crownMaterial, familyOf } from './canopy';
import { sizeFor } from './sizing';

// (the scale a spec asks for: ./sizing.js, pure, for a world that wants it alone)
export { sizeFor };

// One model of a kit, by its node's name: a copy of it (the kit's own
// left as it is), where the kit puts it, in a group of its own; null if
// the kit hasn't one by that name
export function pick(scene, name) {
  const node = scene.getObjectByName(name);
  if (!node) return null;
  scene.updateMatrixWorld(true);
  const own = node.clone(true);
  node.matrixWorld.decompose(own.position, own.quaternion, own.scale);
  const group = new THREE.Group();
  group.add(own);
  return group;
}

// a material with its colour multiplied by `tint`: the same copy for every
// use of that tint
const tints = new Map(); // `${material.uuid}|${tint}` → material
export function tinted(material, tint) {
  const key = `${material.uuid}|${tint}`;
  if (!tints.has(key)) {
    const m = material.clone();
    m.color?.multiply(new THREE.Color(tint));
    tints.set(key, m);
  }
  return tints.get(key);
}

// A leaf or a blade of grass, cut out and drawn both sides, is lit as its
// front from behind too: its normals point out of the crown (or up, the
// grass's), and three.js turns a back face's round, which lit half the
// leaves of a tree from inside it, dark. Done once a material; anything
// not marked `foliage` (by scripts/quaternius.mjs) is left as it is
//
// And its cut stays as full far off as near: a mipmap averages a leaf's
// edge into the clear round it, so a far crown, alpha-tested, thinned to
// twigs; its alpha is raised by a quarter a mip level it's read at (Ben
// Golus's fix for alpha-tested foliage), which keeps about the coverage
// the full-size map has
//
// And in the canopy (./canopy.js): the wind, the two tones, the crown that
// opens round you, with the canopy's uniforms (and its own K) handed to
// the shader, and the canopy's kept on it out of sight (a copy, tinted,
// doesn't take them, and is patched on its own), for its noise to be sent
// with the landing (lib/three/gpuWork's picturesIn)
const LIT = THREE.ShaderChunk.normal_fragment_begin.replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;');
const KEPT = `#include <map_fragment>
#ifdef USE_MAP
{
  vec2 texel = vMapUv * vec2( textureSize( map, 0 ) );
  vec2 dx = dFdx( texel );
  vec2 dy = dFdy( texel );
  diffuseColor.a *= 1.0 + max( 0.0, 0.5 * log2( max( dot( dx, dx ), dot( dy, dy ) ) ) ) * 0.25;
}
#endif`;
const lit = new WeakSet();
let told = false;
export function foliage(material) {
  if (!material?.userData?.foliage || lit.has(material)) return material;
  lit.add(material);
  const K = { value: new THREE.Vector4(...canopyK(material)) };
  const shared = canopy().uniforms;
  const level = canopyLevel();
  material.onBeforeCompile = (shader) => {
    if (shader.uniforms) Object.assign(shader.uniforms, shared, { uCanopyK: K });
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', KEPT).replace('#include <normal_fragment_begin>', LIT);
    const out = canopyShader(shader, { level });
    shader.vertexShader = out.vertexShader;
    shader.fragmentShader = out.fragmentShader;
    // (another three.js, its lines moved: said once, in development)
    if (shader.uniforms && !told && import.meta.env?.DEV && !Object.values(out.swapped).every(Boolean)) {
      told = true;
      console.warn('canopy: a foliage shader without the lines it looks for', out.swapped);
    }
  };
  material.customProgramCacheKey = () => `foliage|canopy:${level}`;
  Object.defineProperty(material.userData, 'canopy', { value: shared, enumerable: false, configurable: true });
  return material;
}

export function createModels({ renderer = null } = {}) {
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const v = new THREE.Vector3();
  return {
    async get(spec) {
      // (a kit's model is copied on its own, not the kit with it)
      const got = await loadGltf(spec.url, { renderer, fresh: !spec.node });
      if (!got?.scene) return null;
      const inner = spec.node ? pick(got.scene, spec.node) : got.scene;
      if (!inner) return null;
      const own = (m) => foliage(spec.tint ? tinted(m, spec.tint) : m);
      inner.traverse((o) => o.isMesh && (o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material)));
      inner.updateMatrixWorld(true);
      box.setFromObject(inner);
      box.getSize(size);
      box.getCenter(mid);
      // (each foliage mesh's geometry baked for the canopy, its foot and
      // top in its own units: the model's, before it's brought to size)
      inner.traverse((o) => {
        const ms = !o.isMesh ? [] : Array.isArray(o.material) ? o.material : [o.material];
        if (!ms.some((m) => m?.userData?.foliage)) return;
        const foot = o.worldToLocal(v.set(mid.x, box.min.y, mid.z)).y;
        const top = o.worldToLocal(v.set(mid.x, box.max.y, mid.z)).y;
        bakeCanopy(o.geometry, { foot, top, family: familyOf(spec.node ?? ''), crown: ms.some(crownMaterial) });
      });
      const k = sizeFor(size, spec);
      inner.scale.multiplyScalar(k);
      inner.position.set(-mid.x * k, -box.min.y * k + (spec.y ?? 0), -mid.z * k);
      const object = new THREE.Group();
      object.name = spec.node ?? spec.url.split('/').pop();
      object.rotation.y = spec.yaw ?? 0;
      object.add(inner);
      object.userData.footprint = (Math.max(size.x, size.z) * k) / 2;
      object.userData.shared = true;
      return object;
    },
  };
}

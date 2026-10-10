// Volume decals (the surfaces design, §5, lane Q4): the game's box
// projectors, drawn as the box itself on the node renderer. The box's back
// faces are drawn with no depth test; each fragment reads the depth the
// opaque world left there (viewportDepthTexture), takes that point back to
// the world and into the box's own frame (the unit cube, by the instance's
// inverse matrix: a cell's boxes of one texture are one InstancedMesh, its
// inverse, up and opacity instanced attributes), discards it
// outside, and samples the decal's texture by the box's xz: whatever the
// box holds wears the decal, whatever its geometry (three's
// webgpu_volume_* examples' shape).
//
// The colour and coverage are the decal's look (look.js); the normal is the
// surface's own, from the depth's slopes, so the sun lights the decal as it
// lights what it lies on. (The light's position is still the box face's
// fragment: a placed lamp lights a volume decal from slightly off. The sun
// does not care.) Where the surface turns away from the box's Y (a wall's
// face under a ground decal) the decal fades out between CLIP_MIN and
// CLIP_MAX, rather than smear the texture down it; and it softens over the
// last EDGE of the box toward its sides, so a box reads as a patch, not a
// square.
//
// VOLUME_BACKENDS: the backends whose depth this reads. The node renderer
// on WebGL 2 ('nodes-webgl') drew it in the lit fixture's --decals shot
// (Review Focus 3; SwiftShader's WebGL 2, the cloud's: a real driver's is
// the owner's laptop's to see); decalScene.js's `volumes: false` projects
// volume decals over their boxes instead, for a driver where it fails.
//
// volumeMaterial(texture, { THREE, tsl }, look?) → node material
// volumeBatch(decals, material, box, { THREE }) → InstancedMesh ; volumeOk(backend) → bool

import { decalNodes } from './look.js';

export const VOLUME_BACKENDS = ['webgpu', 'nodes-webgl'];
// the cosine between the surface's normal and the box's Y below which the
// decal is gone (about 75°) and above which it is whole (60°)
export const CLIP_MIN = 0.25;
export const CLIP_MAX = 0.5;
// the share of the box's half-width over which a volume decal fades out at
// its sides (the records carry no falloff)
export const EDGE = 0.15;
// half the unit cube: the box's local extent
const HALF = 0.5;

export const volumeOk = (backend) => VOLUME_BACKENDS.includes(backend);

export function volumeMaterial(map, { THREE, tsl }, look = { mask: 'a', color: null }) {
  const { Fn, float, vec4, mat4, attribute, screenUV, viewportDepthTexture, getViewPosition, cameraProjectionMatrixInverse, cameraWorldMatrix, cameraViewMatrix, abs, max, mul, sub, Discard, normalize, cross, dFdx, dFdy, dot, sign, negate, smoothstep } = tsl;
  const inverse = mat4(attribute('decalInv0', 'vec4'), attribute('decalInv1', 'vec4'), attribute('decalInv2', 'vec4'), attribute('decalInv3', 'vec4'));
  // the opaque world's point under this pixel, in view space, the world and the box
  const view = getViewPosition(screenUV, viewportDepthTexture(screenUV).x, cameraProjectionMatrixInverse);
  const world = cameraWorldMatrix.mul(vec4(view, float(1))).xyz;
  const local = inverse.mul(vec4(world, float(1))).xyz;
  const inside = Fn(() => {
    const a = abs(local);
    Discard(max(max(a.x, a.y), a.z).greaterThan(float(HALF)));
    return local.xz.add(float(HALF));
  })();
  const nodes = decalNodes(map, look, inside, 1, tsl);
  // the surface's normal from the depth's slopes, turned to face the camera
  // (screen y runs up on WebGL 2 and down on WebGPU, so the cross's sign
  // differs; the camera is at the view's origin)
  const raw = normalize(cross(dFdx(view), dFdy(view)));
  const n = mul(raw, sign(dot(raw, negate(view))));
  const up = normalize(cameraViewMatrix.mul(vec4(attribute('decalUp', 'vec3'), float(0))).xyz);
  const m = new THREE.MeshStandardNodeMaterial({ transparent: true, depthWrite: false, depthTest: false, side: THREE.BackSide, roughness: 0.8 });
  m.colorNode = nodes.colorNode;
  const side = max(abs(local.x), abs(local.z));
  const edge = sub(float(1), smoothstep(float(HALF * (1 - EDGE)), float(HALF), side));
  m.opacityNode = mul(mul(mul(nodes.opacityNode, attribute('decalOpacity', 'float')), smoothstep(float(CLIP_MIN), float(CLIP_MAX), dot(n, up))), edge);
  m.normalNode = n;
  return m;
}

// a cell's volume decals of one texture as one InstancedMesh over a copy of
// the unit box, each instance's inverse (four columns), its box's Y in the
// world and its opacity as instanced attributes
export function volumeBatch(decals, material, box, { THREE }) {
  const geometry = box.clone();
  const n = decals.length;
  const cols = [0, 1, 2, 3].map(() => new Float32Array(n * 4));
  const up = new Float32Array(n * 3);
  const opacity = new Float32Array(n);
  const mesh = new THREE.InstancedMesh(geometry, material, n);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const y = new THREE.Vector3();
  decals.forEach((d, i) => {
    q.fromArray(d.quaternion);
    m.compose(new THREE.Vector3(...d.position), q, new THREE.Vector3(...d.size));
    mesh.setMatrixAt(i, m);
    const e = m.clone().invert().elements;
    for (let c = 0; c < 4; c++) cols[c].set(e.slice(c * 4, c * 4 + 4), i * 4);
    up.set(y.set(0, 1, 0).applyQuaternion(q).toArray(), i * 3);
    opacity[i] = d.opacity ?? 1;
  });
  cols.forEach((a, c) => geometry.setAttribute(`decalInv${c}`, new THREE.InstancedBufferAttribute(a, 4)));
  geometry.setAttribute('decalUp', new THREE.InstancedBufferAttribute(up, 3));
  geometry.setAttribute('decalOpacity', new THREE.InstancedBufferAttribute(opacity, 1));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.texture = decals[0]?.texture;
  mesh.userData.volume = true;
  return mesh;
}

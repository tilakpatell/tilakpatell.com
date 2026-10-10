import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as glsl from './grounding';
import * as nodes from './groundingNodes';

// The twin against its original, on stubs (no GPU): the same exports, a
// node material where the original patched a classic one, the uniforms
// under the same names with the same values, the same flags.
const texture = () => new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
const bake = () => ({ areas: [{ texture: texture(), x0: -10, z0: -5, w: 20, d: 10 }, { texture: texture(), x0: 0, z0: 0, w: 4, d: 4 }], times: [{ tod: 0.3, channel: 0 }, { tod: 0.6, channel: 2 }], shade: 0x5a3420, range: [0, 3] });
const value = (u) => (u?.isNode ? u.value : u?.value);
const plain = (v) => (v?.isColor || v?.isVector2 || v?.isVector3 || v?.isVector4 ? v.toArray() : v);

describe('groundingNodes, the twin of grounding', () => {
  it('exports what grounding exports, but the GLSL strings', () => {
    const strings = ['floorShadowShader', 'bounceShader'];
    expect(Object.keys(nodes).filter((k) => k !== 'blobMaterial').sort()).toEqual(Object.keys(glsl).filter((k) => !strings.includes(k)).sort());
  });

  it('the pure parts are the same', () => {
    expect(nodes.maskWeights(0.45, bake().times)).toEqual(glsl.maskWeights(0.45, bake().times));
    expect(nodes.shadeTint(0x5a3420).toArray()).toEqual(glsl.shadeTint(0x5a3420).toArray());
    expect(nodes.blobPlacement(new THREE.Vector3(0.3, 0.8, 0.1), { x: 1, z: 2 }, 1.2, 0.3)).toEqual(glsl.blobPlacement(new THREE.Vector3(0.3, 0.8, 0.1), { x: 1, z: 2 }, 1.2, 0.3));
    expect(nodes.SHADE_TINT).toEqual(glsl.SHADE_TINT);
    expect(nodes.BOUNCE).toEqual(glsl.BOUNCE);
  });

  it('the floor: a node material, the same uniforms by name and value, shared by the bake, set by the time', () => {
    const b1 = bake();
    const b2 = bake();
    const a = glsl.floorShadow(new THREE.MeshStandardMaterial(), b1);
    const n = nodes.floorShadow(new THREE.MeshStandardMaterial({ roughness: 0.7 }), b2);
    expect(n.isNodeMaterial).toBe(true);
    expect(n.roughness).toBe(0.7);
    expect(Object.keys(n.userData.floorShadow).sort()).toEqual(Object.keys(a.userData.floorShadow).sort());
    for (const k of ['uMaskMix', 'uShadeTint', 'uShadeMix', 'uSunFloor']) expect(plain(value(n.userData.floorShadow[k]))).toEqual(plain(value(a.userData.floorShadow[k])));
    expect(n.userData.floorShadow.uMask.map((t) => t.value)).toEqual(b2.areas.map((x) => x.texture));
    glsl.setFloorTime(b1, 0.45, 0.5);
    nodes.setFloorTime(b2, 0.45, 0.5);
    expect(n.userData.floorShadow.uMaskMix.value.toArray()).toEqual(a.userData.floorShadow.uMaskMix.value.toArray());
    expect(n.userData.floorShadow.uShadeMix.value).toBe(a.userData.floorShadow.uShadeMix.value);
    // a second floor of the same bake shares them
    expect(nodes.floorShadow(new THREE.MeshLambertMaterial(), b2).userData.floorShadow).toBe(n.userData.floorShadow);
    const t = texture();
    nodes.setFloorMask(b2, 1, t);
    expect(n.userData.floorShadow.uMask[1].value).toBe(t);
    expect(n.customProgramCacheKey()).toContain('floorShadow:2');
  });

  it('a mover: the bake’s masks, its own range', () => {
    const b = bake();
    const a = glsl.standIn(new THREE.MeshStandardMaterial(), bake());
    const n = nodes.standIn(new THREE.MeshStandardMaterial(), b);
    expect(Object.keys(n.userData.standIn).sort()).toEqual(Object.keys(a.userData.standIn).sort());
    expect(n.userData.standIn.uMoverRange.value.toArray()).toEqual(a.userData.standIn.uMoverRange.value.toArray());
    expect(n.userData.standIn.uMask).toBe(nodes.floorShadow(new THREE.MeshStandardMaterial(), b).userData.floorShadow.uMask);
    expect(nodes.standIn(n, b)).toBe(n);
  });

  it('the bounce: the same uniforms, the mask’s where asked for, once a material', () => {
    for (const opts of [{ color: 0x886644 }, { color: new THREE.Color(0.2, 0.3, 0.4), floor: 'instance' }, { floor: 1.5, mask: bake() }]) {
      const a = glsl.bounce(new THREE.MeshStandardMaterial(), opts);
      const n = nodes.bounce(new THREE.MeshStandardMaterial(), opts);
      expect(Object.keys(n.userData.bounce).sort()).toEqual(Object.keys(a.userData.bounce).sort());
      for (const k of Object.keys(a.userData.bounce)) expect(plain(value(n.userData.bounce[k]))).toEqual(plain(value(a.userData.bounce[k])));
      expect(nodes.bounce(n, opts)).toBe(n);
    }
    const shared = new THREE.Color(0x123456);
    expect(nodes.bounce(new THREE.MeshStandardMaterial(), { color: shared }).userData.bounce.uBounceColor.value).toBe(shared);
  });

  it('the blobs: the same flags and uniforms, the same placing', () => {
    const a = glsl.createBlobShadows({ max: 4 });
    const n = nodes.createBlobShadows({ max: 4 });
    expect(n.mesh.material.isNodeMaterial).toBe(true);
    for (const k of ['transparent', 'depthWrite', 'premultipliedAlpha', 'blending', 'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits']) expect(n.mesh.material[k]).toBe(a.mesh.material[k]);
    expect(Object.keys(n.mesh.material.uniforms).sort()).toEqual(Object.keys(a.mesh.material.uniforms).sort());
    for (const s of [a, n]) {
      s.setSun(new THREE.Vector3(0.5, 0.5, 0), 0.8);
      s.set(1, { x: 1, z: 2 }, 0.5, 0.1, [2, 1], 0.4);
    }
    expect(n.mesh.count).toBe(a.mesh.count);
    expect(Array.from(n.mesh.instanceMatrix.array)).toEqual(Array.from(a.mesh.instanceMatrix.array));
    expect(Array.from(n.mesh.geometry.attributes.aBlob.array)).toEqual(Array.from(a.mesh.geometry.attributes.aBlob.array));
    expect(n.mesh.renderOrder).toBe(a.mesh.renderOrder);
  });
});

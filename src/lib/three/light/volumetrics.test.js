import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { CONES_LIT, CONE_REACH, VOLUME_LAYER, apexOf, coneLight, conesFor, createVolumetrics } from './volumetrics';

// Hoth's: a FX_Arctic_LightCone_04 (2 × 5 m, its emitter's grey) and a
// SimpleVolumetrics box (7.2 m, EmissionScale 0.2), as volumes.json holds them
const cone = { kind: 'cone', pos: [2.36, 0.13, -36.96], quat: [0, 1, 0, 0], scale: [2, 5, 2], color: [0.2438, 0.2462, 0.2237], exponent: 2.113, emission: 1, fade: [17, 20], effect: 'FX_Arctic_LightCone_04' };
const box = { kind: 'box', pos: [-78.2, -44.58, 348.4], quat: [0, -0.2271, 0, 0.9739], scale: [7.204, 7.204, 7.204], color: [0.8952, 1.2139, 1.5], exponent: 2, emission: 0.2 };
const at = (x, y, z, fov = 60) => ({ position: [x, y, z], fov });

describe('apexOf and coneLight', () => {
  it('a cone’s apex is its height above its foot, along its own up; a box’s light its centre', () => {
    apexOf(cone).forEach((v, i) => expect(v).toBeCloseTo([2.36, 5.13, -36.96][i]));
    expect(apexOf({ ...cone, quat: [0, 0, Math.SQRT1_2, Math.SQRT1_2] })[0]).toBeCloseTo(2.36 - 5);
    expect(apexOf(box)).toEqual(box.pos);
  });
  it('the nearest spot within a metre of the apex is the cone’s light; a point or a farther spot is not', () => {
    const near = { kind: 'spot', pos: [2.36, 5.6, -36.96] };
    const nearer = { kind: 'spot', pos: [2.36, 5.3, -36.96] };
    expect(coneLight(cone, [near, nearer, { kind: 'point', pos: [2.36, 5.13, -36.96] }])).toBe(nearer);
    expect(coneLight(cone, [{ kind: 'spot', pos: [2.36, 5.13 + CONE_REACH + 0.01, -36.96] }])).toBe(null);
    expect(coneLight(cone, null)).toBe(null);
  });
});

describe('conesFor', () => {
  const json = { cells: { '0,-1': [cone, { ...cone, pos: [10, 0, -60] }], '-1,2': [box] } };
  it('the volumes round the camera by screen area, a cone inside first', () => {
    const picked = conesFor(json, ['0,-1', '-1,2'], at(2.36, 2, -36.96));
    expect(picked[0]).toMatchObject({ cell: '0,-1', i: 0, area: 1, weight: 1 });
    expect(picked.length).toBe(2); // (the far cone, 25 m away, is past its fade)
  });
  it('a cone fades out over its record’s fade and is gone beyond it', () => {
    const json1 = { cells: { a: [cone] } };
    // the cone's middle is at y 2.63: 18.5 m off along x is halfway through 17…20
    const half = conesFor(json1, ['a'], at(2.36 + Math.sqrt(18.5 ** 2), 2.63, -36.96));
    expect(half[0].weight).toBeCloseTo(0.5, 2);
    expect(conesFor(json1, ['a'], at(30, 2.63, -36.96))).toEqual([]);
  });
  it('keeps at most max', () => {
    const many = { cells: { a: Array.from({ length: 20 }, (_, i) => ({ ...box, pos: [i * 3, 0, 0] })) } };
    expect(conesFor(many, ['a'], at(0, 0, 0), { max: CONES_LIT.high })).toHaveLength(6);
  });
});

describe('createVolumetrics', () => {
  const fake = { isWebGPURenderer: true };
  it('none on mid and low: the colour passes through', async () => {
    const v = await createVolumetrics(new THREE.Scene(), fake, { tier: 'mid' });
    const node = {};
    expect(v.pass(node, {})).toBe(node);
    expect(v.slots).toEqual([]);
  });
  it('ultra’s twelve slots on the volume layer; a lit cone takes its spot’s place, colour and strength; the rest glow', async () => {
    const scene = new THREE.Scene();
    const spot = { kind: 'spot', pos: [2.36, 5.4, -36.96], dir: [0, -1, 0], cone: [0.4, 0.8], color: [0.9, 0.95, 1], candela: 1000, range: 12 };
    const v = await createVolumetrics(scene, fake, { tier: 'ultra', source: { cells: { '0,-1': [cone], '-1,2': [box] } }, lights: { cells: { '0,-1': [spot] } }, scale: 0.01 });
    expect(v.slots).toHaveLength(CONES_LIT.ultra);
    for (const s of v.slots) {
      expect(s.mesh.layers.mask).toBe(1 << VOLUME_LAYER);
      expect(s.spot.layers.mask).toBe(1 << VOLUME_LAYER);
      expect(s.spot.shadow.camera.layers.mask & 1).toBe(1);
    }
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
    camera.position.set(2.36, 2, -30);
    camera.updateMatrixWorld();
    expect(v.update(camera)).toBe(1); // (the box is three cells away)
    const [s0, s1] = v.slots;
    expect(s0.u.lit.value).toBe(1);
    expect(s0.spot.intensity).toBeCloseTo(10);
    expect(s0.spot.color.b).toBe(1);
    expect(s0.spot.shadow.autoUpdate).toBe(true);
    expect(s0.mesh.scale.toArray()).toEqual([2, 5, 2]);
    expect(s0.mesh.position.y).toBeCloseTo(0.13 + 2.5);
    expect(s1.mesh.visible).toBe(false);
    expect(s1.spot.shadow.autoUpdate).toBe(false);
    v.set([box]);
    expect(s0.u.lit.value).toBe(0);
    expect(s0.u.emission.value).toBeCloseTo(0.2);
    expect(s0.spot.intensity).toBe(0);
    v.setScale(0.02);
    v.dispose();
    expect(scene.children).toHaveLength(0);
  });
  it('builds its pass into a node graph over a scene pass’s depth (no GPU: made, not compiled)', async () => {
    const { pass } = await import('three/tsl');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const v = await createVolumetrics(scene, fake, { tier: 'high' });
    const sp = pass(scene, camera);
    const out = v.pass(sp.getTextureNode('output'), { depth: sp.getTextureNode('depth'), camera });
    expect(out).toBeTruthy();
    expect(v.slots[0].mat.depthNode).toBeTruthy();
    v.dispose();
  });
});

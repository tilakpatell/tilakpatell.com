import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { BAKE_VERSION, LOOKUP_MS, bakeKey, getBake, putBake } from './bakeCache';

const caster = (x, seg = 1) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1, seg, seg, seg));
  m.position.set(x, 0, 0);
  const g = new THREE.Group();
  g.add(m);
  return g;
};
const base = () => ({ world: 'w', place: 'p', sun: new THREE.Vector3(0.3, 0.8, 0.2), tier: 'mid', casters: [caster(0)], area: { x0: 0, z0: 0, w: 10, d: 10 }, range: [-1, 2], params: { size: 512, sun: 8, sky: 8, shadow: 1024 } });

describe('bakeKey', () => {
  it('is the same for the same inputs', () => {
    expect(bakeKey(base())).toBe(bakeKey(base()));
  });
  it('changes when a caster moves, changes or the setting differs', () => {
    const k = bakeKey(base());
    expect(bakeKey({ ...base(), casters: [caster(2)] })).not.toBe(k);
    expect(bakeKey({ ...base(), casters: [caster(0, 3)] })).not.toBe(k);
    expect(bakeKey({ ...base(), tier: 'high' })).not.toBe(k);
    expect(bakeKey({ ...base(), world: 'x' })).not.toBe(k);
    expect(bakeKey({ ...base(), place: 'q' })).not.toBe(k);
    expect(bakeKey({ ...base(), sun: new THREE.Vector3(0.3, 0.8, 0.5) })).not.toBe(k);
  });
  it('changes with rotation, scale, area, range and parameters', () => {
    const k = bakeKey(base());
    const turned = caster(0);
    turned.children[0].rotation.y = 0.5;
    const scaled = caster(0);
    scaled.children[0].scale.setScalar(2);
    expect(bakeKey({ ...base(), casters: [turned] })).not.toBe(k);
    expect(bakeKey({ ...base(), casters: [scaled] })).not.toBe(k);
    expect(bakeKey({ ...base(), area: { x0: 0, z0: 0, w: 20, d: 10 } })).not.toBe(k);
    expect(bakeKey({ ...base(), range: [-1, 3] })).not.toBe(k);
    expect(bakeKey({ ...base(), params: { size: 1024, sun: 8, sky: 8, shadow: 1024 } })).not.toBe(k);
    expect(k.startsWith(`v${BAKE_VERSION}/`)).toBe(true);
  });
  it('ignores moves below half a centimetre and sun jitter below 0.01', () => {
    const k = bakeKey(base());
    expect(bakeKey({ ...base(), casters: [caster(0.002)] })).toBe(k);
    expect(bakeKey({ ...base(), sun: new THREE.Vector3(0.301, 0.8, 0.2) })).toBe(k);
  });
  it('changes with an instanced mesh\'s count and instance placement', () => {
    const inst = (xs) => {
      const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), xs.length);
      xs.forEach((x, i) => m.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0, 0)));
      const g = new THREE.Group();
      g.add(m);
      return g;
    };
    const k = (xs) => bakeKey({ ...base(), casters: [inst(xs)] });
    expect(k([0, 1])).toBe(k([0, 1]));
    expect(k([0, 1])).not.toBe(k([0, 1, 2]));
    expect(k([0, 1])).not.toBe(k([0, 5]));
  });
  it('is null without a world', () => {
    expect(bakeKey({ ...base(), world: undefined })).toBeNull();
  });
});

describe('getBake / putBake without IndexedDB', () => {
  it('resolve null / false', async () => {
    expect(await getBake('k')).toBeNull();
    expect(await putBake('k', { width: 1, height: 1, data: new Uint8Array(4) })).toBe(false);
  });
});

describe('a database that never answers', () => {
  const kept = globalThis.indexedDB;
  afterEach(() => {
    if (kept === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = kept;
  });
  it('lets getBake give up within the timeout', async () => {
    globalThis.indexedDB = { open: () => ({}) };
    const t0 = Date.now();
    expect(await getBake('k')).toBeNull();
    expect(Date.now() - t0).toBeLessThan(LOOKUP_MS + 400);
  });
});

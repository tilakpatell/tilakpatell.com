import { afterEach, describe, expect, it } from 'vitest';
import { forget, status } from '../wasm/load.js';
import { IMPORTERS, engineBuild, loadEngine } from './engine.js';

afterEach(() => forget('rapier'));

// one ball dropped on a box, stepped a second: where it rests
async function drop(RAPIER) {
  const w = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const floor = w.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  w.createCollider(RAPIER.ColliderDesc.cuboid(5, 0.5, 5), floor);
  const b = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0.3, 3, -0.2));
  w.createCollider(RAPIER.ColliderDesc.ball(0.5), b);
  for (let i = 0; i < 90; i++) w.step();
  const t = b.translation();
  const hit = w.castRay(new RAPIER.Ray({ x: 2, y: 5, z: 2 }, { x: 0, y: -1, z: 0 }), 10, true);
  const out = { y: t.y, x: t.x, ray: hit?.timeOfImpact ?? hit?.toi ?? null };
  w.free();
  return out;
}

describe('loadEngine', () => {
  it('takes the SIMD build where the check says SIMD', async () => {
    const R = await loadEngine({ simd: true });
    expect(engineBuild()).toBe('simd');
    expect(typeof R.World).toBe('function');
  });

  it('takes the plain build where it does not', async () => {
    await loadEngine({ simd: false });
    expect(engineBuild()).toBe('scalar');
  });

  it('falls back to the plain build when the SIMD one will not come up', async () => {
    const R = await loadEngine({ simd: true, importers: { simd: () => Promise.reject(new Error('CompileError')), scalar: IMPORTERS.scalar } });
    expect(engineBuild()).toBe('scalar');
    expect(typeof R.World).toBe('function');
  });

  it('names the failure when neither comes up, and tries again on the next ask', async () => {
    const none = { simd: () => Promise.reject(new Error('a')), scalar: () => Promise.reject(new Error('offline')) };
    const err = await loadEngine({ importers: none }).catch((e) => e);
    expect(err.name).toBe('WasmError');
    expect(err.module).toBe('rapier');
    expect(status().rapier.state).toBe('failed');
    expect(engineBuild()).toBe(null);
    await expect(loadEngine({ simd: false })).resolves.toBeTruthy();
  });

  it('a build that never comes up is a timeout, not a hang', async () => {
    const err = await loadEngine({ timeoutMs: 30, importers: { simd: () => new Promise(() => {}), scalar: () => new Promise(() => {}) } }).catch((e) => e);
    expect(err.reason).toBe('timeout');
  });

  it('the two builds agree on the same scene', async () => {
    const simd = await drop(await loadEngine({ simd: true }));
    forget('rapier');
    const scalar = await drop(await loadEngine({ simd: false }));
    expect(simd.y).toBeCloseTo(scalar.y, 3);
    expect(simd.x).toBeCloseTo(scalar.x, 3);
    expect(simd.ray).toBeCloseTo(scalar.ray, 5);
    expect(simd.y).toBeCloseTo(1, 1);
  });
});

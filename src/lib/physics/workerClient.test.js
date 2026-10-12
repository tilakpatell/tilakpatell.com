import { describe, expect, it } from 'vitest';
import { createPhysics } from './world.js';
import { createWorkerPhysics } from './workerClient.js';
import { fakeWorker } from './fixtures/fakeWorker.js';

const GROUND = { type: 'fixed', position: [0, -0.5, 0], group: 'floor', colliders: [{ shape: 'cuboid', args: [20, 0.5, 20] }] };
const BALL = (at, more = {}) => ({ position: at, colliders: [{ shape: 'ball', args: [0.5] }], ...more });
const BOX = (at) => ({ position: at, rotation: [0, 0.38268343, 0, 0.92387953], colliders: [{ shape: 'cuboid', args: [0.4, 0.3, 0.2] }] });

// the page's clock: a step, then the worker's answer landed before the next frame
async function frames(p, n, dt = 1 / 60) {
  for (let i = 0; i < n; i++) {
    p.step(dt);
    await p.flush?.();
  }
}

describe('createPhysics({ worker })', () => {
  it('is the main-thread engine by default, and says so', async () => {
    const p = await createPhysics();
    expect(p.status()).toEqual({ worker: false, hopMs: 0 });
    expect(p.world).toBeTruthy();
    p.dispose();
  });

  it('falls back to the main-thread engine when no Worker can be made (Review Focus 1)', async () => {
    const errors = [];
    const p = await createPhysics({
      worker: true,
      makeWorker: () => {
        throw new ReferenceError('Worker is not defined');
      },
      onError: (e) => errors.push(e),
    });
    expect(p.status().worker).toBe(false);
    expect(p.world).toBeTruthy();
    expect(errors).toHaveLength(0);
    p.dispose();
  });

  it('falls back when the worker starts but its engine will not (a blocked wasm)', async () => {
    const p = await createPhysics({ worker: true, makeWorker: () => fakeWorker({ fail: 'CompileError: wasm blocked' }) });
    expect(p.status().worker).toBe(false);
    expect(p.step(1 / 60)).toBe(1);
    p.dispose();
  });

  it('falls back when the worker never answers', async () => {
    const p = await createPhysics({ worker: true, workerTimeoutMs: 30, makeWorker: () => fakeWorker({ silent: true }) });
    expect(p.status().worker).toBe(false);
    p.dispose();
  });

  it('one scene stepped on the main thread and through the worker lands within 1e-6 (the same engine)', async () => {
    const main = await createPhysics();
    const off = await createPhysics({ worker: true, makeWorker: () => fakeWorker() });
    expect(off.status().worker).toBe(true);
    const run = async (p) => {
      p.add(GROUND);
      const bodies = [p.add(BALL([0, 3, 0])), p.add(BALL([0.2, 5, 0.1])), p.add(BOX([1, 2, -1]))];
      await frames(p, 150);
      return bodies.map((b) => [...b.position(), ...b.quaternion()]);
    };
    const a = await run(main);
    const b = await run(off);
    for (let i = 0; i < a.length; i++) for (let k = 0; k < 7; k++) expect(Math.abs(a[i][k] - b[i][k])).toBeLessThan(1e-6);
    expect(off.status().hopMs).toBeGreaterThanOrEqual(0);
    main.dispose();
    off.dispose();
  });

  it('counts substeps and alpha as the engine does, at once', async () => {
    const p = await createPhysics({ worker: true, makeWorker: () => fakeWorker() });
    expect(p.step(60)).toBe(4);
    expect(p.step(1 / 120)).toBe(0);
    expect(p.alpha).toBeCloseTo(0.5, 6);
    expect(p.step(1 / 120)).toBe(1);
    await p.flush();
    p.dispose();
  });
});

describe('the worker client', () => {
  it('a body added and removed between two steps has no row, and keeps where it was (Review Focus 2)', async () => {
    const p = await createWorkerPhysics({ make: () => fakeWorker() });
    p.add(GROUND);
    const keep = p.add(BALL([0, 2, 0]));
    const gone = p.add(BALL([3, 2, 0]));
    await frames(p, 30);
    const before = gone.position();
    p.remove(gone);
    const brief = p.add(BALL([6, 2, 0]));
    p.remove(brief);
    await frames(p, 30);
    expect(gone.removed).toBe(true);
    expect(gone.position()).toEqual(before);
    expect(brief.position()).toEqual([6, 2, 0]);
    expect(keep.position()[1]).toBeLessThan(1.9);
    expect(p.stats().rows).toBe(1);
    p.dispose();
  });

  it('draws between the last two poses by alpha', async () => {
    const p = await createWorkerPhysics({ make: () => fakeWorker() });
    const b = p.add(BALL([0, 10, 0], { linearDamping: 0 }));
    await frames(p, 10);
    const last = b.position();
    p.step(1 / 60);
    await p.flush();
    const now = b.position();
    p.step(1 / 120);
    await p.flush();
    const mid = b.drawn();
    expect(p.alpha).toBeCloseTo(0.5, 6);
    expect(mid[1]).toBeCloseTo((last[1] + now[1]) / 2, 5);
    p.dispose();
  });

  it('answers a query on the next step, the hit body as its handle', async () => {
    const p = await createWorkerPhysics({ make: () => fakeWorker() });
    const floor = p.add(GROUND);
    await frames(p, 1);
    const asked = p.query('ray', [0, 5, 0], [0, -1, 0], 20);
    let answered = false;
    asked.then(() => (answered = true));
    await Promise.resolve();
    expect(answered).toBe(false);
    p.step(1 / 60);
    await p.flush();
    const hit = await asked;
    expect(hit.dist).toBeCloseTo(5, 4);
    expect(hit.body).toBe(floor);
    p.dispose();
  });

  it('a query left unanswered at dispose resolves undefined, as a refused query does', async () => {
    const p = await createWorkerPhysics({ make: () => fakeWorker() });
    const asked = p.query('ray', [0, 5, 0], [0, -1, 0], 20);
    p.dispose();
    expect(await asked).toBe(undefined);
  });

  it('hands a body its hits, and pushes reach the worker', async () => {
    const p = await createWorkerPhysics({ make: () => fakeWorker() });
    p.add(GROUND);
    const hits = [];
    const b = p.add(BALL([0, 4, 0], { onHit: (force, at) => hits.push([force, at]) }));
    await frames(p, 60);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0][1]).toHaveLength(3);
    expect(b.push([0, 30, 0])).toBe(true);
    expect(b.push([NaN, 0, 0])).toBe(false);
    await frames(p, 10);
    expect(b.position()[1]).toBeGreaterThan(1);
    p.dispose();
  });

  it('moves its bodies by an origin shift at once, and tells its listeners', async () => {
    const p = await createWorkerPhysics({ make: () => fakeWorker() });
    const b = p.add(BALL([10, 5, 0], { canSleep: false }));
    await frames(p, 1);
    const seen = [];
    p.onOriginShift((s) => seen.push(s));
    const was = b.position();
    p.onOrigin([10, 0, 0]);
    expect(b.position()[0]).toBeCloseTo(was[0] - 10, 5);
    expect(seen).toEqual([[10, 0, 0]]);
    await frames(p, 1);
    expect(b.position()[0]).toBeCloseTo(0, 3);
    p.dispose();
  });

  it('a desc it cannot build comes back as an error, and its handle is removed', async () => {
    const errors = [];
    const p = await createWorkerPhysics({ make: () => fakeWorker(), onError: (e) => errors.push(e) });
    const bad = p.add({ position: [0, 0, 0], colliders: [{ shape: 'blob' }] });
    await frames(p, 1);
    expect(bad.removed).toBe(true);
    expect(String(errors[0]?.message)).toMatch("no shape 'blob'");
    p.dispose();
  });

  it('a worker that dies mid-run is reported, and the world steps nothing more', async () => {
    const errors = [];
    const w = fakeWorker();
    const p = await createWorkerPhysics({ make: () => w, onError: (e) => errors.push(e) });
    w.crash(new Error('out of memory'));
    expect(errors[0].message).toMatch('out of memory');
    expect(p.status().worker).toBe(false);
    expect(p.step(1 / 60)).toBe(0);
    p.dispose();
  });
});

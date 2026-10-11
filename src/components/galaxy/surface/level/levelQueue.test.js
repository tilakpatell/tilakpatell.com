import { describe, expect, it } from 'vitest';
import { CLASSES, createFetchQueue } from './levelQueue.js';

// a fetch whose answers the test hands out, one path at a time
function fakeFetch(size = 100) {
  const waiting = new Map();
  const asked = [];
  const fetch = (path, { signal } = {}) =>
    new Promise((resolve, reject) => {
      asked.push(path);
      waiting.set(path, { resolve, reject });
      signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
  const give = (path) => {
    waiting.get(path)?.resolve(new ArrayBuffer(size));
    waiting.delete(path);
  };
  const fail = (path) => {
    waiting.get(path)?.reject(new Error('404'));
    waiting.delete(path);
  };
  return { fetch, asked, give, fail, waiting };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('createFetchQueue', () => {
  it('asks the classes in order, coarse to prefetch, the highest rank first within one', () => {
    const f = fakeFetch();
    const q = createFetchQueue({ fetch: f.fetch, parallel: 1 });
    q.get('detail-small', { cls: 'detail', rank: () => 0.1 });
    q.get('detail-big', { cls: 'detail', rank: () => 0.9 });
    q.get('prefetch', { cls: 'prefetch' });
    q.get('boot', { cls: 'boot' });
    q.get('coarse', { cls: 'coarse' });
    // (the first ask goes at once; the rest wait their turn)
    expect(f.asked).toEqual(['detail-small']);
    const order = [];
    const drain = async () => {
      while (f.waiting.size) {
        const [p] = f.waiting.keys();
        order.push(p);
        f.give(p);
        await tick();
      }
    };
    return drain().then(() => {
      expect(order).toEqual(['detail-small', 'coarse', 'boot', 'detail-big', 'prefetch']);
      expect(CLASSES).toEqual(['coarse', 'boot', 'cell', 'detail', 'prefetch']);
    });
  });

  it('asks a path once, however many want it, and counts its bytes once', async () => {
    const f = fakeFetch(250);
    const q = createFetchQueue({ fetch: f.fetch });
    const a = q.get('x.glb', { cls: 'detail' });
    const b = q.get('x.glb', { cls: 'detail' });
    f.give('x.glb');
    const [ba, bb] = await Promise.all([a, b]);
    expect(ba).toBe(bb);
    expect(f.asked).toEqual(['x.glb']);
    expect(q.bytes()).toBe(250);
  });

  it('moves a queued ask up when a higher class wants it', async () => {
    const f = fakeFetch();
    const q = createFetchQueue({ fetch: f.fetch, parallel: 1 });
    q.get('first', { cls: 'boot' });
    q.get('ahead.bin', { cls: 'prefetch' });
    q.get('d', { cls: 'detail' });
    q.get('ahead.bin', { cls: 'boot' });
    f.give('first');
    await tick();
    expect(f.asked[1]).toBe('ahead.bin');
  });

  it('abandons queued prefetches at the queue, never one in flight (it lands and is kept)', async () => {
    const f = fakeFetch();
    const q = createFetchQueue({ fetch: f.fetch, parallel: 1 });
    const flying = q.get('ahead-1', { cls: 'prefetch', tag: 'ahead' });
    const queued = q.get('ahead-2', { cls: 'prefetch', tag: 'ahead' });
    expect(q.abandon((item) => item.tag === 'ahead')).toBe(1);
    await expect(queued).resolves.toBeNull();
    f.give('ahead-1');
    expect(await flying).toBeInstanceOf(ArrayBuffer);
    await tick();
    expect(f.asked).toEqual(['ahead-1']);
    // (and asked for again, it is the kept bytes, not another download)
    const again = await q.get('ahead-1', { cls: 'detail' });
    expect(again).toBeInstanceOf(ArrayBuffer);
    expect(f.asked).toEqual(['ahead-1']);
  });

  it('holds the classes it is told to hold, and lets them go again', async () => {
    const f = fakeFetch();
    const q = createFetchQueue({ fetch: f.fetch });
    q.hold(['detail', 'prefetch']);
    const d = q.get('finer.ktx2', { cls: 'detail' });
    q.get('cells/0_0.bin', { cls: 'cell' });
    expect(f.asked).toEqual(['cells/0_0.bin']);
    expect(q.pending('detail')).toBe(1);
    q.hold([]);
    expect(f.asked).toEqual(['cells/0_0.bin', 'finer.ktx2']);
    f.give('finer.ktx2');
    expect(await d).toBeInstanceOf(ArrayBuffer);
  });

  it('passes a failure on and keeps going', async () => {
    const f = fakeFetch();
    const q = createFetchQueue({ fetch: f.fetch, parallel: 1 });
    const bad = q.get('missing', { cls: 'boot' });
    q.get('next', { cls: 'boot' });
    f.fail('missing');
    await expect(bad).rejects.toThrow('404');
    await tick();
    expect(f.asked).toEqual(['missing', 'next']);
    expect(q.pending('boot')).toBe(1);
  });

  it('counts what waits and flies by class', () => {
    const f = fakeFetch();
    const q = createFetchQueue({ fetch: f.fetch, parallel: 1 });
    q.get('a', { cls: 'boot' });
    q.get('b', { cls: 'boot' });
    q.get('c', { cls: 'detail' });
    expect(q.pending('boot')).toBe(2);
    expect(q.pending()).toBe(3);
  });

  it('asks nothing more once disposed, and its waiting asks end as null', async () => {
    const f = fakeFetch();
    const q = createFetchQueue({ fetch: f.fetch, parallel: 1 });
    q.get('a', { cls: 'boot' });
    const b = q.get('b', { cls: 'boot' });
    q.dispose();
    await expect(b).resolves.toBeNull();
    expect(await q.get('c', { cls: 'boot' })).toBeNull();
    expect(f.asked).toEqual(['a']);
  });
});

describe('a fetch that never answers (lane N4)', () => {
  it('fails after its timeout and frees its slot, and a late answer is dropped', async () => {
    const f = fakeFetch();
    let fire = null;
    const timer = (fn) => {
      fire = fn;
      return 1;
    };
    let t = 0;
    const q = createFetchQueue({ fetch: f.fetch, parallel: 1, timeout: () => 1000, setTimer: timer, clearTimer: () => {}, now: () => t });
    const stuck = q.get('stuck', { cls: 'coarse' });
    t = 1000;
    q.get('next', { cls: 'boot' });
    expect(f.asked).toEqual(['stuck']);
    fire();
    await expect(stuck).rejects.toThrow(/did not answer/);
    await tick();
    expect(f.asked).toEqual(['stuck', 'next']);
    f.give('stuck');
    await tick();
    expect(q.bytes()).toBe(0);
  });
});

describe('a main thread too busy to hear the answer (lane N4)', () => {
  it('gives an ask whose timer fired late (the page was drawing) another full wait, not a failure', async () => {
    const f = fakeFetch();
    const fires = [];
    let t = 0;
    const q = createFetchQueue({ fetch: f.fetch, parallel: 1, timeout: () => 1000, setTimer: (fn) => fires.push(fn), clearTimer: () => {}, now: () => t });
    const slow = q.get('slow', { cls: 'boot' });
    // (the timer meant for 1 s fires at 18 s: a software GL's frame held the thread)
    t = 18000;
    fires.shift()();
    expect(fires).toHaveLength(1);
    f.give('slow');
    expect(await slow).toBeInstanceOf(ArrayBuffer);
  });
});

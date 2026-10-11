import { describe, expect, it } from 'vitest';
import { decodePoses, HEADER } from './poses.js';
import { serve } from './worker.js';

// worker.js's side alone, spoken to as the page speaks to it: messages in,
// the poses and answers out (workerClient.test.js runs both sides together)
function scope() {
  const out = [];
  const s = { onmessage: null, postMessage: (msg) => out.push(msg) };
  serve(s);
  const send = (msg) => s.onmessage({ data: msg });
  const next = async (type) => {
    for (let i = 0; i < 200; i++) {
      const at = out.findIndex((m) => m.type === type);
      if (at >= 0) return out.splice(at, 1)[0];
      await new Promise((r) => setTimeout(r, 5));
    }
    throw new Error(`no ${type}`);
  };
  return { send, next };
}

describe('the physics worker', () => {
  it('comes up, takes what came before it was ready, and steps into the buffer it was sent', async () => {
    const w = scope();
    w.send({ type: 'init', opts: {} });
    w.send({ type: 'add', id: 1, desc: { type: 'fixed', position: [0, -0.5, 0], group: 'floor', colliders: [{ shape: 'cuboid', args: [10, 0.5, 10] }] } });
    w.send({ type: 'add', id: 2, desc: { position: [0, 2, 0], colliders: [{ shape: 'ball', args: [0.5] }] } });
    await w.next('ready');
    const buf = new Float32Array(HEADER + 8 * 4);
    w.send({ type: 'step', dt: 1 / 60, buf, queries: [{ qid: 1, kind: 'ray', args: [[3, 5, 0], [0, -1, 0], 10] }] });
    const got = await w.next('poses');
    expect(got.buf).toBe(buf);
    expect(got.steps).toBe(1);
    const poses = decodePoses(got.buf);
    expect([...poses.keys()]).toEqual([2]); // (the fixed floor never moves: no row)
    expect(poses.get(2).position[1]).toBeLessThan(2);
    expect(got.answers[0].qid).toBe(1);
    expect(got.answers[0].value.body).toBe(1);
    expect(got.answers[0].value.dist).toBeCloseTo(5, 4);
  });

  it('a removed body has no row from the next step', async () => {
    const w = scope();
    w.send({ type: 'init', opts: {} });
    await w.next('ready');
    w.send({ type: 'add', id: 5, desc: { position: [0, 2, 0], colliders: [{ shape: 'ball', args: [0.5] }] } });
    w.send({ type: 'add', id: 6, desc: { position: [2, 2, 0], colliders: [{ shape: 'ball', args: [0.5] }] } });
    w.send({ type: 'remove', id: 5 });
    w.send({ type: 'step', dt: 1 / 60, buf: new Float32Array(HEADER) });
    const poses = decodePoses((await w.next('poses')).buf);
    expect(poses.has(5)).toBe(false);
    expect(poses.has(6)).toBe(true);
  });

  it('says it failed when its engine will not come up', async () => {
    const out = [];
    const s = { onmessage: null, postMessage: (msg) => out.push(msg) };
    serve(s, { create: () => Promise.reject(new Error('wasm blocked')) });
    s.onmessage({ data: { type: 'init', opts: {} } });
    await new Promise((r) => setTimeout(r, 10));
    expect(out).toEqual([{ type: 'failed', message: 'wasm blocked' }]);
  });
});

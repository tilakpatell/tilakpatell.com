import { afterAll, describe, expect, it } from 'vitest';
import { roundSpec } from './fixtures/generated';

// the worker as the page sees it: a message in, one answer out
const posted = [];
globalThis.self = { postMessage: (data, transfer) => posted.push({ data, transfer }) };
await import('./orbitMap.worker.js');
afterAll(() => delete globalThis.self);
const ask = (msg) => {
  posted.length = 0;
  globalThis.self.onmessage({ data: msg });
  return posted[0];
};

describe('the orbit-map worker', () => {
  it('answers a bake with its buffers handed over', () => {
    const out = ask({ key: 'k', spec: roundSpec(), width: 16, height: 8 });
    expect(out.data).toMatchObject({ key: 'k', width: 16, height: 8 });
    expect(out.data.rgba).toHaveLength(16 * 8 * 4);
    expect(out.data.biome).toHaveLength(16 * 8);
    expect(out.transfer).toEqual([out.data.rgba.buffer, out.data.biome.buffer]);
  });

  it('says nothing to a cancel', () => {
    expect(ask({ type: 'cancel', key: 'k' })).toBeUndefined();
  });
});

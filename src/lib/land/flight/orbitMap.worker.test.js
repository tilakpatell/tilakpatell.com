import { afterAll, describe, expect, it } from 'vitest';
import { roundSpec } from './fixtures/generated';

// the orbit-map worker as the page sees it: a message in, one answer out
const posted = [];
globalThis.self = { postMessage: (data, transfer) => posted.push({ data, transfer }) };
await import('./orbitMap.worker.js');
afterAll(() => delete globalThis.self);

describe('the orbit-map worker', () => {
  it('answers a bake with its buffers handed over', () => {
    posted.length = 0;
    const spec = roundSpec();
    globalThis.self.onmessage({ data: { key: 'k', spec, width: 16, height: 8 } });
    const out = posted[0];
    expect(out.data).toMatchObject({ key: 'k', width: 16, height: 8 });
    expect(out.data.rgba.length).toBe(16 * 8 * 4);
    expect(out.data.biome.length).toBe(16 * 8);
    expect(out.transfer).toEqual([out.data.rgba.buffer, out.data.biome.buffer]);
  });

  it('says nothing to a cancel', () => {
    posted.length = 0;
    globalThis.self.onmessage({ data: { type: 'cancel', key: 'k' } });
    expect(posted).toEqual([]);
  });
});

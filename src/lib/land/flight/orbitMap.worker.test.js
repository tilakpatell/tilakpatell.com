import { afterAll, describe, expect, it } from 'vitest';
import { bakeOrbitMap } from './orbitMap';
import { roundSpec } from './fixtures/generated';

// the orbit map's worker as the page sees it: a message in, one answer out
const posted = [];
globalThis.self = { postMessage: (data, transfer) => posted.push({ data, transfer }) };
await import('./orbitMap.worker.js');
afterAll(() => delete globalThis.self);
const ask = (msg) => {
  posted.length = 0;
  globalThis.self.onmessage({ data: msg });
  return posted;
};

describe('the orbit map’s worker', () => {
  const spec = roundSpec();

  it('answers a bake with its buffers handed over', () => {
    const [out] = ask({ key: `${spec.id}:16x8`, spec, width: 16, height: 8 });
    expect(out.data).toEqual({ key: `${spec.id}:16x8`, ...bakeOrbitMap(spec, { width: 16, height: 8 }) });
    expect(out.transfer).toEqual([out.data.rgba.buffer, out.data.biome.buffer]);
  });

  it('says nothing to a cancel', () => {
    expect(ask({ type: 'cancel', key: `${spec.id}:16x8` })).toEqual([]);
  });

  it('answers a bake it can’t make with its key alone, and lives on', () => {
    expect(ask({ key: 'nothing:16x8', spec: null, width: 16, height: 8 }).map((p) => p.data)).toEqual([{ key: 'nothing:16x8' }]);
    expect(ask({ key: 'bad:16x8', spec: { ...spec, character: null }, width: 16, height: 8 }).map((p) => p.data)).toEqual([{ key: 'bad:16x8' }]);
    expect(ask({ key: 'again', spec, width: 4, height: 2 })[0].data.rgba).toHaveLength(4 * 2 * 4);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { createRuntime } from './runtime';

// The renderer tier asked once a page before a 'nodes' world is made (the
// GPU-first design's G1). Beside runtime.test.js, which is past the rules'
// 800 lines already: its stand-ins, cut down to what a mount needs.
const fakeBackend = () => ({ backend: 'webgpu', renderer: {}, canvas: { parentNode: null }, size: { w: 1, h: 1 }, setSize: vi.fn(), setRatio: vi.fn(), snapshot: vi.fn(), lost: false, dispose: vi.fn() });
const fakeHost = () => ({ prepend: vi.fn(), getBoundingClientRect: () => ({ width: 640, height: 360 }) });
const fakeWorld = () => ({ resize: vi.fn(), draw: vi.fn(), dispose: vi.fn() });

function make(tier) {
  const makeBackend = vi.fn(() => fakeBackend());
  const input = { attach: vi.fn(), detach: vi.fn(), unbind: vi.fn(), sample: vi.fn() };
  const quality = { frame: () => null, ratio: 1, budget: {}, level: 0 };
  const loop = () => ({ kick: vi.fn(), stop: vi.fn() });
  const rt = createRuntime({ makeBackend, loop, input, quality, audio: {}, assets: {}, gpu: true, tier });
  return rt;
}
const nodes = (id, seen) => ({ id, shading: 'nodes', create: (rt) => (seen?.push(rt.tier), fakeWorld()) });

describe('the renderer tier', () => {
  it('is asked once a page, before the first nodes world is made, and held as rt.tier', async () => {
    const tier = vi.fn(async () => 'T1');
    const rt = make(tier);
    expect(rt.tier).toBeNull();
    const seen = [];
    await rt.mount(nodes('a', seen), {}, fakeHost());
    await rt.mount(nodes('b', seen), {}, fakeHost());
    expect(tier).toHaveBeenCalledTimes(1);
    expect(tier).toHaveBeenCalledWith(rt.gfx);
    // (the world is made with the tier already known)
    expect(seen).toEqual(['T1', 'T1']);
    expect(rt.tier).toBe('T1');
  });

  it('keeps the reason a decider gives with it: rt.tierWhy', async () => {
    const rt = make(vi.fn(async () => ({ tier: 'T0', why: 'features' })));
    const seen = [];
    await rt.mount(nodes('a', seen), {}, fakeHost());
    expect(seen).toEqual(['T0']);
    expect(rt.tier).toBe('T0');
    expect(rt.tierWhy).toBe('features');
    // (a bare tier, as before: no reason)
    const plain = make(vi.fn(async () => 'T1'));
    await plain.mount(nodes('b'), {}, fakeHost());
    expect(plain.tierWhy).toBeNull();
  });

  it('is never asked for a classic world', async () => {
    const tier = vi.fn(async () => 'T2');
    const rt = make(tier);
    await rt.mount({ id: 'g', shading: 'glsl', create: fakeWorld }, {}, fakeHost());
    expect(tier).not.toHaveBeenCalled();
    expect(rt.tier).toBeNull();
  });

  it('is shared by two mounts at once: one probe', async () => {
    let answer;
    const tier = vi.fn(() => new Promise((r) => (answer = r)));
    const rt = make(tier);
    const a = rt.mount(nodes('a'), {}, fakeHost());
    const b = rt.mount(nodes('b'), {}, fakeHost());
    await new Promise((r) => setTimeout(r, 0));
    answer('T0');
    expect(await a).toBe(false);
    expect(await b).toBe(true);
    expect(tier).toHaveBeenCalledTimes(1);
    expect(rt.current.module.id).toBe('b');
  });

  it('costs nothing but the tier when the asking fails: the world still comes up', async () => {
    const rt = make(vi.fn(async () => { throw new Error('no adapter'); }));
    expect(await rt.mount(nodes('a'), {}, fakeHost())).toBe(true);
    expect(rt.tier).toBeNull();
  });

  it('is not asked at all without a decider (Node, the tests)', async () => {
    const rt = make(null);
    expect(await rt.mount(nodes('a'), {}, fakeHost())).toBe(true);
    expect(rt.tier).toBeNull();
  });
});

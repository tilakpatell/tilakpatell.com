import { describe, expect, it, vi } from 'vitest';
import { createRuntime } from './runtime';

// A module's `antialias`: the classic canvas made multisampled or not as it
// says (Middle-earth's stages drew on canvases of their own without), and
// made again when the next module asks otherwise. Beside runtime.test.js,
// which is past the rules' 800 lines: its stand-ins, cut down.
const fakeBackend = () => ({ backend: 'webgl', renderer: {}, canvas: { parentNode: null }, size: { w: 1, h: 1 }, setSize: vi.fn(), setRatio: vi.fn(), snapshot: vi.fn(), lost: false, dispose: vi.fn() });
const fakeHost = () => ({ prepend: vi.fn(), getBoundingClientRect: () => ({ width: 640, height: 360 }) });
const fakeWorld = () => ({ resize: vi.fn(), draw: vi.fn(), dispose: vi.fn() });

function make() {
  const makeBackend = vi.fn(() => fakeBackend());
  const input = { attach: vi.fn(), detach: vi.fn(), unbind: vi.fn(), sample: vi.fn() };
  const quality = { frame: () => null, ratio: 1, budget: { antialias: true, samples: 4 }, level: 0 };
  const loop = () => ({ kick: vi.fn(), stop: vi.fn() });
  const rt = createRuntime({ makeBackend, loop, input, quality, audio: {}, assets: {} });
  return { rt, makeBackend };
}
const world = (id, antialias) => ({ id, shading: 'glsl', ...(antialias === undefined ? {} : { antialias }), create: fakeWorld });

describe('a module’s antialias', () => {
  it('makes the classic canvas as the module says, the budget’s otherwise', async () => {
    const { rt, makeBackend } = make();
    await rt.mount(world('a', false), {}, fakeHost());
    expect(makeBackend.mock.calls[0][1].budget).toMatchObject({ antialias: false, samples: 4 });
    const plain = make();
    await plain.rt.mount(world('b'), {}, fakeHost());
    expect(plain.makeBackend.mock.calls[0][1].budget.antialias).toBe(true);
  });

  it('keeps the canvas for a module asking the same, and makes it again for one asking otherwise', async () => {
    const { rt, makeBackend } = make();
    await rt.mount(world('a', false), {}, fakeHost());
    await rt.mount(world('b', false), {}, fakeHost());
    expect(makeBackend).toHaveBeenCalledTimes(1);
    const first = rt.gfx;
    await rt.mount(world('c'), {}, fakeHost());
    expect(makeBackend).toHaveBeenCalledTimes(2);
    expect(first.dispose).toHaveBeenCalled();
  });
});

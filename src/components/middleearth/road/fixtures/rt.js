// The runtime, stood in for in the Road’s tests: a renderer that draws
// nothing, and the rest of what a world may reach (the shape the other
// modules’ tests use).
import { vi } from 'vitest';

const store = () => {
  const m = new Map();
  return { get: (k, fb = null) => (m.has(k) ? m.get(k) : fb), set: (k, v) => m.set(k, v), map: m };
};

export const fakeRt = () => {
  const emitted = [];
  return {
    emitted,
    saves: store(),
    events: { emit: (type, data) => emitted.push({ type, ...data }) },
    input: { bind: vi.fn(), setStick: vi.fn() },
    quality: { tier: 'high', level: 0 },
    assets: { owner: () => ({ gltf: vi.fn(), release: vi.fn() }) },
    audio: { bus: () => null },
    gfx: { renderer: { render: vi.fn() }, compile: () => Promise.resolve() },
  };
};

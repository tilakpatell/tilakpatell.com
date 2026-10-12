import { describe, expect, it, vi } from 'vitest';
import { lazyBrowser } from './lazyBrowser';

describe('the runtime’s browser parts, loaded on the first mount', () => {
  it('hands the runtime lane G1’s GPU clock once the first backend has brought the parts in', async () => {
    const clock = { available: true };
    const parts = { makeBackend: () => ({ renderer: { webgpu: true } }), gpuClock: vi.fn(() => clock) };
    const lazy = lazyBrowser(() => Promise.resolve(parts));
    const renderer = { webgpu: true };
    expect(lazy.gpuClock(renderer)).toBe(null); // (nothing in yet)
    expect(await lazy.load()).toBe(parts);
    expect(lazy.gpuClock(renderer)).toBe(clock);
    expect(parts.gpuClock).toHaveBeenCalledWith(renderer);
  });

  it('is null where the parts give no clock', async () => {
    const lazy = lazyBrowser(() => Promise.resolve({}));
    await lazy.load();
    expect(lazy.gpuClock({})).toBe(null);
  });
});

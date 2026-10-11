import { describe, expect, it, vi } from 'vitest';
import { createGpuTime } from './gpuTime';

// A renderer as three r186's WebGPURenderer shows itself to the clock:
// hasFeature after init, its backend's trackTimestamp, resolveTimestampsAsync
// and info.render.timestamp (ms) written by the resolve.
function fakeRenderer({ timestamps = true, feed = [] } = {}) {
  const queue = [...feed];
  const renderer = {
    backend: { trackTimestamp: false },
    info: { render: { timestamp: 0 } },
    hasFeature: (name) => timestamps && name === 'timestamp-query',
    resolveTimestampsAsync: vi.fn(async () => {
      const ms = queue.shift() ?? 0;
      renderer.info.render.timestamp = ms;
      return ms;
    }),
  };
  return renderer;
}

describe('the frame’s GPU time', () => {
  it('answers null on an adapter without timestamp-query, and never asks for a resolve', async () => {
    const r = fakeRenderer({ timestamps: false });
    const clock = createGpuTime(r);
    expect(clock.available).toBe(false);
    await clock.frame();
    expect(r.resolveTimestampsAsync).not.toHaveBeenCalled();
    expect(r.backend.trackTimestamp).toBe(false);
    expect([clock.median, clock.p95, clock.last]).toEqual([null, null, null]);
  });

  it('answers null on a renderer that cannot say (no hasFeature)', () => {
    const clock = createGpuTime({ backend: {} });
    expect(clock.available).toBe(false);
    expect(clock.median).toBeNull();
  });

  it('turns the backend’s tracking on, since r186 reads trackTimestamp there and not on the renderer', () => {
    const r = fakeRenderer();
    createGpuTime(r);
    expect(r.backend.trackTimestamp).toBe(true);
  });

  it('keeps the last 32 frames: the median and p95 of 1…32 are 16.5 and 31', async () => {
    const r = fakeRenderer({ feed: Array.from({ length: 33 }, (_, i) => i + 1) });
    const clock = createGpuTime(r);
    for (let i = 0; i < 32; i++) await clock.frame();
    expect(r.resolveTimestampsAsync).toHaveBeenCalledWith('render');
    expect(clock.median).toBe(16.5);
    expect(clock.p95).toBe(31);
    expect(clock.last).toBe(32);
    expect(clock.count).toBe(32);
    // a 33rd pushes the first out: 2…33
    await clock.frame();
    expect(clock.median).toBe(17.5);
    expect(clock.p95).toBe(32);
    expect(clock.last).toBe(33);
    expect(clock.count).toBe(32);
  });

  it('pushes nothing for a resolve with no frame behind it (three answers 0 or its last value)', async () => {
    const r = fakeRenderer({ feed: [4, 0, undefined] });
    r.resolveTimestampsAsync.mockImplementationOnce(async () => 4).mockImplementationOnce(async () => 0).mockImplementationOnce(async () => undefined);
    const clock = createGpuTime(r);
    await clock.frame();
    await clock.frame();
    await clock.frame();
    expect(clock.count).toBe(1);
    expect(clock.last).toBe(4);
  });

  it('asks for one resolve at a time: a frame while one is in flight shares it', async () => {
    const r = fakeRenderer();
    let finish;
    r.resolveTimestampsAsync.mockImplementation(() => new Promise((res) => (finish = () => res(5))));
    const clock = createGpuTime(r);
    const a = clock.frame();
    const b = clock.frame();
    finish();
    await Promise.all([a, b]);
    expect(r.resolveTimestampsAsync).toHaveBeenCalledTimes(1);
    expect(clock.count).toBe(1);
  });

  it('keeps a smaller ring when asked, and reset empties it', async () => {
    const r = fakeRenderer({ feed: [1, 2, 3, 4] });
    const clock = createGpuTime(r, { frames: 3 });
    for (let i = 0; i < 4; i++) await clock.frame();
    expect(clock.median).toBe(3);
    clock.reset();
    expect(clock.median).toBeNull();
  });

  it('survives a resolve that throws (a lost device): the ring is as it was', async () => {
    const r = fakeRenderer();
    r.resolveTimestampsAsync.mockRejectedValueOnce(new Error('device lost'));
    const clock = createGpuTime(r);
    await expect(clock.frame()).resolves.toBeUndefined();
    expect(clock.median).toBeNull();
  });
});

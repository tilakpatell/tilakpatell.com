import { describe, expect, it } from 'vitest';
import { ENGINE, bootPaths, warm } from './bf2web-warm.mjs';

describe('the post-deploy warm-up', () => {
  it('asks for the page, the engine module and its wasm, the file list, and what the page itself loads first', () => {
    const html = '<script src="original-frame-graph.js"></script><link rel="modulepreload" href="runtime/world-play.mjs">'
      + '<script src="https://static.cloudflareinsights.com/beacon.min.js"></script><link href="/ui/main.css"><script src="data:,x"></script>'
      // (the live r1074 page's inline module: two static imports, the rest dynamic and later)
      + "<script type=\"module\">import {start} from './runtime/world-startup.mjs'; import * as gpu from './web-renderer-gpu.js'; import('./runtime/world-play.mjs');</script>";
    expect(bootPaths('r1074-a2d368b1', html)).toEqual([
      `${ENGINE}r1074-a2d368b1/`, `${ENGINE}r1074-a2d368b1/original-frame-graph.js`, `${ENGINE}r1074-a2d368b1/original-frame-graph.wasm`,
      `${ENGINE}r1074-a2d368b1/tp-files.json`, `${ENGINE}r1074-a2d368b1/runtime/world-play.mjs`,
      `${ENGINE}r1074-a2d368b1/runtime/world-startup.mjs`, `${ENGINE}r1074-a2d368b1/web-renderer-gpu.js`,
    ]);
    expect(bootPaths('b')).toHaveLength(4);
  });

  it('spreads each round\'s asks evenly over the boot files, at least one ask per file', async () => {
    const seen = [];
    const r = await warm({ paths: ['/a', '/b', '/c'], rounds: 1, parallel: 6, fast: 1500,
      ask: async (path) => { seen.push(path); return { path, status: 200, ttfb: 80 }; }, log: () => {}, now: () => 0 });
    expect(r).toMatchObject({ warm: true, rounds: 1 });
    expect(['/a', '/b', '/c'].map((p) => seen.filter((s) => s === p).length)).toEqual([2, 2, 2]);
    const few = [];
    await warm({ paths: ['/a', '/b', '/c'], rounds: 1, parallel: 1, ask: async (path) => { few.push(path); return { path, status: 200, ttfb: 1 }; }, log: () => {}, now: () => 0 });
    expect(few.sort()).toEqual(['/a', '/b', '/c']);
  });

  it('counts a slow, failed or unanswered ask against the streak, and gives up after max seconds', async () => {
    let t = 0, n = 0;
    const answers = [{ status: 200, ttfb: 50 }, { status: 503, ttfb: 40 }, { status: null, ttfb: null, error: 'timeout' }, { status: 200, ttfb: 9000 }];
    const r = await warm({ paths: ['/x'], rounds: 2, parallel: 1, fast: 1500, maxSeconds: 30,
      ask: async (path) => ({ path, ...answers[n++ % answers.length] }), log: () => {}, now: () => (t += 10_000) });
    expect(r.warm).toBe(false);
    expect(r.history.map((h) => h.slow)).toEqual([0, 1, 1, 1]);
  });

  it('stops at the first streak of fast rounds after a cold start', async () => {
    let calls = 0;
    const r = await warm({ paths: ['/x', '/y'], rounds: 2, parallel: 2, fast: 1500,
      ask: async (path) => ({ path, status: 200, ttfb: ++calls <= 4 ? 5000 : 100 }), log: () => {}, now: () => 0 });
    expect(r).toMatchObject({ warm: true, rounds: 4 });
    expect(r.history.map((h) => h.slow)).toEqual([2, 2, 0, 0]);
  });
});

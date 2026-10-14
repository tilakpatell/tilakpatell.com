import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createHulls } from './hulls.js';

// a real hull's bytes (a few KB, committed), as a fresh ArrayBuffer each time
const BIN = readFileSync(new URL('../../../scripts/fixtures/bf2017/physics/destroyer-hull.bin', import.meta.url));
const bytes = () => BIN.buffer.slice(BIN.byteOffset, BIN.byteOffset + BIN.byteLength);
const later = () => new Promise((r) => setTimeout(r, 0));

describe('createHulls', () => {
  it('get is null before the load resolves and a Hull after', async () => {
    let done;
    const load = vi.fn(() => new Promise((r) => (done = r)));
    const hulls = createHulls({ load });
    hulls.want(['xwing']);
    expect(hulls.get('xwing')).toBeNull();
    done(bytes());
    await later();
    expect(hulls.get('xwing')?.rays.count).toBeGreaterThan(0);
    expect(load.mock.calls[0][0]).toBe('/models/galaxy/hulls/xwing.bin');
  });

  it('a load rejecting missing leaves get null, is logged once and does not reject', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const hulls = createHulls({ load: () => Promise.reject(Object.assign(new Error('404'), { missing: true })) });
    expect(() => hulls.want(['xwing'])).not.toThrow();
    hulls.want(['xwing']);
    await later();
    expect(hulls.get('xwing')).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('a malformed hull is a failed fetch: null, logged, nothing thrown', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const hulls = createHulls({ load: () => Promise.resolve(new ArrayBuffer(8)) });
    hulls.want(['tie']);
    await later();
    expect(hulls.get('tie')).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('a kind wanted twice is fetched once', async () => {
    const load = vi.fn(() => Promise.resolve(bytes()));
    const hulls = createHulls({ load });
    hulls.want(['xwing', 'xwing']);
    hulls.want(['xwing']);
    await later();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('hq rows load hq/nebulon, and the special keys load as given', async () => {
    const load = vi.fn(() => Promise.resolve(bytes()));
    const hulls = createHulls({ load, models: { nebulon: { hq: true }, xwing: {} } });
    hulls.want(['nebulon', 'xwing', 'hunter/slave1']);
    await later();
    expect(load.mock.calls.map((c) => c[0]).sort()).toEqual(['/models/galaxy/hulls/hq/nebulon.bin', '/models/galaxy/hulls/hunter/slave1.bin', '/models/galaxy/hulls/xwing.bin']);
    expect(hulls.get('nebulon')).not.toBeNull();
    expect(hulls.get('hq/nebulon')).not.toBeNull();
  });

  it('a kind with no hull is not asked for', async () => {
    const load = vi.fn(() => Promise.resolve(bytes()));
    const hulls = createHulls({ load });
    hulls.want(['deathstar', 'nonesuch']);
    await later();
    expect(load).not.toHaveBeenCalled();
    expect(hulls.get('deathstar')).toBeNull();
  });

  it('dispose stops the loads, and a late answer reaches nothing', async () => {
    let signal;
    let done;
    const hulls = createHulls({ load: (p, o) => ((signal = o.signal), new Promise((r) => (done = r))) });
    hulls.want(['xwing']);
    hulls.dispose();
    expect(signal.aborted).toBe(true);
    done(bytes());
    await later();
    expect(hulls.get('xwing')).toBeNull();
  });
});

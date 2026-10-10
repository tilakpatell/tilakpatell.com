import { describe, expect, it, vi } from 'vitest';
import { createAssetFetch, poolSize } from './assetFetch';

const bytes = (n, headers = {}) => new Response(new Uint8Array(n), { status: 200, headers: { 'content-length': String(n), ...headers } });
const status = (code, headers = {}) => new Response(null, { status: code, headers });
const tick = () => new Promise((r) => setTimeout(r, 0));

// a fetch whose answers the test hands out, one URL at a time
function held() {
  const calls = [];
  const fetch = vi.fn(
    (url, init) =>
      new Promise((resolve, reject) => {
        const call = { url, init, resolve, reject };
        calls.push(call);
        init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      }),
  );
  return { fetch, calls, answer: (url, res) => calls.find((c) => c.url === url && !c.done && (c.done = true))?.resolve(res) };
}
const quick = (fetch, rest = {}) => createAssetFetch({ fetch, sleep: async () => {}, ...rest });

describe('the site’s asset pool', () => {
  it('holds a third request until one of two in flight is done', async () => {
    const h = held();
    const pool = quick(h.fetch, { size: 2 });
    const a = pool.fetch('/a');
    pool.fetch('/b');
    pool.fetch('/c');
    await tick();
    expect(h.calls.map((c) => c.url)).toEqual(['/a', '/b']);
    h.answer('/a', bytes(1));
    await a;
    await tick();
    expect(h.calls.map((c) => c.url)).toEqual(['/a', '/b', '/c']);
  });

  it('asks for the nearest first: a higher priority before a lower one queued earlier', async () => {
    const h = held();
    const pool = quick(h.fetch, { size: 1 });
    pool.fetch('/first');
    pool.fetch('/prop', { priority: 0 });
    pool.fetch('/hero', { priority: 5 });
    await tick();
    h.answer('/first', bytes(1));
    await tick();
    await tick();
    expect(h.calls.map((c) => c.url)).toEqual(['/first', '/hero']);
  });

  it('makes one request for two callers of one URL, and both get it', async () => {
    const h = held();
    const pool = quick(h.fetch);
    const one = pool.fetch('/x');
    const two = pool.fetch('/x');
    await tick();
    h.answer('/x', bytes(3));
    expect((await one).byteLength).toBe(3);
    expect((await two).byteLength).toBe(3);
    expect(h.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries a short body on the schedule, then rejects', async () => {
    const waits = [];
    const fetch = vi.fn(async () => new Response(new Uint8Array(10), { headers: { 'content-length': '100' } }));
    const pool = createAssetFetch({ fetch, sleep: async (ms) => void waits.push(ms) });
    await expect(pool.fetch('/x')).rejects.toThrow(/short/);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(waits).toEqual([500, 1000, 2000]);
  });

  it('holds a body to the bytes it was told, though the response says nothing', async () => {
    const fetch = vi.fn(async () => new Response(new Uint8Array(10)));
    await expect(quick(fetch).fetch('/x', { bytes: 50 })).rejects.toThrow(/short/);
  });

  it('retries a fault and a 5xx, waits what a 429 asks, and takes a 404 as final', async () => {
    const waits = [];
    const answers = [new Error('reset'), status(503), status(429, { 'retry-after': '3' }), bytes(2)];
    const fetch = vi.fn(async () => {
      const a = answers.shift();
      if (a instanceof Error) throw a;
      return a;
    });
    const pool = createAssetFetch({ fetch, sleep: async (ms) => void waits.push(ms) });
    expect((await pool.fetch('/x')).byteLength).toBe(2);
    expect(waits).toEqual([500, 1000, 3000]);
    const gone = vi.fn(async () => status(404));
    const err = await quick(gone)
      .fetch('/y')
      .catch((e) => e);
    expect(err.missing).toBe(true);
    expect(err.status).toBe(404);
    expect(gone).toHaveBeenCalledTimes(1);
  });

  it('fails a URL that can’t be resolved at once, never retried (a relative one with no page, in Node)', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('Failed to parse URL from /models/x.glb', { cause: Object.assign(new TypeError('Invalid URL'), { code: 'ERR_INVALID_URL' }) });
    });
    await expect(quick(fetch).fetch('/models/x.glb')).rejects.toThrow(/not a URL/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('gives up on a request that never answers, and asks again', async () => {
    vi.useFakeTimers();
    try {
      let n = 0;
      const fetch = vi.fn((url, init) => {
        if (++n > 1) return Promise.resolve(bytes(1));
        return new Promise((_, no) => init.signal.addEventListener('abort', () => no(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
      });
      const p = quick(fetch, { timeout: () => 1000 }).fetch('/x');
      await vi.advanceTimersByTimeAsync(1001);
      expect((await p).byteLength).toBe(1);
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('lets a slow body that keeps arriving take as long as it takes', async () => {
    vi.useFakeTimers();
    try {
      // a body in five chunks, 800 ms apart, against a stall of a second
      const fetch = vi.fn(async () => {
        let n = 0;
        const body = new ReadableStream({
          async pull(c) {
            await new Promise((r) => setTimeout(r, 800));
            if (n++ < 5) c.enqueue(new Uint8Array(10));
            else c.close();
          },
        });
        return new Response(body);
      });
      const p = quick(fetch, { timeout: () => 1000 }).fetch('/big');
      await vi.advanceTimersByTimeAsync(6000);
      expect((await p).byteLength).toBe(50);
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a request aborted before it starts rejects with AbortError and is never asked', async () => {
    const h = held();
    const pool = quick(h.fetch, { size: 1 });
    pool.fetch('/busy');
    const ctrl = new AbortController();
    const p = pool.fetch('/later', { signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    h.answer('/busy', bytes(1));
    await tick();
    await tick();
    expect(h.calls.map((c) => c.url)).toEqual(['/busy']);
    const done = new AbortController();
    done.abort();
    await expect(pool.fetch('/never', { signal: done.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('a request aborted in flight rejects, and an answer arriving after is dropped', async () => {
    // (a fetch that ignores the abort and answers anyway: the pool must not hand it on)
    let answer = null;
    const fetch = vi.fn(() => new Promise((r) => (answer = r)));
    const pool = quick(fetch);
    const ctrl = new AbortController();
    const got = vi.fn();
    const p = pool.fetch('/x', { signal: ctrl.signal, bytes: 4 }).then(got);
    await tick();
    expect(pool.progress().inFlight).toBe(1);
    // (and which file it is, for a loading screen to name)
    expect(pool.progress().waiting).toMatchObject({ url: '/x' });
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
    answer(bytes(4));
    await tick();
    await tick();
    expect(got).not.toHaveBeenCalled();
    expect(pool.progress().inFlight).toBe(0);
    expect(pool.progress().waiting).toBeNull();
  });

  it('keeps a shared request going while one caller still wants it', async () => {
    const h = held();
    const pool = quick(h.fetch);
    const a = new AbortController();
    const left = pool.fetch('/x', { signal: a.signal });
    const stays = pool.fetch('/x');
    await tick();
    a.abort();
    await expect(left).rejects.toMatchObject({ name: 'AbortError' });
    h.answer('/x', bytes(2));
    expect((await stays).byteLength).toBe(2);
  });

  it('abortAll stops everything queued and in flight', async () => {
    const h = held();
    const pool = quick(h.fetch, { size: 1 });
    const ps = [pool.fetch('/a'), pool.fetch('/b')].map((p) => p.catch((e) => e.name));
    await tick();
    pool.abortAll();
    expect(await Promise.all(ps)).toEqual(['AbortError', 'AbortError']);
    expect(pool.progress()).toMatchObject({ inFlight: 0, queued: 0 });
  });

  it('counts what arrived against what the callers said was coming', async () => {
    const h = held();
    const pool = quick(h.fetch);
    const a = pool.fetch('/a', { bytes: 3 });
    pool.fetch('/b', { bytes: 7 });
    await tick();
    expect(pool.progress()).toMatchObject({ bytes: 0, total: 10, inFlight: 2 });
    h.answer('/a', bytes(3));
    await a;
    await tick();
    expect(pool.progress()).toMatchObject({ bytes: 3, total: 10, inFlight: 1 });
  });

  it('is two at once on a saver connection, four on a weak device or a phone, six on a desktop, eight at ultra', () => {
    expect(poolSize('high', true)).toBe(2);
    expect(poolSize('low', true)).toBe(2);
    expect(poolSize('low', false)).toBe(4);
    expect(poolSize('mid', false)).toBe(4);
    expect(poolSize('high', false)).toBe(6);
    expect(poolSize('ultra', false)).toBe(8);
    expect(poolSize(undefined, false)).toBe(4);
  });
});

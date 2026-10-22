import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backoff, createPool, retryAfterMs, shortBody } from './pool.mjs';

const body = (n, headers = {}) => new Response(new Uint8Array(n), { status: 200, headers: { 'content-length': String(n), ...headers } });
const status = (code, headers = {}) => new Response(null, { status: code, headers });
// a sleep that only writes down how long it was asked for
const recorder = () => {
  const waits = [];
  return { waits, sleep: async (ms) => void waits.push(ms) };
};
// fetches answered in turn from a list (a function is called, an Error thrown)
const scripted = (answers) => {
  let i = 0;
  return vi.fn(async () => {
    const a = answers[Math.min(i++, answers.length - 1)];
    if (a instanceof Error) throw a;
    return typeof a === 'function' ? a() : a;
  });
};

const dirs = [];
const scratch = () => {
  const d = mkdtempSync(join(tmpdir(), 'pool-'));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  vi.useRealTimers();
});

describe('the scripts’ fetch pool', () => {
  it('backs off by the schedule, or by what the server asked', () => {
    expect([0, 1, 2].map((t) => backoff(t, [1000, 2000, 4000]))).toEqual([1000, 2000, 4000]);
    expect(backoff(5, [1000, 2000, 4000])).toBe(4000);
    expect(backoff(0, [1000, 2000, 4000], 7000)).toBe(7000);
    expect(retryAfterMs('7')).toBe(7000);
    expect(retryAfterMs(new Date(10_000 + 3000).toUTCString(), 10_000)).toBe(3000);
    expect(retryAfterMs(null)).toBeNull();
    expect(retryAfterMs('soon')).toBeNull();
  });

  it('calls a body short of what was promised short', () => {
    expect(shortBody(10, 100)).toBe(true);
    expect(shortBody(100, 100)).toBe(false);
    expect(shortBody(100, null)).toBe(false);
    expect(shortBody(0, 0)).toBe(false);
  });

  it('retries three failures on the schedule, then has it', async () => {
    const { waits, sleep } = recorder();
    const fetch = scripted([new Error('reset'), status(503), status(500), () => body(8)]);
    const pool = createPool({ fetch, sleep });
    const r = await pool.run({ url: 'https://b/x' });
    expect(r).toMatchObject({ status: 'fetched', tries: 4, bytes: 8 });
    expect(waits).toEqual([1000, 2000, 4000]);
    expect(pool.stats()).toMatchObject({ done: 1, failed: 0, retried: 3, bytes: 8 });
  });

  it('waits what a 429’s Retry-After says', async () => {
    const { waits, sleep } = recorder();
    const pool = createPool({ fetch: scripted([status(429, { 'retry-after': '7' }), () => body(4)]), sleep });
    expect((await pool.run({ url: 'https://b/x' })).status).toBe('fetched');
    expect(waits).toEqual([7000]);
  });

  it('takes a 404 as missing at once, never retried', async () => {
    const { waits, sleep } = recorder();
    const fetch = scripted([status(404)]);
    const pool = createPool({ fetch, sleep });
    expect(await pool.run({ url: 'https://b/x' })).toMatchObject({ status: 'missing', tries: 1 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(waits).toEqual([]);
    expect(pool.stats().missing).toBe(1);
  });

  it('takes the statuses it is told mean missing as missing (Supabase said 400)', async () => {
    const pool = createPool({ fetch: scripted([status(400)]), sleep: async () => {}, missing: [400, 404] });
    expect((await pool.run({ url: 'https://b/x' })).status).toBe('missing');
  });

  it("asks with a job's own fetch, each try, when it has one (the bucket's signs each)", async () => {
    const pools = scripted([() => body(5)]);
    const own = scripted([status(503), () => body(5)]);
    const pool = createPool({ fetch: pools, sleep: async () => {} });
    expect(await pool.run({ url: 'https://b/x', fetch: own })).toMatchObject({ status: 'fetched', tries: 2 });
    expect(own).toHaveBeenCalledTimes(2);
    expect(pools).not.toHaveBeenCalled();
  });

  it('retries a short body against the bytes it was told, then fails, never throwing', async () => {
    const { waits, sleep } = recorder();
    const fetch = scripted([() => new Response(new Uint8Array(10))]);
    const pool = createPool({ fetch, sleep });
    const r = await pool.run({ url: 'https://b/x', bytes: 100 });
    expect(r.status).toBe('failed');
    expect(r.tries).toBe(4);
    expect(r.error).toMatch(/short/);
    expect(waits).toEqual([1000, 2000, 4000]);
    expect(pool.stats().failed).toBe(1);
  });

  it('retries a short body against its own content-length', async () => {
    const short = () => new Response(new Uint8Array(10), { headers: { 'content-length': '50' } });
    const pool = createPool({ fetch: scripted([short, () => body(50)]), sleep: async () => {} });
    expect(await pool.run({ url: 'https://b/x' })).toMatchObject({ status: 'fetched', tries: 2, bytes: 50 });
  });

  it('gives up on a request that never answers, and tries again', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const fetch = vi.fn((url, init) => {
      calls++;
      if (calls > 1) return Promise.resolve(body(3));
      return new Promise((_, no) => init.signal.addEventListener('abort', () => no(new Error('aborted'))));
    });
    const pool = createPool({ fetch, sleep: async () => {}, timeout: () => 5000 });
    const p = pool.run({ url: 'https://b/x' });
    await vi.advanceTimersByTimeAsync(5001);
    expect(await p).toMatchObject({ status: 'fetched', tries: 2 });
  });

  it('sizes the timeout by a guess without holding the body to it', async () => {
    const asked = [];
    const pool = createPool({ fetch: scripted([() => body(5)]), sleep: async () => {}, timeout: (b) => (asked.push(b), 1000) });
    expect(await pool.run({ url: 'https://b/x', size: 4e6 })).toMatchObject({ status: 'fetched', bytes: 5 });
    expect(asked).toEqual([4e6]);
  });

  it('holds no more than its size in flight', async () => {
    let now = 0;
    let most = 0;
    const fetch = vi.fn(async () => {
      most = Math.max(most, ++now);
      await new Promise((r) => setTimeout(r, 5));
      now--;
      return body(1);
    });
    const pool = createPool({ size: 2, fetch, sleep: async () => {} });
    const all = await Promise.all(Array.from({ length: 7 }, (_, i) => pool.run({ url: `https://b/${i}` })));
    expect(all.every((r) => r.status === 'fetched')).toBe(true);
    expect(most).toBe(2);
    expect(pool.stats()).toMatchObject({ done: 7, bytes: 7 });
  });

  it('writes to a .part and renames it when whole, so a cut-off run leaves no half file', async () => {
    const steps = [];
    const files = {
      write: async (f, b) => void steps.push(['write', f, b.length]),
      rename: async (a, b) => void steps.push(['rename', a, b]),
      remove: async (f) => void steps.push(['remove', f]),
    };
    const pool = createPool({ fetch: scripted([() => body(5)]), sleep: async () => {}, files });
    await pool.run({ url: 'https://b/x', to: '/d/x.glb' });
    expect(steps).toEqual([
      ['write', '/d/x.glb.part', 5],
      ['rename', '/d/x.glb.part', '/d/x.glb'],
    ]);
  });

  it('on disk: only the whole file is left, and nothing at all after a failure', async () => {
    const dir = scratch();
    const pool = createPool({ fetch: scripted([() => body(6)]), sleep: async () => {} });
    const to = join(dir, 'a', 'b.glb');
    await pool.run({ url: 'https://b/x', to });
    expect(readFileSync(to).length).toBe(6);
    expect(existsSync(`${to}.part`)).toBe(false);
    const bad = createPool({ fetch: scripted([() => new Response(new Uint8Array(1))]), sleep: async () => {} });
    const lost = join(dir, 'c.glb');
    expect((await bad.run({ url: 'https://b/y', to: lost, bytes: 9 })).status).toBe('failed');
    expect(existsSync(lost)).toBe(false);
    expect(existsSync(`${lost}.part`)).toBe(false);
  });

  it('hands back the body, or the headers of a HEAD, when there is no file to write', async () => {
    const pool = createPool({ fetch: scripted([() => body(3, { 'cache-control': 'max-age=1' })]), sleep: async () => {} });
    const got = await pool.run({ url: 'https://b/x' });
    expect(got.body.length).toBe(3);
    const head = await createPool({ fetch: scripted([() => new Response(null, { headers: { 'content-length': '99' } })]), sleep: async () => {} }).run({ url: 'https://b/x', method: 'HEAD' });
    expect(head).toMatchObject({ status: 'fetched', http: 200 });
    expect(head.headers.get('content-length')).toBe('99');
  });

  it('a peek keeps the headers and lets the body go unread, whole-file 200 or one-byte 206', async () => {
    const cancelled = [];
    const answer = (code, n) => {
      const res = new Response(new Uint8Array(n), { status: code, headers: { 'content-length': String(n), 'cache-control': 'max-age=31536000' } });
      const body = res.body;
      res.body.cancel = async () => void cancelled.push(code);
      return Object.defineProperty(res, 'body', { value: body });
    };
    const pool = createPool({ fetch: scripted([() => answer(200, 5000), () => answer(206, 1)]) });
    const whole = await pool.run({ url: 'https://b/x', headers: { range: 'bytes=0-0' }, peek: true });
    const part = await pool.run({ url: 'https://b/y', headers: { range: 'bytes=0-0' }, peek: true });
    expect([whole.status, whole.http, whole.bytes, whole.body]).toEqual(['fetched', 200, 0, undefined]);
    expect(whole.headers.get('cache-control')).toBe('max-age=31536000');
    expect([part.status, part.http, part.bytes]).toEqual(['fetched', 206, 0]);
    expect(cancelled).toEqual([200, 206]);
    expect(pool.stats().bytes).toBe(0);
  });

  it('a 4xx that is neither missing nor 429 fails at once (a refusal does not change on asking again)', async () => {
    const fetch = scripted([status(403)]);
    const r = await createPool({ fetch, sleep: async () => {} }).run({ url: 'https://b/x' });
    expect(r).toMatchObject({ status: 'failed', tries: 1, http: 403 });
  });
});

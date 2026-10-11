// A fetch pool for the scripts (the bucket fetch, the publish, the asset
// check): so many requests at once and no more, each with a timeout that
// grows with its size, a failure retried on a schedule, and a body written
// whole or not at all. A run that is cut off (a dropped connection, a
// Ctrl-C) leaves a `.part` at worst, never a file that looks finished and
// isn't; a 200 whose body is shorter than promised (a proxy cut it, or the
// CDN served a truncated object) is a failure to retry, not a success.
//
// createPool({ size, retries, waits, timeout, fetch, sleep, missing, files, now })
//   → { run(job) → Promise<result>, stats() → { done, missing, failed, retried, bytes, seconds } }
//   job: { url, method = 'GET', headers, body, bytes?, size?, to? }
//     bytes: what the body must be (a short one is retried); size: a guess,
//     for the timeout only (the 2017 drop's manifest gives each GLB's size
//     before the uploader re-encoded it: Luke's lod4 is 162,996 there and
//     79,980 in the bucket)
//   result: { status: 'fetched' | 'missing' | 'failed', bytes, tries, http?, error?, body?, headers? }
//     never thrown: a script counts its failures and decides
// backoff(try, waits, retryAfter) → ms; retryAfterMs(header, now) → ms | null;
// shortBody(got, want) → boolean (all pure)
//
// Retried: a thrown error (network, timeout), a 429, a 5xx, a short body.
// Final: `missing` (404, or what the caller says the store uses for it:
// Supabase answers 400 for an object it hasn't got), and any other 4xx,
// since a refusal does not change on asking again.

import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const WAITS = [1000, 2000, 4000];
// 30 s, and a second for every megabyte: a big GLB on a slow line is not a dead one
export const TIMEOUT = (bytes = 0) => 30000 + 1000 * ((bytes ?? 0) / 1e6);

export const backoff = (n, waits = WAITS, retryAfter = null) => (retryAfter != null ? retryAfter : waits[Math.min(n, waits.length - 1)]);

// Retry-After as seconds, or as an HTTP date
export function retryAfterMs(header, now = Date.now()) {
  if (header == null || header === '') return null;
  if (/^\d+(\.\d+)?$/.test(String(header).trim())) return Math.round(Number(header) * 1000);
  const at = Date.parse(header);
  return Number.isNaN(at) ? null : Math.max(0, at - now);
}

export const shortBody = (got, want) => want != null && want > 0 && got < want;

const disk = {
  async write(file, buf) {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, buf);
  },
  rename: (a, b) => rename(a, b),
  remove: (f) => rm(f, { force: true }),
};

export function createPool({ size = 6, retries = 3, waits = WAITS, timeout = TIMEOUT, fetch = globalThis.fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), missing = [404], files = disk, now = Date.now } = {}) {
  const queue = [];
  let active = 0;
  const totals = { done: 0, missing: 0, failed: 0, retried: 0, bytes: 0, started: null, ended: null };

  // one try: an answer, or a reason to try again (`again`), or a final word
  async function once(job) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new Error('timed out')), timeout(job.bytes ?? job.size));
    try {
      const res = await fetch(job.url, { method: job.method ?? 'GET', headers: job.headers, body: job.body, signal: ctrl.signal });
      if (missing.includes(res.status)) {
        await res.body?.cancel?.().catch(() => {});
        return { final: { status: 'missing', bytes: 0, http: res.status } };
      }
      if (res.status === 429 || res.status >= 500) {
        await res.body?.cancel?.().catch(() => {});
        return { again: `HTTP ${res.status}`, wait: retryAfterMs(res.headers.get('retry-after'), now()), http: res.status };
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        // (the headers kept: a 416 on an empty file names its size, 0, in content-range, and assets-check reads it)
        return { final: { status: 'failed', bytes: 0, http: res.status, headers: res.headers, error: `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}` } };
      }
      if ((job.method ?? 'GET') === 'HEAD') return { final: { status: 'fetched', bytes: 0, http: res.status, headers: res.headers } };
      const buf = Buffer.from(await res.arrayBuffer());
      const told = res.headers.get('content-length');
      const want = job.bytes ?? (told != null && !res.headers.get('content-encoding') ? Number(told) : null);
      if (shortBody(buf.length, want)) return { again: `short body: ${buf.length} of ${want} bytes` };
      if (job.to) {
        const part = `${job.to}.part`;
        try {
          await files.write(part, buf);
          await files.rename(part, job.to);
        } catch (e) {
          await files.remove(part).catch(() => {});
          return { final: { status: 'failed', bytes: 0, error: `couldn't write ${job.to}: ${e.message}` } };
        }
        return { final: { status: 'fetched', bytes: buf.length, http: res.status, headers: res.headers } };
      }
      return { final: { status: 'fetched', bytes: buf.length, http: res.status, headers: res.headers, body: buf } };
    } catch (e) {
      return { again: ctrl.signal.aborted ? 'timed out' : e.message };
    } finally {
      clearTimeout(timer);
    }
  }

  async function attempt(job) {
    totals.started ??= now();
    let last = null;
    for (let n = 0; ; n++) {
      const got = await once(job);
      if (got.final) {
        const r = { ...got.final, tries: n + 1 };
        if (r.status === 'fetched') {
          totals.done++;
          totals.bytes += r.bytes;
        } else totals[r.status]++;
        totals.ended = now();
        return r;
      }
      last = got;
      if (n >= retries) break;
      totals.retried++;
      await sleep(backoff(n, waits, got.wait));
    }
    totals.failed++;
    totals.ended = now();
    return { status: 'failed', bytes: 0, tries: retries + 1, http: last?.http, error: last?.again };
  }

  const pump = () => {
    while (active < size && queue.length) {
      const { job, done } = queue.shift();
      active++;
      attempt(job)
        .then(done, (e) => done({ status: 'failed', bytes: 0, tries: 0, error: e.message }))
        .finally(() => {
          active--;
          pump();
        });
    }
  };

  return {
    run(job) {
      return new Promise((done) => {
        queue.push({ job, done });
        pump();
      });
    },
    stats: () => ({
      done: totals.done,
      missing: totals.missing,
      failed: totals.failed,
      retried: totals.retried,
      bytes: totals.bytes,
      seconds: totals.started == null ? 0 : ((totals.ended ?? now()) - totals.started) / 1000,
    }),
  };
}

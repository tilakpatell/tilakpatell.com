// The site's own fetch pool for model and texture bytes: so many requests at
// once for this device and no more, the nearest thing first, one request per
// URL however many ask, a timeout on a stall that grows with the file, a failure
// retried on a short schedule, and a body that comes up short of what was
// promised (a proxy cut it, a CDN served a truncated object) a failure, not
// a model that won't parse. Each caller can be stopped on its own (its
// `signal`: a world left mid-load); a request nobody wants any more is
// aborted, and an answer that arrives after is dropped, so nothing reaches
// a disposed scene. Pure: no three.js, no DOM beyond `fetch`, which is
// handed in.
//
// createAssetFetch({ fetch, size, retries, waits, timeout, sleep })
//   → { fetch(url, { priority, signal, bytes }) → Promise<ArrayBuffer>,
//       progress() → { bytes, total, inFlight, queued, waiting: { url, ms } | null (the request running longest) }, abortAll(), resize(n) }
//   a 404 rejects at once with { status: 404, missing: true }; an abort with
//   an AbortError; anything else after three retries (0.5, 1, 2 s; a 429's
//   Retry-After over the schedule) with the last reason
// poolSize(level, lowData) → 2 | 4 | 6 | 8

export const WAITS = [500, 1000, 2000];
// 20 s, and a second for every megabyte, with nothing arriving
export const TIMEOUT = (bytes = 0) => 20000 + 1000 * ((bytes ?? 0) / 1e6);

// The connection sets it, not the graphics chip: two on a saver connection
// or 2G, four on a weak device or a phone, six on a desktop, eight at the
// ultra level (lib/device's tier, or 'ultra'). A weak device is slow at
// drawing, not at downloading: held to two, a model built in front of you
// (a turret in the shared world) waited behind the world's own loads, 3.2 s
// against 2.6 s at four or more (the shared world's online check, whose limit is 3).
export function poolSize(level, lowData = false) {
  if (lowData) return 2;
  if (level === 'ultra') return 8;
  if (level === 'high') return 6;
  return 4;
}

const abortError = () => {
  try {
    return new DOMException('aborted', 'AbortError');
  } catch {
    return Object.assign(new Error('aborted'), { name: 'AbortError' });
  }
};

function retryAfter(header) {
  if (!header) return null;
  if (/^\d+(\.\d+)?$/.test(header.trim())) return Number(header) * 1000;
  const at = Date.parse(header);
  return Number.isNaN(at) ? null : Math.max(0, at - Date.now());
}

export function createAssetFetch({ fetch = globalThis.fetch?.bind(globalThis), size = 3, retries = 3, waits = WAITS, timeout = TIMEOUT, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const entries = new Map(); // url → entry
  const queue = []; // entries waiting for a slot
  let active = 0;
  let seq = 0;
  let limit = size;
  const count = { bytes: 0, total: 0 };

  const settle = (entry, fn) => {
    if (entry.over) return;
    entry.over = true;
    if (entries.get(entry.url) === entry) entries.delete(entry.url);
    for (const w of entry.waiters) {
      w.off?.();
      fn(w);
    }
    entry.waiters.clear();
  };

  // nobody wants it: out of the queue, or its request aborted and its slot given back
  function cancel(entry) {
    entry.cancelled = true;
    const i = queue.indexOf(entry);
    if (i >= 0) queue.splice(i, 1);
    entry.ctrl.abort();
    if (entry.running) {
      entry.running = false;
      active--;
    }
    settle(entry, (w) => w.reject(abortError()));
    pump();
  }

  // one try: { buf } or { again, wait } or { fail }
  async function once(entry) {
    const ctrl = new AbortController();
    const stop = () => ctrl.abort();
    entry.ctrl.signal.addEventListener('abort', stop);
    // (a stall, not a deadline: the timer starts again with every chunk, so
    // a big file on a slow line that keeps arriving is never cut off and
    // fetched again from the start; one that goes quiet that long is)
    let timer = setTimeout(stop, timeout(entry.bytes));
    const alive = () => {
      clearTimeout(timer);
      timer = setTimeout(stop, timeout(entry.bytes));
    };
    try {
      const res = await fetch(entry.url, { signal: ctrl.signal, mode: 'cors', credentials: 'same-origin' });
      if (res.status === 404) return { fail: Object.assign(new Error(`${entry.url}: 404`), { status: 404, missing: true }) };
      if (res.status === 429 || res.status >= 500) return { again: `HTTP ${res.status}`, wait: retryAfter(res.headers.get('retry-after')) };
      if (!res.ok) return { fail: Object.assign(new Error(`${entry.url}: HTTP ${res.status}`), { status: res.status }) };
      const told = Number(res.headers.get('content-length')) || null;
      if (!entry.bytes && told && !entry.counted) {
        entry.counted = told;
        count.total += told;
      }
      const want = entry.bytes ?? told;
      let buf;
      let got = 0;
      const reader = res.body?.getReader?.();
      if (reader) {
        const parts = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (entry.cancelled) return { dropped: true };
          alive();
          parts.push(value);
          got += value.byteLength;
          count.bytes += value.byteLength;
        }
        const all = new Uint8Array(got);
        let at = 0;
        for (const p of parts) {
          all.set(p, at);
          at += p.byteLength;
        }
        buf = all.buffer;
      } else {
        buf = await res.arrayBuffer();
        got = buf.byteLength;
        count.bytes += got;
      }
      if (want && got < want) {
        count.bytes -= got;
        return { again: `short body: ${got} of ${want} bytes` };
      }
      return { buf };
    } catch (e) {
      // (a URL fetch can't resolve won't be on asking again: a relative one
      // with no page to resolve it against, in Node)
      if (e?.cause?.code === 'ERR_INVALID_URL' || /invalid url|failed to parse url/i.test(e?.message ?? '')) return { fail: Object.assign(new TypeError(`${entry.url}: not a URL here`), { cause: e }) };
      return { again: ctrl.signal.aborted && !entry.cancelled ? 'timed out' : e.message };
    } finally {
      clearTimeout(timer);
      entry.ctrl.signal.removeEventListener('abort', stop);
    }
  }

  async function run(entry) {
    let last = null;
    for (let n = 0; n <= retries; n++) {
      if (entry.cancelled) return;
      const got = await once(entry);
      if (entry.cancelled || got.dropped) return;
      if (got.buf) return settle(entry, (w) => w.resolve(got.buf));
      if (got.fail) return settle(entry, (w) => w.reject(got.fail));
      last = got;
      if (n < retries) await sleep(got.wait ?? waits[Math.min(n, waits.length - 1)]);
    }
    if (!entry.cancelled) settle(entry, (w) => w.reject(new Error(`${entry.url}: ${last?.again ?? 'failed'}`)));
  }

  function pump() {
    while (active < limit && queue.length) {
      // the highest priority, then the first asked
      queue.sort((a, b) => b.priority - a.priority || a.seq - b.seq);
      const entry = queue.shift();
      active++;
      entry.running = true;
      entry.since = Date.now();
      run(entry).finally(() => {
        if (!entry.running) return;
        entry.running = false;
        active--;
        pump();
      });
    }
  }

  return {
    fetch(url, { priority = 0, signal = null, bytes = null } = {}) {
      if (signal?.aborted) return Promise.reject(abortError());
      let entry = entries.get(url);
      if (!entry) {
        entry = { url, priority, seq: seq++, bytes: bytes || null, waiters: new Set(), ctrl: new AbortController(), running: false, over: false, cancelled: false, counted: 0 };
        if (entry.bytes) count.total += entry.bytes;
        entries.set(url, entry);
        queue.push(entry);
      } else if (priority > entry.priority) entry.priority = priority;
      return new Promise((resolve, reject) => {
        const w = { resolve, reject };
        entry.waiters.add(w);
        if (signal) {
          const gone = () => {
            entry.waiters.delete(w);
            reject(abortError());
            if (!entry.waiters.size && !entry.over) cancel(entry);
          };
          signal.addEventListener('abort', gone, { once: true });
          w.off = () => signal.removeEventListener('abort', gone);
        }
        pump();
      });
    },
    progress: () => {
      let waiting = null;
      for (const e of entries.values()) if (e.running && (!waiting || e.since < waiting.since)) waiting = e;
      return { bytes: count.bytes, total: count.total, inFlight: active, queued: queue.length, waiting: waiting ? { url: waiting.url, ms: Date.now() - waiting.since } : null };
    },
    abortAll() {
      for (const entry of [...entries.values()]) cancel(entry);
    },
    resize(n) {
      limit = Math.max(1, n);
      pump();
    },
  };
}

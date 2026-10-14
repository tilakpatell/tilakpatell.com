// Every model's and texture's bytes, through one pool the size this device
// can take (lib/net/assetFetch: two at once on a saver connection, four on a
// weak device or a phone, six on a desktop, eight at ultra), asked of
// the public bucket first where it holds the file (lib/assetBase), the site
// after. lib/three/gltf.js's loader and textures.js fetch through here, so
// every loader on the site gets the retries, the timeouts, the short-body
// check and the one request per URL without asking.
//
// A world's loads belong to it: worldScope() at its start makes the scope
// every load started after it joins (by default; a load can name its own
// `signal`), and scope.end() at its dispose stops whatever of them is still
// queued or in flight, so leaving a world stops its downloads at once and a
// late answer reaches nothing. atPriority(p, fn) runs fn with its loads at
// priority p (the figure nearest the visitor first).
//
// loadBytes(path, { priority, signal }) → Promise<ArrayBuffer>
// worldScope(name) → { signal, end(), progress() → { bytes, total, files } }
// atPriority(p, fn) → fn()
// assetPool() → the pool (its progress() for a check); useAssetPool(p) for a test

import { manifestEntry, waitFor, withFallback } from './assetBase';
import { device } from './device';
import { createAssetFetch, poolSize } from './net/assetFetch';

let pool = null;
export function assetPool() {
  if (!pool) {
    let size = 3;
    try {
      const d = device();
      size = poolSize(d.detail, d.saveData, d.phone);
    } catch {
      // (no device to read: a phone's three)
    }
    pool = createAssetFetch({ size });
  }
  return pool;
}

// (tests: a pool of their own, with a fake fetch and no waits; null for the device's again)
export function useAssetPool(p) {
  pool = p;
}

let current = null;
let priorityNow = 0;

export function worldScope(name = 'world') {
  const ctrl = new AbortController();
  const scope = {
    name,
    signal: ctrl.signal,
    bytes: 0,
    total: 0,
    files: 0,
    end() {
      ctrl.abort();
      if (current === scope) current = null;
    },
    progress: () => ({ bytes: scope.bytes, total: scope.total, files: scope.files }),
  };
  current = scope;
  return scope;
}

export function atPriority(p, fn) {
  const was = priorityNow;
  priorityNow = p;
  try {
    return fn();
  } finally {
    priorityNow = was;
  }
}

export function loadBytes(path, { priority = priorityNow, signal = current?.signal ?? null } = {}) {
  const scope = current;
  const bytes = typeof path === 'string' ? (manifestEntry(path.replace(/^\/+/, ''))?.bytes ?? null) : null;
  if (scope && bytes) scope.total += bytes;
  // (the bucket given as long as the file's size asks before it counts as down: assetBase's waitFor)
  return withFallback((u) => assetPool().fetch(u, { priority, signal, bytes }), { wait: waitFor(bytes) })(path).then((buf) => {
    if (scope) {
      scope.bytes += buf.byteLength;
      scope.files++;
    }
    return buf;
  });
}

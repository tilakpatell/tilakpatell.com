// A grid of cells over a world, so a world with a lot in it only builds and
// draws what's near the camera. Cells lie on the XZ plane and are named
// "ix,iz" (ix = floor(x / size)). The grid is unbounded unless the caller
// lists the cells that exist.
//
// A cell within `near` of the camera, or of a point `ahead` of it along its
// heading, is built and then prepared (through the caller's GPU queue), one
// step at a time. A cell that is shown stays shown until it is past `far`,
// so one on the edge doesn't flicker; past twice `far` it is let go.
//
// Nothing here knows about three.js, so it runs in Node.
//
// (runtime/chunkGrid is the runtime's bookkeeping for a world streamed in
// square cells around the player, with generations and requests in flight;
// this one builds a scene's own cells, prepares them on the GPU queue and
// says which are shown.)

// a cell that failed is tried again after this many updates, up to TRIES
// times in all, and then left alone until it is let go and wanted afresh
export const RETRY_UPDATES = 120;
const TRIES = 3;

export const cellKey = (ix, iz) => `${ix},${iz}`;

export function cellOf(x, z, size) {
  return { ix: Math.floor(x / size), iz: Math.floor(z / size) };
}

function parseKey(key) {
  const [ix, iz] = key.split(',').map(Number);
  return { ix, iz };
}

// distance from a point to the nearest edge of a cell (0 inside it)
function boxDist(px, pz, ix, iz, size) {
  const dx = Math.max(ix * size - px, 0, px - (ix + 1) * size);
  const dz = Math.max(iz * size - pz, 0, pz - (iz + 1) * size);
  return Math.hypot(dx, dz);
}

export function createChunks({ size, near, far, cells, build, prepare, ahead = size, budget = 1 }) {
  const fixed = Array.isArray(cells) ? cells.map((key) => ({ key, ...parseKey(key) })) : null;
  // key -> { key, ix, iz, state, handle, shown, dist, failedAt, tries, gone }
  // state: 'idle' (known, nothing made), 'busy', 'ready', 'failed'
  const held = new Map();
  let tick = 0;
  let inFlight = 0;
  let all = false;
  let preparing = false;
  let disposed = false;

  const cellFor = (key) => {
    let c = held.get(key);
    if (!c) {
      const { ix, iz } = parseKey(key);
      c = { key, ix, iz, state: 'idle', handle: null, shown: false, dist: Infinity, failedAt: 0, tries: 0, gone: false, promise: null };
      held.set(key, c);
    }
    return c;
  };

  const safeDispose = (handle) => {
    try { handle?.dispose?.(); } catch { /* a handle that won't dispose is still forgotten */ }
  };

  // Let a cell go. A cell still being made is not touched here: the step
  // that holds its handle sees `gone` and disposes it, once, when it's done.
  const release = (c) => {
    c.gone = true;
    held.delete(c.key);
    if (c.state !== 'busy') safeDispose(c.handle);
    c.handle = null;
  };

  // build then prepare one cell; a throw or rejection marks it failed
  async function step(c) {
    c.state = 'busy';
    let handle = null;
    let kept = false;
    try {
      handle = await build(c.key, (c.ix + 0.5) * size, (c.iz + 0.5) * size);
      if (!c.gone) await prepare(handle, c.key);
      if (!c.gone) {
        c.handle = handle;
        c.state = 'ready';
        c.shown = c.dist <= near;
        kept = true;
      }
    } catch {
      if (!c.gone) {
        c.state = 'failed';
        c.failedAt = tick;
        c.tries++;
      }
    } finally {
      if (!kept) safeDispose(handle);
    }
  }

  const start = (c) => {
    inFlight++;
    const p = step(c).finally(() => { inFlight--; });
    c.promise = p;
    return p;
  };

  const keysAround = (points) => {
    const out = new Set();
    for (const { x, z } of points) {
      const a = cellOf(x - near, z - near, size);
      const b = cellOf(x + near, z + near, size);
      for (let ix = a.ix; ix <= b.ix; ix++) {
        for (let iz = a.iz; iz <= b.iz; iz++) out.add(cellKey(ix, iz));
      }
    }
    return out;
  };

  function update(position, heading) {
    if (disposed) return;
    tick++;
    const px = position.x;
    const pz = position.z;
    const hx = heading?.x ?? 0;
    const hz = heading?.z ?? 0;
    const hl = Math.hypot(hx, hz);
    const ax = hl > 1e-6 ? px + (hx / hl) * ahead : px;
    const az = hl > 1e-6 ? pz + (hz / hl) * ahead : pz;
    const dist = (ix, iz) => Math.min(boxDist(px, pz, ix, iz, size), boxDist(ax, az, ix, iz, size));

    // what the cells held so far should do
    for (const c of held.values()) {
      c.dist = dist(c.ix, c.iz);
      if (!all && !preparing && c.dist > 2 * far) { release(c); continue; }
      if (c.state === 'ready') {
        c.shown = c.dist <= near || (c.shown && c.dist <= far);
      }
    }
    if (all || preparing) return;

    // the nearest wanted cell that still needs making
    if (inFlight >= budget) return;
    let best = null;
    let bestD = Infinity;
    const consider = ({ key, ix, iz }) => {
      const d = dist(ix, iz);
      if (d > near || d >= bestD) return;
      const c = held.get(key);
      if (c) {
        if (c.state === 'ready' || c.state === 'busy') return;
        if (c.state === 'failed' && (c.tries >= TRIES || tick - c.failedAt < RETRY_UPDATES)) return;
      }
      best = key;
      bestD = d;
    };
    if (fixed) fixed.forEach(consider);
    else keysAround([{ x: px, z: pz }, { x: ax, z: az }]).forEach((key) => consider({ key, ...parseKey(key) }));
    if (best === null) return;
    const c = cellFor(best);
    c.dist = bestD;
    start(c);
  }

  // Builds and prepares every listed cell. While it runs update() leaves
  // the cells alone. A cell that fails here is skipped and not retried
  // afterwards: once everything has been prepared, update() only decides
  // what's drawn.
  async function prepareAll(onProgress, alive = () => true) {
    if (!fixed) throw new Error('prepareAll needs a list of cells');
    preparing = true;
    try {
      const total = fixed.length;
      let done = 0;
      if (total === 0) onProgress?.(1);
      for (const { key } of fixed) {
        if (disposed || !alive()) return;
        const c = cellFor(key);
        if (c.state === 'busy') await c.promise;
        else if (c.state !== 'ready') {
          c.tries = 0;
          await start(c);
        }
        done++;
        onProgress?.(done / total);
      }
      if (!disposed && alive()) all = true;
    } finally {
      preparing = false;
    }
  }

  // Let one cell go now (its handle disposed, or, if it's being made, once
  // it's done), so it's made afresh, its tries back to none, when next wanted.
  const forget = (key) => {
    const c = held.get(key);
    if (c) release(c);
  };

  const visible = (key) => {
    const c = held.get(key);
    return !!c && c.state === 'ready' && c.shown;
  };

  function dispose() {
    disposed = true;
    for (const c of held.values()) release(c);
  }

  // the keys of the cells that are built and prepared
  const list = () => [...held.values()].filter((c) => c.state === 'ready').map((c) => c.key);

  return { update, prepareAll, visible, forget, dispose, cells: list };
}

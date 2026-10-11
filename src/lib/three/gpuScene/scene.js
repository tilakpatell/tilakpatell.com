// The GPU scene's instance rows (GPU-first lane N1): every instance of a
// level's table in one array of 32-byte rows (pack.js), which three.js's
// bindRows mirrors into one storage buffer. A cell's rows are appended when
// the stream hands the cell in and freed when it drops it, never rebuilt:
// a freed row keeps its place with its live flag cleared, so a cull pass
// already in flight that frame reads a dead row and skips it, and its slots
// go to the next append that fits (Review Focus 1). The array doubles when
// it is full and never shrinks; `grew` counts the doublings, so whoever
// holds the storage buffer knows to make it again.
//
// Pure: no three. The GPU side uploads `takeDirty()`'s one span a frame.
//
//   createGpuScene({ capacity = 1024 }) → { rows: Uint32Array, capacity, count, dead, grew,
//     append(packed, n) → { start, count }, free(range), meshOf(i), perMesh() → Map<mesh, live>,
//     takeDirty() → { start, count } | null, each(fn(i)) (the live rows) }

import { FLAG, ROW_U32 } from './pack.js';

const LIVE = FLAG.live << 16;

export function createGpuScene({ capacity = 1024 } = {}) {
  let rows = new Uint32Array(Math.max(1, capacity) * ROW_U32);
  let cap = Math.max(1, capacity);
  let count = 0; // the high-water mark: rows past it were never written
  let dead = 0;
  let grew = 0;
  let free = []; // [{ start, count }] sorted by start, merged
  let dirty = null;
  const live = new Map(); // mesh → live rows

  const touch = (start, n) => {
    if (!dirty) dirty = { start, count: n };
    else {
      const end = Math.max(dirty.start + dirty.count, start + n);
      dirty.start = Math.min(dirty.start, start);
      dirty.count = end - dirty.start;
    }
  };
  const meshAt = (i) => rows[i * ROW_U32 + 7] & 0xffff;
  const isLive = (i) => (rows[i * ROW_U32 + 7] & LIVE) !== 0;
  const tally = (start, n, by) => {
    for (let i = start; i < start + n; i++) if (isLive(i)) live.set(meshAt(i), (live.get(meshAt(i)) ?? 0) + by);
  };

  function room(n) {
    for (let k = 0; k < free.length; k++) {
      const f = free[k];
      if (f.count < n) continue;
      const start = f.start;
      if (f.count === n) free.splice(k, 1);
      else free[k] = { start: f.start + n, count: f.count - n };
      dead -= n;
      return start;
    }
    while (count + n > cap) {
      cap *= 2;
      grew++;
    }
    if (rows.length < cap * ROW_U32) {
      const next = new Uint32Array(cap * ROW_U32);
      next.set(rows);
      rows = next;
    }
    const start = count;
    count += n;
    return start;
  }

  return {
    get rows() {
      return rows;
    },
    get capacity() {
      return cap;
    },
    get count() {
      return count;
    },
    get dead() {
      return dead;
    },
    get grew() {
      return grew;
    },
    append(packed, n) {
      const start = room(n);
      rows.set(packed.subarray(0, n * ROW_U32), start * ROW_U32);
      tally(start, n, 1);
      touch(start, n);
      return { start, count: n };
    },
    free(range) {
      // (only the rows still live: a range freed twice is freed once)
      let freed = 0;
      for (let i = range.start; i < range.start + range.count; i++) {
        if (!isLive(i)) continue;
        live.set(meshAt(i), live.get(meshAt(i)) - 1);
        if (!live.get(meshAt(i))) live.delete(meshAt(i));
        rows[i * ROW_U32 + 7] &= ~LIVE;
        freed++;
      }
      if (!freed) return;
      dead += freed;
      touch(range.start, range.count);
      free.push({ start: range.start, count: range.count });
      free.sort((a, b) => a.start - b.start);
      const merged = [];
      for (const f of free) {
        const last = merged[merged.length - 1];
        if (last && last.start + last.count >= f.start) last.count = Math.max(last.count, f.start + f.count - last.start);
        else merged.push({ ...f });
      }
      free = merged;
    },
    meshOf: meshAt,
    isLive,
    perMesh: () => live,
    takeDirty() {
      const d = dirty;
      dirty = null;
      return d;
    },
    each(fn) {
      for (let i = 0; i < count; i++) if (isLive(i)) fn(i);
    },
  };
}

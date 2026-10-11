// The physics worker's poses, as rows of numbers in one Float32Array that
// crosses the thread boundary by transfer (no SharedArrayBuffer: GitHub
// Pages can't make the page cross-origin isolated; docs/stack/
// webassembly.md). A row is keyed by the body's id, never by its index, so a
// body added or removed between two steps can't be read under another's
// slot: the page looks the id up, and an id with no row keeps the pose it
// had (the design's Review Focus 2).
//
//   buffer: [count, steps, alpha, ms, ...rows]   (HEADER floats, then count rows)
//   row:    [±id, x, y, z, qx, qy, qz, qw]       (ROW floats; a negative id is asleep)
//
// Ids are whole numbers from 1, exact in a float up to 2^24 (16.7 million
// bodies made in one world's life). Pure: no three.js, no DOM.
//
//   encodePoses(bodies, out) → out, or a bigger buffer when out is too small
//     (bodies: an iterable of { id, sleeping, position(out), quaternion(out) });
//     the header's steps, alpha and ms are the caller's to write
//   decodePoses(buf) → Map<id, { position, quaternion, sleeping }>   (allocates: tests and tools)
//   readPoses(buf, fn(id, at, sleeping))   (at: the row's x in buf; no allocation)

export const HEADER = 4;
export const ROW = 8;

const p3 = [0, 0, 0];
const q4 = [0, 0, 0, 1];

export function encodePoses(bodies, out) {
  let buf = out;
  let n = 0;
  for (const b of bodies) {
    const at = HEADER + n * ROW;
    if (at + ROW > buf.length) {
      // (twice as many rows: a growing world reallocates a few times, not every step)
      const bigger = new Float32Array(HEADER + Math.max(16, (n + 1) * 2) * ROW);
      bigger.set(buf.subarray(0, at));
      buf = bigger;
    }
    b.position(p3);
    b.quaternion(q4);
    buf[at] = b.sleeping ? -b.id : b.id;
    buf[at + 1] = p3[0];
    buf[at + 2] = p3[1];
    buf[at + 3] = p3[2];
    buf[at + 4] = q4[0];
    buf[at + 5] = q4[1];
    buf[at + 6] = q4[2];
    buf[at + 7] = q4[3];
    n++;
  }
  buf[0] = n;
  return buf;
}

export function readPoses(buf, fn) {
  const n = buf[0] | 0;
  for (let i = 0; i < n; i++) {
    const at = HEADER + i * ROW;
    const id = buf[at];
    fn(Math.abs(id), at + 1, id < 0);
  }
}

export function decodePoses(buf) {
  const out = new Map();
  readPoses(buf, (id, at, sleeping) => {
    out.set(id, { position: [buf[at], buf[at + 1], buf[at + 2]], quaternion: [buf[at + 3], buf[at + 4], buf[at + 5], buf[at + 6]], sleeping });
  });
  return out;
}

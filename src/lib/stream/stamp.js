// A number painted into the frame’s top-left corner as black and white
// blocks, and read back from the decoded video: how the receiver measures
// input to picture without the two machines’ clocks agreeing. The receiver
// sends ping n; the sender paints n into the next frames it draws; the
// receiver times from sending n to first seeing it.
//
// Layout, left to right, one row of square cells: a white marker, a black
// marker (the two set the threshold), BITS bits of n (most significant
// first), one even-parity bit. Cells are big (a 120th of the frame’s width)
// so the encoder’s blocks and a shrunk frame keep them readable.
//
// stampCells(n) → [0|1] × CELLS; cellSize(width) → px
// cellMeans(rgba, rowWidth, cell, count) → mean luma of each cell’s middle
// readStamp(means) → n | null (null when the markers or the parity fail)

export const BITS = 16;
export const CELLS = BITS + 3;

export function cellSize(width) {
  return Math.max(4, Math.round(width / 120));
}

export function stampCells(n) {
  const v = ((Math.trunc(n) % 2 ** BITS) + 2 ** BITS) % 2 ** BITS;
  const bits = [];
  for (let i = BITS - 1; i >= 0; i--) bits.push((v >> i) & 1);
  const parity = bits.reduce((a, b) => a ^ b, 0);
  return [1, 0, ...bits, parity];
}

export function cellMeans(rgba, rowWidth, cell, count = CELLS) {
  const means = [];
  // the middle half of each cell: the edges bleed into the neighbours
  const lo = Math.floor(cell / 4);
  const hi = Math.max(lo + 1, Math.ceil((cell * 3) / 4));
  for (let c = 0; c < count; c++) {
    let sum = 0;
    let k = 0;
    for (let y = lo; y < hi; y++) {
      for (let x = c * cell + lo; x < c * cell + hi; x++) {
        const i = (y * rowWidth + x) * 4;
        sum += 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2];
        k++;
      }
    }
    means.push(k ? sum / k : 0);
  }
  return means;
}

export function readStamp(means) {
  if (!means || means.length < CELLS) return null;
  const [white, black] = means;
  // the markers must stand apart, or this corner is the scene, not a stamp
  if (white - black < 64) return null;
  const mid = (white + black) / 2;
  const bits = means.slice(2, CELLS).map((m) => (m > mid ? 1 : 0));
  const parity = bits.pop();
  if (bits.reduce((a, b) => a ^ b, 0) !== parity) return null;
  return bits.reduce((v, b) => v * 2 + b, 0);
}

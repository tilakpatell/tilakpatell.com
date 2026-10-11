import { describe, expect, it } from 'vitest';
import { BITS, CELLS, cellMeans, cellSize, readStamp, stampCells } from './stamp';

// an RGBA strip as a canvas would hand it back: each cell flat, then noise
function strip(cells, size, noise = 0) {
  const w = cells.length * size;
  const data = new Uint8ClampedArray(w * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < w; x++) {
      const on = cells[Math.floor(x / size)];
      const v = Math.max(0, Math.min(255, (on ? 235 : 16) + Math.round(Math.sin(x * 12.9898 + y * 78.233) * noise)));
      const i = (y * w + x) * 4;
      data.set([v, v, v, 255], i);
    }
  }
  return { data, width: w, height: size };
}

describe('the frame stamp', () => {
  it('lays out the markers, the bits and the parity', () => {
    const c = stampCells(5);
    expect(c).toHaveLength(CELLS);
    expect(c[0]).toBe(1);
    expect(c[1]).toBe(0);
    expect(c.slice(2, 2 + BITS).join('')).toBe('0000000000000101');
  });

  it('reads back what it wrote, through compression’s noise', () => {
    for (const n of [0, 1, 255, 4242, 65535]) {
      const img = strip(stampCells(n), 16, 40);
      expect(readStamp(cellMeans(img.data, img.width, 16, CELLS))).toBe(n);
    }
  });

  it('wraps a number past the bits it has', () => {
    const img = strip(stampCells(65536 + 3), 8);
    expect(readStamp(cellMeans(img.data, img.width, 8, CELLS))).toBe(3);
  });

  it('says nothing when the markers or the parity are wrong', () => {
    const cells = stampCells(77);
    cells[0] = 0;
    let img = strip(cells, 8);
    expect(readStamp(cellMeans(img.data, img.width, 8, CELLS))).toBeNull();
    const flipped = stampCells(77);
    flipped[5] ^= 1;
    img = strip(flipped, 8);
    expect(readStamp(cellMeans(img.data, img.width, 8, CELLS))).toBeNull();
    expect(readStamp(new Array(CELLS).fill(128))).toBeNull();
    expect(readStamp([])).toBeNull();
  });

  it('sizes a cell by the frame, so a frame the encoder shrank still reads', () => {
    expect(cellSize(1920)).toBe(16);
    expect(cellSize(960)).toBe(8);
    expect(cellSize(100)).toBe(4);
  });
});

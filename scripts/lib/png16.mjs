// A 16-bit greyscale PNG written by hand (a level pack's heightmaps). sharp
// takes 16-bit raw input as 8-bit and widens it, which steps the ground, so
// the pack writes its own: one IHDR, the rows filtered `up` (heights change
// slowly from row to row, so it deflates well), one IDAT, real CRCs.
// src/lib/level/png16.js reads it in the browser.
//
//   encodePng16(data: Uint16Array, w, h) → Buffer
//   encodePngRgb(data: Uint8Array (r, g, b a pixel), w, h) → Buffer (a picture: lane G2's nav maps)
//   crc32(bytes) → the PNG chunk's CRC

import { deflateSync } from 'node:zlib';

const TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])));
  return Buffer.concat([head, data, crc]);
}

export function encodePng16(data, w, h) {
  const stride = w * 2;
  const rows = Buffer.alloc(h * (stride + 1));
  const row = Buffer.alloc(stride);
  const prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) row.writeUInt16BE(data[y * w + x], x * 2);
    const o = y * (stride + 1);
    rows[o] = 2; // up
    for (let i = 0; i < stride; i++) rows[o + 1 + i] = (row[i] - prev[i]) & 0xff;
    row.copy(prev);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 16;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

export function encodePngRgb(data, w, h) {
  const stride = w * 3;
  const rows = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    rows[y * (stride + 1)] = 0;
    rows.set(data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // truecolour
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

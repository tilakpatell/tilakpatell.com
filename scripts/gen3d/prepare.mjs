// Your own picture made ready for the 3D model: the empty border trimmed,
// the subject padded into a square (white) with a little room around it,
// and the whole thing at 1024×1024, which is what the model was trained on
// and what Pixal3D's projection assumes (the subject inscribed in the frame).
// Background removal itself is the engine's (BiRefNet).
//
//   node scripts/gen3d/prepare.mjs IN.jpg OUT.png [--size 1024] [--room 0.08]
//   prepare(file, out, opts) → { width, height }

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The square frame around a trimmed subject of w×h, with `room` of the
// square's side left free on every side: [side, left, top] to place it at.
export function frame(w, h, room = 0.08) {
  const side = Math.ceil(Math.max(w, h) / (1 - 2 * room));
  return [side, Math.round((side - w) / 2), Math.round((side - h) / 2)];
}

export async function prepare(file, out, { size = 1024, room = 0.08, background = '#ffffff' } = {}) {
  const { default: sharp } = await import('sharp');
  const trimmed = await sharp(file).flatten({ background }).trim({ background, threshold: 24 }).toBuffer();
  const { width: w, height: h } = await sharp(trimmed).metadata();
  const [side, left, top] = frame(w, h, room);
  // composited, then scaled in a second pass: sharp resizes before it
  // composites whatever the order written, so one pass would shrink the
  // square first and a subject bigger than `size` wouldn't fit in it
  const square = await sharp({ create: { width: side, height: side, channels: 3, background } })
    .composite([{ input: trimmed, left, top }])
    .png()
    .toBuffer();
  await sharp(square).resize(size, size, { kernel: 'lanczos3' }).png().toFile(out);
  return { width: size, height: size, subject: [w, h] };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (n, d) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args.splice(i, 2)[1] : d;
  };
  const opts = { size: Number(flag('size', 1024)), room: Number(flag('room', 0.08)) };
  const [file, out] = args;
  if (!file || !out) throw new Error('usage: node scripts/gen3d/prepare.mjs IN OUT.png [--size N] [--room 0.08]');
  const r = await prepare(resolve(file), resolve(out), opts);
  console.log(`${out}: ${r.width}×${r.height}, the subject ${r.subject.join('×')} before`);
}

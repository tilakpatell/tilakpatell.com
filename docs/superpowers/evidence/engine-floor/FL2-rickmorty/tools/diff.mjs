// Two PNGs, pixel for pixel: how many differ, and where the first does.
//   node diff.mjs a.png b.png [diff.png]
import sharp from 'sharp';

const [a, b, outPath] = process.argv.slice(2);
const read = async (p) => sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const [A, B] = await Promise.all([read(a), read(b)]);
if (A.info.width !== B.info.width || A.info.height !== B.info.height) {
  console.log(`size differs: ${A.info.width}×${A.info.height} against ${B.info.width}×${B.info.height}`);
  process.exit(1);
}
const { width, height } = A.info;
const mark = Buffer.alloc(width * height * 4);
let off = 0;
let first = null;
for (let i = 0; i < width * height; i++) {
  const o = i * 4;
  const same = A.data[o] === B.data[o] && A.data[o + 1] === B.data[o + 1] && A.data[o + 2] === B.data[o + 2];
  mark[o + 3] = 255;
  if (!same) {
    off++;
    first ??= [i % width, Math.floor(i / width)];
    mark[o] = 255;
  } else mark[o] = mark[o + 1] = mark[o + 2] = A.data[o] >> 2;
}
if (outPath && off) await sharp(mark, { raw: { width, height, channels: 4 } }).png().toFile(outPath);
console.log(`${off} of ${width * height} pixels differ${first ? ` (the first at ${first.join(', ')})` : ''}`);
process.exit(off ? 1 : 0);

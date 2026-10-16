// Two renders of the same view, compared: pure, on raw pixel buffers as
// sharp gives them (sharp(file).raw().toBuffer({ resolveWithObject: true })
// → { data, info: { width, height, channels } }). Colour only: alpha is
// left out, since a canvas over the page's background shows none of it.
//
// diff(a, b) → { mad: [r, g, b] (mean absolute difference, 0..255),
//   off (the share of pixels with any channel more than 16/255 apart),
//   psnr (dB over the three channels; Infinity when they're the same) }
// passes({ psnr, off }) → the spec's bar: PSNR ≥ 32 dB and under 2 % off

const OFF_BY = 16; // /255: past this a pixel has visibly changed
const MIN_PSNR = 32; // dB
const MAX_OFF = 0.02;

export function diff(a, b) {
  if (a.width !== b.width || a.height !== b.height) throw new Error(`two sizes: ${a.width}×${a.height} and ${b.width}×${b.height}`);
  const n = a.width * a.height;
  const sum = [0, 0, 0];
  let sq = 0;
  let off = 0;
  for (let i = 0; i < n; i++) {
    const ia = i * a.channels;
    const ib = i * b.channels;
    let worst = 0;
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(a.data[ia + c] - b.data[ib + c]);
      sum[c] += d;
      sq += d * d;
      if (d > worst) worst = d;
    }
    if (worst > OFF_BY) off++;
  }
  const mse = sq / (n * 3);
  return { mad: sum.map((s) => s / n), off: off / n, psnr: mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse) };
}

export const passes = ({ psnr, off }) => psnr >= MIN_PSNR && off < MAX_OFF;

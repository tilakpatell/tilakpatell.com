// How close a KTX2 is to its master, in decibels of PSNR over RGB (lane W's
// `uastc` job: the surfaces design's Q5 measures UASTC colour against the
// export's BC7 master, and the ETC1S the site serves against the same).
// The KTX2 is decoded with three's Basis transcoder (its top level, as
// RGBA8), the master read and sized to match with sharp.
//
//   psnr(a, b) → dB (Infinity when equal), over the RGB of two RGBA8 arrays
//   decodeKtx2(buf) → Promise<{ width, height, rgba }>
//   masterRgba(png, width, height) → Promise<Uint8Array>

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

export function psnr(a, b) {
  if (a.length !== b.length) throw new Error(`sizes differ: ${a.length} and ${b.length} bytes`);
  let sum = 0;
  let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const d = a[i + c] - b[i + c];
      sum += d * d;
      n++;
    }
  }
  if (!sum) return Infinity;
  return Number((10 * Math.log10((255 * 255) / (sum / n))).toFixed(2));
}

let basis = null;
async function transcoder() {
  if (basis) return basis;
  // three's Basis transcoder, read and run for its factory (its file is a browser script)
  const require = createRequire(import.meta.url);
  const dir = dirname(require.resolve('three/examples/jsm/libs/basis/basis_transcoder.js'));
  const src = readFileSync(join(dir, 'basis_transcoder.js'), 'utf8');
  const BASIS = new Function('module', 'exports', '__filename', '__dirname', 'require', `${src}\nreturn BASIS;`)(undefined, undefined, join(dir, 'basis_transcoder.js'), dir, require);
  basis = await BASIS({ wasmBinary: readFileSync(join(dir, 'basis_transcoder.wasm')) });
  basis.initializeBasis();
  return basis;
}

export async function decodeKtx2(buf) {
  const b = await transcoder();
  const k = new b.KTX2File(new Uint8Array(buf));
  try {
    if (!k.isValid() || !k.startTranscoding()) throw new Error('not a KTX2 the transcoder reads');
    const RGBA32 = 13;
    const rgba = new Uint8Array(k.getImageTranscodedSizeInBytes(0, 0, 0, RGBA32));
    k.transcodeImage(rgba, 0, 0, 0, RGBA32, 0, -1, -1);
    return { width: k.getWidth(), height: k.getHeight(), rgba };
  } finally {
    k.close();
    k.delete();
  }
}

export async function masterRgba(png, width, height) {
  const { default: sharp } = await import('sharp');
  const { data } = await sharp(png).resize(width, height, { fit: 'fill', kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

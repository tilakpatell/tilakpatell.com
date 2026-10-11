// A level's light probe from the 2017 drop, made the site's: the game keeps
// each reflection volume as six 128² Radiance faces in its own light units
// (Frostbite's: a cloudy sky over Hoth's plain averages about a hundred),
// and the site wants them where its own sky dome's light sits (a mean
// near 0.8), at the size its quality level loads (src/lib/three/levelSky.js).
//
// encodeRgbe({ data: Float32 RGBA, width, height }) → a .hdr Buffer (run-
//   length scanlines, as three's HDRLoader reads them)
// halve(face) → the face at half its size, each 2 × 2 averaged
// normalise(faces, mean) → new faces scaled so their mean light is `mean`
// luminance(data, i) → texel i's light (Rec. 709)

export const luminance = (d, i) => 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];

// one texel's RGBE: a shared exponent, each channel's 8-bit mantissa
function rgbe(r, g, b, out, at) {
  const v = Math.max(r, g, b);
  if (v < 1e-32) {
    out[at] = out[at + 1] = out[at + 2] = out[at + 3] = 0;
    return;
  }
  const e = Math.ceil(Math.log2(v) + 1e-9);
  const k = 256 / 2 ** e;
  out[at] = Math.min(255, Math.floor(r * k));
  out[at + 1] = Math.min(255, Math.floor(g * k));
  out[at + 2] = Math.min(255, Math.floor(b * k));
  out[at + 3] = e + 128;
}

export function encodeRgbe({ data, width, height }) {
  const head = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`, 'ascii');
  const parts = [head];
  const line = new Uint8Array(width * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      rgbe(data[i], data[i + 1], data[i + 2], line, x * 4);
    }
    // (the run-length form, every channel as plain runs of up to 128: a flat
    // scanline whose first texel happened to read 2, 2 would be taken for
    // a run-length one)
    const out = [2, 2, width >> 8, width & 255];
    for (let c = 0; c < 4; c++)
      for (let x = 0; x < width; x += 128) {
        const n = Math.min(128, width - x);
        out.push(n);
        for (let k = 0; k < n; k++) out.push(line[(x + k) * 4 + c]);
      }
    parts.push(Buffer.from(out));
  }
  return Buffer.concat(parts);
}

export function halve({ data, width, height }) {
  const w = width >> 1;
  const h = height >> 1;
  const out = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 4; c++) {
        let s = 0;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) s += data[((y * 2 + dy) * width + x * 2 + dx) * 4 + c];
        out[(y * w + x) * 4 + c] = s / 4;
      }
  return { data: out, width: w, height: h };
}

export function normalise(faces, mean = 0.8) {
  let sum = 0;
  let n = 0;
  for (const f of faces)
    for (let i = 0; i < f.width * f.height; i++) {
      sum += luminance(f.data, i);
      n++;
    }
  const k = sum > 0 ? (mean * n) / sum : 1;
  return faces.map((f) => {
    const data = new Float32Array(f.data);
    for (let i = 0; i < data.length; i++) if (i % 4 !== 3) data[i] *= k;
    return { ...f, data };
  });
}

// A planet's globe from its skin (lane S3: the galaxy map's disc for a world
// the game gave whole-planet maps and no front-end picture): the colour map
// (equirectangular, once round and pole to pole) laid on a sphere seen
// head-on, lit from the upper left as the front end's own globes are, with
// the clouds over it (the site's cut keeps their coverage in red, and
// bodySkin.js takes smoothstep(cloudCut, 1, red) of it: the same here) and
// the air's colour at the limb where the skin names one. Drawn
// `over` times the size asked and brought down by the caller, so the edge is
// smooth.
//
// renderGlobe({ colour, clouds, cloudCut, atmo, size, over }) → { data: Uint8
//   RGBA, width, height } (width = height = size × over)
//   colour, clouds: { data: Uint8 RGBA, width, height }; atmo: [r, g, b] 0…255
//   or null

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// a map's texel at (u, v) in 0…1, bilinear, wrapping round in u
function sample(map, u, v, out) {
  const { data, width, height } = map;
  const x = (((u % 1) + 1) % 1) * width - 0.5;
  const y = clamp01(v) * (height - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const xa = ((x0 % width) + width) % width;
  const xb = (xa + 1) % width;
  const yb = Math.min(height - 1, y0 + 1);
  for (let c = 0; c < 4; c++) {
    const a = data[(y0 * width + xa) * 4 + c] * (1 - fx) + data[(y0 * width + xb) * 4 + c] * fx;
    const b = data[(yb * width + xa) * 4 + c] * (1 - fx) + data[(yb * width + xb) * 4 + c] * fx;
    out[c] = (a * (1 - fy) + b * fy) / 255;
  }
  return out;
}

export function renderGlobe({ colour, clouds = null, cloudCut = 0.5, atmo = null, size = 96, over = 4 }) {
  const n = size * over;
  const data = new Uint8ClampedArray(n * n * 4);
  // the sun: up and to the left of the viewer, a little in front (the front end's globes are lit so)
  const L = [-0.5, 0.42, 0.76];
  const lLen = Math.hypot(...L);
  const [lx, ly, lz] = L.map((v) => v / lLen);
  const air = atmo ? atmo.map((c) => srgbToLinear(c / 255)) : null;
  const tex = [0, 0, 0, 0];
  const cld = [0, 0, 0, 0];
  const halo = 1.07; // (how far past the limb the air glows, in radii)
  for (let py = 0; py < n; py++) {
    for (let px = 0; px < n; px++) {
      const x = ((px + 0.5) / n) * 2 - 1;
      const y = 1 - ((py + 0.5) / n) * 2;
      const r2 = x * x + y * y;
      const i = (py * n + px) * 4;
      if (r2 > halo * halo) continue;
      if (r2 > 1) {
        // the air past the limb, fading out, lit as the limb there is lit
        if (!air) continue;
        const r = Math.sqrt(r2);
        const fade = (halo - r) / (halo - 1);
        const lit = clamp01(((x / r) * lx + (y / r) * ly) * 0.5 + 0.55);
        for (let c = 0; c < 3; c++) data[i + c] = Math.round(255 * linearToSrgb(air[c]));
        data[i + 3] = Math.round(255 * fade * fade * 0.55 * lit);
        continue;
      }
      const z = Math.sqrt(1 - r2);
      const lon = Math.atan2(x, z);
      const lat = Math.asin(y);
      const u = lon / (2 * Math.PI) + 0.5;
      const v = 0.5 - lat / Math.PI;
      sample(colour, u, v, tex);
      let rr = srgbToLinear(tex[0]);
      let gg = srgbToLinear(tex[1]);
      let bb = srgbToLinear(tex[2]);
      if (clouds) {
        sample(clouds, u, v, cld);
        // (coverage in red, from the cut up to 1 as bodySkin.js's smoothstep takes it)
        const t = clamp01((cld[0] - cloudCut) / (1 - cloudCut));
        const a = t * t * (3 - 2 * t) * 0.92;
        const cw = 0.92; // (a cloud's own light: near white)
        rr += (cw - rr) * a;
        gg += (cw - gg) * a;
        bb += (cw - bb) * a;
      }
      // the light: Lambert with a soft terminator, and a little of the night side kept
      const ndl = x * lx + y * ly + z * lz;
      const lit = 0.06 + 0.94 * clamp01((ndl + 0.12) / 0.62);
      rr *= lit;
      gg *= lit;
      bb *= lit;
      if (air) {
        // the air at the limb: more of it the flatter the view, brightest where the sun is
        const rim = (1 - z) ** 2.4 * (0.25 + 0.75 * clamp01(ndl + 0.3));
        rr += air[0] * rim;
        gg += air[1] * rim;
        bb += air[2] * rim;
      }
      data[i] = Math.round(255 * linearToSrgb(clamp01(rr)));
      data[i + 1] = Math.round(255 * linearToSrgb(clamp01(gg)));
      data[i + 2] = Math.round(255 * linearToSrgb(clamp01(bb)));
      data[i + 3] = 255;
    }
  }
  return { data, width: n, height: n };
}

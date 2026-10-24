// Dimension C-137's planet: Earth, the Smiths' Earth, drawn the way Rick and
// Morty draws it from orbit (it was an alien world of purple lands and ooze,
// which no episode shows: C-137 is ours). The real coasts (Natural Earth's
// 1:50m land, through earth.mjs) inked in the show's dark line, everything in
// flat colour, three cel tones a fill: the sea the show's bright blue,
// stepped deeper away from the coasts with the cyan shallows it rings every
// coast with; the land its greens and yellows by climate, the deserts tan,
// the ranges brown with snow on their crests, the ice white, each shape
// inked round its edge, more thinly inside the coasts. Overhead the show's
// clouds: white puffs with a sky-blue underside and a blue line round them,
// in the belts the real weather keeps, one hurricane wound up. At night the
// cities, posterised to the show's warm yellow.
//
// Makes rickmorty at 4096 (-xl, KTX2), 2048 (-hq), 1024 and 512 (-sm);
// rickmorty-clouds (RGBA) at 2048 (-hq), 1024 and 512 (-sm); rickmorty-night
// and rickmorty-rough (sea 0.25, ice 0.6, land 0.9) at 1024. ONLY=rough makes
// the roughness map alone. PREVIEW=<folder> bakes at 2048 and writes PNGs there instead.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { clamp, eachTexel, fbm, hex, mix, perlin, save, smooth, bakeSize } from './sphere.mjs';
import { DESERTS, RANGES, angleTo, dir, earthLights, landField, rangeDist } from './earth.mjs';

const PREVIEW = process.env.PREVIEW ?? null;
// (8192 × 4096 with --ultra: sphere.mjs's bakeSize)
const [W, H] = PREVIEW ? [2048, 1024] : bakeSize();
const deg = Math.PI / 180;

// region ids, and their colours: [base, shade]
const R = { DEEP: 0, SEA: 1, SHALLOW: 2, PACK: 3, GRASS: 4, FOREST: 5, JUNGLE: 6, SAVANNA: 7, DESERT: 8, ROCK: 9, SNOW: 10, TUNDRA: 11, ICE: 12 };
const COLOURS = [
  ['#1e5cb6', '#1a52a5'],
  ['#2a72cc', '#2566bb'],
  ['#4eb0ea', '#43a1de'],
  ['#dceeff', '#c6e0f7'],
  ['#5fb13e', '#4f9c34'],
  ['#3d8c37', '#33782f'],
  ['#2e8a3e', '#257634'],
  ['#a9c24e', '#97ae43'],
  ['#e2c072', '#d0aa5e'],
  ['#a2764b', '#8d653f'],
  ['#f6faff', '#dde9f7'],
  ['#b3c48e', '#a0b27d'],
  ['#ecf6ff', '#d4e6f7'],
  // (a third, lighter tone of each: an eighth of the way to white)
].map(([a, b]) => [hex(a), hex(b), hex(a).map((v) => v + (1 - v) * 0.125)]);
const water = (id) => id <= R.SHALLOW;
const INK = hex('#1b1a2a');
const CLOUD = hex('#ffffff');
const UNDER = hex('#cfe4f8');
const CLOUD_INK = hex('#6f93c4');
// the hurricane: [lat, lon, size in degrees], wound anticlockwise as the north's are
const STORM = [22, -58, 9];
// the ranges big enough to show from orbit as the show would draw them (the
// narrow ones, the Urals, the Atlas, the Rift, would be a brown worm across the green)
const BIG = RANGES.filter(([, width]) => width >= 1);

// Where the id changes to one `test` takes, a line `r` texels either side:
// the outlines. (Found on the ids, not the colours, so a fill's own tones
// are never inked; widened in two passes, along the rows and down the columns.)
function inkPass(ids, w, h, r, test) {
  const edge = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const me = ids[i];
      const e = ids[y * w + ((x + 1) % w)];
      const s = y + 1 < h ? ids[i + w] : me;
      if ((e !== me && test(me, e)) || (s !== me && test(me, s))) edge[i] = 1;
    }
  }
  if (r <= 0) return edge;
  const row = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!edge[y * w + x]) continue;
      for (let d = -r; d <= r; d++) row[y * w + ((x + d + w) % w)] = 1;
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!row[y * w + x]) continue;
      for (let d = Math.max(0, y - r); d <= Math.min(h - 1, y + r); d++) out[d * w + x] = 1;
    }
  }
  return out;
}

export async function bake() {
  console.log('c-137: tracing the coasts');
  const fine = W / 2048;
  const coast = await landField(W, H, 1.1 * fine);
  const shelf = await landField(W, H, 6 * fine);
  const deep = await landField(W, H, 26 * fine);
  const lights = await earthLights(W, H);
  const n1 = perlin(137);
  const n2 = perlin(138);
  const n3 = perlin(139);
  const nc = perlin(140);
  const nw = perlin(141);
  const ids = new Uint8Array(W * H);
  const shade = new Uint8Array(W * H);
  const landK = new Float32Array(W * H); // (the coast's own soft edge, for its ink)
  const cloud = new Float32Array(W * H); // (the cloud field, read for the puffs and their line)
  const storm = dir(STORM);

  eachTexel(W, H, (x, y, z, i, lat, lon) => {
    const la = lat / deg;
    const lo = lon / deg - 180;
    const rag = fbm(n1, x * 9, y * 9, z * 9, { octaves: 4 });
    const m = coast[i] / 255;
    landK[i] = m;
    let id;
    if (m < 0.5) {
      // ── the sea: the shallows round every coast, then stepped deeper ──
      const near = shelf[i] / 255 + rag * 0.03;
      const far = deep[i] / 255 + rag * 0.02;
      id = near > 0.07 ? R.SHALLOW : far > 0.045 ? R.SEA : R.DEEP;
      // (and its ice, in the high Arctic and round Antarctica)
      if (la + rag * 3 > 78 || la - rag * 3 < -66) id = R.PACK;
    } else {
      // ── the land, by climate ──
      const wet = fbm(n3, x * 5, y * 5, z * 5, { octaves: 4 }) * 0.5 + 0.5;
      // (the climate's lines warped, so the fills meet along a ragged edge, as a painted background's do)
      const wla = la + fbm(nw, x * 4, y * 4, z * 4, { octaves: 4 }) * 7;
      const wlo = lo + fbm(nw, x * 4 + 9, y * 4, z * 4, { octaves: 4 }) * 9;
      const al = Math.abs(wla);
      if (al < 11 && wet > 0.36) id = R.JUNGLE;
      else if (al < 22) id = wet > 0.62 ? R.JUNGLE : R.SAVANNA;
      else if (al < 50) id = wet > 0.6 ? R.FOREST : al < 32 && wet < 0.43 ? R.SAVANNA : R.GRASS;
      else if (al < 66) id = wet > 0.42 ? R.FOREST : R.GRASS;
      else id = R.TUNDRA;
      let desert = -Infinity;
      for (const [s, n, w, e] of DESERTS) desert = Math.max(desert, Math.min(wla - s, n - wla, wlo - w, e - wlo));
      if (desert + rag * 4 > 0) id = R.DESERT;
      // the ranges: rock, snow along their crests (broken into massifs along their length, and the snow into peaks)
      const massif = fbm(n2, x * 14, y * 14, z * 14, { octaves: 3 }) * 0.5 + 0.5;
      const peaks = fbm(n3, x * 55, y * 55, z * 55, { octaves: 3 }) * 0.5 + 0.5;
      let ridge = 0;
      let snowy = 0;
      for (const [pts, width, snow] of BIG) {
        const k = smooth(width, width * 0.25, rangeDist(la, lo, pts) + rag * width * 0.6) * (0.55 + 0.45 * smooth(0.38, 0.6, massif));
        ridge = Math.max(ridge, k);
        snowy = Math.max(snowy, k * snow);
      }
      if (ridge > 0.3) id = R.ROCK;
      if (snowy * (0.55 + 0.6 * peaks) > 0.8) id = R.SNOW;
      // the ice: Antarctica and Greenland
      if (la < -60 + rag * 2 || (lo > -74 && lo < -12 && la > 60 + rag * 2)) id = R.ICE;
    }
    ids[i] = id;
    // the cel tones: darker where a slow noise is high, lighter where it's low
    const tone = fbm(n2, x * 3.5 + 3, y * 3.5, z * 3.5, { octaves: 2 });
    shade[i] = id === R.DEEP ? 0 : tone > 0.14 ? 1 : tone < -0.16 ? 2 : 0;

    // ── the clouds: the show's puffs, in the belts the weather keeps ──
    const al = Math.abs(la);
    let warp = fbm(nw, x * 2.5, y * 2.5, z * 2.5, { octaves: 3 }) * 0.6;
    const a = angleTo(x, y, z, storm);
    if (a < STORM[2] * 2.2) {
      // (a spiral: the cloud read along arms wound round the eye)
      const b = Math.atan2(la - STORM[0], (lo - STORM[1]) * Math.cos(STORM[0] * deg));
      const arm = Math.cos(b * 2 + Math.log(a + 0.3) * 4.2);
      warp += smooth(STORM[2] * 2.2, STORM[2] * 0.4, a) * (arm * 0.55 + 0.35) - smooth(STORM[2] * 0.12, 0, a) * 1.4;
    }
    // (cloudy along the equator and the westerlies, clear over the subtropics' deserts)
    const belts = 0.2 * Math.exp(-(((la - 6) / 7) ** 2)) + 0.16 * Math.exp(-(((al - 52) / 9) ** 2)) - 0.2 * Math.exp(-(((al - 25) / 7) ** 2));
    // (few octaves, so a puff's edge is round lumps, as the show draws one, not ragged)
    cloud[i] = fbm(nc, x * 3.4 + warp, y * 3.4, z * 3.4 - warp, { octaves: 4 }) + Math.abs(fbm(nc, x * 11 + 4, y * 11, z * 11, { octaves: 1 })) * 0.1 + belts + warp * 0.35;
  });

  console.log('c-137: inking');
  const r = Math.max(1, Math.round(fine * 0.75));
  // a thinner line inside the coasts, between the land's fills; the sea's steps a fainter one
  const inner = inkPass(ids, W, H, r, (p, q) => !water(p) && !water(q) && p !== R.PACK && q !== R.PACK);
  const steps = inkPass(ids, W, H, Math.max(0, r - 1), (p, q) => water(p) && water(q));
  const pack = inkPass(ids, W, H, r, (p, q) => (p === R.PACK) !== (q === R.PACK));

  const albedo = new Float32Array(W * H * 3);
  const night = new Float32Array(W * H * 3);
  const clouds = new Float32Array(W * H * 4);
  const rough = new Float32Array(W * H);
  const lamp = hex('#ffd56a');
  for (let i = 0; i < W * H; i++) {
    const id = ids[i];
    let c = COLOURS[id][shade[i]];
    if (inner[i]) c = c.map((v) => v * 0.6);
    if (steps[i]) c = c.map((v) => v * 0.88 + 0.07);
    if (pack[i]) c = INK.map((v, k) => mix(v, c[k], 0.35));
    // the coasts, thick and dark, on the coast's own soft edge (drawn smooth, not stepped)
    const coastInk = Math.exp(-(((landK[i] - 0.5) / 0.2) ** 2));
    c = c.map((v, k) => mix(v, INK[k], coastInk));
    albedo.set(c, i * 3);
    rough[i] = water(id) ? 0.25 : id === R.PACK || id === R.ICE || id === R.SNOW ? 0.6 : 0.9;
    // the night: the cities, in the show's yellow
    const city = smooth(0.18, 0.45, lights[i] / 255) * smooth(0.4, 0.6, landK[i]);
    night.set(lamp.map((v) => v * city), i * 3);
    // the puffs: a hard edge on the field, their underside a little lower in it, a line round them
    const cv = cloud[i];
    const k = smooth(0.206, 0.218, cv);
    const line = Math.exp(-(((cv - 0.21) / 0.007) ** 2));
    // (the underside one flat step, as the show shades: no gradient)
    const under = smooth(0.272, 0.266, cv);
    const cc = [0, 1, 2].map((ch) => mix(mix(CLOUD[ch], UNDER[ch], under), CLOUD_INK[ch], smooth(0.3, 0.85, line)));
    clouds.set([...cc, clamp(Math.max(k * 0.97, line * 0.85))], i * 4);
  }

  if (PREVIEW) {
    fs.mkdirSync(PREVIEW, { recursive: true });
    const png = async (data, ch, name) => {
      const buf = Buffer.alloc(W * H * ch);
      for (let k = 0; k < buf.length; k++) buf[k] = Math.round(clamp(data[k]) * 255);
      await sharp(buf, { raw: { width: W, height: H, channels: ch } }).png().toFile(path.join(PREVIEW, `${name}.png`));
    };
    await png(albedo, 3, 'rickmorty');
    await png(clouds, 4, 'rickmorty-clouds');
    await png(night, 3, 'rickmorty-night');
    return;
  }
  // (ONLY=rough: just the roughness map, the others left as they are)
  if (process.env.ONLY !== 'rough') {
    await save(albedo, W, H, 3, 'rickmorty', [[4096, '-xl'], [2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 90 });
    await save(clouds, W, H, 4, 'rickmorty-clouds', [[2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 86, alphaQuality: 90 });
    await save(night, W, H, 3, 'rickmorty-night', [[1024, '']], { quality: 88 });
  }
  await save(rough, W, H, 1, 'rickmorty-rough', [[1024, '']], { quality: 88 });
}

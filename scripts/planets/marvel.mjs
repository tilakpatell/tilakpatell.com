// Marvel's planet: Earth-616, the comics' own Earth, drawn as a comic book
// draws it (it was Saturn recoloured in gold and red, which no story is set
// on; the landing is the Avengers' compound, upstate, on its lawn). The real
// coasts (Natural Earth's 1:50m land, public domain, via world-atlas) inked
// in black; flat fills, the sea in the page's blue and the land in its greens
// and yellows by climate, the deserts, the ranges and the ice where they
// are, and each fill's tone laid in Ben-Day dots, as the old four-colour
// presses printed it. Its own places are there for anyone who knows where to
// look: the Savage Land's jungle in its warm valley in the Antarctic ice,
// ringed by its volcanoes; Wakanda, in the East African highlands, hidden by
// day as Wakanda hides (forest from orbit) and lit violet by night;
// Genosha, an island off Madagascar; and at night Avengers Tower over New
// York the brightest light on the planet, Kamar-Taj's gold over Kathmandu
// and Latveria's green. Overhead, the comics' clouds: flat white puffs, inked,
// their undersides dotted, two hurricanes wound tight.
//
// Makes marvel at 4096 (-xl, KTX2), 2048 (-hq), 1024 and 512 (-sm);
// marvel-clouds (RGBA) at 2048, 1024 and 512; marvel-night and marvel-rough
// at 1024. PREVIEW=<folder> bakes at 2048 and writes PNGs there instead.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import { clamp, eachTexel, fbm, hex, mix, mix3, perlin, raster, save, smooth, bakeSize } from './sphere.mjs';

const PREVIEW = process.env.PREVIEW ?? null;
const [W, H] = PREVIEW ? [2048, 1024] : bakeSize();
const deg = Math.PI / 180;
const require = createRequire(import.meta.url);

// the page's inks
const C = Object.fromEntries(
  Object.entries({
    sea: '#2d82d2', seaDot: '#1c5fae', shelf: '#5ab6ec', shelfDot: '#3a95d6',
    jungle: '#2e9a46', jungleDot: '#1d7233', savanna: '#a2c653', savannaDot: '#7ea43a', grass: '#62b457', grassDot: '#3f8f45',
    boreal: '#3d7d52', borealDot: '#2a5e3c', tundra: '#b7c6a4', tundraDot: '#8fa283', sand: '#f0c963', sandDot: '#d9973a',
    rock: '#a8734a', rockDot: '#7a4e30', snow: '#f6faff', iceDot: '#a9cdf0', ink: '#15161c',
    cloud: '#ffffff', cloudDot: '#bcd6f2', savage: '#2fb64a', savageDot: '#1b8a35', ash: '#6b5a52',
  }).map(([k, v]) => [k, hex(v)]),
);

// the deserts: [lat south, lat north, lon west, lon east], read through a warp so none is a box
const DESERTS = [
  [15, 33, -17, 33], // the Sahara
  [14, 31, 34, 58], // Arabia
  [24, 38, 50, 66], // Iran's deserts
  [36, 46, 56, 70], // the Karakum and Kyzylkum
  [37, 46, 75, 112], // the Taklamakan and the Gobi
  [-31, -19, 118, 142], // Australia's red middle
  [-28, -17, 13, 25], // the Kalahari and the Namib
  [-27, -16, -71, -68], // the Atacama
  [28, 37, -117, -104], // the American south-west
  [23, 30, 68, 74], // the Thar
  [-5, 0, 39, 44], // the Horn's dry coast
];
// the ranges: lines of [lat, lon], each with its width in degrees and how much snow it holds
const RANGES = [
  [[[35, 72], [32, 78], [29, 83], [28, 86], [27.5, 90], [28, 95]], 2.6, 1], // the Himalaya
  [[[34, 80], [33, 88], [33, 96]], 5.5, 0], // the Tibetan plateau behind it
  [[[39, 70], [37, 74], [36, 77]], 1.8, 0.8], // the Pamirs and the Karakoram
  [[[8, -77], [0, -78], [-10, -76], [-18, -69], [-28, -69], [-40, -71], [-52, -73]], 1.8, 0.8], // the Andes
  [[[60, -140], [55, -128], [49, -116], [43, -110], [37, -106], [32, -108]], 2.4, 0.5], // the Rockies
  [[[44, 6], [46, 8], [47, 11], [47, 14]], 1.0, 0.8], // the Alps
  [[[42.5, 43], [43, 46]], 0.8, 0.5], // the Caucasus
  [[[68, 64], [60, 59], [52, 58]], 0.9, 0], // the Urals
  [[[31, -8], [33, -3], [35, 3]], 0.9, 0], // the Atlas
  [[[10, 38], [4, 36.5], [-4, 35.5], [-9, 34]], 0.8, 0], // the East African highlands, the Rift
];
// its places: [lat, lon]
const SAVAGE = [-75, -42];
const WAKANDA = [3, 35.5];
const GENOSHA = [-12.5, 52.5];
const TOWER = [40.75, -73.99];
const KAMARTAJ = [27.7, 85.3];
const LATVERIA = [46, 22];
// the hurricanes: [lat, lon, size in degrees, which way they turn]
const STORMS = [
  [24, -62, 7, 1],
  [16, 138, 8, 1],
  [-18, 72, 6, -1],
];

const dir = ([la, lo]) => {
  const p = (lo + 180) * deg;
  const t = (90 - la) * deg;
  return [-Math.cos(p) * Math.sin(t), Math.cos(t), Math.sin(p) * Math.sin(t)];
};
// the angle between a texel's direction and a place's, in degrees
const angleTo = (x, y, z, d) => Math.acos(clamp(x * d[0] + y * d[1] + z * d[2], -1, 1)) / deg;
// the distance in degrees from (lat, lon) to a range's line (near enough, on the local flat)
function rangeDist(la, lo, pts) {
  let best = Infinity;
  const k = Math.cos(la * deg);
  for (let i = 0; i < pts.length - 1; i++) {
    const [a0, b0] = pts[i];
    const [a1, b1] = pts[i + 1];
    const dx = (b1 - b0) * k;
    const dy = a1 - a0;
    const t = clamp(((lo - b0) * k * dx + (la - a0) * dy) / (dx * dx + dy * dy || 1));
    best = Math.min(best, Math.hypot((lo - b0) * k - dx * t, la - a0 - dy * t));
  }
  return best;
}

// Ben-Day dots: a screen laid on the cube round the sphere (even everywhere,
// the poles too), `n` dots across a face; 1 inside a dot, its area `tone`
function dots(x, y, z, n, tone) {
  if (tone <= 0) return 0;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const az = Math.abs(z);
  let u;
  let v;
  if (ax >= ay && ax >= az) [u, v] = [y / ax, z / ax];
  else if (ay >= az) [u, v] = [x / ay, z / ay];
  else [u, v] = [x / az, y / az];
  const gu = (u * 0.5 + 0.5) * n;
  const gv = (v * 0.5 + 0.5) * n;
  const d = Math.hypot(gu - Math.floor(gu) - 0.5, gv - Math.floor(gv) - 0.5);
  const r = Math.sqrt(clamp(tone) / Math.PI);
  return smooth(r + 0.07, r - 0.07, d);
}

// the land, as Natural Earth draws it, on the map's own grid: white land on black
async function landField(w, h, soften) {
  const topo = JSON.parse(fs.readFileSync(require.resolve('world-atlas/land-50m.json'), 'utf8'));
  const land = feature(topo, topo.objects.land);
  const projection = geoEquirectangular()
    .scale(w / (2 * Math.PI))
    .translate([w / 2, h / 2])
    .precision(0.05);
  const d = geoPath(projection)(land);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#000"/><path d="${d}" fill="#fff"/></svg>`;
  return raster(svg, w, h, soften);
}

// the night: the real Earth's lights (Solar System Scope's night map, already the universe's), as luminance
async function earthLights(w, h) {
  const file = path.resolve('public/textures/universe/earth-night-hq.webp');
  const { data } = await sharp(file).resize(w, h, { fit: 'fill', kernel: 'lanczos3' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  return data;
}

export async function bake() {
  console.log('Earth-616: tracing the coasts');
  const fine = W / 2048;
  const coast = await landField(W, H, 1.1 * fine);
  const shelf = await landField(W, H, 9 * fine);
  const lights = await earthLights(W, H);
  console.log('Earth-616: inking the page');
  const n1 = perlin(616);
  const n2 = perlin(617);
  const n3 = perlin(618);
  const nc = perlin(619);
  const nw = perlin(620);
  const albedo = new Float32Array(W * H * 3);
  const rough = new Float32Array(W * H * 3);
  const night = new Float32Array(W * H * 3);
  const clouds = new Float32Array(W * H * 4);
  const DOTS = 150; // (a dot's about five texels at 4096: still dots up close, a tone from afar)
  const places = { savage: dir(SAVAGE), wakanda: dir(WAKANDA), genosha: dir(GENOSHA), tower: dir(TOWER), kamartaj: dir(KAMARTAJ), latveria: dir(LATVERIA) };
  const storms = STORMS.map(([la, lo, size, turn]) => ({ d: dir([la, lo]), la, lo, size, turn }));

  eachTexel(W, H, (x, y, z, i, lat, lon) => {
    const la = lat / deg;
    const lo = (lon / deg) - 180;
    const al = Math.abs(la);
    const rag = fbm(n1, x * 9, y * 9, z * 9, { octaves: 4 });
    const grain = fbm(n2, x * 40, y * 40, z * 40, { octaves: 3 }) * 0.5 + 0.5;
    // ── the land: the coasts (and Genosha, out off Madagascar) ──
    let m = coast[i] / 255;
    const gen = angleTo(x, y, z, places.genosha);
    m = Math.max(m, smooth(2.6, 2.2, gen + rag * 0.6));
    const landK = smooth(0.4, 0.6, m);
    const inkCoast = Math.exp(-(((m - 0.5) / 0.17) ** 2));
    // ── the sea: the page's blue, its tone deeper away from the coasts ──
    const near = shelf[i] / 255;
    const shallow = smooth(0.02, 0.3, near) * (1 - landK);
    let col = mix3(C.sea, C.seaDot, dots(x, y, z, DOTS, 0.18 + 0.22 * smooth(0.3, 0.0, near)));
    col = mix3(col, mix3(C.shelf, C.shelfDot, dots(x, y, z, DOTS, 0.18)), shallow);
    // ── the land's fills, by climate ──
    const wet = fbm(n3, x * 5, y * 5, z * 5, { octaves: 4 }) * 0.5 + 0.5;
    // (the climate's lines warped, so the fills meet along a colourist's ragged edge, not a ruler's)
    const wla = la + fbm(nw, x * 4, y * 4, z * 4, { octaves: 4 }) * 7;
    const wlo = lo + fbm(nw, x * 4 + 9, y * 4, z * 4, { octaves: 4 }) * 9;
    let desert = 0;
    for (const [s, n, w, e] of DESERTS) desert = Math.max(desert, smooth(-0.4, 0.4, Math.min(wla - s, n - wla, wlo - w, e - wlo)));
    const al2 = Math.abs(wla);
    let fill;
    let dot;
    if (al2 < 11 && wet > 0.36) [fill, dot] = [C.jungle, C.jungleDot];
    else if (al2 < 22) [fill, dot] = [C.savanna, C.savannaDot];
    else if (al2 < 52) [fill, dot] = [C.grass, C.grassDot];
    else if (al2 < 67) [fill, dot] = [C.boreal, C.borealDot];
    else [fill, dot] = [C.tundra, C.tundraDot];
    // (the fills meet raggedly, as a colourist's do: a blend across the line)
    let ground = mix3(fill, dot, dots(x, y, z, DOTS, 0.12 + 0.28 * smooth(0.3, 0.8, wet)));
    if (al2 > 18 && al2 < 32) ground = mix3(ground, mix3(C.savanna, C.savannaDot, dots(x, y, z, DOTS, 0.2)), smooth(0.47, 0.43, wet));
    ground = mix3(ground, mix3(C.sand, C.sandDot, dots(x, y, z, DOTS, 0.12 + 0.2 * grain)), desert);
    // the ranges: rock, dotted dark, snow along their crests
    let ridge = 0;
    let snowy = 0;
    // (broken into massifs along its length, and its snow into peaks)
    const massif = smooth(0.38, 0.6, fbm(n2, x * 14, y * 14, z * 14, { octaves: 3 }) * 0.5 + 0.5);
    const peaks = fbm(n3, x * 55, y * 55, z * 55, { octaves: 3 }) * 0.5 + 0.5;
    for (const [pts, width, snow] of RANGES) {
      const k = smooth(width, width * 0.25, rangeDist(la, lo, pts) + rag * width * 0.6) * (0.55 + 0.45 * massif);
      ridge = Math.max(ridge, k);
      snowy = Math.max(snowy, k * snow);
    }
    ground = mix3(ground, mix3(C.rock, C.rockDot, dots(x, y, z, DOTS, 0.2 + 0.25 * grain)), smooth(0.25, 0.32, ridge + (grain - 0.5) * 0.15));
    ground = mix3(ground, C.snow, smooth(0.78, 0.84, snowy * (0.55 + 0.6 * peaks)) * 0.95);
    // the ice: Antarctica and Greenland, white dotted blue
    const ice = Math.max(smooth(-58, -63, la), smooth(-74, -71, lo) * smooth(-10, -14, lo) * smooth(59, 61, la));
    ground = mix3(ground, mix3(C.snow, C.iceDot, dots(x, y, z, DOTS, 0.14 + 0.16 * smooth(0.4, 0.8, grain))), ice);
    // the Savage Land: a warm valley of jungle in the ice, steam over it, its volcanoes round it
    const sav = angleTo(x, y, z, places.savage) + rag * 0.8;
    ground = mix3(ground, mix3(C.savage, C.savageDot, dots(x, y, z, DOTS, 0.3)), smooth(4.2, 3.6, sav));
    ground = mix3(ground, mix3(C.ash, C.ink, dots(x, y, z, DOTS, 0.35)), Math.exp(-(((sav - 4.4) / 0.45) ** 2)));
    // Wakanda: by day what it shows the world, forest on its highlands, a little darker than the land round it
    ground = mix3(ground, mix3(C.jungle, C.jungleDot, dots(x, y, z, DOTS, 0.45)), smooth(3.4, 2.6, angleTo(x, y, z, places.wakanda) + rag));
    col = mix3(col, ground, landK);
    // (and the sea's own ice, in the high Arctic)
    col = mix3(col, mix3(C.snow, C.iceDot, dots(x, y, z, DOTS, 0.22)), smooth(77, 80, la + rag * 3) * (1 - landK));
    col = mix3(col, C.ink, inkCoast * 0.9);
    const o = i * 3;
    albedo[o] = col[0];
    albedo[o + 1] = col[1];
    albedo[o + 2] = col[2];
    // the sea glossy, the land matte
    rough[o] = rough[o + 1] = rough[o + 2] = mix(0.35, 0.95, landK);

    // ── the night: the cities posterised to the page's yellow, and its own lights ──
    const city = smooth(0.18, 0.45, lights[i] / 255) * landK;
    const tower = Math.exp(-((angleTo(x, y, z, places.tower) / 0.55) ** 2));
    const wak = Math.exp(-((angleTo(x, y, z, places.wakanda) / 0.9) ** 2));
    const taj = Math.exp(-((angleTo(x, y, z, places.kamartaj) / 0.5) ** 2));
    const lat9 = Math.exp(-((angleTo(x, y, z, places.latveria) / 0.45) ** 2));
    const gn = Math.exp(-((gen / 1.2) ** 2));
    night[o] = clamp(city * 1.0 + tower * 1.6 + wak * 0.55 + taj * 1.1 + lat9 * 0.2 + gn * 0.6);
    night[o + 1] = clamp(city * 0.82 + tower * 1.6 + wak * 0.35 + taj * 0.82 + lat9 * 1.0 + gn * 0.5);
    night[o + 2] = clamp(city * 0.3 + tower * 1.7 + wak * 1.2 + taj * 0.2 + lat9 * 0.25 + gn * 0.35);

    // ── the clouds: flat puffs, inked, their undersides dotted; two hurricanes ──
    let warp = fbm(nw, x * 2.5, y * 2.5, z * 2.5, { octaves: 3 }) * 0.6;
    for (const st of storms) {
      const a = angleTo(x, y, z, st.d);
      if (a > st.size * 2.2) continue;
      // (a spiral: the cloud read along arms wound round the eye)
      const b = Math.atan2(la - st.la, (lo - st.lo) * Math.cos(st.la * deg));
      const arm = Math.cos(b * 2 + st.turn * Math.log(a + 0.3) * 4.2);
      warp += smooth(st.size * 2.2, st.size * 0.4, a) * (arm * 0.55 + 0.35) - smooth(st.size * 0.12, 0.0, a) * 1.4;
    }
    const belts = 0.22 * Math.exp(-(((la - 6) / 7) ** 2)) + 0.16 * Math.exp(-(((al - 52) / 9) ** 2)) - 0.18 * Math.exp(-(((al - 25) / 7) ** 2));
    const cv = fbm(nc, x * 3.2 + warp, y * 3.2, z * 3.2 - warp, { octaves: 5 }) + belts + warp * 0.35;
    const cloudK = smooth(0.2, 0.235, cv);
    const inkCloud = Math.exp(-(((cv - 0.215) / 0.012) ** 2));
    const under = smooth(0.32, 0.22, cv) * cloudK; // (the edge of a puff, its underside, dotted)
    const cc = mix3(C.cloud, C.cloudDot, dots(x, y, z, DOTS, 0.3) * under);
    const q = i * 4;
    const inked = mix3(cc, C.ink, smooth(0.25, 0.8, inkCloud));
    clouds[q] = inked[0];
    clouds[q + 1] = inked[1];
    clouds[q + 2] = inked[2];
    clouds[q + 3] = clamp(Math.max(cloudK, inkCloud * 0.95));
  });

  if (PREVIEW) {
    fs.mkdirSync(PREVIEW, { recursive: true });
    const png = async (data, ch, name) => {
      const buf = Buffer.alloc(W * H * ch);
      for (let k = 0; k < buf.length; k++) buf[k] = Math.round(clamp(data[k]) * 255);
      await sharp(buf, { raw: { width: W, height: H, channels: ch } }).png().toFile(path.join(PREVIEW, `${name}.png`));
    };
    await png(albedo, 3, 'marvel');
    await png(clouds, 4, 'marvel-clouds');
    await png(night, 3, 'marvel-night');
    return;
  }
  await save(albedo, W, H, 3, 'marvel', [[4096, '-xl'], [2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 90 });
  await save(clouds, W, H, 4, 'marvel-clouds', [[2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 86, alphaQuality: 90 });
  await save(night, W, H, 3, 'marvel-night', [[1024, '']], { quality: 88 });
  await save(rough, W, H, 3, 'marvel-rough', [[1024, '']], { quality: 84 });
}

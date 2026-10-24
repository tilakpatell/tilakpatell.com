// The real Earth, for the bakers that draw it in a fandom's own hand
// (Marvel's Earth-616, Dimension C-137): its coasts from Natural Earth's
// 1:50m land (public domain, via world-atlas), its deserts and ranges where
// they are, and its cities' lights, from the map's own night map.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import { clamp, raster } from './sphere.mjs';

const deg = Math.PI / 180;
const require = createRequire(import.meta.url);

// the deserts: [lat south, lat north, lon west, lon east], read through a warp so none is a box
export const DESERTS = [
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
export const RANGES = [
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

// a place's direction on the sphere, in sphere.mjs's layout
export const dir = ([la, lo]) => {
  const p = (lo + 180) * deg;
  const t = (90 - la) * deg;
  return [-Math.cos(p) * Math.sin(t), Math.cos(t), Math.sin(p) * Math.sin(t)];
};
// the angle between a texel's direction and a place's, in degrees
export const angleTo = (x, y, z, d) => Math.acos(clamp(x * d[0] + y * d[1] + z * d[2], -1, 1)) / deg;
// the distance in degrees from (lat, lon) to a range's line (near enough, on the local flat)
export function rangeDist(la, lo, pts) {
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

// the land, as Natural Earth draws it, on the map's own grid: white land on black
export async function landField(w, h, soften) {
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
export async function earthLights(w, h) {
  const file = path.resolve('public/textures/universe/earth-night-hq.webp');
  const { data } = await sharp(file).resize(w, h, { fit: 'fill', kernel: 'lanczos3' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  return data;
}

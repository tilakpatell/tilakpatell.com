// The Office's planet: Scranton's own country, the Electric City in the
// Lackawanna Valley, north-east Pennsylvania (it was a crumpled sheet of
// Dunder Mifflin's letterhead, which no episode is set on; the landing is
// the business park's lot). The real places, authored in degrees from the
// state and USGS maps, laid on a 1000 × 1000 km sheet round Scranton and put
// on the globe by the azimuthal projection Breaking Bad's and Middle-earth's
// planets use, so the north-east is the face the planet shows: the ridge
// and valley country curving across the middle in its long folded ridges,
// the rivers cutting through them at their gaps (the Susquehanna and its
// branches, the Juniata, the Lehigh, the Schuylkill, the Delaware), the
// Allegheny Plateau's forest to the west and north, the Poconos' lakes and
// bogs, Lancaster's farms in a patchwork, the Atlantic from Delmarva to Long
// Island with the Chesapeake, Lakes Erie and Ontario, the Finger Lakes. In
// the peak of autumn: oak, maple and birch in gold, orange and red over the
// green, the pines dark. Scranton's valley is a grey strip of town and old
// culm banks from Carbondale down to Pittston; Schrute Farms' beets are near
// Honesdale. At night the cities light, and among them every Dunder Mifflin
// branch: Scranton, Stamford, Utica, Nashua, Albany, Buffalo, Binghamton,
// Yonkers and Camden. Past the sheet the world goes on as the woods, ridges
// and farms of the east, with a sea of its own. Overhead, fair-weather
// cumulus in streets and a cold front coming through.
//
// Makes office at 4096 (-xl, KTX2), 2048 (-hq), 1024 and 512 (-sm);
// office-normal at 2048, 1024 and 512; office-night and office-rough at
// 1024 (the clouds are painted into the colour). PREVIEW=<folder> bakes at 2048
// and writes PNGs there instead.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { clamp, curve, eachTexel, fbm, hex, mix, mix3, normalMap, perlin, raster, ridged, sampler, save, smooth, bakeSize } from './sphere.mjs';

const PREVIEW = process.env.PREVIEW ?? null;
const [W, H] = PREVIEW ? [2048, 1024] : bakeSize();
const deg = Math.PI / 180;

// ── the sheet: km round Scranton, x east, y south ──
const SCRANTON = [41.409, -75.662];
const KM_LAT = 110.95;
const KM_LON = 111.32 * Math.cos(SCRANTON[0] * deg);
const sheet = ([lat, lon]) => [500 + (lon - SCRANTON[1]) * KM_LON, 500 - (lat - SCRANTON[0]) * KM_LAT];
// (a radian of the globe in sheet km: Pittsburgh to Long Island fills the face shown)
const KM_PER_RAD = 420;
const BOX = { x0: -60, y0: -60, x1: 1060, y1: 1060 };

// the Atlantic, east and south of the coast (Delmarva, Delaware Bay, the
// Jersey Shore, New York harbour, round Long Island and back along the
// Sound to Connecticut and out)
const SEA = [
  [36.0, -70.0], [36.6, -75.9], [37.5, -75.6], [38.33, -75.08], [38.78, -75.14], [39.1, -75.35], [39.45, -75.55], [39.62, -75.56],
  [39.35, -75.2], [39.05, -74.95], [38.93, -74.9], [39.36, -74.42], [39.8, -74.1], [40.22, -74.0], [40.45, -74.0], [40.55, -74.06],
  [40.62, -74.04], [40.58, -73.9], [40.6, -73.5], [40.72, -73.0], [40.85, -72.4], [41.07, -71.86], [41.1, -72.3], [41.0, -73.0],
  [40.9, -73.6], [40.82, -73.79], [40.95, -73.7], [41.1, -73.3], [41.25, -72.8], [41.3, -72.0], [41.4, -71.2], [41.5, -70.6],
  [41.9, -70.0], [42.4, -70.6], [43.0, -70.7], [43.7, -70.1], [44.3, -68.6], [44.5, -66.0], [36.0, -66.0],
];
const CHESAPEAKE = [
  [39.56, -76.08], [39.4, -76.25], [39.2, -76.42], [38.95, -76.45], [38.6, -76.42], [38.3, -76.38], [38.0, -76.25], [37.6, -76.28],
  [37.2, -76.22], [36.95, -76.05], [37.0, -75.95], [37.5, -75.95], [37.9, -75.88], [38.3, -76.08], [38.6, -76.25], [38.9, -76.22],
  [39.2, -76.15], [39.5, -76.02],
];
const LAKES = [
  // Lake Erie
  [[42.9, -78.9], [42.6, -79.2], [42.25, -79.75], [42.13, -80.08], [41.95, -80.6], [41.75, -81.3], [41.5, -81.7], [41.45, -82.5], [41.68, -83.45],
    [41.95, -83.3], [42.3, -83.05], [42.25, -82.4], [42.55, -81.5], [42.65, -80.6], [42.8, -80.0], [42.88, -79.3]],
  // Lake Ontario
  [[43.25, -79.8], [43.65, -79.4], [43.85, -78.8], [43.95, -77.9], [43.95, -77.0], [44.1, -76.4], [43.5, -76.2], [43.3, -77.3], [43.32, -78.3], [43.22, -79.1]],
  // Lake Wallenpaupack, Raystown
  [[41.48, -75.3], [41.44, -75.22], [41.38, -75.18], [41.4, -75.24], [41.45, -75.28]],
  [[40.46, -78.04], [40.38, -78.02], [40.3, -78.08], [40.34, -78.1], [40.42, -78.06]],
];
// the Finger Lakes, long and narrow: [width km, [[lat, lon]…]]
const FINGERS = [
  [3, [[42.42, -76.88], [42.65, -76.92], [42.87, -76.96]]], // Seneca
  [2.8, [[42.45, -76.5], [42.7, -76.66], [42.92, -76.73]]], // Cayuga
  [1.6, [[42.43, -77.17], [42.6, -77.1], [42.66, -77.05]]], // Keuka
  [1.5, [[42.67, -77.3], [42.82, -77.28], [42.87, -77.27]]], // Canandaigua
  [1.2, [[42.72, -76.5], [42.88, -76.53]]], // Owasco
  [1.2, [[42.78, -76.3], [42.94, -76.43]]], // Skaneateles
];
// the rivers: [width km, [[lat, lon]…]]
const RIVERS = [
  [1.3, [[42.0, -75.75], [41.9, -75.82], [41.73, -75.95], [41.55, -75.95], [41.43, -75.86], [41.33, -75.79], [41.25, -75.88], [41.15, -76.05], [41.05, -76.23], [40.95, -76.6], [40.86, -76.79], [40.6, -76.93], [40.4, -77.0], [40.27, -76.88], [40.1, -76.7], [40.03, -76.5], [39.8, -76.25], [39.66, -76.17], [39.56, -76.08]]], // the Susquehanna
  [0.9, [[41.0, -78.4], [41.14, -77.45], [41.24, -77.0], [41.1, -76.9], [40.96, -76.88], [40.86, -76.79]]], // the West Branch
  [0.6, [[40.48, -78.01], [40.6, -77.57], [40.5, -77.3], [40.4, -77.03]]], // the Juniata
  [0.7, [[41.6, -75.48], [41.5, -75.57], [41.41, -75.66], [41.33, -75.79]]], // the Lackawanna, through Scranton
  [1.0, [[41.95, -75.28], [41.75, -75.05], [41.47, -74.98], [41.37, -74.69], [41.15, -74.92], [40.97, -75.14], [40.69, -75.21], [40.45, -75.05], [40.22, -74.76], [39.95, -75.14], [39.75, -75.5], [39.62, -75.56]]], // the Delaware
  [0.6, [[41.06, -75.77], [40.87, -75.73], [40.72, -75.6], [40.6, -75.47], [40.69, -75.21]]], // the Lehigh
  [0.6, [[40.68, -76.2], [40.5, -76.05], [40.34, -75.93], [40.15, -75.5], [39.95, -75.18]]], // the Schuylkill
  [0.8, [[41.84, -79.15], [41.43, -79.71], [41.0, -79.55], [40.81, -79.52], [40.44, -80.0]]], // the Allegheny
  [0.7, [[39.63, -79.96], [40.1, -79.9], [40.44, -80.0]]], // the Monongahela
  [1.1, [[40.44, -80.0], [40.69, -80.31], [40.6, -80.6], [40.4, -80.8], [39.9, -80.85]]], // the Ohio
  [1.4, [[40.7, -74.02], [41.0, -73.92], [41.4, -73.95], [41.7, -73.94], [42.1, -73.93], [42.65, -73.75], [43.3, -73.6]]], // the Hudson
  [0.6, [[42.78, -73.7], [42.9, -74.3], [43.0, -74.9], [43.1, -75.23], [43.2, -75.45]]], // the Mohawk
];
// the ridge and valley country: its axis, south-west to north-east, and how wide it runs either side
const RIDGE_AXIS = [[39.6, -78.6], [40.2, -78.0], [40.55, -77.4], [40.8, -76.8], [40.98, -76.3], [41.18, -75.95], [41.45, -75.6], [41.6, -75.45]];
const RIDGE_HALF = 44; // km
// the mountains: [lat, lon, radius km, height] (the Catskills, the Adirondacks, Laurel Highlands, South Mountain)
const MASSIFS = [[42.1, -74.35, 40, 0.7], [44.1, -74.2, 75, 0.85], [39.95, -79.25, 35, 0.5], [39.95, -77.45, 22, 0.4], [44.4, -72.8, 55, 0.7]];
// regions: the Poconos' plateau, Lancaster's farms, the coal valleys
const POCONOS = [41.15, -75.4, 38];
const LANCASTER = [40.03, -76.25, 45];
const COAL = [[41.6, -75.48], [41.41, -75.66], [41.25, -75.88], [41.12, -76.05]];
const SCHRUTE = [41.6, -75.25];
// the cities: [lat, lon, radius km, brightness, a Dunder Mifflin branch?]
const CITIES = [
  [40.71, -74.0, 24, 1.0], [39.95, -75.16, 15, 0.9], [40.44, -79.99, 11, 0.75], [39.29, -76.61, 12, 0.8], [41.41, -75.66, 7, 1.0, true],
  [41.25, -75.88, 5.5, 0.7], [40.6, -75.47, 6, 0.7], [40.27, -76.88, 5, 0.6], [40.34, -75.93, 4.5, 0.6], [40.04, -76.31, 4, 0.55],
  [42.13, -80.08, 4.5, 0.55], [42.1, -75.91, 4, 0.6, true], [41.24, -77.0, 3, 0.45], [40.79, -77.86, 3, 0.45], [40.22, -74.76, 4, 0.55],
  [39.74, -75.55, 4, 0.55], [42.65, -73.75, 5.5, 0.6, true], [43.05, -76.15, 5.5, 0.6], [42.89, -78.88, 7.5, 0.7, true], [43.16, -77.61, 6.5, 0.65],
  [43.1, -75.23, 3.5, 0.6, true], [41.05, -73.54, 4, 0.7, true], [42.77, -71.47, 3.5, 0.6, true], [41.76, -72.67, 5.5, 0.6], [41.31, -72.92, 4.5, 0.55],
  [40.93, -73.9, 3, 0.7, true], [39.93, -75.12, 3, 0.7, true], [42.36, -71.06, 13, 0.85], [40.0, -75.7, 3, 0.4], [41.57, -75.5, 2.2, 0.45],
];
// the interstates, faint threads of light by night: I-81 up the valleys through Scranton, I-80 across, the Turnpike, I-95, I-84, I-90
const ROADS = [
  [[39.7, -77.7], [40.25, -77.0], [40.6, -76.4], [41.0, -76.0], [41.41, -75.66], [41.95, -75.7], [42.1, -75.91], [43.05, -76.15], [44.0, -75.9]],
  [[41.1, -80.5], [41.15, -79.0], [41.0, -77.8], [41.12, -77.0], [41.05, -76.2], [41.0, -75.2], [40.9, -74.4], [40.85, -74.0]],
  [[40.0, -80.4], [40.2, -79.0], [40.15, -78.0], [40.25, -76.9], [40.15, -76.1], [40.1, -75.3], [40.15, -74.75]],
  [[39.29, -76.61], [39.74, -75.55], [39.95, -75.16], [40.22, -74.76], [40.71, -74.0], [41.05, -73.54], [41.31, -72.92], [41.8, -71.4], [42.36, -71.06]],
  [[41.41, -75.66], [41.45, -74.9], [41.5, -74.0], [41.76, -72.67]],
  [[42.89, -78.88], [43.05, -76.15], [43.1, -75.23], [42.65, -73.75], [42.4, -72.5], [42.36, -71.06]],
];

const at = (p) => sheet(p).map((v) => +v.toFixed(2));
const pts = (list) => list.map(at);
const poly = (list) => `<path d="${curve(pts(list))}" fill="#fff"/>`;
const line = (list, width, extra = '') => `<path d="${curve(pts(list), false)}" fill="none" stroke="#fff" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const disc = (p, r, extra = '') => {
  const [x, y] = at(p);
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" ${extra}/>`;
};
async function layer(body, density, soften = 0) {
  const w = (BOX.x1 - BOX.x0) * density;
  const h = (BOX.y1 - BOX.y0) * density;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${BOX.x0} ${BOX.y0} ${BOX.x1 - BOX.x0} ${BOX.y1 - BOX.y0}"><rect x="${BOX.x0}" y="${BOX.y0}" width="${BOX.x1 - BOX.x0}" height="${BOX.y1 - BOX.y0}" fill="#000"/>${body}</svg>`;
  const s = sampler(await raster(svg, w, h, soften * density), w, h);
  return (x, y) => s((x - BOX.x0) * density, (y - BOX.y0) * density);
}
// a point's place across and along the ridge country's axis, in km
const AX = pts(RIDGE_AXIS);
// (past either end, `along` runs on beyond it, so the ridges end there rather than ringing round it)
function ridgeFrame(x, y) {
  let best = { d: Infinity, along: 0, across: 0 };
  let run = 0;
  for (let k = 0; k < AX.length - 1; k++) {
    const [ax, ay] = AX[k];
    const [bx, by] = AX[k + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    const raw = ((x - ax) * dx + (y - ay) * dy) / (len * len);
    const t = clamp(raw);
    const d = Math.hypot(x - ax - dx * t, y - ay - dy * t);
    if (d < best.d) {
      // (which side: north-west of the axis is negative; x runs east and y south)
      const side = -Math.sign((x - ax) * dy - (y - ay) * dx) || 1;
      const beyond = (k === 0 && raw < 0) || (k === AX.length - 2 && raw > 1);
      best = { d, along: run + (beyond ? raw : t) * len, across: (beyond ? Math.abs((x - ax) * dy - (y - ay) * dx) / len : d) * side };
    }
    run += len;
  }
  best.total = run;
  return best;
}

export async function bake() {
  console.log('the office: drawing the north-east');
  const sea = await layer(poly(SEA) + poly(CHESAPEAKE), 1, 0.8);
  const shelf = await layer(poly(SEA), 0.5, 12);
  const lakes = await layer(LAKES.map(poly).join('') + FINGERS.map(([w, p]) => line(p, w)).join(''), 2, 0.4);
  const rivers = await layer(RIVERS.map(([w, p]) => line(p, w)).join(''), 2, 0.3);
  const vales = await layer(RIVERS.map(([w, p]) => line(p, w * 5 + 4)).join(''), 1, 4);
  const massifs = await layer(MASSIFS.map(([la, lo, r, h]) => disc([la, lo], r, `fill-opacity="${h}"`)).join(''), 0.5, 18);
  const coal = await layer(line(COAL, 5), 2, 1.5);
  const towns = await layer(CITIES.map(([la, lo, r, b]) => disc([la, lo], r, `fill-opacity="${b}"`)).join(''), 2, 1.8);
  const branches = await layer(CITIES.filter((c) => c[4]).map(([la, lo]) => disc([la, lo], 1.6)).join(''), 2, 1.2);
  const roads = await layer(ROADS.map((p) => line(p, 0.8)).join(''), 2, 0.4);

  console.log('the office: painting the globe');
  const n1 = perlin(41);
  const n2 = perlin(42);
  const n3 = perlin(43);
  const n4 = perlin(44);
  const n5 = perlin(45);
  const n6 = perlin(46);
  const nc = perlin(47);
  const albedo = new Float32Array(W * H * 3);
  const height = new Float32Array(W * H);
  const rough = new Float32Array(W * H * 3);
  const night = new Float32Array(W * H * 3);
  const clouds = new Float32Array(W * H * 3);
  const LAT0 = SCRANTON[0] * deg;
  const c0 = [Math.cos(LAT0), Math.sin(LAT0), 0];
  const e0 = [0, 0, -1];
  const n0 = [-Math.sin(LAT0), Math.cos(LAT0), 0];
  const C = Object.fromEntries(
    Object.entries({
      deep: '#173a5e', shelfSea: '#2b5f84', coast: '#4d7f95', lake: '#24506a', river: '#2f5566',
      forest: '#3a5a2a', forestHi: '#4c6f33', pine: '#24402a', gold: '#c9a23a', orange: '#d0732a', red: '#a3402c', bronze: '#8a6a3a',
      field: '#748c42', stubble: '#a99760', plough: '#7a5e44', corn: '#9c8c50', pasture: '#5e7c3c',
      town: '#8d8880', townHi: '#aea79c', culm: '#2b2927', beet: '#6c2238', bog: '#5f6a3c', rock: '#7a7468',
    }).map(([k, v]) => [k, hex(v)]),
  );

  eachTexel(W, H, (x, y, z, i, lat) => {
    // where this is on the sheet
    const ang = Math.acos(clamp(x * c0[0] + y * c0[1] + z * c0[2], -1, 1));
    const tx = x * e0[0] + y * e0[1] + z * e0[2];
    const ty = x * n0[0] + y * n0[1] + z * n0[2];
    const tl = Math.hypot(tx, ty) || 1;
    const sx = 500 + (KM_PER_RAD * ang * tx) / tl;
    const sy = 500 - (KM_PER_RAD * ang * ty) / tl;
    const edge = Math.min(sx - BOX.x0, BOX.x1 - sx, sy - BOX.y0, BOX.y1 - sy);
    const inS = ang < 2.6 ? smooth(0, 70, edge) : 0;
    const S = inS > 0;
    const g = (f) => (S ? f(sx, sy) * inS : 0);
    // (the regions read through a warp, so they meet raggedly)
    const ux = sx + fbm(n5, x * 16, y * 16, z * 16, { octaves: 4 }) * 18;
    const uy = sy + fbm(n5, x * 16 + 11, y * 16, z * 16, { octaves: 4 }) * 18;
    const grain = fbm(n3, x * 90, y * 90, z * 90, { octaves: 3 }) * 0.5 + 0.5;
    const rag = fbm(n6, x * 30, y * 30, z * 30, { octaves: 4 });
    const leaf = fbm(n4, x * 20, y * 20, z * 20, { octaves: 4 }) * 0.5 + 0.5;
    const big = fbm(n2, x * 2.2, y * 2.2, z * 2.2, { octaves: 4 });

    // ── water: the Atlantic and the Chesapeake, the lakes, the rivers; off the sheet, a sea of its own ──
    // (the sheet's sea and the far side's blend into each other across the sheet's edge, one sea)
    const seaOn = S ? smooth(0.42, 0.58, sea(ux * 0.15 + sx * 0.85, uy * 0.15 + sy * 0.85)) : 0;
    // (the Atlantic runs on east and south off the sheet: the sea's more likely that way)
    const eastward = smooth(-0.2, 0.6, tx / tl) * smooth(0.3, 1.2, ang) * smooth(0.6, -0.4, ty / tl);
    const seaOff = smooth(-0.08, 0.0, -big - 0.12 + eastward * 0.45 + rag * 0.05);
    const ocean = seaOn * inS + seaOff * (1 - inS);
    const lakeOff = smooth(0.74, 0.78, fbm(n6, x * 9 + 4, y * 9, z * 9, { octaves: 4 }) * 0.5 + 0.5);
    const lakeK = ((S ? smooth(0.35, 0.6, lakes(sx, sy)) : 0) * inS + lakeOff * (1 - inS)) * (1 - ocean);
    const riverK = g(rivers) > 0.3 ? smooth(0.3, 0.6, g(rivers)) : 0;
    const water = Math.max(ocean, lakeK, riverK);

    // ── the ground ──
    let elev = 0.08 + (fbm(n1, x * 6, y * 6, z * 6, { octaves: 5 }) * 0.5 + 0.5) * 0.1;
    // the ridge and valley country: long parallel ridges, folded where they plunge, broken at the gaps
    const fr = S ? ridgeFrame(sx, sy) : { d: Infinity, along: 0, across: 0 };
    const ends = S ? smooth(-30, 40, fr.along) * smooth(fr.total + 30, fr.total - 40, fr.along) : 0;
    const band = smooth(RIDGE_HALF + 10, RIDGE_HALF - 8, Math.abs(fr.across) + rag * 10) * inS * ends;
    let ridges = 0;
    if (band > 0.001) {
      const fold = Math.sin(fr.along / 55) * 9 + Math.sin(fr.along / 21 + 1.3) * 3.5;
      const wave = Math.abs(Math.sin(((fr.across + fold) / 9.5) * Math.PI));
      const gaps = 1 - smooth(0.25, 0.65, g(vales)) * 0.85;
      ridges = smooth(0.72, 0.96, wave) * band * gaps * (0.75 + 0.25 * smooth(-0.3, 0.3, rag));
      elev += ridges * 0.32;
    }
    // the Allegheny Plateau: dissected, its valleys dendritic (off the sheet, the woods' hills everywhere)
    const plateau = S ? smooth(-RIDGE_HALF + 5, -RIDGE_HALF - 25, fr.across) * inS + (1 - inS) * 0.6 : 0.6;
    const dissect = ridged(n2, x * 38, y * 38, z * 38, { octaves: 5 });
    elev += plateau * dissect * 0.2;
    // the Poconos: flat, its bogs and little lakes
    const pocono = g((px, py) => smooth(POCONOS[2], POCONOS[2] * 0.4, Math.hypot(px - at(POCONOS)[0], py - at(POCONOS)[1])));
    const bogs = pocono * smooth(0.68, 0.74, fbm(n6, x * 140, y * 140, z * 140, { octaves: 2 }) * 0.5 + 0.5);
    // the mountains (the Catskills, the Adirondacks, the Laurel Highlands), and off the sheet some of their own
    const massif = Math.max(g(massifs), (1 - inS) * smooth(0.15, 0.4, fbm(n1, x * 3 + 9, y * 3, z * 3, { octaves: 4 })) * 0.7);
    elev += massif * ridged(n5, x * 50, y * 50, z * 50, { octaves: 5 }) * 0.45;
    // off the sheet: ridges in bands of their own here and there
    if (!S || inS < 1) {
      const prov = smooth(0.1, 0.3, fbm(n4, x * 1.6 + 5, y * 1.6, z * 1.6, { octaves: 3 }));
      const offR = smooth(0.62, 0.9, ridged(n1, x * 9, y * 2.6, z * 9, { octaves: 3 })) * prov * (1 - inS);
      ridges = Math.max(ridges, offR);
      elev += offR * 0.28;
    }
    // the farm country: the Great Valley and the Piedmont south-east of the ridges, Lancaster's patchwork
    // (the Great Valley and the Piedmont: a belt a hundred-odd km wide, broken by woods; past it the coastal plain's pines)
    const southEast = S ? smooth(RIDGE_HALF - 2, RIDGE_HALF + 25, fr.across) * smooth(RIDGE_HALF + 170, RIDGE_HALF + 120, fr.across) * smooth(0.25, 0.5, fbm(n3, x * 9 + 6, y * 9, z * 9, { octaves: 3 }) * 0.5 + 0.5 + 0.12) * inS : 0;
    const lanc = g((px, py) => smooth(LANCASTER[2], LANCASTER[2] * 0.3, Math.hypot(px - at(LANCASTER)[0], py - at(LANCASTER)[1])));
    const farmsOff = (1 - inS) * smooth(0.62, 0.75, fbm(n3, x * 3.5 + 2, y * 3.5, z * 3.5, { octaves: 3 }) * 0.5 + 0.5);
    // (and the valleys between the ridges are farmed, the ridges wooded: the stripes the ridge country shows from orbit)
    const between = band * smooth(0.55, 0.15, ridges) * 0.8;
    const farm = clamp(Math.max(southEast * 0.85, lanc, farmsOff, g(vales) * 0.5, between) * (1 - smooth(0.4, 0.8, ridges)) * (1 - massif * 0.8));
    // a patchwork of fields: cells on the sphere, each its own crop, laid over pasture's green
    const cell = fbm(n2, x * 320, y * 320, z * 320, { octaves: 1 });
    const cell2 = fbm(n4, x * 210 + 3, y * 210, z * 210, { octaves: 1 });
    const crops = [C.field, C.stubble, C.plough, C.corn, C.pasture, C.field];
    const crop = mix3(C.pasture, crops[Math.floor(clamp((cell * 0.5 + 0.5) * 0.7 + (cell2 * 0.5 + 0.5) * 0.3, 0, 0.999) * crops.length)], 0.4);

    // the woods, at the peak of the fall: gold, orange and red over the green, the pines dark
    const turned = smooth(0.42, 0.62, leaf + rag * 0.2) * (0.55 + 0.35 * ridges + 0.25 * plateau);
    const hue = fbm(n5, x * 34, y * 34, z * 34, { octaves: 3 }) * 0.5 + 0.5;
    // (russet and bronze mostly, as a fall forest is from orbit; the reds and golds in patches)
    const autumn = hue < 0.3 ? mix3(C.red, C.bronze, 0.4) : hue < 0.55 ? mix3(C.orange, C.bronze, 0.45) : hue < 0.78 ? C.bronze : mix3(C.gold, C.bronze, 0.3);
    let ground = mix3(C.forest, C.forestHi, grain);
    ground = mix3(ground, autumn, clamp(turned) * 0.6);
    ground = mix3(ground, C.pine, Math.max(pocono * 0.55, smooth(0.6, 0.8, fbm(n6, x * 45, y * 45, z * 45, { octaves: 3 }) * 0.5 + 0.5) * 0.6) * (1 - farm));
    ground = mix3(ground, C.bog, bogs * 0.8);
    // (a ridge's crest a little rockier and its north face darker, so the folds read from orbit)
    ground = mix3(ground, C.rock, smooth(0.85, 1, ridges) * 0.25);
    // (farms in a country of woodlots: the woods break in, field by field)
    const woodlots = smooth(0.5, 0.62, fbm(n1, x * 70 + 4, y * 70, z * 70, { octaves: 3 }) * 0.5 + 0.5);
    ground = mix3(ground, mix3(crop, C.field, 0.25), farm * (1 - woodlots * 0.7) * 0.85);
    // the towns: grey by day; Scranton's valley a strip of town and old culm banks
    // (read through the warp, so a town's a smudge, not a disc)
    const townK = S ? smooth(0.15, 0.6, towns(ux * 0.4 + sx * 0.6, uy * 0.4 + sy * 0.6) * (0.6 + 0.8 * grain)) * inS : 0;
    ground = mix3(ground, mix3(C.town, C.townHi, grain), townK * 0.7);
    ground = mix3(ground, C.culm, smooth(0.45, 0.8, g(coal) * (0.5 + 0.9 * grain)) * 0.35);
    // Schrute Farms: beets, in their rows
    const beets = g((px, py) => smooth(4.5, 3, Math.hypot(px - at(SCHRUTE)[0], py - at(SCHRUTE)[1])));
    ground = mix3(ground, mix3(C.beet, C.plough, smooth(0.4, 0.6, Math.sin(sx * 9) * 0.5 + 0.5)), beets);

    // ── the water's colours: the deep, the shelf, the coast, the lakes and rivers ──
    // the shelf: shallow near the coast (the sea's own field, blurred, falls off there), deep away from it
    // (the raster's own edge isn't a coast: the sheet's shelf is let go of before it)
    const offNear = smooth(-0.04, 0.06, big + 0.12 - eastward * 0.45);
    const keep = S ? inS * smooth(60, 140, edge) : 0;
    const near = S ? smooth(0.95, 0.5, shelf(sx, sy)) * keep + offNear * (1 - keep) : offNear;
    let col = mix3(mix3(C.deep, C.shelfSea, near * 0.8), C.coast, smooth(0.6, 1, near) * 0.45);
    col = mix3(col, ground, 1 - water);
    col = mix3(col, C.lake, lakeK * (1 - ocean));
    col = mix3(col, C.river, riverK * (1 - ocean));
    const o = i * 3;
    albedo[o] = col[0];
    albedo[o + 1] = col[1];
    albedo[o + 2] = col[2];
    height[i] = elev * (1 - water) * 0.012;
    rough[o] = rough[o + 1] = rough[o + 2] = mix(0.93, 0.3, water);

    // ── the night: the cities, Dunder Mifflin's branches a little brighter, the interstates ──
    if (S) {
      const lit = smooth(0.1, 0.6, towns(sx, sy)) * (0.6 + 0.6 * grain) + branches(sx, sy) * 0.9 + smooth(0.3, 0.7, roads(sx, sy)) * 0.18;
      const k = lit * inS * (1 - ocean);
      night[o] = clamp(k * 1.15);
      night[o + 1] = clamp(k * 0.85);
      night[o + 2] = clamp(k * 0.5);
    }

    // ── the sky: cumulus in streets, and a cold front coming through ──
    // (fair weather in patches, small puffs in streets where it is; one long front, the cold air behind it clear)
    const wx = fbm(nc, x * 3, y * 3, z * 3, { octaves: 3 }) * 0.8;
    const cover = smooth(-0.05, 0.3, fbm(nc, x * 1.8 + 5, y * 1.8, z * 1.8, { octaves: 3 }));
    const cu = fbm(nc, x * 18 + wx * 3, y * 18, z * 18 - wx * 3, { octaves: 4 });
    const streets = 0.5 + 0.5 * Math.sin(lat * 140 + wx * 6);
    // (thin at a distance: a field of small puffs is a haze from orbit, not a scatter of white)
    const puffs = smooth(0.2, 0.42, cu + (streets - 0.5) * 0.16) * cover * 0.62;
    const alat = Math.abs(lat / deg);
    const frontLine = 1 - Math.abs(n6(x * 0.8 + wx * 0.4, y * 1.0, z * 0.8));
    const front = smooth(0.94, 0.985, frontLine) * smooth(18, 30, alat) * smooth(64, 52, alat) * (0.6 + 0.4 * smooth(-0.2, 0.3, cu));
    clouds[o] = clouds[o + 1] = clouds[o + 2] = clamp(Math.max(puffs * 0.85, front * 0.9));
  });

  // the clouds over it all, in the colour (no shell of their own: one draw for the
  // planet, as the paper ball was), the relief flat under them and the lights dimmed
  const CLOUD = [0.95, 0.96, 0.97];
  for (let k = 0; k < W * H; k++) {
    const a = clouds[k * 3];
    if (a <= 0) continue;
    for (let c = 0; c < 3; c++) albedo[k * 3 + c] = mix(albedo[k * 3 + c], CLOUD[c], a);
    height[k] *= 1 - a;
    rough[k * 3] = rough[k * 3 + 1] = rough[k * 3 + 2] = mix(rough[k * 3], 0.95, a);
    for (let c = 0; c < 3; c++) night[k * 3 + c] *= 1 - a * 0.7;
  }

  if (PREVIEW) {
    fs.mkdirSync(PREVIEW, { recursive: true });
    const png = async (data, name) => {
      const buf = Buffer.alloc(W * H * 3);
      for (let k = 0; k < buf.length; k++) buf[k] = Math.round(clamp(data[k]) * 255);
      await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).png().toFile(path.join(PREVIEW, `${name}.png`));
    };
    await png(albedo, 'office');
    await png(clouds, 'office-clouds');
    await png(night, 'office-night');
    return;
  }
  await save(albedo, W, H, 3, 'office', [[4096, '-xl'], [2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 88 });
  await save(normalMap(height, W, H, 1.3), W, H, 3, 'office-normal', [[2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 90 });
  await save(night, W, H, 3, 'office-night', [[1024, '']], { quality: 88 });
  await save(rough, W, H, 3, 'office-rough', [[1024, '']], { quality: 84 });
}

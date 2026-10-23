// The Harry Potter world from orbit: a cold northern planet, made from
// nothing but code. One continent: its north-west the Highlands, glens and
// lochs running south-west to north-east, sea lochs where they reach the
// coast, snow on the highest tops only, late purple heather on the moors
// and dark pine in the glens; one loch longer than the rest with a crag at
// its head is the Black Lake, the castle's lights on the crag and
// Hogsmeade's along its north shore. South of the hills the country rolls
// away green, in fields and woods, to a grey smear that is a city on the
// coast, a thread of lamps along the railway winding down to it. The rest
// of the world is cold sea over basins and ridges, a few big islands and
// chains of small ones strung across it, pack ice breaking up round the
// ice at both poles. Overhead, long rain fronts come in from the west and
// one always sits over the Highlands, with a break over the Black Lake. At
// night the castle is the brightest thing on the planet; the glow map
// carries it and Hogsmeade's lanterns, so they show before the night side's
// lights fade in. The lochs and the sea are glossy, the moor matte.
//
// Across the ocean from it lies the Continent, the wizarding world's other
// schools in it: Beauxbatons' palace lit in the mountains along its south,
// Durmstrang's castle on a lake in the pine forests of its cold north, its
// lowlands farmed between, a few towns' lights. So from any side the world
// shows land, as a world of witches and wizards' homelands should.
//
// Makes potter at 4096 (-xl, KTX2), 2048 (-hq), 1024 and 512 (-sm);
// -clouds at 2048, 1024 and 512; -normal at 2048 and 1024; -rough, -night
// and -glow at 1024. It prints where the Black Lake is ([lat, lon]: the
// landing's `near`, universe/landings/landings.js). PREVIEW=<folder> bakes
// at 2048 and writes PNGs of the colour, the clouds and the night there
// instead (a quick look while tuning).

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { cells, clamp, eachTexel, fbm, hex, mix, mix3, normalMap, perlin, ramp, ridged, save, smooth, bakeSize } from './sphere.mjs';

const PREVIEW = process.env.PREVIEW ?? null;
// (8192 × 4096 with --ultra: sphere.mjs's bakeSize)
const [W, H] = PREVIEW ? [2048, 1024] : bakeSize();
const deg = Math.PI / 180;

// the continent's middle, and a frame there: east and north in radians along the ground
const LAT0 = 46;
const PHI0 = Math.PI;
const on = (latD, phi) => [-Math.cos(phi) * Math.cos(latD * deg), Math.sin(latD * deg), Math.sin(phi) * Math.cos(latD * deg)];
const C0 = on(LAT0, PHI0);
const E0 = [Math.sin(PHI0), 0, Math.cos(PHI0)];
const N0 = [Math.cos(PHI0) * Math.sin(LAT0 * deg), Math.cos(LAT0 * deg), -Math.sin(PHI0) * Math.sin(LAT0 * deg)];
const local = (x, y, z) => [x * E0[0] + y * E0[1] + z * E0[2], x * N0[0] + y * N0[1] + z * N0[2], x * C0[0] + y * C0[1] + z * C0[2]];
// a point in the frame back to [lat, lon] degrees (lon 0 the map's middle, as landings/biomes.js reads it)
export function latLonOf(e, n) {
  const p = C0.map((c, i) => c + E0[i] * e + N0[i] * n);
  const l = Math.hypot(...p);
  const [x, y, z] = p.map((v) => v / l);
  let phi = Math.atan2(z, -x);
  if (phi < 0) phi += Math.PI * 2;
  return [+(Math.asin(y) / deg).toFixed(3), +((phi / (Math.PI * 2)) * 360 - 180).toFixed(3)];
}

// the Continent, across the ocean: its own frame (east, north and up at its middle)
const LAT1 = 42;
const PHI1 = ((175 + 180) / 360) * Math.PI * 2;
const C1 = on(LAT1, PHI1);
const E1 = [Math.sin(PHI1), 0, Math.cos(PHI1)];
const N1 = [Math.cos(PHI1) * Math.sin(LAT1 * deg), Math.cos(LAT1 * deg), -Math.sin(PHI1) * Math.sin(LAT1 * deg)];
const local1 = (x, y, z) => [x * E1[0] + y * E1[1] + z * E1[2], x * N1[0] + y * N1[1] + z * N1[2], x * C1[0] + y * C1[1] + z * C1[2]];
// its lands, its mountains along the south (a line of [e, n]), and its schools
const LOBES1 = [
  [[0, 0], [0.42, 0.3]],
  [[-0.3, 0.2], [0.2, 0.18]],
  [[0.26, 0.24], [0.24, 0.2]],
  [[0.1, -0.26], [0.18, 0.12]],
  [[-0.2, -0.18], [0.12, 0.1]],
  [[0.4, -0.06], [0.14, 0.16]],
];
const RANGE1 = [[-0.32, -0.14], [-0.12, -0.2], [0.08, -0.16], [0.26, -0.1], [0.4, -0.12]];
const BEAUXBATONS = [-0.04, -0.17];
const DURMSTRANG = [0.12, 0.34];

// the glens' line: south-west to north-east, 38 degrees up from east
const GLEN = 38 * deg;
const across = (e, n) => -e * Math.sin(GLEN) + n * Math.cos(GLEN);
const along = (e, n) => e * Math.cos(GLEN) + n * Math.sin(GLEN);

// the Black Lake: a long loch down a glen, its head (the crag, the castle) at the north-east end
export const LAKE = { from: [-0.235, 0.17], to: [-0.168, 0.222], wide: 0.0075 };
const CRAG = [LAKE.to[0] + 0.0045, LAKE.to[1] + 0.004];
const HOGSMEADE = [-0.183, 0.226];
const CITY = [0.17, -0.3];
// the railway, from Hogsmeade's station south through the hills to the city
const RAIL = [HOGSMEADE, [-0.17, 0.19], [-0.14, 0.13], [-0.09, 0.07], [-0.05, -0.02], [0.02, -0.1], [0.09, -0.2], [0.13, -0.26], CITY];

// the continent: lobes of land (middle [e, n], radii), its outline warped;
// big enough to fill a good part of the face it's on, as a world's one
// continent should from orbit, and reaching east into a long tail of land
const LOBES = [
  [[0.06, -0.04], [0.5, 0.42]],
  [[-0.17, 0.2], [0.27, 0.22]],
  [[0.38, -0.3], [0.2, 0.15]],
  [[0.16, 0.34], [0.22, 0.13]],
  [[-0.3, -0.2], [0.13, 0.18]],
  [[0.62, 0.02], [0.2, 0.11]],
];
// island chains near it, each a line of [e, n] in the frame
const CHAINS = [
  [[-0.56, 0.36], [-0.52, 0.18], [-0.55, -0.02]],
  [[0.58, 0.3], [0.7, 0.2]],
  [[-0.12, -0.6], [0.1, -0.64], [0.34, -0.6]],
];
// and arcs elsewhere on the globe: [lat, lon] points
const ARCS = [
  [[28, -125], [36, -105], [40, -84]],
  [[-18, 70], [-26, 95], [-22, 122]],
  [[48, 112], [42, 136], [33, 152]],
  [[-46, -46], [-40, -14]],
  [[8, -40], [2, -22]],
  // (and a chain along the edge of the northern ice, all the way round the far side)
  [[66, 70], [62, 100], [64, 130], [60, 160], [63, -170]],
];
// big islands out in the ocean: [lat, lon, radius in degrees]
const ISLES = [
  [64, -62, 7],
  [-34, 150, 6],
  [18, 60, 5],
  [-52, -120, 6],
  [40, -160, 4],
  // (the cold north's: big, bare and rocky, round the side the continent isn't on)
  [56, 150, 9],
  [60, -128, 8],
  [50, 82, 6],
  [-58, 30, 7],
];
const onLL = ([la, lo]) => on(la, ((lo + 180) / 360) * Math.PI * 2);
const ARC_PTS = ARCS.map((pts) => {
  const out = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const a = onLL(pts[k]);
    const b = onLL(pts[k + 1]);
    for (let s = 0; s < 24; s++) {
      const t = s / 24;
      const p = a.map((v, i) => v + (b[i] - v) * t);
      const l = Math.hypot(...p);
      out.push(...p.map((v) => v / l));
    }
  }
  return out;
});
const ISLE_PTS = ISLES.map(([la, lo, r]) => [onLL([la, lo]), Math.cos(r * deg)]);
const arcNear = (x, y, z) => {
  let best = 0;
  for (const pts of ARC_PTS) for (let k = 0; k < pts.length; k += 3) best = Math.max(best, x * pts[k] + y * pts[k + 1] + z * pts[k + 2]);
  return Math.acos(clamp(best, -1, 1));
};
const segDist = ([px, py], [ax, ay], [bx, by]) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy));
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
};
const lineDist = (p, pts) => {
  let d = Infinity;
  for (let k = 0; k < pts.length - 1; k++) d = Math.min(d, segDist(p, pts[k], pts[k + 1]));
  return d;
};
const gauss = (d, s) => Math.exp(-((d / s) ** 2));

export async function bake() {
  console.log('the potter world: painting the globe');
  const n1 = perlin(71);
  const n2 = perlin(72);
  const n3 = perlin(73);
  const n4 = perlin(74);
  const n5 = perlin(75);
  const n6 = perlin(76);
  const nc = perlin(77);
  const nw = perlin(78);
  // the pack ice: floes as cells, each its own size
  const floes = cells(79, 140000);
  const albedo = new Float32Array(W * H * 3);
  const height = new Float32Array(W * H);
  const rough = new Float32Array(W * H * 3);
  const night = new Float32Array(W * H * 3);
  const glow = new Float32Array(W * H * 3);
  const clouds = new Float32Array(W * H * 3);

  // (a cold sea: the North Atlantic's grey-teal and slate, never the
  // tropics' blue, and light enough that the world doesn't read black from
  // orbit, three-quarters of it being sea)
  const sea = ramp([[0, '#5f8c88'], [0.12, '#4a7674'], [0.3, '#365e66'], [0.55, '#284c5a'], [0.8, '#1f4050'], [1, '#183646']]);
  const C = Object.fromEntries(
    Object.entries({
      loch: '#1a3644', lowland: '#46613a', lowlandHi: '#577045', field: '#7c8a4e', stubble: '#8f8a5a', wood: '#2b4626', pine: '#1b2f20', pineHi: '#243c28',
      heather: '#5d4258', heatherHi: '#72526a', bracken: '#73603c', moorGrass: '#5b6a40', glenGrass: '#5a7442', rock: '#5f5b55', rockHi: '#7a766d', snow: '#eef2f4',
      city: '#6a6661', cityHi: '#88837b', ice: '#dfe7ec', iceShade: '#b4c6d2', shore: '#8a8470', crag: '#47453f', tundra: '#6c6a58', coldSea: '#2c4650',
    }).map(([k, v]) => [k, hex(v)]),
  );

  eachTexel(W, H, (x, y, z, i, lat) => {
    const latD = lat / deg;
    const alat = Math.abs(latD);
    const [e0, n0, d] = local(x, y, z);
    const near = d > 0.42; // (within about 65 degrees of the continent's middle)
    const [u1, v1, d1] = local1(x, y, z);
    const far = d1 > 0.42; // (and the Continent's)
    const grain = fbm(n2, x * 90, y * 90, z * 90, { octaves: 3 }) * 0.5 + 0.5;
    const rag = fbm(n3, x * 30, y * 30, z * 30, { octaves: 4 });
    // (the continent's outline and its lands are read through a warp, so nothing's drawn with a compass)
    const e = e0 + fbm(nw, x * 6, y * 6, z * 6, { octaves: 4 }) * 0.07;
    const n = n0 + fbm(nw, x * 6 + 9, y * 6, z * 6, { octaves: 4 }) * 0.07;

    // ── land: the continent, its islands, the big isles and the arcs out in the ocean ──
    let field = -1;
    if (near) {
      for (const [[ce, cn], [re, rn]] of LOBES) field = Math.max(field, 1 - ((e - ce) / re) ** 2 - ((n - cn) / rn) ** 2);
      field += fbm(n1, x * 11, y * 11, z * 11, { octaves: 5 }) * 0.32 + rag * 0.1;
      for (const ch of CHAINS) field = Math.max(field, 0.55 - lineDist([e0, n0], ch) * 22 + fbm(n4, x * 40, y * 40, z * 40, { octaves: 4 }) * 0.8 + fbm(n6, x * 9, y * 9, z * 9, { octaves: 2 }) * 0.5 - 0.55);
    }
    const arc = arcNear(x, y, z);
    field = Math.max(field, 0.55 - arc * 11 + fbm(n4, x * 38, y * 38, z * 38, { octaves: 4 }) * 0.85 + fbm(n6, x * 8, y * 8, z * 8, { octaves: 2 }) * 0.5 - 0.55);
    // the Continent: its lobes through a warp of their own, and its cold north
    // pocked with lakes, as a land the ice scoured is
    let lakes1 = 0;
    if (far) {
      const ew = u1 + fbm(nw, x * 6 + 11, y * 6, z * 6, { octaves: 4 }) * 0.07;
      const nn = v1 + fbm(nw, x * 6, y * 6 + 13, z * 6, { octaves: 4 }) * 0.07;
      let f1 = -1;
      for (const [[ce, cn], [re, rn]] of LOBES1) f1 = Math.max(f1, 1 - ((ew - ce) / re) ** 2 - ((nn - cn) / rn) ** 2);
      field = Math.max(field, f1 + fbm(n1, x * 11 + 5, y * 11, z * 11, { octaves: 5 }) * 0.32 + rag * 0.1);
      lakes1 = smooth(0.14, 0.3, nn) * smooth(0.62, 0.7, fbm(n6, x * 70, y * 70, z * 70, { octaves: 2 }) * 0.5 + 0.5);
    }
    for (const [p, c] of ISLE_PTS) {
      const dot = x * p[0] + y * p[1] + z * p[2];
      if (dot > c - 0.04) field = Math.max(field, (dot - c) * 45 + fbm(n6, x * 12, y * 12, z * 12, { octaves: 5 }) * 0.9 + rag * 0.2);
    }
    const landK = smooth(-0.012, 0.012, field);

    // ── the Highlands: the north-west, their glens and lochs ──
    const hi = near ? smooth(-0.04, 0.12, -e * 0.8 + n * 0.75 + 0.02 + rag * 0.08 + fbm(n6, x * 16, y * 16, z * 16, { octaves: 3 }) * 0.05) : 0;
    const rolling = fbm(n5, x * 14, y * 14, z * 14, { octaves: 4 }) * 0.5 + 0.5;
    let elev = 0.03 + rolling * 0.12;
    let water = 0;
    let crag = 0;
    let glen = 0;
    let peaks = 0.4;
    if (hi > 0.001) {
      // the glens: parallel, but each bent and spaced its own way, and broken along their length
      const bend = fbm(nw, x * 5, y * 5, z * 5, { octaves: 3 }) * 0.05 + fbm(n6, x * 18, y * 18, z * 18, { octaves: 2 }) * 0.012;
      const v = Math.cos(((across(e0, n0) + bend) * Math.PI * 2) / 0.055);
      const run = smooth(0.0, 0.5, fbm(n4, along(e0, n0) * 16, across(e0, n0) * 5, 3, { octaves: 3 }) * 0.5 + 0.5);
      peaks = ridged(n5, x * 55, y * 55, z * 55, { octaves: 5 });
      const massif = smooth(-0.15, 0.4, fbm(n6, x * 7, y * 7, z * 7, { octaves: 3 }));
      glen = smooth(-0.55, -0.95, v) * (0.35 + 0.65 * run);
      const mount = 0.22 + (0.22 + 0.4 * massif) * peaks * (0.4 + 0.6 * (0.5 + 0.5 * v));
      elev = mix(elev, mount - glen * 0.3, hi);
      // (a glen's floor is a loch here and there, where it runs long and low; one that reaches the sea is a sea loch)
      const lochs = smooth(0.5, 0.64, fbm(n6, along(e0, n0) * 11, across(e0, n0) * 18, 7, { octaves: 3 }) * 0.5 + 0.5);
      water = hi * smooth(0.82, 0.95, glen) * lochs;
      // the Black Lake, longer and wider than the rest, and the crag at its head
      const dl = segDist([e0, n0], LAKE.from, LAKE.to);
      water = Math.max(water, smooth(LAKE.wide, LAKE.wide * 0.5, dl + (grain - 0.5) * 0.0012));
      crag = gauss(Math.hypot(e0 - CRAG[0], n0 - CRAG[1]), 0.004);
      elev = Math.max(elev * (1 - water), crag * 0.55);
    }
    // the Continent's mountains along its south, peaks over a ridge line, and its lakes
    let range1 = 0;
    let peaks1 = 0;
    if (far) {
      range1 = smooth(0.06, 0.0, lineDist([u1, v1], RANGE1) + rag * 0.03) * landK;
      peaks1 = ridged(n5, x * 60 + 3, y * 60, z * 60, { octaves: 5 });
      elev = Math.max(elev, range1 * (0.3 + 0.55 * peaks1));
      water = Math.max(water, lakes1 * (1 - range1));
    }
    const coast = smooth(0.0, 0.12, field);
    const lochK = water * landK;
    elev *= landK;
    height[i] = elev * (1 - lochK) * 0.013;

    // ── colour ──
    // the sea: basins and ridges under it, shallows round every coast, colder toward the ice
    const basin = fbm(n1, x * 2.2, y * 2.2, z * 2.2, { octaves: 4 }) * 0.5 + 0.5;
    const shelf = smooth(-0.3, 0.0, field);
    const swell = fbm(n2, x * 24, y * 24, z * 24, { octaves: 3 }) * 0.04;
    let col = sea(clamp(0.55 + basin * 0.5 - shelf * 0.8 + swell));
    col = mix3(col, C.coldSea, smooth(36, 62, alat) * 0.55);
    // (the lowlands' greens vary over the country: lusher in the vales, yellower on the downs)
    const vale = fbm(n6, x * 4, y * 4, z * 4, { octaves: 3 }) * 0.5 + 0.5;
    let ground = mix3(mix3(C.lowland, C.lowlandHi, grain * 0.5 + rolling * 0.5), mix3(C.field, C.wood, rolling), smooth(0.35, 0.75, vale) * 0.35);
    // the lowlands: fields in a patchwork, stubble and pasture, woods between
    const patch = fbm(n3, x * 160, y * 160, z * 160, { octaves: 2 });
    ground = mix3(ground, patch > 0.15 ? C.stubble : C.field, smooth(0.05, 0.3, Math.abs(patch)) * (1 - hi) * 0.4);
    ground = mix3(ground, C.wood, smooth(0.2, 0.42, fbm(n1, x * 45, y * 45, z * 45, { octaves: 3 })) * 0.7);
    // the north, tundra (the cold isles bare and brown from the fifties); the big isles' hills moor and rock
    ground = mix3(ground, mix3(C.tundra, C.rock, grain), smooth(50, 63, alat) * (1 - hi));
    const isleHills = near ? 0 : smooth(0.3, 0.6, field) * smooth(0.45, 0.7, ridged(n5, x * 30, y * 30, z * 30, { octaves: 4 }));
    ground = mix3(ground, mix3(C.bracken, C.rock, grain), isleHills * 0.8);
    // the Highlands: moor of heather, bracken and rough grass, grass and pine down the glens, rock on the ridges
    const moor = mix3(mix3(C.moorGrass, C.bracken, smooth(-0.25, 0.3, rag)), mix3(C.heather, C.heatherHi, grain), smooth(-0.1, 0.3, fbm(n2, x * 30, y * 30, z * 30, { octaves: 3 })));
    ground = mix3(ground, moor, hi);
    ground = mix3(ground, C.glenGrass, hi * glen * 0.35);
    const forest = hi * smooth(0.12, 0.38, fbm(n4, x * 24, y * 24, z * 24, { octaves: 4 }) + glen * 0.15) * (1 - smooth(0.42, 0.55, elev));
    ground = mix3(ground, mix3(C.pine, C.pineHi, grain), forest);
    ground = mix3(ground, mix3(C.rock, C.rockHi, peaks), hi * smooth(0.48, 0.62, elev + (grain - 0.5) * 0.12));
    const snowK = smooth(0.66, 0.72, elev + (grain - 0.5) * 0.1 + (peaks - 0.5) * 0.08);
    ground = mix3(ground, C.snow, snowK);
    ground = mix3(ground, C.crag, crag * 0.75);
    // the Continent: pine and birch in its north, tundra past sixty, rock and snow on its mountains
    if (far) {
      const north1 = smooth(0.08, 0.24, v1 + rag * 0.05);
      ground = mix3(ground, mix3(C.pine, C.pineHi, grain), north1 * smooth(0.1, 0.35, fbm(n4, x * 26, y * 26, z * 26, { octaves: 4 }) + 0.25) * 0.85);
      ground = mix3(ground, mix3(C.rock, C.rockHi, peaks1), smooth(0.3, 0.45, range1 * (0.4 + peaks1)));
      ground = mix3(ground, C.snow, smooth(0.62, 0.72, elev + (grain - 0.5) * 0.1) * smooth(0.2, 0.5, range1));
    }
    // the city: a grey smear on the south coast
    const cityK = near ? smooth(0.04, 0.012, Math.hypot(e0 - CITY[0], n0 - CITY[1]) * (1 + rag * 0.7)) : 0;
    ground = mix3(ground, mix3(C.city, C.cityHi, grain), cityK * 0.85);
    // a pale line where the land meets the sea
    ground = mix3(ground, C.shore, (1 - coast) * smooth(0.0, 0.01, field) * 0.3);
    col = mix3(col, ground, landK);
    col = mix3(col, C.loch, lochK);
    // the poles: the cap, ragged, and the pack ice breaking up round it
    // (a cold world's: the caps reach down past seventy, the pack ice to the sixties)
    const capEdge = 71 + fbm(n5, x * 6, y * 6, z * 6, { octaves: 5 }) * 5;
    const cap = smooth(capEdge, capEdge + 1.5, alat);
    let pack = 0;
    if (alat > 58) {
      const f = floes(x, y, z);
      const open = smooth(0, 0.003, f.f2 - f.f1); // (the leads of open water between floes)
      const tone = ((f.id * 2654435761) % 1000) / 1000;
      const thick = smooth(61, 72, alat + rag * 5 + fbm(n4, x * 9, y * 9, z * 9, { octaves: 3 }) * 5) ** 1.5;
      pack = open * (tone < thick ? 0.55 + 0.4 * ((tone * 7.31) % 1) : 0) * (1 - landK);
    }
    const ice = Math.max(cap, pack);
    // (the ice's own shading: drifts and pressure ridges, its blue in the hollows)
    const drift = fbm(n3, x * 7, y * 7, z * 7, { octaves: 4 }) * 0.5 + 0.5;
    col = mix3(col, mix3(C.iceShade, C.ice, clamp(grain * 0.4 + drift * 0.8 - 0.1)), ice);
    const o = i * 3;
    albedo[o] = col[0];
    albedo[o + 1] = col[1];
    albedo[o + 2] = col[2];
    // the water glossy (the lochs and the sea), the moor matte, snow and ice between
    const wet = Math.max(1 - landK, lochK);
    rough[o] = rough[o + 1] = rough[o + 2] = mix(mix(mix(0.93, 0.26, wet), 0.72, snowK * landK), 0.62, ice);

    // ── the night: the castle on its crag, Hogsmeade, the railway's lamps, the city, a few villages ──
    if (near) {
      const p = [e0, n0];
      const castle = gauss(Math.hypot(e0 - CRAG[0], n0 - CRAG[1]), 0.0045);
      const village = gauss(Math.hypot(e0 - HOGSMEADE[0], n0 - HOGSMEADE[1]), 0.0038);
      const rail = gauss(lineDist(p, RAIL), 0.0018) * smooth(0.5, 0.8, Math.sin(along(e0, n0) * 700) * 0.5 + 0.5);
      const city = cityK * smooth(0.4, 0.8, grain + patch * 0.3);
      const farms = landK * (1 - hi) * (1 - smooth(55, 62, alat)) * smooth(0.9, 0.96, fbm(n3, x * 260, y * 260, z * 260, { octaves: 1 }) * 0.5 + 0.5) * 0.4;
      const lit = castle * 1.9 + village * 0.9 + rail * 0.4 + city * 0.85 + farms;
      night[o] = clamp(lit * 1.2);
      night[o + 1] = clamp(lit * 0.82);
      night[o + 2] = clamp(lit * 0.42);
      // (the glow: the castle's windows and Hogsmeade's lanterns only, warm)
      const g = castle * 1.3 + village * 0.6;
      glow[o] = clamp(g);
      glow[o + 1] = clamp(g * 0.72);
      glow[o + 2] = clamp(g * 0.34);
    }
    // the Continent's: Beauxbatons' palace (a cooler light, its glass and
    // its pale blue silk) in the mountains, Durmstrang's castle by its lake,
    // and the towns of its lowlands
    if (far) {
      const palace = gauss(Math.hypot(u1 - BEAUXBATONS[0], v1 - BEAUXBATONS[1]), 0.0045);
      const keep = gauss(Math.hypot(u1 - DURMSTRANG[0], v1 - DURMSTRANG[1]), 0.004);
      const towns = landK * (1 - range1) * (1 - smooth(52, 60, alat)) * smooth(0.9, 0.96, fbm(n3, x * 240 + 7, y * 240, z * 240, { octaves: 1 }) * 0.5 + 0.5) * 0.45;
      night[o] = clamp(night[o] + (palace * 1.3 + keep * 1.5 + towns) * 1.15);
      night[o + 1] = clamp(night[o + 1] + palace * 1.25 + (keep * 1.5 + towns) * 0.8);
      night[o + 2] = clamp(night[o + 2] + palace * 1.3 + (keep * 1.5 + towns) * 0.42);
      glow[o] = clamp(glow[o] + palace * 0.9 + keep * 1.1);
      glow[o + 1] = clamp(glow[o + 1] + palace * 0.95 + keep * 0.78);
      glow[o + 2] = clamp(glow[o + 2] + palace * 1.1 + keep * 0.36);
    }

    // ── the sky: long rain fronts in from the west, a belt of them in the north, one over the Highlands ──
    // (the cloud's field, warped, and stretched east to west: twice the frequency north to south)
    const wx = fbm(nc, x * 2.4, y * 2.4, z * 2.4, { octaves: 3 }) * 0.9;
    const wz = fbm(nc, x * 2.4 + 7, y * 2.4, z * 2.4, { octaves: 3 }) * 0.9;
    const cv = fbm(nw, x * 4 + wx, y * 9 + wz * 0.5, z * 4 - wx, { octaves: 6 });
    // (more of it in the stormy north than the calm south of the world)
    const belt = 0.24 * smooth(25, 50, alat) - 0.1 * smooth(15, 5, alat) - 0.22 * smooth(68, 80, alat);
    const sheet = smooth(0.16, 0.5, cv + belt) * 0.92;
    // a front: where a slow noise crosses zero, a long curving line, thickened and lumpy along it
    const line = 1 - Math.abs(fbm(n6, x * 0.9 + wx * 0.6, y * 1.3, z * 0.9 + wz * 0.6, { octaves: 2 }));
    const front = smooth(0.86, 0.965, line) * smooth(-0.15, 0.3, cv + 0.15) * smooth(25, 40, alat) * (1 - smooth(62, 72, alat));
    const highland = hi * smooth(-0.1, 0.05, field) * smooth(-0.05, 0.3, cv + 0.15);
    let ck = Math.max(sheet, front * 0.95, highland * 0.92);
    // (a break over the Black Lake, so the castle's light shows from orbit)
    if (near) ck *= smooth(0.008, 0.035, Math.hypot(e0 - CRAG[0], n0 - CRAG[1]));
    clouds[o] = clouds[o + 1] = clouds[o + 2] = clamp(ck);
  });

  const mid = LAKE.from.map((v, k) => (v + LAKE.to[k]) / 2);
  console.log(`the Black Lake at ${JSON.stringify(latLonOf(...mid))} (its crag at ${JSON.stringify(latLonOf(...CRAG))})`);
  if (PREVIEW) {
    fs.mkdirSync(PREVIEW, { recursive: true });
    const png = async (data, name) => {
      const buf = Buffer.alloc(W * H * 3);
      for (let k = 0; k < buf.length; k++) buf[k] = Math.round(clamp(data[k]) * 255);
      await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).png().toFile(path.join(PREVIEW, `${name}.png`));
    };
    await png(albedo, 'potter');
    await png(clouds, 'potter-clouds');
    await png(night, 'potter-night');
    return;
  }
  await save(albedo, W, H, 3, 'potter', [[4096, '-xl'], [2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 88 });
  await save(normalMap(height, W, H, 1.4), W, H, 3, 'potter-normal', [[2048, '-hq'], [1024, '']], { quality: 90 });
  await save(rough, W, H, 3, 'potter-rough', [[1024, '']], { quality: 84 });
  await save(night, W, H, 3, 'potter-night', [[1024, '']], { quality: 88 });
  await save(glow, W, H, 3, 'potter-glow', [[1024, '']], { quality: 88 });
  await save(clouds, W, H, 3, 'potter-clouds', [[2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 80 });
}

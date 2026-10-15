// Hoth's ground as the game's terrain tile shader draws it (the study's
// findings 35 and 58 and the listing they keep; the numbers in
// snowMaps.js), as a node material for a heightfield on the node renderer.
// World xz is the game's own (the pack sits at its origin unturned), so a
// read here is the game's read.
//
// The game paints eight layers over its base snow by per-texel masks (the
// TerrainStreamingTree's rasters, laid into the pack's two mask frames by
// scripts/bf2017-terrain-masks.mjs) and blends them top down, each layer's
// mask shaped by its own maps: 7 blowing snow (the wisps' streaks × its
// mask), 6 rocky (height-blended by Rocky_02_N's blue), 5 rocky packed
// (by RockyPacked_04_N's), 4 trampled (its edge broken by the rough map's
// alpha), 3 rough packed, 2 chunky wind, 1 packed (its edge broken by
// Packed_04_N's blue), and layer 0, the untouched snow, what is left; the
// eighth mask, the base surface, lifts every weight by (1 + m). Each layer
// brings its own normals at the listing's tilings (summed, z from the
// first, laid on the ground's own normal: x along world x, y along the
// ground normal × x), its colour (the base colour, or the rough packed
// map's alpha, or the rocks' colour maps) and its smoothness; the sum is
// the tile's colour, normal and smoothness, as the tile's four atlases
// hold them. Where a dynamic mask is given (tracks, craters) the game's
// soot and grey take the colour and the smoothness falls; the site paints
// none yet, so it is optional. The sparkle (the on-screen pass, drawn only
// where layer 8 or 7 is) dips the roughness on the near band; on ultra the
// near patch's vertices are displaced by the 4 m map's blue.
//
//   createSnowGround({ maps, masks, tier, three, far, displace, dynamic, debug }) → { material, samples, flat, dispose }
//     maps: { normals, colours, data } (snowMaps.js's files by kind, 2-D arrays),
//       masks: [{ texture, layers: [a, b], corner: [x, z], extent: [w, h] }] finest
//       first, in the game's frame (two layers of the mask array each: masks 1–4, 5–8);
//       dynamic: { texture, corner, extent } (its alpha the game's D) and maps.soot
//     far: the coarse grid's (no 1 m detail, no sparkle); flat: no normals map, the colour alone
//
// Tiers: low the colour alone; mid the layers' normals and colours and the
// 1 m detail; high and ultra the blowing snow and the sparkle too; ultra the
// displacement. A file that did not land leaves its terms out; without the
// normals nothing is read.
//
// Pure, for the tests: mapsFor(tier), tileUv(p, cycles),
// windFrame(p, rad), streakUv(p, cycles, rate, t), streakTerm(a, b),
// layerMasks(masks, maps), layerWeights(edged), dynamicS(d, rough, soot),
// texelOf(weights, maps), worldNormal(n, ground), nearBand(d, band),
// displaceHeight(b)

import { LAYERS, READS, SNOW, SNOW_FILES, SNOW_KIND, mapAt } from './snowMaps.js';

// metres: the sparkle (the game's near pass) fades over this band
export const NEAR_BAND = [30, 80];
// the crystals' dip in the roughness on the near band (judged on the shot)
export const SPARKLE_DIP = 0.5;
// m: the displacement's full scale (the game's DetailDisplacementScale is
// not in the record)
export const DISPLACE_M = 0.35;
// the displacement's middle, so a mid-grey height moves nothing
const DISPLACE_MID = SNOW.displacement.lift + SNOW.displacement.gain / 2;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const sat = (x) => Math.min(1, Math.max(0, x));

const ALL = ['normals', 'colours', 'data'];
const PLAN = { low: [], mid: ALL, high: ALL, ultra: ALL };
// (mid draws no blowing snow and no sparkle: the data array for the 1 m detail alone)
const WISPS = { low: false, mid: false, high: true, ultra: true };

// the files a tier's material reads (snowMaps.js's slugs)
// (the far grid reads the same files: it draws no 1 m detail and no sparkle)
export const mapsFor = (tier) => (PLAN[tier] ?? PLAN.high).map((k) => SNOW_KIND[k]);

export const tileUv = ([x, z], cycles) => (Array.isArray(cycles) ? [x * cycles[0], z * cycles[1]] : [x * cycles, z * cycles]);

// world xz in the streaks' frame: the listing's (c·x − s·z, s·x + c·z)
export function windFrame([x, z], rad = SNOW.windRad) {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c * x - s * z, s * x + c * z];
}

// a streak read's uv at time t: the turned frame tiled, slid along its own u at the read's rate
export function streakUv(p, cycles, rate, t, rad = SNOW.windRad) {
  const [u, v] = tileUv(windFrame(p, rad), cycles);
  return [u + rate * t, v];
}

// the game's combination of the two streak reads
export const streakTerm = (a, b) => {
  const x = sat(4 * (a * a - a * a * b * b - SNOW.streakBias));
  return x * x * (3 - 2 * x);
};

// The masks as each layer's block shapes them: m = [m1 … m8] (0…1), and
// the reads that break their edges (packedB, roughA, rockyPackedB, rockyB,
// streak). Returns [m1', … m7', m8].
export function layerMasks(m, { packedB = 0, roughA = 0, rockyPackedB = 0, rockyB = 0, streak = 0 } = {}) {
  const [m1, m2, m3, m4, m5, m6, m7, m8] = m;
  const t = LAYERS.trampledEdge;
  const p5 = LAYERS.rockyPackedBlend;
  const p6 = LAYERS.rockyBlend;
  const e4 = sat(t.gain * ((1 - m4) * (2 * roughA * m4 - m4) + m4 - t.lift));
  return [
    m1 * (m1 + (1 - m1) * packedB),
    m2,
    m3,
    e4 * e4 * (3 - 2 * e4),
    sat(p5.gain * ((1 - m5) * (p5.height * rockyPackedB * m5 - m5) + m5) + p5.lift),
    sat(p6.gain * ((1 - m6) * (p6.height * rockyB * m6 - m6) + m6) + p6.lift),
    streak * m7,
    m8,
  ];
}

// The listing's top-down weights from the shaped masks: 7 over 6 … over 1,
// layer 0 what is left, every one lifted by (1 + m8). Returns [w0 … w7].
export function layerWeights(e) {
  let rest = 1 + e[7];
  const w = new Array(8).fill(0);
  for (let k = 6; k >= 0; k--) {
    w[k + 1] = e[k] * rest;
    rest -= w[k + 1];
  }
  w[0] = rest;
  return w;
}

// the dynamic mask's S (1 untouched, 0 inside a track) from its alpha D, the
// rough map's green and blue at 0.45/m and the soot map's blue and alpha
export function dynamicS(d, { g = 0, b = 0 } = {}, soot = { b: 0, a: 0 }) {
  const s = sat(soot.b * soot.a * LAYERS.soot.gain + LAYERS.soot.lift);
  const q = (1 + b - s) * (1 - g);
  const d2 = d * d;
  return (1 - d2) * (1 + d2 * (2 * q - 1));
}

// A texel's colour and smoothness from its weights and its maps' values
// (untouched by a dynamic mask: S = 1): { colour: [r, g, b], smoothness }.
export function texelOf(w, { base = SNOW.colour, roughPackedA = base, rockyPacked = base, rocky = base, rockyA = 0 } = {}) {
  const grey = (v) => (Array.isArray(v) ? v : [v, v, v]);
  const cols = [base, base, base, grey(roughPackedA), base, rockyPacked, rocky.map((c) => c * LAYERS.rockyColour), base];
  const smooths = [SNOW.smoothness, SNOW.smoothness, SNOW.smoothness, SNOW.smoothness, SNOW.smoothness, SNOW.smoothness, LAYERS.rockySmoothness.base + LAYERS.rockySmoothness.gain * rockyA, SNOW.streakSmoothness];
  const colour = [0, 1, 2].map((i) => sat(w.reduce((s, wk, k) => s + wk * cols[k][i], 0)));
  return { colour, smoothness: sat(w.reduce((s, wk, k) => s + wk * smooths[k], 0)) };
}

// that normal in the world: x along world x, y along the ground normal × x
// (−z on flat ground: the maps' green runs up the texture), z along the
// ground normal
export function worldNormal([nx, ny, nz], [mx, my, mz] = [0, 1, 0]) {
  const v = [nx + nz * mx, ny * mz + nz * my, -ny * my + nz * mz];
  const l = Math.hypot(...v) || 1;
  return v.map((c) => c / l);
}

export const nearBand = (d, [a, b] = NEAR_BAND) => 1 - smooth(a, b, d);

// the displacement in metres from the height map's blue, about a mid grey
export const displaceHeight = (b, scale = DISPLACE_M) => (b * SNOW.displacement.gain + SNOW.displacement.lift - DISPLACE_MID) * scale;

// (?ground=layers: each layer's weight in its own colour, a check's view of the masks: 0 white,
// 1 packed red, 2 chunky green, 3 rough packed blue, 4 trampled yellow, 5 rocky packed magenta,
// 6 rocky cyan, 7 blowing snow orange)
export const LAYER_DEBUG = [
  [1, 1, 1],
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 1, 0],
  [1, 0, 1],
  [0, 1, 1],
  [1, 0.5, 0],
];

export function createSnowGround({ maps = {}, masks = [], tier = 'high', three, far = false, displace = false, dynamic = null, debug = null }) {
  const { THREE, tsl } = three;
  const { uniform, texture, vec2, vec3, vec4, float, int, select, positionWorld, positionGeometry, normalGeometry, normalWorldGeometry, modelWorldMatrix, cameraPosition, transformNormalToView, mix, smoothstep, normalize, time } = tsl;
  const material = new THREE.MeshStandardNodeMaterial({ metalness: 0 });
  material.name = `snow-ground:${far ? 'far' : 'near'}:${tier}`;
  const colour = uniform(new THREE.Color(...SNOW.colour));
  const plan = new Set(mapsFor(tier).map((slug) => SNOW_FILES[slug].kind));
  const wisps = WISPS[tier] ?? true;
  const has = (kind) => plan.has(kind) && Boolean(maps[kind]);
  const samples = { normal: 0, data: 0, mask: 0 };
  material.colorNode = vec3(colour);
  // (without the normals there is no layer to draw: the record's colour, as the ground was)
  const flat = !has('normals');
  if (flat) {
    material.roughnessNode = float(1 - SNOW.smoothness);
    return finish();
  }

  const xz = positionWorld.xz;
  const one = float(1);
  const cyclesOf = (c) => (Array.isArray(c) ? vec2(...c) : c);
  // a read of the listing's (its file's array layer, at its tiling, on uv or the world's xz)
  const read = (key, uv = null) => {
    const r = READS[key];
    const at = mapAt(r.map);
    const tex = at && has(at.kind) ? maps[at.kind] : null;
    if (!tex) return null;
    const node = texture(tex, uv ?? xz.mul(cyclesOf(r.cycles)));
    samples[at.kind === 'normals' || /_n$/.test(r.map) ? 'normal' : 'data']++;
    return SNOW_FILES[at.slug].layers ? node.depth(int(at.layer)) : node;
  };
  const tangent = (s) => s.xy.mul(2).sub(1);
  const zOf = (n) => one.sub(n.dot(n)).max(0).sqrt();

  // the masks: each frame's two layers, the finer frame over the coarser where it reaches
  let ma = vec4(0);
  let mb = vec4(0);
  for (const f of [...masks].reverse()) {
    const uv = xz.sub(vec2(...f.corner)).div(vec2(...f.extent));
    const inside = uv.x.greaterThan(0).and(uv.x.lessThan(1)).and(uv.y.greaterThan(0)).and(uv.y.lessThan(1));
    const [la, lb] = f.layers ?? [0, 1];
    ma = select(inside, texture(f.texture, uv).depth(int(la)), ma);
    mb = select(inside, texture(f.texture, uv).depth(int(lb)), mb);
    samples.mask += 2;
  }

  // the reads
  const snow4 = read('snow4');
  const n4 = tangent(snow4);
  const z4 = zOf(n4);
  const n33 = tangent(read('snow33'));
  const detail = far ? null : read('detail');
  const packed = read('packed');
  const wavey = read('wavey');
  const chunky = read('chunky');
  const roughPacked = read('roughPacked');
  const roughDetail = read('roughPackedDetail');
  // (t8's alpha and t18 are the rough map at 0.5/m: one read)
  const rough5 = read('trampledDetail');
  const trampled = read('trampled');
  const rockyPacked = read('rockyPacked');
  const rocky = read('rocky');
  const rockyPackedC = read('rockyPackedColour');
  const rockyC = read('rockyColour');

  // the blowing snow's streaks: the flow's offset, the two reads, the listing's term
  let streak = float(0);
  if (wisps && has('data')) {
    const c = Math.cos(SNOW.windRad);
    const s = Math.sin(SNOW.windRad);
    const turned = vec2(xz.x.mul(c).sub(xz.y.mul(s)), xz.x.mul(s).add(xz.y.mul(c)));
    const at = (key) => turned.mul(cyclesOf(READS[key].cycles)).add(vec2(time.mul(READS[key].rate), 0));
    const flow = read('flow', at('flow')).rg.mul(SNOW.flowGain).add(SNOW.flowBias);
    const a = read('streakA', at('streakA').add(flow)).b;
    const b = read('streakB', at('streakB').add(flow)).b;
    const x = a.mul(a).mul(one.sub(b.mul(b))).sub(SNOW.streakBias).mul(4).clamp(0, 1);
    streak = smoothstep(0, 1, x);
  }

  // each layer's mask as its block shapes it (layerMasks)
  const lm = (m, k) => one.sub(m).mul(k);
  const m1 = packed ? ma.x.mul(ma.x.add(lm(ma.x, packed.z))) : ma.x;
  const te = LAYERS.trampledEdge;
  const m4 = rough5
    ? smoothstep(
        0,
        1,
        lm(ma.w, rough5.w.mul(ma.w).mul(2).sub(ma.w)).add(ma.w).sub(te.lift).mul(te.gain).clamp(0, 1),
      )
    : smoothstep(0, 1, ma.w.sub(te.lift).mul(te.gain).clamp(0, 1));
  const hb = (m, h, p) => lm(m, h.mul(p.height).mul(m).sub(m)).add(m).mul(p.gain).add(p.lift).clamp(0, 1);
  const m5 = rockyPacked ? hb(mb.x, rockyPacked.z, LAYERS.rockyPackedBlend) : mb.x;
  const m6 = rocky ? hb(mb.y, rocky.z, LAYERS.rockyBlend) : mb.y;
  const shaped = [m1, ma.y, ma.z, m4, m5, m6, streak.mul(mb.z)];

  // the weights, top down (layerWeights)
  let rest = one.add(mb.w);
  const w = new Array(8);
  for (let k = 6; k >= 0; k--) {
    w[k + 1] = shaped[k].mul(rest);
    rest = rest.sub(w[k + 1]);
  }
  w[0] = rest;

  // each layer's normal in the shader's frame, not yet unit
  const nWith = (xy, z) => vec3(xy.x, xy.y, z);
  const nd = detail ? tangent(detail) : vec2(0, 0);
  const np = packed ? tangent(packed) : null;
  const nc = chunky ? tangent(chunky) : null;
  const nt = trampled ? tangent(trampled) : null;
  const nr5 = rockyPacked ? tangent(rockyPacked) : null;
  const nr6 = rocky ? tangent(rocky) : null;
  const normals = [
    nWith(n4.add(nd).add(n33), z4),
    np ? nWith(np.add(n4).add(wavey ? tangent(wavey) : vec2(0, 0)), zOf(np)) : nWith(n4, z4),
    nc ? nWith(nc.mul(LAYERS.chunkyGain).add(n4), z4) : nWith(n4, z4),
    roughPacked ? nWith(tangent(roughPacked).add(n4).add(roughDetail ? tangent(roughDetail).mul(LAYERS.roughPackedDetailGain) : vec2(0, 0)), z4) : nWith(n4, z4),
    nt ? nWith(nt.add(rough5 ? tangent(rough5) : vec2(0, 0)), zOf(nt)) : nWith(n4, z4),
    nr5 ? nWith(nr5.add(n4), zOf(nr5)) : nWith(n4, z4),
    nr6 ? nWith(nr6, zOf(nr6)) : nWith(n4, z4),
    vec3(0, 0, 1),
  ];
  let bend = normals[0].mul(w[0]);
  for (let k = 1; k < 8; k++) bend = bend.add(normals[k].mul(w[k]));

  // each layer's colour and smoothness (texelOf), and the dynamic mask's S where one is given
  const base = vec3(colour);
  let S = null;
  let under = null;
  if (dynamic?.texture) {
    const uv = xz.sub(vec2(...dynamic.corner)).div(vec2(...dynamic.extent));
    const d = texture(dynamic.texture, uv).a;
    const grey = read('roughGrey');
    const sootMap = maps.soot ? texture(maps.soot, xz.mul(READS.soot.cycles)) : null;
    samples.data += 1 + (sootMap ? 1 : 0);
    const soot = sootMap ? sootMap.b.mul(sootMap.a).mul(LAYERS.soot.gain).add(LAYERS.soot.lift).clamp(0, 1) : float(0);
    const q = grey ? one.add(grey.z).sub(soot).mul(one.sub(grey.y)) : one.sub(soot);
    const d2 = d.mul(d);
    S = one.sub(d2).mul(one.add(d2.mul(q.mul(2).sub(1))));
    const g = (grey ? grey.x : float(0.5)).add(LAYERS.greyLift);
    const k = S.mul(LAYERS.brownEdge).clamp(0, 1);
    under = vec3(g, g.mul(one.sub(k.mul(1 - LAYERS.brown[1]))), g.mul(one.sub(k.mul(1 - LAYERS.brown[2]))));
  }
  const touched = (c) => (S ? mix(under, c, S.clamp(0, 1)) : c);
  const c0 = touched(base);
  const c3 = roughPacked ? touched(vec3(roughPacked.w)) : c0;
  const c5 = rockyPackedC ? rockyPackedC.rgb : base;
  const c6 = rockyC ? touched(rockyC.rgb.mul(LAYERS.rockyColour)) : c0;
  const cols = [c0, c0, c0, c3, c0, c5, c6, base];
  let albedo = cols[0].mul(w[0]);
  for (let k = 1; k < 8; k++) albedo = albedo.add(cols[k].mul(w[k]));
  material.colorNode = albedo.clamp(0, 1);
  if (debug === 'layers') {
    let shown = vec3(...LAYER_DEBUG[0]).mul(w[0]);
    for (let k = 1; k < 8; k++) shown = shown.add(vec3(...LAYER_DEBUG[k]).mul(w[k]));
    material.colorNode = shown.mul(0.8).clamp(0, 1);
  }

  const sm = float(SNOW.smoothness);
  const sS = S ? sm.mul(S) : sm;
  const s6 = rocky ? rocky.w.mul(LAYERS.rockySmoothness.gain).add(LAYERS.rockySmoothness.base) : sm;
  const smooths = [sS, sS, sS, sS, sS, sm, S ? s6.mul(S) : s6, float(SNOW.streakSmoothness)];
  let smoothness = smooths[0].mul(w[0]);
  for (let k = 1; k < 8; k++) smoothness = smoothness.add(smooths[k].mul(w[k]));
  let r = one.sub(smoothness.clamp(0, 1));

  // the sparkle: the on-screen pass of the layers that carry it (8, and 7's), on the near band
  const crystal = far || !wisps ? null : read('sparkle');
  if (crystal) {
    const dist = positionWorld.sub(cameraPosition).length();
    const near = one.sub(smoothstep(NEAR_BAND[0], NEAR_BAND[1], dist));
    const where = mb.w.add(mb.z).clamp(0, 1);
    r = r.sub(crystal.r.mul(near).mul(where).mul(SPARKLE_DIP)).clamp(0.05, 1);
  }
  material.roughnessNode = r;

  // (the shader's frame: x along world x, y along ground × x, z along the ground's normal)
  const ground = normalize(normalWorldGeometry);
  const nts = normalize(bend);
  const n = vec3(nts.x, 0, 0).add(vec3(0, ground.z, ground.y.negate()).mul(nts.y)).add(ground.mul(nts.z));
  material.normalNode = transformNormalToView(normalize(n));

  if (displace && !far) {
    // (the vertex's world xz from the attribute, not the displaced position)
    const p = modelWorldMatrix.mul(vec4(positionGeometry, 1)).xz;
    const h = read('snow4', p.mul(SNOW.displacement.cycles)).level(float(1)).b;
    const dh = h.mul(SNOW.displacement.gain).add(SNOW.displacement.lift).sub(DISPLACE_MID).mul(DISPLACE_M);
    material.positionNode = positionGeometry.add(normalGeometry.mul(dh));
  }
  return finish();

  function finish() {
    return {
      material,
      samples,
      flat,
      dispose() {
        material.dispose();
      },
    };
  }
}

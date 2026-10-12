// Hoth's snow as the game's terrain shader draws its base layer (the study's
// finding 35 and the listing it keeps; the numbers in snowMaps.js), as a
// node material for a heightfield on the node renderer. World xz is the
// game's own (the pack sits at its origin unturned), so a read here is the
// game's read. Over the record's flat TerrainColor: three normal octaves
// summed (4 m, 33 m, 1 m) in the shader's frame; smoothness 0.26; the
// blowing snow's wisps, read in the frame the shader turns 3 rad and slid
// at its rates through the flow map, laid as the game lays its layer 7
// (the base's colour, a flat normal, smoothness 0.25); the sparkle on the
// near band alone, as the game's 3-D pass draws it, read as a dip in the
// roughness so the sun's highlight glints on the crystals; on ultra the
// near patch's vertices displaced by the 4 m map's blue (the game's
// displacement pass: a height × 0.35 + 0.4, by a scale the record does not
// state).
//
//   createSnowGround({ maps, tier, three, far = false, displace = false }) → { material, samples, flat, dispose }
//     (maps: { [slug]: Texture } as snowMaps.js names them; three: loadThree()'s { THREE, tsl };
//      far: the coarse grid's material, the two large octaves alone;
//      flat: true when the 4 m map is not there, the record's colour alone)
//
// Tiers: low draws the colour alone (no maps fetched); mid the three
// octaves; high the octaves, the wisps and the sparkle; ultra the same and
// the displacement. The far grid takes the 4 m and 33 m octaves from mid
// up. A map that is not there leaves its term out; without the 4 m map
// nothing is read at all.
//
// Pure, for the tests: mapsFor(tier, { far }), tileUv(p, cycles),
// windFrame(p, rad), streakUv(p, cycles, rate, t), streakTerm(a, b),
// layerNormal(octaves, weight), worldNormal(n, ground), nearBand(d, band),
// smoothnessUnder(weight), displaceHeight(b)

import { SNOW, SNOW_BASE, SNOW_DETAIL, SNOW_MAPS, SNOW_ROLES } from './snowMaps.js';

// metres: the sparkle (the game's near pass) and the 1 m octave fade over
// this band; a 1 m tile is a few pixels by 80 m on a desktop screen
export const NEAR_BAND = [30, 80];
// the blowing snow's painted mask (the game lays its layer 7 where the
// level's artists painted it; the paint is in the streaming tree, unread:
// the site lays the wisps everywhere at this weight)
export const STREAK_WEIGHT = 0.5;
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

const WISPS = [SNOW_ROLES.streaks, SNOW_ROLES.flow, SNOW_ROLES.sparkle];
const PLAN = {
  low: [],
  mid: [SNOW_BASE, SNOW_DETAIL],
  high: [SNOW_BASE, SNOW_DETAIL, ...WISPS],
  ultra: [SNOW_BASE, SNOW_DETAIL, ...WISPS],
};
const FAR_PLAN = { low: [], mid: [SNOW_BASE], high: [SNOW_BASE], ultra: [SNOW_BASE] };

// the maps a tier's material reads
export const mapsFor = (tier, { far = false } = {}) => (far ? FAR_PLAN : PLAN)[tier] ?? PLAN.high;

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

// the layer's normal in the shader's frame, not yet unit: the octaves'
// (2t − 1) summed, z rebuilt from the first (the 4 m read), and the blowing
// snow's weight laid over it flat (the listing's w0 · n + (0, 0, w7))
export function layerNormal(octaves, weight = 0) {
  let x = 0;
  let y = 0;
  for (const [ox, oy] of octaves) {
    x += ox;
    y += oy;
  }
  const [fx, fy] = octaves[0] ?? [0, 0];
  const z = Math.sqrt(Math.max(0, 1 - fx * fx - fy * fy));
  const w0 = 1 - weight;
  return [x * w0, y * w0, z * w0 + weight];
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

// the smoothness under a weight of blowing snow: the record's 0.26, the layer's 0.25
export const smoothnessUnder = (weight = 0) => SNOW.smoothness * (1 - weight) + SNOW.streakSmoothness * weight;

// the displacement in metres from the height map's blue, about a mid grey
export const displaceHeight = (b, scale = DISPLACE_M) => (b * SNOW.displacement.gain + SNOW.displacement.lift - DISPLACE_MID) * scale;

export function createSnowGround({ maps = {}, tier = 'high', three, far = false, displace = false }) {
  const { THREE, tsl } = three;
  const { uniform, texture, vec2, vec3, vec4, float, positionWorld, positionGeometry, normalGeometry, normalWorldGeometry, modelWorldMatrix, cameraPosition, transformNormalToView, mix, smoothstep, normalize, time } = tsl;
  const material = new THREE.MeshStandardNodeMaterial({ metalness: 0 });
  material.name = `snow-ground:${far ? 'far' : 'near'}:${tier}`;
  const colour = uniform(new THREE.Color(...SNOW.colour));
  const want = mapsFor(tier, { far }).filter((s) => maps[s]);
  const has = (slug) => want.includes(slug);
  const samples = { normal: 0, data: 0 };
  material.colorNode = vec3(colour);
  // (without the 4 m map there is no layer to draw: the record's colour, as the ground was)
  const flat = !has(SNOW_BASE);
  if (flat) {
    material.roughnessNode = float(1 - SNOW.smoothness);
    return finish();
  }

  const xz = positionWorld.xz;
  const dist = positionWorld.sub(cameraPosition).length();
  const near = float(1).sub(smoothstep(NEAR_BAND[0], NEAR_BAND[1], dist));
  const tangent = (s) => s.xy.mul(2).sub(1);
  const cyclesOf = (cycles) => (Array.isArray(cycles) ? vec2(...cycles) : cycles);

  // the normal: the octaves summed, z from the 4 m read
  const base = SNOW_MAPS[SNOW_BASE].cycles;
  const first = tangent(texture(maps[SNOW_BASE], xz.mul(base[0])));
  let bend = first.add(tangent(texture(maps[SNOW_BASE], xz.mul(base[1]))));
  samples.normal += 2;
  if (has(SNOW_DETAIL)) {
    bend = bend.add(tangent(texture(maps[SNOW_DETAIL], xz.mul(SNOW_MAPS[SNOW_DETAIL].cycles[0]))).mul(near));
    samples.normal++;
  }
  let up = float(1).sub(first.dot(first)).max(0).sqrt();

  // the blowing snow: the flow's offset, the two reads of the wisps, the listing's weight
  let r = float(1 - SNOW.smoothness);
  if (has(SNOW_ROLES.streaks) && has(SNOW_ROLES.flow)) {
    const c = Math.cos(SNOW.windRad);
    const s = Math.sin(SNOW.windRad);
    const turned = vec2(xz.x.mul(c).sub(xz.y.mul(s)), xz.x.mul(s).add(xz.y.mul(c)));
    const at = (cycles, rate) => turned.mul(cyclesOf(cycles)).add(vec2(time.mul(rate), 0));
    const flowMap = SNOW_MAPS[SNOW_ROLES.flow];
    const wisps = SNOW_MAPS[SNOW_ROLES.streaks];
    const flow = texture(maps[SNOW_ROLES.flow], at(flowMap.cycles[0], flowMap.rates[0])).rg.mul(SNOW.flowGain).add(SNOW.flowBias);
    const [a, b] = wisps.cycles.map((cycles, i) => texture(maps[SNOW_ROLES.streaks], at(cycles, wisps.rates[i]).add(flow)).b);
    const x = a.mul(a).mul(float(1).sub(b.mul(b))).sub(SNOW.streakBias).mul(4).clamp(0, 1);
    const weight = smoothstep(0, 1, x).mul(STREAK_WEIGHT);
    const rest = float(1).sub(weight);
    bend = bend.mul(rest);
    up = up.mul(rest).add(weight);
    r = mix(r, float(1 - SNOW.streakSmoothness), weight);
    samples.data += 3;
  }
  if (has(SNOW_ROLES.sparkle)) {
    const crystal = texture(maps[SNOW_ROLES.sparkle], xz.mul(SNOW_MAPS[SNOW_ROLES.sparkle].cycles[0])).r;
    r = r.sub(crystal.mul(near).mul(SPARKLE_DIP)).clamp(0.05, 1);
    samples.data++;
  }
  material.roughnessNode = r;
  // (the shader's frame: x along world x, y along ground × x, z along the ground's normal)
  const ground = normalize(normalWorldGeometry);
  const n = vec3(bend.x, 0, 0).add(vec3(0, ground.z, ground.y.negate()).mul(bend.y)).add(ground.mul(up));
  material.normalNode = transformNormalToView(normalize(n));

  if (displace && !far) {
    // (the vertex's world xz from the attribute, not the displaced position)
    const p = modelWorldMatrix.mul(vec4(positionGeometry, 1)).xz;
    const h = texture(maps[SNOW_BASE], p.mul(SNOW.displacement.cycles)).level(float(1)).b;
    const d = h.mul(SNOW.displacement.gain).add(SNOW.displacement.lift).sub(DISPLACE_MID).mul(DISPLACE_M);
    material.positionNode = positionGeometry.add(normalGeometry.mul(d));
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

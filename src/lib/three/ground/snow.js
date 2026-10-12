// Hoth's snow as the game's terrain shader draws its base layer (the study's
// finding 35, the numbers in snowMaps.js), as a node material for a
// heightfield on the node renderer. World xz is the tiling frame (a
// heightfield faces up: no triplanar). Over the record's flat TerrainColor:
// three normal octaves summed (4 m, 33 m, 1 m); smoothness 0.26 moved by the
// brightness map; the soot mask darkening; the blowing snow's streaks
// scrolled along 172° through the flow map, flattening the normal and
// lifting the colour a little; the sparkle on the near band alone, as the
// game's 3-D pass draws it, read as a dip in the roughness so the sun's
// highlight glints on the crystals; on ultra the near patch's vertices
// displaced by the 4 m map's blue (the game's displacement pass: its height
// × 0.35 + 0.4, by a scale the record does not state).
//
//   createSnowGround({ maps, tier, three, far = false, displace = false }) → { material, samples, dispose }
//     (maps: { [slug]: Texture } as snowMaps.js names them; three: loadThree()'s { THREE, tsl };
//      far: the coarse grid's material, the two large octaves alone)
//
// Tiers: low draws the colour alone (no maps fetched); mid the 4 m and 1 m
// octaves; high every map; ultra every map and the displacement. The far
// grid takes the 4 m and 33 m octaves from mid up.
//
// Pure, for the tests: mapsFor(tier, { far }), tileUv(p, cycles),
// windDir(deg), scrollUv(p, cycles, deg, t), streakTerm(a, b),
// sumNormal(octaves), nearBand(d, band), smoothnessOf(r), displaceHeight(b)

import { SNOW, SNOW_BASE, SNOW_DETAIL, SNOW_MAPS, SNOW_ROLES } from './snowMaps.js';

// metres: the sparkle (the game's near pass) and the 1 m octave fade over
// this band; a 1 m tile is a few pixels by 80 m on a desktop screen
export const NEAR_BAND = [30, 80];
// m/s the streaks drift along the wind (the shader's rate is in the engine's
// time constant, unread: judged against the game's capture)
export const WIND_MS = 2.5;
// how far the streaks lift the colour toward white and flatten the normal
// where they lie (the game paints them only where its blowing-snow layer is
// masked; the site has no mask, so they lie light everywhere)
export const STREAK = { lift: 0.06, flatten: 0.6, weight: 0.5 };
// the soot's darkening of the colour where the mask passes the game's threshold
export const SOOT_DARK = 0.45;
// the crystals' dip in the roughness on the near band (judged on the shot)
export const SPARKLE_DIP = 0.5;
// m: the displacement's full scale (the game's DetailDisplacementScale is
// not in the record; the lumps near the camera are a few centimetres)
export const DISPLACE_M = 0.35;
// the displacement's middle, so the patch neither rises nor sinks on average
const DISPLACE_MID = SNOW.displacement.lift + SNOW.displacement.gain / 2;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const sat = (x) => Math.min(1, Math.max(0, x));

const PLAN = {
  low: [],
  mid: [SNOW_BASE, SNOW_DETAIL],
  high: Object.keys(SNOW_MAPS),
  ultra: Object.keys(SNOW_MAPS),
};
const FAR_PLAN = { low: [], mid: [SNOW_BASE], high: [SNOW_BASE], ultra: [SNOW_BASE] };

// the maps a tier's material reads, in snowMaps.js's order
export const mapsFor = (tier, { far = false } = {}) => (far ? FAR_PLAN : PLAN)[tier] ?? PLAN.high;

export const tileUv = ([x, z], cycles) => (Array.isArray(cycles) ? [x * cycles[0], z * cycles[1]] : [x * cycles, z * cycles]);

export const windDir = (deg) => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];

// a streak read's uv at time t: the tile, slid against the wind at WIND_MS
export function scrollUv(p, cycles, deg, t, ms = WIND_MS) {
  const [u, v] = tileUv(p, cycles);
  const [dx, dz] = windDir(deg);
  const [cu, cv] = Array.isArray(cycles) ? cycles : [cycles, cycles];
  return [u - dx * ms * t * cu, v - dz * ms * t * cv];
}

// the game's combination of the two streak reads
export const streakTerm = (a, b) => {
  const x = sat(4 * (a * a - a * a * b * b - SNOW.streakBias));
  return x * x * (3 - 2 * x);
};

// the octaves' tangent xy summed under an up-facing normal (UDN)
export function sumNormal(octaves) {
  let x = 0;
  let z = 0;
  for (const [ox, oz] of octaves) {
    x += ox;
    z += oz;
  }
  const l = Math.hypot(x, 1, z);
  return [x / l, 1 / l, z / l];
}

export const nearBand = (d, [a, b] = NEAR_BAND) => 1 - smooth(a, b, d);

// the smoothness about the record's 0.26, moved by the brightness map's red
// (the shader's `r + 0.05` grey): the map's middle grey leaves it as it is
export const smoothnessOf = (r) => Math.min(0.5, Math.max(0.1, SNOW.smoothness * 2 * (r + SNOW.brightnessLift)));

// the displacement in metres from the height map's blue, centred
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
  const rough = 1 - SNOW.smoothness;
  if (!want.length) {
    material.colorNode = vec3(colour);
    material.roughnessNode = float(rough);
    return finish();
  }

  const xz = positionWorld.xz;
  const dist = positionWorld.sub(cameraPosition).length();
  const near = float(1).sub(smoothstep(NEAR_BAND[0], NEAR_BAND[1], dist));
  const read = (slug, cycles) => texture(maps[slug], xz.mul(Array.isArray(cycles) ? vec2(...cycles) : cycles));
  const tangent = (s) => s.xy.mul(2).sub(1);

  // the normal: the octaves summed under the ground's own
  let bend = vec2(0, 0);
  const base = SNOW_MAPS[SNOW_BASE].cycles;
  bend = bend.add(tangent(read(SNOW_BASE, base[0])));
  bend = bend.add(tangent(read(SNOW_BASE, base[1])));
  samples.normal += 2;
  if (has(SNOW_DETAIL)) {
    bend = bend.add(tangent(read(SNOW_DETAIL, SNOW_MAPS[SNOW_DETAIL].cycles[0])).mul(near));
    samples.normal++;
  }

  let c = vec3(colour);
  let r = float(rough);
  if (has(SNOW_ROLES.brightness)) {
    const b = read(SNOW_ROLES.brightness, SNOW_MAPS[SNOW_ROLES.brightness].cycles[0]).r;
    r = float(1).sub(float(SNOW.smoothness * 2).mul(b.add(SNOW.brightnessLift)).clamp(0.1, 0.5));
    samples.data++;
  }
  if (has(SNOW_ROLES.soot)) {
    const m = read(SNOW_ROLES.soot, SNOW_MAPS[SNOW_ROLES.soot].cycles[0]);
    const soot = smoothstep(SNOW.sootOver, 1, m.r.mul(m.b));
    c = c.mul(float(1).sub(soot.mul(SOOT_DARK)));
    samples.data++;
  }
  let streak = null;
  if (has(SNOW_ROLES.streaks) && has(SNOW_ROLES.flow)) {
    const [dx, dz] = windDir(SNOW.windDeg);
    const flow = read(SNOW_ROLES.flow, SNOW_MAPS[SNOW_ROLES.flow].cycles[0]).xy.mul(SNOW.flowGain).add(SNOW.flowBias);
    const slide = vec2(dx, dz).mul(time.mul(WIND_MS));
    const reads = SNOW_MAPS[SNOW_ROLES.streaks].cycles.map((cy) => texture(maps[SNOW_ROLES.streaks], xz.sub(slide).mul(vec2(...cy)).add(flow)).r);
    const a = reads[0];
    const b = reads[1];
    const x = a.mul(a).sub(a.mul(a).mul(b).mul(b)).sub(SNOW.streakBias).mul(4).clamp(0, 1);
    streak = smoothstep(0, 1, x).mul(STREAK.weight);
    c = mix(c, vec3(1), streak.mul(STREAK.lift));
    r = mix(r, float(1 - SNOW.streakSmoothness), streak);
    bend = bend.mul(float(1).sub(streak.mul(STREAK.flatten)));
    samples.data += 3;
  }
  if (has(SNOW_ROLES.sparkle)) {
    const crystal = read(SNOW_ROLES.sparkle, SNOW_MAPS[SNOW_ROLES.sparkle].cycles[0]).r;
    r = r.sub(crystal.mul(near).mul(SPARKLE_DIP)).clamp(0.05, 1);
    samples.data++;
  }
  material.colorNode = c;
  material.roughnessNode = r;
  const n = normalize(normalize(normalWorldGeometry).add(vec3(bend.x, 0, bend.y)));
  material.normalNode = transformNormalToView(n);

  if (displace && !far) {
    // (the vertex's world xz from the attribute, not the displaced position)
    const p = modelWorldMatrix.mul(vec4(positionGeometry, 1)).xz;
    const h = texture(maps[SNOW_BASE], p.mul(0.2)).level(float(1)).b;
    const d = h.mul(SNOW.displacement.gain).add(SNOW.displacement.lift).sub(DISPLACE_MID).mul(DISPLACE_M);
    material.positionNode = positionGeometry.add(normalGeometry.mul(d));
  }
  return finish();

  function finish() {
    return {
      material,
      samples,
      dispose() {
        material.dispose();
      },
    };
  }
}

// Cloud shadows: the record's two cloud layers as a term in 0…1, drifting
// over the ground, multiplied into the sun's shadow (sun.js `cloud`), so
// every lit node material that receives the sun's shadow takes it.
//
// The record (OutdoorLightComponentData) sizes the layers (CloudShadowSize
// 8,192 m on Hoth, SecondaryCloudShadowSize 500 m), says how much each
// darkens (…Coverage: 1 and 0.3) and how sharp its clouds are (…Exponent:
// 1 and 8), and how fast each drifts (…Speed, 0 on Hoth). The game's cloud
// texture is not in the export, so each layer's density is three's MaterialX
// fractal noise over the ground, the clouds where it rises over CLOUD_EDGE:
//
//   term = Π over the layers of 1 − coverage × density^exponent
//
// A layer that does not drift by the record drifts on the weather's wind
// (WindComponentData: WindStrength in m/s, WindDirection in degrees, read
// as the azimuth it blows toward, from +Z toward +X, as entry.js's sunDir).
// A record whose layers all have coverage 0 has no cloud shadow.
//
// readClouds(entry, wind) → { on, layers: [{ size, coverage, exponent, speed: [x, z] }] }  (pure)
// cloudDensity(noise01), cloudTerm(density, coverage, exponent), drift(layer, seconds)    (pure)
// cloudShadowNode(entry, wind) → Promise<{ node, offsets, update(dt), dispose } | null>

import { loadThree } from './three.js';

// the noise's rise from clear sky to the thickest cloud: about a fifth of
// the ground under some cloud, little of it under the thickest (Hoth's
// sunny weather is clear in the game's frames)
export const CLOUD_EDGE = [0.6, 0.95];
const OCTAVES = 3;
const num = (v, d) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? d : Number(v));
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function readClouds(entry, wind = null) {
  const o = entry?.record?.OutdoorLightComponentData?.[0] ?? entry?.sun?.raw ?? {};
  const w = wind ?? entry?.record?.WindComponentData?.[0] ?? entry?.wind?.raw ?? {};
  const strength = num(w.WindStrength ?? w.strength, 0);
  const dir = (num(w.WindDirection, null) ?? ((num(w.dir, 0) * 180) / Math.PI)) * (Math.PI / 180);
  const windSpeed = [Math.sin(dir) * strength, Math.cos(dir) * strength];
  const layer = (prefix, size, coverage, exponent) => {
    const sx = num(o[`${prefix}Speed.x`] ?? o[`${prefix}Speed`]?.x, 0);
    const sz = num(o[`${prefix}Speed.y`] ?? o[`${prefix}Speed`]?.y, 0);
    return {
      size: num(o[`${prefix}Size`], size),
      coverage: num(o[`${prefix}Coverage`], coverage),
      exponent: num(o[`${prefix}Exponent`], exponent),
      speed: sx || sz ? [sx, sz] : windSpeed.slice(),
    };
  };
  const layers = [layer('CloudShadow', 8192, 0, 1), layer('SecondaryCloudShadow', 500, 0, 1)];
  return { on: layers.some((l) => l.coverage > 0), layers };
}

export const cloudDensity = (n) => smooth(CLOUD_EDGE[0], CLOUD_EDGE[1], n);
export const cloudTerm = (density, coverage, exponent) => 1 - coverage * density ** exponent;
export const drift = (layer, seconds) => [layer.speed[0] * seconds, layer.speed[1] * seconds];

export async function cloudShadowNode(entry, wind = null) {
  const c = readClouds(entry, wind);
  if (!c.on) return null;
  const { THREE, tsl } = await loadThree();
  const { float, positionWorld, mx_fractal_noise_float, renderGroup, smoothstep, uniform, vec3 } = tsl;
  const layers = c.layers.filter((l) => l.coverage > 0);
  // (in the render's group: the shadow is built in the light's context, where
  // an object-group uniform is not refreshed per frame)
  const offsets = layers.map(() => uniform(new THREE.Vector2()).setGroup(renderGroup));
  let node = float(1);
  layers.forEach((l, i) => {
    const p = positionWorld.xz.sub(offsets[i]).div(l.size);
    // (MaterialX's fractal noise keeps mostly within ±0.5 round 0: centred on ½)
    const n = mx_fractal_noise_float(vec3(p.x, p.y, i * 17.31), OCTAVES, 2, 0.5).add(0.5);
    const density = smoothstep(CLOUD_EDGE[0], CLOUD_EDGE[1], n);
    node = node.mul(float(1).sub(density.pow(l.exponent).mul(l.coverage)));
  });
  let t = 0;
  return {
    node,
    offsets,
    layers,
    update(dt) {
      t += dt;
      layers.forEach((l, i) => offsets[i].value.set(...drift(l, t)));
    },
    dispose() {},
  };
}

// The flares from the records: the sun's (each weather's
// SunFlareComponentData) and the game's twelve LensFlareBlueprints (the ion
// bomb's explosion, the grenades' trails, the Star Destroyer's searchlight,
// the sabers' blocks…), read into one shape and turned into what three's
// LensflareNode takes plus the alpha the record's curves give it.
//
// What the records hold (read from the bucket's data/, 2026-10-10): the sun
// flare has five elements in flat fields, `Element<N>Size` (x, y: the
// sprite's size against the screen), `Element<N>RayDistance` (where along
// the line from the sun through the screen's centre it sits: 0 on the sun,
// 1 mirrored through the centre), `Element<N>SizeOccluderCurve`,
// `…SizeScreenPosCurve`, `…AlphaOccluderCurve`, `…AlphaScreenPosCurve`,
// `…RotationDistCurve`, plus `OccluderSize` (4,000 on Hoth: the occluder's
// disc at the sun's distance). A LensFlareEntityData holds the same per
// element in `Elements[]`, with `SizeCamDistCurve` and `AlphaCamDistCurve`
// (over the distance to the camera up to `SizeCamDistMax` and
// `AlphaCamDistMax`) and `SizeAngleCurve`, `AlphaAngleCurve`, and its own
// `OccluderSize` (metres), `Dimmer`, `DepthBias`. Each curve is a cubic,
// x t³ + y t² + z t + w, as the fog's is. The occluder's input is the
// share of the occluder's disc that is covered: Hoth's day's alpha curve
// (0.434, 0.150, −1.584, 1) is 1 with the sun clear and 0.000 with it
// hidden; the size curve (0, 0, −0.5, 1) halves the glare as a ridge
// covers it.
//
// LensflareNode draws ghosts of the bloom's bright pixels along the line
// through the centre; it has no sprites, so the record's elements set its
// ghosts (one per element off the sun, spaced at the mean step between
// their RayDistances) and the record's alpha scales the whole flare: the
// sun's screen disc tested against the depth (OCCLUDER_TAPS samples within
// OCCLUDER_DISC of the screen's height, the sky's depth counting as clear),
// the alpha curve of the brightest element at that coverage and at the
// sun's distance from the centre (passes.js).
//
// curve(c, t) → c.x t³ + c.y t² + c.z t + c.w   (pure)
// flareElements(record) → { occluderSize, dimmer, elements: [...] }   (pure)
// flareAt(flare, { occlusion, screen, camDist }) → { alpha, sizes: [[w, h]] }   (pure)
// lensflareParams(flare) → { ghostSamples, ghostSpacing }   (pure)
// eventFlare(name, table) → the named blueprint's flare from flares.json, or null   (pure)

export const OCCLUDER_DISC = 0.015; // of the screen's height: the disc tested round the sun (the sun's own is 0.004 rad, a few pixels)
export const OCCLUDER_TAPS = 16;
const ZERO = [0, 0, 0, 0];
const ONE = [0, 0, 0, 1];

export const curve = (c, t) => ((c[0] * t + c[1]) * t + c[2]) * t + c[3];
const clamp01 = (x) => Math.min(1, Math.max(0, x));

const v4 = (v, d = ONE) => (Array.isArray(v) ? v.slice(0, 4).map(Number) : v && typeof v === 'object' && 'x' in v ? [v.x, v.y, v.z, v.w ?? 0].map(Number) : d.slice());
const v2 = (v, d = [1, 1]) => (Array.isArray(v) ? v.slice(0, 2).map(Number) : v && typeof v === 'object' && 'x' in v ? [v.x, v.y].map(Number) : d.slice());
// a field in the bucket's shape ({ x, y, z, w }) or lighting.json's (dotted keys)
const get = (rec, k) => {
  if (rec[k] !== undefined) return rec[k];
  if (rec[`${k}.x`] !== undefined) return { x: rec[`${k}.x`], y: rec[`${k}.y`], z: rec[`${k}.z`] ?? 0, w: rec[`${k}.w`] ?? 0 };
  return undefined;
};

function element(e) {
  return {
    size: v2(get(e, 'Size')),
    rayDistance: Number(get(e, 'RayDistance') ?? 0),
    sizeOccluder: v4(get(e, 'SizeOccluderCurve')),
    sizeScreen: v4(get(e, 'SizeScreenPosCurve')),
    alphaOccluder: v4(get(e, 'AlphaOccluderCurve')),
    alphaScreen: v4(get(e, 'AlphaScreenPosCurve')),
    sizeCamDist: get(e, 'SizeCamDistCurve') ? v4(get(e, 'SizeCamDistCurve')) : null,
    alphaCamDist: get(e, 'AlphaCamDistCurve') ? v4(get(e, 'AlphaCamDistCurve')) : null,
    camDistMax: [Number(get(e, 'SizeCamDistMax') ?? 0), Number(get(e, 'AlphaCamDistMax') ?? 0)],
    rotation: v4(get(e, 'RotationDistCurve'), ZERO),
    enabled: get(e, 'EnableElement') !== false,
  };
}

// record: a SunFlareComponentData (bucket or lighting.json's flat row), a
// LensFlareEntityData, or a blueprint asset holding one
export function flareElements(record) {
  const rec = record?.objects?.find((o) => o?.$type === 'LensFlareEntityData') ?? record?.SunFlareComponentData?.[0] ?? record ?? {};
  let elements;
  if (Array.isArray(rec.Elements)) elements = rec.Elements.map(element);
  else {
    elements = [];
    for (let n = 1; ; n++) {
      const pre = `Element${n}`;
      const keys = Object.keys(rec).filter((k) => k.startsWith(pre) && !/^\d/.test(k.slice(pre.length)));
      if (!keys.length) break;
      const e = {};
      for (const k of keys) e[k.slice(pre.length)] = rec[k];
      elements.push(element(e));
    }
  }
  return { occluderSize: Number(rec.OccluderSize ?? 1), dimmer: Number(rec.Dimmer ?? 1), elements: elements.filter((e) => e.enabled) };
}

// Each element's alpha and size at an occluder coverage (0 clear … 1
// hidden), the source's distance from the screen's centre (0…1) and, for an
// event flare, its distance from the camera (m); `alpha` is the brightest
// element's, the one the whole node is scaled by.
export function flareAt(flare, { occlusion = 0, screen = 0, camDist = 0 } = {}) {
  const o = clamp01(occlusion);
  const s = clamp01(screen);
  let alpha = 0;
  const sizes = [];
  for (const e of flare.elements) {
    let a = clamp01(curve(e.alphaOccluder, o)) * clamp01(curve(e.alphaScreen, s));
    let k = Math.max(0, curve(e.sizeOccluder, o)) * Math.max(0, curve(e.sizeScreen, s));
    if (e.alphaCamDist && e.camDistMax[1] > 0) a *= clamp01(curve(e.alphaCamDist, clamp01(camDist / e.camDistMax[1])));
    if (e.sizeCamDist && e.camDistMax[0] > 0) k *= Math.max(0, curve(e.sizeCamDist, clamp01(camDist / e.camDistMax[0])));
    alpha = Math.max(alpha, a * flare.dimmer);
    sizes.push([e.size[0] * k, e.size[1] * k]);
  }
  return { alpha, sizes };
}

export function lensflareParams(flare) {
  const rays = flare.elements
    .map((e) => e.rayDistance)
    .filter((d) => d > 0)
    .sort((a, b) => a - b);
  if (!rays.length) return { ghostSamples: 1, ghostSpacing: 0.25 };
  const steps = rays.map((d, i) => d - (i ? rays[i - 1] : 0));
  return { ghostSamples: rays.length, ghostSpacing: steps.reduce((a, b) => a + b, 0) / steps.length };
}

export function eventFlare(name, table) {
  if (!table || !name) return null;
  const short = String(name).split('/').pop();
  return table.flares?.[short] ?? null;
}

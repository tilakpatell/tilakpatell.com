// The post chain a lit world asks for, as data for `rt.gfx.post`, in one
// fixed order, per tier, shed from the top when frames come late. Pure:
// the runtime builds it (src/runtime/webgpu.js, through passes.js here).
//
// The order (the design, "The light", post.js): render → ssgi (and its
// denoise) → ao → ssr → volumes → fog → bloom → godrays → lensflare →
// dof → motionBlur → lut → traa | smaa → output. A chain given out of order is put in it. The
// volumes (volumetrics.js) come before the bloom so they are tone-mapped
// and bloomed with the scene (the fidelity design, lane V).
//
// Rules three's sources set:
// - SSGINode's temporal filtering needs TRAANode; without it a chain with
//   `ssgi` gains `denoise` (DenoiseNode) and takes the non-temporal preset.
// - TRAA wants no multisampling and is the anti-aliasing: `traa` and
//   `smaa` together keep `traa`.
// - LensflareNode reads the bloom's texture: no `bloom`, no `lensflare`.
// - GodraysNode marches a DirectionalLight's shadow map (not SunLight's):
//   no light given, no `godrays`. raysLight(sun) picks it: sun.js's `rays`
//   helper, or the sun itself when it is a plain DirectionalLight with its
//   own shadow map. A CSMShadowNode sun (lane S's four cascades) is not
//   one: read from r186's source, the godrays node takes `isDirectionalLight`
//   or `isPointLight` and samples `light.shadow.map`, while
//   CSMShadowNode's cascades are its own `LwLight`s (an Object3D, neither
//   kind) and the light's own shadow map is not drawn, so the rays keep
//   the helper (the fidelity design's B2).
// - `motionBlur` is the weather's MotionBlurComponentData (MotionBlurEnable,
//   MotionBlurScale: Hoth's day on, 1) on ultra and high: the camera's
//   motion only (MotionBlurCentered false; the game's blur is the camera's,
//   never an object's), from the depth reprojected through the last
//   frame's camera; a record with it off, or none, has none.
// - `dof` only when asked (refs.dof: lane C's cinematic camera, its
//   { focus, aperture, focalLength, maxblur }), on every tier that has a
//   post chain on the node renderer.
// - `lensflare` with the record's SunFlareComponentData (flare.js) takes
//   its ghosts from the record's elements and is scaled by the record's
//   occluder and screen-position curves at the sun's screen disc.
// - `lut` needs the record's grading LUT as a Data3DTexture; none, none.
// - `volumes` needs a level's volumetrics (createVolumetrics); none, none.
// - `fog` (mode 'volume': fog.js's fogVolume) draws the record's forward
//   light scattering and its participating media; a record with neither
//   (Hoth's day: Presence 0) has none.
// - SSGI already darkens its creases; with `ao` beside it, its own AO is
//   left out of the composite (passes.js) so the two do not double.
//
// Backends: every pass builds on 'webgpu'. 'nodes-webgl' builds what the
// lit fixture shows it can (CANNOT: not SSR, not TRAA, which SMAA
// replaces); the classic 'webgl' builds none of these, so its chain is
// render, bloom, output as today.
//
// ORDER, NODE_PASSES, CANNOT, SSGI
// passesFor(tier, entry, backend = 'webgpu', refs = { scene, camera, light, lut, volumetrics, dof }) → passes
// motionBlurOf(entry) → { enabled, scale }   (pure: the record's, off without one)
// dofParams({ focus, aperture, focalLength, maxblur }) → { focusDistance, range, bokehScale }   (pure)
// raysLight(sun) → the light GodraysNode can march, or null
// shed(passes, level) → passes   (level 1 drops ssgi, 2 ssr, 3 god rays and flare, 4 ao)
// arrange(passes) → passes       (the order and the rules above)

import { BLOOM } from '../bloom.js';
import { readEntry } from './entry.js';
import { flareElements, lensflareParams } from './flare.js';
import { FOG_STEPS, fogMedia } from './fog.js';

export const ORDER = ['render', 'ssgi', 'denoise', 'ao', 'ssr', 'volumes', 'fog', 'bloom', 'godrays', 'lensflare', 'dof', 'motionBlur', 'lut', 'traa', 'smaa', 'output'];
// the kinds only the node renderer builds
export const NODE_PASSES = new Set(['ssgi', 'denoise', 'ao', 'ssr', 'volumes', 'fog', 'godrays', 'lensflare', 'dof', 'motionBlur', 'lut', 'traa', 'smaa']);
// What each backend cannot build. On 'nodes-webgl' the lit fixture
// (scripts/light-fixture.mjs, pass by pass) drew SSR as white smears below
// every pillar and TRAA as a flat grey frame, so both are left out there
// and SMAA takes TRAA's place; the rest drew as on the design.
export const CANNOT = { webgpu: new Set(), 'nodes-webgl': new Set(['ssr', 'traa']), webgl: NODE_PASSES };
// SSGINode's presets, from its own doc: with TRAA, and without
export const SSGI = {
  temporal: { low: { slices: 1, steps: 12 }, medium: { slices: 2, steps: 8 }, high: { slices: 3, steps: 16 } },
  plain: { low: { slices: 2, steps: 6 }, medium: { slices: 3, steps: 8 }, high: { slices: 4, steps: 12 } },
};
// SSGINode's giIntensity is 10, for an interior lit through a window; under
// an open sky the bounce at 10 whitens every wall, and at 2 with the bloom
// over it still washes the fixture out (its shots), so the game light asks
// for a tenth
export const GI = 1;
// DepthOfFieldNode's focal "length" is the distance from the focal plane at
// which a thing is wholly out of focus; a camera's is the thin lens's: half
// the depth of field round the focus, N·c·s²/f², with the circle of
// confusion of a 36 mm frame
export const COC = 0.03e-3; // m
export const MOTION_SAMPLES = 16; // MotionBlur's default
// m: how far SSGI gathers (SSGINode's 12 suits a hall; on open ground it
// reaches the sky's pixels above every surface that faces up)
export const SSGI_RADIUS = 4;
const SHED = [['ssgi', 'denoise'], ['ssr'], ['godrays', 'lensflare'], ['ao']];

const TIERS = {
  ultra: ['render', ['ssgi', 'high'], 'ao', 'ssr', 'volumes', 'fog', 'bloom', 'godrays', 'lensflare', 'motionBlur', 'lut', 'traa', 'output'],
  high: ['render', ['ssgi', 'medium'], 'ao', 'ssr', 'volumes', 'fog', 'bloom', 'motionBlur', 'lut', 'smaa', 'output'],
  mid: ['render', 'ao', 'bloom', 'smaa', 'output'],
  low: ['render', 'bloom', 'output'],
};

const rank = (k) => {
  const i = ORDER.indexOf(k);
  return i < 0 ? ORDER.length - 1.5 : i; // (anything else just before the output)
};
const has = (passes, kind) => passes.some((p) => p.kind === kind);

export function arrange(passes) {
  let out = passes
    .map((p, i) => [{ ...p }, i])
    .sort((a, b) => rank(a[0].kind) - rank(b[0].kind) || a[1] - b[1])
    .map(([p]) => p);
  if (has(out, 'traa')) out = out.filter((p) => p.kind !== 'smaa');
  if (!has(out, 'bloom')) out = out.filter((p) => p.kind !== 'lensflare');
  if (!has(out, 'ssgi')) out = out.filter((p) => p.kind !== 'denoise');
  out = out.filter((p) => p.kind !== 'godrays' || p.light);
  out = out.filter((p) => p.kind !== 'lut' || p.texture);
  out = out.filter((p) => p.kind !== 'volumes' || p.volumetrics);
  out = out.filter((p) => p.kind !== 'fog' || p.media?.active);
  out = out.filter((p) => p.kind !== 'motionBlur' || p.scale > 0);
  out = out.filter((p) => p.kind !== 'dof' || p.focus > 0);
  const ssgi = out.find((p) => p.kind === 'ssgi');
  if (ssgi) {
    const temporal = has(out, 'traa');
    if (ssgi.temporal !== temporal) {
      const preset = SSGI[temporal ? 'temporal' : 'plain'][ssgi.preset ?? 'medium'];
      Object.assign(ssgi, { temporal, ...preset });
    }
    if (!temporal && !has(out, 'denoise')) out.splice(out.indexOf(ssgi) + 1, 0, { kind: 'denoise' });
  }
  return out;
}

export function passesFor(tier, entry, backend = 'webgpu', refs = {}) {
  const p = readEntry(entry);
  const cannot = CANNOT[backend] ?? CANNOT.webgl;
  const make = {
    render: () => ({ kind: 'render', scene: refs.scene, camera: refs.camera }),
    ssgi: (preset) => ({ kind: 'ssgi', preset, temporal: tier === 'ultra', ...SSGI[tier === 'ultra' ? 'temporal' : 'plain'][preset], radius: SSGI_RADIUS, gi: GI, camera: refs.camera }),
    ao: () => ({ kind: 'ao', radius: p.ao.radius, bias: p.ao.bias, power: p.ao.power, camera: refs.camera }),
    ssr: () => ({ kind: 'ssr', maxDistance: 40, thickness: 0.1, camera: refs.camera }),
    volumes: () => ({ kind: 'volumes', volumetrics: refs.volumetrics ?? null, camera: refs.camera }),
    fog: () => ({ kind: 'fog', mode: 'volume', media: fogMedia(entry?.record), fog: p.fog, sun: { dir: p.sun.dir.slice(), color: p.sun.color.slice(), intensity: p.sun.intensity }, steps: FOG_STEPS[tier] ?? FOG_STEPS.high, camera: refs.camera }),
    bloom: () => ({ kind: 'bloom', strength: BLOOM.strength * p.bloom.scale, radius: BLOOM.radius, threshold: BLOOM.threshold }),
    godrays: () => ({ kind: 'godrays', light: refs.light ?? null, color: p.sun.color.slice(), density: 0.7, maxDensity: 0.5, camera: refs.camera }),
    motionBlur: () => {
      const mb = motionBlurOf(entry);
      return { kind: 'motionBlur', scale: mb.enabled ? mb.scale : 0, samples: MOTION_SAMPLES, camera: refs.camera };
    },
    dof: () => ({ kind: 'dof', ...refs.dof, ...dofParams(refs.dof ?? {}), camera: refs.camera }),
    lensflare: () => {
      const rec = entry?.record?.SunFlareComponentData?.[0] ?? entry?.flare ?? null;
      const flare = rec ? flareElements(rec) : null;
      return { kind: 'lensflare', threshold: 0.5, ghostSamples: 4, ghostSpacing: 0.25, ...(flare?.elements.length ? { ...lensflareParams(flare), flare, sunDir: p.sun.dir.slice(), camera: refs.camera } : {}) };
    },
    lut: () => ({ kind: 'lut', texture: refs.lut ?? p.grade.lut ?? null, intensity: 1 }),
    traa: () => ({ kind: 'traa', camera: refs.camera }),
    smaa: () => ({ kind: 'smaa' }),
    output: () => ({ kind: 'output' }),
  };
  const chain = (TIERS[tier] ?? TIERS.high).map((k) => (Array.isArray(k) ? make[k[0]](k[1]) : make[k]()));
  if (refs.dof && chain.length > 1) chain.push(make.dof());
  // (no TRAA on this backend: SMAA is the anti-aliasing instead)
  if (cannot.has('traa') && !cannot.has('smaa') && chain.some((x) => x.kind === 'traa')) chain.push(make.smaa());
  return arrange(chain.filter((x) => !cannot.has(x.kind)));
}

export function shed(passes, level = 0) {
  const drop = new Set(SHED.slice(0, Math.max(0, level)).flat());
  return arrange(passes.filter((p) => !drop.has(p.kind)));
}

export function raysLight(sun) {
  if (sun?.rays) return sun.rays;
  const l = sun?.light;
  if (l?.isDirectionalLight && l.castShadow && !l.shadow?.shadowNode?.isCSMShadowNode) return l;
  return null;
}

export function motionBlurOf(entry) {
  const r = entry?.record?.MotionBlurComponentData?.[0] ?? entry?.motionBlur ?? null;
  if (!r) return { enabled: false, scale: 0 };
  const scale = Number(r.MotionBlurScale ?? 1);
  return { enabled: r.MotionBlurEnable !== false && scale > 0, scale };
}

export function dofParams({ focus = 0, aperture = 8, focalLength = 35, maxblur = 1 } = {}) {
  const f = focalLength / 1000;
  return { focusDistance: focus, range: Math.max(0.1, (aperture * COC * focus * focus) / (f * f)), bokehScale: maxblur };
}

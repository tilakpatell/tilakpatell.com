// The post chain a lit world asks for, as data for `rt.gfx.post`, in one
// fixed order, per tier, shed from the top when frames come late. Pure:
// the runtime builds it (src/runtime/webgpu.js, through passes.js here).
//
// The order (the design, "The light", post.js): render → ssgi (and its
// denoise) → ao → ssr → volumes → fog → bloom → godrays → lensflare →
// dof → motionBlur → tonemap → lut → traa | smaa → upscale → sharpen →
// output. A chain given out of order is put in it. The
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
// - The record's picture (lane Q6, refs.grade: grade.js's gradeOf): the
//   bloom is its five Gaussians (BloomNode's five mips tinted by the
//   record's weights and colours, its BloomScale the strength, no
//   threshold); the AO its HBAO numbers; and where its tone map is one
//   grade.js reads (TONEMAPS: Linear, LinearApproxGamma, FilmicNeutral) a
//   `tonemap` pass takes the picture to 0…1 before the LUT, on every tier that has a node chain
//   (the game's order: the LUT reads the tone-mapped picture). Without
//   refs.grade nothing here changes.
// - `volumes` needs a level's volumetrics (createVolumetrics); none, none.
// - `fog` (mode 'volume': fog.js's fogVolume) draws the record's forward
//   light scattering and its participating media; a record with neither
//   (Hoth's day: Presence 0) has none.
// - `upscale` (fidelity lane U): the picture drawn under the screen's size
//   (`scale`, the internal resolution: 0.77, 0.67, 0.5) and brought up to it
//   as the last pass before the output, by FSR1Node or TAAUNode (`kind`).
//   TAAU is temporal and anti-aliases as it upscales: with it, no `traa`
//   and no `smaa`. FSR1 wants an anti-aliased source and pairs with SMAA:
//   a chain with `traa` and `fsr1` takes `smaa` in TRAA's place (TRAA's
//   history is the screen's size, so it cannot sit under the upscale). A
//   scale of 1 or more is no upscale. Only the canvas's drawing is
//   lowered: its CSS size, and the DOM HUD over it, stay the screen's.
// - `sharpen` (GPU-first lane N2): SharpenNode (RCAS) after a TAAU
//   upscale, which resolves its jittered history with a soft 9-tap filter
//   and sharpens nothing, at 0.2 + 0.4 × (1 − scale), at most 0.4 (the
//   lobe's weight: RCAS takes it as `sharpness`, in stops, −log2 of it).
//   FSR1 runs RCAS itself, so it gets none; native gets none. arrange()
//   puts it in or takes it out from the upscale alone.
// - A chain with a temporal pass (TRAA, or TAAU) draws its scene pass with
//   no multisampling (`antialias(passes)` false; passes.js): WebGPU draws
//   at 1 or 4 samples, and both resolve a jittered single-sampled history.
// - SSGI already darkens its creases; with `ao` beside it, its own AO is
//   left out of the composite (passes.js) so the two do not double.
//
// Backends: every pass builds on 'webgpu'. 'nodes-webgl' builds what the
// lit fixture shows it can (CANNOT: not SSR, not TRAA, which SMAA
// replaces); the classic 'webgl' builds none of these, so its chain is
// render, bloom, output as today.
//
// ORDER, NODE_PASSES, CANNOT, SSGI
// passesFor(tier, entry, backend = 'webgpu', refs = { scene, camera, light, lut, volumetrics, dof, upscale, grade }) → passes
// motionBlurOf(entry) → { enabled, scale }   (pure: the record's, off without one)
// dofParams({ focus, aperture, focalLength, maxblur }) → { focusDistance, range, bokehScale }   (pure)
// raysLight(sun) → the light GodraysNode can march, or null
// shed(passes, level) → passes   (level 1 drops ssgi, 2 ssr, 3 god rays and flare, 4 ao)
// arrange(passes) → passes       (the order and the rules above)
// upscaleKind(passes) → 'taau' with TRAA in the chain, else 'fsr1'
// sharpenFor(scale) → the sharpen's strength; temporal(passes) → whether
//   TRAA or TAAU is in it; antialias(passes) → whether its scene may be multisampled
// upscaled(passes, { kind, scale, sharpness }) → passes   (the upscale pass added, or taken out at scale 1)
// headroom(passes, { scale, shed }, kind) → passes   (the pace's step: under the screen first, then shed;
//   src/runtime/quality.js's headroomAt(level) says which)

import { BLOOM } from '../bloom.js';
import { readEntry } from './entry.js';
import { flareElements, lensflareParams } from './flare.js';
import { FOG_STEPS, fogMedia } from './fog.js';
import { bloomTints } from './grade.js';

export const ORDER = ['render', 'ssgi', 'denoise', 'ao', 'ssr', 'volumes', 'fog', 'bloom', 'godrays', 'lensflare', 'dof', 'motionBlur', 'tonemap', 'lut', 'traa', 'smaa', 'upscale', 'sharpen', 'output'];
// the kinds only the node renderer builds
export const NODE_PASSES = new Set(['ssgi', 'denoise', 'ao', 'ssr', 'volumes', 'fog', 'godrays', 'lensflare', 'dof', 'motionBlur', 'tonemap', 'lut', 'traa', 'smaa', 'upscale', 'sharpen']);
// What each backend cannot build. On 'nodes-webgl' the lit fixture
// (scripts/light-fixture.mjs, pass by pass) drew SSR as white smears below
// every pillar and TRAA as a flat grey frame, so both are left out there
// and SMAA takes TRAA's place; the rest drew as on the design. SSGI once
// seemed broken there too (lane S's --hoth shot lifted from 0.320 to 0.787
// whatever its GI intensity): that was passes.js reading the node's first
// attachment, its occlusion, as the bounce, and adding the diffuse back
// whole. Read as three's example reads it (getAONode, getGINode) it
// darkens on both kinds (the laptop's Hoth: 0.517 → 0.481 on WebGPU, 0.502
// → 0.405 over WebGL 2), so it stays in on both.
export const CANNOT = { webgpu: new Set(), 'nodes-webgl': new Set(['ssr', 'traa']), webgl: NODE_PASSES };
// SSGINode's presets, from its own doc: with TRAA, and without
export const SSGI = {
  temporal: { low: { slices: 1, steps: 12 }, medium: { slices: 2, steps: 8 }, high: { slices: 3, steps: 16 } },
  plain: { low: { slices: 2, steps: 6 }, medium: { slices: 3, steps: 8 }, high: { slices: 4, steps: 12 } },
};
// SSGINode's giIntensity is 10, for an interior lit through a window; under
// an open sky the bounce at 10 whitens every wall, so the game light asks
// for a tenth. (The washing seen before was the composite's, not the
// bounce's: passes.js. Calibrate against the game's own Hoth on the laptop.)
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
// SSR only under this roughness; above it the material's own environment
// (the probes, or the atlas) gives the reflection (_source: Lumen's cut,
// the research note's Lumen section; lane N3). three r186's SSRNode has no
// cut of its own (no roughnessCutoff nor maxRoughness): passes.js masks its
// metalness, so a rougher pixel is skipped by SSRNode's own non-metal test.
export const SSR_ROUGHNESS = 0.4;
// FSR1Node's RCAS strength (0 the most, 2 none): its own default
export const FSR_SHARPNESS = 0.2;
export const UPSCALERS = ['fsr1', 'taau'];
// the sharpen after TAAU: its strength (RCAS's lobe weight) by the internal scale
export const SHARPEN = { base: 0.2, slope: 0.4, max: 0.4, _source: 'the GPU-first spec §4 “N2” (strength 0.2 to 0.4 by scale); RCAS, GPUOpen FidelityFX' };
export const sharpenFor = (scale = 1) => Math.min(SHARPEN.max, SHARPEN.base + SHARPEN.slope * (1 - Math.max(0, Math.min(1, scale))));
const SHED = [['ssgi', 'denoise'], ['ssr'], ['godrays', 'lensflare'], ['ao']];

// (high ends in TRAA since lane V1: PCSS, the fog march and the volumes
// dither with a static per-pixel noise that only a temporal pass integrates;
// SMAA left high grainy. On a backend without TRAA, CANNOT still swaps SMAA
// in, as before.)
const TIERS = {
  ultra: ['render', ['ssgi', 'high'], 'ao', 'ssr', 'volumes', 'fog', 'bloom', 'godrays', 'lensflare', 'motionBlur', 'lut', 'traa', 'output'],
  high: ['render', ['ssgi', 'medium'], 'ao', 'ssr', 'volumes', 'fog', 'bloom', 'motionBlur', 'lut', 'traa', 'output'],
  mid: ['render', 'ao', 'bloom', 'smaa', 'output'],
  low: ['render', 'bloom', 'output'],
};
// every pass with the record's numbers: the chain a video setting starts from
// (applyVideo drops and tunes; arrange() drops what has no input)
const FULL = ['render', ['ssgi', 'high'], 'ao', 'ssr', 'volumes', 'fog', 'bloom', 'godrays', 'lensflare', 'motionBlur', 'lut', 'traa', 'output'];

// The video settings over a chain (lib/video.js's resolved values, every
// field optional: one missing changes nothing). Pure; arrange() runs last,
// so SSGI follows TRAA's presence (temporal or denoised) and a pass with no
// input goes.
export function applyVideo(passes, video = {}) {
  if (!video) return arrange(passes);
  let out = passes.map((p) => ({ ...p }));
  const drop = (...kinds) => (out = out.filter((p) => !kinds.includes(p.kind)));
  const find = (kind) => out.find((p) => p.kind === kind);
  const camera = find('render')?.camera;
  if (video.aa === 'off') drop('traa', 'smaa');
  else if (video.aa === 'smaa') {
    drop('traa');
    if (!find('smaa')) out.push({ kind: 'smaa' });
  } else if (video.aa === 'traa' && !find('traa')) out.push({ kind: 'traa', camera });
  if (video.gi === 'off') drop('ssgi', 'denoise', 'ao');
  else if (video.gi === 'ssao') drop('ssgi', 'denoise');
  else if (['low', 'medium', 'high'].includes(video.gi)) {
    const g = find('ssgi');
    if (g) Object.assign(g, { preset: video.gi, ...SSGI[g.temporal ? 'temporal' : 'plain'][video.gi] });
  }
  if (video.reflections === 'probes') drop('ssr');
  else if (video.reflections === 'half' || video.reflections === 'full') {
    const r = find('ssr');
    if (r) r.resolutionScale = video.reflections === 'half' ? 0.5 : 1;
  }
  if (video.volumetric === 'off') drop('volumes');
  if (video.fogQuality) {
    const f = find('fog');
    if (f) f.steps = FOG_STEPS[video.fogQuality === 'high' ? 'ultra' : 'high'] ?? f.steps;
  }
  for (const [field, kind] of [['bloom', 'bloom'], ['lensFlare', 'lensflare'], ['godRays', 'godrays'], ['depthOfField', 'dof']]) if (video[field] === 'off') drop(kind);
  if (video.motionBlur === 'off') {
    const m = find('motionBlur');
    if (m) m.scale = 0;
  }
  return arrange(out);
}

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
  out = out.filter((p) => p.kind !== 'upscale' || (p.scale > 0 && p.scale < 1 && UPSCALERS.includes(p.upscaler)));
  const up = out.find((p) => p.kind === 'upscale');
  if (up && out.filter((p) => p.kind === 'upscale').length > 1) out = out.filter((p) => p.kind !== 'upscale' || p === up);
  // (TAAU is the anti-aliasing; FSR1 takes SMAA under it, never TRAA)
  if (up?.upscaler === 'taau') out = out.filter((p) => p.kind !== 'traa' && p.kind !== 'smaa');
  if (up?.upscaler === 'fsr1' && has(out, 'traa')) {
    const at = out.findIndex((p) => p.kind === 'traa');
    out = out.filter((p) => p.kind !== 'smaa');
    out.splice(at, 1, { kind: 'smaa' });
  }
  if (has(out, 'traa')) out = out.filter((p) => p.kind !== 'smaa');
  // (the sharpen follows a TAAU upscale and nothing else)
  out = out.filter((p) => p.kind !== 'sharpen');
  if (up?.upscaler === 'taau') {
    const strength = sharpenFor(up.scale);
    out.splice(out.indexOf(up) + 1, 0, { kind: 'sharpen', strength, sharpness: -Math.log2(strength) });
  }
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
  const grade = refs.grade ?? null;
  const hbao = grade?.ao ?? null;
  const make = {
    render: () => ({ kind: 'render', scene: refs.scene, camera: refs.camera }),
    ssgi: (preset) => ({ kind: 'ssgi', preset, temporal: tier === 'ultra', ...SSGI[tier === 'ultra' ? 'temporal' : 'plain'][preset], radius: SSGI_RADIUS, gi: GI, camera: refs.camera }),
    ao: () => ({ kind: 'ao', radius: p.ao.radius, bias: p.ao.bias, power: p.ao.power, ...(hbao ? { radius: hbao.radius, scale: hbao.exponent, falloff: hbao.attenuation, blur: hbao.blur, hbao } : {}), camera: refs.camera }),
    ssr: () => ({ kind: 'ssr', maxDistance: 40, thickness: 0.1, roughnessCutoff: SSR_ROUGHNESS, camera: refs.camera }),
    volumes: () => ({ kind: 'volumes', volumetrics: refs.volumetrics ?? null, camera: refs.camera }),
    fog: () => ({ kind: 'fog', mode: 'volume', media: fogMedia(entry?.record), fog: p.fog, sun: { dir: p.sun.dir.slice(), color: p.sun.color.slice(), intensity: p.sun.intensity }, steps: FOG_STEPS[tier] ?? FOG_STEPS.high, camera: refs.camera }),
    bloom: () => (grade?.bloom ? { kind: 'bloom', ...bloomTints(grade.bloom), radius: 0, gaussians: true } : { kind: 'bloom', strength: BLOOM.strength * p.bloom.scale, radius: BLOOM.radius, threshold: BLOOM.threshold }),
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
  // (a video setting given: every pass with the record's numbers, then the
  // setting says which stay; else the tier's own chain)
  let chain = (refs.video ? FULL : TIERS[tier] ?? TIERS.high).map((k) => (Array.isArray(k) ? make[k[0]](k[1]) : make[k]()));
  if (refs.dof && chain.length > 1) chain.push(make.dof());
  if (grade?.tonemap) chain.push({ kind: 'tonemap', method: grade.tonemap });
  if (refs.video) chain = applyVideo(chain, refs.video);
  // (no TRAA on this backend: SMAA is the anti-aliasing instead)
  if (cannot.has('traa') && !cannot.has('smaa') && chain.some((x) => x.kind === 'traa')) chain.push(make.smaa());
  const out = arrange(chain.filter((x) => !cannot.has(x.kind)));
  // (refs.upscale: { kind, scale }, the pace's step or the 4K start; none on the classic backend)
  return refs.upscale && !cannot.has('upscale') ? upscaled(out, refs.upscale) : out;
}

export function upscaleKind(passes) {
  return has(passes, 'traa') ? 'taau' : 'fsr1';
}

export const temporal = (passes) => has(passes, 'traa') || passes.some((p) => p.kind === 'upscale' && p.upscaler === 'taau');
export const antialias = (passes) => !temporal(passes);

export function upscaled(passes, { kind, scale = 1, sharpness = FSR_SHARPNESS } = {}) {
  const rest = passes.filter((p) => p.kind !== 'upscale');
  if (!(scale > 0 && scale < 1)) return arrange(rest);
  const upscaler = kind ?? upscaleKind(rest);
  const camera = rest.find((p) => p.kind === 'render')?.camera;
  return arrange([...rest, { kind: 'upscale', upscaler, scale, ...(upscaler === 'fsr1' ? { sharpness } : { camera }) }]);
}

export function headroom(passes, { scale = 1, shed: level = 0 } = {}, kind) {
  return upscaled(shed(passes, level), { kind, scale });
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

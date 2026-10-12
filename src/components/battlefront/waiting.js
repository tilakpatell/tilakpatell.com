// The waiting screen's rules (pure): what the Battlefront world shows in
// place of a flown landing. The game has no fly-in (the owner's bf2-re
// study, findings 14): a loading movie over a bar, then the spawn screen in
// a darkroom at a clamped exposure (VE_SpawnScreen: MinEV = MaxEV = 8),
// and on Deploy a black wipe of three delays (PF_SpawnWipeLogic: 0.05 s,
// 0.3 s down, 0.4 s up) into the field, where the exposure adapts to the
// day's over DarkAdaptationTime/LightAdaptationTime, 0.25 s. The site's
// screen is the darkroom: the level streams round the spawn and the
// shaders of what the soldier will see build behind it (lib/three/
// pipelineGuard counts them), and the field is called ready only once
// nothing is left to build for a moment (QUIET_S), so the first frames
// after the wipe do not hitch.
//
// The day is the game's coin (findings 22): at round start a server-side
// RandomMultiEventEntity loads one lighting sub-world, the sunset
// (VE_PV_Hoth_Sunset_01, weight 70) or the clear day (the sub-world named
// Cloudy, VE_Sky_Arctic_Sunny_01, weight 30); the site's rows are the
// world's weathers 'sunset' and 'sunny'.
//
//   readiness({ loaded, progress, pending, held, building, peak, quietFor }) → { value 0…1, ready, line }
//   pickVariant(random) → 'sunset' | 'sunny'
//   arrivalExposure(t, { stops, seconds }) → the exposure's multiplier t seconds after the wipe
//   stopsFrom(minEv) → the stops the darkroom's EV 8 is under the day's clamp
//   recommend({ level, gpuMs, scale, steps, budgetMs, headroom }) → { level, scale, ms, why, measuring }
//   machineLine({ detail, tier, renderer, width, height, dpr, backend }) → text
//   recommendationLine(rec) → text

import { LEVELS } from '../../lib/device';

export const DARKROOM_EV = 8; // _source: VE_SpawnScreen's TonemapComponentData, MinEV = MaxEV = 8 (findings 14)
export const ADAPT_S = 0.25; // s: DarkAdaptationTime and LightAdaptationTime on Hoth's day (findings 14)
export const MAX_STOPS = 3; // the adaptation's reach: EV 8 to the day's clamp of 11
export const WIPE = { delay: 0.05, down: 0.3, up: 0.4 }; // s: PF_SpawnWipeLogic's three delays (findings 14)
export const QUIET_S = 0.6; // s with nothing building before the field is called ready (a build's landing and the next's queueing are a frame apart)
export const HUD_QUIET = 1 / 8; // s: a snapshot's own grain (module.js's HUD_HZ), counted into the quiet the page sees
export const PROGRESS_SHARE = 0.85; // of the bar the level's stream fills; the rest is the shaders' builds
export const VARIANTS = [
  { id: 'sunset', name: 'The sunset', weight: 70, ve: 'VE_PV_Hoth_Sunset_01' },
  { id: 'sunny', name: 'The clear day', weight: 30, ve: 'VE_Sky_Arctic_Sunny_01' },
]; // _source: Hoth_01's RandomMultiEventEntityData, Output1 Sunset 70 / Output2 Cloudy 30 (findings 22)
export const COIN = 'coin'; // the choice that lets the game's coin pick

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// the day a round starts on, by the game's weights
export function pickVariant(random = Math.random, variants = VARIANTS) {
  const total = variants.reduce((s, v) => s + v.weight, 0);
  let r = clamp(random(), 0, 0.999999) * total;
  for (const v of variants) {
    if (r < v.weight) return v.id;
    r -= v.weight;
  }
  return variants[0].id;
}

// the bar and whether the field may be revealed: the stream's progress
// fills most of it, the shaders' builds the rest; `pending` is the guard's
// pipelines being made, `held` the objects left out of the last frame for
// a shader not built, `building` the post chains being built, `peak` the
// most of pending + held seen so far, `quietFor` the seconds all three
// have been 0
export function readiness({ loaded = false, progress = 0, pending = 0, held = 0, building = 0, peak = 0, quietFor = 0 } = {}) {
  const p = clamp(progress, 0, 1);
  if (!loaded) return { value: PROGRESS_SHARE * p, ready: false, line: `Bringing the level in · ${Math.round(p * 100)} per cent` };
  const busy = pending + held + building;
  const rest = 1 - PROGRESS_SHARE;
  if (busy > 0) {
    const top = Math.max(peak, busy, 1);
    return { value: PROGRESS_SHARE + rest * 0.5 * (1 - busy / top), ready: false, line: `Building the shaders · ${busy} to go` };
  }
  const quiet = clamp(quietFor / QUIET_S, 0, 1);
  return { value: PROGRESS_SHARE + rest * (0.5 + 0.5 * quiet), ready: quiet >= 1, line: quiet >= 1 ? 'Ready' : 'Settling' };
}

// the darkroom's EV 8 to the day's clamp: 3 stops over on the clear day (MinEV 11), 1.5 at the sunset (9.5)
export const stopsFrom = (minEv) => clamp((Number.isFinite(minEv) ? minEv : DARKROOM_EV) - DARKROOM_EV, 0, MAX_STOPS);

// the exposure's multiplier `t` seconds into the arrival: the darkroom's
// stops over the day, settling to 1 over the adaptation time
export function arrivalExposure(t, { stops = MAX_STOPS, seconds = ADAPT_S } = {}) {
  const k = clamp(seconds > 0 ? t / seconds : 1, 0, 1);
  return 2 ** (stops * (1 - k));
}

// What the runtime's pace would settle on here, from the chip's own frame
// time (lib/three/gpuTime's median, measured in the darkroom at the
// chain's internal `scale`): each frame costs ms ÷ scale² a unit of area
// (runtime/dynres.js's model), so the sharpest of the chain's `steps`
// whose predicted time fits the budget less its headroom (Unreal's
// controller: 16.7 ms, 10 %) is the recommendation at this level; none
// fitting, the level below at the softest step; a frame under 0.6 of the
// target at the sharpest step, the level above.
export function recommend({ level = 'high', gpuMs = null, scale = 1, steps = [1, 0.77, 0.67, 0.5], budgetMs = 16.7, headroom = 0.1, levels = LEVELS } = {}) {
  if (!Number.isFinite(gpuMs) || gpuMs <= 0) return { level, scale: null, ms: null, measuring: true, why: 'measuring the chip' };
  const target = budgetMs * (1 - headroom);
  const cost = gpuMs / Math.max(0.25, scale) ** 2;
  const i = levels.indexOf(level);
  const sharpest = steps[0] ?? 1;
  if (cost * sharpest ** 2 <= target * 0.6 && i >= 0 && i < levels.length - 1) return { level: levels[i + 1], scale: sharpest, ms: cost * sharpest ** 2, why: 'the chip has room for more' };
  for (const s of steps) if (cost * s ** 2 <= target) return { level, scale: s, ms: cost * s ** 2, why: s === sharpest ? 'the frame fits' : 'the frame fits under the screen' };
  const soft = steps.at(-1) ?? 0.5;
  return { level: i > 0 ? levels[i - 1] : level, scale: soft, ms: cost * soft ** 2, why: 'the frame runs over the budget at every step' };
}

const n = (v) => Math.round(v).toLocaleString('en-GB');

export function machineLine({ detail = 'high', tier = null, renderer = '', width = 0, height = 0, dpr = 1, backend = '' } = {}) {
  const chip = renderer ? renderer.replace(/\s*\(0x[0-9a-f]+\)/gi, '').replace(/\s*Direct3D.*$/i, '').trim() : 'an unnamed chip';
  const size = width && height ? `${n(width * dpr)} × ${n(height * dpr)}` : 'an unknown size';
  return `your machine: ${detail} tier${tier ? ` (${tier})` : ''}, ${chip}, ${size}${backend ? ` on ${backend === 'webgpu' ? 'WebGPU' : backend === 'nodes-webgl' ? 'WebGL 2' : backend}` : ''}`;
}

export function recommendationLine(rec) {
  if (!rec || rec.measuring) return 'recommended: measuring the chip’s frame…';
  const at = rec.scale != null ? ` at ${Math.round(rec.scale * 100)} %` : '';
  const ms = Number.isFinite(rec.ms) ? ` · ${rec.ms.toFixed(1)} ms a frame on the chip` : '';
  return `recommended: ${rec.level}${at}${ms}`;
}

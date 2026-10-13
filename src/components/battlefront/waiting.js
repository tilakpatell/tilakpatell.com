// The rules of the way in (pure): what the Battlefront world does in place
// of a flown landing. The game has no fly-in (the owner's bf2-re
// study, findings 14): a loading movie over a bar, then the spawn screen in
// a darkroom at a clamped exposure (VE_SpawnScreen: MinEV = MaxEV = 8),
// and on Deploy a black wipe of three delays (PF_SpawnWipeLogic: 0.05 s,
// 0.3 s down, 0.4 s up) into the field, where the exposure adapts to the
// day's over DarkAdaptationTime/LightAdaptationTime, 0.25 s. The site
// does the same behind the game's own screens (BattlefrontWorld.jsx,
// stage.js): the level streams round the spawn and the shaders of what
// the soldier will see build behind the menu and the loading screen
// (lib/three/pipelineGuard counts them), and the field is called ready
// once nothing is left to build for a moment (QUIET_S), so the first
// frames after the wipe do not hitch, or SHADER_WAIT_S after the level is
// in, whatever is left: the guard holds back what is not built and no
// frame waits for it, so a chip that compiles slowly (every pipeline
// through D3D12 on Windows) is let in and sees the rest appear, not kept
// out for minutes (the every-chip-plays design, 2026-10-13).
//
// The day is the game's coin (findings 22): at round start a server-side
// RandomMultiEventEntity loads one lighting sub-world, the sunset
// (VE_PV_Hoth_Sunset_01, weight 70) or the clear day (the sub-world named
// Cloudy, VE_Sky_Arctic_Sunny_01, weight 30); the site's rows are the
// world's weathers 'sunset' and 'sunny'.
//
//   readiness({ loaded, progress, pending, held, building, peak, quietFor, waited }) → { value 0…1, ready, line }
//   (`waited`: seconds of the page's own clock since the level came in)
//   loadLine({ now, marks, level, shaders, machine, detail }) → the one line the page logs once the
//   field is first ready: when the world was made and the level came in (ms
//   of the page's clock, the world's marks), the level's bytes and maps, the
//   shaders still building, the backend, the renderer tier and the level
//   pickVariant(random) → 'sunset' | 'sunny'
//   arrivalExposure(t, { stops, seconds }) → the exposure's multiplier t seconds after the wipe
//   stopsFrom(minEv) → the stops the darkroom's EV 8 is under the day's clamp

export const DARKROOM_EV = 8; // _source: VE_SpawnScreen's TonemapComponentData, MinEV = MaxEV = 8 (findings 14)
export const ADAPT_S = 0.25; // s: DarkAdaptationTime and LightAdaptationTime on Hoth's day (findings 14)
export const MAX_STOPS = 3; // the adaptation's reach: EV 8 to the day's clamp of 11
export const WIPE = { delay: 0.05, down: 0.3, up: 0.4 }; // s: PF_SpawnWipeLogic's three delays (findings 14)
export const QUIET_S = 0.6; // s with nothing building before the field is called ready (a build's landing and the next's queueing are a frame apart)
export const SHADER_WAIT_S = 5; // s after the level is in that the field is ready whatever is still building (the every-chip-plays design)
export const HUD_QUIET = 1 / 8; // s: a snapshot's own grain (module.js's HUD_HZ), counted into the quiet the page sees
export const PROGRESS_SHARE = 0.85; // of the bar the level's stream fills; the rest is the shaders' builds
export const VARIANTS = [
  { id: 'sunset', name: 'The sunset', weight: 70, ve: 'VE_PV_Hoth_Sunset_01' },
  { id: 'sunny', name: 'The clear day', weight: 30, ve: 'VE_Sky_Arctic_Sunny_01' },
]; // _source: Hoth_01's RandomMultiEventEntityData, Output1 Sunset 70 / Output2 Cloudy 30 (findings 22)

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
export function readiness({ loaded = false, progress = 0, pending = 0, held = 0, building = 0, peak = 0, quietFor = 0, waited = 0 } = {}) {
  const p = clamp(progress, 0, 1);
  if (!loaded) return { value: PROGRESS_SHARE * p, ready: false, line: `Bringing the level in · ${Math.round(p * 100)} per cent` };
  if (waited >= SHADER_WAIT_S) return { value: 1, ready: true, line: 'Ready' };
  const busy = pending + held + building;
  const rest = 1 - PROGRESS_SHARE;
  if (busy > 0) {
    const top = Math.max(peak, busy, 1);
    return { value: PROGRESS_SHARE + rest * 0.5 * (1 - busy / top), ready: false, line: `Building the shaders · ${busy} to go` };
  }
  const quiet = clamp(quietFor / QUIET_S, 0, 1);
  return { value: PROGRESS_SHARE + rest * (0.5 + 0.5 * quiet), ready: quiet >= 1, line: quiet >= 1 ? 'Ready' : 'Settling' };
}

const secs = (ms) => (Number.isFinite(ms) ? `${(ms / 1000).toFixed(1)} s` : '?');
export function loadLine({ now = 0, marks = {}, level = {}, shaders = {}, machine = {}, detail = null } = {}) {
  const mb = ((level?.stream?.bytes ?? 0) / 1e6).toFixed(1);
  const building = (shaders?.pending ?? 0) + (shaders?.held ?? 0) + (shaders?.building ?? 0);
  return `[battlefront] in at ${secs(now)}: the world made at ${secs(marks?.madeAt)}, the level in at ${secs(marks?.levelAt)} (${mb} MB, ${level?.maps?.loaded ?? 0} maps), ${building} shaders still building; ${machine?.backend ?? '?'}, ${machine?.tier ?? '?'}, ${detail ?? '?'}`;
}

// the darkroom's EV 8 to the day's clamp: 3 stops over on the clear day (MinEV 11), 1.5 at the sunset (9.5)
export const stopsFrom = (minEv) => clamp((Number.isFinite(minEv) ? minEv : DARKROOM_EV) - DARKROOM_EV, 0, MAX_STOPS);

// the exposure's multiplier `t` seconds into the arrival: the darkroom's
// stops over the day, settling to 1 over the adaptation time
export function arrivalExposure(t, { stops = MAX_STOPS, seconds = ADAPT_S } = {}) {
  const k = clamp(seconds > 0 ? t / seconds : 1, 0, 1);
  return 2 ** (stops * (1 - k));
}

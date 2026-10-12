// The game's mix as numbers (bf2-re/findings/26-audio.md, 36 §5), pure:
// the blaster's layers by distance, the footsteps by the body's speed, the
// HDR window that drops the quiet while a blaster fires, the mixers that
// duck, the ambience bed's one-shot timers, the music by the mode's state,
// and the cues a change in the player's gun, hits and life call for. The
// player (player.js) turns these into Web Audio; director.js drives them
// from the sim's events.
//
//   blasterLayers(dist, gains) → { close, distant, hifi, far } amplitudes
//   panOf(from, at, yaw) → -1..1 (the sound's side of the listener)
//   footstep(speed, { crouch }) → { set, gain, pitch, interval } | null
//   createWindow() / hear(w, loudness, now) / admits(w, loudness, now)
//   loudnessOf(base, gain) → the patch's Loudness less the attenuation
//   DUCKS: the mixers' gains and low-pass by name
//   oneShots(rng) / dueOneShots(shots, now, rng) → [{ name, dist, angle }]
//   musicFor(mode) → 'medium' | 'high' | 'tension' | 'eor.win' | 'eor.lose' | 'eor.draw' | null
//   overheatCues(prev, next) → names; lifeCues(prev, next) → names

import { RUN_MAX, WALK_MAX } from '../figures/locomotion.js';

// the master patch's MultiCrossfaders: the close layer out over 6 → 22 m,
// the distant in over the same, the HiFi transient out over 4 → 100 m, the
// far tail (the 300 m+ "battle beyond") in over 300 → 1,000 m
export const CLOSE = [6, 22];
export const HIFI = [4, 100];
export const FAR = [300, 1000];
const clamp01 = (x) => Math.min(1, Math.max(0, x));
// the game's cosine fades (FadeCurveType SineAmplitude)
export const fadeIn = (d, [a, b]) => (1 - Math.cos(clamp01((d - a) / (b - a)) * Math.PI)) / 2;
export const fadeOut = (d, span) => 1 - fadeIn(d, span);
// the outdoor attenuation: a source at 40 m at half, at 300 m an eighth
export const rolloff = (d) => 1 / (1 + d / 40);

export function blasterLayers(dist, [close = 0.9, distant = 0.8, hifi = 0.2] = []) {
  const d = Math.max(0, dist);
  const r = rolloff(d);
  const farIn = fadeIn(d, FAR);
  return {
    close: close * fadeOut(d, CLOSE) * r,
    distant: distant * fadeIn(d, CLOSE) * (1 - farIn) * r,
    hifi: hifi * fadeOut(d, HIFI) * r,
    // (the far layer is recorded far: in over the window, its own fall past its end)
    far: 0.6 * farIn * Math.min(1, FAR[1] / Math.max(d, 1)),
  };
}

// the listener faces (sin yaw, cos yaw) in the sim's frame (battle.js's aim); right is (cos yaw, −sin yaw)
export function panOf(from, at, yaw) {
  const dx = at[0] - from[0];
  const dz = at[2] - from[2];
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return 0;
  return (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / len;
}

// The movement patch's ScaleClamps: gain 0.15 → 1 over 0.417 → 1 of the
// normalised speed, pitch 0.85 → 1 over 0.17 → 0.65; the set by the body's
// pace (locomotion.js's bands); a plant every stride, the stride from the
// humanoid pack's clips (walk 0.9 m, run 1.3, sprint 1.7).
export const TOP_SPEED = 5.97; // m/s: the soldier row's sprint
export const STRIDE = { walk: 0.9, jog: 1.3, sprint: 1.7 };
const lerp = (x, [x0, x1], [y0, y1]) => y0 + (y1 - y0) * clamp01((x - x0) / (x1 - x0));
export function footstep(speed, { crouch = false } = {}) {
  if (!(speed > 0.3)) return null;
  const n = speed / TOP_SPEED;
  const set = speed < WALK_MAX ? 'walk' : speed < RUN_MAX ? 'jog' : 'sprint';
  return {
    set,
    gain: lerp(n, [0.417, 1], [0.15, 1]) * (crouch ? 0.7 : 1),
    pitch: lerp(n, [0.17, 0.65], [0.85, 1]),
    interval: STRIDE[set] / speed,
  };
}

// The HDR window: 25 dB under the loudest playing sound; its top rises at
// once (attack 25 ms), holds while that sound plays, and falls back over a
// second or two after (release 0.5–2 s by the curve; 17 dB/s here), never
// under 20 dB (WindowMinBottom). A sound at or under the bottom is
// suspended: footsteps vanish under fire, by design, and come back once
// the window has fallen.
export const WINDOW = 25;
export const WINDOW_FLOOR = 20;
export const RELEASE_DB_PER_S = 17;
export const createWindow = () => ({ top: WINDOW_FLOOR, until: 0 });
export const topOf = (w, now) => Math.max(WINDOW_FLOOR, w.top - Math.max(0, now - w.until) * RELEASE_DB_PER_S);
// `hold`: how long the sound plays (its take's length)
export function hear(w, loudness, now, hold = 0.5) {
  const top = topOf(w, now);
  if (loudness >= top) {
    w.top = loudness;
    w.until = now + hold;
  } else {
    w.top = top;
    w.until = Math.max(w.until, now);
  }
  return w;
}
export const admits = (w, loudness, now) => loudness > topOf(w, now) - WINDOW;
// the patches' Loudness: the blaster 100, the 3P death 92, the UX 90, the music 80, the movement 75, the beds lower
export const LOUDNESS = { blaster: 100, death: 92, ux: 90, music: 80, step: 75, cloth: 72, ambience: 60 };
export const loudnessOf = (base, gain) => base + 20 * Math.log10(Math.max(1e-4, gain));

// the mixers the soldier hears (26's table): the world's gain in dB and its low-pass, by name
export const DUCKS = {
  none: { db: 0, lpf: 20000, attack: 0.3, release: 1 },
  death: { db: -20, lpf: 300, attack: 0.5, release: 1 }, // SW02_Mixers_OnDeath (its attack is 5 s in the record; the corpse time is short here)
  tension: { db: -10, lpf: 20000, attack: 3, release: 1 }, // SW02_Music_MP_TensionMixer
  spawn: { db: -12, lpf: 5000, attack: 2, release: 0.7 }, // SW02_Mixers_SpawnScreen_DuckGame
};

// Hoth's bed (26): the nine one-shots placed round the listener at a distance and an interval
export const ONE_SHOTS = [
  { name: 'ambience.wind.moleWind', dist: [10, 40], every: [9, 18] },
  { name: 'ambience.wind.gusts', dist: [10, 25], every: [9, 18] },
  { name: 'ambience.wind.flutters', dist: [10, 40], every: [12, 24] },
  { name: 'ambience.wind.wisps', dist: [10, 40], every: [30, 48] },
  { name: 'ambience.alien.rayboo', dist: [20, 50], every: [60, 120] },
  { name: 'ambience.alien.beluga', dist: [20, 50], every: [30, 60] },
  { name: 'ambience.alien.skuaRoar', dist: [20, 50], every: [30, 60] },
  { name: 'ambience.alien.skuaCalls', dist: [20, 50], every: [30, 60] },
  { name: 'ambience.alien.wampa', dist: [18, 50], every: [24, 48] },
  { name: 'ambience.ice.cracks', dist: [15, 50], every: [40, 80] },
  { name: 'ambience.ice.pings', dist: [10, 30], every: [20, 40] },
];
const between = (rng, [a, b]) => a + (b - a) * rng();
export const oneShots = (rng = Math.random, now = 0) => ONE_SHOTS.map((o) => ({ ...o, next: now + between(rng, o.every) * rng() }));
export function dueOneShots(shots, now, rng = Math.random) {
  const out = [];
  for (const s of shots) {
    if (now < s.next) continue;
    s.next = now + between(rng, s.every);
    out.push({ name: s.name, dist: between(rng, s.dist), angle: rng() * Math.PI * 2 });
  }
  return out;
}

// The MP music logic (26): the end of round's cue by the result; the
// tension (and its −10 dB on the world) as a stage closes, the Galactic
// Assault prefab's compare: an objective past 0.8, or the attackers down to
// their last tickets (1–15); high intensity past 0.6; else the medium stem.
export const TENSION_METER = 0.8;
export const HIGH_METER = 0.6;
export const LAST_TICKETS = 15;
export function musicFor(mode, mine = 2) {
  if (!mode) return null;
  if (mode.result) return mode.result.winner === 3 ? 'eor.draw' : mode.result.winner === mine ? 'eor.win' : 'eor.lose';
  const top = Math.max(0, ...(mode.objectives ?? []).map((o) => o.meter ?? 0));
  const tickets = mode.tickets;
  if (top >= TENSION_METER || (Number.isFinite(tickets) && tickets > 0 && tickets <= LAST_TICKETS)) return 'tension';
  return top >= HIGH_METER ? 'high' : 'medium';
}

// the overheat set from the gun's bar: warning as it nears the top,
// overheated at the top, reset when it clears, the manual vent's flourish
export function overheatCues(prev, next) {
  if (!prev || !next) return [];
  const out = [];
  if (!prev.overheated && next.overheated) out.push('overheat.overheated');
  else if (!next.overheated && prev.heat < next.warning && next.heat >= next.warning) out.push('overheat.warning');
  if (prev.overheated && !next.overheated) out.push('overheat.reset');
  else if (!prev.overheated && !next.overheated && prev.heat > 0.3 && next.heat === 0) out.push('overheat.manual');
  return out;
}

// the player's life: a hit landed, a kill, the death (the scream, the fall, the cue, the duck)
export function lifeCues(prev, next) {
  if (!prev || !next) return [];
  const out = [];
  if (next.hitAt != null && next.hitAt !== prev.hitAt) out.push(next.firstHit ? 'hit.first' : 'hit.hit');
  if (next.killAt != null && next.killAt !== prev.killAt) out.push('hit.kill');
  if (prev.state === 'alive' && next.state === 'down') out.push('death');
  return out;
}

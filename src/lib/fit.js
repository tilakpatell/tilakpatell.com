// Whether this device can play the Star Wars worlds, whose assets are the
// heaviest on the site (the 2017 game's levels, cast and ships): the owner's
// word (2026-10-13) is that they need a real GPU, integrated or discrete,
// one that holds 30 fps at Low, the most compressed web settings, and that a
// device without one is told so, for now. Pure; lib/gpu's look and
// lib/device's classification are passed in.
//
// The floor, worked out in the every-chip-plays addendum
// (docs/superpowers/specs/2026-10-13-every-chip-plays-design.md): the 5090
// (score 1,170) drew Hoth at Low in 0.6 ms of GPU at 7.37 M pixels; at Low's
// 720p buffer and 8 m ground that is about 0.21 ms, and 30 fps leaves the
// GPU 25 ms, so a chip needs lib/gpuGrade's score 10 (Skylake's HD 5xx and
// every chip since). A chip its name does not grade is let in. The CPU side
// is the other half: two cores or fewer, or 2 GB or less, is a potato however
// good the chip.
//
//   starWarsFit({ gpu, device, webgpu, tryAnyway }) → { ok, why: null | 'none' | 'software' | 'weak' | 'cpu' | 'memory' }
//   readTry(search, hash, stored) → boolean (?software=on in the address, or kept as tp-software)

import { gpuScore } from './gpuGrade';

export const MIN_SCORE = 10;
export const FIT_KEY = 'tp-software'; // 'on': the visitor (or a QA script) asked to try anyway

const no = (why) => ({ ok: false, why });

export function starWarsFit({ gpu = {}, device = {}, webgpu = typeof navigator !== 'undefined' && Boolean(navigator.gpu), tryAnyway = false } = {}) {
  if (tryAnyway) return { ok: true, why: null };
  if (!gpu.webgl2 && !webgpu) return no('none');
  if (gpu.software) return no('software');
  const score = gpuScore(gpu.renderer);
  if (Number.isFinite(score) && score < MIN_SCORE) return no('weak');
  if (device.why?.includes('cores')) return no('cpu');
  if (device.memory != null && device.memory <= 2) return no('memory');
  return { ok: true, why: null };
}

// (the address first, either way; then what was kept)
export function readTry(search = '', hash = '', stored = null) {
  const q = new URLSearchParams(search).get('software') ?? new URLSearchParams(String(hash).split('?')[1] ?? '').get('software');
  if (q != null) return q === 'on';
  return stored === 'on';
}

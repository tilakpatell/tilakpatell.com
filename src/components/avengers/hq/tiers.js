// What a device can afford in an HQ game (the compound, its games, Titan and
// Invincible), and how it steps down. Phones and small GPUs start lower.
// The runtime (src/runtime/quality.js) governs it: the canvas starts at the
// tier's sharpness (the module's `ratio`) and the governor softens it a
// pace step a level, while each level puts the game one tier further down
// this list, in the order the old watchdog (hq/engine.js, gone) stepped it:
// the shadow map, the bloom and the samples together. Past the pace's last
// step is the runtime's floor, where the watchdog said onSlow: the page
// drops to the game's simple version unless 3D was switched on outright.
// `pixels` caps a frame all told, so a screen as wide as three doesn't
// draw three screens' worth.

import { STEPS } from '../../../lib/three/pace';
import { device } from '../../../lib/device';

export const TIERS = {
  high: { dpr: 1.75, shadow: 2048, bloom: 1, samples: 4, small: false, pixels: 12e6 },
  medium: { dpr: 1.35, shadow: 1024, bloom: 0.5, samples: 4, small: true, pixels: 8e6 },
  low: { dpr: 1, shadow: 1024, bloom: 0, samples: 0, small: true, pixels: 6e6 },
};
export const ORDER = ['high', 'medium', 'low'];

// (lib/device decides, the same way for every scene on the site: its
// level, which is the visitor's pick, or Auto by the chip and the renderer
// tier's hold, not the device's class alone, which ignored both)
export const tierOfDetail = (detail) => ({ ultra: 'high', high: 'high', mid: 'medium', low: 'low' })[detail] ?? 'medium';
export function startTier() {
  if (typeof window === 'undefined') return 'high';
  return tierOfDetail(device().detail);
}

// the tier a quality level puts a game on, from the one it started on, and
// whether that level is the floor
export function tierAt(start, level = 0) {
  const l = Math.max(0, Math.floor(level));
  const tier = ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(start) + l)];
  return { tier, slow: l >= STEPS.length };
}

// the canvas’s sharpness at the start: the tier’s, under the screen’s own,
// and no more than the tier’s pixels over `area` (the window’s, in CSS
// pixels: the most a game’s box can be)
export const startRatio = (tier, dpr, area = 0) => Math.min(TIERS[tier].dpr, dpr || 1, area > 0 ? Math.sqrt(TIERS[tier].pixels / area) : Infinity);

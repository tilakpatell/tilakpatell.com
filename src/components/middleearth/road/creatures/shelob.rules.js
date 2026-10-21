// Shelob’s walk and her fear. Her eight legs move in two groups of four
// (the first and third on one side with the second and fourth on the
// other, as a spider’s alternating tetrapod), so one group always bears her
// while the other swings; legRig in creatures.js bends each to its foot.
// And the one thing she gives way to: the Phial held up, bright on her.
// Pure.
//
//   legsAt(t, { speed }) → [{ x, lift }] × 8   (footAt’s, the legs left 0–3 front to back, then right 4–7)
//   retreat(light) → whether she backs away: light is the Phial’s brightness on her, 0 to 1

import { footAt } from '../../creatures';

export const GROUPS = [
  [0, 2, 5, 7],
  [1, 3, 4, 6],
];
export const FEAR = 0.6; // the Phial’s light on her she cannot bear
const STRIDE = 1.8; // m a cycle
const STANCE = 0.5;

export function legsAt(t, { speed = 1 } = {}) {
  if (!(speed > 0)) return Array.from({ length: 8 }, () => ({ x: 0, lift: 0 }));
  const cycle = (t * speed) / STRIDE;
  const out = new Array(8);
  GROUPS.forEach((g, k) => {
    const f = footAt(cycle + k * 0.5, STANCE);
    for (const i of g) out[i] = { x: f.x, lift: f.lift };
  });
  return out;
}

export const retreat = (light) => Number.isFinite(light) && light >= FEAR;

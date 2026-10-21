// The Watcher in the Water’s arms, pure: twelve out of the lake by turns,
// reaching for the shore; the first takes Frodo up by the ankle and lets
// him fall when Sam cuts it; then all of them go back under as the Doors
// fall in behind the company.
//
//   ARMS: how many
//   GRAB: { lift, cut, back }: seconds into the beat the first arm lifts
//     Frodo, is cut, and the arms go back under
//   arm(t, i) → { reach (0…1, out of the water toward the shore),
//     lift (0…1, Frodo held up; the first arm only), sway (rad) }

export const ARMS = 12;
export const GRAB = { lift: 3, cut: 6.2, back: 8 };
const RISE = 1.5; // s an arm takes out of the water
const SINK = 1.6; // s back under
const ORDER = [0, 5, 2, 9, 7, 1, 11, 4, 8, 3, 10, 6]; // the order they come out in, the first at once

const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

export function arm(t, i) {
  if (t < 0) return { reach: 0, lift: 0, sway: 0 };
  const start = ORDER.indexOf(i) * 0.4;
  const full = 0.65 + 0.35 * (((i * 7) % 5) / 4);
  const reach = full * smooth((t - start) / RISE) * (1 - smooth((t - GRAB.back) / SINK));
  const lift = i === 0 ? smooth((t - GRAB.lift) / 1) * (1 - smooth((t - GRAB.cut) / 0.6)) : 0;
  const sway = reach * 0.35 * Math.sin(t * (1.3 + i * 0.17) + i * 1.9);
  return { reach, lift, sway };
}

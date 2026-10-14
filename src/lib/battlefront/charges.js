// A Galactic Assault charge's keypad, as the game reaches it (bf2-re
// findings/61): the map rulebook's `charges` rows (Hoth's three fuel charges,
// read by scripts/lib/bf2017-rulebook-charges.mjs). The keypad's button holds
// a WorldInteraction whose InteractionMaxDistance the keypad sets to 1 on a
// transform the button scales 3× (its TransformMultiplier's In1), so 3 m in
// the world, from any side (the keypad's InteractionMaxAngle 360). Who may
// hold it, how long, and the fuse are the arm objective's
// (modes/objectives.js). Pure.
//
//   reachOf(row) → m          canUse(row, at) → whether a soldier at [x, y, z] reaches the keypad
//   keypadStand(nav, row) → [x, y, z] | null   the floor on the navmesh nearest the keypad that reaches it

import { meshStand } from './meshNav.js';

// m: the keypad's distance on its interaction's transform, and that transform's scale, where a row has none
// (PF_Interact_Keypad's InteractionMaxDistance into PF_Interact_Button; the button's TransformMultiplierEntityData.In1)
export const REACH = 1;
export const SCALE = 3;
// degrees: off the keypad's facing an interactor may stand (PF_Interact_Keypad's InteractionMaxAngle)
export const ANGLE = 360;

export const reachOf = (row) => (row?.interact?.distance ?? REACH) * (row?.interact?.scale ?? SCALE);

export function canUse(row, at) {
  const p = row?.keypad?.at;
  if (!p || !at) return false;
  const d = [at[0] - p[0], (at[1] ?? p[1]) - p[1], at[2] - p[2]];
  if (Math.hypot(...d) > reachOf(row) + 1e-9) return false;
  const angle = row.interact?.angle ?? ANGLE;
  if (angle >= 180) return true;
  const flat = Math.hypot(d[0], d[2]);
  if (flat < 1e-6) return true;
  const yaw = row.keypad.yaw ?? 0;
  return (d[0] * Math.sin(yaw) + d[2] * Math.cos(yaw)) / flat >= Math.cos((angle * Math.PI) / 180) - 1e-9;
}

// the floor a bot holds the keypad from: the navmesh's nearest to the keypad's foot within its reach, if it reaches
export function keypadStand(nav, row) {
  const p = row?.keypad?.at;
  if (!nav?.mesh || !p) return null;
  const foot = row.at?.[1] ?? p[1] - 1.5;
  for (const r of [reachOf(row), reachOf(row) * 2]) {
    const at = meshStand(nav, [p[0], foot, p[2]], r);
    if (at && canUse(row, at)) return at;
  }
  return null;
}

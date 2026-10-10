// How a soldier falls, the rules apart from the drawing (ragdolls.js draws
// it): which of the game's fifteen ragdoll bodies a bolt struck, how hard
// (the weapon's ImpactImpulse, impulses.json), whether one more body may
// fall as a ragdoll now, and how long a corpse lies. Pure: no three.js.
//
//   PART_BONES: the sim's parts (soldier.js's capsules) → the bodies' bones
//   boneForHit(part, at, pointOf) → a bone: of the part's bones the one
//     nearest `at` ([x, y, z], where the bolt struck); the part's first with
//     no point, the Spine with no part. pointOf(name) → { x, y, z } | [x, y, z] | null
//   impulseOf(weaponId, table) → { impulse (N·s), source }: the weapon's row,
//     else the table's fallback (the default rifle bolt's), else 0
//   admit({ active, dist, max, range }) → bool: under the cap, within range
//   expired({ since, lie, sink }) → 'lie' | 'sink' | 'gone' (since the death)

export const PART_BONES = {
  head: ['Head'],
  chest: ['Spine', 'LeftArm', 'RightArm'],
  hips: ['Hips'],
  armL: ['LeftArm', 'LeftForeArm', 'LeftHand'],
  armR: ['RightArm', 'RightForeArm', 'RightHand'],
  legL: ['LeftUpLeg', 'LeftLeg', 'LeftFoot'],
  legR: ['RightUpLeg', 'RightLeg', 'RightFoot'],
};
const NO_PART = 'Spine';

const xyz = (p) => (Array.isArray(p) ? p : p ? [p.x, p.y, p.z] : null);

export function boneForHit(part, at, pointOf) {
  const bones = PART_BONES[part];
  if (!bones) return NO_PART;
  if (!at) return bones[0];
  let best = bones[0];
  let near = Infinity;
  for (const name of bones) {
    const p = xyz(pointOf(name));
    if (!p) continue;
    const d = Math.hypot(p[0] - at[0], p[1] - at[1], p[2] - at[2]);
    if (d < near) {
      near = d;
      best = name;
    }
  }
  return best;
}

export function impulseOf(weaponId, table) {
  const row = (weaponId && table?.rows?.[weaponId]) || table?.fallback;
  return row ? { impulse: row.impulse, source: row.impulse_source ?? null } : { impulse: 0, source: null };
}

export const admit = ({ active, dist, max, range }) => active < max && dist <= range;

export function expired({ since, lie, sink }) {
  if (since < lie) return 'lie';
  return since < lie + sink ? 'sink' : 'gone';
}

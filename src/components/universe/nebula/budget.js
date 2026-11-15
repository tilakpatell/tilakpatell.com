// The nebula renderer's rows, one a tier (lib/device's tier; its detail
// level 'ultra' reads high). Lane 2's universe/budget.js takes these rows
// over once it is on main (the endless universe's design, section H).
//
// - volume: the noise volume's side, in voxels
// - farSteps / nearSteps: the march's steps at the far and the near level
// - nearMax: how many clouds may be near at once
// - fog: the fog's layers round the ship, inside a cloud
// - stars: young stars a near cloud shows
// - drawn: the most clouds drawn at once

export const NEBULA_BUDGET = Object.freeze({
  low: Object.freeze({ volume: 32, farSteps: 4, nearSteps: 12, nearMax: 1, fog: 2, stars: 16, drawn: 8 }),
  mid: Object.freeze({ volume: 48, farSteps: 5, nearSteps: 20, nearMax: 1, fog: 3, stars: 32, drawn: 12 }),
  high: Object.freeze({ volume: 64, farSteps: 6, nearSteps: 32, nearMax: 2, fog: 4, stars: 64, drawn: 16 }),
});

export const nebulaBudget = (tier) => (tier === 'ultra' ? NEBULA_BUDGET.high : typeof tier === 'string' && Object.hasOwn(NEBULA_BUDGET, tier) ? NEBULA_BUDGET[tier] : NEBULA_BUDGET.mid);

// The row at lib/three/pace's quality step (the scene's paceTo, through
// setLevel): each step down takes an eighth of the near steps off, so the
// softest (4) marches half as many, never fewer than the far. The rest of
// the row stays, made once at the tier's. (From the earlier lane 1 branch,
// claude/trusting-sagan-tda0fm.)
const STEP_CUT = 1 / 8;
export function nebulaAtStep(row, step) {
  const s = Number.isFinite(step) ? Math.floor(step) : 0;
  if (!(s > 0)) return row;
  return Object.freeze({ ...row, nearSteps: Math.max(row.farSteps, Math.round(row.nearSteps * (1 - STEP_CUT * s))) });
}

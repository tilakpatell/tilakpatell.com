// How much of the nebulae a device draws: a row a tier. Pure (no three.js,
// no DOM), so it runs in Node. Lane 2's `universe/budget.js` (the one table,
// the design's section H) takes these rows over in place of its `nebula`
// placeholder, `{ res, steps }`, which nothing reads; until then they live
// here, and its quality steps don't reach them.
//
//   volume     the noise volume's side, in voxels (volume.js)
//   farSteps   march steps at the far level
//   nearSteps  march steps at the near level, and the shader's most
//   nearMax    how many clouds may be near at once
//   fog        the fog's layers round the ship, inside a cloud
//   stars      young stars a near cloud has
//   drawn      the most clouds drawn at once, the nearest kept
//
// nebulaBudget(tier) → a row. 'ultra' (lib/device's detail level, never
// its tier) reads high's, and a tier it doesn't know reads mid's.
// nebulaAtStep(row, step) → the row at lib/three/pace's quality step (the
// world's lowerQuality, through the scene's paceTo): each step down takes
// an eighth of the near steps off, so the softest (4) marches half as many,
// never fewer than the far steps. The rest of the row stays: the far
// level's steps are already its least, and the instances' room and the
// shader's most (nearSteps) are made once, at the tier's.

export const NEBULA_BUDGET = Object.freeze({
  low: Object.freeze({ volume: 32, farSteps: 4, nearSteps: 12, nearMax: 1, fog: 2, stars: 16, drawn: 8 }),
  mid: Object.freeze({ volume: 48, farSteps: 5, nearSteps: 20, nearMax: 1, fog: 3, stars: 32, drawn: 12 }),
  high: Object.freeze({ volume: 64, farSteps: 6, nearSteps: 32, nearMax: 2, fog: 4, stars: 64, drawn: 16 }),
});

export function nebulaBudget(tier) {
  if (tier === 'ultra') return NEBULA_BUDGET.high;
  return typeof tier === 'string' && Object.hasOwn(NEBULA_BUDGET, tier) ? NEBULA_BUDGET[tier] : NEBULA_BUDGET.mid;
}

const STEP_CUT = 1 / 8;

export function nebulaAtStep(row, step) {
  const s = Number.isFinite(step) ? Math.floor(step) : 0;
  if (!(s > 0)) return row;
  return Object.freeze({ ...row, nearSteps: Math.max(row.farSteps, Math.round(row.nearSteps * (1 - STEP_CUT * s))) });
}

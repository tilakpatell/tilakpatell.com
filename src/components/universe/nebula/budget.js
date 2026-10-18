// The nebulae's tier rows: what each quality tier spends on them. Lane 2's
// universe/budget.js takes these rows over. Pure, no imports.
//
// NEBULA_BUDGET = { low, mid, high }, each { volume, farSteps, nearSteps, nearMax, fog, stars, drawn }
//   volume: the noise volume's side, in voxels
//   farSteps / nearSteps: march steps at the far and near levels
//   nearMax: how many clouds may be near at once
//   fog: the number of fog layers
//   stars: young stars per near cloud
//   drawn: the most clouds drawn at once
// nebulaBudget(tier) → row

export const NEBULA_BUDGET = {
  low: { volume: 32, farSteps: 4, nearSteps: 12, nearMax: 1, fog: 2, stars: 16, drawn: 8 },
  mid: { volume: 48, farSteps: 5, nearSteps: 20, nearMax: 1, fog: 3, stars: 32, drawn: 12 },
  high: { volume: 64, farSteps: 6, nearSteps: 32, nearMax: 2, fog: 4, stars: 64, drawn: 16 },
};

// ('ultra' is lib/device's detail level, never its tier; it spends like high,
// and a tier nobody knows spends like mid)
export const nebulaBudget = (tier) =>
  tier === 'ultra' ? NEBULA_BUDGET.high : NEBULA_BUDGET[tier] ?? NEBULA_BUDGET.mid;

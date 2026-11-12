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

export const nebulaBudget = (tier) => (tier === 'ultra' ? NEBULA_BUDGET.high : NEBULA_BUDGET[tier] ?? NEBULA_BUDGET.mid);

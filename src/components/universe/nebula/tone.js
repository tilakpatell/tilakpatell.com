// The nebulae's look, its numbers in one place (./index.js's clouds,
// ./fog.js's layers). Tuned against the before shots: the old puffs glowed
// at 0.13 to 0.36 of their colour, but over the whole Veil at its true
// size that read faint beside the old landmark, so 0.6 (2026-11-14 shots), well
// under the bloom's threshold (the universe's look.js, 1.7).

// how bright the gas glows, its colour at full strength times this
export const EMIT = 0.6;
// how quickly a cloud hides what's behind it, per radius of gas
export const ABSORB = 1.4;

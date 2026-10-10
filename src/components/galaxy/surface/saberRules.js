// A lightsaber's numbers that aren't the 2017 game's fencing rules
// (src/data/bf2017/saber.json, lib/combat/saber2017.js): where a thrown blade
// is as it flies out and comes back (the throw is a Force ability's:
// abilityRules.js's throwOf gives Vader's and Maul's their game numbers), the
// frame of a block clip the raised blade is held at, and each hilt's blade.
// Pure, so it's tested in Node; saber.js draws the saber.
//
//   SABER            { throw }
//   BLOCK_AT         of the block clip, where the raised blade is held (the frame saber.js lays; a 2017 block's side is
//                    read there: scripts/lib/bf2017-strokes.mjs's HELD)
//   throwAt(k)       a thrown blade `k` (0…1) of the way through its flight: { d (metres out along the throw), spin (radians), back (true on the way back) }
//   BLADE_OF[hilt]   a 2017 hilt's blade (catalog/bf2017.js's kinds): { base: [x, y, z] (its emitter, metres in the hilt's
//                    frame, the blade up +y), base2? (a staff's other end), length, radius (the game's rod's) }, measured
//                    from the game's models (scripts/bf2017-strokes.mjs --blade: src/data/bf2017/blades.json)

import BLADES from '../../../data/bf2017/blades.json';

export const SABER = {
  throw: { range: 16, dur: 1.5, damage: 2, radius: 1.3, spins: 7 },
};

export const BLOCK_AT = 0.32; // of the block clip, where it's held: the blade up across

export const BLADE_OF = BLADES.hilts;

export function throwAt(k) {
  const x = Math.max(0, Math.min(1, k));
  // out fast, a hang at the far end, and back: a raised cosine
  const d = (SABER.throw.range * (1 - Math.cos(x * Math.PI * 2))) / 2;
  return { d, spin: x * Math.PI * 2 * SABER.throw.spins, back: x > 0.5 };
}

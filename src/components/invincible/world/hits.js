// His hits, by force: a landing, a slam, a crash into a tower, a splash, a
// villain’s punch landing, each through the site’s hit law (lib/impact.js),
// so a step down is a tap and a slam from flat out is a crash. The law’s
// gain is the square of how hard, which would leave a soft landing all but
// silent; every sound he made before still plays, so the law’s gain rides
// over a floor. Pure: ./InvWorld.jsx plays the voice it answers with
// (lib/sfx.js’s play(name, { gain, pitch })).
//
//   createHits({ now, random }) → { voice(key, force) → { gain, pitch } | null,
//     foeForce(kind), moveForce(out), rules }

import { createImpacts } from '../../../lib/impact';

export const FLOOR = 0.3; // the softest landing’s gain: quieter, still heard
// m/s: nothing he does is under the law’s threshold, and a slam from flat out
// (260) is past full
const QUIET_UNDER = 0;
const LAW = { threshold: QUIET_UNDER, full: 200, gap: 0.06 };
// a villain’s punch has no speed: their size stands for it
const FOES = { flaxan: 60, seismic: 90, mauler: 130 };
// his brawl's moves (./brawl.js's outs): a slam's and a dive's force is how
// fast he came down (their `force`); the rest by what they are
const MOVES = { punch: 70, counter: 150, grab: 40, throw: 110, pound: 120 };

export function createHits({ now, random } = {}) {
  const rules = createImpacts({ ...LAW, now, random });
  return {
    rules,
    voice(key, force) {
      const r = rules.hit(force, key);
      return r ? { gain: FLOOR + (1 - FLOOR) * r.gain, pitch: r.pitch } : null;
    },
    foeForce: (kind) => FOES[kind] ?? FOES.flaxan,
    moveForce: (o) => o.force ?? MOVES[o.kind] ?? 0,
  };
}

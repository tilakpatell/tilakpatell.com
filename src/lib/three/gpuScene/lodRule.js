// The LOD cut the GPU scene's cull pass makes (GPU-first lane N1), written
// twice: once in JavaScript, which the test holds to lib/level/lod.js's
// lodAt on 10,000 random instances, and once in TSL with the same
// arithmetic, so the instance lane L draws at LOD n on the CPU is drawn at
// LOD n by the GPU. The chain's steps are read from a table of four (the
// mesh's stepsOf, padded with its last LOD), made once a mesh on the CPU.
//
//   MAX_LODS: the longest chain a mesh's table holds (Hoth's longest: 6)
//   stepsTable(chain, tier) → [s0, s1, s2, last]
//   lodFrom(d, r, L0, steps) → n (the pure rule over a table)
//   lodIndex(d, r, chain, tier) → n (= lodAt(chain, d, r, tier))
//   lodIndexNode(tsl) → Fn([d, r, L0, steps: uvec4]) → uint (the same, in TSL)

import { LOD, MIN_RADIUS, stepsOf } from '../../level/lod.js';

export const MAX_LODS = 8;

export function stepsTable(chain, tier) {
  if (chain.length > MAX_LODS) throw new Error(`a GPU mesh holds ${MAX_LODS} LODs at most: ${chain.length}`);
  const s = stepsOf(chain, tier);
  const last = chain.length - 1;
  return [s[0], s[1] ?? last, s[2] ?? last, last];
}

export function lodFrom(d, r, L0, steps) {
  const size = Math.max(0, Math.floor(Math.log2(Math.max(1, d / (L0 * Math.max(MIN_RADIUS, r))))));
  for (let k = 0; k < 3; k++) if (steps[k] >= size) return steps[k];
  return steps[3];
}

export const lodIndex = (d, r, chain, tier) => lodFrom(d, r, (LOD[tier] ?? LOD.high).L0, stepsTable(chain, tier));

// (the steps ascend, so the first at or past the size is the smallest of
// those: a select down from the last, as lodFrom's loop reads them up)
export function lodIndexNode(tsl) {
  const { Fn, float, max, floor, log2, uint, select } = tsl;
  return Fn(([d, r, L0, steps]) => {
    const size = uint(max(float(0), floor(log2(max(float(1), d.div(L0.mul(max(r, float(MIN_RADIUS)))))))));
    const n = steps.w.toVar();
    n.assign(select(steps.z.greaterThanEqual(size), steps.z, n));
    n.assign(select(steps.y.greaterThanEqual(size), steps.y, n));
    n.assign(select(steps.x.greaterThanEqual(size), steps.x, n));
    return n;
  });
}

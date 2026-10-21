// Hogwarts on the house's look, and its post chain as data (the Road's
// hooks.js's shape, copied: worlds are islands). The house gives every lit
// material its shade and its sky-coloured fog; the chain is the house bloom
// on every tier (the castle's windows and the lanterns are over its
// threshold), SMAA from mid and TRAA where the backend can build it on high.
//
//   createHogwartsHouse(look) → houseNodes' house
//   chainFor(tier, backend, { scene, camera }) → the passes (lib/three/light/post.js's kinds, through rt.gfx.post)

import { createHouse } from '../../../lib/three/houseNodes';
import { CANNOT } from '../../../lib/three/light/post';
import { BLOOM } from '../../../lib/three/bloom';

export const createHogwartsHouse = (look = {}) => createHouse(look);

const TIERS = {
  low: ['render', 'bloom', 'output'],
  mid: ['render', 'bloom', 'smaa', 'output'],
  high: ['render', 'bloom', 'traa', 'output'],
  ultra: ['render', 'bloom', 'traa', 'output'],
};

export function chainFor(tier, backend, { scene = null, camera = null } = {}) {
  const cannot = CANNOT[backend] ?? new Set();
  const out = [];
  for (const kind of TIERS[tier] ?? TIERS.high) {
    // (where TRAA can't be built, SMAA stands in for it, as the chain itself does)
    if (cannot.has(kind)) {
      if (kind === 'traa' && !cannot.has('smaa')) out.push({ kind: 'smaa' });
      continue;
    }
    if (kind === 'render') out.push({ kind, scene, camera });
    else if (kind === 'bloom') out.push({ kind, strength: BLOOM.strength, radius: BLOOM.radius, threshold: BLOOM.threshold });
    else out.push({ kind });
  }
  return out;
}

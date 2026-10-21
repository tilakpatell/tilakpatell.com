// The grounds on the house’s look and the chain they are drawn through:
// the Road’s (middleearth/road/hooks.js) without the Ring. The house
// (houseNodes) gives every lit material its shade and its sky-coloured fog;
// the grade at the end of the chain on high is a print’s: a gentle filmic
// curve, the colour a little richer, the highlights warm and the shadows
// cool, the corners darkened, and at night a little more blue in the dark
// so a moonlit lawn reads as night and not as a dim day.
//
//   createGroundsHouse(look) → { house, adopt(root) }
//   createHogwartsHouse(look) → the house alone (Lane A’s name, kept)
//   gradeNode(texture, uNight) → the chain’s grade: the picture shown, tone-mapped and encoded
//   chainFor(tier, backend, { scene, camera, grade }) → the post chain as data
//     (lib/three/light/post.js’s kinds through rt.gfx.post; post.js’s CANNOT respected)
//   TIERS: what each tier draws beyond the chain (the design’s §4.14): shadows and
//     their reach, the lake’s reflection, the ink line round the cast, the near castle’s reach

import * as THREE from 'three';
import { clamp, dot, float, length, mix, pow, renderOutput, screenUV, vec2, vec3, vec4 } from 'three/tsl';
import { createHouse } from '../../../lib/three/houseNodes';
import { CANNOT } from '../../../lib/three/light/post';
import { BLOOM } from '../../../lib/three/bloom';

const LUMA = vec3(0.2126, 0.7152, 0.0722);

export const TIERS = {
  low: { shadows: 0, reflection: false, ink: false, blades: false, scans: false },
  mid: { shadows: 40, reflection: false, ink: false, blades: true, scans: true },
  high: { shadows: 60, reflection: true, ink: true, blades: true, scans: true },
  ultra: { shadows: 60, reflection: true, ink: true, blades: true, scans: true },
};
export const tierOf = (tier) => TIERS[tier] ?? TIERS.high;

export function createGroundsHouse(look) {
  const house = createHouse(look);
  return { house, adopt: (root) => house.adopt(root) };
}
export const createHogwartsHouse = (look = {}) => createHouse(look);

export function gradeNode(tex, uNight) {
  const uv = screenUV;
  const off = uv.sub(0.5);
  const rgb = tex.sample(uv).rgb;
  const shown = renderOutput(vec4(rgb, 1), THREE.NeutralToneMapping, THREE.SRGBColorSpace).rgb;
  // (the curve gentle: a strong one pressed the grass and the shade down with the AO)
  const curved = mix(shown, shown.mul(shown).mul(shown.mul(-2).add(3)), 0.14);
  const lum = dot(curved, LUMA);
  const rich = mix(vec3(lum), curved, 1.1);
  const split = mix(vec3(0.965, 0.99, 1.045), vec3(1.04, 1.0, 0.95), clamp(lum.mul(1.6).sub(0.3), 0, 1));
  const graded = rich.mul(split);
  // at night the dark leans a little bluer (a moonlit lawn, not a dim day), the warm lights left warm
  const night = mix(graded, graded.mul(vec3(0.86, 0.95, 1.12)), uNight.mul(float(1).sub(clamp(lum.mul(3), 0, 1))).mul(0.6));
  const vignette = float(1).sub(pow(length(off.mul(vec2(1.1, 1))).mul(1.25), 2.6).mul(0.24));
  return vec4(clamp(night.mul(vignette), 0, 1), 1);
}

const CHAINS = {
  low: ['render', 'bloom', 'output'],
  mid: ['render', 'bloom', 'smaa', 'output'],
  high: ['render', 'bloom', 'grade', 'traa', 'output'],
  ultra: ['render', 'ao', 'bloom', 'grade', 'traa', 'output'],
};

export function chainFor(tier, backend, { scene = null, camera = null, grade = null } = {}) {
  const cannot = CANNOT[backend] ?? new Set();
  const out = [];
  for (const kind of CHAINS[tier] ?? CHAINS.high) {
    if (kind === 'grade' && !grade) continue;
    if (cannot.has(kind)) {
      if (kind === 'traa' && !cannot.has('smaa')) out.push({ kind: 'smaa' });
      continue;
    }
    if (kind === 'render') out.push({ kind, scene, camera });
    // (the house’s, as every world’s: the castle’s windows glow through it by their own brightness)
    else if (kind === 'bloom') out.push({ kind, strength: BLOOM.strength, radius: BLOOM.radius, threshold: BLOOM.threshold });
    else if (kind === 'grade') out.push({ kind, node: grade });
    else if (kind === 'ao') out.push({ kind, radius: 0.5, scale: 0.75, denoise: true });
    else out.push({ kind });
  }
  return out;
}

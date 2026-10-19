// The Road on the house’s look, and what the Ring does to it. The house
// (houseNodes) gives every lit material its shade and its sky-coloured fog;
// this adds one uniform, uVision (vision.js’s amount, 0…1), that drains the
// world’s colour toward a cold grey-blue on every material it is put on, so
// the vision reads on every tier, and the grade at the end of the chain on
// high: the highlights blown out, the frame’s edges smeared and the corners
// darkened as it rises, a little contrast and a cold tint always.
//
//   createRoadHouse(look) → { house, uVision, material(opts), patch(material), adopt(root) }
//   gradeNode(texture, uVision) → the chain’s grade: the picture shown, tone-mapped and encoded
//   chainFor(tier, backend, { scene, camera, grade, sun }) → the post chain as data
//     (lib/three/light/post.js’s kinds through rt.gfx.post; post.js’s CANNOT respected)

import * as THREE from 'three';
import { clamp, dot, float, length, mix, pow, renderOutput, screenUV, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { createHouse } from '../../../lib/three/houseNodes';
import { onColor } from '../../../lib/three/hookNodes';
import { CANNOT } from '../../../lib/three/light/post';
import { BLOOM } from '../../../lib/three/bloom';

const COLD = [0.55, 0.6, 0.7]; // what the vision drains toward
const LUMA = vec3(0.2126, 0.7152, 0.0722);

const LIT = (m) => Boolean(m?.isNodeMaterial && (m.isMeshStandardNodeMaterial || m.isMeshLambertNodeMaterial || m.isMeshPhongNodeMaterial || m.isMeshToonNodeMaterial));

export function createRoadHouse(look) {
  const house = createHouse(look);
  const uVision = uniform(0);
  const done = new WeakSet();
  const patch = (m) => {
    if (!LIT(m) || done.has(m)) return m;
    done.add(m);
    onColor(
      m,
      (d) => {
        const grey = dot(d.rgb, LUMA).mul(1.5);
        return mix(d.rgb, vec3(...COLD).mul(grey), uVision.mul(0.95));
      },
      'road:vision',
      { uVision },
    );
    m.needsUpdate = true;
    return m;
  };
  return {
    house,
    uVision,
    patch,
    material: (opts) => patch(house.material(opts)),
    // every lit node material under root (each once; cheap to ask again)
    adopt(root) {
      root?.traverse?.((o) => {
        for (const m of [o.material].flat()) if (m) patch(m);
      });
    },
  };
}

export function gradeNode(tex, uVision) {
  const uv = screenUV;
  const off = uv.sub(0.5);
  // the edges smeared outward as the vision rises: three taps along the radius
  const smear = off.mul(uVision.mul(0.018));
  const a = tex.sample(uv).rgb;
  const b = tex.sample(uv.add(smear)).rgb;
  const c = tex.sample(uv.add(smear.mul(2))).rgb;
  const edge = clamp(length(off).mul(2), 0, 1);
  let rgb = mix(a, a.add(b).add(c).div(3), edge.mul(uVision));
  // the highlights blown out and the colour drained, both by the vision
  rgb = rgb.mul(uVision.mul(0.7).add(1));
  rgb = mix(rgb, vec3(...COLD).mul(dot(rgb, LUMA).mul(1.4)), uVision.mul(0.8));
  // shown: the house’s tone and the screen’s encoding (the pipeline’s own transform is off after a grade)
  const shown = renderOutput(vec4(rgb, 1), THREE.NeutralToneMapping, THREE.SRGBColorSpace).rgb;
  // the house’s grade: a gentle filmic curve, the colour a little richer, the
  // highlights warm and the shadows cool (as a print is); then a cold tint
  // by the vision, the corners darkened more as it rises
  const curved = mix(shown, shown.mul(shown).mul(shown.mul(-2).add(3)), 0.22);
  const lum = dot(curved, LUMA);
  const rich = mix(vec3(lum), curved, 1.1);
  const split = mix(vec3(0.97, 0.99, 1.04), vec3(1.035, 1.0, 0.955), clamp(lum.mul(1.6).sub(0.3), 0, 1));
  const contrast = rich.mul(split);
  const tinted = mix(contrast, contrast.mul(vec3(0.86, 0.93, 1.08)), uVision);
  const vignette = float(1).sub(pow(length(off.mul(vec2(1.1, 1))).mul(1.25), 2.6).mul(uVision.mul(0.45).add(0.22)));
  return vec4(clamp(tinted.mul(vignette), 0, 1), 1);
}

const TIERS = {
  low: ['render', 'bloom', 'output'],
  mid: ['render', 'bloom', 'smaa', 'output'],
  high: ['render', 'ao', 'bloom', 'grade', 'traa', 'output'],
  ultra: ['render', 'ao', 'bloom', 'godrays', 'dof', 'grade', 'traa', 'output'],
};

export function chainFor(tier, backend, { scene = null, camera = null, grade = null, sun = null } = {}) {
  const cannot = CANNOT[backend] ?? new Set();
  const out = [];
  for (const kind of TIERS[tier] ?? TIERS.high) {
    if (kind === 'grade' && !grade) continue;
    // (god rays need the sun’s shadow map: a sun that casts none has no rays to give)
    if (kind === 'godrays' && !sun?.castShadow) continue;
    // (where TRAA cannot be built, SMAA stands in for it, as the chain itself does)
    if (cannot.has(kind)) {
      if (kind === 'traa' && !cannot.has('smaa')) out.push({ kind: 'smaa' });
      continue;
    }
    if (kind === 'render') out.push({ kind, scene, camera });
    else if (kind === 'bloom') out.push({ kind, strength: BLOOM.strength, radius: BLOOM.radius, threshold: BLOOM.threshold });
    else if (kind === 'grade') out.push({ kind, node: grade });
    // (soft and denoised: the grass moves in its vertices, which TRAA cannot settle, and it was grain)
    else if (kind === 'ao') out.push({ kind, radius: 0.9, denoise: true });
    else if (kind === 'godrays') out.push({ kind, light: sun, strength: 0.2 });
    // (focused on the walkers ahead, the far hills soft)
    else if (kind === 'dof') out.push({ kind, focusDistance: 8, range: 30, bokehScale: 2 });
    else out.push({ kind });
  }
  return out;
}

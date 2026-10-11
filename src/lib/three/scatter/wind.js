// The game's scatter in the wind (fidelity lane N). A scatter type's record
// carries its sway as a spring: `WindScale` (how far the wind pushes it),
// `Stiffness` and `Mass` (its natural frequency, √(k/m) / 2π), `Damping`
// (how soon a gust dies: the damping ratio c / 2√(km), and the swing that
// leaves, 1 / 2ζ, bounded) and `WindWiggle` (the leaves' own flutter). These
// become the numbers of the house's foliage sway (lib/three/foliage.js's
// `wind`, lane T's node twin lib/three/foliageNodes.js on a node renderer),
// driven by the world's one wind (lib/three/wind.js: its time and its way),
// so the grass, the trees and the scatter move with the same gust.
//
//   swayOf(wind, height) → { strength, height, trunkHz, leafHz, leaf } | null (pure)
//   applySway(material, sway, { time, dir, nodes }) → Promise<material> (the one to use)

// the swing a damping ratio leaves, bounded so a near-undamped spring does
// not throw a fern flat
export const SWING = { min: 0.25, max: 2 };
// the bend at the top of a 1 m type at WindScale 1 and a full swing: the
// house's shrub sways 0.05 m a metre at its strength (foliage.js WIND.shrub),
// a gale's 0.4. Named: the game's wind field's own strength is not exported.
export const BEND = 0.4;
// the flutter's frequency and depth per unit of WindWiggle (a leaf's quiver,
// the house's shrub 3.4 Hz at 0.012 m)
export const WIGGLE = { hz: 3.4, depth: 0.012 };
// the slowest and quickest sway (a heavy frond to a twig)
const HZ = { min: 0.15, max: 3 };

export function swayOf(wind, height = 1) {
  if (!wind || !(wind.scale > 0)) return null;
  const k = Math.max(1e-3, wind.stiffness ?? 8);
  const m = Math.max(1e-3, wind.mass ?? 1);
  const hz = Math.sqrt(k / m) / (2 * Math.PI);
  const zeta = (wind.damping ?? 1) / (2 * Math.sqrt(k * m));
  const swing = Math.min(SWING.max, Math.max(SWING.min, 1 / (2 * Math.max(1e-3, zeta))));
  return {
    strength: +(wind.scale * BEND * swing).toFixed(4),
    height: Math.max(0.2, height),
    trunkHz: +Math.min(HZ.max, Math.max(HZ.min, hz)).toFixed(3),
    leafHz: WIGGLE.hz,
    leaf: +((wind.wiggle ?? 0) * WIGGLE.depth).toFixed(4),
  };
}

// The sway on a material (a node material through lane T's twin on a node
// renderer, the GLSL hook on the classic one); the material to draw with.
// `time` a { value } the world's wind advances; `dir` a Vector2.
export async function applySway(material, sway, { time, dir, nodes = false }) {
  if (!sway) return material;
  const { wind } = nodes ? await import('../foliageNodes.js') : await import('../foliage.js');
  return wind(material, { kind: 'shrub', time, dir, ...sway });
}

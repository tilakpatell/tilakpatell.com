// A ghost's look, the numbers alone: pale, see-through, a soft blue glow, and
// a rim of light brighter where its surface turns from you (as the Ring's
// world shows things). The classic renderer draws it in GLSL (./ghosts.js),
// the node renderer in nodes (./ghostNodes.js); both read these, so a ghost
// is the same on WebGL and on WebGPU. No three here: a test reads it plain.
//
//   GHOST: { tint, glow, glowStrength, roughness, rim, rimPower, rimStrength }
//   rimAt(facing) → the rim's light, where `facing` is the surface normal
//     dotted with the way to the eye (1 facing you, 0 side on)

export const GHOST = {
  tint: 0xcfe0ff,
  glow: 0x6a8cff,
  glowStrength: 0.55,
  roughness: 0.5,
  rim: [0.55, 0.7, 1.0],
  rimPower: 2.2,
  rimStrength: 1.6,
};

export const rimAt = (facing) => (1 - Math.abs(facing)) ** GHOST.rimPower * GHOST.rimStrength;

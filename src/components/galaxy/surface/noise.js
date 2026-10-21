// The worlds' ground noise lives in src/lib/noise.js, so lib/land and
// lib/three take it without reaching up into a world. This path stays, with
// the same names, so none of the galaxy's own files changes.
export { fbm, hash2, lerp, noise2, ridged, rng, smoothstep } from '../../../lib/noise.js';

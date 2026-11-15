// The universe map's nine colours. Every tint the map owns (the nebulae,
// the belt's rock, the engines, the flares, the signs) is taken from these
// names, so a frame holds one palette rather than one per file. The planets
// keep their own maps: those are the fandoms' faces.
//
// The values are today's, read from the code where each colour lives, so
// moving a file onto a name changes no pixel by itself:
// - sky: the floor between the stars, the darkest thing on the map
// - nebula: the Veil's violet (deep.js), the first of its colours nebula/ draws it in
// - star: the white of a star's point (deepspace.js's young stars)
// - sun: the home sun's glare (landmarks.js)
// - bone: the Falcon's hull, its albedo's warm grey
// - grey: rock and the X-wing's grey (belt.js's darkest tone); tint() lifts it
// - engine: the Falcon's plume (engines.js)
// - shot: a blaster bolt's red (footScene.js's Han and Chewie)
// - ink: the labels' muted blue, a step under deepspace.js's name colour so
//   it stays apart from the engine's
//
// PALETTE[name] → { hex, linear: [r, g, b] }; tint(name, k) → linear [r, g, b],
// k of the way to white; distinct(a, b) → the OKLab distance of two linear colours.

const HEX = {
  sky: '#05070d',
  nebula: '#5b3fd1',
  star: '#f4f7ff',
  sun: '#ffcf6a',
  bone: '#b9a98e',
  grey: '#5b5550',
  engine: '#8fd0ff',
  shot: '#ff4a3d',
  ink: '#7a86a6',
};

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearOf = (hex) => [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));

export const PALETTE = Object.freeze(
  Object.fromEntries(Object.entries(HEX).map(([name, hex]) => [name, Object.freeze({ hex, linear: Object.freeze(linearOf(hex)) })])),
);

export function tint(name, k) {
  return PALETTE[name].linear.map((c) => c + (1 - c) * k);
}

// OKLab (Ottosson, 2020), from linear sRGB: distance there is how far apart
// two colours look, which is what "distinct" has to mean
function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function distinct(a, b) {
  const p = oklab(a);
  const q = oklab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

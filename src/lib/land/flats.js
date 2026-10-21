// A land's flats: each { at: [x, z], r, edge, h } is a level pad eased into
// the land round it (h: the height it's levelled to; left out, the land's own
// height at its middle; edge: the band it eases in over, max(8, 0.6 r) when
// left out). Inside r the answer is h exactly, so a base stands on zero
// noise; past r + edge the raw land is back untouched.
//
// It lives here, not in a world, because the galaxy's surfaces
// (galaxy/surface/terrain.js, as `levelled`) and the flight's planets
// (flight/field.js) both level their POIs with it.
//
// Pure: imports nothing but the galaxy's noise (a pure module, as layers.js
// imports it), and runs in Node and in a worker.
//
//   flatten(raw, flats = []) → (x, z) → metres

import { smoothstep } from '../noise.js';

export function flatten(raw, flats = []) {
  const pads = flats.map((f) => {
    const edge = f.edge ?? Math.max(8, f.r * 0.6);
    return { x: f.at[0], z: f.at[1], r: f.r, edge, reach: f.r + edge, h: f.h ?? raw(f.at[0], f.at[1]) };
  });
  if (!pads.length) return raw;
  return (x, z) => {
    let h = raw(x, z);
    for (const p of pads) {
      // (far off on either axis: out of its reach, without the square root)
      if (Math.abs(x - p.x) >= p.reach || Math.abs(z - p.z) >= p.reach) continue;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d >= p.r + p.edge) continue;
      const w = 1 - smoothstep(p.r, p.r + p.edge, d);
      h += (p.h - h) * w;
    }
    return h;
  };
}

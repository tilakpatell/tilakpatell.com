// The gargantuans far off (gen/gargantuans.js's rows): each drawn as a few
// discs of the far layer (discs.js, farStars.js's one Points), at their true
// angular size and fixed in the world, out across the sector and the next,
// so something vast is always on the sky and no draw call is added for it.
// Near, a mesh of its own takes over (lane 4a's drawers): `giantK` says how
// much of each. Pure (no three.js).
//
// GIANT = { near, far }: the mesh is whole within `near` of its edge and gone by 1.2 × near;
//   the discs are whole out to `far` from its middle and gone by 1.2 × far
// giantK(dist, row) → { mesh, disc }, summing to 1 inside far (dist from its middle)
// giantParts(row, cam) → [{ at, r, color: [r, g, b], light: [x, y, z] | null, rough }]:
//   - a black hole: its disc's glow, then the shadow a little nearer the camera, so drawn over it
//   - a ringworld arc: discs along its band, overlapping into one curve, lit from its light
//   - a derelict hulk: lumpy discs down its spine
//   - a supergiant: one ball, lit from its light
//   - a Dyson swarm: the dark swarm, and the star a little nearer, burning through
//   Colours are linear light, hot ones over 1 so they clear the bloom.

import { arcPoints } from '../gen/gargantuans';

export const GIANT = Object.freeze({ near: 30000, far: 400000 });

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const rgbOf = (hex) => {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
};
const scale = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

export function giantK(dist, row) {
  const mesh = 1 - smoothstep(GIANT.near, 1.2 * GIANT.near, dist - row.size);
  const out = 1 - smoothstep(GIANT.far, 1.2 * GIANT.far, dist);
  return { mesh, disc: Math.max(0, out - mesh) };
}

// (a point `k` of `r` from `at` toward the camera, so it sorts nearer than its sibling)
const toward = (at, cam, d) => {
  const v = [cam[0] - at[0], cam[1] - at[1], cam[2] - at[2]];
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [at[0] + (v[0] / l) * d, at[1] + (v[1] / l) * d, at[2] + (v[2] / l) * d];
};

// (lit mostly from the viewer's side, its own light a third of it: a far gargantuan reads against
// the dark as a lit thing whichever way its sun is)
const lightFor = (row, cam) => {
  const v = [cam[0] - row.at[0], cam[1] - row.at[1], cam[2] - row.at[2]];
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [0, 1, 2].map((k) => (v[k] / l) * 0.75 + row.light[k] * 0.45);
};

export function giantParts(row, cam) {
  const [c0] = row.colors.map(rgbOf);
  const light = lightFor(row, cam);
  if (row.kind === 'hole')
    return [
      { at: row.at, r: row.size * 0.55, color: scale(c0, 2.4), light: null, rough: 0 },
      { at: toward(row.at, cam, row.body), r: row.body * 1.6, color: [0.004, 0.003, 0.003], light: null, rough: 0 },
    ];
  if (row.kind === 'arc') {
    const step = Math.max(row.band, (row.span * row.size) / 40);
    return arcPoints(row, step).map((at) => ({ at, r: Math.max(row.band, step * 0.62), color: scale(c0, 1.4), light, rough: 0 }));
  }
  if (row.kind === 'hulk') {
    const out = [];
    for (let i = 0; i <= 8; i++) {
      const u = -1 + i / 4;
      out.push({ at: row.at.map((v, k) => v + row.axis[k] * u * row.size * 0.9), r: 0.16 * row.size, color: scale(c0, 0.9), light, rough: 0.2 + 0.08 * i });
    }
    return out;
  }
  if (row.kind === 'giant') return [{ at: row.at, r: row.size, color: scale(c0, 1.3), light, rough: 0 }];
  return [
    { at: row.at, r: row.size, color: scale(c0, 0.45), light, rough: 0.6 },
    { at: toward(row.at, cam, row.size * 1.01), r: row.body * 1.4, color: scale(c0, 3), light: null, rough: 0 },
  ];
}

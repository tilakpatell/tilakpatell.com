// The octahedral impostor's layout (lane N4; agargaro's forest and Ryan
// Brucks' impostor baker, the research note's World Partition section): a
// mesh photographed from n × n directions over the upper hemisphere, each
// view one tile of a square atlas. The tiles sit on a hemi-octahedral map:
// a direction folded onto the octahedron's upper half and turned 45°, so
// the square holds the hemisphere with no tile wasted. A card is drawn with
// the three views nearest the camera's direction, blended by where that
// direction falls between their tiles (a triangle of the tile grid), so the
// card turns without a pop. Pure: the bake (scripts/impostors.mjs) and the
// runtime's material (src/lib/three/impostor.js, the same sums in TSL) agree.
//
//   octEncode([x, y, z]) → [u, v] in [-1, 1]² (y below 0 read as 0)
//   octDecode([u, v]) → a unit direction
//   impostorViews(n = 16) → n² directions, tile (i, j) at j × n + i
//   impostorTile(dir, n) → [i, j, w]: the nearest tile and its blend weight
//   impostorBlend(dir, n) → [[i, j, w] × 3], the weights summing to 1
//   viewBasis(dir) → { right, up }: the camera's axes for a view (the bake's
//     and the card's, so a tile and the card it is drawn on agree)
//   atlasUv(i, j, [cu, cv], n) → [u, v]: a card's point in a tile; cv runs
//     up the card, and a tile's top row is the atlas's row nearer v = 0 (a
//     KTX2's first row is uploaded as v = 0, and the bake writes the picture
//     top row first)

export const VIEWS = 16; // _source: the design's §4 N4, "16 × 16 views at 2,048"

export function octEncode([x, y, z]) {
  const s = Math.abs(x) + Math.max(0, y) + Math.abs(z) || 1;
  const px = x / s;
  const pz = z / s;
  return [px + pz, px - pz];
}

export function octDecode([u, v]) {
  const x = (u + v) / 2;
  const z = (u - v) / 2;
  const y = 1 - Math.abs(x) - Math.abs(z);
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

export function impostorViews(n = VIEWS) {
  const out = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) out.push(octDecode([((i + 0.5) / n) * 2 - 1, ((j + 0.5) / n) * 2 - 1]));
  return out;
}

// a direction's place on the tile grid, in tiles (a tile's centre at a whole number)
function gridOf(dir, n) {
  const [u, v] = octEncode(dir);
  const f = (g) => Math.min(n - 1, Math.max(0, ((g + 1) / 2) * n - 0.5));
  return [f(u), f(v)];
}

export function impostorBlend(dir, n = VIEWS) {
  const [fx, fy] = gridOf(dir, n);
  const bx = Math.min(n - 2, Math.floor(fx));
  const by = Math.min(n - 2, Math.floor(fy));
  const tx = fx - bx;
  const ty = fy - by;
  if (tx + ty <= 1) {
    return [
      [bx, by, 1 - tx - ty],
      [bx + 1, by, tx],
      [bx, by + 1, ty],
    ];
  }
  return [
    [bx + 1, by + 1, tx + ty - 1],
    [bx + 1, by, 1 - ty],
    [bx, by + 1, 1 - tx],
  ];
}

export function impostorTile(dir, n = VIEWS) {
  return impostorBlend(dir, n).reduce((a, b) => (b[2] > a[2] ? b : a));
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => {
  const l = Math.hypot(...v) || 1;
  return v.map((c) => c / l);
};

// (straight up or down the right is +x, so the up is −z: three's lookAt with
// that up gives the same axes)
export function viewBasis(dir) {
  const right = Math.abs(dir[1]) > 0.9999 ? [1, 0, 0] : unit(cross([0, 1, 0], dir));
  return { right, up: unit(cross(dir, right)) };
}

export const atlasUv = (i, j, [cu, cv], n = VIEWS) => [(i + cu) / n, (j + 1 - cv) / n];

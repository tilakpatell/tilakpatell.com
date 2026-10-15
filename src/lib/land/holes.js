// The terrain's own holes (a level pack's `terrain.holes`, written by
// scripts/bf2017-holes.mjs from the game's detail heightmap, whose 0 is a
// hole): where there is no ground, the floor being the level's own meshes
// (Hoth's hangar mouths and trench tunnels). The ground draws nothing there
// (map/ground.js's mask) and its collider has no triangles there
// (levelPhysics' holed cells). In the pack's frame, the detail map's grid:
// a sample i, j stands at min + [i, j] · metresPerPixel. Pure.
//
//   holesOf(terrain) → null | { metresPerPixel, min, w, h, count, bits: Uint8Array (255 a hole, row-major), at(px, pz) → bool, any(minX, minZ, maxX, maxZ) → bool }

export function holesOf(terrain) {
  const h = terrain?.holes;
  if (!h?.rows || !h.size) return null;
  const [w, rows] = h.size;
  const bits = new Uint8Array(w * rows);
  let count = 0;
  for (const [j, runs] of Object.entries(h.rows)) {
    for (const [i, n] of runs) {
      bits.fill(255, Number(j) * w + i, Number(j) * w + i + n);
      count += n;
    }
  }
  const mpp = h.metresPerPixel;
  const [mx, mz] = h.min;
  const cellOf = (px, pz) => [Math.round((px - mx) / mpp), Math.round((pz - mz) / mpp)];
  return {
    metresPerPixel: mpp,
    min: h.min,
    w,
    h: rows,
    count,
    bits,
    at(px, pz) {
      const [i, j] = cellOf(px, pz);
      return i >= 0 && j >= 0 && i < w && j < rows && bits[j * w + i] === 255;
    },
    // (any hole in a box: a ground cell that needs its holes cut)
    any(minX, minZ, maxX, maxZ) {
      const [i0, j0] = cellOf(minX, minZ);
      const [i1, j1] = cellOf(maxX, maxZ);
      for (let j = Math.max(0, j0); j <= Math.min(rows - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(w - 1, i1); i++) if (bits[j * w + i] === 255) return true;
      return false;
    },
  };
}

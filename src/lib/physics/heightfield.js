// A 64 m cell's ground as a Rapier heightfield: the same heights it is
// drawn from (src/lib/land/cell.js), so the wheels' rays meet what you see.
//
// Ours are row-major (heights[iz × n + ix], +x along a row); Rapier's are
// a column-major matrix whose rows run along z, so the array is transposed
// on the way in. The body stands at the cell's middle (Rapier centres a
// heightfield on its body). heightfield.test.js shoots 200 rays to prove it.
// A floor: it meets everything but the car's bumper. Its triangles' inside
// edges are fixed (Rapier's FIX_INTERNAL_EDGES), so a crate sliding over
// flat ground slides on instead of catching on them and hopping; the
// wheels' rays don't care. Heights that are short or not numbers throw.
// No three.js, no DOM.
//
//   addHeightfield(physics, { heights, n = 65, size = 64, x, z, friction =
//     0.2, restitution = 0.15, tag = null }) → Body (remove it with physics.remove)
//   (tag: the ground's material index, lib/physics/materials.js's, for the queries)

export function addHeightfield(physics, { heights, n = 65, size = 64, x = 0, z = 0, friction = 0.2, restitution = 0.15, tag = null }) {
  if (!heights || heights.length !== n * n) throw new Error(`physics: a heightfield of ${n} × ${n} needs ${n * n} heights, not ${heights?.length}`);
  for (let i = 0; i < heights.length; i++) if (!Number.isFinite(heights[i])) throw new Error(`physics: heights[${i}] is ${heights[i]}`);
  const cols = new Float32Array(n * n);
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) cols[ix * n + iz] = heights[iz * n + ix];
  return physics.add({
    type: 'fixed',
    position: [x + size / 2, 0, z + size / 2],
    group: 'floor',
    friction,
    restitution,
    colliders: [{ shape: 'heightfield', args: [n - 1, n - 1, cols, [size, 1, size], physics.RAPIER.HeightFieldFlags.FIX_INTERNAL_EDGES], ...(tag != null ? { tag } : {}) }],
  });
}

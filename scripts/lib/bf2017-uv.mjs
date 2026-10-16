// Which of a primitive's two UV sets the game reads its maps through. The
// drop's GLBs bind every map to TEXCOORD_0, but Frostbite's vehicle shader
// (SS_VehiclePreset and its kin) reads the colour, normal and smoothness
// atlas through the set that unwraps the hull once, and keeps the other for
// its tiling detail: on the X-wing that is TEXCOORD_1 (0.66 of the square
// against 2.22 for TEXCOORD_0, which runs to −2.15), and read through
// TEXCOORD_0 the atlas smears into streaks and patches. Other models have it
// the other way (the TIE Advanced's TEXCOORD_1 covers the square 1,416
// times over). So the set is told by what it covers: the atlas's set lays
// the model down once (its triangles' area in UV space about the square's,
// a little over where mirrored halves share it), the tiling set many times.
//
// uvArea(uv, index) → the summed area of the triangles in UV space
// atlasSet(area0, area1) → 0 | 1: the set the maps are read through

export function uvArea(uv, index) {
  let area = 0;
  const n = index ? index.length : uv.length / 2;
  const at = (i) => (index ? index[i] : i) * 2;
  for (let t = 0; t + 2 < n; t += 3) {
    const [a, b, c] = [at(t), at(t + 1), at(t + 2)];
    area += Math.abs((uv[b] - uv[a]) * (uv[c + 1] - uv[a + 1]) - (uv[c] - uv[a]) * (uv[b + 1] - uv[a + 1])) / 2;
  }
  return area;
}

// (the second set only where it is a real unwrap, under two squares, and
// tighter than the first: a degenerate one, a tiling one, or one no tighter
// keeps the drop's own binding)
const UNWRAP = { least: 0.05, most: 2 };
export function atlasSet(area0, area1) {
  if (!(area1 > UNWRAP.least && area1 <= UNWRAP.most)) return 0;
  return area1 < area0 * 0.9 ? 1 : 0;
}

// a glTF-Transform transform: each primitive's maps read through its atlas set
export const atlasUVs = () => (doc) => {
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const [uv0, uv1] = [prim.getAttribute('TEXCOORD_0'), prim.getAttribute('TEXCOORD_1')];
      if (!uv0 || !uv1) continue;
      const index = prim.getIndices()?.getArray() ?? null;
      if (atlasSet(uvArea(uv0.getArray(), index), uvArea(uv1.getArray(), index)) === 1) prim.setAttribute('TEXCOORD_0', uv1).setAttribute('TEXCOORD_1', uv0);
    }
};

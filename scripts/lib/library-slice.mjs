// The rule behind scripts/library-slice.mjs (lane D3 of the Frostbite gaps
// design): of the published game-derived files (src/data/galaxyAssets.json,
// 63,000 rows, 16 MB), the few the object library asks about. The library
// (src/components/galaxy/surface/catalog/bf2017-library.js) reads the
// manifest only to ask whether an object's plain, `.lod1` and `.far` cuts
// are published, for the objects in src/data/bf2017/library-used.json; the
// slice is those paths and nothing else, so the galaxy's chunk carries a few
// hundred bytes of it instead of the whole file.
//
//   sliceFor(published, used, { urlFor }) → { [path without its leading
//     slash]: true } for each cut of each used name that is in `published`
//   CUTS: the cuts the library asks about, in rowFor's order

export const CUTS = [null, 'lod1', 'far'];

export function sliceFor(published, used, { urlFor }) {
  const out = {};
  for (const name of Object.keys(used ?? {})) {
    for (const cut of CUTS) {
      const key = urlFor(name, cut).slice(1);
      if (published?.[key]) out[key] = true;
    }
  }
  return out;
}

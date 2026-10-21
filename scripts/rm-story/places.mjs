// Where the browser check (../rm-story-check.mjs) stands Morty in a place
// through the portal: its way in, its portal home and its spots, read from
// the places' own data (src/components/rickmorty/world/dimensions/), so a
// place laid out afresh moves the check with it. C-137's own places (the
// street, the house, the garage, the arcade, Dr. Wong's office) are the
// scenarios' as written.
//
//   stand(spot, face, off) → [x, z, face]   `off` metres back from a spot, facing it
//   wayIn(d) → z                             where a catch puts him back
//   home(d) → [x, z, face]                   in front of the portal home, facing it
//   loadPlaces(root) → { dest(id), spot(area, id) }   the data, read through Vite

export const N = Math.PI / 2;

// (a figure facing `face` looks along (cos, −sin): he stands that way back from it)
export const stand = (spot, face, off = 0.8) => [spot.x - off * Math.cos(face), spot.z + off * Math.sin(face), face];
export const wayIn = (d) => d.arrive.z;
export const home = (d) => [d.back.x, d.back.z - 0.8, -N];

// the places, as the page has them: their files import without extensions,
// as Vite resolves them, so Vite reads them (as scripts/battlefront-balance.mjs does)
export async function loadPlaces(root) {
  const { createServer } = await import('vite');
  const vite = await createServer({ root, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', logLevel: 'error' });
  let destinationById;
  try {
    ({ destinationById } = await vite.ssrLoadModule('/src/components/rickmorty/world/dimensions/destinations.js'));
  } finally {
    await vite.close();
  }
  const dest = (id) => {
    const d = destinationById(id);
    if (!d) throw new Error(`no place ${id} in the data`);
    return d;
  };
  const spot = (area, id) => {
    const h = dest(area).hotspots.find((s) => s.id === id);
    if (!h) throw new Error(`${area} has no spot ${id} in the data`);
    return h;
  };
  return { dest, spot };
}

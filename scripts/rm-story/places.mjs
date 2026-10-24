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
//   ledgeOf(d, id) → [x, z, top]             a ledge Morty stands on (a climb's: src/components/rickmorty/world/games/climb.js)
//   loadPlaces(root) → { dest(id), spot(area, id), ledge(area, id), citadel(done), dial, allDone, roomsSay }   the data, read through Vite
//                                            (citadel: the Citadel's own line for the scenes made, ../../src/components/rickmorty/citadel/story.js;
//                                            dial: the dial's places' ids; allDone: a planet's line once all there's done;
//                                            roomsSay: what's said as Rick's rooms are lost and won, ../../src/components/rickmorty/world/say.js)

export const N = Math.PI / 2;

// (a figure facing `face` looks along (cos, −sin): he stands that way back from it)
export const stand = (spot, face, off = 0.8) => [spot.x - off * Math.cos(face), spot.z + off * Math.sin(face), face];
export const wayIn = (d) => d.arrive.z;
export const home = (d) => [d.back.x, d.back.z - 0.8, -N];
export function ledgeOf(d, id) {
  const l = d.solids.find((o) => o.id === id && o.ledge);
  if (!l) throw new Error(`${d.id} has no ledge ${id}`);
  return [l.x, l.z, l.top];
}

// the places, as the page has them: their files import without extensions,
// as Vite resolves them, so Vite reads them (as scripts/battlefront-balance.mjs does).
// (with a cache of its own and nothing for the browser to optimise: the dev
// server the check drives shares the repo's node_modules/.vite, and a second
// optimiser there pulls its bundles out from under the page mid-load)
export async function loadPlaces(root) {
  const { createServer } = await import('vite');
  const vite = await createServer({ root, cacheDir: 'node_modules/.vite-rm-story', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', logLevel: 'error' });
  let destinationById;
  let DIAL;
  let citadelProgress;
  let ALL_DONE_HERE;
  let ROOMS_SAY;
  try {
    ({ destinationById, DIAL } = await vite.ssrLoadModule('/src/components/rickmorty/world/dimensions/destinations.js'));
    ({ citadelProgress } = await vite.ssrLoadModule('/src/components/rickmorty/citadel/story.js'));
    ({ ALL_DONE_HERE } = await vite.ssrLoadModule('/src/components/rickmorty/world/planetMode.js'));
    ({ ROOMS_SAY } = await vite.ssrLoadModule('/src/components/rickmorty/world/say.js'));
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
  return { dest, spot, ledge: (area, id) => ledgeOf(dest(area), id), citadel: (done) => citadelProgress(done).objective, dial: DIAL.map((d) => d.id), allDone: ALL_DONE_HERE, roomsSay: ROOMS_SAY };
}

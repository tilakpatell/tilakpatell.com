// splat.js for a 'nodes' world: the same table and rule, reading scansNodes
// (scans.js's twin) so the closure doesn't reach core.js's GLSL. Copied,
// not imported, for that reason; splat.js re-exports this once its last
// GLSL caller has moved.
//
// The layered ground ultra lays under a world (ground.js's SPLAT): over the
// site's own scan (its `ground.detail`), a second scan in broad patches
// (the macro: red soil through Tatooine's sand, leaf litter through Endor's
// needles), a third on the slopes (rock, wrapped round cliffs from the three
// axes, so it's never stretched), and a fourth dropped in small blotches
// (the decals: gravel, mud, stones). Which scans, by the base scan's biome,
// or a site's own (`ground.splat: { macro, steep, decal }`), each a role or
// a list of them, best first. Each one is public/cc0/galaxy/'s
// (scripts/galaxy-textures.mjs): the first of a list that's there is worn,
// and a layer with none there is left out, never asked for. Pure, so it's
// tested. (Moved down from galaxy/surface: the flight's ground is layered
// the same way.)
//
//   SPLAT: { [base role]: { macro, steep, decal } } (lists of roles)
//   splatOf(site, has = scanOf) → { base, macro, steep, decal } (any null) | null

import { scanOf } from './scansNodes';

export const SPLAT = {
  // deserts: Tatooine, Jakku
  sand: { macro: ['dryground', 'redsoil'], steep: ['aerialrock', 'rock'], decal: ['stones', 'gravel'] },
  beach: { macro: ['sand'], steep: ['rock'], decal: ['stones', 'gravel'] },
  redsoil: { macro: ['dryground', 'sand'], steep: ['redrock'], decal: ['stones', 'gravel'] },
  gravel: { macro: ['ash'], steep: ['aerialrock', 'rock'], decal: ['stones', 'sand'] },
  // ice: Hoth's snow, a wind-packed snowfield in patches, rock on the slopes, scoured gravel
  snow: { macro: ['snowfield', 'gravel'], steep: ['rock'], decal: ['gravel'] },
  // forests and swamps: Endor, Kashyyyk, Yavin, Dagobah, Naboo
  grass: { macro: ['moss', 'mud'], steep: ['mossrock'], decal: ['stones', 'gravel'] },
  needles: { macro: ['moss', 'leaves'], steep: ['mossrock'], decal: ['mud'] },
  leaves: { macro: ['moss', 'needles'], steep: ['mossrock'], decal: ['swampmud', 'mud'] },
  mud: { macro: ['swampmud', 'leaves'], steep: ['mossrock'], decal: ['moss', 'needles'] },
  // lava: Mustafar's ash, black rock, red cinders
  ash: { macro: ['gravel'], steep: ['aerialrock', 'rock'], decal: ['redrock'] },
  // city: plazas and platforms
  concrete: { macro: ['paving', 'tiles'], steep: ['metal'], decal: ['deck'] },
  tiles: { macro: ['paving', 'concrete'], steep: ['stone'], decal: ['deck'] },
};

export function splatOf(site, has = scanOf) {
  const base = site.ground?.detail;
  if (!base || !has(base)) return null;
  const want = { ...(SPLAT[base] ?? {}), ...(site.ground.splat ?? {}) };
  // (the first of a layer's list that's been made: scripts/galaxy-textures.mjs)
  const keep = (want) => [want ?? []].flat().find((role) => has(role)) ?? null;
  return { base, macro: keep(want.macro), steep: keep(want.steep), decal: keep(want.decal) };
}

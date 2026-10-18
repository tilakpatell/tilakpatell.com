// A POI's buildings as a placement list: what stands on it, where, how high,
// in the galaxy placer's spec (galaxy/surface/placer.js), every height
// given (`abs`), so the placer reads no ground of its own.
//
// Where a walkable galaxy site has the place (lib/land/flight/
// landmarkTables.js's SITE_PLACES), its things are the site's own: the
// places' `things` and the site's loose ones nearest them, kept where they
// stand relative to the first place's middle, within the POI's r and half its
// edge. A
// thing the site stood on ground the flight hasn't got (the rise and fall
// under it, 20 m across, differs from the flight's by more than DROP_Y) is
// dropped and counted: a wall along a riverbank the flight has no river for
// would hang in the air. Where no site has it, the POI's own list
// (LANDMARKS) stands on the flight's ground.
//
// No three.js: the sites and the galaxy's terrain are data and pure code.
//
//   siteFor(spec, poi) → the walkable site (siteOf's) | null
//   placementsFor(spec, poi, { heightAt, site }) → { list: [{ kind, model?,
//     opts?, at: [x, z], y, yaw, pitch?, roll?, scale, abs: true, solid:
//     false }], dropped }

import { makeHeight, siteOf } from '../../galaxy/shared/ground';
import { DROP_Y, LANDMARK_MAX, SITE_PLACES, landmarkRowsOf } from '../../../lib/land/flight/landmarkTables';

// the site's air, not its places': drawn by the walkable site round you, never from a ship
const AIR = new Set(['lightshafts', 'ds2sky', 'ds1sky']);

// what grows, lies or drifts stands on whatever ground it's given: the drop is for what's built
const GROWS = new Set(['lavarock', 'karst', 'glassshard', 'floatrocks', 'smoke', 'wrecksmoke', 'grove', 'redwood', 'jungletree', 'yavintree', 'palm', 'dagocypress', 'dagoroots', 'gnarltree', 'wroshyr', 'wroshyrgreat', 'ewoktree', 'sorganbirch', 'sorganfir', 'sorganfern', 'fern', 'log', 'qpine', 'qdeadtree', 'qfern']);
const grows = (t) => GROWS.has(t.kind) || String(t.model ?? '').startsWith('kit:naturemega/');

// A site's ground as the flight reads it: a site on the game's level keeps
// its own land for the flight (ground.flight), the heightmap being the
// surface's alone
const flightGround = (g) => (g?.flight ? { ...g, layers: g.flight } : g);
export const siteGround = (id) => flightGround(siteOf(id)?.ground);

const sites = new Map(); // id → { site, height }: made once a page
function siteData(id) {
  if (!sites.has(id)) {
    const site = siteOf(id);
    // (a site with no ground, Bespin's, stands everything at its own heights)
    sites.set(id, site ? { site, height: site.noGround ? () => 0 : makeHeight(siteGround(id)) } : null);
  }
  return sites.get(id);
}

const mapOf = (spec, poi) => SITE_PLACES[spec?.id]?.[poi?.id] ?? null;

export function siteFor(spec, poi) {
  const m = mapOf(spec, poi);
  return m ? (siteData(m.site)?.site ?? null) : null;
}

const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

// the site's things for a POI, and the middle they're measured from
function siteThings(site, m) {
  if (m.places === '*') {
    const centre = m.centre ?? site.land.at;
    return { centre, things: site.things_all };
  }
  const ids = new Set(m.places);
  const places = m.places.map((id) => site.places.find((p) => p.id === id)).filter(Boolean);
  if (!places.length) return { centre: [0, 0], things: [] };
  // (a loose thing goes with the place nearest it, ours or another's, or
  // with the landing spot: the crates round where you set down are no place's)
  const spots = [...site.places, { id: '@land', at: site.land.at }];
  const nearest = (at) => spots.reduce((best, p) => (d2(p.at, at) < d2(best.at, at) ? p : best)).id;
  return { centre: places[0].at, things: site.things_all.filter((t) => ids.has(t.place ?? nearest(t.at))) };
}

// how far the ground rises and falls under a thing: the spread of its
// height over a cross FOOT metres either side
const FOOT = 10;
function relief(h, x, z) {
  const ys = [h(x, z), h(x + FOOT, z), h(x - FOOT, z), h(x, z + FOOT), h(x, z - FOOT)];
  return Math.max(...ys) - Math.min(...ys);
}

const spec4 = (t, at, y) => {
  const out = { kind: t.kind, at, y, yaw: t.yaw ?? 0, scale: t.scale ?? 1, abs: true, solid: false };
  for (const k of ['model', 'opts', 'pitch', 'roll']) if (t[k] != null) out[k] = t[k];
  return out;
};

// the nearest LANDMARK_MAX to the POI's middle, in a fixed order
function capped(list, poi) {
  if (list.length <= LANDMARK_MAX) return list;
  return list
    .map((p, i) => ({ p, i, d: d2(p.at, poi.at) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .slice(0, LANDMARK_MAX)
    .sort((a, b) => a.i - b.i)
    .map((e) => e.p);
}

function fromSite({ site, height }, m, poi, heightAt) {
  const { centre, things } = siteThings(site, m);
  // (to halfway across the band the flat eases out over: past it the
  // flight's ground is a slope the site's level place never was)
  const reach2 = (poi.r + poi.edge / 2) ** 2;
  const siteBase = height(centre[0], centre[1]);
  const base = poi.h ?? heightAt(poi.at[0], poi.at[1]);
  const list = [];
  let dropped = 0;
  for (const t of things) {
    // (a room's furniture, what hangs in the sky past the fog and the forest's
    // light through its canopy aren't the place's buildings)
    if (t.zone || t.fog === false || AIR.has(t.kind)) continue;
    const dx = t.at[0] - centre[0], dz = t.at[1] - centre[1];
    if (dx * dx + dz * dz > reach2) continue;
    const at = [poi.at[0] + dx, poi.at[1] + dz];
    if (t.abs) {
      list.push(spec4(t, at, base + (t.y ?? 0) - siteBase));
      continue;
    }
    const ground = heightAt(at[0], at[1]);
    // (what matters is the ground under it, not how high its place is: a
    // house on a gentle slope stands on the flight's level ground as well,
    // a wall along a riverbank doesn't)
    if (!grows(t) && Math.abs(relief(height, t.at[0], t.at[1]) - relief(heightAt, at[0], at[1])) > DROP_Y) {
      dropped++;
      continue;
    }
    list.push(spec4(t, at, ground + (t.y ?? 0) - (t.sink ?? 0)));
  }
  for (const t of m.extra ?? []) list.push(fromRow(t, poi, heightAt));
  return { list: capped(list, poi), dropped };
}

function fromRow(t, poi, heightAt) {
  const at = [poi.at[0] + t.at[0], poi.at[1] + t.at[1]];
  return spec4(t.kit ? { ...t, kind: 'kit', model: `kit:${t.kit.kit}/${t.kit.name}` } : t, at, heightAt(at[0], at[1]));
}

function fromTable(rows, poi, heightAt) {
  return { list: capped(rows.map((t) => fromRow(t, poi, heightAt)), poi), dropped: 0 };
}

export function placementsFor(spec, poi, { heightAt, site = null } = {}) {
  const m = mapOf(spec, poi);
  const data = site ? { site, height: site.noGround ? () => 0 : makeHeight(flightGround(site.ground)) } : m ? siteData(m.site) : null;
  if (m && data) return fromSite(data, m, poi, heightAt);
  const rows = landmarkRowsOf(spec, poi);
  return rows ? fromTable(rows, poi, heightAt) : { list: [], dropped: 0 };
}

// The regions' names on the galaxy map (HoloMap.jsx): each is set along its
// ring at its own angle (so the names spread round the core rather than stand
// in a column), 11.5 px on screen at any zoom, and shown only when it has the
// room there: the ring's wide enough for the name to lie along it, and its
// band (from the ring inside) over twice a name's height wide, so the name
// sits in it with room to spare rather than wedged between two rings and the
// lanes. The inner rings are only a name or two's height apart when the map's
// fitted, even on a big screen, so their names come in as you zoom; the Unknown
// Regions' is kept in off the map's edge. Pure, tested.
//
// regionNamesShown(regions, unitPx, angleFor?, fontPx?) → a Set of the ids
// of the regions (REGIONS, the Deep Core first, which has no name) whose
// names have room at unitPx screen pixels to a map unit;
// regionAngle(i) → the angle (radians, north −π/2) the name of regions[i] is
// at: its own (ANGLES), or the nearest to it where the name lies clear of
// every system's dot and name (clearAngle), the right way up;
// unknownNameX(unitPx, fontPx?, left?) → where in map units the Unknown
// Regions' name is centred (`left`: the map's left edge, in map units).

import { CORE, REGIONS, SYSTEMS, edgeAt } from './systems';

export const REGION_FONT = 11.5;
const ANGLES = [-90, -112, -68, -132, -48, -150]; // (degrees round the core, north is −90: the names apart)
const GLYPH = 0.62; // (a mono letter's width in em, near enough; the names are in capitals)
export const LETTER_SPACING = 0.18; // (em between the letters of a name along a ring: HoloMap.jsx sets it; the Unknown Regions' has none)
const RING_GLYPH = GLYPH + LETTER_SPACING; // (a letter along a ring with the space after it)
const EDGE = 18; // (px the Unknown Regions' name keeps off the map's edge: clear of the grid's row numbers)

// Each name is set clear of the systems at the zoom it first shows at (a name's longest along its ring, then), each system its dot
// and its name to either side (labelPlace.js puts it where there's room; a name's letters NAME_GLYPH px), by CLEAR map units
const NAME_GLYPH = 7;
const CLEAR = 0.5;
const deg = (d) => (d * Math.PI) / 180;
const spotsAt = (unitPx) =>
  SYSTEMS.flatMap((s) => {
    const w = (s.name.length * NAME_GLYPH) / unitPx;
    return [-1, -0.5, 0, 0.5, 1].map((t) => [s.pos[0] + w * t, s.pos[1]]);
  });
// the points along a region's name at an angle: where it's drawn, a name's height and a tenth inside its ring (MapSvg.jsx)
function namePoints(r, a, unitPx, fontPx = REGION_FONT) {
  const half = (r.name.length * fontPx * RING_GLYPH) / unitPx / 2;
  const inset = (fontPx * 0.55) / unitPx; // (the middle of its letters, whichever way it's turned: regionInset)
  const d = edgeAt(r.r, a) - inset;
  return Array.from({ length: 9 }, (_, i) => {
    const t = a + ((i / 8) * 2 - 1) * (half / d);
    const dd = edgeAt(r.r, t) - inset;
    return [CORE[0] + Math.cos(t) * dd, CORE[1] + Math.sin(t) * dd];
  });
}

// how a name at angle `a` is turned (degrees, for SVG's rotate): along its ring, and the right way up (in the south half, the
// other way round); and how far in from its ring its baseline is, in ems (its letters inside the ring either way)
export const regionTurn = (a) => (a * 180) / Math.PI + (Math.sin(a) > 0 ? -90 : 90);
export const regionInset = (a) => (Math.sin(a) > 0 ? 0.2 : 0.9);
// the least px a map unit at which regions[i]'s name shows at an angle (regionNamesShown's room)
function showsAt(regions, i, a) {
  for (let u = 8; u < 400; u *= 1.04) if (regionNamesShown(regions, u, () => a).has(regions[i].id)) return u;
  return 400;
}
// how many of the systems' spots lie on regions[i]'s name at an angle, at the zoom it first shows at
export function clashesAt(regions, i, a) {
  const u = showsAt(regions, i, a);
  const pts = namePoints(regions[i], a, u);
  return spotsAt(u).filter(([x, z]) => pts.some(([px, pz]) => Math.hypot(px - x, pz - z) < CLEAR)).length;
}
// the angle nearest `home` (degrees) with no system on the name, else the one with the fewest; not within 10 degrees of the east or
// the west, where it'd stand on end (in the south half it's turned the other way, regionTurn, so it still reads upright)
export function clearAngle(regions, i, home) {
  let best = null;
  for (let off = 0; off <= 180; off += 2)
    for (const d of off ? [home - off, home + off] : [home]) {
      const e = ((((d + 180) % 360) + 360) % 360) - 180;
      if (Math.abs(e) < 10 || Math.abs(e) > 170) continue;
      const n = clashesAt(regions, i, deg(e));
      if (!best || n < best.n) best = { d: e, n };
      if (n === 0) return deg(e);
    }
  return deg(best.d);
}
const homeOf = (i) => ANGLES[(i - 1) % ANGLES.length];
let CLEAR_ANGLES = null; // (worked out the first time they're asked for: regionNamesShown is below)

export function regionAngle(i) {
  CLEAR_ANGLES ??= REGIONS.map((_, j) => (j === 0 ? null : clearAngle(REGIONS, j, homeOf(j))));
  return CLEAR_ANGLES[i] ?? deg(homeOf(i));
}

const ROOM = 2.2; // (a band's least width for its name, in the names' heights: at 1.4 a big screen's map named all four inner rings, crammed round Coruscant)

export function regionNamesShown(regions, unitPx, angleFor = regionAngle, fontPx = REGION_FONT) {
  const shown = new Set();
  if (!(unitPx > 0)) return shown;
  regions.forEach((r, i) => {
    if (i === 0) return;
    const a = angleFor(i);
    const here = edgeAt(r.r, a) * unitPx;
    const gap = here - edgeAt(regions[i - 1].r, a) * unitPx;
    // (the name lies along the ring, so it wants the ring's width, its letters spaced; and its band ROOM names' heights wide)
    if (here >= 0.9 * r.name.length * fontPx * RING_GLYPH && gap >= ROOM * fontPx) shown.add(r.id);
  });
  return shown;
}

// out west, as it's always been, centred where it fits: from EDGE px in on a small map (whose left edge is `left`, in map units)
export function unknownNameX(unitPx, fontPx = REGION_FONT, left = 0) {
  const home = CORE[0] - 9.3;
  if (!(unitPx > 0)) return home;
  return Math.max(home, left + (EDGE + ('Unknown Regions'.length * fontPx * GLYPH) / 2) / unitPx);
}

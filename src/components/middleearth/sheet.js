// Middle-earth’s geography (./geography.js, in miles) projected onto the
// 800 × 560 sheet every painter draws on: one scale for both axes, north up,
// as Tolkien’s own grids are. The arrays ./mapData.js used to hold by hand
// are derived here, in the shapes the painters read, so a place moves on
// every drawing of the map at once when its miles change.

import { AREAS, FRAME, LABELS, LINES, ROAD_MILES, place } from './geography';

export const SHEET = { w: 800, h: 560 };

const [ox, oy] = FRAME.sheetOrigin;
const k = FRAME.milesPerUnit;

export const project = (east, south) => [ox + east / k, oy + south / k];
export const unproject = (x, y) => [(x - ox) * k, (y - oy) * k];
export const placeAt = (id) => {
  const p = place(id);
  return project(p.east, p.south);
};
const line = (id) => LINES.find((l) => l.id === id);
export const lineAt = (id) => line(id).points.map(([e, s]) => project(e, s));

// a stop’s share of the Ring’s road by Fonstad’s miles, not straight ones
export const roadFraction = (id) => ROAD_MILES[id] / ROAD_MILES['mount-doom'];

// A smooth SVG path through the points (a Catmull-Rom spline as cubic
// Béziers), so a river or a coast passes through every point the note gives
// and bends between them. Closed, it wraps round to its first point.
const r1 = (n) => Math.round(n * 10) / 10;
export function pathOf(points, { closed = false, tension = 0.5 } = {}) {
  const n = points.length;
  const pt = (i) => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))]);
  const t = tension / 3;
  let d = `M${r1(points[0][0])} ${r1(points[0][1])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [pt(i - 1), pt(i), pt(i + 1), pt(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
    const c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
    d += ` C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return closed ? `${d} Z` : d;
}

// The places the sheet names, and which side of its dot each name sits
// (r right, l left, a above, b below), chosen so no two names, nor a name
// and a stop’s, overlap (sheet.test.js holds it). The road’s stops are
// drawn by the painters from ./road.js, so they are not here; Umbar lies
// beyond the sheet’s foot and is named at its edge, below Harondor.
const NAMED = [
  ['grey-havens', 'l'],
  ['annuminas', 'l'],
  ['fornost', 'r'],
  ['tharbad', 'r'],
  ['lond-daer', 'r'],
  ['carrock', 'l'],
  ['high-pass', 'a'],
  ['erebor', 'r'],
  ['dale', 'r'],
  ['esgaroth', 'l'],
  ['dol-guldur', 'r'],
  ['isengard', 'l'],
  ['helms-deep', 'l'],
  ['edoras', 'r'],
  ['cair-andros', 'l'],
  ['minas-tirith', 'l'],
  ['osgiliath', 'a'],
  ['henneth-annun', 'r'],
  ['minas-morgul', 'b'],
  ['barad-dur', 'b'],
  ['pelargir', 'r'],
  ['dol-amroth', 'l'],
  ['umbar', 'a'],
];
const edge = ([x, y]) => [Math.max(14, Math.min(SHEET.w - 14, x)), Math.max(14, Math.min(SHEET.h - 18, y))];
// [name, x, y, side]
export const PLACES = NAMED.map(([id, side]) => [place(id).name.replace(/^The /, ''), ...edge(placeAt(id)), side]);

// [name, x, y], each land’s name at its middle
export const REGIONS = LABELS.map((l) => [l.name, ...project(l.east, l.south)]);

// The sea west and south of the coast, closed along the sheet’s west edge
// and foot; and the Sea of Rhûn, closed along its east edge.
const coast = lineAt('coast');
const rhun = AREAS.find((a) => a.id === 'sea-of-rhun').points.map(([e, s]) => project(e, s));
export const SEAS = [`${pathOf(coast)} L0 ${SHEET.h} L0 0 Z`, `${pathOf(rhun)} Z`];

// [path, thin]
export const RIVERS = LINES.filter((l) => l.kind === 'river').map((l) => [pathOf(lineAt(l.id)), l.width === 'thin']);

// [[[x, y], …], dark]: each range as the polyline its peaks stand along
export const RANGES = LINES.filter((l) => l.kind === 'range').map((l) => [lineAt(l.id), Boolean(l.dark)]);

// [path]: the roads, drawn faint and dotted under the Ring’s
export const ROADS = LINES.filter((l) => l.kind === 'road').map((l) => pathOf(lineAt(l.id)));

// An area on the sheet: an ellipse { at, rx, ry } or a polygon { points }.
const shape = (a) => (a.ellipse ? { at: project(...a.ellipse.at), rx: a.ellipse.rx / k, ry: a.ellipse.ry / k } : { points: a.points.map(([e, s]) => project(e, s)) });
const area = (s) => (s.points ? Math.abs(s.points.reduce((n, [x, y], i) => n + x * s.points[(i + 1) % s.points.length][1] - y * s.points[(i + 1) % s.points.length][0], 0)) / 2 : Math.PI * s.rx * s.ry);

// Trees a sheet unit², as the hand-made sheet had them (its Lothlórien and
// Old Forest at about 0.026, Mirkwood at 0.008); Eregion’s holly and
// Ithilien’s woods are thinner, scattered rather than forest.
const DENSITY = { gold: 0.03, dark: 0.009, eregion: 0.006, ithilien: 0.012 };
// [shape, seed, count, kind]
export const FORESTS = AREAS.filter((a) => a.kind === 'forest').map((a, i) => {
  const s = shape(a);
  return [s, 7 + i * 4, Math.max(5, Math.round(area(s) * (DENSITY[a.id] ?? DENSITY[a.tint] ?? 0.025))), a.tint || ''];
});

// [{ at, rx, ry }]: the Dead Marshes, the Nindalf, the Midgewater
export const MARSHES = AREAS.filter((a) => a.kind === 'marsh').map(shape);
// [{ at, rx, ry }]: Evendim, Mirrormere, Nen Hithoel, the Long Lake, Núrnen
export const LAKES = AREAS.filter((a) => a.kind === 'lake').map(shape);

// Where a place’s name is written beside its dot, by its side: [x, y, align]
// at the 8.5-unit size the painters write names in.
export const nameAt = (x, y, side = 'r') => (side === 'l' ? [x - 5, y + 3, 'right'] : side === 'a' ? [x, y - 5, 'center'] : side === 'b' ? [x, y + 11, 'center'] : [x + 5, y + 3, 'left']);

// Where a stop’s name is written: above and to the right of its pin, but
// for Cirith Ungol, whose name would run into Mount Doom’s, and the Dead
// Marshes, whose would sit on the Black Gate’s, written to the left.
const STOP_LEFT = new Set(['cirith-ungol', 'dead-marshes']);
export const stopNameAt = (s) => (STOP_LEFT.has(s.id) ? [s.x - 6, s.y - 5, 'right'] : [s.x + 6, s.y - 5, 'left']);

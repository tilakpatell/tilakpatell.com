// Every name the sheet writes, ranked and placed (./mapLabels.js): the road’s
// stops first and strongest, then the great places, then the lands, the
// forests and the seas, then the minor places, each kept off the drawing it
// would sit on. The painters (./mapPaint.js, ./Map.jsx) write NAMES as
// they are; they place nothing themselves.
//
// The hierarchy is the cartographers’ (Axis Maps’ labelling guide, after
// Imhof): size and weight promote a name, a smaller size, a lighter ink and
// letter-spacing set it back, so the stops read first, the lands last, and
// the eye has room to rest between them.

import { CAST } from './mapCast';
import { FORESTS, LAKES, RANGES, REGIONS, SHEET, peaks, trees } from './mapData';
import { placeLabels } from './mapLabels';
import { STOPS } from './road';
import { placeAt, project } from './sheet';
import { place } from './geography';

// the type a kind of name is set in, in sheet units: [size, letter-spacing]
export const TYPE = {
  stop: [9.5, 0],
  great: [8.5, 0],
  minor: [7, 0],
  land: [14, 5],
  forest: [7.5, 2.5],
  water: [9, 1.5],
};

// The places named beside their dots: the great ones (cities, fortresses,
// havens the story turns on) and the minor ones (named if there is room).
const GREAT = ['grey-havens', 'isengard', 'edoras', 'helms-deep', 'minas-tirith', 'barad-dur', 'erebor', 'dol-guldur'];
const MINOR = ['fornost', 'annuminas', 'tharbad', 'lond-daer', 'carrock', 'high-pass', 'dale', 'esgaroth', 'osgiliath', 'cair-andros', 'henneth-annun', 'minas-morgul', 'pelargir', 'dol-amroth', 'dunharrow', 'umbar'];

// the names that lie across an area: the forests Tolkien’s map letters
// inside their trees, and the seas
const FOREST_NAMES = [
  ['MIRKWOOD', 'mirkwood', 40],
  ['FANGORN', 'fangorn', 14],
];
const WATER_NAMES = [
  // the open sea west of the coast, Belegaer, the Great Sea of the West
  ['The Great Sea', [-300, 520], 50],
  ['Bay of Belfalas', [430, 770], 30],
];

// The 3D map’s toys (./mapDiorama.js) stand up off the sheet, and the camera
// looks north over them, so each hides a little of the sheet to its north:
// [radius, height] in sheet units, a name kept off both.
const TOYS = {
  hobbiton: [14, 8],
  bree: [8, 6],
  weathertop: [9, 8],
  rivendell: [12, 14],
  moria: [9, 10],
  lorien: [14, 12],
  isengard: [9, 20],
  edoras: [9, 8],
  'minas-tirith': [17, 20],
  'black-gate': [10, 10],
  'barad-dur': [8, 30],
  'mount-doom': [11, 14], // its steep cone: a name over the low foot still reads
};
const toy = ([x, y], [r, h]) => [x - r, y - r - h, x + r, y + r];

// the dot a place is drawn with is to stay clear; Umbar lies off the sheet’s
// foot and is set at its edge, as an old map names what lies beyond it
const edge = ([x, y]) => [Math.max(14, Math.min(SHEET.w - 14, x)), Math.max(14, Math.min(SHEET.h - 18, y))];
const named = (id) => place(id).name.replace(/^The /, '');

function obstacles() {
  const out = [];
  for (const [line] of RANGES) for (const [x, y] of peaks(line, 11, 12)) out.push([x - 6, y - 6, x + 6, y + 4]);
  for (const [shape, seed, count] of FORESTS) for (const [x, y, r] of trees(shape, seed, count)) out.push([x - r * 0.7, y - r * 0.7, x + r * 0.7, y + r * 0.7]);
  for (const { at, rx, ry } of LAKES) out.push([at[0] - rx, at[1] - ry, at[0] + rx, at[1] + ry]);
  for (const [id, size] of Object.entries(TOYS)) out.push(toy(placeAt(id), size));
  // the painted Mount Doom and the dark tower (./mapPaint.js)
  const [dx, dy] = placeAt('mount-doom');
  const [bx, by] = placeAt('barad-dur');
  out.push([dx - 10, dy - 14, dx + 10, dy + 7], [bx - 4, by - 21, bx + 4, by + 3]);
  // the sheet’s own title along its foot (./mapPaint.js)
  out.push([164, 530, 486, 544]);
  // the cast standing on the map: each figure stands about 20 units tall,
  // and the camera’s tilt lays most of that over the sheet to its north
  for (const c of CAST) out.push(toy(c.at, [5, 18]));
  return out;
}

const centre = (shape) => (shape.points ? [shape.points.reduce((n, p) => n + p[0], 0) / shape.points.length, shape.points.reduce((n, p) => n + p[1], 0) / shape.points.length] : shape.at);
const forestShape = (id) => FORESTS[['old-forest', 'trollshaws', 'eregion', 'lorien', 'fangorn', 'mirkwood'].indexOf(id)][0];

const labels = [
  ...STOPS.map((s) => ({ id: `stop:${s.id}`, kind: 'stop', text: s.name, at: [s.x, s.y], size: TYPE.stop[0], rank: 0, dot: 3 })),
  ...GREAT.map((id) => ({ id, kind: 'great', text: named(id), at: edge(placeAt(id)), size: TYPE.great[0], rank: 1 })),
  ...REGIONS.map(([t, x, y]) => ({ id: `land:${t}`, kind: 'land', text: t, at: [x, y], size: TYPE.land[0], spacing: TYPE.land[1], rank: 2, area: 40 })),
  ...FOREST_NAMES.map(([t, id, area]) => ({ id: `forest:${id}`, kind: 'forest', text: t, at: centre(forestShape(id)), size: TYPE.forest[0], spacing: TYPE.forest[1], rank: 2, area })),
  ...WATER_NAMES.map(([t, at, area]) => ({ id: `water:${t}`, kind: 'water', text: t, at: project(...at), size: TYPE.water[0], spacing: TYPE.water[1], rank: 2, area })),
  ...MINOR.map((id) => ({ id, kind: 'minor', text: named(id), at: edge(placeAt(id)), size: TYPE.minor[0], rank: 3 })),
];

// The forests’ own names sit on their trees by design (the trees are cleared
// round the letters as they are painted), so the trees are no obstacle to them.
const drawing = obstacles();
const placed = placeLabels(
  labels.filter((l) => l.kind !== 'forest'),
  drawing,
  { ...SHEET, margin: 14 },
);
const forests = placeLabels(
  labels.filter((l) => l.kind === 'forest'),
  placed.map((p) => p.box),
  { ...SHEET, margin: 14 },
);

// [{ id, kind, text, x, y, align, size, spacing, box, at }] in the order to write them
export const NAMES = [...placed, ...forests];
// the places named beside a dot (the stops’ dots are the painters’ own)
export const DOTS = NAMES.filter((n) => n.kind === 'great' || n.kind === 'minor').map((n) => n.at);
// the names everyone looked for and the sheet could not fit
export const UNNAMED = labels.filter((l) => !NAMES.some((n) => n.id === l.id)).map((l) => l.id);

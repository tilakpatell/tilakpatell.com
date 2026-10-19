// Where the map’s names go: a placer after the cartographers’ rules (Imhof,
// “Positioning Names on Maps”, 1975). A name belongs plainly to its dot and
// sits at its upper right where it can, then at the other places round it in
// a fixed order; it never touches another name or another place’s dot; it
// keeps off the drawing (peaks, trees, the toys of the 3D map) where it can.
// Names go down in rank order, the road’s stops first, so a minor name that
// finds no room is left off rather than piled on a greater one. An area’s
// name (a land, a forest, a sea) slides about its middle to open ground.
//
// Pure: widths are estimated from the letters, not measured on a canvas, so
// every painter (and the tests) places the same names in the same places.

// a letter’s advance, as a share of the type’s size, in the map’s serif
// (Cinzel’s capitals run wide, its small letters are small capitals)
const advance = (c) => (c === ' ' ? 0.3 : /[A-ZÂÊÎÔÛÁÉÍÓÚ]/.test(c) ? 0.74 : /[a-zâêîôûáéíóúë]/.test(c) ? 0.6 : /[0-9]/.test(c) ? 0.6 : 0.32);
export const textWidth = (text, size, spacing = 0) => [...text].reduce((w, c) => w + advance(c) * size, 0) + spacing * Math.max(0, text.length - 1);

// A name’s box as drawn: x is its anchor (left, centre or right by `align`),
// y its baseline; capitals stand 0.72 of the size, tails hang 0.2 below.
export function boxOf(text, x, y, align, size, spacing = 0) {
  const w = textWidth(text, size, spacing);
  const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  return [x0, y - size * 0.72, x0 + w, y + size * 0.2];
}

const overlapArea = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
const touches = (a, b, air = 0) => a[0] < b[2] + air && b[0] < a[2] + air && a[1] < b[3] + air && b[1] < a[3] + air;

// Imhof’s order round a point: upper right, right, lower right, then the
// same on the left, then above and below. [dx, dy, align] with the gap from
// the dot and the type’s capital height to hand.
const AROUND = [
  (g) => [g, -1, 'left'],
  (g, c) => [g + 1, c / 2, 'left'],
  (g, c) => [g, c + 1, 'left'],
  (g) => [-g, -1, 'right'],
  (g, c) => [-g - 1, c / 2, 'right'],
  (g, c) => [-g, c + 1, 'right'],
  (g) => [0, -g - 1, 'center'],
  (g, c) => [0, c + g + 1, 'center'],
];

// how much further out each ring of tries stands: the first hugs the dot;
// the second, for a crowded dot, a little off; the third only for a stop,
// which must be named somewhere near its pin
const RINGS = [0, 6, 14];

// an area’s name: its middle, then rings of tries out to `area` units
function aboutMiddle(area) {
  const out = [[0, 0]];
  for (let r = area / 4; r <= area + 1e-9; r += area / 4) for (let a = 0; a < 12; a++) out.push([Math.cos((a * Math.PI) / 6) * r, Math.sin((a * Math.PI) / 6) * r]);
  return out;
}

// labels: [{ id, text, at: [x, y], size, spacing?, rank? (0 the stops, 1
// the great places, 2 the lands, 3 the minor places), dot? (its dot’s
// radius), area? (an area’s name: how far it may slide) }]; obstacles:
// boxes [x0, y0, x1, y1] of drawing to keep off; sheet: { w, h, margin }.
// Gives the names placed, in the order placed, each with x, y, align, box.
export function placeLabels(labels, obstacles, sheet) {
  const order = labels.map((l, i) => [l, i]).sort((a, b) => (a[0].rank ?? 1) - (b[0].rank ?? 1) || a[1] - b[1]);
  const dots = labels.filter((l) => !l.area).map((l) => {
    const r = (l.dot ?? 2.5) + 0.5;
    return { id: l.id, box: [l.at[0] - r, l.at[1] - r, l.at[0] + r, l.at[1] + r] };
  });
  const placed = [];
  const m = sheet.margin ?? 0;
  for (const [l] of order) {
    const rank = l.rank ?? 1;
    const spacing = l.spacing ?? 0;
    const tries = l.area
      ? aboutMiddle(l.area).map(([dx, dy]) => [l.at[0] + dx, l.at[1] + dy + l.size * 0.36, 'center', Math.hypot(dx, dy) / l.area])
      : RINGS.slice(0, rank === 0 ? 3 : 2).flatMap((away, ring) =>
          AROUND.map((f, i) => {
            const [dx, dy, align] = f((l.dot ?? 2.5) + 2.5 + away, l.size * 0.72);
            return [l.at[0] + dx, l.at[1] + dy, align, i * 0.08 + ring];
          }),
        );
    let best = null;
    for (const [x, y, align, penalty] of tries) {
      const box = boxOf(l.text, x, y, align, l.size, spacing);
      const area = (box[2] - box[0]) * (box[3] - box[1]);
      const out = box[0] < m || box[1] < m || box[2] > sheet.w - m || box[3] > sheet.h - m;
      const hard = placed.some((p) => touches(box, p.box, 1)) || dots.some((d) => d.id !== l.id && touches(box, d.box));
      let soft = 0;
      for (const o of obstacles) soft += overlapArea(box, o);
      const cost = (out || hard ? 1e6 : 0) + soft / area + penalty;
      if (!best || cost < best.cost) best = { x, y, align, box, cost, clear: !out && !hard, soft: soft / area };
    }
    // a stop is always named; a land or a great place takes the best clear
    // place it has; a minor place only a clear one with little drawing under it
    if (!best.clear && rank > 0) continue;
    if (rank >= 3 && best.soft > 0.15) continue;
    placed.push({ ...l, x: best.x, y: best.y, align: best.align, box: best.box });
  }
  return placed;
}

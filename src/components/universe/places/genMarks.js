// The generated planets round the ship on the nav map: each a mark (chart/
// place.js's shape) in the colour of its own look, ranked by what it has, at
// the system and neighbourhood levels only (the universe level stays the
// hand-made places', or it's noise), and never over a hand-made name.
// Pure (no React, DOM or three.js): the scene hands the rows through its
// where() as `generated`, chart/marks.js's liveMarks makes them marks.
//
// GEN_MARKS → { range, most, base, per, top }: how far round the ship (map units), how many at most
//   (the nearest), the priority a plain one has, how much more each notable trait gives, the most
// TAG_GLYPHS[tag] → the glyph a trait shows under a planet's name
// (the rows are ./planetsAround.js's, the scene's: this file imports nothing, so the chart, which
// loads on every page with the mini-map or ⌘K, carries no generator)
// generatedMarks(rows) → [Mark]: { id, kind: 'world', name, at, priority, color, levels, shape: 'dot',
//   pickable: true, tags }

export const GEN_MARKS = Object.freeze({ range: 60000, most: 120, base: 20, per: 4, top: 44 });
export const TAG_GLYPHS = Object.freeze({ surveyed: '✓', anomaly: '◈', rare: '◆', exotic: '✦', ruins: '⌂', secret: '◐', station: '⊕', hazard: '!' });
const LEVELS = Object.freeze(['system', 'neighbourhood']);

export function generatedMarks(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r && typeof r.id === 'string' && Array.isArray(r.at))
    .map((r) => {
      const notable = (r.tags ?? []).filter((x) => x !== 'surveyed' && x !== 'hazard').length;
      return Object.freeze({
        id: r.id,
        kind: 'world',
        name: r.name ?? '',
        at: r.at,
        priority: Math.min(GEN_MARKS.top, GEN_MARKS.base + GEN_MARKS.per * notable),
        color: r.color,
        levels: LEVELS,
        shape: 'dot',
        pickable: true,
        tags: Object.freeze([...(r.tags ?? [])]),
      });
    });
}

// Lane 0's lighting rulebook (maps/<level>.lighting.json) into the shapes
// lane R's light stack takes (src/lib/three/light/apply.js): a weather's
// VisualEnvironment components as `entry.record` (the fields readEntry
// reads, by the game's names), and the placed lights as lights.json binned
// by 128 m cell in the export's frame (placed.js). Pure.
//
//   unflatten(raw) → { Field: number | [x, y, z(, w)] }: a record's flat
//     `Field.x` keys folded back, its transform and source left out
//   entryFor(lighting, name) → { name, record }
//   readLightRow(row) → { kind: 'point' | 'spot', pos, color, candela, range, cone?, dir? } | null
//   lightsJsonOf(rows, { cell }) → { format: 1, cell, cells }
//
// (the reader is lib/three/light/lighting.js's, shared with the galaxy
// surface; the names here are kept)

export { CELL, entryFor, lightsJsonOf, readLightRow, unflatten } from '../../lib/three/light/lighting.js';

// Where a level lands when no one says (lane E0): the map rulebook's
// (scripts/lib/bf2017-rulebook-map.mjs, `maps/<level>.json`'s rows) first
// team's first spawn area, in the first mode the map has of MODES; an area's
// middle, else the first spawn point and its heading. Pure.
//
//   spotFrom(rows, { modes }) → { spot: [x, z], yaw, from: id } | null

export const MODES = ['galacticAssault', 'strike', 'blast', 'extraction', 'hvv', 'arcade', 'supremacy'];

const middle = (points) => points.reduce((a, [x, z]) => [a[0] + x / points.length, a[1] + z / points.length], [0, 0]);

export function spotFrom(rows, { modes = MODES } = {}) {
  for (const mode of modes) {
    const area = (rows.polygons ?? []).find((p) => p.mode === mode && p.team === 1 && p.enabled && p.points?.length);
    if (area) return { spot: middle(area.points), yaw: 0, from: area.id };
    const point = (rows.spawns ?? []).find((s) => s.mode === mode && s.team === 1 && s.enabled);
    if (point) return { spot: [point.at[0], point.at[2]], yaw: point.yaw ?? 0, from: point.id };
  }
  return null;
}

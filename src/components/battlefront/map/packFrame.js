// A pack file's rows in the export's frame. Lane L's pack is cut round its
// origin and turned by its yaw (level.js draws the meshes in a group put
// back there); the files beside it that other lanes read straight into the
// scene (X's effects.json, V's volumes.json, Q2's ground.json) are in the
// pack's frame, while the Battlefront world, its placed lights and its
// cameras are in the map's. These move the rows over once, at load. Pure.
//
//   toMap(pack, [x, y, z]) → [x, y, z] in the export's frame (toPack's inverse, with the height)
//   rebaseCells(json, pack, { cell }) → a { cells: { "cx,cz": [row] } } file's
//     copy, each row's `pos` and `quat` in the export's frame, binned again
//   groundInMap(json, pack) → ground.json with its masks' frame moved by the
//     origin; null for a turned pack (the layered ground samples the masks
//     by world x and z, so a turn cannot be put in its frame)

export const CELL = 128; // m: lane L's cell, placed.js's

export function toMap(pack, [x, y, z]) {
  const [ox, oy, oz] = pack.origin ?? [0, 0, 0];
  const c = Math.cos(pack.yaw ?? 0);
  const s = Math.sin(pack.yaw ?? 0);
  return [ox + x * c - z * s, oy + y, oz + x * s + z * c];
}

// q × r, both [x, y, z, w]
const mul = ([ax, ay, az, aw], [bx, by, bz, bw]) => [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];

export function rebaseCells(json, pack, { cell = json?.cell ?? CELL } = {}) {
  if (!json?.cells) return json;
  // (the group's turn: rotation.y = −yaw)
  const h = -(pack.yaw ?? 0) / 2;
  const turn = [0, Math.sin(h), 0, Math.cos(h)];
  const cells = {};
  for (const rows of Object.values(json.cells)) {
    for (const row of rows) {
      const pos = toMap(pack, row.pos);
      const out = { ...row, pos };
      if (row.quat) out.quat = mul(turn, row.quat);
      (cells[`${Math.floor(pos[0] / cell)},${Math.floor(pos[2] / cell)}`] ??= []).push(out);
    }
  }
  return { ...json, cell, cells };
}

export function groundInMap(json, pack) {
  if (pack.yaw) return null;
  if (!json?.masks) return json;
  const [ox, , oz] = pack.origin ?? [0, 0, 0];
  return { ...json, masks: { ...json.masks, minX: json.masks.minX + ox, minZ: json.masks.minZ + oz } };
}

// The durable world's grid and its rows, as pure rules: which 2048 m cell a
// point is in, the cells round one (nearest first, so the ship's own cell is
// asked for before its corners), a cell's envelope for the database's query,
// and an entity as the client holds it against a row as the table does.
// CELL equals the network's NET_CELL (the spec's decision 9): a Nostr cell
// and a database cell are the same square.
// Design: docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md (Pillar 2).
//
// CELL = 2048
// cellOf(x, z) → [cx, cz]; cellsAround(cx, cz, r = 1) → 'cx,cz'[] nearest first
// bboxOf(cx, cz) → { minX, maxX, minZ, maxZ }; diffCells(prev, next) → { gone, came }
// rowToEntity(row) → { id, planetId, type, owner, x, y, z, rot: [rx, ry, rz], scale, hp, metadata, version, updatedAt }
// entityToRow(entity) → the columns the client may set (never id, owner, version or the times)

export const CELL = 2048;

export const cellOf = (x, z) => [Math.floor(x / CELL), Math.floor(z / CELL)];

export function cellsAround(cx, cz, r = 1) {
  const out = [];
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) out.push([dx, dz]);
  // sort is stable, so cells as near as each other keep their row order
  out.sort((a, b) => a[0] ** 2 + a[1] ** 2 - (b[0] ** 2 + b[1] ** 2));
  return out.map(([dx, dz]) => `${cx + dx},${cz + dz}`);
}

export const bboxOf = (cx, cz) => ({ minX: cx * CELL, maxX: (cx + 1) * CELL, minZ: cz * CELL, maxZ: (cz + 1) * CELL });

export function diffCells(prev, next) {
  const was = new Set(prev);
  const now = new Set(next);
  return { gone: prev.filter((k) => !now.has(k)), came: next.filter((k) => !was.has(k)) };
}

export const rowToEntity = (row) => ({
  id: row.id,
  planetId: row.planet_id,
  type: row.entity_type,
  owner: row.owner,
  x: row.x,
  y: row.y,
  z: row.z,
  rot: [row.rot_x, row.rot_y, row.rot_z],
  scale: row.scale,
  hp: row.hp,
  metadata: row.metadata,
  version: row.version,
  updatedAt: row.updated_at,
});

// what the entity does not say is left out, so the table's defaults (no
// turn, scale 1, full health) apply rather than a null the checks refuse
export function entityToRow(e) {
  const row = {
    planet_id: e.planetId,
    entity_type: e.type,
    x: e.x,
    y: e.y,
    z: e.z,
    rot_x: e.rot?.[0],
    rot_y: e.rot?.[1],
    rot_z: e.rot?.[2],
    scale: e.scale,
    hp: e.hp,
    metadata: e.metadata,
  };
  return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined));
}

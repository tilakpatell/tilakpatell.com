// The chunk grid's twin in three dimensions (chunkGrid.js stays flat for
// the worlds on the ground): which cubic cells to ask for round a point
// (nearest first, ties toward where it's heading, then in a fixed order),
// how many may be in flight at once, which to let go of past a band of
// hysteresis, and a generation, so a cell that arrives after a reset or
// after a jump is refused rather than loaded. Unlike the flat grid, a cell
// still in flight is kept within the band too (cancelled only past it), so
// a ship sitting on a sector's face or corner, its answers coming frames
// later, asks for each cell once and never flickers between two. Pure: the
// caller builds and frees the cells, this only says which.
//
// Cells are corner-based, cell c spanning [c * size, (c + 1) * size) on each
// axis, as chunkGrid.js's are; a caller whose cells are centred on theirs
// (the Expanse's sectors) asks by the point plus half a cell.
//
// createChunkGrid3({ size, radius, inFlight, hysteresis }) → {
//   cellOf(x, y, z) → [cx, cy, cz], cells(x, y, z, { radius, heading }),
//   update({ x, y, z, heading: [hx, hy, hz] | null, radius }) → { ask, drop, cancel },
//   began(key, gen), done(key, gen) → bool, failed(key, gen), unload(key),
//   reset(gen) → { drop, cancel }, loaded, flying, gen, radius, size }
// parseCell('cx,cy,cz') → [cx, cy, cz]

const keyOf = (cx, cy, cz) => `${cx},${cy},${cz}`;

// (+ 0 turns -0 into 0)
export const parseCell = (key) => key.split(',').map((v) => Number(v) + 0);

// the cell offsets within r: nearest first, then most along the heading,
// then in the order of a scan (y, then z, then x, each low to high)
const ordering = (r, heading) => {
  const [hx, hy, hz] = heading || [0, 0, 0];
  const list = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const d2 = dx * dx + dy * dy + dz * dz;
        const align = !heading ? 0 : d2 === 0 ? Infinity : (dx * hx + dy * hy + dz * hz) / Math.sqrt(d2);
        list.push([dx, dy, dz, d2, align]);
      }
    }
  }
  list.sort((a, b) => a[3] - b[3] || b[4] - a[4] || a[1] - b[1] || a[2] - b[2] || a[0] - b[0]);
  return list;
};

export function createChunkGrid3({ size, radius, inFlight = 8, hysteresis = 1 }) {
  const cache = new Map(); // 'cx,cy,cz,r,heading' → Key[]
  let centre = null; // [cx, cy, cz] of the last update

  const within = (key, r) => {
    if (!centre) return false;
    const [x, y, z] = parseCell(key);
    return Math.max(Math.abs(x - centre[0]), Math.abs(y - centre[1]), Math.abs(z - centre[2])) <= r;
  };

  const grid = {
    loaded: new Set(),
    flying: new Map(), // key → gen
    gen: 0,
    radius,
    size,

    cellOf(x, y, z) {
      const s = grid.size;
      return [Math.floor(x / s) + 0, Math.floor(y / s) + 0, Math.floor(z / s) + 0];
    },

    cells(x, y, z, { radius: r = grid.radius, heading = null } = {}) {
      const [cx, cy, cz] = grid.cellOf(x, y, z);
      const id = `${cx},${cy},${cz},${r},${heading ? heading.join(',') : '-'}`;
      let keys = cache.get(id);
      if (keys) return keys;
      keys = ordering(r, heading).map(([dx, dy, dz]) => keyOf(cx + dx, cy + dy, cz + dz));
      if (cache.size >= 64) cache.clear();
      cache.set(id, keys);
      return keys;
    },

    update({ x, y, z, heading = null, radius: r }) {
      if (r !== undefined) grid.radius = r;
      centre = grid.cellOf(x, y, z);
      // a flight and a loaded cell are both kept within the band, so a
      // point sitting on a face asks for each cell on either side once
      const keep = grid.radius + hysteresis;
      const cancel = [];
      for (const key of grid.flying.keys()) {
        if (!within(key, keep)) cancel.push(key);
      }
      for (const key of cancel) grid.flying.delete(key);
      const drop = [];
      for (const key of grid.loaded) {
        if (!within(key, keep)) drop.push(key);
      }
      for (const key of drop) grid.loaded.delete(key);
      const ask = [];
      const room = Math.max(0, inFlight - grid.flying.size);
      if (room > 0) {
        for (const key of grid.cells(x, y, z, { heading })) {
          if (grid.loaded.has(key) || grid.flying.has(key)) continue;
          ask.push(key);
          if (ask.length >= room) break;
        }
      }
      return { ask, drop, cancel };
    },

    began(key, gen = grid.gen) {
      grid.flying.set(key, gen);
    },

    done(key, gen) {
      const ours = grid.flying.get(key) === gen;
      if (ours && gen === grid.gen && within(key, grid.radius + hysteresis)) {
        grid.flying.delete(key);
        grid.loaded.add(key);
        return true;
      }
      if (ours) grid.flying.delete(key);
      return false;
    },

    failed(key, gen) {
      if (gen === undefined || grid.flying.get(key) === gen) grid.flying.delete(key);
    },

    unload(key) {
      grid.loaded.delete(key);
    },

    reset(gen = grid.gen + 1) {
      const drop = [...grid.loaded];
      const cancel = [...grid.flying.keys()];
      grid.loaded.clear();
      grid.flying.clear();
      grid.gen = gen;
      return { drop, cancel };
    },
  };
  return grid;
}

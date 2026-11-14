// chunkGrid.js's bookkeeping in three dimensions, for a space built in cube
// cells round the player: which cells to ask for next (nearest first, ties
// toward where the player is heading, up and down included), how many may
// be in flight at once, which loaded cells have gone far enough to let go of
// (a band of hysteresis past the radius, Chebyshev, so sitting on a face or
// a corner doesn't load and drop the same cells over and over), and a
// generation, so a cell that arrives after a reset or after the player has
// gone on is refused. Pure: the caller builds and frees the cells.
// (chunkGrid.js stays as it is: the planet flight's life is built on it.)
//
// createChunkGrid3({ size, radius, inFlight, hysteresis = 1 }) → { cellOf(x, y, z),
//   cells(x, y, z, { radius, heading }), update({ x, y, z, heading: [hx, hy, hz] | null,
//   radius }) → { ask, drop, cancel }, began(key, gen), done(key, gen),
//   failed(key, gen), unload(key), reset(gen), loaded, flying, gen, radius, size }
// Keys are 'cx,cy,cz'. A heading is read to a tenth, so the order is worked
// out again only when the way ahead has really changed.

const keyOf = (cx, cy, cz) => `${cx},${cy},${cz}`;
const parse = (key) => key.split(',').map(Number);
const tenth = (v) => Math.round(v * 10) / 10;

// the cell offsets within r, nearest first, then most along the heading,
// then a fixed order (x, then y, then z), so the same input gives the same list
const ordering = (r, heading) => {
  const [hx, hy, hz] = heading || [0, 0, 0];
  const list = [];
  for (let dz = -r; dz <= r; dz++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const d2 = dx * dx + dy * dy + dz * dz;
        const align = !heading ? 0 : d2 === 0 ? Infinity : (dx * hx + dy * hy + dz * hz) / Math.sqrt(d2);
        list.push([dx, dy, dz, d2, align]);
      }
  list.sort((a, b) => a[3] - b[3] || b[4] - a[4] || a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  return list;
};

export function createChunkGrid3({ size, radius, inFlight = 8, hysteresis = 1 }) {
  const cache = new Map(); // 'cx,cy,cz,r,heading' → Key[]
  let centre = null; // [cx, cy, cz] of the last update

  const within = (key, r) => {
    if (!centre) return false;
    const [x, y, z] = parse(key);
    return Math.max(Math.abs(x - centre[0]), Math.abs(y - centre[1]), Math.abs(z - centre[2])) <= r;
  };

  const grid = {
    loaded: new Set(),
    flying: new Map(), // key → gen
    gen: 0,
    radius,
    size,

    // (+ 0: a ship at -0 is in cell 0, not -0)
    cellOf(x, y, z) {
      return [Math.floor(x / grid.size) + 0, Math.floor(y / grid.size) + 0, Math.floor(z / grid.size) + 0];
    },

    cells(x, y, z, { radius: r = grid.radius, heading = null } = {}) {
      const [cx, cy, cz] = grid.cellOf(x, y, z);
      const h = heading ? heading.map(tenth) : null;
      const id = `${cx},${cy},${cz},${r},${h ? h.join(',') : '-'}`;
      let keys = cache.get(id);
      if (keys) return keys;
      keys = ordering(r, h).map(([dx, dy, dz]) => keyOf(cx + dx, cy + dy, cz + dz));
      if (cache.size >= 64) cache.clear();
      cache.set(id, keys);
      return keys;
    },

    update({ x, y, z, heading = null, radius: r }) {
      if (r !== undefined) grid.radius = r;
      centre = grid.cellOf(x, y, z);
      const cancel = [];
      for (const key of grid.flying.keys()) if (!within(key, grid.radius)) cancel.push(key);
      for (const key of cancel) grid.flying.delete(key);
      const drop = [];
      for (const key of grid.loaded) if (!within(key, grid.radius + hysteresis)) drop.push(key);
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
      if (ours && gen === grid.gen && within(key, grid.radius)) {
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

// The world's placed things (the buildings, huts and props put one by one:
// placer.js's `chunked`) on a grid of cells (lib/three/chunks), so their
// pictures and shaders go onto the graphics chip a cell at a time before the
// world is shown, not on the frame you first walk up to them, and so a cell
// out past the fog isn't drawn.
//
// Behind the veil or the dive the prepare readies every cell (prepareAll):
// each one's loads waited for (a model's far-off light copy too, which
// otherwise comes in later and is sent on the frame it's first drawn), then
// handed to `prepareCell`. If the prepare is cut short, the cells left are
// readied a step at a time ahead of the walker (update), and until then
// they're drawn as they are (the frame guard holds back what isn't up).
//
// A cell is hidden only once it's ready and past the draw range, and only
// once `hold()` lets go (the floor's light is baked from everything there,
// and a kept bake is keyed by what's shown). A thing holding a light (a
// hut's lamp) is never hidden: the count of lights is in every shader, so
// hiding one would have every material on screen made again.
//
// createThingCells({ entries, size, near, far, prepareCell, hold }) →
// { update(position, heading), prepareAll(onProgress, alive), stats(), dispose() }
//   entries: [{ x, z, done (promise: its object is in), object, low (a
//   promise: its light copy is in, or null) }]

import { cellKey, cellOf, createChunks } from '../../../lib/three/chunks';
import { settle } from '../../../lib/settle';

// how long a cell's loads are waited for: all the cells' together, in the
// prepare; each cell's own, readied while you walk
export const LOAD_HOLD = 6000; // ms
const WALK_HOLD = 4000; // ms
const NEAR_MIN = 220; // metres: never hidden nearer than this

// cells about a sixth of the way the world reaches, no smaller than 48 m
export const cellSizeOf = (reach) => Math.max(48, Math.round(reach / 6));

// Drawn out to where the fog (exponential, squared) leaves 3% of a thing
// showing, never nearer than NEAR_MIN and no further than the world's
// width; shown until a cell further out than that (so one on the edge
// doesn't flicker).
export function drawRange(density, size, reach) {
  const fogged = density > 0 ? Math.sqrt(-Math.log(0.03)) / density : Infinity;
  const near = Math.min(Math.max(NEAR_MIN, fogged), 4 * reach);
  return { near, far: near + size };
}

export function createThingCells({ entries, size, near, far, prepareCell, hold = () => false, now = () => Date.now() }) {
  const byKey = new Map();
  for (const e of entries) {
    const { ix, iz } = cellOf(e.x, e.z, size);
    const key = cellKey(ix, iz);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(e);
  }
  const keys = [...byKey.keys()];
  let deadline = null; // (the prepare's: when its loads stop being waited for)
  const wait = () => (deadline === null ? WALK_HOLD : Math.max(0, deadline - now()));

  const chunks = createChunks({
    size,
    near,
    far,
    cells: keys,
    ahead: size,
    budget: 1,
    async build(key) {
      const list = byKey.get(key);
      await settle(Promise.all(list.map((e) => e.done)), wait());
      // (a light copy is asked for once its full model is in)
      const lows = list.map((e) => e.low).filter(Boolean);
      if (lows.length) await settle(Promise.all(lows), wait());
      return { objects: list.map((e) => e.object).filter(Boolean), dispose() {} };
    },
    prepare: (handle) => prepareCell(handle.objects),
  });

  // (whether a thing holds a light: asked each time it would be hidden
  // until one's found, since a light can be added to it later; a thing
  // that's hidden isn't asked again until it's shown and goes out once more)
  const lit = new WeakSet();
  const holdsLight = (o) => {
    if (lit.has(o)) return true;
    let found = false;
    o.traverse?.((x) => (found ||= Boolean(x.isLight)));
    if (found) lit.add(o);
    return found;
  };

  let shown = 0;
  return {
    update(position, heading) {
      chunks.update(position, heading);
      if (hold()) return;
      const ready = new Set(chunks.cells());
      shown = 0;
      for (const [key, list] of byKey) {
        const on = !ready.has(key) || chunks.visible(key);
        if (on) shown++;
        for (const e of list) if (e.object && e.object.visible !== on && (on || !holdsLight(e.object))) e.object.visible = on;
      }
    },
    async prepareAll(onProgress, alive = () => true) {
      deadline = now() + LOAD_HOLD;
      try {
        await chunks.prepareAll(onProgress, alive);
      } finally {
        deadline = null;
      }
    },
    stats: () => ({ cells: keys.length, ready: chunks.cells().length, shown, size, near, far }),
    dispose: () => chunks.dispose(),
  };
}

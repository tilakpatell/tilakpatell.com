// What is still on its way into the world that's up after the world is
// shown (lane L1, docs/superpowers/specs/2026-10-11-desktop-picture-design.md
// §2.2): a part that streams in behind the first frame says so here, and
// the runtime holds its quality governor while anything does and for three
// seconds after (quality.js's `loading`), since a loading hitch says
// nothing of the graphics chip. A game level is the case: its far list,
// cells, maps and shapes arrive over a minute or more on the main thread
// (surface/level), and the frame gaps of that minute floored the pace and
// held an RTX 5090 at high.
//
// Each part asks to be asked (`still()` → true while it is arriving), so
// nothing has to be told when it is done; done() lets go of it at its
// dispose, and one that throws is let go.
//
//   createArrivals() → { add(still) → done, any() → boolean, size }
//   arriving(still) → done: on the page's one list, which index.js hands
//     the runtime (`arrivals.any`)

export function createArrivals() {
  const asks = new Set();
  return {
    add(still) {
      asks.add(still);
      return () => asks.delete(still);
    },
    any() {
      let busy = false;
      for (const still of asks) {
        try {
          if (still()) busy = true;
        } catch {
          asks.delete(still);
        }
      }
      return busy;
    },
    get size() {
      return asks.size;
    },
  };
}

export const arrivals = createArrivals();
export const arriving = (still) => arrivals.add(still);

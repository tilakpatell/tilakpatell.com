// The ship you fly's own model, made ahead: asked for as soon as the ship
// is known (the page, before the map's code has come), and handed to the
// map when it puts the ship in, so its fetch and its parse run beside the
// map's rather than after it (./shipLoad.js builds them; scene.js's setShip
// takes them). Pure: the build is handed in.
//
// createSpares({ build }) → { want(kind), take(kind) → Promise<model | null>, has(kind) }
//   build(kind) → Promise<model | null>, or null for a kind with no model
//   want: one made ahead for `kind`, unless one is held already or one
//     taken is still on its way (the page asking after the map took it)
//   take: the one made ahead, handed over once (tried once more if it came
//     to nothing), or one made there and then; a failure is null, never a rejection
// One that fails or comes to nothing is forgotten, so the next ask tries again.

export function createSpares({ build }) {
  const held = new Map(); // kind → Promise<model | null>, made ahead and not yet taken
  const going = new Map(); // kind → how many taken are still on their way

  const make = (kind) => {
    const p = build(kind);
    return p ? Promise.resolve(p).catch(() => null) : null;
  };

  return {
    want(kind) {
      if (!kind || held.has(kind) || going.get(kind)) return;
      const p = make(kind);
      if (!p) return;
      held.set(kind, p);
      p.then((model) => {
        if (!model && held.get(kind) === p) held.delete(kind);
      });
    },
    take(kind) {
      // (one made ahead that came to nothing, a visit ago or just now: tried once more)
      const ahead = held.get(kind);
      held.delete(kind);
      const p = ahead ? ahead.then((model) => model ?? make(kind)) : make(kind);
      if (!p) return Promise.resolve(null);
      going.set(kind, (going.get(kind) ?? 0) + 1);
      p.then(() => going.set(kind, going.get(kind) - 1));
      return p;
    },
    has: (kind) => held.has(kind),
  };
}

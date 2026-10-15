// The worlds' everyday people from Star Wars Battlefront II (2017): where a
// world places a `villager` (or a farmer, a caretaker, Jocasta, Zam), the
// game's own civilians stand in, one of a few by the figure's number, so a
// street is not one person many times: the city's (Vardos's, the campaign's
// Imperial city) on Coruscant and Bespin. Mos Eisley's and Theed's crowds
// are coloured from palettes the bucket hasn't yet (cast.md), so Tatooine
// and Naboo keep their own until it has. A world with no pool keeps the
// built figure. The kinds' names do not change: the pool is asked at the
// moment a figure is made (actors.js), and a pooled kind that won't load
// falls back to the one the world named.
//
//   POOLS: { world id: [kind…] }; POOLED: the kinds a pool takes over
//   poolFor(kind, world, i) → the kind to draw                 (pure)

export const POOLS = {
  coruscant: ['civcity1', 'civcity3'],
  bespin: ['civcity1', 'civcity3'],
};

const POOLED = new Set(['villager', 'farmer', 'caretaker', 'jocasta', 'zam']);

export function poolFor(kind, world, i = 0) {
  const pool = POOLED.has(kind) ? POOLS[world] : null;
  if (!pool?.length) return kind;
  // (the entry's figures in turn, a kind's own offset so two entries don't start alike)
  let h = 0;
  for (const c of kind) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return pool[(h + i) % pool.length];
}

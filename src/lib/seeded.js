// A seeded random, so what's scattered is the same every visit: the Shire's (middleearth/shire/rules.js), copied so a page needn't load the Shire for it.
export function seeded(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A stream per name, so an agent's randomness is its own and not whatever was
// left after everyone who spawned before it drew: `fork('npc:vader')` is the
// same sequence whichever order the world made its agents in, and the same
// again next visit with the same seed. Each fork is a fresh generator, so two
// forks of one label draw the same numbers and never share a position.
//
//   hash(seed, label) → an unsigned 32-bit int: FNV-1a over the seed's four
//     bytes, then the label's UTF-16 units (one round per unit, so a label
//     outside Latin-1 still hashes every bit of it)
//   streams(seed) → { seed, fork(label) → rand }, fork = seeded(hash(seed, label))
export function hash(seed, label) {
  let h = 0x811c9dc5;
  const s = seed | 0;
  for (let i = 0; i < 4; i++) {
    h ^= (s >>> (i * 8)) & 0xff;
    h = Math.imul(h, 0x01000193);
  }
  const text = String(label);
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function streams(seed) {
  return { seed, fork: (label) => seeded(hash(seed, label)) };
}

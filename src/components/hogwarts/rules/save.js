// The world’s one save, under `tp-hogwarts` through rt.saves (the design’s
// §3: nothing else’s key is written). One object with a version: the
// Sorting writes its keys here, and every later lane adds its own beside
// them (the term, the points, the quests, the cards), never a second key.
// A key a later version doesn’t know is kept as it was. Pure.
//
//   SAVE: { key, version }   (rt.saves.register(SAVE) wraps it as { v, data })
//   blank() → the save before anything has happened
//   migrate(old, version) → the save at SAVE.version (rt.saves calls it)
//   withSorting(save, { answers, result, wand, now }) → the save, sorted
//   withArrival(save) → the save, the arrival seen once more
//   houseOf(save) → the house id, or null before the Sorting

export const SAVE = { key: 'tp-hogwarts', version: 1 };

export const blank = () => ({ house: null, wand: null, sorted: null, answers: null, password: null, arrived: 0 });

const isObject = (o) => Boolean(o) && typeof o === 'object' && !Array.isArray(o);

export function migrate(old) {
  // (version 0 is whatever was there before the key was registered: kept, under the blank’s defaults)
  return { ...blank(), ...(isObject(old) ? old : {}) };
}

export function withSorting(save, { answers, result, wand, now }) {
  return { ...migrate(save), house: result.house, wand: { wood: wand.wood, core: wand.core, inches: wand.inches, flex: wand.flex, said: wand.said }, sorted: now, answers: [...answers], password: result.password };
}

export const withArrival = (save) => ({ ...migrate(save), arrived: (migrate(save).arrived ?? 0) + 1 });

export const houseOf = (save) => (isObject(save) && typeof save.house === 'string' ? save.house : null);

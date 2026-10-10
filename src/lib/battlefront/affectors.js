// Frostbite's affectors, translated (spec catalogue 3 and 8): a stack of
// property modifiers on an entity (max health, regen, damage, speed, heat),
// each `set`, `mul` or `add`, optionally until a time. A property resolves
// as the game's max health does, the base times the multipliers plus the
// adds, and a `set` (the last applied) overrides them all. Pure.
//
//   createStack() → stack
//   apply(stack, { id, property, op: 'set' | 'mul' | 'add', value, until? })  (same id replaces)
//   remove(stack, id)                     (a RemoveAffector)
//   tick(stack, now)                      (drops the entries whose `until` has passed)
//   resolve(stack, property, base) → number

export const createStack = () => ({ entries: [] });

export function apply(stack, entry) {
  remove(stack, entry.id);
  stack.entries.push({ ...entry });
}

export function remove(stack, id) {
  const i = stack.entries.findIndex((e) => e.id === id);
  if (i >= 0) stack.entries.splice(i, 1);
}

export function tick(stack, now) {
  stack.entries = stack.entries.filter((e) => e.until == null || e.until > now);
}

export function resolve(stack, property, base) {
  let mul = 1;
  let add = 0;
  let set = null;
  for (const e of stack.entries) {
    if (e.property !== property) continue;
    if (e.op === 'mul') mul *= e.value;
    else if (e.op === 'add') add += e.value;
    else if (e.op === 'set') set = e.value;
  }
  return set ?? base * mul + add;
}

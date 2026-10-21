// The powers each crew carries, as picked in the Hangar's Powers (`tp-powers`,
// versioned, through runtime/saves.js): { [crew]: { primary?, ultimate? } },
// a power's id in a slot. Shape only: what a crew may carry is shipPowers.js's
// picksFor, with the skill tree's borrowed pairs, so a pick that's no longer
// allowed (after a reset) is the crew's own again without being lost. Pure,
// tested.
//
//   POWERS_KEY, POWERS_VERSION
//   readPicks(raw) → picks
//   setPick(picks, crew, slot, id | null) → new picks

export const POWERS_KEY = 'tp-powers';
export const POWERS_VERSION = 1;
const CREWS = ['xwing', 'falcon', 'cruiser', 'rv'];
const SLOTS = ['primary', 'ultimate'];
const isId = (v) => typeof v === 'string' && v.length > 0 && v.length <= 40;
const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

export function readPicks(raw) {
  let v = raw;
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw);
    } catch {
      v = null;
    }
  }
  const out = {};
  if (!isObject(v)) return out;
  for (const crew of CREWS) {
    if (!isObject(v[crew])) continue;
    const e = {};
    for (const s of SLOTS) if (isId(v[crew][s])) e[s] = v[crew][s];
    if (Object.keys(e).length) out[crew] = e;
  }
  return out;
}

export function setPick(picks, crew, slot, id) {
  if (!CREWS.includes(crew) || !SLOTS.includes(slot)) return picks;
  const e = { ...(picks?.[crew] ?? {}) };
  if (id === null) delete e[slot];
  else if (isId(id)) e[slot] = id;
  const out = { ...picks };
  if (Object.keys(e).length) out[crew] = e;
  else delete out[crew];
  return out;
}

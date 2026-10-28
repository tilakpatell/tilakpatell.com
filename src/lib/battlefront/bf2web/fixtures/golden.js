// The comparison the bf2web/ tests make against bf2-web's native drivers
// (scripts/bf2web-golden.mjs wrote the fixtures). The C++ prints its floats
// with %.9g, which names one float32 exactly, so a number matches when the
// JavaScript's value is that same float32; a bool printed as 0 or 1 matches
// its JavaScript bool. The first difference is returned with its path, so a
// failing test says where the port left bf2-web.
//
//   differs(golden, ours, path = '') → null | 'path: golden vs ours'

const f = Math.fround;

export function differs(golden, ours, path = '') {
  if (typeof ours === 'boolean') ours = ours ? 1 : 0;
  if (typeof golden === 'number' && typeof ours === 'number') {
    if (golden === ours || f(golden) === f(ours)) return null;
    return `${path}: ${golden} vs ${ours}`;
  }
  if (golden === null || typeof golden !== 'object') return golden === ours ? null : `${path}: ${JSON.stringify(golden)} vs ${JSON.stringify(ours)}`;
  if (ours === null || typeof ours !== 'object') return `${path}: an object vs ${JSON.stringify(ours)}`;
  if (Array.isArray(golden) && (!Array.isArray(ours) || ours.length !== golden.length)) return `${path}: ${golden.length} items vs ${ours?.length}`;
  for (const key of Object.keys(golden)) {
    const d = differs(golden[key], ours[key], path ? `${path}.${key}` : key);
    if (d) return d;
  }
  return null;
}

// A driver script's lines as [verb, ...words], comments and blanks dropped
export const lines = (script) => script.map((l) => l.replace(/#.*/, '').trim()).filter(Boolean).map((l) => l.split(/\s+/));

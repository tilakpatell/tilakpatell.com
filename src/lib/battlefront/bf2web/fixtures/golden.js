// The comparison the bf2web/ tests make against bf2-web's native drivers
// (scripts/bf2web-golden.mjs wrote the fixtures). The C++ prints its floats
// with %.9g, which names one float32 exactly, so a number matches when the
// JavaScript's value is that same float32; a bool printed as 0 or 1 matches
// its JavaScript bool. The first difference is returned with its path, so a
// failing test says where the port left bf2-web.
//
// A number that went through sin, cos or pow may sit one float apart: the
// driver's libm isn't correctly rounded (glibc's sinf gives 0.47351712 for
// 0.4932797, a float under the true 0.47351713498), where JavaScript's
// Math.sin, rounded to a float, is. `ulps` allows that much for such a record.
//
//   differs(golden, ours, { ulps = 0 } = {}, path = '') → null | 'path: golden vs ours'

const f = Math.fround;
const view = new DataView(new ArrayBuffer(4));
const bitsOf = (x) => {
  view.setFloat32(0, x);
  const b = view.getInt32(0);
  return b < 0 ? -2147483648 - b : b;
};
export const ulpsApart = (a, b) => Math.abs(bitsOf(f(a)) - bitsOf(f(b)));

export function differs(golden, ours, opts = {}, path = '') {
  if (typeof ours === 'boolean') ours = ours ? 1 : 0;
  if (typeof golden === 'number' && typeof ours === 'number') {
    if (golden === ours || f(golden) === f(ours) || ulpsApart(golden, ours) <= (opts.ulps ?? 0)) return null;
    return `${path}: ${golden} vs ${ours}`;
  }
  if (golden === null || typeof golden !== 'object') return golden === ours ? null : `${path}: ${JSON.stringify(golden)} vs ${JSON.stringify(ours)}`;
  if (ours === null || typeof ours !== 'object') return `${path}: an object vs ${JSON.stringify(ours)}`;
  if (Array.isArray(golden) && (!Array.isArray(ours) || ours.length !== golden.length)) return `${path}: ${golden.length} items vs ${ours?.length}`;
  for (const key of Object.keys(golden)) {
    const d = differs(golden[key], ours[key], opts, path ? `${path}.${key}` : key);
    if (d) return d;
  }
  return null;
}

// A number as the driver's %.<d>f prints it (the float widened to double, then rounded)
export const fixed = (x, d) => Number(f(x).toFixed(d));

// A driver script's lines as [verb, ...words], comments and blanks dropped
export const lines = (script) => script.map((l) => l.replace(/#.*/, '').trim()).filter(Boolean).map((l) => l.split(/\s+/));

// What a test reads a shader's source against. GLSL ES keeps these words back
// for later, so a variable, a parameter or a field named one doesn't compile,
// though nothing fails until a browser links the program. A test in Node
// can't link it, so it reads the source for them instead.
//
// RESERVED          the words kept back (the list landmarks.test.js had)
// reservedIn(src) → the ones src names something with, in RESERVED's order
//                   ([] when it names none)

export const RESERVED = Object.freeze(['half', 'fixed', 'input', 'output', 'sample', 'filter', 'sizeof', 'cast', 'namespace', 'using', 'common', 'partition', 'active', 'superp', 'hvec2', 'hvec3', 'hvec4', 'fvec2', 'fvec3', 'fvec4', 'long', 'short', 'double', 'unsigned', 'external', 'interface', 'union', 'enum', 'typedef', 'template', 'this', 'goto', 'inline', 'noinline', 'volatile', 'public', 'static', 'extern', 'asm']);

// (a name follows its type: a float, an int, a bool, a vector, a matrix or a sampler)
const TYPE = '(?:float|u?int|bool|[iub]?vec[234]|mat[234](?:x[234])?|[iu]?sampler\\w+)';

export function reservedIn(src) {
  const text = String(src ?? '');
  return RESERVED.filter((w) => new RegExp(`\\b${TYPE}\\s+${w}\\b`).test(text));
}

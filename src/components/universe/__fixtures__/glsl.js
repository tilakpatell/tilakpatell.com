// The GLSL checks the universe's tests share. Node can't compile a shader,
// but it can catch the one mistake a browser's compiler refuses that reads
// as fine: a variable named with a word GLSL ES keeps back for later.
//
// RESERVED: those words
// reservedIn(src) → the reserved words src declares a variable with, [] if none

// (GLSL ES keeps these back for later: a variable named one doesn't compile)
export const RESERVED = ['half', 'fixed', 'input', 'output', 'sample', 'filter', 'sizeof', 'cast', 'namespace', 'using', 'common', 'partition', 'active', 'superp', 'hvec2', 'hvec3', 'hvec4', 'fvec2', 'fvec3', 'fvec4', 'long', 'short', 'double', 'unsigned', 'external', 'interface', 'union', 'enum', 'typedef', 'template', 'this', 'goto', 'inline', 'noinline', 'volatile', 'public', 'static', 'extern', 'asm'];

export const reservedIn = (src) =>
  RESERVED.filter((w) => new RegExp(`\\b(float|int|bool|vec[234]|mat[234])\\s+${w}\\b`).test(src));

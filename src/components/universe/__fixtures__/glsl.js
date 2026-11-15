// GLSL ES keeps these words back for later: a variable named one doesn't
// compile. reservedIn(src) lists those a shader declares a variable with.
export const RESERVED = ['half', 'fixed', 'input', 'output', 'sample', 'filter', 'sizeof', 'cast', 'namespace', 'using', 'common', 'partition', 'active', 'superp', 'hvec2', 'hvec3', 'hvec4', 'fvec2', 'fvec3', 'fvec4', 'long', 'short', 'double', 'unsigned', 'external', 'interface', 'union', 'enum', 'typedef', 'template', 'this', 'goto', 'inline', 'noinline', 'volatile', 'public', 'static', 'extern', 'asm'];

export const reservedIn = (src) => RESERVED.filter((w) => new RegExp(`\\b(float|int|bool|vec[234]|mat[234])\\s+${w}\\b`).test(src));

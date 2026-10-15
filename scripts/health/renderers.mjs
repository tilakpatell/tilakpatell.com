// One renderer (the engine floor’s §2): the runtime makes the node renderer,
// WebGPU first and WebGL 2 under it, and nothing else makes one. Each world
// or tool that still builds its own is a site here; a port onto the runtime
// removes it, and the ratchet keeps it gone.
// Design: docs/superpowers/specs/2026-10-15-engine-floor-design.md, §4.6.
import { metric } from './context.mjs';
import { isTest, uncomment } from './graph.mjs';

// the runtime’s own renderer is the one allowed. A path ending in / is a folder
export const EXEMPT = ['src/runtime/'];

export const RE = /\bnew\s+(?:THREE\.)?(?:WebGLRenderer|WebGPURenderer)\s*\(/g;

// a string that spells a constructor (a log line, a test’s expectation) makes
// no renderer: blank quoted text after the comments, as uncomment blanks those.
// A template is left whole, since its ${} holds code. The pass pairs quotes
// on a line without knowing regex literals or JSX text, so a lone apostrophe
// there could hide a constructor on the same line: none in src/ today
const QUOTED = /'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g;
export const unquote = (code) => code.replace(QUOTED, (s) => `${s[0]}${s[0]}`);

const exempt = (rel) => EXEMPT.some((e) => (e.endsWith('/') ? rel.startsWith(e) : rel === e));

export default async function renderers(ctx) {
  const detail = [];
  let total = 0;
  for (const p of ctx.src) {
    const rel = ctx.rel(p);
    if (isTest(p) || exempt(rel)) continue;
    const n = (unquote(uncomment(await ctx.read(p))).match(RE) ?? []).length;
    if (!n) continue;
    total += n;
    detail.push({ file: rel, n });
  }
  return metric({ id: 'renderers', label: 'renderer constructors outside the runtime', unit: 'sites', value: total, detail });
}

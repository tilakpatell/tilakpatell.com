// One loop (the engine floor’s §2): the runtime asks the browser for frames
// and steps every world inside them. A file that calls requestAnimationFrame
// itself runs a second clock beside it; each such file counts once, however
// often it asks, and a port onto the runtime’s loop removes it.
// Design: docs/superpowers/specs/2026-10-15-engine-floor-design.md, §4.6.
import { metric } from './context.mjs';
import { isTest, uncomment } from './graph.mjs';
import { unquote } from './renderers.mjs';

// the runtime, the classic pages’ shared loop and the loop a shown element
// runs while on screen: the three allowed clocks. A path ending in / is a folder
export const EXEMPT = ['src/runtime/', 'src/lib/three/loop.js', 'src/lib/shownLoop.js'];

// a cancelAnimationFrame alone stops a loop and starts none; a quoted name
// starts none either
const RE = /\brequestAnimationFrame\s*\(/;

const exempt = (rel) => EXEMPT.some((e) => (e.endsWith('/') ? rel.startsWith(e) : rel === e));

export default async function loops(ctx) {
  const detail = [];
  for (const p of ctx.src) {
    const rel = ctx.rel(p);
    if (isTest(p) || exempt(rel)) continue;
    if (RE.test(unquote(uncomment(await ctx.read(p))))) detail.push({ file: rel, n: 1 });
  }
  return metric({ id: 'loops', label: 'frame loops outside the runtime', unit: 'files', detail });
}

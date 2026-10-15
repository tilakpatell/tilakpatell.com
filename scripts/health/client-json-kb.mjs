// A record a world reads is a slice (the engine floor’s §1.6): a .json
// imported statically becomes a JavaScript object literal in the chunk, so
// every visitor’s engine parses it as code before the first frame. Each
// distinct file over FLOOR read by the client counts its whole kilobytes
// once; a ?url or ?raw import is a fetch the browser’s JSON parser reads, and
// a script or a test is not the client. The id ends in -kb so ratchet()
// rounds the budget up to the next 5 kB.
// Design: docs/superpowers/specs/2026-10-15-engine-floor-design.md, §4.6.
import { stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { metric } from './context.mjs';
import { isTest, uncomment } from './graph.mjs';

export const FLOOR = 65536;

// `import x from './a.json'` and `import './a.json'`, relative, with no query
const IMPORT = /\bimport\s*(?:[^'"`;]*?\bfrom\s*)?(['"])(\.\.?\/[^'"?]+\.json)\1/g;

export default async function clientJson(ctx) {
  const seen = new Map(); // the record’s path → { n, by }
  for (const p of ctx.src) {
    if (isTest(p)) continue;
    for (const [, , spec] of uncomment(await ctx.read(p)).matchAll(IMPORT)) {
      const file = resolve(dirname(p), spec);
      if (seen.has(file)) continue;
      const size = await stat(file).then((s) => s.size, () => 0);
      seen.set(file, { size, by: ctx.rel(p) });
    }
  }
  const detail = [...seen]
    .filter(([, { size }]) => size > FLOOR)
    .map(([file, { size, by }]) => ({ file: ctx.rel(file), n: Math.ceil(size / 1024), note: by }));
  const value = detail.reduce((sum, d) => sum + d.n, 0);
  return metric({ id: 'client-json-kb', label: 'records over 64 KB parsed as JavaScript', unit: 'kB', value, detail });
}

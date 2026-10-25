import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FROM, SIDE_EFFECT, resolve, uncomment } from '../../../../scripts/health/graph.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
// every file a source reaches by static imports, so loads with it whichever chunk it lands in (import() is another chunk, later)
async function reach(entry) {
  const seen = new Set([ROOT + entry]);
  for (const f of seen) {
    const text = uncomment(readFileSync(f, 'utf8'));
    for (const m of [...text.matchAll(FROM), ...text.matchAll(SIDE_EFFECT)]) for (const to of await resolve(m[2], f)) if (/\.jsx?$/.test(to)) seen.add(to);
  }
  return [...seen].map((f) => f.slice(ROOT.length));
}
const GENERATOR = /^src\/components\/expanse\/gen\/(space|sector|systems|things|stations|tables|names|keepOuts|grid|job)\.js$|^src\/components\/universe\/places\/(resolve|cards)\.js$/;

// (nav.js itself; ⌘K, preloaded on every page; the home page's lower half, which reaches nav.js
// through the mini-map once lane 6a's is merged: Task 14 adds it to LOADS_NAV then)
const LOADS_NAV = ['src/components/universe/nav.js', 'src/components/CommandPalette.jsx'];
describe('the generator stays off every page that loads nav.js', () => {
  it.each([...LOADS_NAV, 'src/components/interests/Interests.jsx'])('%s reaches none of it', async (entry) => {
    expect((await reach(entry)).filter((f) => GENERATOR.test(f))).toEqual([]);
  });
  it.each(LOADS_NAV)('%s loads nav.js, so the check above means something', async (entry) => {
    expect(await reach(entry)).toContain('src/components/universe/nav.js');
  });
  // (with park.js on its imports ⌘K grew by 2.14 kB gzipped, past the 2 kB
  // these pages may grow by: so the caller's lookup brings the park)
  it('leaves the park to the lookup nav.js is handed', async () => {
    expect(await reach('src/components/universe/nav.js')).not.toContain('src/components/universe/places/park.js');
  });
});

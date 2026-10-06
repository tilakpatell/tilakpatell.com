// Lists every line the crews say that has no recording of its own, for
// generate.py to make in the speaker's voice: `npm run voices:lines` (it runs
// under vite-node, which reads the site's modules the way Vite does).
// Writes scripts/voices/lines.json: [{ id, who, text }], one per distinct line,
// with the same id the site looks it up by (src/lib/voiced.js).

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CREWS } from '../../src/components/universe/crews';
import { GALAXY_LINES } from '../../src/components/galaxy/lines';
import { VEHICLES } from '../../src/components/cockpit/vehicles';
import { lineId } from '../../src/lib/voiced';

// who has a voice to make (Artoo and Chewie don't speak Basic, and 'comms'
// is anybody on the radio)
export const VOICED = ['rick', 'morty', 'luke', 'han', 'walt', 'jesse', 'hank'];

const isLine = (v) => Array.isArray(v) && typeof v[0] === 'string' && typeof v[1] === 'string' && v.length <= 3 && v.every((x) => typeof x === 'string');

export function unrecorded(sources) {
  const found = new Map();
  const walk = (v) => {
    if (isLine(v)) {
      const [who, text, clip] = v;
      if (!clip && VOICED.includes(who)) found.set(lineId(who, text), { id: lineId(who, text), who, text });
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  sources.forEach(walk);
  return [...found.values()].sort((a, b) => a.who.localeCompare(b.who) || a.text.localeCompare(b.text));
}

const lines = unrecorded([CREWS, GALAXY_LINES, VEHICLES.map((v) => v.lines)]);
const out = join(dirname(fileURLToPath(import.meta.url)), 'lines.json');
writeFileSync(out, `${JSON.stringify(lines, null, 1)}\n`);
const count = lines.reduce((n, l) => ({ ...n, [l.who]: (n[l.who] ?? 0) + 1 }), {});
const by = Object.entries(count).map(([who, n]) => `${who} ${n}`);
console.log(`${lines.length} lines without a recording (${by.join(', ')}) -> scripts/voices/lines.json`);

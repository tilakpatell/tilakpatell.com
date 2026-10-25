import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8'); // (from src/)
// the flight HUD's parts a player reads: the overlay, the cluster's own blocks, the altitude and the law's strip
const PART = /\.(universe-(hud|lock|nav|mate|wanted|alt)|fc-(target|speed|kills|none|sub|ship|buff))[\w-]*/;
const rules = (p) => [...read(p).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, s, b]) => ({ sel: s.trim(), decls: b.split(';').map((d) => d.trim()).filter(Boolean) }));
const small = (d) => {
  const m = /^font-size:\s*([\d.]+)rem/.exec(d);
  return m && Number(m[1]) < 0.7;
};

describe('the flight HUD’s words', () => {
  it.each(['components/universe/universe.css', 'components/universe/hud.css', 'components/universe/thumbs.css', 'components/galaxy/flight.css', 'runtime/hud/flight/flight.css'])('are 0.7 rem at least in %s', (p) => {
    expect(rules(p).filter((r) => PART.test(r.sel) && r.decls.some(small)).map((r) => `${r.sel}: ${r.decls.find(small)}`)).toEqual([]);
  });
});

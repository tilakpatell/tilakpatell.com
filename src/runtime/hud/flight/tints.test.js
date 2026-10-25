import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8'); // (from src/)
// the flight HUD's parts: the overlay's and the cluster's own blocks
const FLIGHT = [...'hud reticle foot-reticle lock lock-name lock-dist lock-hp lead nav nav-name nav-dist threat mate mate-name'.split(' ').map((c) => `universe-${c}`), ...'radar ship sub speed speed-n speed-lead speed-icon kills-n target target-name target-dist target-hp none shield-icon'.split(' ').map((c) => `fc-${c}`)];
const NAMED = new RegExp(`\\.(${FLIGHT.join('|')})(?![\\w-])`);
const rules = (p) => [...read(p).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, s, b]) => ({ sel: s.trim(), decls: b.split(';').map((d) => d.trim()).filter(Boolean) }));

describe('the flight HUD’s tints', () => {
  it.each('universe/universe universe/hud universe/thumbs universe/desk galaxy/flight galaxy/galaxy'.split(' '))('%s sets only custom properties on the flight parts', (p) => {
    expect(rules(`components/${p}.css`).filter((r) => NAMED.test(r.sel) && r.decls.some((d) => !d.startsWith('--'))).map((r) => r.sel)).toEqual([]);
  });
  it('the galaxy wears the Battlefront face', () => {
    expect(rules('components/galaxy/flight.css').find((r) => r.sel === '.galaxy-page').decls).toEqual(expect.arrayContaining(['--hud-flight-face: var(--font-bf-hud, var(--font-mono))', '--hud-key-face: var(--font-bf-hud, var(--font-mono))']));
  });
  it('the kit takes its face and reticle line from the world', () => {
    for (const p of ['runtime/hud/cluster.css', 'runtime/hud/flight/flight.css']) expect(read(p)).toContain('font-family: var(--hud-flight-face, var(--font-mono))');
    expect(read('runtime/hud/flight/flight.css')).toContain('border: var(--hud-reticle-line, 1.5px) solid');
  });
});

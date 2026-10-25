import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GunChip, OtherMortys } from './RmHud';
import { firstHint } from './portalGun';

// (on a phone, under 640 px, world.css hides a chip's words, upright all but the portal gun's: what's left is its icon and its name)
describe('C-137’s HUD', () => {
  it('gives the online chip a name and an icon of its own, off and on', () => {
    const off = renderToStaticMarkup(<OtherMortys trav={{ available: true, on: false, join: () => {} }} where="in the street" />);
    expect(off).toMatch(/aria-label="[^"]*other Mortys[^"]*"/);
    expect(off).toContain('<svg');
    const on = renderToStaticMarkup(<OtherMortys trav={{ available: true, on: true, count: 2 }} where="in the street" />);
    expect(on).toMatch(/aria-label="2 other Mortys in the street"/);
    expect(on).toContain('<svg');
    expect(renderToStaticMarkup(<OtherMortys trav={{ available: true, on: true, count: 1 }} where="here" />)).toMatch(/aria-label="1 other Morty here"/);
  });

  it('keeps the portal gun chip’s word on a phone held upright, where the first hint names it', () => {
    // (world.css's phone layout, its media block's braces counted to its close; held sideways, the
    // row beside the map has no room for any chip's words)
    const css = readFileSync(new URL('./world.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const open = css.indexOf('{', css.indexOf('@media (max-width: 639px)'));
    let end = open;
    for (let depth = 0; end < css.length; end++) if (!(depth += css[end] === '{' ? 1 : css[end] === '}' ? -1 : 0)) break;
    const phone = css.slice(open + 1, end);
    const hides = [...phone.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, , body]) => /display:\s*none/.test(body)).flatMap(([, sel]) => sel.split(',').map((s) => s.trim())).filter((s) => /^\.rm-chip\S* span$/.test(s));
    expect(hides).toHaveLength(1);
    for (const s of hides) expect(s).toContain(':not(.rm-chip-gun)');
    // the chip: its word, the one the touch hint names, and no key on a touch screen
    const chip = renderToStaticMarkup(<GunChip touch onOpen={() => {}} />);
    expect(chip).toMatch(/class="rm-chip rm-chip-gun"/);
    expect(chip).toContain('<span>Portal gun</span>');
    expect(chip).not.toContain('<kbd>');
    expect(firstHint({ touch: true })).toContain('The Portal gun button, up top');
    expect(renderToStaticMarkup(<GunChip onOpen={() => {}} />)).toContain('<kbd>P</kbd>');
  });
});

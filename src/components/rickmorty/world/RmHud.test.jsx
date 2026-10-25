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

  it('gives its controls a finger’s 44 px on a touch screen: the chips, the list’s close and ways back, the dial’s close', () => {
    // (world.css's blocks, each one's braces counted to its close; RULES UI 2: a hit area may be wider than what's drawn)
    const css = readFileSync(new URL('./world.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const blockOf = (query) => {
      const at = css.indexOf(query);
      if (at < 0) return '';
      const open = css.indexOf('{', at);
      let end = open;
      for (let depth = 0; end < css.length; end++) if (!(depth += css[end] === '{' ? 1 : css[end] === '}' ? -1 : 0)) break;
      return css.slice(open + 1, end);
    };
    const rule = (block, sel) =>
      [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .filter(([, s]) => s.split(',').map((x) => x.trim()).includes(sel))
        .map(([, , body]) => body)
        .join(';');
    const px = (body, prop) => Number(body.match(new RegExp(`(?:^|[;{\\s])${prop}:\\s*(-?\\d+)px`))?.[1] ?? NaN);
    const touch = blockOf('@media (pointer: coarse) {');
    // a chip, drawn 36 px on a phone: its hit area 4 px over and under it (the column's gap is 8, so it doesn't reach the next)
    expect(rule(touch, '.rm-chip')).toMatch(/position:\s*relative/);
    expect(rule(touch, '.rm-chip::after')).toMatch(/inset:\s*-4px 0/);
    expect(px(rule(blockOf('@media (max-width: 639px)'), '.rm-chip'), 'min-height') + 2 * 4).toBeGreaterThanOrEqual(44);
    // the list's close and the dial's, 44 square; the list's ways back (stacked too close for a wider hit area), 44 tall
    for (const sel of ['.rm-icon-btn', '.rm-dial-x']) {
      expect(px(rule(touch, sel), '(?:min-)?width'), sel).toBeGreaterThanOrEqual(44);
      expect(px(rule(touch, sel), '(?:min-)?height'), sel).toBeGreaterThanOrEqual(44);
    }
    expect(px(rule(touch, '.rm-list-back'), 'min-height')).toBeGreaterThanOrEqual(44);
  });
});

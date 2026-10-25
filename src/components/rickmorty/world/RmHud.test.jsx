import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OtherMortys } from './RmHud';

// (on a phone, under 640 px, world.css hides a chip's words: what's left is its icon and its name)
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
});

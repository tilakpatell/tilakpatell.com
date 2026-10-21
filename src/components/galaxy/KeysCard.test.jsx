import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import KeysCard from './KeysCard';
import { GROUPS } from './keyRows';
import { PAGES } from '../guide/pages';
import { keyTokens } from '../guide/keys';

describe('KeysCard', () => {
  it('lists the keys in three groups, with a close button', () => {
    const html = renderToStaticMarkup(<KeysCard open onClose={() => {}} />);
    for (const h of ['Fly', 'Fight', 'Travel']) expect(html).toContain(`<h3>${h}</h3>`);
    expect(html).toContain('<kbd class="hud-cap">J</kbd>');
    expect(html).toContain('aria-label="Close the keys"');
  });
  it('has the Hangar’s keys among the travel ones', () => {
    const html = renderToStaticMarkup(<KeysCard open onClose={() => {}} />);
    expect(html).toContain('<kbd class="hud-cap">H</kbd>');
    expect(html).toContain('Hangar');
    expect(html).toContain('<kbd class="hud-cap">C</kbd>');
  });
  it('has the three lines’ keys among the fight ones, as the universe map has them', () => {
    const html = renderToStaticMarkup(<KeysCard open onClose={() => {}} />);
    for (const k of ['R', '1', '2', '3']) expect(html).toContain(`<kbd class="hud-cap">${k}</kbd>`);
    expect(html).toContain('Weapons');
  });
  it('is nothing when shut', () => {
    expect(renderToStaticMarkup(<KeysCard open={false} onClose={() => {}} />)).toBe('');
  });
  it('has only keys the guide lists for the galaxy', () => {
    // (the guide, pages.js, is where the keys are written out; the card is a few of them)
    const guide = new Set();
    for (const group of PAGES['/galaxy'].keys) for (const [keys] of group.rows) for (const t of keyTokens(keys)) if (t.key) guide.add(t.key.toUpperCase());
    const missing = [];
    for (const [, rows] of GROUPS)
      for (const [keys] of rows)
        for (const k of keys.split(' ')) if (!guide.has(k === 'Arrows' ? '←' : k.toUpperCase())) missing.push(k);
    expect(missing).toEqual([]);
  });
});

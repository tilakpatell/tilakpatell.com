import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import HitMarker from './HitMarker';

describe('the hit marker', () => {
  it('draws the game’s four ticks, their white as the ink the page sets', () => {
    const html = renderToStaticMarkup(<HitMarker />);
    expect(html).toContain('surface-hitmark');
    expect(html).not.toContain('data-kill');
    expect((html.match(/<path /g) ?? []).length).toBe(8);
    expect((html.match(/fill="currentColor"/g) ?? []).length).toBe(4);
    expect(html).toContain('aria-hidden="true"');
  });
  it('marks a kill with the longer bars', () => {
    const html = renderToStaticMarkup(<HitMarker kill />);
    expect(html).toContain('data-kill="true"');
    expect(html).toContain('Crosshairs_MarkerKill');
  });
});

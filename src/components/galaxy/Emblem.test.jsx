import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Emblem from './Emblem';

describe('a side’s emblem', () => {
  it('draws the game’s faction icon from its sprite for a side the game has, in the colour it is given', () => {
    const html = renderToStaticMarkup(<Emblem side="empire" />);
    expect(html).toContain('class="holomap-emblem"');
    expect(html).toContain('<use href="/ui/bf2017/factions.svg#factions-icon-galacticempire"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('<path');
  });
  it('draws the site’s crest for a side the game lacks', () => {
    const html = renderToStaticMarkup(<Emblem side="hutt" className="holomap-emblem" />);
    expect(html).toContain('<path');
    expect(html).toContain('fill="currentColor"');
    expect(html).not.toContain('<use');
  });
  it('is nothing for nobody', () => {
    expect(renderToStaticMarkup(<Emblem side="nobody" />)).toBe('');
  });
});

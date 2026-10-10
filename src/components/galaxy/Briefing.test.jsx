import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Briefing from './Briefing';
import { briefingFor } from '../../lib/bf2017/films';

describe('a world’s briefing from the game’s campaign', () => {
  it('plays the campaign’s scenes set on the world, first scene first, skippable', () => {
    const n = briefingFor('endor').length;
    expect(n).toBeGreaterThan(1);
    const html = renderToStaticMarkup(<Briefing system="endor" name="Endor" />);
    expect(html).toContain(`Scene 1 of ${n}`);
    expect(html).toContain('a1-m0lib-ds01-s0100-fmv.webp');
    expect(html).toContain('Skip to the next scene');
    expect(html).toContain('Close the briefing');
  });

  it('draws nothing for a world the campaign never went to', () => {
    expect(renderToStaticMarkup(<Briefing system="nevarro" name="Nevarro" />)).toBe('');
  });
});

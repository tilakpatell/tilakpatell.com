import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MiddleEarth } from './Backdrops';

const draw = (variant) => renderToStaticMarkup(<MiddleEarth variant={variant} />);

describe('Middle-earth’s drawn backdrop', () => {
  it.each(['shire', 'mordor'])('draws %s with every number a number', (variant) => {
    const svg = draw(variant);
    expect(svg).toContain(`data-variant="${variant}"`);
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).not.toMatch(/NaN|undefined|Infinity/);
  });

  it.each(['shire', 'mordor'])('draws %s the same every visit, and with one blur at most', (variant) => {
    expect(draw(variant)).toBe(draw(variant));
    expect(draw(variant).match(/<filter/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });

  it('keeps a day and a night in each, for the mode to choose between', () => {
    for (const variant of ['shire', 'mordor']) {
      expect(draw(variant)).toContain('me-day');
      expect(draw(variant)).toContain('me-night');
    }
  });
});

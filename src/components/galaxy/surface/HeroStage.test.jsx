import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import HeroStage from './HeroStage.jsx'; // (named in full: ./heroStage.js is beside it)
import { heroSpec } from '../heroes';

describe('the loadout’s stage', () => {
  it('is a canvas for a 2017 hero over low, nothing on low (the flat backdrop)', () => {
    expect(renderToStaticMarkup(<HeroStage spec={heroSpec({ id: 'vader' })} level="high" />)).toMatch(/^<canvas[^>]*class="surface-hero-stage"/);
    expect(renderToStaticMarkup(<HeroStage spec={heroSpec({ id: 'vader' })} level="low" />)).toBe('');
  });
});

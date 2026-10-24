import { describe, expect, it } from 'vitest';
import { CHART_WORDS as W } from './words';

describe('the chart’s words', () => {
  it('writes a sector’s minus as a minus sign, and the height above or below the disc', () => {
    expect(W.sector([-2, 0, 13])).toBe('Sector −2, 0, 13');
    expect(W.sector([-0, -1, 0])).toBe('Sector 0, −1, 0');
    expect(W.height('3,800 ship-lengths', 1)).toBe('3,800 ship-lengths above the disc');
    expect(W.height('3,800 ship-lengths', -1)).toBe('3,800 ship-lengths below the disc');
    expect(W.height('12 ship-lengths', 0)).toBe('Level with the disc');
  });
});

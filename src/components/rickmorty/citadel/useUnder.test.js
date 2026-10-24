import { describe, expect, it } from 'vitest';
import { bottomOf } from './useUnder';

const box = (r) => ({ getBoundingClientRect: () => r });

describe('where a HUD’s top row ends', () => {
  it('is the bottom of the tallest thing in it, from the top of its stage', () => {
    // (the title and its line to 300.4, the map and its chips to 433.6; the stage starts at 64)
    expect(bottomOf(box({ top: 64 }), { children: [box({ bottom: 300.4 }), box({ bottom: 433.6 })] })).toBe(370);
  });

  it('is the stage’s top with nothing in the row', () => {
    expect(bottomOf(box({ top: 64 }), { children: [] })).toBe(0);
  });
});

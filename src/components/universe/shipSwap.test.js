import { describe, expect, it } from 'vitest';
import { SEEN_MS, SWAP_FLARE, swapFlare } from './shipSwap';

const seen = { shown: true, seenMs: 2000, reduced: false, covered: false, frozen: false };

describe('the flare a ship’s model comes in under (shipSwap)', () => {
  it('is a soft one where the stand-in was on screen a while', () => {
    expect(swapFlare(seen)).toBe(SWAP_FLARE);
    expect(SWAP_FLARE).toBeLessThan(1.4); // (softer than a heavy round's kick)
    expect(SWAP_FLARE).toBeGreaterThan(1);
  });

  it('is none where nobody saw the stand-in: not drawn yet, or only for a moment', () => {
    expect(swapFlare({ ...seen, shown: false })).toBe(0);
    expect(swapFlare({ ...seen, seenMs: SEEN_MS - 1 })).toBe(0);
    expect(swapFlare({ ...seen, seenMs: SEEN_MS })).toBe(SWAP_FLARE);
  });

  it('is none under the cockpit or the intro, behind the Hangar or the shipyard, or with reduced motion', () => {
    expect(swapFlare({ ...seen, covered: true })).toBe(0);
    expect(swapFlare({ ...seen, frozen: true })).toBe(0);
    expect(swapFlare({ ...seen, reduced: true })).toBe(0);
  });
});

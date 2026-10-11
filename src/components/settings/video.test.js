import { describe, expect, it } from 'vitest';
import { CONTROLS } from '../../lib/video.js';
import { groupsOf, optionsFor } from './video.js';

describe('groupsOf', () => {
  it('keeps the schema’s order of groups and of controls within each', () => {
    const groups = groupsOf(CONTROLS);
    expect(groups.map((g) => g.group)).toEqual(['Display', 'Anti-aliasing', 'Shadows', 'Lighting', 'Post', 'Textures']);
    expect(groups.find((g) => g.group === 'Shadows').controls.map((c) => c.id)).toEqual(['shadows', 'shadowDistance', 'contactShadows', 'cloudShadows']);
  });
});

describe('optionsFor', () => {
  const gi = CONTROLS.find((c) => c.id === 'gi');
  it('disables the values above the ceiling preset’s default and says why', () => {
    const mid = optionsFor(gi, 'mid');
    expect(mid.map(([v, , off]) => [v, off])).toEqual([['off', false], ['ssao', false], ['low', true], ['medium', true], ['high', true]]);
    expect(mid[2][3]).toMatch(/Medium stops at SSAO/);
  });
  it('disables nothing at ultra, and gives a range no options', () => {
    expect(optionsFor(gi, 'ultra').every(([, , off]) => !off)).toBe(true);
    expect(optionsFor(CONTROLS.find((c) => c.id === 'shadowDistance'), 'ultra')).toEqual([]);
  });
});

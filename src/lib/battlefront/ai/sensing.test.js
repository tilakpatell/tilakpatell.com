import { describe, expect, it } from 'vitest';
import { aiOf, loadRulebook } from '../rulebook.js';
import { DEFAULT } from './difficulty.js';
import { sensingOf, sightOf } from './sensing.js';

const ai = aiOf(loadRulebook());

describe('what a soldier bot sees', () => {
  it('is the difficulty row’s cone: 60 m and 60° either side on the multiplayer default, 250 m and 90° once alerted', () => {
    const s = sensingOf(ai.difficulties[DEFAULT]);
    expect(s).toEqual({ range: 60, angle: 60, alertedRange: 250, alertedAngle: 90 });
    expect(sightOf(s, false).range).toBe(60);
    expect(sightOf(s, false).cone).toBeCloseTo(0.5, 9);
    expect(sightOf(s, true).range).toBe(250);
    expect(sightOf(s, true).cone).toBeCloseTo(0, 9);
  });

  it('reads each row: the normal row’s 40 m, the co-op rows’ 120° alerted', () => {
    expect(sensingOf(ai.difficulties['multiplayer:normal']).range).toBe(40);
    expect(sightOf(sensingOf(ai.difficulties['cooperative:hard']), true).cone).toBeCloseTo(-0.5, 9);
  });

  it('falls back on the source’s own defaults for a row without them', () => {
    expect(sensingOf(null)).toEqual({ range: 40, angle: 60, alertedRange: 60, alertedAngle: 60 });
  });
});

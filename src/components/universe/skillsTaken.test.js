import { describe, expect, it } from 'vitest';
import { skillTaken, tellSkills } from './skillsTaken';

describe('the skill tree’s word to the wallet', () => {
  it('holds the nodes it was last told, and nothing for junk', () => {
    expect(skillTaken('u-seismic')).toBe(false);
    tellSkills(['trigger', 'u-seismic']);
    expect(skillTaken('u-seismic')).toBe(true);
    tellSkills(null);
    expect(skillTaken('u-seismic')).toBe(false);
  });
});

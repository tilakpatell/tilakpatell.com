import { describe, expect, it } from 'vitest';
import { BEATS, entered, left } from './beats';
import { RIGS } from '../../director';
import { LINES } from '../../voicelines';
import { CLIPS } from '../../../../../lib/clips';
import { stageById } from '../index';

const length = stageById('hobbiton').length;

describe('Hobbiton’s beats', () => {
  it('are in order, on the stage, each on a rig, none held over 25 s', () => {
    const ats = BEATS.map((b) => b.at);
    expect(ats).toEqual([...ats].sort((a, b) => a - b));
    for (const b of BEATS) {
      expect(b.at, b.id).toBeGreaterThanOrEqual(0);
      expect(b.at, b.id).toBeLessThan(length);
      expect(RIGS, b.id).toContain(b.rig);
      expect(b.hold, b.id).toBeLessThanOrEqual(25);
    }
  });

  it('entered over the whole stage lists every beat once, and walking back leaves them the same', () => {
    const ids = BEATS.map((b) => b.id);
    expect(entered(BEATS, 0, length)).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of BEATS) expect(left(BEATS, b.at + 1, b.at - 1)).toEqual(entered(BEATS, b.at - 1, b.at + 1));
  });

  it('every line is the Road’s, every clip the site’s', () => {
    for (const b of BEATS) {
      for (const id of b.lines ?? []) expect(LINES, `${b.id}: ${id}`).toHaveProperty([id]);
      if (b.clip) expect(CLIPS, b.id).toHaveProperty([b.clip]);
    }
  });

  it('the brief’s moments: the first words over black, the cart, the field’s jig, Bilbo gone under the Ring for 0.4 s', () => {
    const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
    expect(by.open).toMatchObject({ at: 0, hold: 6, clip: 'worldIsChanged' });
    expect(by.open.fx).toContainEqual(expect.objectContaining({ kind: 'black' }));
    expect(by.cart).toMatchObject({ rig: 'side', clip: 'wizardLate', hold: 0 });
    expect(by.partyfield).toMatchObject({ rig: 'crane', hold: 14 });
    expect(by.dragon.fx).toContainEqual(expect.objectContaining({ kind: 'vision', seconds: 0.4 }));
  });
});

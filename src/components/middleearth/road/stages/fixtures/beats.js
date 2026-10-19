// The checks every stage’s beats.test.js makes before its own brief’s:
// in order and on the stage, each on a rig, none held past 25 s, every beat
// entered once over the whole stage and left the same way walking back,
// every line the Road’s and every clip the site’s. Hobbiton’s test spells
// them out; the stages after it call this.

import { expect, it } from 'vitest';
import { entered, left } from '../../beats';
import { RIGS } from '../../director';
import { LINES } from '../../voicelines';
import { CLIPS } from '../../../../../lib/clips';
import { stageById } from '../index';

export function sweepBeats(id, BEATS) {
  const length = stageById(id).length;

  it('are in order, on the stage, each on a rig, none held over 25 s', () => {
    const ats = BEATS.map((b) => b.at);
    expect(ats).toEqual([...ats].sort((a, b) => a - b));
    for (const b of BEATS) {
      expect(b.at, b.id).toBeGreaterThanOrEqual(0);
      expect(b.at, b.id).toBeLessThan(length);
      expect(RIGS, b.id).toContain(b.rig);
      expect(b.hold, b.id).toBeLessThanOrEqual(25);
      // (a fixed camera says where it stands and what it looks at)
      if (b.rig === 'wide' || b.rig === 'seat') expect(b.params, b.id).toMatchObject({ at: expect.any(Array), lookAt: expect.any(Array) });
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
      for (const l of b.lines ?? []) expect(LINES, `${b.id}: ${l}`).toHaveProperty([l]);
      if (b.clip) expect(CLIPS, b.id).toHaveProperty([b.clip]);
    }
  });
}

import { describe, expect, it } from 'vitest';
import { BEATS } from './beats';
import { sweepBeats } from '../fixtures/beats';
import { CHANGES } from '../../fellowship';
import { LINES } from '../../voicelines';

describe('Bree’s beats', () => {
  sweepBeats('bree', BEATS);

  it('the brief’s moments: the gate low, the Pony through its window with Butterbur, the Riders cut to hard, Strider at dawn', () => {
    const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
    expect(by.gate).toMatchObject({ rig: 'low', hold: 8 });
    expect(by.pony).toMatchObject({ rig: 'seat', hold: 12 });
    expect(by.pony.lines.map((l) => LINES[l].who)).toEqual(['butterbur']);
    expect(by.riders).toMatchObject({ rig: 'wide', cut: 0, clip: 'nazgul' });
    expect(by.dawn).toMatchObject({ rig: 'lead', hold: 0 });
    expect(by.dawn.lines.map((l) => LINES[l].who)).toEqual(['aragorn']);
  });

  it('Strider joins on the dawn’s beat', () => {
    const join = CHANGES.find((c) => c.stage === 'bree' && c.add?.includes('aragorn'));
    expect(join.local).toBe(BEATS.find((b) => b.id === 'dawn').at);
  });
});

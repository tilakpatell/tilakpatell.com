import { describe, expect, it } from 'vitest';
import { BEATS } from './beats';
import { sweepBeats } from '../fixtures/beats';
import { CHANGES, walkers } from '../../fellowship';
import { STAGES, modeAt, stageById } from '../index';

describe('the Anduin’s beats', () => {
  sweepBeats('anduin', BEATS);

  it('the brief’s moments: the river, the Argonath, the lake, the Seat held, the horn, the breaking', () => {
    expect(BEATS.map((b) => b.id)).toEqual(['river', 'argonath', 'nenhithoel', 'seat', 'horn', 'breaking']);
    const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
    expect(by.river).toMatchObject({ rig: 'ride' });
    expect(by.argonath).toMatchObject({ rig: 'crane' });
    expect(by.argonath.hold).toBeGreaterThanOrEqual(12);
    expect(by.nenhithoel).toMatchObject({ rig: 'wide' });
    expect(by.seat).toMatchObject({ rig: 'seat', cut: 0 });
    expect(by.horn).toMatchObject({ rig: 'follow', clip: 'meatsBack' });
    expect(by.breaking).toMatchObject({ rig: 'side' });
  });

  it('in the boats on the river, ashore at Parth Galen, and away in the boat at the end with Sam alone', () => {
    const st = stageById('anduin');
    const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
    expect(modeAt(st, 0)).toBe('boat');
    expect(modeAt(st, by.argonath.at)).toBe('boat');
    expect(modeAt(st, by.seat.at)).toBe('walk');
    expect(modeAt(st, st.length - 1)).toBe('boat');
    const two = CHANGES.find((c) => c.stage === 'anduin' && c.remove?.includes('aragorn'));
    expect(two.local).toBe(by.breaking.at);
    const before = STAGES.slice(0, STAGES.indexOf(st)).reduce((a, x) => a + x.length, 0);
    const whole = STAGES.reduce((a, x) => a + x.length, 0);
    expect(walkers(STAGES, (before + st.length - 1) / whole).map((w) => w.id)).toEqual(['sam', 'frodo']);
  });
});

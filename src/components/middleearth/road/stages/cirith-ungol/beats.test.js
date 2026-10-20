import { describe, expect, it } from 'vitest';
import { BEATS } from './beats';
import { sweepBeats } from '../fixtures/beats';
import { modeAt, stageById } from '../index';

describe('Cirith Ungol’s beats', () => {
  sweepBeats('cirith-ungol', BEATS);

  it('the brief’s moments: the stair, the betrayal, the tunnel, Shelob held, taken, the tower, the gate', () => {
    expect(BEATS.map((b) => b.id)).toEqual(['stair', 'betrayal', 'tunnel', 'shelob', 'taken', 'tower', 'gate']);
    const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
    expect(by.betrayal).toMatchObject({ rig: 'seat', lines: ['cirith-gollum'] });
    expect(by.shelob).toMatchObject({ rig: 'low', cut: 0 });
    expect(by.shelob.hold).toBeGreaterThanOrEqual(16);
    expect(by.taken).toMatchObject({ rig: 'seat' });
    expect(by.tower).toMatchObject({ rig: 'seat' });
  });

  it('climbs the stair, walks the tunnel, climbs the tower’s stair, and walks out', () => {
    const st = stageById('cirith-ungol');
    const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
    expect(modeAt(st, by.stair.at)).toBe('climb');
    expect(modeAt(st, by.betrayal.at)).toBe('climb');
    expect(modeAt(st, by.tunnel.at)).toBe('walk');
    expect(modeAt(st, by.tower.at - 4)).toBe('climb');
    expect(modeAt(st, by.gate.at)).toBe('walk');
  });
});

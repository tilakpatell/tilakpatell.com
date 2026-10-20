import { describe, expect, it } from 'vitest';
import { BEATS } from './beats';
import { sweepBeats } from '../fixtures/beats';
import { LINES } from '../../voicelines';
import { modeAt, stageById } from '../index';

describe('Lothlórien’s beats', () => {
  sweepBeats('lorien', BEATS);

  it('the brief’s moments: the Nimrodel, Haldir, the climb, the dais, the Mirror held, the boats', () => {
    expect(BEATS.map((b) => b.id)).toEqual(['nimrodel', 'haldir', 'climb', 'dais', 'mirror', 'boats']);
    const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
    expect(by.nimrodel).toMatchObject({ rig: 'side' });
    expect(by.haldir.lines.map((l) => LINES[l].who)).toEqual(['haldir']);
    expect(by.dais.lines.map((l) => LINES[l].who)).toEqual(['galadriel']);
    expect(by.mirror).toMatchObject({ rig: 'seat', cut: 0, deed: { verb: 'press', clip: 'taskAppointed' } });
    expect(by.mirror.hold).toBeGreaterThanOrEqual(12);
    expect(by.boats).toMatchObject({ rig: 'lead' });
  });

  it('climbs the mallorn from the climb’s beat, walks the flets, and takes to the boats from the hythe', () => {
    const st = stageById('lorien');
    const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
    expect(modeAt(st, by.climb.at - 1)).toBe('walk');
    expect(modeAt(st, by.climb.at)).toBe('climb');
    expect(modeAt(st, by.dais.at)).toBe('walk');
    expect(modeAt(st, st.length - 1)).toBe('boat');
    expect(modeAt(st, by.boats.at)).toBe('walk');
  });
});

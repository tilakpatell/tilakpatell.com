import { describe, expect, it } from 'vitest';
import { BEATS } from './beats';
import { sweepBeats } from '../fixtures/beats';
import { CHANGES } from '../../fellowship';
import { LINES } from '../../voicelines';

describe('Moria’s beats', () => {
  sweepBeats('moria', BEATS);

  it('the brief’s moments: the dark, the tomb, the drums, the hall, the stair, the Bridge held 22 s, the Dale', () => {
    expect(BEATS.map((b) => b.id)).toEqual(['dark', 'tomb', 'drums', 'dwarrowdelf', 'stair', 'run', 'bridge', 'fly', 'dale']);
    const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
    expect(by.tomb).toMatchObject({ rig: 'seat' });
    expect(by.dale).toMatchObject({ rig: 'wide' });
    expect(by.tomb.lines.map((l) => LINES[l].who)).toEqual(['gimli']);
    expect(by.dwarrowdelf).toMatchObject({ rig: 'crane' });
    expect(by.run).toMatchObject({ clip: 'gandalfRun', hold: 0 });
    // (the plan’s low rig behind the lead would look away from the Balrog: a fixed shot low on the far bank, back along the span)
    expect(by.bridge).toMatchObject({ rig: 'seat', hold: 22, cut: 0, clip: 'youShallNotPass' });
    expect(by.bridge.params.at[1]).toBeLessThan(1.6);
    // (the fall’s last words after the hold, in the same shot)
    expect(by.fly).toMatchObject({ clip: 'flyYouFools', hold: 0, rig: 'seat' });
    expect(by.fly.params).toEqual(by.bridge.params);
    expect(by.fly.at).toBeGreaterThan(by.bridge.at);
    expect(by.dale).toMatchObject({ rig: 'wide' });
  });

  it('Gandalf leaves the line only once he has fallen, and the eight grieve to the Dale', () => {
    const fall = CHANGES.find((c) => c.stage === 'moria' && c.remove?.includes('gandalf'));
    expect(fall.local).toBe(BEATS.find((b) => b.id === 'fly').at);
    expect(Object.values(fall.state).every((s) => s === 'grieving')).toBe(true);
  });
});

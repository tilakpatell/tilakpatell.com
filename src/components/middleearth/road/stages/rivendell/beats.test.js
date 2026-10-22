import { describe, expect, it } from 'vitest';
import { BEATS } from './beats';
import { sweepBeats } from '../fixtures/beats';
import { CHANGES } from '../../fellowship';
import { LINES } from '../../voicelines';
import { BENCH, NARSIL } from './props';

describe('Rivendell’s beats', () => {
  sweepBeats('rivendell', BEATS);

  it('the brief’s moments: the crane over the valley, the Council held 20 s with three voices, then the axe, Narsil, Bilbo, the setting out', () => {
    const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
    expect(by.reveal).toMatchObject({ rig: 'crane', hold: 12 });
    expect(by.council).toMatchObject({ rig: 'seat', hold: 20 });
    expect([...by.council.lines, ...by.council.deed.lines].map((l) => LINES[l].who)).toEqual(['elrond', 'boromir', 'frodo']);
    // (the axe after the three voices: its own beat, just past the Council’s mark, the same shot)
    expect(by.axe).toMatchObject({ clip: 'andMyAxe', hold: 0, rig: 'seat' });
    expect(by.axe.at).toBeGreaterThan(by.council.at);
    expect(by.axe.params).toEqual(by.council.params);
    expect(by.narsil).toMatchObject({ rig: 'wide', hold: 8 });
    expect(by.bilbo.lines.map((l) => LINES[l].who)).toEqual(['bilbo']);
    expect(by.setout).toMatchObject({ rig: 'lead', hold: 6 });
  });

  it('Narsil’s shot and Bilbo’s are aimed at the hall of the shards and his bench, off the road', () => {
    const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
    for (const [id, [x, z]] of [['narsil', NARSIL], ['bilbo', BENCH]]) {
      const { lookAt } = by[id].params;
      expect(Math.hypot(lookAt[0] - x, lookAt[2] - z)).toBeLessThan(1.5);
    }
  });

  it('the nine form up on the setting out’s beat', () => {
    const nine = CHANGES.find((c) => c.stage === 'rivendell' && c.order?.length === 9);
    expect(nine.local).toBe(BEATS.find((b) => b.id === 'setout').at);
  });
});

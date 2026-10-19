import { describe, expect, it } from 'vitest';
import { BEATS } from './beats';
import { sweepBeats } from '../fixtures/beats';
import { CHANGES } from '../../fellowship';
import { LINES } from '../../voicelines';

describe('Rivendell’s beats', () => {
  sweepBeats('rivendell', BEATS);

  it('the brief’s moments: the crane over the valley, the Council held 20 s with three voices and the axe, Narsil, Bilbo, the setting out', () => {
    const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
    expect(by.reveal).toMatchObject({ rig: 'crane', hold: 12 });
    expect(by.council).toMatchObject({ rig: 'seat', hold: 20, clip: 'andMyAxe' });
    expect(by.council.lines.map((l) => LINES[l].who)).toEqual(['elrond', 'boromir', 'frodo']);
    expect(by.narsil).toMatchObject({ rig: 'low', hold: 8 });
    expect(by.bilbo.lines.map((l) => LINES[l].who)).toEqual(['bilbo']);
    expect(by.setout).toMatchObject({ rig: 'lead', hold: 6 });
  });

  it('the nine form up on the setting out’s beat', () => {
    const nine = CHANGES.find((c) => c.stage === 'rivendell' && c.order?.length === 9);
    expect(nine.local).toBe(BEATS.find((b) => b.id === 'setout').at);
  });
});

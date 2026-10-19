import { describe, expect, it } from 'vitest';
import { BEATS } from './beats';
import { sweepBeats } from '../fixtures/beats';
import { CHANGES } from '../../fellowship';

describe('the Dead Marshes’ beats', () => {
  sweepBeats('marshes', BEATS);

  it('the brief’s moments: the rope, Gollum held, the candles, the faces, the fell beast, the Gate', () => {
    expect(BEATS.map((b) => b.id)).toEqual(['rope', 'gollum', 'candles', 'faces', 'fellbeast', 'gate']);
    const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
    expect(by.rope).toMatchObject({ rig: 'low' });
    expect(by.gollum).toMatchObject({ rig: 'seat', cut: 0, clip: 'nobodyLikesYou' });
    expect(by.candles).toMatchObject({ rig: 'side' });
    expect(by.faces).toMatchObject({ rig: 'low' });
    expect(by.fellbeast).toMatchObject({ rig: 'wide', clip: 'nazgul' });
    expect(by.gate).toMatchObject({ rig: 'wide', lines: ['marshes-gollum'] });
    expect(by.gate.hold).toBeGreaterThanOrEqual(12);
  });

  it('Gollum leads from his beat’s end, before the candles', () => {
    const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
    const joins = CHANGES.find((c) => c.stage === 'marshes' && c.add?.includes('gollum'));
    expect(joins.local).toBeGreaterThan(by.gollum.at);
    expect(joins.local).toBeLessThan(by.candles.at);
  });
});

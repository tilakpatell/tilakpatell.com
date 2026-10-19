import { describe, expect, it } from 'vitest';
import { BEATS } from './beats';
import { sweepBeats } from '../fixtures/beats';
import { CHANGES } from '../../fellowship';

describe('the Shire’s edge’s beats', () => {
  sweepBeats('shire-edge', BEATS);

  it('the brief’s moments: second breakfast in the corn, the roots held low with a hard cut, the Ring pulling, the ferry wide', () => {
    const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
    expect(by.mushrooms).toMatchObject({ rig: 'side', hold: 6, clip: 'secondBreakfast' });
    expect(by.roots).toMatchObject({ rig: 'low', hold: 16, cut: 0 });
    expect(by.roots.fx.filter((f) => f.kind === 'vision').length).toBeGreaterThanOrEqual(1);
    expect(by.ferry).toMatchObject({ rig: 'wide', hold: 12 });
    expect(by.run.at).toBeGreaterThan(by.roots.at);
    expect(by.run.at).toBeLessThan(by.ferry.at);
  });

  it('Merry and Pippin join on the mushrooms’ beat, not before', () => {
    const join = CHANGES.find((c) => c.stage === 'shire-edge' && c.add?.includes('merry'));
    expect(join.local).toBeGreaterThan(BEATS[0].at);
    expect(join.local - BEATS[0].at).toBeLessThan(6);
  });
});

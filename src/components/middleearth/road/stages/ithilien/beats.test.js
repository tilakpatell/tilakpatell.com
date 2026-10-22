import { describe, expect, it } from 'vitest';
import { BEATS } from './beats';
import { sweepBeats } from '../fixtures/beats';
import { BEACONS, EVERY } from '../../beacons';
import { KING } from './props';

describe('Ithilien’s beats', () => {
  sweepBeats('ithilien', BEATS);

  it('the brief’s moments: the woods, the mûmakil, the rangers, behind the falls, the Cross-roads, the Vale held, the beacons', () => {
    expect(BEATS.map((b) => b.id)).toEqual(['woods', 'mumakil', 'rangers', 'henneth', 'crossroads', 'vale', 'beacons']);
    const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
    expect(by.mumakil).toMatchObject({ rig: 'wide' });
    expect(by.rangers).toMatchObject({ rig: 'seat', lines: ['ithilien-faramir'] });
    expect(by.henneth).toMatchObject({ rig: 'seat' });
    expect(by.crossroads).toMatchObject({ rig: 'wide' });
    expect(by.vale).toMatchObject({ rig: 'crane', cut: 0 });
    expect(by.vale.hold).toBeGreaterThanOrEqual(18);
    expect(by.beacons).toMatchObject({ rig: 'wide' });
  });

  it('the Cross-roads’ shot is aimed at the king, from low down by the road, up at him', () => {
    const { at, lookAt } = BEATS.find((b) => b.id === 'crossroads').params;
    expect(Math.hypot(lookAt[0] - KING.at[0], lookAt[2] - KING.at[1])).toBeLessThan(1.5);
    expect(Math.abs(at[0])).toBeLessThan(2);
    expect(lookAt[1]).toBeGreaterThan(at[1] + 2);
  });

  it('holds on the beacons until all seven burn', () => {
    const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
    expect(by.beacons.hold).toBeGreaterThanOrEqual((BEACONS - 1) * EVERY + 1);
  });
});

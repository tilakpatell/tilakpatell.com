import { describe, expect, it } from 'vitest';
import { BEATS } from './beats';
import { sweepBeats } from '../fixtures/beats';
import { BEACONS, EVERY } from '../../beacons';

describe('Ithilien’s beats', () => {
  sweepBeats('ithilien', BEATS);

  it('the brief’s moments: the woods, the mûmakil, the rangers, behind the falls, the Cross-roads, the Vale held, the beacons', () => {
    expect(BEATS.map((b) => b.id)).toEqual(['woods', 'mumakil', 'rangers', 'henneth', 'crossroads', 'vale', 'beacons']);
    const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
    expect(by.mumakil).toMatchObject({ rig: 'wide' });
    expect(by.rangers).toMatchObject({ rig: 'seat', lines: ['ithilien-faramir'] });
    expect(by.henneth).toMatchObject({ rig: 'seat' });
    expect(by.crossroads).toMatchObject({ rig: 'low' });
    expect(by.vale).toMatchObject({ rig: 'crane', cut: 0 });
    expect(by.vale.hold).toBeGreaterThanOrEqual(18);
    expect(by.beacons).toMatchObject({ rig: 'wide' });
  });

  it('holds on the beacons until all seven burn', () => {
    const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
    expect(by.beacons.hold).toBeGreaterThanOrEqual((BEACONS - 1) * EVERY + 1);
  });
});

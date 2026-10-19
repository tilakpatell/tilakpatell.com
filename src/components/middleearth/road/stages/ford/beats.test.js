import { describe, expect, it } from 'vitest';
import { BEATS } from './beats';
import { sweepBeats } from '../fixtures/beats';
import { CHANGES } from '../../fellowship';

describe('the Ford’s beats', () => {
  sweepBeats('ford', BEATS);

  it('the brief’s moments: the trolls low, Arwen from the side, the ride on the horse’s back to the Ford, the river held 18 s', () => {
    const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
    expect(by.trolls).toMatchObject({ rig: 'low', hold: 8 });
    expect(by.arwen).toMatchObject({ rig: 'side', hold: 6 });
    expect(by.ride).toMatchObject({ rig: 'ride', hold: 0 });
    // (the ride keeps the camera on the horse until the Ford’s own shot)
    expect(by.ride.at + by.ride.reach).toBeGreaterThanOrEqual(by.ford.at - 20);
    expect(by.ford).toMatchObject({ rig: 'seat', hold: 18, cut: 0 });
  });

  it('Frodo rides with Arwen from her beat', () => {
    const join = CHANGES.find((c) => c.stage === 'ford' && c.add?.includes('arwen'));
    expect(join.local).toBe(BEATS.find((b) => b.id === 'arwen').at);
    expect(join.state).toMatchObject({ frodo: 'riding', arwen: 'riding' });
  });
});

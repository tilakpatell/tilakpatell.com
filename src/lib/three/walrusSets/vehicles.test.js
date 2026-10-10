import { describe, expect, it } from 'vitest';
import { BAND_SET } from './band';
import { VEHICLE_SET, rideClip } from './vehicles';

describe('the riders’, crews’ and the band’s sets', () => {
  it('sits a driver in the X-34 and a rider on the 74-Z, and names none for a ride it hasn’t', () => {
    expect(rideClip('landspeeder')).toBe('ride.landspeeder');
    expect([].concat(VEHICLE_SET['ride.landspeeder'])).toContain('X34_LandSpeeder_Driver_Idle');
    expect(rideClip('speederbike')).toBe('ride.speederbike');
    expect(rideClip('tauntaun')).toBe(null);
  });
  it('plays the band on the humanoid’s five', () => {
    expect(Object.values(BAND_SET)).toEqual(['BandPlaying_01', 'BandPlaying_02', 'BandPlaying_03', 'BandPlaying_BagPipe_03', 'BandPlaying_Drummer_04']);
  });
});

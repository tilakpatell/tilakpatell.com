import { describe, expect, it } from 'vitest';
import { presetValues } from './video.js';
import { fromVideo } from './videoLook';

const AS_DRAWN = { grain: 1, aberration: 1, bloom: true, samples: Infinity };

describe('the video settings on the universe map', () => {
  it('keeps the map’s look for a level picked whole, whatever its row says', () => {
    for (const level of ['low', 'mid', 'high', 'ultra']) expect(fromVideo(presetValues(level), level)).toEqual(AS_DRAWN);
    expect(fromVideo(null, 'high')).toEqual(AS_DRAWN);
  });

  it('takes what the visitor turned: the grain, the aberration, the bloom and the multisampling', () => {
    const ultra = presetValues('ultra');
    expect(fromVideo({ ...ultra, filmGrain: 'off' }, 'ultra').grain).toBe(0);
    expect(fromVideo({ ...ultra, filmGrain: 'low' }, 'ultra').grain).toBe(0.5);
    expect(fromVideo({ ...ultra, aberration: 'off' }, 'ultra').aberration).toBe(0);
    expect(fromVideo({ ...ultra, bloom: 'off' }, 'ultra').bloom).toBe(false);
    expect(fromVideo({ ...ultra, msaa: '0' }, 'ultra').samples).toBe(0);
    expect(fromVideo({ ...ultra, msaa: '2' }, 'ultra').samples).toBe(2);
  });

  it('never takes away what the map draws for a control turned on over a row that has it off', () => {
    const low = presetValues('low');
    expect(fromVideo({ ...low, bloom: 'on', filmGrain: 'full' }, 'low')).toEqual(AS_DRAWN);
  });
});

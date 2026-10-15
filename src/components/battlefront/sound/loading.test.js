import { describe, expect, it } from 'vitest';
import { cueFor, startLoadingMusic } from './loading.js';

describe('the loading screen’s music', () => {
  it('is Hoth’s intro then its loop, and nothing for a level with no cue', () => {
    expect(cueFor('hoth')).toEqual({ intro: 'music.loading.intro', loop: 'music.loading.loop' });
    expect(cueFor('kamino')).toBeNull();
    expect(cueFor('hoth', {})).toBeNull();
  });

  it('plays the intro once with the loop to follow, and the stop ends it', () => {
    const calls = [];
    const play = (row, opts) => {
      calls.push({ row, ...opts });
      return { stop: (ms) => calls.push({ stop: ms }) };
    };
    const stop = startLoadingMusic('hoth', { play });
    expect(calls).toHaveLength(1);
    expect(calls[0].loop).toBe(false);
    expect(calls[0].then).toBe('music.loading.loop');
    expect(calls[0].row.files[0]).toBe('music-loading-intro-01.mp3');
    stop();
    expect(calls[1].stop).toBeGreaterThan(0);
    expect(startLoadingMusic('kamino', { play })).toBeTypeOf('function');
    expect(calls).toHaveLength(2);
  });
});

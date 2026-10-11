import { describe, expect, it } from 'vitest';
import { frameTimes, startPresentMon } from './presentmon.mjs';

describe('the game’s frame times from PresentMon', () => {
  it('sums the 1.x column', () => {
    const csv = ['Application,ProcessID,MsBetweenPresents', ...[10, 12, 14, 16, 30].map((v) => `bf.exe,1,${v}`)].join('\n');
    expect(frameTimes(csv)).toEqual({ n: 5, p50: 14, p95: 30, fps: 61 });
  });

  it('sums the 2.x column and skips what is not a number', () => {
    const csv = 'Application,FrameTime,Other\r\nbf.exe,8.3,x\r\nbf.exe,NA,x\r\nbf.exe,8.4,x';
    expect(frameTimes(csv)).toMatchObject({ n: 2, p50: 8.3, p95: 8.4 });
  });

  it('says nothing for an empty or foreign file, and starts nothing without the tool', () => {
    expect(frameTimes('')).toBeNull();
    expect(frameTimes('a,b\n1,2')).toBeNull();
    expect(startPresentMon({ exe: '', process: 'bf.exe', out: 'x.csv' })).toBeNull();
  });
});

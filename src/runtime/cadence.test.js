import { describe, expect, it } from 'vitest';
import { cadenceFor, readFps } from './cadence';

const win = (search = '', kept = null) => ({ location: { search }, localStorage: { getItem: (k) => (k === 'tp-fps' ? kept : null) } });

describe('readFps', () => {
  it('reads a pinned 30 from the address, then from what was kept', () => {
    expect(readFps(win('?fps=30'))).toBe(30);
    expect(readFps(win('', '30'))).toBe(30);
    expect(readFps(win('?fps=60', '30'))).toBe(60);
  });
  it('takes nothing else, and no window, as no pin', () => {
    expect(readFps(win('?fps=24'))).toBe(null);
    expect(readFps(win())).toBe(null);
    expect(readFps(undefined)).toBe(null);
    expect(readFps({ location: { search: '' }, get localStorage() { throw new Error('blocked'); } })).toBe(null);
  });
});

describe('cadenceFor', () => {
  it('draws every second beat when the visitor pins 30 or the tier is T0, else every beat', () => {
    expect(cadenceFor({ fps: 30 })).toBe(2);
    expect(cadenceFor({ tier: 'T0' })).toBe(2);
    expect(cadenceFor({ tier: 'T0', fps: 60 })).toBe(1);
    expect(cadenceFor({ tier: 'low' })).toBe(1);
    expect(cadenceFor({})).toBe(1);
  });
});

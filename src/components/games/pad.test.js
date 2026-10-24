import { afterEach, describe, expect, it, vi } from 'vitest';
import { edges, readPad, stirs } from './pad';

const pad = (o) => ({ connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: [], ...o });
const pads = (list) => vi.stubGlobal('navigator', { getGamepads: () => list });

afterEach(() => vi.unstubAllGlobals());

describe('the pad read each frame', () => {
  it('is the first connected pad with the standard mapping, before any other', () => {
    pads([null, pad({ mapping: '', axes: [0.9, 0, 0, 0] }), pad({ axes: [-0.9, 0, 0, 0] })]);
    expect(readPad().lx).toBeLessThan(0);
  });

  it('is the first connected pad when none has the standard mapping', () => {
    pads([pad({ connected: false }), pad({ mapping: '', axes: [0.9, 0, 0, 0] })]);
    expect(readPad().lx).toBeGreaterThan(0);
  });

  it('is null with no pad, an empty list, or the list refused', () => {
    pads([null, null]);
    expect(readPad()).toBeNull();
    pads(null);
    expect(readPad()).toBeNull();
    vi.stubGlobal('navigator', {
      getGamepads: () => {
        throw new Error('blocked');
      },
    });
    expect(readPad()).toBeNull();
  });

  it('is a new reading each time, so a world can keep the last one to find presses', () => {
    pads([pad({ buttons: [{ pressed: true }] })]);
    const a = readPad();
    const b = readPad();
    expect(b).not.toBe(a);
    expect(edges(b, a)).toEqual({});
  });
});

describe('a pad’s first move', () => {
  const rest = { lx: 0, ly: 0, rx: 0, ry: 0, a: false, b: false, x: false, y: false };
  it('is a press or a push, and not a hold', () => {
    expect(stirs(null, {})).toBe(false);
    expect(stirs(rest, rest)).toBe(false);
    expect(stirs({ ...rest, x: true }, rest)).toBe(true);
    expect(stirs({ ...rest, a: true }, { ...rest, a: true })).toBe(false);
    expect(stirs({ ...rest, lx: 0.4 }, rest)).toBe(true);
    expect(stirs({ ...rest, ry: -0.3 }, rest)).toBe(true);
  });
});

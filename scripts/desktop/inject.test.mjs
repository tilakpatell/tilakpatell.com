import { describe, expect, it } from 'vitest';
import { INJECT_PS, SCAN, injectLine, startInjector } from './inject.mjs';

describe('the native input injector’s lines', () => {
  it('sends keys as scan codes, the extended ones marked', () => {
    expect(injectLine({ t: 'key', down: true, code: 'KeyW' })).toBe('K 17 0 1');
    expect(injectLine({ t: 'key', down: false, code: 'ArrowUp' })).toBe('K 72 1 0');
    expect(injectLine({ t: 'key', down: true, code: 'MediaPlayPause' })).toBeNull();
    expect(new Set(Object.values(SCAN).map(String)).size).toBe(Object.keys(SCAN).length);
  });

  it('sends a locked pointer’s motion as relative moves, buttons and the wheel', () => {
    expect(injectLine({ t: 'pointer', kind: 'move', x: 0.5, y: 0.5, dx: 4, dy: -3 })).toBe('M 4 -3');
    expect(injectLine({ t: 'pointer', kind: 'move', x: 0.5, y: 0.5 })).toBeNull();
    expect(injectLine({ t: 'pointer', kind: 'down', x: 0, y: 0, button: 2 })).toBe('B right 1');
    expect(injectLine({ t: 'pointer', kind: 'up', x: 0, y: 0, button: 0 })).toBe('B left 0');
    expect(injectLine({ t: 'pointer', kind: 'wheel', x: 0, y: 0, dy: 120 })).toBe('W -120');
    expect(injectLine({ t: 'ping', n: 1 })).toBeNull();
  });

  it('reads every line kind it writes, and stays off anything but Windows', () => {
    for (const k of ["'K'", "'M'", "'B'", "'W'"]) expect(INJECT_PS).toContain(k);
    expect(startInjector({ platform: 'linux' })).toBeNull();
  });
});

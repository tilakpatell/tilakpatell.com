import { afterEach, describe, expect, it, vi } from 'vitest';
import { readCleared, recordWin } from './save';

// a localStorage that lives for one test (hq/hq.test.js)
const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

describe('Infiltration’s save, one for both views', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('counts the levels cleared in tp-hq-widow-level, as a bare number', () => {
    vi.stubGlobal('window', { localStorage: memoryStorage() });
    expect(readCleared()).toBe(0);
    expect(recordWin(0)).toEqual({ cleared: 1, fresh: 0 });
    expect(window.localStorage.getItem('tp-hq-widow-level')).toBe('1');
    expect(recordWin(0)).toEqual({ cleared: 1, fresh: -1 });
    window.localStorage.setItem('tp-hq-widow-level', '99');
    expect(readCleared()).toBe(8);
    window.localStorage.setItem('tp-hq-widow-level', '"x"');
    expect(readCleared()).toBe(0);
  });
});

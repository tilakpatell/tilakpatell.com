import { describe, expect, it, vi } from 'vitest';
import { DEFAULTS, KEY, read, subscribe, write } from './settings.js';

const memory = (init = {}) => {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    map: m,
  };
};

describe('the site’s settings', () => {
  it('start from the defaults', () => {
    expect(read(memory())).toEqual(DEFAULTS);
    expect(DEFAULTS).toEqual({ v: 1, quality: 'auto', three: 'auto', sharpness: 1, motion: 'auto', sound: true, volume: 1, music: 1, voices: 1, voicesOn: true, askBigDownload: true, capped: null });
  });

  it('take in what the older keys already say', () => {
    const store = memory({
      'tp-quality': 'mid',
      'tp-3d': 'off',
      'tp-sound': 'off',
      'tp-detail-cap': JSON.stringify({ renderer: 'RTX 5090', level: 'high' }),
      'tp-volume': JSON.stringify({ master: 0.5, voices: 0.25 }),
      'tp-voices': 'off',
    });
    expect(read(store)).toMatchObject({ quality: 'mid', three: 'off', sound: false, capped: 'high', volume: 0.5, music: 1, voices: 0.25, voicesOn: false });
  });

  it('come back as they were written, and keep the older keys in step', () => {
    const store = memory();
    write({ quality: 'ultra', three: 'on', sharpness: 1.5, motion: 'reduced', sound: false, volume: 0.4, music: 0.3, voices: 0.7, voicesOn: false, askBigDownload: false }, store);
    expect(read(store)).toMatchObject({ quality: 'ultra', three: 'on', sharpness: 1.5, motion: 'reduced', sound: false, volume: 0.4, music: 0.3, voices: 0.7, voicesOn: false, askBigDownload: false });
    expect(JSON.parse(store.getItem(KEY)).v).toBe(1);
    expect(store.getItem('tp-quality')).toBe('ultra');
    expect(store.getItem('tp-3d')).toBe('on');
    expect(store.getItem('tp-sound')).toBe('off');
    expect(store.getItem('tp-sharpness')).toBe('1.5');
    expect(store.getItem('tp-motion')).toBe('reduced');
    expect(store.getItem('tp-ask-download')).toBe('off');
    expect(store.getItem('tp-voices')).toBe('off');
    expect(JSON.parse(store.getItem('tp-volume'))).toEqual({ master: 0.4, music: 0.3, voices: 0.7 });
  });

  it('forget the older keys when set back to Auto', () => {
    const store = memory({ 'tp-quality': 'low', 'tp-3d': 'off', 'tp-motion': 'full' });
    write({ quality: 'auto', three: 'auto', motion: 'auto', askBigDownload: true }, store);
    write({ voicesOn: true }, store);
    for (const k of ['tp-quality', 'tp-3d', 'tp-motion', 'tp-ask-download', 'tp-voices']) expect(store.map.has(k), k).toBe(false);
  });

  it('follow an older key changed elsewhere (the sound toggled from ⌘K)', () => {
    const store = memory();
    write({ sound: true }, store);
    store.setItem('tp-sound', 'off');
    expect(read(store).sound).toBe(false);
    store.setItem('tp-voices', 'off'); // (the voices switched off from a world’s Menu)
    expect(read(store).voicesOn).toBe(false);
    write({ voicesOn: false }, store);
    store.removeItem('tp-voices'); // (and back on)
    expect(read(store).voicesOn).toBe(true);
  });

  it('hold each value to what it may be', () => {
    const store = memory();
    write({ quality: 'max', three: 'maybe', sharpness: 9, motion: 'fast', volume: -1, voices: 3 }, store);
    expect(read(store)).toMatchObject({ quality: 'auto', three: 'auto', sharpness: 2, motion: 'auto', volume: 0, voices: 1 });
    write({ sharpness: 0.1 }, store);
    expect(read(store).sharpness).toBe(0.5);
  });

  it('survive a kept value that isn’t theirs', () => {
    const store = memory({ [KEY]: '{not json', 'tp-volume': 'loud', 'tp-sharpness': 'soft' });
    expect(read(store)).toEqual(DEFAULTS);
    store.setItem(KEY, JSON.stringify({ v: 99, sound: false }));
    expect(read(store).sound).toBe(true);
  });

  it('work with no storage at all', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(read(broken)).toEqual(DEFAULTS);
    expect(() => write({ quality: 'low' }, broken)).not.toThrow();
    expect(read(null)).toEqual(DEFAULTS);
  });

  it('tell whoever listens when they’re written, until told to stop', () => {
    const store = memory();
    const fn = vi.fn();
    const stop = subscribe(fn);
    write({ volume: 0.5 }, store);
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ volume: 0.5 }), { volume: 0.5 });
    stop();
    write({ volume: 0.2 }, store);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('the motion setting on the page', () => {
  it('marks the page reduced, and takes the mark off for Auto', async () => {
    const { applyMotion } = await import('./settings.js');
    const doc = { documentElement: { dataset: {} } };
    applyMotion('reduced', doc);
    expect(doc.documentElement.dataset.motion).toBe('reduced');
    applyMotion('auto', doc);
    expect(doc.documentElement.dataset.motion).toBeUndefined();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUDGETS, budget, classifyDevice, pixelRatio, quality, rendererTier, resetDevice, setQuality, sharpness, worldCheck } from './device';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const PIXEL = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
const IPAD_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

describe('telling what a device can afford', () => {
  it('gives a desktop with a graphics chip everything', () => {
    expect(classifyDevice({ ua: WINDOWS, memory: 16, cores: 12, renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)' })).toMatchObject({ tier: 'high', phone: false, why: [] });
  });

  it('starts a recent phone in the middle', () => {
    expect(classifyDevice({ ua: IPHONE, coarse: true, screen: 390, renderer: 'Apple GPU' })).toMatchObject({ tier: 'mid', phone: true, why: ['phone'] });
    expect(classifyDevice({ ua: PIXEL, coarse: true, screen: 412, memory: 8, cores: 8, renderer: 'Mali-G715' })).toMatchObject({ tier: 'mid', phone: true });
  });

  it('knows an iPad asking for the desktop site is a tablet', () => {
    expect(classifyDevice({ ua: IPAD_DESKTOP, touchPoints: 5, screen: 820 })).toMatchObject({ tier: 'mid', phone: true });
    expect(classifyDevice({ ua: IPAD_DESKTOP, touchPoints: 0, screen: 1440 })).toMatchObject({ tier: 'high', phone: false });
  });

  it('puts budget phones and their graphics chips low', () => {
    expect(classifyDevice({ ua: PIXEL, coarse: true, screen: 360, memory: 2, renderer: 'Adreno (TM) 610' })).toMatchObject({ tier: 'low', why: ['memory'] });
    for (const renderer of ['Mali-G52 MC2', 'Adreno (TM) 506', 'PowerVR Rogue GE8320', 'Mali-T830']) {
      expect(classifyDevice({ ua: PIXEL, coarse: true, screen: 360, memory: 4, renderer }).tier).toBe('low');
    }
    // the same chips' newer siblings are fine
    for (const renderer of ['Adreno (TM) 740', 'Mali-G78', 'Mali-G715']) {
      expect(classifyDevice({ ua: PIXEL, coarse: true, screen: 412, memory: 8, renderer }).tier).toBe('mid');
    }
  });

  it('puts software WebGL low wherever it runs', () => {
    expect(classifyDevice({ ua: WINDOWS, memory: 16, renderer: 'SwiftShader', software: true })).toMatchObject({ tier: 'low', why: ['software'] });
  });

  it('starts small or low-memory computers in the middle', () => {
    expect(classifyDevice({ ua: WINDOWS, memory: 4, cores: 4 })).toMatchObject({ tier: 'mid', why: ['memory'] });
    expect(classifyDevice({ ua: WINDOWS, memory: 8, cores: 2 })).toMatchObject({ tier: 'low', why: ['cores'] });
  });

  it('hears Data Saver and a 2G connection', () => {
    expect(classifyDevice({ ua: IPHONE, saveData: true }).saveData).toBe(true);
    expect(classifyDevice({ ua: PIXEL, net: 'slow-2g' }).saveData).toBe(true);
    expect(classifyDevice({ ua: PIXEL, net: '2g' }).saveData).toBe(true);
    expect(classifyDevice({ ua: PIXEL, net: '4g' }).saveData).toBe(false);
  });

  it('lets a pinned quality win', () => {
    expect(classifyDevice({ ua: WINDOWS, memory: 16, override: 'low' }).tier).toBe('low');
    expect(classifyDevice({ ua: IPHONE, override: 'high' }).tier).toBe('high');
    expect(classifyDevice({ ua: IPHONE, override: 'max' }).tier).toBe('mid');
  });
});

const RTX5090 = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5090 (0x00002B85) Direct3D11 vs_5_0 ps_5_0, D3D11)';
const UHD620 = 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)';

describe('the detail level: the tier, graded by the graphics chip', () => {
  it('raises a desktop with a strong graphics card to ultra', () => {
    expect(classifyDevice({ ua: WINDOWS, memory: 16, cores: 16, renderer: RTX5090 })).toMatchObject({ tier: 'high', grade: 'ultra', detail: 'ultra' });
  });

  it('gives Auto’s ultra to any laptop or desktop with a graphics chip, an ordinary card and a chip whose name says nothing included', () => {
    expect(classifyDevice({ ua: WINDOWS, memory: 16, renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)' })).toMatchObject({ tier: 'high', detail: 'ultra', auto: 'ultra' });
    expect(classifyDevice({ ua: IPAD_DESKTOP, touchPoints: 0, screen: 1440, renderer: 'Apple GPU' })).toMatchObject({ tier: 'high', grade: null, detail: 'ultra' });
    expect(classifyDevice({ ua: WINDOWS, memory: 16 })).toMatchObject({ tier: 'high', detail: 'ultra' });
  });

  it('holds a weak built-in chip at high, leaving the tier alone', () => {
    expect(classifyDevice({ ua: WINDOWS, memory: 8, cores: 4, renderer: UHD620 })).toMatchObject({ tier: 'high', grade: 'mid', detail: 'high', auto: 'high' });
  });

  it('starts a phone at mid and software WebGL at low', () => {
    expect(classifyDevice({ ua: IPHONE, coarse: true, screen: 390, renderer: 'Apple GPU' })).toMatchObject({ detail: 'mid', auto: 'mid' });
    expect(classifyDevice({ ua: WINDOWS, memory: 16, renderer: 'SwiftShader', software: true })).toMatchObject({ detail: 'low', auto: 'low' });
  });

  it('says what Auto would pick even when a level is pinned', () => {
    expect(classifyDevice({ ua: WINDOWS, memory: 16, override: 'low' })).toMatchObject({ detail: 'low', auto: 'ultra' });
  });

  it('never lifts a phone, a small computer or a weak device past its tier', () => {
    expect(classifyDevice({ ua: IPHONE, coarse: true, screen: 390, renderer: 'Apple GPU' }).detail).toBe('mid');
    expect(classifyDevice({ ua: WINDOWS, memory: 4, cores: 4, renderer: RTX5090 }).detail).toBe('mid');
    expect(classifyDevice({ ua: WINDOWS, memory: 16, renderer: 'SwiftShader', software: true }).detail).toBe('low');
  });

  it('pins ultra, and pins a lower level on a strong card, when the address says so', () => {
    expect(classifyDevice({ ua: IPHONE, override: 'ultra' })).toMatchObject({ tier: 'high', detail: 'ultra' });
    expect(classifyDevice({ ua: WINDOWS, memory: 16, renderer: RTX5090, override: 'high' })).toMatchObject({ tier: 'high', detail: 'high' });
    expect(classifyDevice({ ua: WINDOWS, memory: 16, renderer: RTX5090, override: 'low' })).toMatchObject({ tier: 'low', detail: 'low' });
  });

  it('holds a chip at the cap it earned by struggling, but only that chip', () => {
    expect(classifyDevice({ ua: WINDOWS, memory: 16, renderer: RTX5090, cap: { renderer: RTX5090, level: 'high' } }).detail).toBe('high');
    expect(classifyDevice({ ua: WINDOWS, memory: 16, renderer: RTX5090, cap: { renderer: 'another chip', level: 'high' } }).detail).toBe('ultra');
    // a pinned level beats the cap: it's how to try ultra again
    expect(classifyDevice({ ua: WINDOWS, memory: 16, renderer: RTX5090, cap: { renderer: RTX5090, level: 'high' }, override: 'ultra' }).detail).toBe('ultra');
  });

  it('never caps a level the visitor picked by hand, and holds Auto to the cap', () => {
    const cap = { renderer: RTX5090, level: 'high' };
    expect(classifyDevice({ ua: WINDOWS, memory: 16, renderer: RTX5090, cap, override: 'ultra' })).toMatchObject({ detail: 'ultra', auto: 'high' });
    expect(classifyDevice({ ua: WINDOWS, memory: 16, renderer: RTX5090, cap })).toMatchObject({ detail: 'high', auto: 'high' });
  });
});

describe('budgets', () => {
  it('step down with the tier', () => {
    expect(budget('high').ratio).toBeGreaterThan(budget('mid').ratio);
    expect(budget('mid').ratio).toBeGreaterThan(budget('low').ratio);
    expect(budget('low')).toMatchObject({ shadows: false, bloom: 0, samples: 0, antialias: false });
    expect(budget('nonsense')).toBe(BUDGETS.high);
  });

  it('give ultra more of everything than high, and say which tier each row is', () => {
    expect(budget('ultra').shadowMap).toBeGreaterThan(budget('high').shadowMap);
    expect(budget('ultra').samples).toBeGreaterThan(budget('high').samples);
    expect(budget('ultra').ratio).toBeGreaterThanOrEqual(budget('high').ratio);
    // (a row's tier is what tier checks compare against: ultra is still high)
    expect(BUDGETS.ultra.tier).toBe('high');
    for (const t of ['low', 'mid', 'high']) expect(BUDGETS[t].tier).toBe(t);
  });

  it('draws ultra sharper than the screen on a plain monitor, under the scene’s own cap', () => {
    // (no window under test: the screen's ratio is 1)
    expect(pixelRatio(2, 'ultra')).toBe(1.5);
    expect(pixelRatio(1, 'ultra')).toBe(1);
  });

  it('supersamples a high-tier desktop a quarter over a plain monitor, as Active Theory does', () => {
    // (no window under test: the screen's ratio is 1)
    expect(pixelRatio(2, 'high')).toBe(1.25);
    expect(pixelRatio(1, 'high')).toBe(1);
    // phones and weak devices draw at the screen's own pixels at most
    expect(pixelRatio(2, 'mid')).toBe(1);
    expect(pixelRatio(2, 'low')).toBe(1);
  });
});

describe('whether a world asks before it loads', () => {
  const desktop = classifyDevice({ ua: WINDOWS, memory: 16 });
  const phone = classifyDevice({ ua: IPHONE, coarse: true, screen: 390 });
  const weak = classifyDevice({ ua: PIXEL, coarse: true, memory: 2 });
  const saver = classifyDevice({ ua: WINDOWS, memory: 16, saveData: true });

  it('never asks a desktop', () => {
    expect(worldCheck(12, desktop)).toEqual({ ask: false, why: null });
  });

  it('lets a phone load light worlds and asks about heavy ones', () => {
    expect(worldCheck(2, phone).ask).toBe(false);
    expect(worldCheck(10, phone)).toEqual({ ask: true, why: 'phone' });
  });

  it('asks a weak device about anything but the lightest', () => {
    expect(worldCheck(2, weak)).toEqual({ ask: true, why: 'weak' });
    expect(worldCheck(0.5, weak).ask).toBe(false);
  });

  it('asks whenever the visitor is saving data', () => {
    expect(worldCheck(2, saver)).toEqual({ ask: true, why: 'data' });
  });

  it('asks when there is too little room left', () => {
    expect(worldCheck(6, desktop, 10)).toEqual({ ask: true, why: 'storage' });
    expect(worldCheck(6, desktop, 5000).ask).toBe(false);
  });
});

describe('the renderer tier kept beside the quality level', () => {
  const store = new Map();
  const at = (search = '', hash = '') => vi.stubGlobal('window', { location: { search, hash }, localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null) } });
  beforeEach(() => store.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('is null until the probe has kept one, then the kept one', () => {
    at();
    expect(rendererTier()).toBeNull();
    store.set('tp-tier', JSON.stringify({ tier: 'T1', info: { vendor: 'nvidia', architecture: 'blackwell' } }));
    expect(rendererTier()).toBe('T1');
  });

  it('is the address’s ?tier= over the kept one', () => {
    store.set('tp-tier', JSON.stringify({ tier: 'T1', info: {} }));
    at('', '#/universe?tier=T2');
    expect(rendererTier()).toBe('T2');
  });

  it('is null where there is no window (Node, a worker)', () => {
    vi.stubGlobal('window', undefined);
    expect(rendererTier()).toBeNull();
  });
});

describe('the quality mode the visitor chose', () => {
  const store = new Map();
  const events = [];
  beforeEach(() => {
    store.clear();
    events.length = 0;
    vi.stubGlobal('window', {
      location: { search: '', hash: '' },
      localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
      navigator: { userAgent: WINDOWS, deviceMemory: 16, hardwareConcurrency: 8 },
      screen: { width: 1920, height: 1080 },
      innerWidth: 1920,
      dispatchEvent: (e) => events.push(e),
    });
    resetDevice();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetDevice();
  });

  it('is Auto with nothing kept, at what Auto picks here', () => {
    expect(quality()).toEqual({ mode: 'auto', level: 'ultra', auto: 'ultra', pinned: false });
  });

  it('keeps a picked level, says so, and tells the page', () => {
    setQuality('mid');
    expect(store.get('tp-quality')).toBe('mid');
    expect(quality()).toEqual({ mode: 'mid', level: 'mid', auto: 'ultra', pinned: false });
    expect(events.at(-1).type).toBe('tp:quality');
    expect(events.at(-1).detail).toBe('mid');
  });

  it('goes back to Auto by forgetting the pick', () => {
    setQuality('low');
    setQuality('auto');
    expect(store.has('tp-quality')).toBe(false);
    expect(quality().mode).toBe('auto');
    expect(events.at(-1).detail).toBe('ultra');
  });

  it('ignores a mode it doesn’t know', () => {
    setQuality('max');
    expect(store.has('tp-quality')).toBe(false);
    expect(events).toHaveLength(0);
  });

  it('lets the address win over what is kept', () => {
    store.set('tp-quality', 'low');
    window.location.search = '?quality=high';
    resetDevice();
    expect(quality()).toMatchObject({ mode: 'high', level: 'high', pinned: true });
  });

  it('reads the sharpness, held between half and twice', () => {
    expect(sharpness()).toBe(1);
    store.set('tp-sharpness', '1.5');
    expect(sharpness()).toBe(1.5);
    store.set('tp-sharpness', '9');
    expect(sharpness()).toBe(2);
    store.set('tp-sharpness', 'soft');
    expect(sharpness()).toBe(1);
  });

  it('asks before a big download only while the visitor wants it asked', () => {
    const phone = classifyDevice({ ua: IPHONE, coarse: true, screen: 390 });
    expect(worldCheck(10, phone).ask).toBe(true);
    store.set('tp-ask-download', 'off');
    expect(worldCheck(10, phone).ask).toBe(false);
    // (too little room still asks: the download wouldn't fit)
    expect(worldCheck(10, phone, 5).ask).toBe(true);
  });
});

describe('budget with the video settings (lane V1)', () => {
  it('multisampling and anisotropy under the row’s own, never over it', () => {
    expect(budget('high', { msaa: 2, anisotropy: 4 })).toMatchObject({ samples: 2, aniso: 4 });
    expect(budget('mid', { msaa: 8, anisotropy: 16 })).toMatchObject({ samples: 2, aniso: 4 });
    expect(budget('high', {})).toBe(BUDGETS.high);
    expect(budget('high', null)).toBe(BUDGETS.high);
  });
});

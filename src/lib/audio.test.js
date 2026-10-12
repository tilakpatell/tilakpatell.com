import process from 'node:process';
import { afterEach, describe, expect, it, vi } from 'vitest';

function page() {
  const kept = new Map();
  const localStorage = {
    getItem: (k) => (kept.has(k) ? kept.get(k) : null),
    setItem: (k, v) => kept.set(k, String(v)),
    removeItem: (k) => kept.delete(k),
  };
  vi.stubGlobal('window', { localStorage, addEventListener() {} });
  return kept;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.useRealTimers();
});

describe('the voices switch', () => {
  it('is on until it’s switched off, and stays as it was left', async () => {
    const kept = page();
    const { setVoicesOn, voicesOn } = await import('./audio');
    expect(voicesOn()).toBe(true);
    setVoicesOn(false);
    expect(voicesOn()).toBe(false);
    expect(kept.get('tp-voices')).toBe('off');
    setVoicesOn(true);
    expect(voicesOn()).toBe(true);
    expect(kept.has('tp-voices')).toBe(false);
  });

  it('tells whoever’s listening', async () => {
    page();
    const { onVoicesChange, setVoicesOn } = await import('./audio');
    const heard = [];
    const stop = onVoicesChange((on) => heard.push(on));
    setVoicesOn(false);
    stop();
    setVoicesOn(true);
    expect(heard).toEqual([false]);
  });
});

describe('loading a sound', () => {
  // a context whose decoder answers as a browser's does: the callbacks and a promise
  const withDecoder = (decode) => {
    const node = () => ({ connect: (to) => to, gain: { value: 1 }, threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} });
    class AudioContext {
      state = 'running';
      destination = {};
      createGain = node;
      createDynamicsCompressor = node;
      decodeAudioData = decode;
    }
    const kept = new Map();
    vi.stubGlobal('window', { localStorage: { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v), removeItem: (k) => kept.delete(k) }, addEventListener() {}, AudioContext });
    vi.stubGlobal('fetch', () => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }));
  };

  it('gives the decoded buffer once a URL', async () => {
    let calls = 0;
    withDecoder((data, ok) => {
      calls += 1;
      const buf = { bytes: data.byteLength };
      ok(buf);
      return Promise.resolve(buf);
    });
    const { loadBuffer } = await import('./audio');
    await expect(loadBuffer('/audio/a.mp3')).resolves.toEqual({ bytes: 8 });
    await loadBuffer('/audio/a.mp3');
    expect(calls).toBe(1);
  });

  it('fails for bytes that are not audio, with no rejection left unheard, and may be asked again', async () => {
    const unheard = [];
    const on = (e) => unheard.push(e);
    process.on('unhandledRejection', on);
    let calls = 0;
    withDecoder((data, ok, no) => {
      calls += 1;
      const e = Object.assign(new Error('Unable to decode audio data'), { name: 'EncodingError' });
      no(e);
      return Promise.reject(e);
    });
    const { loadBuffer } = await import('./audio');
    await expect(loadBuffer('/audio/page.mp3')).rejects.toMatchObject({ name: 'EncodingError' });
    await new Promise((r) => setTimeout(r, 0));
    await expect(loadBuffer('/audio/page.mp3')).rejects.toMatchObject({ name: 'EncodingError' });
    await new Promise((r) => setTimeout(r, 0));
    process.off('unhandledRejection', on);
    expect(calls).toBe(2);
    expect(unheard).toEqual([]);
  });
});

describe('waiting for the sound to be running', () => {
  const context = (state) => {
    const ac = { state, on: null, addEventListener: (t, fn) => (ac.on = fn), removeEventListener: () => (ac.on = null) };
    return ac;
  };

  it('goes at once when it is', async () => {
    const { whenRunning } = await import('./audio');
    await expect(whenRunning(context('running'), 1000)).resolves.toBe(true);
  });

  it('goes when it starts, and gives up when it doesn’t', async () => {
    vi.useFakeTimers();
    const { whenRunning } = await import('./audio');
    const ac = context('suspended');
    const started = whenRunning(ac, 1000);
    ac.state = 'running';
    ac.on();
    await expect(started).resolves.toBe(true);
    const never = whenRunning(context('suspended'), 1000);
    await vi.advanceTimersByTimeAsync(1001);
    await expect(never).resolves.toBe(false);
  });
});

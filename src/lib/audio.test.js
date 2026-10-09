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

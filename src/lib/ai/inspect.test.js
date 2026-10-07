import { afterEach, describe, expect, it } from 'vitest';
import { current, flags, onChange, register, unregister } from './inspect';
import { createTrace } from './trace';

afterEach(() => {
  unregister('universe');
  unregister('cybertron');
});

describe('the registry', () => {
  it('register replaces and notifies, unregister clears', () => {
    const seen = [];
    const off = onChange((now) => seen.push(now && now.worldId));
    expect(current()).toBeNull();
    const trace = createTrace();
    register('universe', { trace });
    expect(current().worldId).toBe('universe');
    expect(current().trace).toBe(trace);
    expect(current().actors).toBeInstanceOf(Map);
    expect(current().agents()).toEqual([]);
    register('cybertron', { trace: createTrace() });
    expect(current().worldId).toBe('cybertron');
    unregister('cybertron');
    expect(current()).toBeNull();
    off();
    register('universe', { trace });
    expect(seen).toEqual(['universe', 'cybertron', null]);
  });

  it('a stale unregister leaves the world that mounted since', () => {
    register('universe', { trace: createTrace() });
    register('cybertron', { trace: createTrace() });
    unregister('universe');
    expect(current().worldId).toBe('cybertron');
  });

  it('a dispose/mount pair can repeat', () => {
    let calls = 0;
    const off = onChange(() => calls++);
    const trace = createTrace();
    for (let i = 0; i < 3; i++) {
      register('universe', { trace });
      unregister('universe');
    }
    unregister('universe');
    off();
    expect(calls).toBe(6);
    expect(current()).toBeNull();
  });

  it('a listener that throws doesn’t stop the others', () => {
    const seen = [];
    const off1 = onChange(() => {
      throw new Error('bad overlay');
    });
    const off2 = onChange((now) => seen.push(now.worldId));
    register('universe', { trace: createTrace() });
    off1();
    off2();
    expect(seen).toEqual(['universe']);
  });
});

describe('flags', () => {
  it('flags reads ?ai and ?seed from a given search string', () => {
    expect(flags({ search: '?ai=1&seed=42' })).toEqual({ ai: true, seed: 42 });
    expect(flags({ search: '?seed=-7' })).toEqual({ ai: false, seed: -7 });
    expect(flags({ search: '?ai=0&seed=x' })).toEqual({ ai: false, seed: null });
    expect(flags({ search: '' })).toEqual({ ai: false, seed: null });
  });

  it('localStorage tp-ai turns the overlay on', () => {
    const storage = { getItem: (k) => (k === 'tp-ai' ? '1' : null) };
    expect(flags({ search: '', storage })).toEqual({ ai: true, seed: null });
    const blocked = {
      getItem: () => {
        throw new Error('denied');
      },
    };
    expect(flags({ search: '?seed=3', storage: blocked })).toEqual({ ai: false, seed: 3 });
  });

  it('is safe where window is absent', () => {
    expect(flags()).toEqual({ ai: false, seed: null });
  });
});

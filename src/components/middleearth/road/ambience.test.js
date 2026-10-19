import { describe, expect, it, vi } from 'vitest';
import { LAYERS, fade, levelsBetween } from './ambience';
import { BAKED, SOURCES, bake } from './sounds';
import { STAGES } from './stages/index';

describe('the ambience’s table', () => {
  it('every stage has a layer or more, each a source the Road can make, at a level in (0, 1]', () => {
    for (const st of STAGES) {
      const layers = LAYERS[st.id];
      expect(layers?.length, st.id).toBeGreaterThan(0);
      for (const [name, level] of layers) {
        expect(SOURCES, `${st.id}: ${name}`).toContain(name);
        expect(level).toBeGreaterThan(0);
        expect(level).toBeLessThanOrEqual(1);
      }
    }
  });

  it('the brief’s sounds are there: Hobbiton’s birds, water and jig; Moria’s drum; Rivendell’s harp; Gorgoroth’s sub', () => {
    const names = (id) => LAYERS[id].map(([n]) => n);
    expect(names('hobbiton')).toEqual(expect.arrayContaining(['birds', 'water', 'jig']));
    expect(names('moria')).toContain('drum');
    expect(names('rivendell')).toContain('harp');
    expect(names('gorgoroth')).toContain('sub');
    expect(names('minas-tirith')).toContain('bell');
  });
});

describe('the cross-fade', () => {
  it('sums to 1 all the way across, from the old to the new', () => {
    for (let t = -0.5; t <= 1.5; t += 0.05) {
      const { from, to } = fade(t);
      expect(from + to).toBeCloseTo(1, 9);
      expect(from).toBeGreaterThanOrEqual(0);
      expect(to).toBeGreaterThanOrEqual(0);
    }
    expect(fade(0)).toEqual({ from: 1, to: 0 });
    expect(fade(1)).toEqual({ from: 0, to: 1 });
  });

  it('a source in both stages eases from its old level to its new; one in either alone fades in or out', () => {
    const a = [['water', 0.4], ['birds', 0.6]];
    const b = [['water', 0.8], ['harp', 0.5]];
    expect(levelsBetween(a, b, 0)).toEqual({ water: 0.4, birds: 0.6, harp: 0 });
    expect(levelsBetween(a, b, 1)).toEqual({ water: 0.8, birds: 0, harp: 0.5 });
    const mid = levelsBetween(a, b, 0.5);
    expect(mid.water).toBeCloseTo(0.6, 9);
    expect(mid.birds).toBeCloseTo(0.3, 9);
    expect(mid.harp).toBeCloseTo(0.25, 9);
  });
});

describe('the baked loops', () => {
  it('each is a loop of whole seconds, every sample a number within ±1, and not silent', () => {
    for (const name of BAKED) {
      const { data, rate } = bake(name, 8000);
      expect(data.length % rate, name).toBe(0);
      let peak = 0;
      for (const v of data) {
        expect(Number.isFinite(v), name).toBe(true);
        peak = Math.max(peak, Math.abs(v));
      }
      expect(peak, name).toBeLessThanOrEqual(1);
      expect(peak, name).toBeGreaterThan(0.05);
    }
  });

  it('is the same every time (seeded), so a loop never changes between rides', () => {
    expect(Array.from(bake('birds', 8000).data.slice(0, 64))).toEqual(Array.from(bake('birds', 8000).data.slice(0, 64)));
  });
});

describe('createAmbience without a context', () => {
  it('waits quietly for the first key: no bus, nothing made, nothing thrown', async () => {
    vi.resetModules();
    const { createAmbience } = await import('./ambience');
    const bus = vi.fn(() => null);
    const rt = { audio: { bus, context: () => null }, events: { emit: vi.fn() } };
    const amb = createAmbience(rt);
    amb.stage('hobbiton');
    amb.update(0.5);
    // (not even asked for before a key: the browser would refuse it every frame)
    expect(bus).not.toHaveBeenCalled();
    amb.wake();
    expect(bus).toHaveBeenCalled();
    amb.say('sam', 'Mr Frodo', 12);
    expect(rt.events.emit).toHaveBeenCalledWith('line', { who: 'sam', text: 'Mr Frodo', at: 12 });
    amb.dispose();
  });
});

describe('a clip that lands after the Road has stopped', () => {
  it('is stopped as it lands, not left playing', async () => {
    vi.resetModules();
    let land;
    const stop = vi.fn();
    vi.doMock('../../../lib/clips', () => ({ playClip: () => new Promise((r) => (land = () => r({ stop, ended: new Promise(() => {}) }))) }));
    const { createAmbience } = await import('./ambience');
    const amb = createAmbience({ audio: { bus: () => null }, events: { emit() {} } });
    const playing = amb.clip('worldIsChanged');
    amb.dispose();
    land();
    expect(await playing).toBe(null);
    expect(stop).toHaveBeenCalled();
    vi.doUnmock('../../../lib/clips');
  });
});

import { describe, expect, it } from 'vitest';
import { FADE, STRIDE, createTrails, drawInk, drawLife, placeName } from './mapInk';
import { createNight } from '../play/night';

// a canvas context that takes every call and draws nothing, counting what it was asked
function fakeContext() {
  const calls = {};
  const grad = { addColorStop() {} };
  return new Proxy(
    { calls, measureText: (t) => ({ width: String(t).length * 5 }), createRadialGradient: () => grad, createLinearGradient: () => grad },
    {
      get(t, k) {
        if (k in t) return t[k];
        return (...a) => {
          calls[k] = (calls[k] ?? 0) + 1;
          return a[0];
        };
      },
      set(t, k, v) {
        t[k] = v;
        return true;
      },
    },
  );
}

describe('the Map’s footprints', () => {
  it('lays a print every stride a figure walks, left and right by turns, and lets each fade', () => {
    const tr = createTrails();
    const v = { cx: 0, cz: 0, scale: 2, w: 300, h: 300 };
    const p = { id: 'ron', x: 0, z: 0, moving: true };
    const stride = STRIDE / v.scale;
    for (let i = 0; i <= 10; i++) {
      p.x = i * stride * 0.5;
      tr.lay([p], v, i * 0.1);
    }
    const prints = tr.prints('ron');
    expect(prints.length).toBe(5);
    expect(prints.map((f) => f.side)).toEqual([-1, 1, -1, 1, -1]);
    expect(prints[0].dx).toBeCloseTo(1);
    tr.lay([p], v, 1 + FADE + 0.01);
    expect(tr.prints('ron')).toHaveLength(0);
  });

  it('leaves no trail across a jump (a night slept through, a figure set down)', () => {
    const tr = createTrails();
    const v = { cx: 0, cz: 0, scale: 2, w: 300, h: 300 };
    tr.lay([{ id: 'a', x: 0, z: 0, moving: true }], v, 0);
    tr.lay([{ id: 'a', x: 500, z: 0, moving: true }], v, 0.1);
    expect(tr.prints('a')).toHaveLength(0);
  });

  it('draws the ink and everyone without a fault, at both of the Map’s scales', () => {
    const night = createNight({ timeOf: () => 3 * 24 + 22, weekOf: () => 4, me: () => ({ x: 0, z: 0, yaw: 0, moving: true }) });
    const s = night.view();
    for (const scale of [0.42, 2.6]) {
      const ctx = fakeContext();
      const v = { cx: 0, cz: -20, scale, w: 800, h: 560 };
      drawInk(ctx, v, { reveal: 0.5 });
      drawLife(ctx, v, { people: s.people, me: s.me, trails: createTrails(), now: 1, night: s.night });
      expect(ctx.calls.stroke).toBeGreaterThan(10);
      expect(ctx.calls.fillText).toBeGreaterThan(3);
    }
    expect(s.night).toBe(true);
    expect(s.people.find((p) => p.id === 'nick').ghost).toBe(true);
    expect(s.people.find((p) => p.id === 'filch').name).toBe('Argus Filch');
  });

  it('says where you are', () => {
    expect(placeName(-12, 11)).toBe('The Great Hall');
    expect(placeName(30, 450)).toBe('The south shore');
    expect(placeName(-250, -230)).toBe('Hagrid’s hut');
  });
});

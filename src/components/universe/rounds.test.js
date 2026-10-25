import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRounds } from './rounds';

describe('createRounds', () => {
  // (the halo's canvas, drawn on nothing: there's no DOM here)
  const g = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} };
  beforeAll(() => vi.stubGlobal('document', { createElement: () => ({ getContext: () => g }) }));
  afterAll(() => vi.unstubAllGlobals());
  it('clear() puts every round away (B11)', () => {
    const r = createRounds(new THREE.Group(), 3);
    const opts = { life: 2, punch: 8, damage: 30, homing: 2.4, targetId: null };
    r.launch(new THREE.Vector3(), [0, 0, -1], 30, opts);
    r.launch(new THREE.Vector3(1, 0, 0), [0, 0, -1], 30, opts);
    const on = () => r.list.filter((m) => m.visible).length;
    r.clear();
    const hit = vi.fn();
    const expire = vi.fn();
    expect([on(), r.fly(0.016, hit, expire, () => null), hit.mock.calls.length + expire.mock.calls.length]).toEqual([0, false, 0]);
  });
});

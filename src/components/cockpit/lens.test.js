import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LEVELS } from './levels';
import { lensAt, lensPass } from './lens';

const { mid, high, ultra } = LEVELS;

describe('the lens at a moment of the launch', () => {
  it('adds nothing at a level without one', () => {
    expect(lensAt({ lens: null, launching: true, throttle: 1, flash: 1 })).toEqual({ streak: 0, aberration: 0, glow: 0 });
  });

  it('keeps the light trails for the jump: none sat, none early, none at a level without taps', () => {
    expect(lensAt({ lens: ultra.lens, launching: false, throttle: 1 }).streak).toBe(0);
    expect(lensAt({ lens: ultra.lens, launching: true, throttle: 0.2 }).streak).toBe(0);
    expect(lensAt({ lens: mid.lens, launching: true, throttle: 1 }).streak).toBe(0);
    const full = lensAt({ lens: ultra.lens, launching: true, throttle: 1 }).streak;
    expect(full).toBeGreaterThan(0);
    expect(full).toBeLessThanOrEqual(0.12);
    // (the vehicle's share: the RV's drive takes none)
    expect(lensAt({ lens: ultra.lens, launching: true, throttle: 1, streak: 0 }).streak).toBe(0);
    expect(lensAt({ lens: ultra.lens, launching: true, throttle: 1, streak: 0.5 }).streak).toBeCloseTo(full / 2, 9);
  });

  it('parts the colours a hair at rest and more with speed', () => {
    const rest = lensAt({ lens: high.lens, launching: false }).aberration;
    expect(rest).toBeCloseTo(high.lens.aberration * 0.0003, 9);
    expect(lensAt({ lens: high.lens, launching: true, throttle: 1 }).aberration).toBeGreaterThan(rest * 4);
  });

  it('lights the glass with the jump and the flash, never past its cap', () => {
    expect(lensAt({ lens: ultra.lens, launching: false }).glow).toBe(0);
    const going = lensAt({ lens: ultra.lens, launching: true, throttle: 1 }).glow;
    const flash = lensAt({ lens: ultra.lens, launching: true, throttle: 1, flash: 1 }).glow;
    expect(going).toBeGreaterThan(0);
    expect(flash).toBeGreaterThan(going);
    expect(flash).toBeLessThanOrEqual(1.2 * ultra.lens.dirt);
  });
});

describe('the lens pass', () => {
  it('is three’s output pass with the lens in its shader, its taps written in', () => {
    const lens = lensPass(ultra.lens, { dirt: false });
    expect(lens.pass.isOutputPass).toBe(true);
    expect(lens.pass.material.fragmentShader).toContain(`i <= ${ultra.lens.taps}`);
    expect(lensPass(mid.lens, { dirt: false }).pass.material.fragmentShader).not.toContain('stepUv');
    lens.dispose();
  });

  it('smears nothing and shows no sun until it has the cockpit’s depth to tell the glass apart', () => {
    const lens = lensPass(ultra.lens, { dirt: false });
    const u = lens.pass.uniforms;
    lens.set({ focus: [0.5, 0.5], sun: { at: [0.3, 0.6], k: 1 } });
    expect(u.uFocusOn.value).toBe(0);
    expect(u.uSun.value.z).toBe(0);
    lens.set({ depth: new THREE.DepthTexture(4, 4) });
    lens.set({ focus: [0.4, 0.6], sun: { at: [0.3, 0.6], k: 0.8, size: 0.02 }, lift: 2 });
    expect(u.uFocusOn.value).toBe(1);
    expect(u.uFocus.value.toArray()).toEqual([0.4, 0.6]);
    expect(u.uSun.value.toArray()).toEqual([0.3, 0.6, 0.8, 0.02]);
    expect(u.uLift.value).toBe(2);
    // (nowhere to fly to, or no sun: off again)
    lens.set({ focus: null, sun: null });
    expect(u.uFocusOn.value).toBe(0);
    expect(u.uSun.value.z).toBe(0);
    lens.dispose();
  });
});

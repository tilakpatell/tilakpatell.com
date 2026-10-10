import { describe, expect, it } from 'vitest';
import lighting from '../../../data/bf2017/maps/hoth.lighting.json';
import { FOCUS_DEFAULT, dofFor, lensToDof, lensToFov, motionBlurFor, postFor } from './cinematic';

const sunny = lighting.rows.weathers.sunny;

describe('the lens', () => {
  it('35 mm on a 36 mm frame', () => {
    expect(lensToFov(35)).toBeCloseTo((2 * Math.atan(18 / 35) * 180) / Math.PI, 9);
    expect(lensToFov(50, 24)).toBeCloseTo((2 * Math.atan(12 / 50) * 180) / Math.PI, 9);
    expect(lensToFov(0)).toBeNull();
  });

  it('a camera’s focal length, aperture and focus to the depth of field', () => {
    const dof = lensToDof({ focalLength: 35, aperture: 8 });
    expect(dof.focus).toBe(FOCUS_DEFAULT);
    expect(dof.aperture).toBeCloseTo(0.035 / 8, 12);
    expect(lensToDof({ focalLength: 35, aperture: 8, focus: 40 }).focus).toBe(40);
    expect(lensToDof({}).aperture).toBe(0);
  });
});

describe('the post’s data', () => {
  it('motion blur from the weather on ultra and high, camera only', () => {
    expect(motionBlurFor(sunny, 'ultra')).toEqual({ kind: 'motionBlur', scale: 1, centered: false });
    expect(motionBlurFor(sunny, 'medium')).toBeNull();
    expect(motionBlurFor({ motionBlur: { MotionBlurEnable: false } }, 'ultra')).toBeNull();
    expect(motionBlurFor({}, 'ultra')).toBeNull();
  });

  it('depth of field only when a cinematic pose asks', () => {
    expect(dofFor({ at: [0, 0, 0] })).toBeNull();
    const pose = { dof: lensToDof({ focalLength: 35, aperture: 8 }) };
    expect(postFor({ weather: sunny, tier: 'high', pose }).map((p) => p.kind)).toEqual(['dof', 'motionBlur']);
    expect(postFor({ weather: sunny, tier: 'high' }).map((p) => p.kind)).toEqual(['motionBlur']);
  });
});

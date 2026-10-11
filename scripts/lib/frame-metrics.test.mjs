import { describe, expect, it } from 'vitest';
import { averageLinear, psnr, ssim, toLinear, toSrgb8 } from './frame-metrics.mjs';

// a 4 × 4 grey ramp, 0, 16 … 240, as sharp hands raw pixels over, and the
// same ramp lifted by 10 in every channel
const ramp = (lift = 0, channels = 3) => {
  const data = new Uint8Array(16 * channels);
  for (let i = 0; i < 16; i++) for (let c = 0; c < channels; c++) data[i * channels + c] = c === 3 ? 255 : i * 16 + lift;
  return { data, width: 4, height: 4, channels };
};

describe('PSNR', () => {
  it('is infinite for the same picture', () => {
    expect(psnr(ramp(), ramp())).toBe(Infinity);
  });

  it('is 10·log10(255² / 100) = 28.13 dB for every channel off by 10, alpha left out', () => {
    expect(psnr(ramp(), ramp(10))).toBeCloseTo(28.1308, 3);
    expect(psnr(ramp(0, 4), ramp(10, 4))).toBeCloseTo(28.1308, 3);
  });

  it('refuses two sizes', () => {
    expect(() => psnr(ramp(), { ...ramp(), width: 2, height: 8 })).toThrow(/two sizes/);
  });
});

describe('SSIM', () => {
  it('is 1 for the same picture', () => {
    expect(ssim(ramp(), ramp())).toBeCloseTo(1, 12);
  });

  // one 4 × 4 window: the means 120 and 130, the same spread, so the
  // structure and contrast terms are 1 and SSIM is the luminance term,
  // (2·120·130 + C1) / (120² + 130² + C1), C1 = (0.01·255)² = 6.5025
  it('is the luminance term alone for a ramp lifted by 10: 0.996806', () => {
    expect(ssim(ramp(), ramp(10), { window: 4 })).toBeCloseTo((2 * 120 * 130 + 6.5025) / (120 ** 2 + 130 ** 2 + 6.5025), 10);
    expect(ssim(ramp(), ramp(10), { window: 4 })).toBeCloseTo(0.996806, 6);
  });

  it('falls for a picture with its structure turned round', () => {
    const flipped = ramp();
    flipped.data.reverse();
    expect(ssim(ramp(), flipped, { window: 4 })).toBeLessThan(0);
  });

  it('takes a window no larger than the picture', () => {
    expect(ssim(ramp(), ramp(10))).toBeCloseTo(ssim(ramp(), ramp(10), { window: 4 }), 12);
  });
});

describe('the average in linear light', () => {
  it('turns sRGB to linear and back to the same byte', () => {
    for (const v of [0, 1, 10, 55, 128, 200, 255]) expect(toSrgb8(toLinear(v))).toBe(v);
  });

  it('averages black and white to linear ½, which is sRGB 188, not 128', () => {
    const black = { data: new Uint8Array([0, 0, 0]), width: 1, height: 1, channels: 3 };
    const white = { data: new Uint8Array([255, 255, 255]), width: 1, height: 1, channels: 3 };
    const avg = averageLinear([black, white]);
    expect([...avg.data]).toEqual([188, 188, 188]);
    expect(avg).toMatchObject({ width: 1, height: 1, channels: 3 });
  });

  it('refuses nothing to average and two sizes', () => {
    expect(() => averageLinear([])).toThrow();
    expect(() => averageLinear([ramp(), { ...ramp(), width: 2, height: 8 }])).toThrow(/two sizes/);
  });
});

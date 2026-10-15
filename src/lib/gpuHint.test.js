import { describe, expect, it } from 'vitest';
import { browserOf, builtIn, chipName, gpuHint, osOf } from './gpuHint';

const R740M = 'ANGLE (AMD, AMD Radeon(TM) 740M Graphics (0x000015BF) Direct3D11 vs_5_0 ps_5_0, D3D11)';
const APU = 'ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)';
const UHD = 'ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)';
const IRIS = 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)';
const ARC_BUILT_IN = 'ANGLE (Intel, Intel(R) Arc(TM) Graphics (0x00007D55) Direct3D11 vs_5_0 ps_5_0, D3D11)';
const ARC_CARD = 'ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics (0x000056A0) Direct3D11 vs_5_0 ps_5_0, D3D11)';
const RTX = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5090 (0x00002B85) Direct3D11 vs_5_0 ps_5_0, D3D11)';
const RX = 'ANGLE (AMD, AMD Radeon RX 6700 XT (0x000073DF) Direct3D11 vs_5_0 ps_5_0, D3D11)';
const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

describe('the built-in graphics, by name', () => {
  it('knows a processor’s own graphics from a card', () => {
    for (const s of [R740M, APU, UHD, IRIS, ARC_BUILT_IN, 'Intel(R) HD Graphics 520', 'AMD Radeon Vega 8 Graphics', 'Mesa Intel(R) UHD Graphics 620 (KBL GT2)']) expect(builtIn(s), s).toBe(true);
    for (const s of [RTX, RX, ARC_CARD, 'AMD Radeon Pro 5500M', 'Apple M3', 'Adreno (TM) X1-85', 'Google SwiftShader', '']) expect(builtIn(s), s).toBe(false);
  });

  it('reads the chip’s name out of ANGLE’s string, its marks gone', () => {
    expect(chipName(R740M)).toBe('AMD Radeon 740M Graphics');
    expect(chipName(UHD)).toBe('Intel UHD Graphics 620');
    expect(chipName(IRIS)).toBe('Intel Iris Xe Graphics');
    expect(chipName('Intel(R) UHD Graphics, or similar')).toBe('Intel UHD Graphics, or similar');
  });
});

describe('the system and the browser', () => {
  it('reads the system from the client hints first, then the user agent', () => {
    expect(osOf({ ua: WIN, platform: 'Windows' })).toBe('windows');
    expect(osOf({ ua: WIN })).toBe('windows');
    expect(osOf({ ua: 'Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/131.0' })).toBe('linux');
    expect(osOf({ ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/141.0' })).toBe('android');
    expect(osOf({ ua: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) Chrome/141.0' })).toBe('chromeos');
    expect(osOf({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15' })).toBe('mac');
    expect(osOf({ platform: 'macOS' })).toBe('mac');
  });

  it('tells Edge from Chrome, and Firefox from both', () => {
    expect(browserOf(WIN)).toBe('chrome');
    expect(browserOf(`${WIN} Edg/141.0.0.0`)).toBe('edge');
    expect(browserOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0')).toBe('firefox');
  });
});

describe('the hint', () => {
  it('is given on Windows or Linux where the chip drawing is a built-in one', () => {
    expect(gpuHint({ renderer: R740M, os: 'windows' })).toEqual({ chip: 'AMD Radeon 740M Graphics', os: 'windows' });
    expect(gpuHint({ renderer: UHD, os: 'linux' })?.os).toBe('linux');
  });

  it('is not given on a card, a phone, a Mac, a software renderer, or for a chip already told', () => {
    expect(gpuHint({ renderer: RTX, os: 'windows' })).toBeNull();
    expect(gpuHint({ renderer: R740M, os: 'windows', phone: true })).toBeNull();
    expect(gpuHint({ renderer: IRIS, os: 'mac' })).toBeNull();
    expect(gpuHint({ renderer: UHD, os: 'windows', software: true })).toBeNull();
    expect(gpuHint({ renderer: R740M, os: 'windows', kept: 'AMD Radeon 740M Graphics' })).toBeNull();
    // (another chip than the one told: told again)
    expect(gpuHint({ renderer: UHD, os: 'windows', kept: 'AMD Radeon 740M Graphics' })).not.toBeNull();
  });
});

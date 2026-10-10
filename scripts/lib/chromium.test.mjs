import { describe, expect, it } from 'vitest';
import { adapterFor, angleFor, findChromium, launchArgs, WIN_BROWSERS } from './chromium.mjs';

describe('findChromium', () => {
  it('takes CHROMIUM, then CHROME, before looking', () => {
    expect(findChromium({ env: { CHROMIUM: '/a' }, platform: 'linux', exists: () => false, list: () => [] })).toBe('/a');
    expect(findChromium({ env: { CHROME: '/b' }, platform: 'win32', exists: () => false })).toBe('/b');
  });
  it('finds Edge on Windows when Chrome is not there', () => {
    const edge = WIN_BROWSERS[2];
    expect(findChromium({ env: {}, platform: 'win32', exists: (p) => p === edge })).toBe(edge);
    expect(findChromium({ env: {}, platform: 'win32', exists: () => false })).toBeNull();
  });
  it('takes the newest Playwright Chromium on Linux', () => {
    const exists = (p) => p.includes('chromium-1194');
    expect(findChromium({ env: {}, platform: 'linux', exists, list: () => ['chromium-1100', 'chromium-1194', 'ffmpeg-1'] })).toBe('/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
  });
});

describe('angleFor and adapterFor', () => {
  it('is the platform’s own backend unless ANGLE says', () => {
    expect(angleFor({ env: {}, platform: 'win32' })).toBe('d3d11');
    expect(angleFor({ env: {}, platform: 'darwin' })).toBe('metal');
    expect(angleFor({ env: {}, platform: 'linux' })).toBe('swiftshader');
    expect(angleFor({ env: { ANGLE: 'vulkan' }, platform: 'win32' })).toBe('vulkan');
  });
  it('is software only on a Linux box with no display', () => {
    expect(adapterFor({ env: {}, platform: 'linux' })).toBe('swiftshader');
    expect(adapterFor({ env: { DISPLAY: ':0' }, platform: 'linux' })).toBe('system');
    expect(adapterFor({ env: {}, platform: 'win32' })).toBe('system');
    expect(adapterFor({ adapter: 'swiftshader', env: {}, platform: 'win32' })).toBe('swiftshader');
  });
});

describe('launchArgs', () => {
  it('puts Windows on D3D11 for GL and leaves WebGPU to D3D12', () => {
    const args = launchArgs({ angle: 'd3d11', webgpu: true, platform: 'win32' });
    expect(args).toContain('--use-angle=d3d11');
    expect(args).toContain('--enable-unsafe-webgpu');
    expect(args).toContain('--disable-blink-features=WebGPUExperimentalFeatures');
    expect(args).not.toContain('--enable-features=Vulkan');
    expect(args).not.toContain('--enable-unsafe-swiftshader');
  });
  it('asks for SwiftShader’s adapter only when told, and the Vulkan feature off Windows', () => {
    const args = launchArgs({ angle: 'swiftshader', webgpu: true, adapter: 'swiftshader', platform: 'linux' });
    expect(args).toContain('--use-webgpu-adapter=swiftshader');
    expect(args).toContain('--enable-features=Vulkan');
    expect(args).toContain('--enable-unsafe-swiftshader');
    expect(launchArgs({ angle: 'metal', platform: 'darwin' })).not.toContain('--enable-unsafe-webgpu');
  });
  it('uncaps the frame rate when asked', () => {
    expect(launchArgs({ uncapped: true })).toEqual(expect.arrayContaining(['--disable-gpu-vsync', '--disable-frame-rate-limit']));
    expect(launchArgs({})).not.toContain('--disable-gpu-vsync');
  });
});

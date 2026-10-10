// Which Chromium a shot script drives, and the flags that put it on the
// machine's own graphics chip: one answer for scripts/light-fixture.mjs,
// scripts/gpu-parity.mjs and scripts/perf-probe.mjs, so a run on the
// owner's laptop (Windows, Edge, an NVIDIA chip) measures the chip and not
// SwiftShader, which is what the Linux cloud has and what these scripts
// once asked for everywhere but a Mac.
//
//   findChromium({ env, platform, exists, list }) → path | null
//     CHROMIUM, then CHROME, then on Windows the owner's Chrome or Edge, on
//     a Mac Playwright's Chrome for Testing, on Linux /opt/pw-browsers.
//   angleFor({ env, platform }) → 'metal' | 'd3d11' | 'swiftshader' | …
//     ANGLE= wins; else the platform's own backend (Metal on a Mac, D3D11
//     on Windows, SwiftShader elsewhere, where there is no display).
//   launchArgs({ angle, webgpu, adapter, uncapped, platform }) → string[]
//     the GL backend; WebGPU on with Blink's experimental IDL off (its draft
//     texture-view swizzle throws on three's every frame) and the Vulkan
//     feature where Chromium wants it (not on Windows, whose WebGPU is
//     D3D12); SwiftShader's WebGPU adapter when asked; no vsync and no
//     frame-rate cap when `uncapped`, so a frame's time is what it cost.
//
// Pure (the file system comes in as functions), tested beside.

import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';

export const WIN_BROWSERS = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'];
export const MAC_PLAYWRIGHT = `${homedir()}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
export const LINUX_BROWSERS = '/opt/pw-browsers';

export function findChromium({ env = process.env, platform = process.platform, exists = existsSync, list = listDir } = {}) {
  if (env.CHROMIUM) return env.CHROMIUM;
  if (env.CHROME) return env.CHROME;
  if (platform === 'win32') return WIN_BROWSERS.find(exists) ?? null;
  if (platform === 'darwin') return exists(MAC_PLAYWRIGHT) ? MAC_PLAYWRIGHT : null;
  const dirs = list(LINUX_BROWSERS).filter((d) => /^chromium-\d+$/.test(d));
  return dirs.map((d) => `${LINUX_BROWSERS}/${d}/chrome-linux/chrome`).find(exists) ?? null;
}

const listDir = (dir) => {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
};

export function angleFor({ env = process.env, platform = process.platform } = {}) {
  if (env.ANGLE) return env.ANGLE;
  if (platform === 'darwin') return 'metal';
  if (platform === 'win32') return 'd3d11';
  return 'swiftshader';
}

// adapter: 'system' (the chip), 'swiftshader' (software), or 'auto'
// (software on Linux without a display, the chip elsewhere)
export function adapterFor({ adapter = 'auto', env = process.env, platform = process.platform } = {}) {
  if (adapter === 'system' || adapter === 'swiftshader') return adapter;
  return platform === 'linux' && !env.DISPLAY ? 'swiftshader' : 'system';
}

export function launchArgs({ angle = 'swiftshader', webgpu = false, adapter = 'system', uncapped = false, platform = process.platform } = {}) {
  const args = ['--use-gl=angle', `--use-angle=${angle}`];
  if (angle === 'swiftshader') args.push('--enable-unsafe-swiftshader');
  if (webgpu) {
    args.push('--enable-unsafe-webgpu', '--disable-blink-features=WebGPUExperimentalFeatures');
    if (platform !== 'win32') args.push('--enable-features=Vulkan');
    if (adapter === 'swiftshader') args.push('--use-webgpu-adapter=swiftshader');
  }
  args.push('--ignore-gpu-blocklist', '--enable-webgl');
  if (uncapped) args.push('--disable-gpu-vsync', '--disable-frame-rate-limit');
  return args;
}

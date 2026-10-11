// The runtime's public surface: runtime() is the one runtime of the page
// visit, made the first time a world asks and kept across routes; useWorld
// puts a module on it from a page; WorldHost is the box it draws in;
// fromScene wraps a scene module written for lib/three/useScene; rt.install
// (installer()) fetches a world's pack into the cache. The settings panel's
// quality and sharpness reach the world that's up through window events
// ('tp:quality', 'tp:sharpness').
//
// Nothing here imports three.js: the backends and the loaders come in
// through browser.js on the first mount, so a page that never draws a
// world never downloads them.

import { createInput } from './input';
import { createQuality } from './quality';
import { readFps } from './cadence';
import { createPace } from '../lib/three/pace';
import { localSaves, worldStore, winOf } from './local';
import { createAssets } from './assets';
import { createAudioBus } from './audio';
import { createRuntime } from './runtime';
import { createWorkerPool, poolSize } from './workers';
import { readOverride } from './backend';
import { device, quality } from '../lib/device';
import { read as readVideo, resolve as resolveVideo } from '../lib/video';
import { installer } from './install';
import './runtime.css';

// lib/video.js's values as this device may draw them (its detail the ceiling)
const videoNow = () => resolveVideo(readVideo(undefined, quality().level), { ceiling: device().detail }).values;

export { usePrepareProgress, useWorld } from './useWorld';
export { default as WorldHost } from './WorldHost';
export { fromScene } from './module';
export { localSaves, worldStore };
export { installer } from './install';
export { createLook, defaultMode, senseLook, SPIKE, RELOCK, TP_LOOK, PROMPT as LOOK_PROMPT } from './look';
export { createDebug } from './debug';

const GPU_KEY = 'tp-gpu';
const browser = () => import('./browser');
const covered = () => typeof document !== 'undefined' && 'covered' in document.documentElement.dataset;

let instance = null;

// The runtime if a world has made it, without making one (the settings
// panel's readout reads its renderer's counts).
export const peekRuntime = () => instance;

export function runtime() {
  if (instance) return instance;
  const win = winOf();
  let stored = null;
  try {
    stored = win?.localStorage.getItem(GPU_KEY);
  } catch {
    /* storage unavailable */
  }
  const loaders = {
    texture: (url, opts) => browser().then((m) => m.loaders.texture(url, { renderer: instance?.gfx?.renderer ?? null, ...opts })),
    gltf: (url, opts) => browser().then((m) => m.loaders.gltf(url, { renderer: instance?.gfx?.renderer ?? null, ...opts })),
    audio: (url) => browser().then((m) => m.loaders.audio(url)),
  };
  const forget = {
    texture: (url) => browser().then((m) => m.forget.texture(url)),
    gltf: (url) => browser().then((m) => m.forget.gltf(url)),
  };
  instance = createRuntime({
    // (`invalidate`: the frame guard asks for a frame when what it held back is ready)
    makeBackend: (kind, opts) => browser().then((m) => m.makeBackend(kind, { ...opts, invalidate: () => instance?.invalidate() })),
    input: createInput(),
    // (down only: each step resizes the canvas, lib/three/pace's `climb`; the
    // least ratio is the budget row's own, quality.js's `minRatio`)
    quality: createQuality({ dpr: win?.devicePixelRatio || 1, pace: createPace({ climb: false }) }),
    saves: localSaves(),
    store: worldStore(),
    assets: createAssets({ loaders, forget }),
    audio: createAudioBus(),
    workers: createWorkerPool({ size: poolSize(win?.navigator?.hardwareConcurrency) }),
    // the visitor's video settings, resolved under this device's ceiling (lane V1)
    video: videoNow(),
    gpu: Boolean(win?.navigator?.gpu),
    override: readOverride(win?.location.search ?? '', win?.location.hash ?? '', stored),
    visible: () => !(typeof document !== 'undefined' && document.hidden) && !covered(),
    // (?calibrate=off: the QA scripts measure at the sharpest step, not a chip's own)
    // (a visitor who pins 30: every second beat, the controller's 33.3 ms budget)
    fps: readFps(win),
    calibrate: !/[?&]calibrate=off\b/.test(`${win?.location.search ?? ''}&${win?.location.hash ?? ''}`),
    // (the renderer tier, lib/gpuProbe: probed once on the first 'nodes' world)
    tier: (gfx) => browser().then((m) => m.rendererTier(gfx)),
  });
  // a world's install (install.js): the same one the gate and /worlds use
  instance.install = installer();
  if (win) {
    const wake = () => instance.invalidate();
    document.addEventListener('visibilitychange', wake);
    win.addEventListener('tp:uncover', wake);
    // (the settings panel: a quality level picked while a world is up goes
    // to it, and one that can't retune is offered a reload, 'tp:quality-
    // reload', which the panel shows and answers with 'tp:world-reload')
    win.addEventListener('tp:quality', (e) => {
      if (instance.requality(e.detail) === 'reload') win.dispatchEvent(new CustomEvent('tp:quality-reload', { detail: { level: e.detail, world: instance.current?.module?.id ?? null } }));
    });
    win.addEventListener('tp:world-reload', () => instance.reload());
    win.addEventListener('tp:sharpness', (e) => instance.sharpen(e.detail));
    // (a video control turned: the world that's up turns it, or is offered a reload)
    win.addEventListener('tp:video', () => {
      if (instance.revideo(videoNow()) === 'reload') win.dispatchEvent(new CustomEvent('tp:quality-reload', { detail: { level: device().detail, world: instance.current?.module?.id ?? null, video: true } }));
    });
    if (import.meta.env.DEV) win.__RUNTIME__ = instance; // for the QA scripts
  }
  return instance;
}

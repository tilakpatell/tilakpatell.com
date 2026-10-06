// The runtime's public surface: runtime() is the one runtime of the page
// visit, made the first time a world asks and kept across routes; useWorld
// puts a module on it from a page; WorldHost is the box it draws in;
// fromScene wraps a scene module written for lib/three/useScene.
//
// Nothing here imports three.js: the backends and the loaders come in
// through browser.js on the first mount, so a page that never draws a
// world never downloads them.

import { createInput } from './input';
import { createQuality } from './quality';
import { createSaves } from './saves';
import { createAssets } from './assets';
import { createAudioBus } from './audio';
import { createRuntime } from './runtime';
import { readOverride } from './backend';
import './runtime.css';

export { useWorld } from './useWorld';
export { default as WorldHost } from './WorldHost';
export { fromScene } from './module';

const GPU_KEY = 'tp-gpu';
const browser = () => import('./browser');
const covered = () => typeof document !== 'undefined' && 'covered' in document.documentElement.dataset;

let instance = null;

export function runtime() {
  if (instance) return instance;
  const win = typeof window !== 'undefined' ? window : null;
  const store = (name) => {
    try {
      return win[name];
    } catch {
      return null;
    }
  };
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
    makeBackend: (kind, opts) => browser().then((m) => m.makeBackend(kind, opts)),
    input: createInput(),
    quality: createQuality({ dpr: win?.devicePixelRatio || 1 }),
    saves: createSaves({ local: store('localStorage'), session: store('sessionStorage'), win }),
    assets: createAssets({ loaders, forget }),
    audio: createAudioBus(),
    gpu: Boolean(win?.navigator?.gpu),
    override: readOverride(win?.location.search ?? '', win?.location.hash ?? '', stored),
    visible: () => !(typeof document !== 'undefined' && document.hidden) && !covered(),
  });
  if (win) {
    const wake = () => instance.invalidate();
    document.addEventListener('visibilitychange', wake);
    win.addEventListener('tp:uncover', wake);
    if (import.meta.env.DEV) win.__RUNTIME__ = instance; // for the QA scripts
  }
  return instance;
}

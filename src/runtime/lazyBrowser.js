// The runtime's browser parts (./browser.js: the backends, the loaders, the
// GPU clock), loaded on the first mount so a page that never draws a world
// never downloads three.js, and what the runtime asks of them at once once
// they are in (index.js's one copy).
//
//   lazyBrowser(load) → { load() → Promise<the parts>, gpuClock(renderer) → clock | null }
// `gpuClock`: lane G1's clock (lib/three/gpuTime) for the governor (GPU-first
// lane N2), which the runtime asks for as a world starts, always after its
// backend was made through `load`; null before the parts are in. Lane L1:
// index.js never handed it over, and on the owner's RTX 5090 the frame gaps
// governed the picture (`quality.source` 'cpu').

export function lazyBrowser(load) {
  let loaded = null;
  return {
    load: () => load().then((m) => (loaded = m)),
    gpuClock: (renderer) => loaded?.gpuClock?.(renderer) ?? null,
  };
}

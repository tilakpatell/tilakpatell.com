// Which renderer the runtime makes, and why. Pure, so it can be tested.
//
// Three kinds. 'webgl' is the classic WebGLRenderer, and every 'glsl'
// module gets it, always: its ShaderMaterials, onBeforeCompile patches and
// EffectComposers run nowhere else. A 'nodes' module (its materials are
// TSL) never meets the classic renderer, which can't draw a node material:
// it gets 'webgpu' (WebGPURenderer on a WebGPU device) when the browser has
// WebGPU, and 'nodes-webgl' (the same renderer forced onto WebGL 2)
// everywhere else: no navigator.gpu, a device lost once (one downgrade,
// never a loop), or ?gpu=webgl. So the override picks between the two
// kinds a 'nodes' module can run on and does nothing for a 'glsl' one,
// which used to be handed WebGPU it couldn't draw on. The visitor sets it
// with ?gpu=webgl|webgpu in the address or localStorage 'tp-gpu'
// (readOverride); 'nodes-webgl' is the runtime's own, never asked for.

export const KINDS = ['webgl', 'webgpu', 'nodes-webgl'];

const ASKABLE = ['webgl', 'webgpu'];

export function pickBackend({ gpu = false, shading = 'glsl', override = null, lost = false } = {}) {
  if (shading !== 'nodes') return 'webgl';
  if (lost || !gpu || override === 'webgl') return 'nodes-webgl';
  return 'webgpu';
}

// What the settings panel says the world draws with, by kind.
export const RENDERER_NAMES = { webgpu: 'WebGPU', 'nodes-webgl': 'WebGL 2, node renderer', webgl: 'classic' };

// What a visitor is told of the picture they are seeing (the world's Menu,
// the settings panel): the renderer's name, whether it is the best this
// world draws, and what would give the best. A 'glsl' world has only the
// classic renderer, so classic is its best; a 'nodes' world never meets it
// (the Star Wars worlds among them), and its best is WebGPU: over WebGL 2
// it says why it is not and what to do.
//   rendererReport({ backend, gpu }) → { name, best, note } | null
export function rendererReport({ backend = null, gpu = false } = {}) {
  const name = RENDERER_NAMES[backend];
  if (!name) return null;
  if (backend === 'webgpu') return { name, best: true, note: 'The best picture: every layer on.' };
  if (backend === 'webgl') return { name, best: true, note: 'This world draws on the classic renderer.' };
  return { name, best: false, note: gpu ? 'WebGPU didn’t start here, so every layer is drawn more slowly over WebGL 2.' : 'This browser has no WebGPU, so every layer is drawn more slowly over WebGL 2. Chrome, Edge or Safari 26 draw it on WebGPU.' };
}

// ?gpu= in the search, or after the ? in the hash (the site uses hash
// routes), else what's stored.
export function readOverride(search = '', hash = '', stored = null) {
  const fromSearch = new URLSearchParams(search).get('gpu');
  const fromHash = new URLSearchParams(hash.split('?')[1] ?? '').get('gpu');
  const q = fromSearch ?? fromHash;
  if (ASKABLE.includes(q)) return q;
  if (q != null) return null; // asked for something that isn't a backend: nothing forced
  return ASKABLE.includes(stored) ? stored : null;
}

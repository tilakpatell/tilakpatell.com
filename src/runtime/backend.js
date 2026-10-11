// Which renderer the runtime makes, and why. Pure, so it can be tested.
//
// Three kinds. 'webgl' is the classic WebGLRenderer, and every 'glsl'
// module gets it, always: its ShaderMaterials, onBeforeCompile patches and
// EffectComposers run nowhere else. A 'nodes' module (its materials are
// TSL) never meets the classic renderer, which can't draw a node material
// (bar the low path a module brings itself, below): it gets 'webgpu'
// (WebGPURenderer on a WebGPU device) when the browser has WebGPU, and
// 'nodes-webgl' (the same renderer forced onto WebGL 2) everywhere else: no navigator.gpu, a device lost once (one downgrade,
// never a loop), or ?gpu=webgl. So the override picks between the two
// kinds a 'nodes' module can run on and does nothing for a 'glsl' one,
// which used to be handed WebGPU it couldn't draw on. The visitor sets it
// with ?gpu=webgl|webgpu|classic in the address or localStorage 'tp-gpu'
// (readOverride); 'nodes-webgl' is the runtime's own, never asked for.
//
// The quality level decides too, for a 'nodes' module that brings a classic
// path of its own (`classic: true`, the galaxy surface's looks/classic.js;
// the picture-everywhere design, §3.1, and the owner's word since: WebGPU
// is the renderer for everything by default). Where the browser has WebGPU
// the node renderer draws on it at every level. Without it, high and ultra
// take the node renderer over WebGL 2, and low and mid the classic renderer
// (the node chain over WebGL 2 costs about twice the classic frame, lane
// U's laptop tables, and a device without WebGPU at those levels is a phone
// or a weak machine). A 'nodes' module without a classic path (the
// Battlefront world, the fixtures) keeps the node renderer at every level.
// A tier not given is high, as it was before the levels counted.

export const KINDS = ['webgl', 'webgpu', 'nodes-webgl'];

// (?gpu=classic: the classic renderer for a module with a classic path, at any
// level: the parity shots, and the owner's check that the switch holds)
const ASKABLE = ['webgl', 'webgpu', 'classic'];

export const LEVELS = ['low', 'mid', 'high', 'ultra'];

export function pickBackend({ gpu = false, shading = 'glsl', override = null, lost = false, tier = 'high', classic = false } = {}) {
  if (shading !== 'nodes') return 'webgl';
  if (classic && override === 'classic') return 'webgl';
  const webgpu = gpu && !lost && override !== 'webgl';
  if (webgpu) return 'webgpu';
  return classic && (tier === 'low' || tier === 'mid') ? 'webgl' : 'nodes-webgl';
}

// What the settings panel says the world draws with, by kind.
export const RENDERER_NAMES = { webgpu: 'WebGPU', 'nodes-webgl': 'WebGL 2, node renderer', webgl: 'classic' };

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

// The one door to three's node renderer and its lighting addons for this
// folder. Every other file here is pure at module scope and reaches three
// through loadThree(), so a world that never lights this way never
// downloads the node renderer, TSL or an addon (the galaxy engine's design,
// "The light"). The modules load once and are shared.
//
// loadThree() → Promise<{ THREE, tsl, SunLight, SunLightNode, ClusteredLighting }>
// loadCSM() → Promise<CSMShadowNode> (lane S's cascades)
// registerLights(renderer) → Promise<renderer>: SunLight known to the node
//   renderer's library, once per renderer (idempotent)

let mods = null;

export function loadThree() {
  mods ??= Promise.all([
    import('three/webgpu'),
    import('three/tsl'),
    import('three/addons/lights/SunLight.js'),
    import('three/addons/lights/SunLightNode.js'),
    import('three/addons/lighting/ClusteredLighting.js'),
  ]).then(([THREE, tsl, sun, sunNode, clustered]) => ({
    THREE,
    tsl,
    SunLight: sun.SunLight,
    SunLightNode: sunNode.SunLightNode,
    ClusteredLighting: clustered.ClusteredLighting,
  }));
  return mods;
}

const registered = new WeakSet();

// (SunLight is not one of three's built-in lights: the node renderer has to
// be told which node draws it before the first frame that holds one)
export async function registerLights(renderer) {
  const { SunLight, SunLightNode } = await loadThree();
  if (!registered.has(renderer)) {
    renderer.library?.addLight?.(SunLightNode, SunLight);
    registered.add(renderer);
  }
  return renderer;
}

// a renderer is the WebGPU kind, or the node renderer on a WebGL 2 context
export const backendOf = (renderer) => (renderer?.backend?.isWebGLBackend ? 'nodes-webgl' : renderer?.isWebGPURenderer ? 'webgpu' : 'webgl');

// Lane S: CSMShadowNode (three/addons/csm) for the sun's four cascades,
// loaded with three the first time a sun casts through it.
let csm = null;
export function loadCSM() {
  csm ??= import('three/addons/csm/CSMShadowNode.js').then((m) => m.CSMShadowNode);
  return csm;
}

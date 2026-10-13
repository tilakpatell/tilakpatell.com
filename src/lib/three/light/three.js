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
    import('three/addons/tsl/lighting/ClusteredLightsNode.js'),
  ]).then(([THREE, tsl, sun, sunNode, clustered, clusteredNode]) => {
    fixClusteredCounts(clusteredNode.default);
    return {
      THREE,
      tsl,
      SunLight: sun.SunLight,
      SunLightNode: sunNode.SunLightNode,
      ClusteredLighting: clustered.ClusteredLighting,
    };
  });
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

// three r186's attributeArray(array, type) hands the array itself on as the
// storage buffer's count (nodes/accessors/Arrays.js: storage(buffer, type,
// count)), and ClusteredLightsNode makes its light-index buffer that way.
// WGSLNodeBuilder.getUniforms then asks `bufferCount > 0` of it in every
// shader that reads the buffer, which is every lit one: comparing a typed
// array with a number turns the whole array into text first. At 2,560 ×
// 1,440 the array is 76,800 long and the comparison 16 to 18 ms, in each
// stage of each build: 4 s of Hoth's load on the main thread. The count is
// made what three's own storage() would have set, the buffer's.
export function countAsNumber(node) {
  if (node && typeof node.bufferCount !== 'number') node.bufferCount = node.value?.count ?? 0;
  return node;
}

// (the node makes that buffer again whenever its grid grows, in create():
// the count is put right after each)
const fixed = new WeakSet();
export function fixClusteredCounts(ClusteredLightsNode) {
  const proto = ClusteredLightsNode?.prototype;
  if (!proto || typeof proto.create !== 'function' || fixed.has(proto)) return;
  fixed.add(proto);
  const create = proto.create;
  proto.create = function (...args) {
    const made = create.apply(this, args);
    countAsNumber(this._lightIndexes);
    return made;
  };
}

// The node renderer's two kinds: three/webgpu's WebGPURenderer, initialised
// before the first frame, with three/tsl's PostProcessing for a post chain
// described as data. 'webgpu' is it on a WebGPU device; 'nodes-webgl' is
// the same renderer forced onto a WebGL 2 context (forceWebGL), for a
// browser without WebGPU or after a device loss, so the same node
// materials draw either way. Only a 'nodes' module gets either (backend.js):
// neither can run a ShaderMaterial, an onBeforeCompile patch or an
// EffectComposer, so a 'shader' pass is refused here. A lost device, or a
// lost WebGL 2 context, is reported through onLost; the runtime comes back
// on 'nodes-webgl'. Tone-mapped the house’s way (Neutral) and bloomed by
// the house’s numbers (lib/three/bloom) unless a world says otherwise, as
// the WebGL backend is.
//
// createWebGPU(canvas, { budget, onLost, alpha, toneMapping, exposure, forceWebGL }) → Promise<gfx>

import * as THREE from 'three';
import { settle } from '../lib/settle';
import { BLOOM } from '../lib/three/bloom';
import { NODE_PASSES } from '../lib/three/light/post';
import { makeGfx } from './gfx';

export const hasWebGPU = () => typeof navigator !== 'undefined' && Boolean(navigator.gpu);

// the chain as data → a PostProcessing graph; `ready` resolves once the
// nodes are loaded, and render() draws nothing until then. A chain with any
// of the game light's passes goes to buildLitPost.
export function buildPostProcessing(renderer, passes) {
  if (passes.some((p) => NODE_PASSES.has(p.kind))) return buildLitPost(renderer, passes);
  let post = null;
  let scenePass = null;
  const ready = Promise.all([import('three/webgpu'), import('three/tsl'), import('three/addons/tsl/display/BloomNode.js')]).then(([webgpu, tsl, bloomMod]) => {
    post = new webgpu.PostProcessing(renderer);
    let node = null;
    for (const p of passes) {
      if (p.kind === 'render') {
        scenePass = tsl.pass(p.scene, p.camera);
        node = scenePass.getTextureNode();
      } else if (p.kind === 'bloom') {
        if (!node) throw new Error('a bloom pass needs a render pass first');
        node = node.add(bloomMod.bloom(node, p.strength ?? BLOOM.strength, p.radius ?? BLOOM.radius, p.threshold ?? BLOOM.threshold));
      } else if (p.kind === 'output') {
        // (the output transform is the renderer's own on this backend)
      } else if (p.kind === 'shader') throw new Error('a shader pass needs the webgl backend');
      else throw new Error(`unknown pass ${p.kind}`);
    }
    post.outputNode = node;
    return post;
  });
  return {
    ready,
    get passes() {
      return passes;
    },
    render: () => post?.render(),
    setSize: () => {},
    compile: () => settle(ready, 4000),
    dispose: () => {
      post?.dispose?.();
      scenePass?.dispose?.();
    },
  };
}

// The game light's chain (ssgi, denoise, ao, ssr, godrays, lensflare, lut,
// traa, smaa beside render, bloom and output: lib/three/light/post.js),
// built by lib/three/light/passes.js, the one place their addons are
// imported; the same face as buildPostProcessing's.
export function buildLitPost(renderer, passes) {
  let chain = null;
  let disposed = false;
  const ready = import('../lib/three/light/passes.js')
    .then(({ buildChain }) => buildChain(renderer, passes))
    .then((c) => {
      // (disposed before it was built: nothing of it is kept)
      if (disposed) c.dispose();
      else chain = c;
      return c.pipeline;
    });
  return {
    ready,
    get passes() {
      return passes;
    },
    render: () => chain?.pipeline.render(),
    setSize: () => {},
    compile: () => settle(ready, 4000),
    dispose: () => {
      disposed = true;
      chain?.dispose();
    },
  };
}

// The limits a device is asked for: the adapter's own values for the ones a
// world's chain can exceed at the defaults. Nothing when there is no WebGPU
// (the renderer then draws on WebGL 2) or the adapter will not say.
export const RAISED_LIMITS = ['maxColorAttachmentBytesPerSample', 'maxColorAttachments', 'maxStorageBuffersPerShaderStage'];
export async function adapterLimits(gpu = typeof navigator !== 'undefined' ? navigator.gpu : undefined) {
  try {
    const adapter = await gpu?.requestAdapter?.({ powerPreference: 'high-performance' });
    if (!adapter?.limits) return undefined;
    const limits = {};
    for (const k of RAISED_LIMITS) if (typeof adapter.limits[k] === 'number') limits[k] = adapter.limits[k];
    return Object.keys(limits).length ? limits : undefined;
  } catch {
    return undefined;
  }
}

export async function createWebGPU(canvas, { budget, onLost, alpha = true, toneMapping = THREE.NeutralToneMapping, exposure = 1, forceWebGL = false } = {}) {
  const { WebGPURenderer } = await import('three/webgpu');
  // A device is made with its adapter's own limits where the defaults are
  // tighter than the chip: a post chain's five colour targets cost more a
  // sample than the default 32 bytes on some chains, and a chip that can
  // take 128 should (the laptop's did not, and drew black, until asked).
  const requiredLimits = forceWebGL ? undefined : await adapterLimits();
  const renderer = new WebGPURenderer({ canvas, alpha, antialias: budget?.antialias ?? true, powerPreference: 'high-performance', forceWebGL, requiredLimits });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = toneMapping;
  renderer.toneMappingExposure = exposure;
  if (alpha) renderer.setClearColor(0x000000, 0);
  await renderer.init();
  // (three's renderer, asked for WebGPU and finding no adapter, quietly
  // draws on its WebGL 2 backend: that's the nodes-webgl kind, whatever
  // was asked, and the canvas is what says it's lost)
  const onWebGL = forceWebGL || Boolean(renderer.backend?.isWebGLBackend);
  let lost = false;
  let released = false; // (disposing destroys the device, and a destroyed device says it's lost: not a loss)
  const gone = () => {
    if (lost || released) return;
    lost = true;
    onLost?.();
  };
  // on WebGL 2 the canvas says when the context goes (as the classic
  // renderer's does); on WebGPU the device does
  const onContextLost = (e) => {
    e.preventDefault();
    gone();
  };
  if (onWebGL) canvas.addEventListener('webglcontextlost', onContextLost);
  else renderer.backend?.device?.lost?.then(gone);
  return makeGfx({
    backend: onWebGL ? 'nodes-webgl' : 'webgpu',
    renderer,
    canvas,
    compile: (root, camera, scene) => settle(renderer.compileAsync(root, camera, scene ?? root), 4000),
    upload: (root) =>
      root.traverse((o) => {
        for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
          for (const v of Object.values(m)) {
            if (v?.isTexture && v.image) {
              try {
                renderer.initTexture(v);
              } catch {
                /* it goes up on its first frame */
              }
            }
          }
        }
      }),
    post: (passes) => buildPostProcessing(renderer, passes),
    isLost: () => lost,
    release: () => {
      released = true;
      if (onWebGL) canvas.removeEventListener('webglcontextlost', onContextLost);
    },
  });
}

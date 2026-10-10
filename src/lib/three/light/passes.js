// The post chain as data (post.js) built into the node renderer's
// RenderPipeline: the one place the display addons are imported, each only
// when a chain names it. src/runtime/webgpu.js's buildPostProcessing hands
// a chain here when it holds a kind post.js's NODE_PASSES lists.
//
// The scene pass writes what the screen-space passes read, as three's own
// examples do: its colour, depth, view normals packed into eight bits, the
// diffuse colour (SSGI's bounce), velocity (TRAA) and metalness and
// roughness (SSR). Only what the chain reads is written.
//
// Each pass, in the chain's order, takes the colour so far:
// - ssgi: colour × its AO (unless an `ao` pass follows) + diffuse × its GI;
//   `denoise` after it filters the GI and composites again;
// - ao: GTAO at half resolution, denoised unless TRAA follows, multiplied in;
// - ssr: blended over (non-metals left out, SSRNode's default);
// - volumes: the level's volumetric cones and glows (volumetrics.js), their
//   quarter-resolution pass brought up over the depth and added;
// - fog: the record's forward light scattering added, its participating
//   media (when on) marched at FOG_SCALE and brought up over the depth
//   (fog.js's fogVolume);
// - bloom: added, the house's numbers unless the pass says;
// - godrays: the lit haze added faintly in the sun's colour;
// - lensflare: the bloom's ghosts, blurred, added; with the record's sun
//   flare, scaled by its alpha curves at the sun's disc (flare.js);
// - dof: DepthOfFieldNode at the cinematic camera's focus and range;
// - motionBlur: MotionBlur over the camera's own motion (the depth
//   reprojected through last frame's view and projection), times the
//   record's MotionBlurScale;
// - lut: the grading LUT (a Data3DTexture) applied to the tone-mapped,
//   encoded picture;
// - traa or smaa: the anti-aliasing; SMAA on the picture as shown, TRAA
//   before the output transform unless a LUT came first.
//
// buildChain(renderer, passes) → Promise<{ pipeline, nodes, dispose }>

import { BLOOM } from '../bloom.js';
import { OCCLUDER_DISC, OCCLUDER_TAPS } from './flare.js';
import { fogVolume } from './fog.js';
import { loadThree } from './three.js';

const ADDONS = {
  ssgi: () => import('three/addons/tsl/display/SSGINode.js'),
  denoise: () => import('three/addons/tsl/display/DenoiseNode.js'),
  ao: () => import('three/addons/tsl/display/GTAONode.js'),
  ssr: () => import('three/addons/tsl/display/SSRNode.js'),
  bloom: () => import('three/addons/tsl/display/BloomNode.js'),
  godrays: () => import('three/addons/tsl/display/GodraysNode.js'),
  lensflare: () => Promise.all([import('three/addons/tsl/display/LensflareNode.js'), import('three/addons/tsl/display/GaussianBlurNode.js')]).then(([a, b]) => ({ ...a, ...b })),
  lut: () => import('three/addons/tsl/display/Lut3DNode.js'),
  motionBlur: () => import('three/addons/tsl/display/MotionBlur.js'),
  dof: () => import('three/addons/tsl/display/DepthOfFieldNode.js'),
  traa: () => import('three/addons/tsl/display/TRAANode.js'),
  smaa: () => import('three/addons/tsl/display/SMAANode.js'),
};

// The record's sun flare's alpha at the sun's screen disc: OCCLUDER_TAPS
// depths within OCCLUDER_DISC of the sun's screen position, the share not at
// the far plane (the sky's) the coverage; each element's alpha curves at
// that coverage and at the sun's distance from the centre, the brightest
// taken (flare.js's flareAt, in the shader); 0 when the sun is behind.
function flareAlpha(tsl, THREE, p, depth, camera) {
  const { uniform, float, vec2, clamp, max, select, Fn } = tsl;
  const at = new THREE.Vector4();
  const dir = new THREE.Vector3(...p.sunDir).normalize();
  const v = new THREE.Vector4();
  const sun = uniform(at).onRenderUpdate(() => {
    v.set(dir.x, dir.y, dir.z, 0).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
    const w = Math.max(1e-6, v.w);
    at.set((v.x / w) * 0.5 + 0.5, (v.y / w) * 0.5 + 0.5, v.w, camera.aspect ?? 1);
    return at;
  });
  return Fn(() => {
    const uv = vec2(sun.x, sun.y.oneMinus());
    const covered = float(0).toVar();
    for (let i = 0; i < OCCLUDER_TAPS; i++) {
      const a = (i / OCCLUDER_TAPS) * Math.PI * 2;
      const r = OCCLUDER_DISC * Math.sqrt((i + 0.5) / OCCLUDER_TAPS);
      const tap = uv.add(vec2(Math.cos(a) * r, Math.sin(a) * r).div(vec2(sun.w, 1)));
      covered.addAssign(select(depth.sample(tap).r.lessThan(0.99999), float(1), float(0)));
    }
    const o = covered.div(OCCLUDER_TAPS);
    const s = clamp(uv.sub(0.5).length().mul(2), 0, 1);
    const c = (k, t) => {
      const [x, y, z, w] = k;
      return t.mul(x).add(y).mul(t).add(z).mul(t).add(w);
    };
    let alpha = float(0);
    for (const e of p.flare.elements) alpha = max(alpha, clamp(c(e.alphaOccluder, o), 0, 1).mul(clamp(c(e.alphaScreen, s), 0, 1)));
    return select(sun.z.greaterThan(0), alpha.mul(p.flare.dimmer), float(0));
  })();
}

// Where each pixel was on the screen a frame ago, from the camera alone: its
// world position (the depth through this frame's inverse projection and
// the camera's world matrix) through last frame's view-projection; the
// motion in UV, as MotionBlur takes it.
function cameraVelocity(tsl, THREE, depth, camera) {
  const { uniform, vec2, vec4, getViewPosition, screenUV } = tsl;
  const cur = new THREE.Matrix4();
  const prev = new THREE.Matrix4();
  let first = true;
  const prevU = uniform(prev).onFrameUpdate(() => {
    if (first) cur.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    prev.copy(cur);
    cur.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    first = false;
    return prev;
  });
  const projInv = uniform(camera.projectionMatrixInverse);
  const world = uniform(camera.matrixWorld);
  const view = getViewPosition(screenUV, depth.sample(screenUV).r, projInv);
  const clip = prevU.mul(world.mul(vec4(view, 1)));
  const ndc = clip.xy.div(clip.w.max(1e-6));
  const was = vec2(ndc.x.mul(0.5).add(0.5), ndc.y.mul(-0.5).add(0.5));
  return screenUV.sub(was);
}

export async function buildChain(renderer, passes) {
  const kinds = new Set(passes.map((p) => p.kind));
  // (GTAO without TRAA is filtered by DenoiseNode, as three's AO example does)
  if (kinds.has('ao') && !kinds.has('traa')) kinds.add('denoise');
  const { THREE, tsl } = await loadThree();
  const mods = {};
  await Promise.all([...kinds].filter((k) => ADDONS[k]).map(async (k) => (mods[k] = await ADDONS[k]())));
  const { pass, mrt, output, normalView, directionToColor, colorToDirection, diffuseColor, velocity, metalness, roughness, vec2, vec3, vec4, sample, texture3D } = tsl;
  const Pipeline = THREE.RenderPipeline ?? THREE.PostProcessing;
  const pipeline = new Pipeline(renderer);
  const nodes = []; // (made here, disposed here)
  const keep = (n) => (nodes.push(n), n);
  const needs = {
    normal: ['ssgi', 'denoise', 'ao', 'ssr'].some((k) => kinds.has(k)),
    diffuse: kinds.has('ssgi'),
    velocity: kinds.has('traa'),
    metalRough: kinds.has('ssr'),
  };
  const aoFollows = kinds.has('ao');
  const g = {};
  let node = null;

  // The grade and SMAA work on the picture as shown: the first of them
  // takes the tone mapping and the sRGB encoding into the chain
  // (renderOutput) and the pipeline's own transform is switched off, as
  // three's LUT and SMAA examples do. A LUT on linear HDR clamps every
  // bright pixel to its last cell.
  let shown = false;
  const display = (n) => {
    if (shown) return n;
    shown = true;
    pipeline.outputColorTransform = false;
    return tsl.renderOutput(n);
  };
  const composeGI = (base, gi) => vec4(aoFollows ? base.rgb : base.rgb.mul(gi.a), base.a).add(vec4(g.diffuse.rgb.mul(gi.rgb), 0));

  for (const p of passes) {
    if (p.enabled === false) continue;
    if (p.kind !== 'render' && !node) throw new Error(`a ${p.kind} pass needs a render pass first`);
    switch (p.kind) {
      case 'render': {
        const scenePass = keep(pass(p.scene, p.camera));
        const outs = { output };
        if (needs.normal) outs.normal = directionToColor(normalView);
        if (needs.diffuse) outs.diffuse = diffuseColor;
        if (needs.velocity) outs.velocity = velocity;
        if (needs.metalRough) outs.metalRough = vec2(metalness, roughness);
        if (Object.keys(outs).length > 1) scenePass.setMRT(mrt(outs));
        // (eight bits are enough for what is not colour)
        for (const k of ['normal', 'diffuse', 'metalRough']) if (outs[k]) scenePass.getTexture(k).type = THREE.UnsignedByteType;
        g.camera = p.camera;
        g.color = scenePass.getTextureNode('output');
        g.depth = scenePass.getTextureNode('depth');
        if (outs.normal) {
          const packed = scenePass.getTextureNode('normal');
          g.normal = sample((uv) => colorToDirection(packed.sample(uv)));
        }
        if (outs.diffuse) g.diffuse = scenePass.getTextureNode('diffuse');
        if (outs.velocity) g.velocity = scenePass.getTextureNode('velocity');
        if (outs.metalRough) g.metalRough = scenePass.getTextureNode('metalRough');
        g.scenePass = scenePass;
        node = g.color;
        break;
      }
      case 'ssgi': {
        const gi = keep(mods.ssgi.ssgi(node, g.depth, g.normal, p.camera ?? g.camera));
        gi.sliceCount.value = p.slices ?? 2;
        gi.stepCount.value = p.steps ?? 8;
        if (p.radius != null) gi.radius.value = p.radius;
        if (p.gi != null) gi.giIntensity.value = p.gi;
        gi.useTemporalFiltering = Boolean(p.temporal);
        g.gi = gi;
        g.giBase = node;
        node = composeGI(node, gi);
        break;
      }
      case 'denoise': {
        if (!g.gi) break;
        const dn = keep(mods.denoise.denoise(g.gi, g.depth, g.normal, p.camera ?? g.camera));
        node = composeGI(g.giBase, dn);
        break;
      }
      case 'ao': {
        const ao = keep(mods.ao.ao(g.depth, g.normal, p.camera ?? g.camera));
        ao.resolutionScale = p.resolutionScale ?? 0.5;
        if (p.radius != null) ao.radius.value = p.radius;
        if (p.power != null) ao.distanceExponent.value = p.power;
        const occlusion = kinds.has('traa') ? ao.getTextureNode() : keep(mods.denoise.denoise(ao.getTextureNode(), g.depth, g.normal, p.camera ?? g.camera));
        node = vec4(node.rgb.mul(occlusion.r), node.a);
        break;
      }
      case 'ssr': {
        // (SSRNode samples its colour as a texture; what comes before it is a composite)
        const s = keep(mods.ssr.ssr(tsl.convertToTexture(node), g.depth, g.normal, { metalnessNode: g.metalRough.r, roughnessNode: g.metalRough.g, camera: p.camera ?? g.camera }));
        s.resolutionScale = p.resolutionScale ?? 0.5;
        if (p.maxDistance != null) s.maxDistance.value = p.maxDistance;
        if (p.thickness != null) s.thickness.value = p.thickness;
        node = tsl.blendColor(node, s);
        break;
      }
      case 'volumes':
        node = p.volumetrics.pass(node, { depth: g.depth, camera: p.camera ?? g.camera });
        break;
      case 'fog': {
        const f = fogVolume(node, { depth: g.depth, camera: p.camera ?? g.camera, p, tsl, THREE });
        for (const n of f.nodes) keep(n);
        node = f.node;
        break;
      }
      case 'bloom': {
        const b = keep(mods.bloom.bloom(node, p.strength ?? BLOOM.strength, p.radius ?? BLOOM.radius, p.threshold ?? BLOOM.threshold));
        g.bloom = b;
        node = node.add(b);
        break;
      }
      case 'godrays': {
        const gr = keep(mods.godrays.godrays(g.depth, p.camera ?? g.camera, p.light));
        if (p.density != null) gr.density.value = p.density;
        if (p.maxDensity != null) gr.maxDensity.value = p.maxDensity;
        // (the haze is the lit share of the air along the view, 0…maxDensity,
        // wherever one looks: added faintly in the sun's colour, not mixed)
        const haze = gr.getTextureNode().r;
        node = node.add(vec4(vec3(...(p.color ?? [1, 1, 1])).mul(haze).mul(p.strength ?? 0.2), 0));
        break;
      }
      case 'lensflare': {
        if (!g.bloom) break;
        const flare = keep(mods.lensflare.lensflare(g.bloom, { threshold: p.threshold, ghostSamples: p.ghostSamples, ghostSpacing: p.ghostSpacing }));
        let ghosts = keep(mods.lensflare.gaussianBlur(flare, null, 8));
        if (p.flare) ghosts = ghosts.mul(flareAlpha(tsl, THREE, p, g.depth, p.camera ?? g.camera));
        node = node.add(ghosts);
        break;
      }
      case 'dof': {
        const viewZ = g.scenePass.getViewZNode();
        node = keep(mods.dof.dof(tsl.convertToTexture(node), viewZ, tsl.uniform(p.focusDistance), tsl.uniform(p.range), tsl.uniform(p.bokehScale)));
        break;
      }
      case 'motionBlur': {
        const vel = cameraVelocity(tsl, THREE, g.depth, p.camera ?? g.camera).mul(p.scale ?? 1);
        node = mods.motionBlur.motionBlur(tsl.convertToTexture(node), vel, tsl.int(p.samples ?? 16));
        break;
      }
      case 'lut': {
        if (!p.texture) break;
        node = keep(mods.lut.lut3D(display(node), texture3D(p.texture), p.texture.image.width, tsl.float(p.intensity ?? 1)));
        break;
      }
      case 'traa':
        node = keep(mods.traa.traa(node, g.depth, g.velocity, p.camera ?? g.camera));
        break;
      case 'smaa':
        node = keep(mods.smaa.smaa(display(node)));
        break;
      case 'output':
        // (the output transform is the pipeline's own)
        break;
      case 'shader':
        throw new Error('a shader pass needs the webgl backend');
      default:
        throw new Error(`unknown pass ${p.kind}`);
    }
  }
  pipeline.outputNode = node;
  return {
    pipeline,
    nodes,
    dispose() {
      for (const n of nodes) n.dispose?.();
      pipeline.dispose?.();
    },
  };
}

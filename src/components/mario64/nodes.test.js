import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { WGSLNodeBuilder, WebGPURenderer } from 'three/webgpu';
import { fog, lights, rangeFogFactor, reference } from 'three/tsl';
import * as glsl from './glsl.js';
import * as nodes from './nodes.js';

// Mario 64’s shaders as nodes, against the GLSL ones they replace (./glsl.js):
// the same flags, the same uniforms under the same names and values (the
// GLSL’s read off the shader its onBeforeCompile patches, the nodes’ off
// .uniforms), and each built to WGSL in Node, where TSL needs no GPU, so a
// node that can’t be built fails here and not on the castle’s first frame.

// (no network: a set is three tiny textures, the same ones to both sides)
vi.mock('../avengers/hq/assets', async (importOriginal) => {
  const T = await import('three');
  const made = new Map();
  const tex = (name, srgb) => {
    const t = new T.DataTexture(new Uint8Array([200, 180, 160, 255]), 1, 1);
    t.name = name;
    if (srgb) t.colorSpace = T.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  const loadSet = async (name) => {
    if (!name) return null;
    if (!made.has(name)) made.set(name, { map: tex(`${name}/color`, true), normalMap: tex(`${name}/normal`), arm: tex(`${name}/arm`) });
    return made.get(name);
  };
  return { ...(await importOriginal()), loadSet };
});

// the flags a twin keeps, as its original has them
const FLAGS = ['transparent', 'side', 'depthWrite', 'depthTest', 'blending', 'fog', 'opacity', 'roughness', 'metalness', 'vertexColors'];
function sameFlags(node, original) {
  for (const k of FLAGS) expect(node[k], k).toBe(original[k]);
  expect(node.color.getHex()).toBe(original.color.getHex());
}

// the GLSL patch's uniforms, as WebGL would be handed them
function glslUniforms(material) {
  const shader = { uniforms: {}, vertexShader: '', fragmentShader: '' };
  material.onBeforeCompile(shader);
  return shader.uniforms;
}

function sameUniforms(nodesU, glslU) {
  expect(Object.keys(nodesU).sort()).toEqual(Object.keys(glslU).sort());
  for (const [k, u] of Object.entries(glslU)) {
    expect(nodesU[k].isNode, k).toBe(true);
    const v = u.value;
    if (v?.isTexture) expect(nodesU[k].value, k).toBe(v);
    else if (v?.isColor) expect(nodesU[k].value.equals(v), k).toBe(true);
    else expect(nodesU[k].value, k).toBeCloseTo(v, 12);
  }
}

// A material built to WGSL as the node renderer would on its first frame:
// the castle's sun and sky light, its fog, a mesh of the material's own.
function build(mesh) {
  const canvas = { style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => null, width: 1, height: 1 };
  const r = new WebGPURenderer({ canvas });
  // (no device in Node: the builder asks for features and is told none)
  r.hasFeature = () => false;
  r.backend.renderer = r;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#cfe3ff', 60, 260);
  const sun = new THREE.DirectionalLight('#fff6e8', 4.6);
  const fill = new THREE.HemisphereLight('#dff0ff', '#6a8a3a', 0.4);
  scene.add(sun, fill, mesh);
  const camera = new THREE.PerspectiveCamera();
  const b = new WGSLNodeBuilder(mesh, r);
  Object.assign(b, { scene, camera, material: mesh.material });
  b.context.material = mesh.material;
  b.lightsNode = lights([sun, fill]);
  b.fogNode = fog(reference('color', 'color', scene.fog), rangeFogFactor(reference('near', 'float', scene.fog), reference('far', 'float', scene.fog)));
  b.build();
  return b;
}

const MATS = ['grass', 'rock', 'path']; // (Bob-omb Ridge's; the castle's lawn has cobble for path)

describe('the terrain’s splat as nodes', () => {
  it('is the GLSL one’s standard material: its flags and its maps, the blend as nodes', async () => {
    const original = await glsl.splatMaterial(MATS, false);
    const twin = await nodes.splatMaterial(MATS, false);
    expect(twin.isMeshStandardNodeMaterial).toBe(true);
    sameFlags(twin, original);
    for (const k of ['map', 'normalMap', 'roughnessMap', 'aoMap']) expect(twin[k], k).toBe(original[k]);
    expect(twin.aoMapIntensity).toBe(original.aoMapIntensity);
    expect(twin.normalScale.equals(original.normalScale)).toBe(true);
    for (const k of ['colorNode', 'normalNode', 'roughnessNode', 'aoNode']) expect(twin[k]?.isNode, k).toBe(true);
  });

  it('keeps its twelve uniforms under the GLSL names, each the GLSL one’s value (scene.js’s scale among them)', async () => {
    for (const mats of [MATS, ['grass', 'rock', 'cobble']]) {
      const original = await glsl.splatMaterial(mats, false);
      const twin = await nodes.splatMaterial(mats, false);
      expect(Object.keys(twin.uniforms)).toHaveLength(12);
      sameUniforms(twin.uniforms, glslUniforms(original));
    }
  });

  it('is a plain tinted material, as the GLSL one is, when a set is missing', async () => {
    const original = await glsl.splatMaterial(['grass', 'nothing', 'path'], false);
    const twin = await nodes.splatMaterial(['grass', 'nothing', 'path'], false);
    sameFlags(twin, original);
    expect(twin.map).toBe(null);
    expect(twin.colorNode).toBe(null);
  });

  it('builds to WGSL: the splat read from the mesh, every set sampled, the rock on three planes', async () => {
    const twin = await nodes.splatMaterial(MATS, false);
    const geo = new THREE.PlaneGeometry(10, 10, 2, 2).rotateX(-Math.PI / 2);
    geo.setAttribute('splat', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3).fill(1 / 3), 3));
    const b = build(new THREE.Mesh(geo, twin));
    expect(b.vertexShader).toMatch(/splat/);
    // each set’s colour, normal and arm, the rock’s colour and arm on three
    // planes: thirteen reads (a texture with no filtering, as the test’s
    // 1 × 1 ones, is read with textureLoad)
    expect(b.fragmentShader.match(/texture(Sample|Load)\(/g).length).toBeGreaterThanOrEqual(13);
    expect(b.fragmentShader).toMatch(/pow\(/);
  });
});

describe('the paintings’ ripple as nodes', () => {
  it('is the GLSL one’s material, with or without its picture, its two uniforms under the same names', () => {
    const art = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    for (const pic of [null, art]) {
      const original = glsl.paintingMaterial(pic);
      const twin = nodes.paintingMaterial(pic);
      expect(twin.material.isMeshStandardNodeMaterial).toBe(true);
      sameFlags(twin.material, original.material);
      expect(twin.material.map).toBe(original.material.map);
      sameUniforms(twin.uniforms, glslUniforms(original.material));
      expect(twin.material.positionNode?.isNode).toBe(true);
    }
  });

  it('takes the frame’s values as the GLSL one did: things.js writes .value', () => {
    const { uniforms } = nodes.paintingMaterial(null);
    uniforms.uTime.value = 3;
    uniforms.uRipple.value = 0.5;
    expect(uniforms.uTime.value).toBe(3);
    expect(uniforms.uRipple.value).toBe(0.5);
  });

  it('builds to WGSL, the canvas pushed along its z in the vertex stage', () => {
    const { material } = nodes.paintingMaterial(null);
    const b = build(new THREE.Mesh(new THREE.PlaneGeometry(6, 6, 48, 48), material));
    expect(b.vertexShader).toMatch(/sin\(/);
    expect(b.vertexShader).toMatch(/exp\(/);
  });
});

describe('the waterfall’s streaks as nodes', () => {
  it('is the GLSL one’s glassy physical material, its one uniform under the same name', () => {
    const original = glsl.waterfallMaterial();
    const twin = nodes.waterfallMaterial();
    expect(twin.material.isMeshPhysicalNodeMaterial).toBe(true);
    sameFlags(twin.material, original.material);
    for (const k of ['transmission', 'emissiveIntensity', 'ior', 'thickness']) expect(twin.material[k], k).toBe(original.material[k]);
    expect(twin.material.emissive.getHex()).toBe(original.material.emissive.getHex());
    sameUniforms(twin.uniforms, glslUniforms(original.material));
    expect(twin.material.outputNode?.isNode).toBe(true);
  });

  it('builds to WGSL, the streaks added to what the fog left, as the GLSL adds them after dithering', () => {
    const { material } = nodes.waterfallMaterial();
    const b = build(new THREE.Mesh(new THREE.PlaneGeometry(3, 8), material));
    expect(b.fragmentShader).toMatch(/fract\(/);
    // (the fog's mix comes first in the shader; the streaks after it)
    expect(b.fragmentShader.indexOf('smoothstep( 0.7, 1.0')).toBeGreaterThan(b.fragmentShader.lastIndexOf('mix('));
  });
});

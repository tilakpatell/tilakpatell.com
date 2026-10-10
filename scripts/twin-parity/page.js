// The page twin-parity.mjs drives: each case of ./cases.js built twice, its
// `node` side with lane T's twins on three's node renderer and its `classic`
// side with the GLSL originals on WebGLRenderer, each drawn through the post
// chain its renderer has (a TSL pass, an EffectComposer with an OutputPass),
// or a case's own `render`. A case with `compare` returns numbers instead.
import * as THREE from 'three';
import { WebGPURenderer, PostProcessing } from 'three/webgpu';
import { pass } from 'three/tsl';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
const out = { log: [] };
window.__out = out;
const oe = console.error, ow = console.warn;
let cur = null;
console.error = (...a) => { out.log.push(['error', cur, a.map(String).join(' ').slice(0, 3000)]); oe(...a); };
console.warn = (...a) => { out.log.push(['warn', cur, a.map(String).join(' ').slice(0, 600)]); ow(...a); };
const cases = (await import('./cases.js')).default;
// (?gpu=webgpu draws the node side on WebGPU, where the browser has it; WebGL 2 otherwise)
const node = new WebGPURenderer({ canvas: document.getElementById('a'), forceWebGL: !location.search.includes('gpu=webgpu'), antialias: false });
await node.init();
const classic = new THREE.WebGLRenderer({ canvas: document.getElementById('b'), antialias: false, preserveDrawingBuffer: true });
for (const r of [node, classic]) { r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace; }
const world = () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x203040);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  camera.position.set(3, 3, 6); camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x553322, 0.8));
  const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(3, 5, 2); scene.add(sun);
  return { THREE, scene, camera, sun };
};
window.names = Object.keys(cases);
window.runCase = async (name) => {
  cur = name;
  const before = out.log.filter((l) => l[0] === 'error').length;
  const res = { name };
  try {
    const c = cases[name];
    if (c.compare) { res.stats = await c.compare({ node, classic, THREE }); res.status = out.log.filter((l) => l[0] === 'error').length === before ? 'ok' : 'errors'; return res; }
    const a = world();
    a.renderer = node;
    const ta = (await (c.node ?? c)(a)) ?? {};
    const post = new PostProcessing(node); post.outputNode = pass(a.scene, a.camera).getTextureNode();
    for (let i = 0; i < 3; i++) { ta.tick?.(i); if (ta.render) ta.render(); else post.render(); }
    if (c.classic) {
      const b = world();
      b.renderer = classic;
      const tb = (await c.classic(b)) ?? {};
      const comp = new EffectComposer(classic); comp.addPass(new RenderPass(b.scene, b.camera)); comp.addPass(new OutputPass());
      for (let i = 0; i < 3; i++) { tb.tick?.(i); if (tb.render) tb.render(); else comp.render(); }
      res.classic = true;
    }
    res.status = out.log.filter((l) => l[0] === 'error').length === before ? 'ok' : 'errors';
  } catch (e) {
    res.status = 'throw'; res.err = String(e?.stack || e).slice(0, 1500);
  }
  return res;
};
out.ready = true;

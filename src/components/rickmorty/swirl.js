// The portal canvases: the show's green swirl (lib/three/swirl.js has the
// GLSL, shared with the Three.js scenes) drawn on plain canvases through one
// WebGL context for the whole page.
//
// createSwirl(canvas, { size, seed, onFail }) → { draw(t, open) → painted, dispose } or null
// runSwirl(canvas, { size, seed, open, calm, onFail }) → { stop } or null

import { SWIRL_GLSL } from '../../lib/three/swirl';
import { shownLoop } from '../../lib/shownLoop';

export { SWIRL_GLSL };


const VERT = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
const FRAG = `
precision highp float;
uniform vec2 res;
uniform vec2 size; // the oval's half width and half height, as shares of the canvas height
uniform float t, open, seed;
${SWIRL_GLSL}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * res) / res.y;
  gl_FragColor = portal(uv / size, t, open, seed);
}`;

// One WebGL context for every portal on the page. Making a context (and
// linking the swirl's shader in it) waits on the GPU, and the page has a
// portal in the hero, one in each crack the cruiser flies through (they come
// and go as you scroll) and one in the theme change: a context each was a
// stall each, and another letting each one go. So the swirl is drawn in one
// hidden canvas and copied onto each portal's own plain 2D canvas. The
// context outlives its last portal by KEEP, for the next crack along.
const KEEP = 10000; // ms
let shared = null;
let users = 0;
let letGo = 0;

function sharedGL() {
  if (shared?.state === 'broken') return null;
  if (shared && !shared.gl.isContextLost()) return shared;
  shared = null;
  const canvas = document.createElement('canvas');
  let gl = null;
  try {
    // a full-screen triangle has no edges to smooth: no multisampling
    gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, powerPreference: 'high-performance' });
  } catch {
    gl = null;
  }
  if (!gl) return null;
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  // the link goes on in the background where the GPU can (asked after on each
  // draw, without waiting); elsewhere the first draw waits for it, as before
  const parallel = gl.getExtension('KHR_parallel_shader_compile');
  shared = { canvas, gl, prog, parallel, state: 'linking', u: null };
  return shared;
}

// whether the shared program can draw yet (set up the first time it can)
function linked(sw) {
  if (sw.state !== 'linking') return sw.state === 'ok';
  const { gl, prog } = sw;
  if (sw.parallel && !gl.getProgramParameter(prog, sw.parallel.COMPLETION_STATUS_KHR)) return false;
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    sw.state = 'broken';
    return false;
  }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  sw.u = Object.fromEntries(['res', 'size', 't', 'open', 'seed'].map((k) => [k, gl.getUniformLocation(prog, k)]));
  sw.state = 'ok';
  return true;
}

const hold = () => {
  users += 1;
  clearTimeout(letGo);
};
const release = () => {
  users = Math.max(0, users - 1);
  if (users) return;
  clearTimeout(letGo);
  letGo = setTimeout(() => {
    if (users || !shared) return;
    const { gl } = shared;
    shared = null;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }, KEEP);
};

// A portal on a plain canvas (no Three.js): draw(t, open) paints one frame.
// Returns null where WebGL isn't there, so the caller can show its CSS one;
// `onFail` hears if the shader turns out not to link after all.
export function createSwirl(canvas, { size = [0.34, 0.45], seed = 0, onFail } = {}) {
  if (!sharedGL()) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  hold();
  let gone = false;
  const fit = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  };
  // (true once a frame is painted: a still portal knows its frame is there)
  const draw = (t, open = 1) => {
    if (gone) return false;
    const sw = sharedGL(); // a fresh one, should the last have been lost
    if (!sw || !linked(sw)) {
      if (!sw || sw.state === 'broken') onFail?.();
      return false;
    }
    fit();
    const { gl, u, canvas: src } = sw;
    const w = canvas.width;
    const h = canvas.height;
    // the hidden canvas grows to the biggest portal; each is drawn in its corner
    if (src.width < w || src.height < h) {
      src.width = Math.max(src.width, w);
      src.height = Math.max(src.height, h);
    }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(u.res, w, h);
    gl.uniform2f(u.size, size[0], size[1]);
    gl.uniform1f(u.t, t);
    gl.uniform1f(u.open, open);
    gl.uniform1f(u.seed, seed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // and copied over this one's last frame (WebGL's corner is the bottom left)
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(src, 0, src.height - h, w, h, 0, 0, w, h);
    return true;
  };
  const dispose = () => {
    if (gone) return;
    gone = true;
    release();
  };
  return { draw, dispose };
}

// Run a portal on a canvas until stop(): only while it's on screen and the
// tab is showing (lib/shownLoop: out of view no frame is asked for at all),
// one still frame for reduced motion, drawn again only when the opening or
// the canvas's size changes. `open()` gives the opening (0…1) for a frame,
// so a caller can snap it shut and swirl it open.
export function runSwirl(canvas, { size, seed, open = () => 1, calm = false, onFail } = {}) {
  const s = createSwirl(canvas, { size, seed, onFail });
  if (!s) return null;
  const t0 = performance.now();
  // (the still frame's last drawing: the opening, the box and the pixel
  // ratio it was drawn for; a 2D canvas whose context the browser restores
  // comes back empty, so it is drawn again then)
  let still = null;
  const restored = () => (still = null);
  canvas.addEventListener('contextrestored', restored);
  const frame = (now) => {
    const k = open(now);
    if (calm) {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (still && still.k === k && still.w === w && still.h === h && still.dpr === dpr) return;
      if (s.draw(3, k)) still = { k, w, h, dpr };
      return;
    }
    s.draw((now - t0) / 1000, k);
  };
  const loop = shownLoop(canvas, frame);
  return {
    stop() {
      loop.stop();
      canvas.removeEventListener('contextrestored', restored);
      s.dispose();
    },
  };
}

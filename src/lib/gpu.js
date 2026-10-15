// Can this browser draw in 3D? The site's games and scenes are 3D first:
// they draw in WebGL wherever it exists, a real graphics chip or WebGL run in
// software on the CPU (SwiftShader, llvmpipe, Microsoft's basic driver), and
// lower their own resolution and effects if frames can't keep up. Only a
// browser with no WebGL at all gets the 2D versions. `software` is still
// reported, for those quality steps.
//
// The visitor can choose: 'auto' (the default), 'on' (the same: 3D wherever
// WebGL exists) or 'off' (always 2D). The choice is kept between visits.

import { createContext, useContext, useEffect, useState } from 'react';
import { noteGpu } from './device';

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen|gdi generic/i;
const KEY = 'tp-3d';
const EVENT = 'tp:3d';

export const classify = (renderer = '') => ({ renderer, software: SOFTWARE.test(renderer) });

// Ask for a context on a canvas: WebGL 2 first, then WebGL 1.
const context = (canvas, opts) => {
  const gl = canvas.getContext('webgl2', opts);
  if (gl) return { gl, webgl2: true };
  return { gl: canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts), webgl2: false };
};

// Look once, on a throwaway canvas, then let the context go. The first ask
// refuses anything with a major performance caveat; when hardware
// acceleration is off that refusal is all a browser gives, so a second,
// relaxed ask on a fresh canvas finds the software WebGL behind it.
export function probe(doc = typeof document !== 'undefined' ? document : undefined) {
  const none = { webgl: false, webgl2: false, renderer: '', software: false, caveat: false, ok: false };
  if (!doc?.createElement) return none;
  try {
    let caveat = false;
    let { gl, webgl2 } = context(doc.createElement('canvas'), { failIfMajorPerformanceCaveat: true, powerPreference: 'high-performance' });
    if (!gl) {
      ({ gl, webgl2 } = context(doc.createElement('canvas'), { powerPreference: 'high-performance' }));
      caveat = !!gl;
    }
    if (!gl) return none;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String((info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const software = caveat || classify(renderer).software;
    return { webgl: true, webgl2, renderer, software, caveat, ok: !software };
  } catch {
    return none;
  }
}

// Why a game that only draws in WebGL can't start here: 'ok', 'software'
// (WebGL without the graphics chip, which is what switching hardware
// acceleration off leaves) or 'none' (no WebGL at all).
export const gpuStatus = (info) => (info.ok ? 'ok' : info.webgl ? 'software' : 'none');

let cached = null;
// (lib/device hears what was found, so a weak phone chip or software WebGL
// lowers the quality tier too)
export const gpu = () => {
  if (!cached) noteGpu((cached = probe()));
  return cached;
};

// Look again (after the visitor has changed a setting and come back), and
// tell anything listening.
export function reprobe() {
  noteGpu((cached = probe()));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: mode3D() }));
  return cached;
}

export const resolve3D = (mode, info) => (mode === 'off' ? false : info.webgl);

export function mode3D() {
  try {
    const m = window.localStorage.getItem(KEY);
    return m === 'on' || m === 'off' ? m : 'auto';
  } catch {
    return 'auto';
  }
}

export function setMode3D(mode) {
  try {
    if (mode === 'auto') window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, mode);
  } catch {
    /* storage unavailable: it lasts for this page */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: mode }));
}

// A world that waits for the visitor before downloading its 3D (on a phone,
// with Data Saver, short of space: components/worlds/WorldGate) holds the 3D
// for everything inside it: `on` is false, so its scenes keep their 2D
// versions and fetch nothing, and `held` says why. Any "turn 3D on" inside
// it loads the world instead. The value is { held, load, mb, name }.
export const Hold3D = createContext(null);

// { on, can, mode, set, held }: whether to draw in 3D now, whether WebGL
// exists at all, the visitor's choice, a way to change it, and whether the
// world around it is holding its 3D until asked.
export function use3D() {
  const hold = useContext(Hold3D);
  const [mode, setMode] = useState(mode3D);
  const [, setLooked] = useState(0); // bumped by reprobe(), which may leave the mode as it was
  useEffect(() => {
    const on = (e) => {
      setMode(e.detail ?? mode3D());
      setLooked((n) => n + 1);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const info = gpu();
  const held = Boolean(hold?.held);
  const set = held
    ? (m) => {
        if (m !== 'off') hold.load();
        setMode3D(m);
      }
    : setMode3D;
  return { on: resolve3D(mode, info) && !held, can: info.webgl, auto: info.ok, mode, set, info, status: gpuStatus(info), held, hold };
}

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { T, clampStart, darkAt, flashAt, holdStart, jumpStarted } from '../hyperspace3d/timeline';

// A jump drawn over the whole page by a fragment shader, on the jump to
// lightspeed's timeline (hyperspace3d/timeline.js), so a page that plays the
// site's jump (App.jsx's Lightspeed) can play one of these in its place
// without noticing: `onPeak` fires under its flash, at T.jump + 20 ms, when
// whatever changes behind it (the ship out at another place) is hidden, and
// `onDone` at T.end. A held jump (holdJump: the galaxy building its next
// system) waits in its middle, as the site's does.
//
// `frag` is the shader. It gets `res` (the canvas in pixels), `t` (seconds
// along the timeline), `clock` (seconds of real time, running on through a
// hold, for anything that moves), `flash` and `dark` (the timeline's), and
// whatever `uniforms(t, clock, view)` gives, by name, as floats. It writes
// premultiplied colour over a clear canvas: what it leaves clear shows the
// page. `fallback(ctx, t, clock, view, u)` paints a frame on a 2D canvas
// where WebGL won't start, or gives out before the flash (after it the page
// has already changed, so the jump just ends). `view` is { W, H, aspect }.
// `from`: ms along the timeline its first frame is at (jumps/styles.js's
// jumpFrom: a jump whose opening the scene has already drawn).
// Reduced motion isn't handled here: App plays the site's crossfade instead.

const VERT = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';

function startGL(canvas, frag, names) {
  let gl = null;
  try {
    gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
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
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    if (import.meta.env?.DEV) console.warn('jump shader failed to link', gl.getProgramInfoLog(prog));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  const u = Object.fromEntries(['res', 't', 'clock', 'flash', 'dark', ...names].map((k) => [k, gl.getUniformLocation(prog, k)]));
  return {
    draw(w, h, values) {
      if (gl.isContextLost()) return false;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.res, w, h);
      for (const k in values) if (u[k]) gl.uniform1f(u[k], values[k]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return true;
    },
    dispose() {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

export default function JumpCanvas({ frag, uniforms, fallback, onPeak, onDone, from = 0 }) {
  const box = useRef(null);
  const cbs = useRef({ onPeak, onDone, uniforms, fallback });
  cbs.current = { onPeak, onDone, uniforms, fallback };

  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const view = { W, H, aspect: W / H };
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const w = Math.round(W * dpr);
    const h = Math.round(H * dpr);
    const make = () => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      el.append(c);
      return c;
    };
    let canvas = make();
    let gl = startGL(canvas, frag, Object.keys(cbs.current.uniforms?.(0, 0, view) ?? {}));
    let ctx = null;
    if (!gl) {
      canvas.remove();
      canvas = make();
      ctx = canvas.getContext('2d');
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    let peaked = false;
    let finished = false;
    const peak = () => {
      if (peaked) return;
      peaked = true;
      cbs.current.onPeak?.();
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      cbs.current.onDone?.();
    };
    // timed from the first frame actually drawn, so a slow start skips
    // nothing, and a stall moves it on 50 ms only, so it pauses rather than
    // skip its middle (timeline.js's clampStart)
    let start = 0;
    let t0 = 0;
    let last = 0;
    let raf = 0;
    const frame = (now) => {
      if (start) start = clampStart(start, last, now);
      else {
        t0 = now;
        start = now - from;
        jumpStarted(); // (a page waiting on its dark times its fallback from here)
      }
      last = now;
      start = holdStart(now, start); // (held in the middle while the galaxy builds its next system)
      const ms = now - start;
      const t = ms / 1000;
      const clock = (now - t0) / 1000;
      const u = { t, clock, flash: flashAt(ms), dark: darkAt(ms), ...(cbs.current.uniforms?.(t, clock, view) ?? {}) };
      if (gl) {
        if (!gl.draw(w, h, u)) {
          // WebGL gave out: before the flash the 2D version carries on from here; after it, the jump just ends
          gl = null;
          if (peaked) {
            finish();
            return;
          }
          canvas.remove();
          canvas = make();
          ctx = canvas.getContext('2d');
          ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      }
      if (!gl && ctx) {
        ctx.clearRect(0, 0, W, H);
        cbs.current.fallback?.(ctx, t, clock, view, u);
      }
      if (ms >= T.jump + 20) peak();
      if (ms < T.end) raf = requestAnimationFrame(frame);
      else {
        peak();
        finish();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      gl?.dispose();
      canvas.remove();
    };
  }, [frag, from]);

  // Rendered at the top of the page, above the nav and everything else (the
  // same place, and style, as the jump to lightspeed's canvas).
  return createPortal(<div ref={box} className="hyperspace-canvas" aria-hidden="true" />, document.body);
}

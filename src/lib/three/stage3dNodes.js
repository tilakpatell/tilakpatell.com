// lib/stage3d's twin for the node renderer: what a stage takes from it that
// holds no shader (hot, canvasTexture, disposeTree, stageRatio, stageSizing,
// stageTune, stageBloomGroups), copied rather than imported, since
// lib/stage3d.js builds the classic composer and holds GRADE's GLSL (FL4
// deletes the original); and GRADE itself in TSL, for the node chain's
// `grade` pass (lib/three/light/passes.js), its uniforms under GRADE's
// names, so a stage's grade() writes `.value` as before.
//
// gradeUniforms() → { uContrast, uSat, uShadow, uHigh, uVignette, uGrain, uAspect, uTime }
// gradeNode(u, { toneMapping }) → (picture) → node: the classic chain's
//   OutputPass then GRADE: the tone map at the renderer's exposure and the
//   sRGB encoding (the chain's `grade` turns the pipeline's own off), then
//   the grade's saturation, contrast, split toning, vignette and grain.

import * as THREE from 'three';
import { Fn, clamp, dot, floor, fract, length, max, mix, renderOutput, screenCoordinate, sin, smoothstep, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { pixelRatio } from '../device';
import { debugOn, debugPanel } from '../debugPanel';
import { sharpen } from './textures';

// Bright colours for things that glow: above 1, so bloom picks them up.
export const hot = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);

// A canvas as a texture, repeating, sharp at a glancing angle.
export function canvasTexture(canvas, renderer, { repeat = [1, 1], srgb = true, wrap = true } = {}) {
  return sharpen(new THREE.CanvasTexture(canvas), {
    renderer,
    color: srgb ? true : undefined,
    wrap: Boolean(wrap),
    repeat,
  });
}

// Free a whole tree: geometries, materials and every texture they hold.
export function disposeTree(root) {
  root.traverse((o) => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) u.value.dispose();
      m.dispose?.();
    }
    o.dispose?.(); // instanced meshes, skeletons
  });
}

// The sharpest the stage draws at: lib/device's ratio for this device under
// 1.75, and the screen's own pixels at most for software rendering.
export function stageRatio({ soft = false, tier } = {}) {
  return pixelRatio(soft ? 1 : 1.75, tier);
}

// The stage's own values for the tuning panel (lib/debugPanel): the bloom,
// read and written live (on the node chain, its uniforms' values).
export const stageBloomGroups = (pass) => [
  {
    name: 'bloom',
    items: [
      {
        key: 'threshold',
        type: 'range',
        min: 0,
        max: 2,
        get: () => pass.threshold,
        set: (v) => (pass.threshold = v),
      },
      {
        key: 'strength',
        type: 'range',
        min: 0,
        max: 2,
        get: () => pass.strength,
        set: (v) => (pass.strength = v),
      },
      {
        key: 'radius',
        type: 'range',
        min: 0,
        max: 1,
        get: () => pass.radius,
        set: (v) => (pass.radius = v),
      },
    ],
  },
];

// stage.tune(groups): behind ?debug, the one panel with the stage's bloom
// first and the game's groups after, titled by the page it's on.
export function stageTune({ bloomPass, on = debugOn, panel: makePanel = debugPanel, title = () => null } = {}) {
  let panel = null;
  return {
    tune(groups = []) {
      if (!on()) return;
      const name = title() || 'stage';
      panel ??= makePanel({ title: name });
      panel.open([...stageBloomGroups(bloomPass), ...groups], {
        title: name,
        id: name,
      });
    },
    close() {
      panel?.dispose();
      panel = null;
    },
  };
}

// The drawing buffers' size, apart from when they're made (lib/stage3d's,
// line for line).
// stageSizing({ ratio, soft, canvas(w, h, pixelRatio), buffers(w, h, pixelRatio) }) →
//   { resize(w, h) → changed, scale(k), setRatio(r), fit() → made, size, ratio, sharpness, stale }
export function stageSizing({ ratio: r0 = 1, soft = false, canvas, buffers }) {
  let size = { w: 1, h: 1 };
  let ratio = r0;
  let k = 1;
  let made = { w: 1, h: 1, canvas: r0, buffers: r0 }; // (as created)
  const want = () => ({
    w: size.w,
    h: size.h,
    canvas: soft ? ratio * k : ratio,
    buffers: ratio * k,
  });
  const stale = () => {
    const n = want();
    return n.w !== made.w || n.h !== made.h || n.canvas !== made.canvas || n.buffers !== made.buffers;
  };
  return {
    get size() {
      return size;
    },
    get ratio() {
      return ratio;
    },
    get sharpness() {
      return k;
    },
    get stale() {
      return stale();
    },
    resize(w, h) {
      const next = {
        w: Math.max(1, Math.round(w)),
        h: Math.max(1, Math.round(h)),
      };
      if (next.w === size.w && next.h === size.h) return false;
      size = next;
      return true;
    },
    scale(v) {
      k = v;
    },
    setRatio(v) {
      ratio = v;
    },
    fit() {
      const n = want();
      const moved = n.w !== made.w || n.h !== made.h;
      const c = moved || n.canvas !== made.canvas;
      const b = moved || n.buffers !== made.buffers;
      made = n;
      if (c) canvas(n.w, n.h, n.canvas);
      if (b) buffers(n.w, n.h, n.buffers);
      return c || b;
    },
  };
}

// GRADE's uniforms, at its defaults
export const gradeUniforms = () => ({
  uContrast: uniform(0.12),
  uSat: uniform(1.04),
  uShadow: uniform(new THREE.Color(0, 0.006, 0.02)),
  uHigh: uniform(new THREE.Color(0.02, 0.01, 0)),
  uVignette: uniform(0.22),
  uGrain: uniform(0.022),
  uAspect: uniform(16 / 9),
  uTime: uniform(0),
});

// GRADE after the classic chain's OutputPass, as the node chain's `grade`
// pass: (picture) → the display-ready colour
export const gradeNode =
  (u, { toneMapping = THREE.NeutralToneMapping, colorSpace = THREE.SRGBColorSpace } = {}) =>
  (picture) =>
    Fn(() => {
      const vUv = uv();
      const shown = renderOutput(picture.sample(vUv), toneMapping, colorSpace);
      const c = shown.rgb.toVar();
      const l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c.assign(max(mix(vec3(l), c, u.uSat), 0));
      c.assign(mix(c, c.mul(c).mul(c.mul(-2).add(3)), u.uContrast));
      c.addAssign(u.uShadow.mul(l.oneMinus()).mul(l.oneMinus()).add(u.uHigh.mul(l).mul(l)));
      const q = vUv.sub(0.5).mul(vec2(u.uAspect, 1));
      c.mulAssign(u.uVignette.mul(smoothstep(0.3, 1.05, length(q).mul(1.3))).oneMinus());
      // (a grain a pixel, moving each frame: the GLSL's gl_FragCoord counts
      // from the bottom, this from the top, which a noise doesn't show)
      const n = fract(sin(dot(floor(screenCoordinate.xy).add(fract(u.uTime).mul(71)), vec2(12.9898, 78.233))).mul(43758.5453));
      c.addAssign(n.sub(0.5).mul(u.uGrain));
      return vec4(clamp(c, 0, 1), 1);
    })();

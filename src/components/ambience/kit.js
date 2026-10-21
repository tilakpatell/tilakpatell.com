// What every theme's background (components/ambience) shares. A scene module
// exports `create(canvas, ctx)` (lib/three/useScene's contract) as
// `ambience(canvas, ctx, build)`: `build(k)` adds its things to `k.scene` and
// returns how it moves and recolours:
//
//   step(dt, t)          seconds since the last drawn frame, and since it began
//   recolor(colors)      lib/three/theme colours (k.dark says the mode)
//   retheme?(theme)      another theme in the same family is on
//   resize?(w, h)        the viewport's CSS size
//   burst?(x, y)         a click on empty page, in scene units
//   dispose?()           anything disposeTree(scene) won't reach
//
// Scene units are CSS pixels with the origin in the middle of the screen and
// y up, so a scene places things with k.size.w and k.size.h. The pointer and
// the scroll position come eased (k.pointer, k.scroll). It draws at 30 frames
// a second at a low pixel ratio (a background is soft and slow), nothing
// while the tab is hidden, and one still frame with reduced motion.
// `opts.antialias`: a scene with a solid model in it (Mordor’s tower) asks
// for its edges smoothed; a strong computer gets it, nothing else does.

import * as THREE from 'three';
import { createRenderer, disposeTree, precompile } from '../../lib/three/renderer';
import { device } from '../../lib/device';
import { sharpen } from '../../lib/three/textures';

const FPS_GAP = 1000 / 30 - 2;

// Colours: `rgb` reads a [r, g, b] as sRGB, which suits three's own
// materials (silhouettes, labels), which convert back on the way out. The
// kit's shaders (field, bursts, backdrop) write what they're given with no
// sRGB step, so a colour through `rgb` shows a little deeper there than its
// CSS self; the scenes are tuned by eye with that. `lift` a colour first
// to have it come out exactly as written.
export const rgb = (c, target = new THREE.Color()) => target.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);
export const lift = (c) =>
  c.map((v) => {
    const x = v / 255;
    return Math.round(255 * (x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055));
  });

// Something you can click without it being a burst on the page.
const ACTIVE = 'a, button, input, textarea, select, label, summary, video, iframe, canvas, [role="button"], [role="tab"], [contenteditable], .card, .panel';

export function ambience(canvas, ctx, build, opts = {}) {
  const tier = device().tier;
  const gl = createRenderer(canvas, { alpha: true, antialias: !!opts.antialias && tier === 'high', ratio: tier === 'high' ? 1 : 0.75, onLost: ctx.onLost, onSlow: ctx.onSlow });
  const { renderer } = gl;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 2000);
  const size = { w: 1, h: 1 };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, near: 0, active: false };
  const scroll = { y: window.scrollY, ty: window.scrollY, v: 0 };
  const k = {
    THREE,
    scene,
    camera,
    renderer,
    size,
    pointer,
    scroll,
    tier,
    // fewer things on a phone or a small computer
    density: tier === 'high' ? 1 : 0.55,
    reduced: ctx.reduced,
    dark: ctx.colors.dark,
    colors: ctx.colors,
    theme: ctx.theme,
    ratio: () => renderer.getPixelRatio(),
  };
  const view = build(k);
  view.recolor(ctx.colors);

  const toScene = (cx, cy) => [cx - size.w / 2, size.h / 2 - cy];
  const onMove = (e) => {
    [pointer.tx, pointer.ty] = toScene(e.clientX, e.clientY);
    pointer.active = true;
  };
  const onLeave = () => {
    pointer.active = false;
  };
  const onDown = (e) => {
    if (e.button !== 0 || !view.burst) return;
    const t = e.target;
    if (t instanceof Element && t.closest(ACTIVE)) return;
    onMove(e);
    view.burst(...toScene(e.clientX, e.clientY));
    ctx.invalidate();
  };
  const onScroll = () => {
    scroll.ty = window.scrollY;
  };
  let listening = false;
  const listen = (on) => {
    if (ctx.reduced || on === listening) return;
    listening = on;
    const act = on ? 'addEventListener' : 'removeEventListener';
    window[act]('pointermove', onMove, { passive: true });
    window[act]('pointerdown', onDown, { passive: true });
    document.documentElement[act]('pointerleave', onLeave);
    window[act]('scroll', onScroll, { passive: true });
  };

  let t = 0;
  let lastDraw = 0;
  let drawn = false;
  const draw = () => {
    renderer.render(scene, camera);
    drawn = true;
  };

  // everything's shaders, the hidden things' too (a ship that comes by later
  // shouldn't stall the frame it first shows in)
  const hidden = [];
  scene.traverse((o) => {
    if (!o.visible) {
      hidden.push(o);
      o.visible = true;
    }
  });
  const ready = precompile(renderer, scene, camera);
  for (const o of hidden) o.visible = false;

  return {
    ready,
    resize(w, h) {
      size.w = Math.max(1, w);
      size.h = Math.max(1, h);
      gl.setSize(size.w, size.h);
      camera.left = -size.w / 2;
      camera.right = size.w / 2;
      camera.top = size.h / 2;
      camera.bottom = -size.h / 2;
      camera.updateProjectionMatrix();
      view.resize?.(size.w, size.h);
      drawn = false;
    },
    setVisible(on) {
      listen(on);
    },
    setColors(c) {
      k.colors = c;
      k.dark = c.dark;
      view.recolor(c);
      drawn = false;
    },
    update(next) {
      if (next?.theme && next.theme !== k.theme) {
        k.theme = next.theme;
        view.retheme?.(next.theme);
        drawn = false;
      }
    },
    render(ms, now) {
      if (gl.lost) return false;
      gl.watch(now);
      if (ctx.reduced) {
        if (!drawn) {
          view.step(0, 12);
          draw();
        }
        return false;
      }
      if (drawn && now - lastDraw < FPS_GAP) return true;
      const dt = lastDraw ? Math.min(0.1, (now - lastDraw) / 1000) : 1 / 30;
      lastDraw = now;
      t += dt;
      const e = 1 - Math.exp(-dt * 6);
      pointer.x += (pointer.tx - pointer.x) * e;
      pointer.y += (pointer.ty - pointer.y) * e;
      pointer.near += ((pointer.active ? 1 : 0) - pointer.near) * e;
      const before = scroll.y;
      scroll.y += (scroll.ty - scroll.y) * (1 - Math.exp(-dt * 8));
      scroll.v = (scroll.y - before) / dt;
      view.step(dt, t);
      draw();
      return true;
    },
    dispose() {
      listen(false);
      view.dispose?.();
      disposeTree(scene);
      gl.dispose();
    },
  };
}

// ─── A field of particles, moved in the vertex shader ───────────────────────
// Each particle has four random numbers; its place is worked out from them
// and the time, wrapped round the screen, so JavaScript moves nothing.
//   shape     dot | spark | pixel | diamond | petal | ember | paper | ring | leaf
//   dir       [x, y] it travels in (normalised by the shader's speed)
//   speed     [min, max] px a second, the far ones slower
//   size      [min, max] px
//   sway      px it swings across its path
//   spin      turns a second (shapes that aren't round)
//   twinkle   0..1, how much it flickers
//   repel     px the pointer pushes the nearest away (0: not at all)
//   parallax  how much of the page's scroll it follows (the near ones most)
//   glow      additive in dark mode (light mode always draws normally)
export const SHAPES = { dot: 0, spark: 1, pixel: 2, diamond: 3, petal: 4, ember: 5, paper: 6, ring: 7, leaf: 8 };

const FIELD_VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform vec2 uView;
uniform vec2 uDir;
uniform vec2 uSpeed;
uniform vec2 uSizes;
uniform float uSway;
uniform float uSpin;
uniform float uTwinkle;
uniform vec3 uPointer; // x, y, how near (0..1)
uniform float uRepel;
uniform float uScroll;
uniform float uParallax;
uniform float uRatio;
uniform float uOpacity;
varying float vAlpha;
varying float vMix;
varying float vSpin;
void main() {
  float depth = mix(0.35, 1.0, aSeed.z);
  float speed = mix(uSpeed.x, uSpeed.y, aSeed.w) * depth;
  vec2 span = uView + vec2(120.0);
  vec2 p = (aSeed.xy - 0.5) * span;
  p += uDir * speed * uTime;
  p.y += uScroll * uParallax * depth;
  float ph = aSeed.z * 6.2832 + aSeed.x * 17.0;
  p.x += sin(uTime * (0.35 + aSeed.w * 0.6) + ph) * uSway * depth;
  p = mod(p + span * 0.5, span) - span * 0.5;
  vec2 d = p - uPointer.xy;
  float dl = length(d);
  p += d / max(dl, 1.0) * uRepel * uPointer.z * depth * smoothstep(uRepel * 2.5, 0.0, dl);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
  gl_PointSize = mix(uSizes.x, uSizes.y, aSeed.z * aSeed.z) * uRatio;
  float tw = 1.0 - uTwinkle * (0.5 + 0.5 * sin(uTime * (1.3 + aSeed.w * 3.0) + aSeed.x * 40.0));
  vAlpha = uOpacity * mix(0.45, 1.0, depth) * tw;
  vMix = fract(aSeed.y * 7.31);
  vSpin = ph + uTime * uSpin * (aSeed.w - 0.5) * 2.0;
}
`;

const FIELD_FRAG = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uShape;
varying float vAlpha;
varying float vMix;
varying float vSpin;
void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float c = cos(vSpin), s = sin(vSpin);
  vec2 r = mat2(c, -s, s, c) * uv;
  float a = 0.0;
  float shade = 1.0;
  int shape = int(uShape + 0.5);
  if (shape == 0) { a = smoothstep(1.0, 0.0, length(uv)); a *= a; }
  else if (shape == 1) {
    float core = smoothstep(0.55, 0.0, length(uv));
    float rays = max(smoothstep(0.16, 0.0, abs(r.x)) * smoothstep(1.0, 0.1, abs(r.y)), smoothstep(0.16, 0.0, abs(r.y)) * smoothstep(1.0, 0.1, abs(r.x)));
    a = max(core * core, rays);
  }
  else if (shape == 2) { a = step(max(abs(uv.x), abs(uv.y)), 0.78); }
  else if (shape == 3) {
    float dmd = abs(r.x) * 1.35 + abs(r.y) * 0.85;
    a = smoothstep(0.86, 0.8, dmd);
    shade = r.x * r.y > 0.0 ? 1.0 : 0.72;
    shade += smoothstep(0.75, 0.82, dmd) * 0.5;
  }
  else if (shape == 4) { a = smoothstep(1.0, 0.85, length(r * vec2(1.0, 2.1))); shade = 0.85 + 0.15 * r.y; }
  else if (shape == 5) { a = exp(-dot(uv, uv) * 5.0); shade = 1.0 + exp(-dot(uv, uv) * 25.0) * 0.6; }
  else if (shape == 6) {
    a = step(abs(r.x), 0.62) * step(abs(r.y), 0.82);
    float lines = step(0.5, fract(r.y * 6.0)) * step(abs(r.x), 0.5) * step(r.y, 0.6);
    // ruled lines, and an edge so a white sheet shows on a white page
    float edge = 1.0 - step(abs(r.x), 0.55) * step(abs(r.y), 0.75);
    shade = 1.0 - lines * 0.12 - edge * 0.16;
  }
  else if (shape == 7) { a = smoothstep(0.16, 0.04, abs(length(uv) - 0.72)); }
  else {
    vec2 q = r * vec2(1.0, 1.7);
    a = smoothstep(1.0, 0.9, length(q)) * step(-0.95, r.y);
    shade = 0.8 + 0.2 * step(abs(r.x), 0.05);
  }
  if (a < 0.01) discard;
  vec3 col = mix(uColorA, uColorB, vMix) * shade;
  gl_FragColor = vec4(col, a * vAlpha);
}
`;

export function field(k, opts) {
  const o = {
    count: 120,
    shape: 'dot',
    dir: [0, -1],
    speed: [10, 30],
    size: [3, 8],
    sway: 0,
    spin: 0,
    twinkle: 0,
    repel: 0,
    parallax: 0.15,
    opacity: 1,
    glow: false,
    colors: [[255, 255, 255], [255, 255, 255]],
    ...opts,
  };
  const n = Math.max(4, Math.round(o.count * k.density));
  const geo = new THREE.BufferGeometry();
  const seeds = new Float32Array(n * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const [dx, dy] = o.dir;
  const dl = Math.hypot(dx, dy) || 1;
  const uniforms = {
    uTime: { value: 0 },
    uView: { value: new THREE.Vector2(1, 1) },
    uDir: { value: new THREE.Vector2(dx / dl, dy / dl) },
    uSpeed: { value: new THREE.Vector2(...o.speed) },
    uSizes: { value: new THREE.Vector2(...o.size) },
    uSway: { value: o.sway },
    uSpin: { value: o.spin },
    uTwinkle: { value: o.twinkle },
    uPointer: { value: new THREE.Vector3() },
    uRepel: { value: o.repel },
    uScroll: { value: 0 },
    uParallax: { value: o.parallax },
    uRatio: { value: 1 },
    uOpacity: { value: o.opacity },
    uColorA: { value: new THREE.Color() },
    uColorB: { value: new THREE.Color() },
    uShape: { value: SHAPES[o.shape] ?? 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: FIELD_VERT, fragmentShader: FIELD_FRAG, uniforms, transparent: true, depthTest: false, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  k.scene.add(points);
  const api = {
    points,
    uniforms,
    colors(a, b = a) {
      rgb(a, uniforms.uColorA.value);
      rgb(b, uniforms.uColorB.value);
    },
    glow(on) {
      mat.blending = on ? THREE.AdditiveBlending : THREE.NormalBlending;
      mat.needsUpdate = true;
    },
    step(t) {
      uniforms.uTime.value = t;
      uniforms.uView.value.set(k.size.w, k.size.h);
      uniforms.uPointer.value.set(k.pointer.x, k.pointer.y, k.pointer.near);
      // the page scrolling up carries the near ones up a little with it
      uniforms.uScroll.value = k.scroll.y;
      uniforms.uRatio.value = k.ratio();
    },
  };
  api.colors(...o.colors);
  api.glow(o.glow && k.dark);
  return api;
}

// ─── Bursts: a pool of short-lived particles, moved in JavaScript ───────────
// For clicks and little events: `emit(x, y, { count, speed, life, colors,
// gravity, size })`. Up to `max` alive at once; the oldest give way.
export function bursts(k, { max = 160, shape = 'spark', size = 10, glow = true } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  const life = new Float32Array(max); // 0..1 left
  const sz = new Float32Array(max);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  const vel = new Float32Array(max * 2);
  const span = new Float32Array(max);
  const grav = new Float32Array(max);
  const uniforms = { uRatio: { value: 1 }, uShape: { value: SHAPES[shape] ?? 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float aLife;
      attribute float aSize;
      uniform float uRatio;
      varying vec3 vColor;
      varying float vLife;
      void main() {
        vColor = color;
        vLife = aLife;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (0.4 + 0.6 * aLife) * uRatio;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uShape;
      varying vec3 vColor;
      varying float vLife;
      void main() {
        if (vLife <= 0.0) discard;
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float a;
        int shape = int(uShape + 0.5);
        if (shape == 2) a = step(max(abs(uv.x), abs(uv.y)), 0.8);
        else if (shape == 1) a = max(pow(smoothstep(0.6, 0.0, length(uv)), 2.0), max(smoothstep(0.18, 0.0, abs(uv.x)) * smoothstep(1.0, 0.0, abs(uv.y)), smoothstep(0.18, 0.0, abs(uv.y)) * smoothstep(1.0, 0.0, abs(uv.x))));
        else if (shape == 7) a = smoothstep(0.18, 0.05, abs(length(uv) - 0.7));
        else if (shape == 3) a = smoothstep(0.86, 0.78, abs(uv.x) * 1.35 + abs(uv.y) * 0.85);
        else if (shape == 6) a = step(abs(uv.x), 0.62) * step(abs(uv.y), 0.82);
        else a = pow(smoothstep(1.0, 0.0, length(uv)), 2.0);
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor, a * min(1.0, vLife * 1.6));
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 10;
  k.scene.add(pts);
  let next = 0;
  let alive = 0;
  const c = new THREE.Color();
  return {
    glow(on) {
      mat.blending = on && glow ? THREE.AdditiveBlending : THREE.NormalBlending;
      mat.needsUpdate = true;
    },
    emit(x, y, { count = 18, speed = [60, 220], life: secs = [0.5, 1.1], colors = [[255, 255, 255]], gravity = -120, size: s = size, angle = [0, Math.PI * 2] } = {}) {
      for (let j = 0; j < count; j++) {
        const i = next;
        next = (next + 1) % max;
        const a = angle[0] + Math.random() * (angle[1] - angle[0]);
        const v = speed[0] + Math.random() * (speed[1] - speed[0]);
        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        vel[i * 2] = Math.cos(a) * v;
        vel[i * 2 + 1] = Math.sin(a) * v;
        span[i] = secs[0] + Math.random() * (secs[1] - secs[0]);
        life[i] = 1;
        grav[i] = gravity;
        sz[i] = s * (0.6 + Math.random() * 0.8);
        rgb(colors[(Math.random() * colors.length) | 0], c);
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
      }
      alive = max;
    },
    step(dt) {
      uniforms.uRatio.value = k.ratio();
      if (!alive) return;
      let any = 0;
      for (let i = 0; i < max; i++) {
        if (life[i] <= 0) continue;
        life[i] = Math.max(0, life[i] - dt / span[i]);
        vel[i * 2] *= 1 - dt * 1.5;
        vel[i * 2 + 1] = vel[i * 2 + 1] * (1 - dt * 1.5) + grav[i] * dt;
        pos[i * 3] += vel[i * 2] * dt;
        pos[i * 3 + 1] += vel[i * 2 + 1] * dt;
        if (life[i] > 0) any++;
      }
      alive = any;
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aLife.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
    },
  };
}

// ─── A full-screen shader behind everything ─────────────────────────────────
// `frag` gets vUv (0..1), uRes (px), uTime, uPointer (px from the middle, y
// up, and how near), uScroll (px) and whatever `uniforms` adds.
export function backdrop(k, frag, uniforms = {}) {
  const u = {
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uPointer: { value: new THREE.Vector3() },
    uScroll: { value: 0 },
    ...uniforms,
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = position.xy * 0.5 + 0.5;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: frag,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  k.scene.add(mesh);
  return {
    mesh,
    uniforms: u,
    step(t) {
      u.uTime.value = t;
      u.uRes.value.set(k.size.w, k.size.h);
      u.uPointer.value.set(k.pointer.x, k.pointer.y, k.pointer.near);
      u.uScroll.value = k.scroll.y;
    },
  };
}

// ─── Flat shapes from outlines ──────────────────────────────────────────────
// A silhouette from a list of [x, y] points (or several, each its own part),
// drawn in one flat colour: ships, planes, marks.
export function silhouette(parts, color, opacity = 1) {
  const list = Array.isArray(parts[0][0]) ? parts : [parts];
  const geos = list.map((pts) => new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)))));
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: rgb(color), transparent: true, opacity, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
  for (const g of geos) group.add(new THREE.Mesh(g, mat));
  group.userData.material = mat;
  return group;
}

// A line of text as a flat sprite (a "+100", a word), drawn once on a canvas.
export function label(text, { font = '700 28px ui-monospace, monospace', color = '#ffffff', pad = 8 } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + pad * 2;
  const h = Math.ceil(parseInt(font.match(/(\d+)px/)?.[1] ?? 28, 10) * 1.4) + pad * 2;
  c.width = w * 2;
  c.height = h * 2;
  g.scale(2, 2);
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(c);
  sharpen(tex);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  return mesh;
}

// Random helpers for scenes.
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (list) => list[(Math.random() * list.length) | 0];

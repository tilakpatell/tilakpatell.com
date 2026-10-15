// The galaxy’s post (universe/post.js’s createPost, the pass the galaxy
// draws through) on the node renderer: the surface’s twin of it
// (../surface/nodes/post.js) with what the galaxy asks of it besides. Its
// factory builds its chain whole, with no way in for another picture, so
// this is its copy, plus:
//
// - overlay(scene, camera): the cockpit from the pilot’s seat, drawn over
//   the scene with a fresh depth before the bloom (RenderPass `over` in the
//   GLSL post). Here a second pass draws the cab with the scene’s picture as
//   its background, so it blends over it as the cab did over the composer’s
//   buffer (its glass, its additive lights) and its lights reach the bloom.
//   While there’s none it isn’t drawn at all: its pass is skipped, and the
//   bloom and the grade read the scene’s pass.
// - the galaxy’s bloom (galaxy/look.js): the soft-knee bright pass (KNEE,
//   four taps a quarter of a bloom texel out), the falloff over the mips
//   (three’s TSL bloom fixes its factors, so the falloff goes through its
//   per-mip tints, exact at the galaxy’s radius of 0) and the knee on the
//   ?debug panel’s bloom.
// - lite() drops the bloom’s passes, as the GLSL post disables its pass.
//
// The black hole’s lens, the finish’s toe and LUT are the universe map’s and
// the surface’s; the galaxy never asks for them, so they stay with those
// twins. On the node renderer there’s no composer (`composer` is null):
// programs are made by compileAsync and one small post.render.
//
//   createPost(renderer, scene, camera, { small, bloom }) → the post

import * as THREE from 'three';
import { RenderPipeline } from 'three/webgpu';
import { Fn, If, clamp, dot, float, length, luminance, max, mix, pass, pow, screenCoordinate, screenUV, select, smoothstep, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { bloom as bloomNode } from 'three/addons/tsl/display/BloomNode.js';
import { blueNoiseTexture } from '../../../lib/three/noise';
import { LOOK } from '../../universe/look';
import { UNREAL, bloomSize } from '../surface/nodes/post';

export { bloomSize };

const SOFTEST = 0.6;
// three’s TSL bloom’s fixed mip factors (UnrealBloomPass’s defaults)
const FACTORS = [1, 0.8, 0.6, 0.4, 0.2];

// finite(): NaN to black, nothing hotter than 64 (a NaN fails every
// comparison, so it’s caught by asking whether it equals itself)
const finite = (c) => clamp(select(c.x.equal(c.x).and(c.y.equal(c.y)).and(c.z.equal(c.z)), c, vec3(0, 0, 0)), 0, 64);

// the shoulder of Khronos’ neutral tone map without its toe
const shoulder = Fn(([c]) => {
  const out = vec3(c).toVar();
  const peak = max(c.x, max(c.y, c.z));
  If(peak.greaterThanEqual(0.8), () => {
    const top = float(0.04).div(peak.sub(0.6)).oneMinus();
    const s = c.mul(top.div(peak));
    out.assign(mix(s, vec3(top), float(1).div(peak.sub(top).mul(0.15).add(1)).oneMinus()));
  });
  return out;
}, 'vec3');

const srgb = (c) => mix(c.mul(12.92), pow(c, vec3(1 / 2.4)).mul(1.055).sub(0.055), step(0.0031308, c));

export function createPost(renderer, scene, camera, { small = false, bloom: look = null } = {}) {
  const samples = renderer.getPixelRatio() >= 1.75 ? 0 : small ? 2 : 4;
  const scenePass = pass(scene, camera, { samples, type: THREE.HalfFloatType });
  const sceneTex = scenePass.getTextureNode();
  // whatever’s drawn over the scene (the cockpit), with a fresh depth and
  // the scene’s picture behind it
  const overPass = pass(scene, camera, { samples, type: THREE.HalfFloatType });
  const overTex = overPass.getTextureNode();
  const behind = sceneTex.sample(screenUV);
  const BLOOM = { ...LOOK.bloom, ...look };
  const knee = typeof BLOOM.knee === 'number';
  const noiseSize = small ? 32 : 64;
  const tNoise = blueNoiseTexture(noiseSize, 1);
  const u = {
    uContrast: uniform(0.07),
    uSat: uniform(1.06),
    uVignette: uniform(0.3),
    uAspect: uniform(16 / 9),
    uRush: uniform(0),
    uCenter: uniform(new THREE.Vector2(0.5, 0.5)),
    uHit: uniform(0),
    uFrame: uniform(new THREE.Vector2()),
    uNoiseSize: uniform(noiseSize),
    uGrain: uniform(0),
    uAberration: uniform(0),
    uExposure: uniform(1),
    uDefocus: uniform(0),
    uTexel: uniform(new THREE.Vector2(1, 1)),
    uGlow: uniform(1), // (lite() takes the bloom off: 0)
    uOver: uniform(0), // (1 while there’s an overlay: the picture is its pass’s)
    uKnee: uniform(knee ? BLOOM.knee : 0),
    uStep: uniform(new THREE.Vector2(0.001, 0.001)),
  };
  // the picture as the composer’s buffer held it before the bloom: the
  // scene, or the scene with the cockpit over it
  const base = (at) => select(u.uOver.greaterThan(0.5), overTex.sample(at), sceneTex.sample(at)).rgb;
  const glowing = bloomNode(vec4(finite(base(uv())), 1), BLOOM.strength * UNREAL, BLOOM.radius, BLOOM.threshold);
  // its first step: the soft knee, KNEE line for line (input unread: it
  // reads the picture itself, four taps round the texel)
  if (knee) {
    glowing.highPassFn = Fn(({ threshold }) => {
      const at = (o) => finite(base(uv().add(o)));
      const s = u.uStep;
      const c = at(s.negate()).add(at(vec2(s.x, s.y.negate()))).add(at(vec2(s.x.negate(), s.y))).add(at(s)).mul(0.25);
      const l = luminance(c);
      const soft = clamp(l.sub(threshold).add(u.uKnee), 0, u.uKnee.mul(2)).toVar();
      soft.assign(soft.mul(soft).div(u.uKnee.mul(4).add(1e-4)));
      return vec4(c.mul(max(soft, l.sub(threshold)).div(max(l, 1e-4))), 1);
    });
  }
  // the falloff: three’s factor times the tint is the look’s
  if (BLOOM.falloff) glowing.bloomTintColors.forEach((t, i) => t.setScalar(BLOOM.falloff[i] / FACTORS[i]));
  let on = true;
  let glow = true; // bloom, until lite() takes it off
  let overOn = false;
  // (the bloom’s passes and the overlay’s drawn only while they’re wanted)
  const bloomDraw = glowing.updateBefore.bind(glowing);
  glowing.updateBefore = (frame) => (glow ? bloomDraw(frame) : undefined);
  const overDraw = overPass.updateBefore.bind(overPass);
  overPass.updateBefore = (frame) => {
    if (!overOn) return undefined;
    const s = overPass.scene;
    const was = s.backgroundNode;
    s.backgroundNode = behind;
    try {
      return overDraw(frame);
    } finally {
      s.backgroundNode = was;
    }
  };

  const noise = (shift) => texture(tNoise, screenCoordinate.xy.add(shift).div(u.uNoiseSize)).r;
  // the picture and its glow, as the composer’s buffer held them after the bloom pass
  const lit = (at) => finite(base(at)).add(glowing.getTextureNode().sample(at).rgb.mul(u.uGlow));

  const grade = Fn(() => {
    const vUv = uv();
    const lin = lit(vUv).toVar();
    If(u.uAberration.greaterThan(0), () => {
      const q0 = vUv.sub(0.5);
      const off = q0.mul(u.uAberration).mul(smoothstep(0.15, 0.75, length(q0.mul(vec2(u.uAspect, 1)))));
      lin.assign(vec3(lit(vUv.add(off)).r, lin.g, lit(vUv.sub(off)).b));
    });
    If(u.uDefocus.greaterThan(0), () => {
      const qd = vUv.sub(0.5).mul(vec2(u.uAspect, 1));
      const w = u.uDefocus.mul(smoothstep(0.55, 1, length(qd).div(length(vec2(u.uAspect, 1)).mul(0.5))));
      const o = u.uTexel.mul(1.5);
      const soft = lin.add(lit(vUv.add(vec2(o.x, 0)))).add(lit(vUv.sub(vec2(o.x, 0)))).add(lit(vUv.add(vec2(0, o.y)))).add(lit(vUv.sub(vec2(0, o.y))));
      lin.assign(mix(lin, soft.div(5), w));
    });
    If(u.uRush.greaterThan(0.001), () => {
      // a few taps back toward the ship, more smeared the further out
      const d = vUv.sub(u.uCenter);
      const k = u.uRush.mul(smoothstep(0.1, 0.75, length(d.mul(vec2(u.uAspect, 1)))));
      const acc = vec3(lin).toVar();
      for (let i = 1; i <= 5; i++) acc.addAssign(lit(vUv.sub(d.mul(k.mul(0.011 * i)))));
      lin.assign(acc.div(6));
    });
    lin.mulAssign(u.uExposure);
    // grain: on the light, before the tone map, moving each frame
    lin.mulAssign(select(u.uGrain.greaterThan(0), noise(u.uFrame).sub(0.5).mul(2).mul(u.uGrain).add(1), float(1)));
    const c = srgb(clamp(shoulder(lin), 0, 1)).toVar();
    const l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c.assign(max(mix(vec3(l), c, u.uSat), 0));
    c.assign(mix(c, c.mul(c).mul(c.mul(-2).add(3)), u.uContrast));
    const q = vUv.sub(0.5).mul(vec2(u.uAspect, 1));
    c.mulAssign(u.uVignette.add(u.uRush.mul(0.22)).mul(smoothstep(u.uRush.mul(-0.1).add(0.35), 1.1, length(q).mul(1.25))).oneMinus());
    // a hit: the edges flash red
    c.assign(mix(c, vec3(1, 0.12, 0.08), u.uHit.mul(0.4).mul(smoothstep(0.45, 1.15, length(q).mul(1.3)))));
    // the dither, under a step of the 8 bits it’s written at
    c.addAssign(noise(vec2(17, 31)).sub(0.5).div(255));
    return vec4(clamp(c, 0, 1), 1);
  });

  const post = new RenderPipeline(renderer);
  post.outputColorTransform = false; // (FINAL encodes it itself)
  post.outputNode = grade();
  let frame = 0;
  let level = 0;
  let aberrationWant = 0;
  let sharp = 1;
  const at = { w: 0, h: 0, ratio: 0 };
  const size = new THREE.Vector2();
  return {
    get on() {
      return on;
    },
    // where the scene is drawn: the post’s own target, or the canvas once it’s off
    get target() {
      return on ? scenePass.renderTarget : null;
    },
    // (the node renderer compiles a pass by rendering it: no composer)
    composer: null,
    scenePass,
    overPass,
    bloomNode: glowing,
    get ratio() {
      const full = renderer.getPixelRatio();
      return on ? Math.min(full, Math.max(SOFTEST, full * sharp)) : full;
    },
    get sharpness() {
      return sharp;
    },
    set sharpness(k) {
      sharp = k;
    },
    render(w, h) {
      if (!on) {
        renderer.render(scene, camera);
        if (overOn) {
          const was = renderer.autoClear;
          renderer.autoClear = false;
          renderer.clearDepth();
          renderer.render(overPass.scene, overPass.camera);
          renderer.autoClear = was;
        }
        return;
      }
      const full = renderer.getPixelRatio();
      const ratio = Math.min(full, Math.max(SOFTEST, full * sharp));
      if (w !== at.w || h !== at.h || ratio !== at.ratio) {
        Object.assign(at, { w, h, ratio });
        // the scene drawn at the pace’s sharpness, a share of the canvas’s
        scenePass.setResolutionScale(ratio / full);
        overPass.setResolutionScale(ratio / full);
        // the glow worked out at the page’s own pixels, its long side capped
        renderer.getDrawingBufferSize(size);
        const [bw, bh] = bloomSize(w * ratio, h * ratio, { small, cap: BLOOM.cap });
        glowing.setResolutionScale(Math.min(1, bw / Math.max(1, size.x)));
        u.uStep.value.set(0.25 / bw, 0.25 / bh);
        u.uAspect.value = w / h;
        u.uTexel.value.set(1 / Math.max(1, w * ratio), 1 / Math.max(1, h * ratio));
      }
      frame = (frame + 1) % 997;
      u.uFrame.value.set((frame * 37) % noiseSize, (frame * 23) % noiseSize);
      post.render();
    },
    // a scene drawn over the first, from `cam` (null: nothing)
    overlay(s, cam) {
      overOn = Boolean(s);
      overPass.scene = s ?? scene;
      overPass.camera = cam ?? camera;
      u.uOver.value = overOn ? 1 : 0;
    },
    // the bloom’s numbers, for the ?debug panel (lib/three/bloom’s
    // bloomGroups); a knee only for a soft-knee pass (undefined otherwise)
    bloom: {
      get threshold() {
        return glowing.threshold.value;
      },
      set threshold(v) {
        glowing.threshold.value = v;
      },
      get knee() {
        return knee ? u.uKnee.value : undefined;
      },
      set knee(v) {
        if (knee) u.uKnee.value = v;
      },
      get strength() {
        return BLOOM.strength;
      },
      set strength(v) {
        BLOOM.strength = v;
        if (glow) glowing.strength.value = v * UNREAL;
      },
      get radius() {
        return glowing.radius.value;
      },
      set radius(v) {
        glowing.radius.value = v;
      },
    },
    // bloom’s strength, for a moment’s flare: k times the base, k no more than the bloom’s flareMax
    flare(k) {
      if (glow) glowing.strength.value = BLOOM.strength * UNREAL * Math.min(k, BLOOM.flareMax ?? Infinity);
    },
    // the boost’s rush, 0…1, out from (x, y) on the canvas (0…1, y up)
    rush(k, x = 0.5, y = 0.5) {
      u.uRush.value = k;
      u.uCenter.value.set(x, y);
    },
    // a laser hit’s red flash, 0…1
    hit(k) {
      u.uHit.value = k;
    },
    grain(k) {
      u.uGrain.value = k;
    },
    aberration(k) {
      aberrationWant = k;
      u.uAberration.value = level >= 3 ? 0 : k;
    },
    exposure(k) {
      u.uExposure.value = k;
    },
    contrast(k) {
      u.uContrast.value = k;
    },
    setLevel(l) {
      level = l;
      u.uAberration.value = level >= 3 ? 0 : aberrationWant;
    },
    get flareOn() {
      return level < 2;
    },
    off() {
      if (!on) return;
      on = false;
      post.dispose();
    },
    // a lighter post, short of none: the bloom’s passes go, the grade stays
    lite() {
      glow = false;
      u.uGlow.value = 0;
    },
    uniforms: u,
    dispose() {
      post.dispose();
      glowing.dispose();
      scenePass.dispose();
      overPass.dispose();
      tNoise.dispose();
    },
  };
}

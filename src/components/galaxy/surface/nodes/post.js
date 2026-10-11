// The surface's post (universe/post.js's createPost, the pass the surface
// draws through) on the node renderer: the scene into an HDR pass, the
// bloom (three's TSL bloom, UnrealBloomPass's twin, its bright pass reading
// through finite() as the GLSL's did), then FINAL as a TSL function: the
// exposure, the grain, the toe, the neutral shoulder, the sRGB encoding,
// the saturation, the contrast, the vignette, a hit's red edges, the rush,
// the aberration, the soft edge and the dither, line for line. The output
// is already encoded, so the post's own colour transform is off. The same
// face as createPost's, for what the surface calls: on, target, ratio,
// sharpness, render(w, h), exposure(k), lite(), grain, aberration, rush,
// hit, contrast, defocus, grading, setToe, setLevel, flareOn, flare, bloom, off,
// dispose. (The black hole's lens is the universe map's, lane M's.)
//
//   createPost(renderer, scene, camera, { small, bloom }) → the post
//
// When lane R's passesFor lands, this is the surface's entry in it: the
// chain as data through rt.gfx.post, the grade as its node.

import * as THREE from 'three';
import { PostProcessing } from 'three/webgpu';
import { pass, vec4 } from 'three/tsl';
import { bloom as bloomNode } from 'three/addons/tsl/display/BloomNode.js';
import { BLANK_LUT, finalGrade, finalUniforms, finite } from './final';
import { LOOK } from '../../../universe/look';

const SOFTEST = 0.6;
// UnrealBloomPass's composite multiplies its sum by 3 × the strength
// (three's UnrealBloomPass.js, `3.0 * bloomStrength`); the TSL bloom by
// the strength alone. So the same numbers glow a third as much: the
// strength is handed over three times over. (The runtime's own bloom pass,
// src/runtime/webgpu.js, has the same third: lane R's to settle.)
export const UNREAL = 3;

// (universe/post.js's, the same rule: half the frame, its long side capped)
export function bloomSize(w, h, { small = false, cap = 640 } = {}) {
  const k = small ? 0.25 : 0.5;
  let bw = w * k;
  let bh = h * k;
  const long = Math.max(bw, bh);
  if (long > cap) {
    bw *= cap / long;
    bh *= cap / long;
  }
  return [Math.max(64, Math.round(bw)), Math.max(64, Math.round(bh))];
}

export function createPost(renderer, scene, camera, { small = false, bloom: look = null } = {}) {
  const samples = renderer.getPixelRatio() >= 1.75 ? 0 : small ? 2 : 4;
  const scenePass = pass(scene, camera, { samples, type: THREE.HalfFloatType });
  const BLOOM = { ...LOOK.bloom, ...look };
  const sceneTex = scenePass.getTextureNode();
  const glowing = bloomNode(vec4(finite(sceneTex.rgb), 1), BLOOM.strength * UNREAL, BLOOM.radius, BLOOM.threshold);
  const { u, tNoise, noiseSize } = finalUniforms({ small });
  // the scene and its glow, as the composer's buffer held them after the bloom pass
  const lit = (at) => finite(sceneTex.sample(at).rgb).add(glowing.getTextureNode().sample(at).rgb.mul(u.uGlow));
  const grade = () => finalGrade(u, lit, { tNoise });

  const post = new PostProcessing(renderer);
  post.outputColorTransform = false; // (FINAL encodes it itself)
  post.outputNode = grade();
  let frame = 0;
  let level = 0;
  let aberrationWant = 0;
  let defocusWant = 0;
  let houseGrade = null; // (the house's contrast and saturation, while a game's LUT stands in)
  let on = true;
  let glow = true;
  let sharp = 1;
  const at = { w: 0, h: 0, ratio: 0 };
  const size = new THREE.Vector2();
  return {
    get on() {
      return on;
    },
    get target() {
      return on ? scenePass.renderTarget : null;
    },
    // (the node renderer compiles a pass by rendering it: no composer)
    composer: null,
    scenePass,
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
        return;
      }
      const full = renderer.getPixelRatio();
      const ratio = Math.min(full, Math.max(SOFTEST, full * sharp));
      if (w !== at.w || h !== at.h || ratio !== at.ratio) {
        Object.assign(at, { w, h, ratio });
        // the scene drawn at the pace's sharpness, a share of the canvas's
        scenePass.setResolutionScale(ratio / full);
        // the glow worked out at the page's own pixels, its long side capped
        renderer.getDrawingBufferSize(size);
        const [bw] = bloomSize(w * ratio, h * ratio, { small, cap: BLOOM.cap });
        glowing.setResolutionScale(Math.min(1, bw / Math.max(1, size.x)));
        u.uAspect.value = w / h;
        u.uTexel.value.set(1 / Math.max(1, w * ratio), 1 / Math.max(1, h * ratio));
      }
      frame = (frame + 1) % 997;
      u.uFrame.value.set((frame * 37) % noiseSize, (frame * 23) % noiseSize);
      post.render();
    },
    bloom: {
      get threshold() {
        return glowing.threshold.value;
      },
      set threshold(v) {
        glowing.threshold.value = v;
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
    flare(k) {
      if (glow) glowing.strength.value = BLOOM.strength * UNREAL * Math.min(k, BLOOM.flareMax ?? Infinity);
    },
    rush(k, x = 0.5, y = 0.5) {
      u.uRush.value = k;
      u.uCenter.value.set(x, y);
    },
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
    // a game's grade: its LUT (a Data3DTexture of size³, sRGB in and out)
    // over the finished colour, the house's contrast and saturation set
    // aside while it's on; null: off, and the house's back
    grading(g) {
      if (g?.lut) {
        houseGrade ??= { contrast: u.uContrast.value, sat: u.uSat.value };
        u.tLut.value = g.lut;
        u.uLutSize.value = g.size;
        u.uLutMix.value = g.mix ?? 1;
        u.uContrast.value = 0;
        u.uSat.value = 1;
      } else {
        u.tLut.value = BLANK_LUT;
        u.uLutMix.value = 0;
        if (houseGrade) {
          u.uContrast.value = houseGrade.contrast;
          u.uSat.value = houseGrade.sat;
          houseGrade = null;
        }
      }
    },
    setToe(lo, hi) {
      u.uToe.value.set(lo, hi);
    },
    contrast(k) {
      u.uContrast.value = k;
    },
    defocus(k) {
      defocusWant = k;
      u.uDefocus.value = level >= 3 ? 0 : k;
    },
    setLevel(l) {
      level = l;
      u.uAberration.value = level >= 3 ? 0 : aberrationWant;
      u.uDefocus.value = level >= 3 ? 0 : defocusWant;
    },
    get flareOn() {
      return level < 2;
    },
    off() {
      if (!on) return;
      on = false;
      post.dispose();
    },
    lite() {
      glow = false;
      u.uGlow.value = 0;
    },
    uniforms: u,
    dispose() {
      post.dispose();
      glowing.dispose();
      scenePass.dispose();
      tNoise.dispose();
    },
  };
}

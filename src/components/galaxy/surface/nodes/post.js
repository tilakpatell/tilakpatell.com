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
import { Fn, If, clamp, texture3D, dot, float, length, max, mix, pass, pow, screenCoordinate, select, smoothstep, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { bloom as bloomNode } from 'three/addons/tsl/display/BloomNode.js';
import { blueNoiseTexture } from '../../../../lib/three/noise';
import { LOOK } from '../../../universe/look';

const SOFTEST = 0.6;
// (a texture node needs a picture: a 2³ identity cube until a game hands one)
const BLANK_LUT = (() => {
  const d = new Uint8Array(2 * 2 * 2 * 4);
  for (let i = 0; i < 8; i++) d.set([(i & 1) * 255, ((i >> 1) & 1) * 255, ((i >> 2) & 1) * 255, 255], i * 4);
  const t = new THREE.Data3DTexture(d, 2, 2, 2);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
})();
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

// finite(): NaN to black, nothing hotter than 64 (a NaN fails every
// comparison, so it's caught by asking whether it equals itself)
const finite = (c) => clamp(select(c.x.equal(c.x).and(c.y.equal(c.y)).and(c.z.equal(c.z)), c, vec3(0, 0, 0)), 0, 64);

// the shoulder of Khronos' neutral tone map without its toe
const shoulder = Fn(([c]) => {
  const out = vec3(c).toVar();
  const peak = max(c.x, max(c.y, c.z));
  If(peak.greaterThanEqual(0.8), () => {
    const top = float(0.04).div(peak.sub(0.6)).oneMinus();
    const s = c.mul(top.div(peak));
    out.assign(mix(s, vec3(top), float(1).div(peak.sub(top).mul(0.15).add(1)).oneMinus()));
  });
  return out;
});

const srgb = (c) => mix(c.mul(12.92), pow(c, vec3(1 / 2.4)).mul(1.055).sub(0.055), step(0.0031308, c));

export function createPost(renderer, scene, camera, { small = false, bloom: look = null } = {}) {
  const samples = renderer.getPixelRatio() >= 1.75 ? 0 : small ? 2 : 4;
  const scenePass = pass(scene, camera, { samples, type: THREE.HalfFloatType });
  const BLOOM = { ...LOOK.bloom, ...look };
  const sceneTex = scenePass.getTextureNode();
  const glowing = bloomNode(vec4(finite(sceneTex.rgb), 1), BLOOM.strength * UNREAL, BLOOM.radius, BLOOM.threshold);
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
    uToe: uniform(new THREE.Vector2(0, 0)),
    uDefocus: uniform(0),
    uTexel: uniform(new THREE.Vector2(1, 1)),
    uGlow: uniform(1), // (lite() takes the bloom off: 0)
    // a game's grading LUT (lib/three/gameLut.js), over the finished colour
    // as the game grades its own: off (mix 0) unless a world has one
    tLut: texture3D(BLANK_LUT),
    uLutSize: uniform(2),
    uLutMix: uniform(0),
  };
  const noise = (shift) => texture(tNoise, screenCoordinate.xy.add(shift).div(u.uNoiseSize)).r;
  // the scene and its glow, as the composer's buffer held them after the bloom pass
  const lit = (at) => finite(sceneTex.sample(at).rgb).add(glowing.getTextureNode().sample(at).rgb.mul(u.uGlow));

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
      const d = vUv.sub(u.uCenter);
      const k = u.uRush.mul(smoothstep(0.1, 0.75, length(d.mul(vec2(u.uAspect, 1)))));
      const acc = vec3(lin).toVar();
      for (let i = 1; i <= 5; i++) acc.addAssign(lit(vUv.sub(d.mul(k.mul(0.011 * i)))));
      lin.assign(acc.div(6));
    });
    lin.mulAssign(u.uExposure);
    // grain: on the light, before the tone map, moving each frame
    lin.mulAssign(select(u.uGrain.greaterThan(0), noise(u.uFrame).sub(0.5).mul(2).mul(u.uGrain).add(1), float(1)));
    // the toe: the colour scaled by its luminance's share
    lin.mulAssign(select(u.uToe.y.greaterThan(0), smoothstep(u.uToe.x, u.uToe.y, dot(lin, vec3(0.2126, 0.7152, 0.0722))), float(1)));
    const c = srgb(clamp(shoulder(lin), 0, 1)).toVar();
    const l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c.assign(max(mix(vec3(l), c, u.uSat), 0));
    c.assign(mix(c, c.mul(c).mul(c.mul(-2).add(3)), u.uContrast));
    If(u.uLutMix.greaterThan(0), () => {
      // (read at the texels' middles, so 0 and 1 land on the cube's ends)
      const uvw = c.mul(u.uLutSize.sub(1)).add(0.5).div(u.uLutSize);
      c.assign(mix(c, u.tLut.sample(uvw).rgb, u.uLutMix));
    });
    const q = vUv.sub(0.5).mul(vec2(u.uAspect, 1));
    c.mulAssign(u.uVignette.add(u.uRush.mul(0.22)).mul(smoothstep(u.uRush.mul(-0.1).add(0.35), 1.1, length(q).mul(1.25))).oneMinus());
    // a hit: the edges flash red
    c.assign(mix(c, vec3(1, 0.12, 0.08), u.uHit.mul(0.4).mul(smoothstep(0.45, 1.15, length(q).mul(1.3)))));
    // the dither, under a step of the 8 bits it's written at
    c.addAssign(noise(vec2(17, 31)).sub(0.5).div(255));
    return vec4(clamp(c, 0, 1), 1);
  });

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

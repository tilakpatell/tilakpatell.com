// The lens the cockpit is seen through, the last step of its post chain
// (scene.js) at mid and up (./levels.js): three's OutputPass, which tone
// maps and writes the screen's colour, its fragment shader given what a
// camera behind the glass adds on the way:
//
//   speed      at the jump, what's bright out of the glass trails light
//              back from the point you're flying at (`taps` samples towards
//              it, their bright part added over the sharp picture, so the
//              streaks keep their edges); the cockpit gets none, told apart
//              by the depth the cockpit's pass left (the world outside is
//              drawn first and its depth cleared, so a pixel with none is
//              outside the glass)
//   aberration the colours parted towards the edges, more at speed
//   glare      a sun in view: a glow round it, a streak across it and the
//              ghosts a lens throws back through the middle, as much as is
//              seen of it past the canopy's frame
//   dirt       the smudges on the canopy's glass catching that light, and
//              the flash's (on the glass only: the cockpit's own surfaces
//              have none)
//   vignette   and grain, the film's
//
// It is still the one pass it was (one GLSL site): what three's own does,
// plus this, in a shader of the same shape.
//
// lensPass(lens, { dirt }) → { pass, set(state), resize(w, h), dispose() }
//   lens: a level's `lens` row; dirt: false for none (a test, or a level without)
// lensAt({ lens, launching, throttle, flash, streak }) → { streak, aberration, glow }  (pure)

import * as THREE from 'three';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { clamp01, smooth } from './timeline';

// How strong each part of the lens is at a moment of the launch. `streak`
// is the vehicle's own share of the speed blur (0: none, the RV's drive).
// The blur builds with the throttle's square, so the wind-up stays clear;
// the aberration is a hair at rest and grows with it; the glass's dirt
// catches the jump's light, then the flash.
export function lensAt({ lens, launching = false, throttle = 0, flash = 0, streak = 1 }) {
  if (!lens) return { streak: 0, aberration: 0, glow: 0 };
  const go = launching ? clamp01(throttle) : 0;
  return {
    streak: lens.taps > 0 ? 0.12 * streak * smooth((go - 0.25) / 0.75) * go : 0,
    aberration: lens.aberration * (0.0003 + 0.0012 * go * go),
    glow: lens.dirt * Math.min(1.2, 0.22 * go * go + 1.0 * flash),
  };
}

const frag = ({ taps }) => /* glsl */ `
precision highp float;

uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform sampler2D tDirt;
uniform float uFocusOn;
uniform vec2 uFocus;
uniform float uStreak;
uniform float uAberr;
uniform float uVignette;
uniform float uGrain;
uniform float uTime;
uniform vec2 uRes;
uniform vec3 uGlow;
uniform vec4 uSun;
uniform vec3 uSunColor;
uniform float uFlare;
uniform float uDirt;
uniform float uLift;

#include <tonemapping_pars_fragment>
#include <colorspace_pars_fragment>

varying vec2 vUv;

// 1 where only the world outside the glass was drawn
float outside(vec2 p) {
  return step(0.99999, texture2D(tDepth, clamp(p, vec2(0.0005), vec2(0.9995))).r);
}

float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  vec2 c = uv - 0.5;
  float r2 = dot(c * vec2(aspect, 1.0), c * vec2(aspect, 1.0));

  // the colours parted towards the edges
  vec2 shift = c * uAberr * r2 * 4.0;
  vec3 col = vec3(texture2D(tDiffuse, uv - shift).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv + shift).b);
${
  taps > 0
    ? `
  // at speed, what's bright outside trails light back from where you're
  // going (the cockpit's own pixels, and samples that land on it, left out)
  if (uStreak > 0.002 && uFocusOn > 0.5 && outside(uv) > 0.5) {
    vec2 stepUv = (uFocus - uv) * uStreak / float(${taps});
    // (each pixel's samples started a random part of a step along, so the
    // gaps between them read as fine noise in the trail, not as bands)
    float jitter = hash(uv * uRes + fract(uTime * 3.7) * 61.0);
    vec3 trail = vec3(0.0);
    float weight = 0.0;
    for (int i = 1; i <= ${taps}; i++) {
      vec2 p = uv + stepUv * (float(i) - jitter);
      float w = outside(p) * (1.0 - (float(i) - 1.0) / float(${taps}));
      trail += max(texture2D(tDiffuse, p).rgb - 0.55, 0.0) * w;
      weight += w;
    }
    col += trail / max(weight, 1.0) * 1.6;
  }
`
    : ''
}
  // a sun in view: how much of it is seen past the frame (five looks round
  // it), fading as it nears the screen's edge
  vec3 lit = uGlow;
  if (uSun.z > 0.001) {
    vec2 sp = uSun.xy;
    vec2 o = vec2(uSun.w / aspect, uSun.w);
    float seen = (outside(sp) + outside(sp + vec2(o.x, 0.0)) + outside(sp - vec2(o.x, 0.0)) + outside(sp + vec2(0.0, o.y)) + outside(sp - vec2(0.0, o.y))) * 0.2;
    vec2 edge = smoothstep(vec2(-0.08), vec2(0.04), sp) * smoothstep(vec2(-0.08), vec2(0.04), 1.0 - sp);
    float k = uSun.z * seen * edge.x * edge.y;
    vec2 d = (uv - sp) * vec2(aspect, 1.0);
    float dist = length(d);
    // the glow round it and the streak across it
    vec3 flare = uSunColor * (0.07 / (1.0 + dist * dist * 900.0) + 0.015 / (1.0 + dist * 12.0) + 0.2 * exp(-abs(d.y) * 260.0) * exp(-abs(d.x) * 3.6));
    // the ghosts: back through the middle, each a soft disc, coloured by the coating
    vec2 axis = vec2(0.5) - sp;
    vec3 ghosts = vec3(0.0);
    for (int i = 0; i < 4; i++) {
      float f = float(i);
      vec2 g = sp + axis * (0.55 + f * 0.48);
      float rad = 0.02 + 0.035 * fract(f * 0.618 + 0.3);
      float gd = length((uv - g) * vec2(aspect, 1.0));
      vec3 tint = mix(vec3(0.35, 0.6, 1.0), vec3(1.0, 0.55, 0.3), fract(f * 0.37));
      ghosts += tint * smoothstep(rad, rad * 0.55, gd) * (0.035 + 0.03 * fract(f * 0.71));
    }
    col += (flare + uSunColor * ghosts) * k * uFlare;
    lit += uSunColor * k * 0.9 / (1.0 + dist * dist * 30.0);
  }
  // the smudges on the glass, catching it
  col += texture2D(tDirt, uv).r * lit * uDirt * outside(uv);

  // (the white-out's push, ahead of the tone mapping, or in place of it)
  gl_FragColor = vec4(col * uLift, 1.0);

  #ifdef LINEAR_TONE_MAPPING
    gl_FragColor.rgb = LinearToneMapping(gl_FragColor.rgb);
  #elif defined(REINHARD_TONE_MAPPING)
    gl_FragColor.rgb = ReinhardToneMapping(gl_FragColor.rgb);
  #elif defined(CINEON_TONE_MAPPING)
    gl_FragColor.rgb = CineonToneMapping(gl_FragColor.rgb);
  #elif defined(ACES_FILMIC_TONE_MAPPING)
    gl_FragColor.rgb = ACESFilmicToneMapping(gl_FragColor.rgb);
  #elif defined(AGX_TONE_MAPPING)
    gl_FragColor.rgb = AgXToneMapping(gl_FragColor.rgb);
  #elif defined(NEUTRAL_TONE_MAPPING)
    gl_FragColor.rgb = NeutralToneMapping(gl_FragColor.rgb);
  #elif defined(CUSTOM_TONE_MAPPING)
    gl_FragColor.rgb = CustomToneMapping(gl_FragColor.rgb);
  #endif

  // the corners a little darker, as a lens has them
  gl_FragColor.rgb *= 1.0 - uVignette * smoothstep(0.12, 0.85, r2);

  #ifdef SRGB_TRANSFER
    gl_FragColor = sRGBTransferOETF(gl_FragColor);
  #endif

  // and the film's grain, over everything (in the screen's colour, so it's even)
  gl_FragColor.rgb += (hash(uv * uRes + fract(uTime * 7.31) * 97.0) - 0.5) * uGrain;
}
`;

// The glass's smudges, as a lens camera's dirt texture is: soft blots of
// every size, a few wipes across, heavier towards the edges. Grey, made
// once a cockpit on a canvas.
function dirtTexture(seed = 7) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const W = 512;
  const H = 288;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  const blot = (x, y, rad, a) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(255,255,255,${a})`);
    gr.addColorStop(0.55, `rgba(255,255,255,${a * 0.45})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  };
  for (let i = 0; i < 70; i++) {
    const x = r() * W;
    const y = r() * H;
    const edge = Math.max(Math.abs(x / W - 0.5), Math.abs(y / H - 0.5)) * 2;
    blot(x, y, 6 + Math.pow(r(), 2) * 60, (0.05 + r() * 0.12) * (0.45 + edge));
  }
  // wipes: a cloth's arcs across the glass
  g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const x = r() * W;
    const y = r() * H;
    g.strokeStyle = `rgba(255,255,255,${0.025 + r() * 0.04})`;
    g.lineWidth = 8 + r() * 26;
    g.beginPath();
    g.arc(x, y, 60 + r() * 160, r() * 6.28, r() * 6.28 + 0.6 + r() * 1.2);
    g.stroke();
  }
  // specks
  for (let i = 0; i < 160; i++) blot(r() * W, r() * H, 1 + r() * 2.5, 0.2 + r() * 0.35);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

// (a texture to stand in where a level has no dirt, or a depth where none was kept: black and empty)
const blank = () => {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
};

export function lensPass(lens, { dirt = true } = {}) {
  const pass = new OutputPass();
  const dirtTex = dirt && lens.dirt > 0 && typeof document !== 'undefined' ? dirtTexture() : blank();
  const none = blank();
  Object.assign(pass.uniforms, {
    tDepth: { value: none },
    tDirt: { value: dirtTex },
    uFocusOn: { value: 0 },
    uFocus: { value: new THREE.Vector2(0.5, 0.5) },
    uStreak: { value: 0 },
    uAberr: { value: lens.aberration * 0.0003 },
    uVignette: { value: lens.vignette },
    uGrain: { value: lens.grain },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uGlow: { value: new THREE.Color(0, 0, 0) },
    uSun: { value: new THREE.Vector4(0.5, 0.5, 0, 0.01) },
    uSunColor: { value: new THREE.Color(1, 1, 1) },
    uFlare: { value: lens.flare },
    uDirt: { value: lens.dirt > 0 ? 1 : 0 },
    uLift: { value: 1 },
  });
  pass.material.fragmentShader = frag(lens);
  pass.material.name = 'CockpitLens';
  pass.material.needsUpdate = true;
  const u = pass.uniforms;
  return {
    pass,
    // the drawing buffer's size in pixels
    resize(w, h) {
      u.uRes.value.set(Math.max(1, w), Math.max(1, h));
    },
    // depth: the cockpit pass's depth texture (null: none kept, nothing is
    // told apart, so no speed blur and no sun's frame); focus: where you're
    // flying, on the screen (0…1, null when it's behind you); sun: { at:
    // [x, y] on the screen, k, size } or null; glow: [r, g, b], what the
    // whole glass catches; lift: the picture's light pushed up (1 as drawn)
    set({ depth, time, focus, streak, aberration, glow, sun, sunColor, lift }) {
      if (lift != null) u.uLift.value = lift;
      if (depth !== undefined) u.tDepth.value = depth ?? none;
      if (time != null) u.uTime.value = time;
      if (focus !== undefined) {
        u.uFocusOn.value = focus && u.tDepth.value !== none ? 1 : 0;
        if (focus) u.uFocus.value.set(focus[0], focus[1]);
      }
      if (streak != null) u.uStreak.value = streak;
      if (aberration != null) u.uAberr.value = aberration;
      if (glow) u.uGlow.value.setRGB(glow[0], glow[1], glow[2]);
      if (sun !== undefined) {
        if (sun && u.tDepth.value !== none) u.uSun.value.set(sun.at[0], sun.at[1], sun.k, sun.size ?? 0.01);
        else u.uSun.value.z = 0;
      }
      if (sunColor) u.uSunColor.value.set(sunColor);
    },
    dispose() {
      pass.dispose();
      dirtTex.dispose();
      none.dispose();
    },
  };
}

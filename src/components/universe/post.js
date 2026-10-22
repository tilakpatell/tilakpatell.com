// How the universe map is drawn, after the scene itself: into an HDR target
// (multisampled short of a sharp screen: the canvas's own antialiasing
// doesn't reach an offscreen one, so the canvas goes without), then bloom for what's brighter than lit paint (the sun,
// lit windows, engines, shots), then one last pass: the tone map, the sRGB
// encoding and a light grade (a touch of contrast and saturation, a
// vignette), and, while the ship boosts, a rush: the picture smeared out
// from the ship toward the edges (the ship itself stays sharp) and the
// vignette drawn in. A laser hit flashes the edges red. Near the black hole
// out in deep space the picture bends round it: what's behind it is drawn
// pulled out round its shadow, as a real one's gravity bends the light
// (lens: where it is on the canvas and how big its shadow looks there), and
// twisted a little round with its spin. Only what's behind it: the scene's
// depth says what's nearer than the hole (the ship, in front of it), and
// that's drawn as it is. The shadow itself is drawn black over all but
// that (no glow gets into it, and falling in, the camera can be in past the
// sphere that draws it). The tone map is the shoulder of Khronos' neutral one without
// its toe: everything under 0.8 stays exactly as drawn (the faint Milky Way,
// the planets' night sides, the signs' colours) and only what's brighter is
// rounded off toward white. While frames run long (lib/three/pace) the scene
// and its passes are drawn less sharp, a step at a time, and the last pass
// spreads them over the whole canvas (which keeps its size, so the names and
// the HUD over it stay crisp); still too slow at the softest, the scene
// turns the post off and draws straight to the canvas, as before there was
// any. Short of that, lite() drops the bloom (the costliest pass) and keeps
// the last one, so the tone map and the grade stay.
//
// Bloom and the last pass both read the scene through finite(): a pixel
// that isn't a number (some GPUs make one of a pow() just below zero, or a
// normal of length zero) reads as black, and nothing reads hotter than 64.
// Unchecked, the blur smears one bad pixel into blocks of black across the
// screen, bigger at each of its levels.
//
// spaceEnvironment(renderer, sky, { light, colour }) is what shiny things
// reflect: the Milky Way, brought up, with the key light's glow where the
// key light is (`light`, the way toward it; `colour`, its star's, linear
// [r, g, b]) and a cool fill opposite, so metal catches the same light the
// scene is lit by.
//
// overlay(scene, camera) draws a second scene over the first with its own
// depth, before the bloom (the cockpit, from the pilot's seat, so its frame
// is always in front of whatever is out there and its lights glow too); null
// takes it off again.
//
// view(scene, camera) draws another scene in the first's place, from its own
// camera (the galaxy's holotable, while the map is open: the bloom and the
// grade as the flight has them, and nothing of the flight drawn); null puts
// the first back.
//
// The finish (the universe map asks for it; the galaxy and its surfaces,
// which draw through here too, keep their picture as it was): a blue-noise
// dither after the sRGB encode, a fraction of a step, so the dark gradients
// round the suns and the Maw don't band at 8 bits; a little film grain on
// top while asked (grain(k), moving each frame); a touch of chromatic
// aberration toward the edges (aberration(k): red and blue read a little
// apart, more in the boost and a hit); an exposure that opens up in the dark
// and stops down into a sun (exposure(k), lib/three/exposure.js); and the
// bloom worked out at half the frame, its long side no more than 640
// (bloomSize). setLevel(level) follows lib/three/pace: the sun's flare
// (flareOn, drawn by the scene) goes at step 2, the aberration at 3, and
// both come back as the frames do.
//
// And a lens, the universe map's alone (off by default, so the galaxy's
// picture is as it was): a toe (setToe(lo, hi)) that takes what's darker
// than `lo` to black and leaves what's brighter than `hi` exactly as drawn,
// smooth between, so the sky between the stars has a floor while the faint
// things above it (the Milky Way's band, a night side's city lights, a
// sign's colour, all over 0.08) keep theirs; more contrast (contrast(k)); and
// a soft edge (defocus(k)): the fine detail toward the corners blurred over
// five reads, nothing in the middle third where the ship is, so the eye
// stays on it. The soft edge goes at pace step 3 with the aberration.

//
// And a finish of its own for a scene that draws its sharpness itself (the
// universe map's: createPost's `upscale`, off by default, so the galaxy's
// picture is as it was). The scene says how sharp it could be drawn at
// most (`top`: the budget's least and the visitor's render resolution, over
// a canvas of the screen's own pixels, module.js's `canvas: 'screen'`), and
// the pace's steps come off that. Sharper than the canvas, the last pass
// folds it down as it reads it. Softer, the grade is worked out at the
// scene's size into an 8-bit picture and brought up to the canvas by FSR 1
// (AMD's FidelityFX Super Resolution, GPUOpen, MIT): EASU, a Lanczos kernel
// stretched along the edge it finds, so edges come up as edges rather than
// stairs, and RCAS, a sharpen limited by each pixel's own contrast, which
// gives back what the stretch soft-focused without ringing; then the
// dither again, as the canvas is 8 bits too. Its multisampling follows the
// sharpness it's drawn at (samplesAt): none where the pixels are too small
// for a stair to show, two, then four as they grow, since a softer picture
// brought up shows its stairs bigger. maxSamples caps it (the visitor's
// video settings), and glowing(on) takes the bloom off and back.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { LOOK } from './look';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { blueNoiseTexture } from '../../lib/three/noise';
import { guardOf } from '../../lib/three/frameGuard';
import { precompile } from '../../lib/three/renderer';

export const LIGHT = new THREE.Vector3(-0.6, 0.62, 0.48).normalize(); // the key light, upper left
export const FILL = new THREE.Vector3(0.7, -0.4, -0.3).normalize();

// bloom: only what's well past lit paint glows (lit surfaces top out near
// 2 under the key light; the sun, windows and engines are drawn hotter):
// the map's look's (./look.js) unless a scene brings its own (createPost's
// `bloom`, from its look.js), each post's a copy its ?debug panel can set
const SOFTEST = 0.6; // device pixels to a CSS one, at the least, however busy

// the bloom's first level: half the frame (a quarter on a small one), its
// long side no more than `cap`, never under 64 (UnrealBloomPass halves what
// it's given for its first level, so it's given twice this)
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

// how far red and blue read apart at the frame's edge: none on a low tier,
// a hair at rest (more and the sky's stars out toward the edges had
// coloured fringes, softening them), more in the boost's rush and a hit
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// The universe map's lens (scene.js sets it). The toe is on linear light
// after exposure, where 0.08 is already 30 % grey on screen: wide, it took
// rocks and ships in shadow and planets' night sides down to black with the
// sky. So it takes only what's under about 3 % grey on screen (the black
// between the stars) and leaves anything lit, however dimly; the contrast
// stays gentle, since it darkens what's under mid-grey too.
export const MAP_LENS = { toe: [0.002, 0.012], contrast: 0.1 };

// The toe, as the last pass works it out on a luminance (`hi` 0: off)
export const toe = (l, lo, hi) => (hi > 0 ? l * smooth(lo, hi, l) : l);

// How much of the soft edge a pixel at uv (0…1) gets on a frame `aspect`
// wide: by its distance from the centre over the corner's, so a corner is
// whole and the middle untouched at any shape of screen
export const edgeWeight = ([u, v], aspect) => smooth(0.55, 1, Math.hypot((u - 0.5) * aspect, v - 0.5) / (0.5 * Math.hypot(aspect, 1)));

export const aberrationFor = ({ rush = 0, hit = 0, tier = 'high' } = {}) => (tier === 'low' ? 0 : 0.0006 + 0.0054 * rush + 0.0034 * hit);

// The finish's numbers (`upscale`). How sharp the scene is drawn: the most
// it may be, a share of it by the pace, never under SOFTEST (nor over the
// most, where that's under SOFTEST itself)
export const drawnRatio = (top, sharp = 1) => Math.min(top, Math.max(SOFTEST, top * sharp));
// multisampling by the pixels the scene is drawn at, a CSS pixel's worth:
// at 1.75 and over a stair is too small to see (and four samples on a
// half-float target cost more than the rest of the frame there); over a
// screen's own 1.25, two; under, four (two at most on a small screen,
// whose chip has less to give), as a picture brought up shows its stairs
// bigger. Never more than `cap` (the visitor's video settings)
export function samplesAt(ratio, { small = false, cap = Infinity } = {}) {
  const want = ratio >= 1.75 ? 0 : ratio >= 1.25 || small ? 2 : 4;
  return Math.max(0, Math.min(want, cap));
}
// whether the canvas is sharper than the scene, so it's brought up (a
// hair's give, so a ratio worked out two ways isn't an upscale of 1.0001)
export const upscaling = (drawn, canvas) => drawn < canvas - 1e-3;
// RCAS's strength, in stops of its lobe's weight (0 the most, 2 none):
// FidelityFX's own default (_source: GPUOpen's ffx_fsr1.h,
// FSR_RCAS_DEFAULT_SHARPNESS, and three's FSR1Node)
export const RCAS_STOPS = 0.2;

// EASU (FSR 1's edge-adaptive spatial upsampling), from three r186's
// FSR1Node (examples/jsm/tsl/display), itself after GPUOpen's ffx_fsr1.h:
// twelve texels round the pixel, the way the edge runs through them read
// from their luma, and an approximate Lanczos 2 stretched along it and
// narrowed across it, clamped to the nearest four so it never rings.
// Read with texelFetch at the picture's own texels (8 bits, sRGB, the
// perceptual space it's made for).
const EASU = `
uniform sampler2D tDiffuse;
uniform vec2 uIn;
varying vec2 vUv;
vec3 tap(ivec2 p) { return texelFetch(tDiffuse, clamp(p, ivec2(0), ivec2(uIn) - 1), 0).rgb; }
float lumaOf(vec3 s) { return s.r * 0.5 + s.g + s.b * 0.5; }
// (one of the four bilinear quadrants: a above, b left, c the middle, d right, e below)
void edge(inout vec2 dir, inout float len, float w, float a, float b, float c, float d, float e) {
  float dirX = d - b;
  float lenX = max(abs(d - c), abs(c - b));
  float sX = clamp(abs(dirX) / max(lenX, 1.0 / 65536.0), 0.0, 1.0);
  dir.x += dirX * w;
  len += sX * sX * w;
  float dirY = e - a;
  float lenY = max(abs(e - c), abs(c - a));
  float sY = clamp(abs(dirY) / max(lenY, 1.0 / 65536.0), 0.0, 1.0);
  dir.y += dirY * w;
  len += sY * sY * w;
}
void lanczos(inout vec3 sum, inout float total, vec2 off, vec2 dir, vec2 len2, float lob, float clp, vec3 c) {
  vec2 v = vec2(off.x * dir.x + off.y * dir.y, -off.x * dir.y + off.y * dir.x) * len2;
  float d2 = min(dot(v, v), clp);
  float wB = 0.4 * d2 - 1.0;
  float wA = lob * d2 - 1.0;
  float w = (25.0 / 16.0 * wB * wB - (25.0 / 16.0 - 1.0)) * (wA * wA);
  sum += c * w;
  total += w;
}
void main() {
  vec2 pp = vUv * uIn - 0.5;
  vec2 fp = floor(pp);
  vec2 f = pp - fp;
  ivec2 i = ivec2(fp);
  //     b c
  //   e f g h
  //   i j k l
  //     n o
  vec3 sB = tap(i + ivec2(0, -1)), sC = tap(i + ivec2(1, -1));
  vec3 sE = tap(i + ivec2(-1, 0)), sF = tap(i), sG = tap(i + ivec2(1, 0)), sH = tap(i + ivec2(2, 0));
  vec3 sI = tap(i + ivec2(-1, 1)), sJ = tap(i + ivec2(0, 1)), sK = tap(i + ivec2(1, 1)), sL = tap(i + ivec2(2, 1));
  vec3 sN = tap(i + ivec2(0, 2)), sO = tap(i + ivec2(1, 2));
  float bL = lumaOf(sB), cL = lumaOf(sC), eL = lumaOf(sE), fL = lumaOf(sF), gL = lumaOf(sG), hL = lumaOf(sH);
  float iL = lumaOf(sI), jL = lumaOf(sJ), kL = lumaOf(sK), lL = lumaOf(sL), nL = lumaOf(sN), oL = lumaOf(sO);
  vec2 dir = vec2(0.0);
  float len = 0.0;
  edge(dir, len, (1.0 - f.x) * (1.0 - f.y), bL, eL, fL, gL, jL);
  edge(dir, len, f.x * (1.0 - f.y), cL, fL, gL, hL, kL);
  edge(dir, len, (1.0 - f.x) * f.y, fL, iL, jL, kL, nL);
  edge(dir, len, f.x * f.y, gL, jL, kL, lL, oL);
  // (no edge to speak of: along x)
  float dirSq = dot(dir, dir);
  bool flat_ = dirSq < 1.0 / 32768.0;
  dir.x = flat_ ? 1.0 : dir.x;
  dir *= flat_ ? 1.0 : inversesqrt(max(dirSq, 1.0 / 32768.0));
  len = len * 0.5;
  len *= len;
  // (stretched along the edge, by up to the diagonal's √2; narrowed across it)
  float stretch = dot(dir, dir) / max(abs(dir.x), abs(dir.y));
  vec2 len2 = vec2(1.0 + (stretch - 1.0) * len, 1.0 - 0.5 * len);
  // (the negative lobe: strong where it's flat, less on an edge)
  float lob = 0.5 + (1.0 / 4.0 - 0.04 - 0.5) * len;
  float clp = 1.0 / lob;
  vec3 sum = vec3(0.0);
  float total = 0.0;
  lanczos(sum, total, vec2(0.0, -1.0) - f, dir, len2, lob, clp, sB);
  lanczos(sum, total, vec2(1.0, -1.0) - f, dir, len2, lob, clp, sC);
  lanczos(sum, total, vec2(-1.0, 0.0) - f, dir, len2, lob, clp, sE);
  lanczos(sum, total, vec2(0.0, 0.0) - f, dir, len2, lob, clp, sF);
  lanczos(sum, total, vec2(1.0, 0.0) - f, dir, len2, lob, clp, sG);
  lanczos(sum, total, vec2(2.0, 0.0) - f, dir, len2, lob, clp, sH);
  lanczos(sum, total, vec2(-1.0, 1.0) - f, dir, len2, lob, clp, sI);
  lanczos(sum, total, vec2(0.0, 1.0) - f, dir, len2, lob, clp, sJ);
  lanczos(sum, total, vec2(1.0, 1.0) - f, dir, len2, lob, clp, sK);
  lanczos(sum, total, vec2(2.0, 1.0) - f, dir, len2, lob, clp, sL);
  lanczos(sum, total, vec2(0.0, 2.0) - f, dir, len2, lob, clp, sN);
  lanczos(sum, total, vec2(1.0, 2.0) - f, dir, len2, lob, clp, sO);
  vec3 lo = min(min(sF, sG), min(sJ, sK));
  vec3 hi = max(max(sF, sG), max(sJ, sK));
  gl_FragColor = vec4(clamp(sum / max(total, 1e-5), lo, hi), 1.0);
}`;

// RCAS (FSR 1's robust contrast-adaptive sharpening) over EASU's picture,
// at the canvas's own pixels: the four round a pixel weighed against it by
// as much as the pixel's own contrast can take without clipping, so a hard
// edge isn't haloed and a flat sky isn't made noisy. The dither after it,
// as the grade's: the canvas is 8 bits. (Its divisions are kept off zero:
// space is mostly black, and 0/0 there would be a NaN.)
const RCAS = `
uniform sampler2D tDiffuse;
uniform vec2 uIn;
uniform float uSharp;
uniform sampler2D tNoise;
uniform float uNoiseSize;
varying vec2 vUv;
vec3 at(ivec2 p) { return texelFetch(tDiffuse, clamp(p, ivec2(0), ivec2(uIn) - 1), 0).rgb; }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec3 e = at(p);
  vec3 b = at(p + ivec2(0, -1));
  vec3 d = at(p + ivec2(-1, 0));
  vec3 f = at(p + ivec2(1, 0));
  vec3 h = at(p + ivec2(0, 1));
  vec3 mn4 = min(min(b, d), min(f, h));
  vec3 mx4 = max(max(b, d), max(f, h));
  vec3 hitMin = min(mn4, e) / max(4.0 * mx4, vec3(1e-5));
  vec3 hitMax = (1.0 - max(mx4, e)) / min(4.0 * mn4 - 4.0, vec3(-1e-5));
  vec3 lobeRGB = max(-hitMin, hitMax);
  float lobe = max(-(0.25 - 1.0 / 16.0), min(max(lobeRGB.r, max(lobeRGB.g, lobeRGB.b)), 0.0)) * uSharp;
  vec3 c = (lobe * (b + d + f + h) + e) / (4.0 * lobe + 1.0);
  c += (texture2D(tNoise, (gl_FragCoord.xy + vec2(5.0, 11.0)) / uNoiseSize).r - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

const QUAD_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

// The last pass, which with an upscale to do (`up`, set each frame) works
// the grade out into an 8-bit picture at the scene's size and brings that
// up to the canvas through EASU and RCAS; without one it's the grade, as
// ever. Its two materials are its own (easu, rcas), so the shaders made
// before the first frame (lib/three/renderer's precompilePasses) are these too.
class FinishPass extends ShaderPass {
  constructor(shader) {
    super(shader);
    this.up = null; // { graded, wide }: the grade's picture and EASU's, while bringing up
    this.easu = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, uIn: { value: new THREE.Vector2(1, 1) } }, vertexShader: QUAD_VERT, fragmentShader: EASU, depthTest: false, depthWrite: false });
    this.rcas = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uIn: { value: new THREE.Vector2(1, 1) }, uSharp: { value: 2 ** -RCAS_STOPS }, tNoise: { value: null }, uNoiseSize: { value: 64 } },
      vertexShader: QUAD_VERT,
      fragmentShader: RCAS,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.easu);
  }

  render(renderer, writeBuffer, readBuffer, dt, mask) {
    const up = this.up;
    if (!up) return super.render(renderer, writeBuffer, readBuffer, dt, mask);
    const toScreen = this.renderToScreen;
    this.renderToScreen = false;
    super.render(renderer, up.graded, readBuffer, dt, mask);
    this.renderToScreen = toScreen;
    this.easu.uniforms.tDiffuse.value = up.graded.texture;
    this.easu.uniforms.uIn.value.set(up.graded.width, up.graded.height);
    this.quad.material = this.easu;
    renderer.setRenderTarget(up.wide);
    this.quad.render(renderer);
    this.rcas.uniforms.tDiffuse.value = up.wide.texture;
    this.rcas.uniforms.uIn.value.set(up.wide.width, up.wide.height);
    this.quad.material = this.rcas;
    renderer.setRenderTarget(toScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
}

// an 8-bit picture the finish brings up (texelFetch reads it, so no filtering)
const picture = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false });

// NaN and infinity both have every exponent bit set; tested on the bits,
// since a compiler allowed fast maths may drop isnan(). The boolean mix()
// picks a side without arithmetic (a NaN times nought is still NaN).
const FINITE = `
vec3 finite(vec3 c) {
  bvec3 bad = equal(floatBitsToUint(c) & 0x7f800000u, uvec3(0x7f800000u));
  return clamp(mix(c, vec3(0.0), bad), 0.0, 64.0);
}`;

// The bright pass with a soft knee, for a scene whose bloom names a `knee`
// (the galaxy's): of what's over the threshold only the excess glows (three's
// pass glows a texel's whole light once it's over, so a bolt just past the
// line fed all of itself into the haze), eased in over the knee either side
// of the line, so a thin, far bolt doesn't blink in and out of it. Four
// taps a quarter of a bloom texel out (uStep), so a thin bolt moving across
// the frame doesn't shimmer as one tap hits it and the next misses.
const KNEE = `
uniform sampler2D tDiffuse;
uniform float luminosityThreshold;
uniform float uKnee;
uniform vec2 uStep;
varying vec2 vUv;
${FINITE}
vec3 at(vec2 o) {
  return finite(texture2D(tDiffuse, vUv + o).rgb);
}
void main() {
  vec3 c = 0.25 * (at(-uStep) + at(vec2(uStep.x, -uStep.y)) + at(vec2(-uStep.x, uStep.y)) + at(uStep));
  float l = luminance(c);
  float soft = clamp(l - luminosityThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-4);
  gl_FragColor = vec4(c * (max(soft, l - luminosityThreshold) / max(l, 1e-4)), 1.0);
}`;

const FINAL = {
  uniforms: {
    tDiffuse: { value: null },
    uContrast: { value: 0.07 },
    uSat: { value: 1.06 },
    uVignette: { value: 0.3 },
    uAspect: { value: 16 / 9 },
    uRush: { value: 0 },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uHit: { value: 0 },
    uLens: { value: new THREE.Vector3(0.5, 0.5, 0) },
    // nearer than x (along the view) isn't bent; y the twist; z the shadow's
    // radius on the canvas, where it's to be drawn black itself (0: not)
    uLensMore: { value: new THREE.Vector3(1e9, 0, 0) },
    tDepth: { value: null },
    uNear: { value: 0.1 },
    uFar: { value: 1000 },
    // the finish (all of it as it was, by default: the galaxy's picture)
    tNoise: { value: null },
    uFrame: { value: new THREE.Vector2() }, // (texels the noise is moved this frame, so the grain moves)
    uNoiseSize: { value: 64 },
    uGrain: { value: 0 },
    uAberration: { value: 0 },
    uExposure: { value: 1 },
    // the lens (the universe map's: off by default)
    uToe: { value: new THREE.Vector2(0, 0) },
    uDefocus: { value: 0 },
    uTexel: { value: new THREE.Vector2(1, 1) }, // (a pixel of what's read, as uv)
    // a game's grading LUT (lib/three/gameLut.js), over the finished colour
    // as the game grades its own: off (mix 0) unless a world has one
    tLut: { value: null },
    uLutSize: { value: 2 },
    uLutMix: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uContrast, uSat, uVignette, uAspect, uRush, uHit;
    uniform vec2 uCenter;
    uniform vec3 uLens;
    uniform vec3 uLensMore;
    uniform sampler2D tDepth;
    uniform float uNear, uFar;
    uniform sampler2D tNoise;
    uniform vec2 uFrame;
    uniform float uNoiseSize, uGrain, uAberration, uExposure;
    uniform vec2 uToe, uTexel;
    uniform float uDefocus;
    uniform highp sampler3D tLut;
    uniform float uLutSize, uLutMix;
    varying vec2 vUv;
    // the blue noise at this pixel, moved by shift texels (0…1)
    float noise(vec2 shift) { return texture2D(tNoise, (gl_FragCoord.xy + shift) / uNoiseSize).r; }
    ${FINITE}
    vec3 shoulder(vec3 c) {
      float peak = max(c.r, max(c.g, c.b));
      if (peak < 0.8) return c;
      float top = 1.0 - 0.04 / (peak - 0.6);
      c *= top / peak;
      return mix(c, vec3(top), 1.0 - 1.0 / (0.15 * (peak - top) + 1.0));
    }
    vec3 srgb(vec3 c) {
      return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    }
    vec3 scene(vec2 uv) { return finite(texture2D(tDiffuse, uv).rgb); }
    // how far off what's drawn at uv is, along the view
    float depthAt(vec2 uv) {
      float d = texture2D(tDepth, uv).x;
      return uNear * uFar / max(uFar - d * (uFar - uNear), 1e-6);
    }
    void main() {
      vec2 uv = vUv;
      float shadow = 1.0;
      if (uLens.z > 0.0005 && depthAt(vUv) > uLensMore.x) {
        // bent light round the black hole: each pixel shows what's a little
        // further out from it, by the shadow's size squared over the distance,
        // and turned a little round it, more the closer in
        vec2 d = (uv - uLens.xy) * vec2(uAspect, 1.0);
        float r = max(length(d), 1e-4);
        float z = uLens.z;
        float bend = z * z / r * (1.0 - smoothstep(z * 2.0, z * 9.0, r));
        float a = uLensMore.y * min(z * z / (r * r), 3.0);
        vec2 dir = d / r;
        dir = vec2(dir.x * cos(a) - dir.y * sin(a), dir.x * sin(a) + dir.y * cos(a));
        vec2 bent = uLens.xy + dir * (r - min(bend, r * 0.95)) / vec2(uAspect, 1.0);
        // (what lands on something in front of the hole isn't what's behind it)
        if (depthAt(bent) > uLensMore.x) uv = bent;
        if (uLensMore.z > 0.0) shadow = smoothstep(uLensMore.z * 0.96, uLensMore.z, r);
      }
      vec3 lin = scene(uv) * shadow;
      if (uAberration > 0.0) {
        // red and blue read a little apart, out from the middle, nothing at it
        vec2 q0 = uv - 0.5;
        vec2 off = q0 * uAberration * smoothstep(0.15, 0.75, length(q0 * vec2(uAspect, 1.0)));
        lin.r = scene(uv + off).r * shadow;
        lin.b = scene(uv - off).b * shadow;
      }
      if (uDefocus > 0.0) {
        // the soft edge: four more reads 1.5 px round, only where it shows
        // (out past the middle), mixed in toward the corners
        vec2 qd = (vUv - 0.5) * vec2(uAspect, 1.0);
        float w = uDefocus * smoothstep(0.55, 1.0, length(qd) / (0.5 * length(vec2(uAspect, 1.0))));
        if (w > 0.0) {
          vec2 o = uTexel * 1.5;
          vec3 soft = lin + (scene(uv + vec2(o.x, 0.0)) + scene(uv - vec2(o.x, 0.0)) + scene(uv + vec2(0.0, o.y)) + scene(uv - vec2(0.0, o.y))) * shadow;
          lin = mix(lin, soft / 5.0, w);
        }
      }
      if (uRush > 0.001) {
        // a few taps back toward the ship, more smeared the further out
        vec2 d = uv - uCenter;
        float k = uRush * smoothstep(0.1, 0.75, length(d * vec2(uAspect, 1.0)));
        vec3 acc = lin;
        for (int i = 1; i <= 5; i++) acc += scene(uv - d * (k * 0.011 * float(i)));
        lin = acc / 6.0;
      }
      lin *= uExposure;
      // grain: on the light, before the tone map, moving each frame
      if (uGrain > 0.0) lin *= 1.0 + (noise(uFrame) - 0.5) * 2.0 * uGrain;
      // the toe: the colour scaled by its luminance's share, so its hue holds
      if (uToe.y > 0.0) lin *= smoothstep(uToe.x, uToe.y, dot(lin, vec3(0.2126, 0.7152, 0.0722)));
      vec3 c = srgb(clamp(shoulder(lin), 0.0, 1.0));
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = max(mix(vec3(l), c, uSat), 0.0);
      c = mix(c, c * c * (3.0 - 2.0 * c), uContrast);
      if (uLutMix > 0.0) {
        // (read at the texels' middles, so 0 and 1 land on the cube's ends)
        vec3 uvw = (c * (uLutSize - 1.0) + 0.5) / uLutSize;
        c = mix(c, texture(tLut, uvw).rgb, uLutMix);
      }
      vec2 q = vUv - 0.5;
      q.x *= uAspect;
      c *= 1.0 - (uVignette + uRush * 0.22) * smoothstep(0.35 - uRush * 0.1, 1.1, length(q) * 1.25);
      // a hit: the edges flash red
      c = mix(c, vec3(1.0, 0.12, 0.08), uHit * 0.4 * smoothstep(0.45, 1.15, length(q) * 1.3));
      // the dither: under a step of the 8 bits it's written at, so a dark
      // gradient's steps don't show as bands
      c += (noise(vec2(17.0, 31.0)) - 0.5) / 255.0;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

// bloom: a scene's own (its look.js's): { threshold, strength, radius } and,
// each optional, knee (a soft-knee bright pass, KNEE), falloff (the five
// mips' weights, sharpest first: three's [1, 0.8, 0.6, 0.4, 0.2], which a
// radius over 0 flattens toward the widest), flareMax (the most a flare
// scales it by) and cap (the bloom's first level's long side, at most).
// ratio: the most the scene will draw at, where it isn't the renderer's
// now (a world made on the runtime's renderer while the one before it
// still draws there, at that world's ratio). upscale: the finish above
// (FSR 1 up to the canvas, the multisampling by the sharpness drawn at),
// with top() the most the scene may be drawn at, the canvas's own ratio
// where it gives none.
export function createPost(renderer, scene, camera, { small = false, bloom: look = null, ratio = renderer.getPixelRatio(), upscale = false, top = null } = {}) {
  // multisampled below a pixel ratio of about 2; at 2 the pixels are too
  // small for jagged edges to show, and on a half-float target four samples
  // a pixel cost more than the rest of the frame put together. (With its
  // depth, for the black hole's lens to tell what's in front of it.) With
  // the finish, by the sharpness it's drawn at, as that moves (samplesAt).
  let samplesCap = Infinity;
  const samples = upscale ? samplesAt(ratio, { small }) : ratio >= 1.75 ? 0 : small ? 2 : 4;
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples, depthTexture: new THREE.DepthTexture(1, 1) });
  const composer = new EffectComposer(renderer, target);
  const main = new RenderPass(scene, camera);
  composer.addPass(main);
  let eye = camera; // (the camera the depth's read through: the scene's, or a view's)
  // whatever's drawn over the scene (the cockpit), with a fresh depth
  const over = new RenderPass(scene, camera);
  over.clear = false;
  over.clearDepth = true;
  over.enabled = false;
  composer.addPass(over);
  const BLOOM = { ...LOOK.bloom, ...look };
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
  if (BLOOM.falloff) bloom.compositeMaterial.uniforms.bloomFactors.value = [...BLOOM.falloff];
  // its first step (picking out what's bright enough to glow) reads through
  // finite(): three's pass patched, or the soft knee
  const bright = bloom.materialHighPassFilter;
  const knee = typeof BLOOM.knee === 'number';
  const read = 'vec4 texel = texture2D( tDiffuse, vUv );';
  if (knee) {
    bright.uniforms.uKnee = { value: BLOOM.knee };
    bright.uniforms.uStep = { value: new THREE.Vector2(0.001, 0.001) };
    bright.fragmentShader = KNEE;
    bright.needsUpdate = true;
  } else if (bright.fragmentShader.includes(read)) {
    bright.fragmentShader = bright.fragmentShader.replace('void main() {', `${FINITE}\nvoid main() {`).replace(read, 'vec4 texel = vec4( finite( texture2D( tDiffuse, vUv ).rgb ), 1.0 );');
    bright.needsUpdate = true;
  }
  composer.addPass(bloom);
  const grade = upscale ? new FinishPass(FINAL) : new ShaderPass(FINAL);
  composer.addPass(grade);
  // (a smaller tile on a small screen: made once, in a few ms rather than tens)
  const noiseSize = small ? 32 : 64;
  grade.uniforms.tNoise.value = blueNoiseTexture(noiseSize, 1);
  grade.uniforms.uNoiseSize.value = noiseSize;
  if (upscale) {
    grade.rcas.uniforms.tNoise.value = grade.uniforms.tNoise.value;
    grade.rcas.uniforms.uNoiseSize.value = noiseSize;
  }
  // (the finish's buffers are the frame's, whatever their size against the
  // canvas's, to the renderer's frame guard: what isn't ready yet is left out
  // of the frame and readied behind it, as it is for a composer the canvas's
  // size, rather than made in the middle of a frame drawn sharper or softer)
  const unframe = upscale ? (guardOf(renderer)?.frames((t) => t === composer.renderTarget1 || t === composer.renderTarget2) ?? null) : null;
  // the finish's two pictures, made the first time it brings one up
  let up = null;
  const dropUp = () => {
    up?.graded.dispose();
    up?.wide.dispose();
    up = null;
    grade.up = null;
  };
  const most = () => (upscale && top ? top() : renderer.getPixelRatio());
  const drawnAt = (full) => (upscale ? drawnRatio(most(), sharp) : Math.min(full, Math.max(SOFTEST, full * sharp)));
  // (the composer's two buffers sampled anew: a buffer made again, as a resize makes it)
  const resample = (n) => {
    if (composer.renderTarget1.samples === n) return;
    for (const t of [composer.renderTarget1, composer.renderTarget2]) {
      t.samples = n;
      t.dispose();
    }
  };
  let frame = 0;
  let level = 0; // lib/three/pace's step
  let aberrationWant = 0;
  let defocusWant = 0;
  let houseGrade = null; // (the house's contrast and saturation, while a game's LUT stands in)

  let on = true;
  let glow = true; // bloom, until lite() takes it off
  let sharp = 1; // a share of the renderer's pixel ratio the passes are drawn at
  const at = { w: 0, h: 0, ratio: 0, full: 0 };
  return {
    get on() {
      return on;
    },
    // where the scene is drawn: the post's own target, or the canvas once it's off
    get target() {
      return on ? composer.readBuffer : null;
    },
    // (for making its passes' shaders before the first frame)
    composer,
    // the pixel ratio the scene is drawn at now: the renderer's, softened
    // by the pace (for what's sized in the page's own pixels, like a dither)
    get ratio() {
      const full = renderer.getPixelRatio();
      return on ? drawnAt(full) : full;
    },
    // how sharp to draw, 0…1 of the renderer's pixel ratio (lib/three/pace)
    get sharpness() {
      return sharp;
    },
    set sharpness(k) {
      sharp = k;
    },
    // draw a frame (the renderer's pixel ratio can change under us, when the
    // watchdog trades sharpness for speed)
    render(w, h) {
      if (!on) {
        renderer.render(main.scene, main.camera);
        if (over.enabled) {
          const was = renderer.autoClear;
          renderer.autoClear = false;
          renderer.clearDepth();
          renderer.render(over.scene, over.camera);
          renderer.autoClear = was;
        }
        return;
      }
      const full = renderer.getPixelRatio();
      const ratio = drawnAt(full);
      if (w !== at.w || h !== at.h || ratio !== at.ratio || full !== at.full) {
        Object.assign(at, { w, h, ratio, full });
        // (the finish's multisampling by the sharpness drawn at, before the
        // buffers are sized: made again either way)
        if (upscale) resample(samplesAt(ratio, { small, cap: samplesCap }));
        composer.setPixelRatio(ratio);
        composer.setSize(w, h);
        // the glow is a blur: worked out at the page's own pixels, not the
        // screen's, it looks the same on every screen and costs a quarter
        // as much on a sharp one
        const [bw, bh] = bloomSize(w * ratio, h * ratio, { small, cap: BLOOM.cap });
        bloom.setSize(bw * 2, bh * 2);
        if (knee) bright.uniforms.uStep.value.set(0.25 / bw, 0.25 / bh);
        grade.uniforms.uAspect.value = w / h;
        grade.uniforms.uTexel.value.set(1 / Math.max(1, w * ratio), 1 / Math.max(1, h * ratio));
        // brought up to the canvas (FSR 1) when it's sharper than the scene:
        // the grade's picture at the scene's size, EASU's at the canvas's
        if (upscale && upscaling(ratio, full)) {
          up ??= { graded: picture(), wide: picture() };
          const read = composer.readBuffer;
          up.graded.setSize(Math.max(1, Math.round(read.width)), Math.max(1, Math.round(read.height)));
          const px = renderer.getDrawingBufferSize(new THREE.Vector2());
          up.wide.setSize(Math.max(1, px.x), Math.max(1, px.y));
          grade.up = up;
        } else if (upscale) grade.up = null;
      }
      // the scene draws into the composer's read buffer, and the last pass reads it there
      grade.uniforms.tDepth.value = composer.readBuffer.depthTexture;
      grade.uniforms.uNear.value = eye.near;
      grade.uniforms.uFar.value = eye.far;
      // (the grain somewhere else in the tile each frame; the dither keeps its place)
      frame = (frame + 1) % 997;
      grade.uniforms.uFrame.value.set((frame * 37) % noiseSize, (frame * 23) % noiseSize);
      composer.render();
    },
    // another scene drawn in the first's place, from `cam` (null: the first again)
    view(s, cam) {
      main.scene = s ?? scene;
      main.camera = cam ?? camera;
      eye = main.camera;
    },
    // a scene drawn over the first, from `cam` (null: nothing)
    overlay(s, cam) {
      over.enabled = Boolean(s);
      over.scene = s ?? scene;
      over.camera = cam ?? camera;
    },
    // the bloom's numbers, for the ?debug panel (lib/three/bloom's
    // bloomGroups): the strength is the flare's base, so a flare scales
    // what's set; a knee only for a soft-knee pass (undefined otherwise)
    bloom: {
      get threshold() {
        return bloom.threshold;
      },
      set threshold(v) {
        bloom.threshold = v;
      },
      get knee() {
        return knee ? bright.uniforms.uKnee.value : undefined;
      },
      set knee(v) {
        if (knee) bright.uniforms.uKnee.value = v;
      },
      get strength() {
        return BLOOM.strength;
      },
      set strength(v) {
        BLOOM.strength = v;
        if (glow) bloom.strength = v;
      },
      get radius() {
        return bloom.radius;
      },
      set radius(v) {
        bloom.radius = v;
      },
    },
    // bloom's strength, for a moment's flare (a boost, an arrival): k times
    // the base, k no more than the bloom's flareMax
    flare(k) {
      if (glow) bloom.strength = BLOOM.strength * Math.min(k, BLOOM.flareMax ?? Infinity);
    },
    // the boost's rush, 0…1, out from (x, y) on the canvas (0…1, y up)
    rush(k, x = 0.5, y = 0.5) {
      grade.uniforms.uRush.value = k;
      grade.uniforms.uCenter.value.set(x, y);
    },
    // a laser hit's red flash, 0…1
    hit(k) {
      grade.uniforms.uHit.value = k;
    },
    // film grain, 0 for none (lib/three/noise's grainFor)
    grain(k) {
      grade.uniforms.uGrain.value = k;
    },
    // how far red and blue read apart at the edges (aberrationFor), held at
    // none while the pace is at step 3 or softer
    aberration(k) {
      aberrationWant = k;
      grade.uniforms.uAberration.value = level >= 3 ? 0 : k;
    },
    // the exposure, a multiplier before the tone map (lib/three/exposure)
    exposure(k) {
      grade.uniforms.uExposure.value = k;
    },
    // a game's grade: its LUT (a Data3DTexture of size³, sRGB in and out)
    // over the finished colour; the house's own contrast and saturation
    // step aside while it's on, the LUT carrying the game's. null: off, and
    // the house's back.
    grading(g) {
      const u = grade.uniforms;
      if (g?.lut) {
        houseGrade ??= { contrast: u.uContrast.value, sat: u.uSat.value };
        u.tLut.value = g.lut;
        u.uLutSize.value = g.size;
        u.uLutMix.value = g.mix ?? 1;
        u.uContrast.value = 0;
        u.uSat.value = 1;
      } else {
        u.tLut.value = null;
        u.uLutMix.value = 0;
        if (houseGrade) {
          u.uContrast.value = houseGrade.contrast;
          u.uSat.value = houseGrade.sat;
          houseGrade = null;
        }
      }
    },
    // the toe: under lo to black, over hi as drawn (hi 0: off, the default)
    setToe(lo, hi) {
      grade.uniforms.uToe.value.set(lo, hi);
    },
    // the grade's contrast (0.07 by default)
    contrast(k) {
      grade.uniforms.uContrast.value = k;
    },
    // the soft edge, 0…1 (0 by default), held at none from pace step 3
    defocus(k) {
      defocusWant = k;
      grade.uniforms.uDefocus.value = level >= 3 ? 0 : k;
    },
    // lib/three/pace's step: what's dropped as frames run long, and back
    setLevel(l) {
      level = l;
      grade.uniforms.uAberration.value = level >= 3 ? 0 : aberrationWant;
      grade.uniforms.uDefocus.value = level >= 3 ? 0 : defocusWant;
    },
    // whether the scene's sun flare is wanted at this pace
    get flareOn() {
      return level < 2;
    },
    // the black hole's bending: at (x, y) on the canvas (0…1, y up), its
    // shadow r high (as a share of the canvas's height); r 0 for none.
    // front: nearer than this (along the view) is in front of it, and not
    // bent; twist: radians, at its edge, turned round with its spin; black:
    // the shadow's radius on the canvas, drawn black (0: left to the scene)
    lens(x, y, r, { front = 1e9, twist = 0, black = 0 } = {}) {
      grade.uniforms.uLens.value.set(x, y, r);
      grade.uniforms.uLensMore.value.set(front, twist, black);
    },
    off() {
      if (!on) return;
      on = false;
      composer.dispose();
      dropUp();
    },
    // a lighter post, short of none: the bloom goes (its blur is most of the
    // post's cost) and the grade stays, so the picture keeps its tone map and
    // colour; flare() then does nothing. Harmless to call again.
    lite() {
      glow = false;
      bloom.enabled = false;
    },
    // the bloom off and back on (the visitor's video settings); lite() is
    // this, off
    glowing(want) {
      glow = Boolean(want);
      bloom.enabled = glow;
      bloom.strength = BLOOM.strength;
    },
    // the most samples a pixel the finish multisamples with (the visitor's
    // video settings; Infinity: as samplesAt has it), taken at the next frame
    maxSamples(n) {
      const cap = Number.isFinite(n) ? Math.max(0, n) : Infinity;
      if (cap === samplesCap) return;
      samplesCap = cap;
      at.ratio = 0;
    },
    // the finish's shaders made before the first frame, as the composer's
    // are (lib/three/renderer's precompilePasses makes them for the canvas):
    // the grade into its 8-bit picture and EASU into its own, which the
    // renderer makes apart from the ones that draw to the canvas
    precompileFinish(cam = camera) {
      if (!upscale) return Promise.resolve();
      // (a position and a uv, no normal, as three's full-screen quad: whether
      // a mesh has normals is part of its shader)
      const quad = new THREE.PlaneGeometry(2, 2);
      quad.deleteAttribute('normal');
      const stage = new THREE.Scene();
      stage.add(new THREE.Mesh(quad, grade.material), new THREE.Mesh(quad, grade.easu));
      return Promise.resolve(precompile(renderer, stage, cam, stage, composer.readBuffer)).finally(() => quad.dispose());
    },
    // (for a check: whether the last frame was brought up, and its samples)
    get finish() {
      return { up: Boolean(grade.up), samples: composer.renderTarget1.samples, cap: samplesCap };
    },
    dispose() {
      composer.dispose();
      bloom.dispose();
      grade.material.dispose();
      grade.easu?.dispose();
      grade.rcas?.dispose();
      grade.uniforms.tNoise.value?.dispose();
      dropUp();
      unframe?.();
    },
  };
}

export function spaceEnvironment(renderer, sky, { light = LIGHT, colour = null } = {}) {
  const env = new THREE.Scene();
  const made = [];
  const add = (geo, mat, pos) => {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.copy(pos);
    env.add(m);
    made.push(geo, mat);
  };
  add(
    new THREE.SphereGeometry(10, 48, 24),
    sky ? new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, color: new THREE.Color(3, 3, 3.4) }) : new THREE.MeshBasicMaterial({ color: '#0b0f1c', side: THREE.BackSide }),
  );
  // (a star's colour as a tint, half way: its brightest channel kept at the white's)
  const hot = new THREE.Color(9, 8.2, 7.2);
  if (colour) hot.multiply(new THREE.Color(...colour.map((c) => 0.5 + (0.5 * c) / Math.max(...colour, 1e-3))));
  add(new THREE.SphereGeometry(1.5, 24, 12), new THREE.MeshBasicMaterial({ color: hot }), light.clone().normalize().multiplyScalar(7));
  add(new THREE.SphereGeometry(2.2, 24, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.45, 1.1) }), FILL.clone().multiplyScalar(7));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.02);
  pmrem.dispose();
  for (const thing of made) thing.dispose();
  return rt;
}

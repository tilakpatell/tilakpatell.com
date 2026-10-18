// The Middle-earth themes’ background. The Shire: Hobbiton at golden hour,
// the sun low at the left behind the Party Tree, the Misty Mountains faint
// and blue at the back, downs rolling forward with hedges along their
// crests, and at the right the Hill with its round green door, a window lit
// at dusk and smoke from the chimney; at night a moon and a few stars, and
// every window lit. Fireflies and falling leaves, and now and then one of
// Gandalf’s fireworks, or the dragon. Mordor: smoke over a sky burning red
// behind Mount Doom at the left, its lava seams pulsing; ridges stepping
// down to an ash plain; Barad-dûr at the right, a model in three dimensions
// (scenes/baradDurView.js) standing in the reek behind the near ridge, the
// Eye between its horns, which follows the pointer and every so often
// sweeps its beam across. Embers rise and ash comes down. A click on empty
// page is a firework’s sparkle (in Mordor, embers).

import { ambience, backdrop, bursts, field, pick, rand, rgb, silhouette } from '../kit';
import { baradDurView } from './baradDurView';

// Where the big shapes stand, as shares of the screen: out at the sides,
// where the page’s mask lets the background show, the middle left quiet
// for the text, and nothing on the route line down the left gutter.
const SUN_X = 0.15;
const TREE_X = 0.22;
const HILL_X = 0.86;
const DOOM_X = 0.19;
// (Barad-dûr stands at the right: scenes/baradDurView.js places it)
// Mordor’s near pass covers the screen’s lower right only: the reek, the
// near ridge and the plain never reach higher, and left of NEAR_LEFT (where
// the tower never stands, and the words’ mist begins) the far pass draws
// them itself, so the mist fades the whole land there as one
const NEAR_TOP = 0.42;
const NEAR_LEFT = 0.64;

const LANDS = /* glsl */ `
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uPointer;
uniform float uMordor;
uniform float uNight;    // dark mode: the moon and stars, every window lit
uniform vec3 uSky;       // the sky overhead
uniform vec3 uGlow;      // the light along the horizon
uniform vec3 uSun;       // the sun (the moon); Mordor: the fire at its hottest
uniform vec3 uFar;       // the furthest mountains
uniform vec3 uLand1;     // the lands, far to near
uniform vec3 uLand2;
uniform vec3 uLand3;
uniform vec3 uLand4;
uniform vec3 uDark;      // hedges and the Party Tree; Mount Doom
uniform vec3 uDoor;      // the round door
uniform vec3 uStone;     // the door’s frame and the chimney; Mordor’s blood red
uniform vec3 uBrass;     // the knob and the door’s rim
uniform vec3 uLamp;      // a lit window; the lava
uniform vec3 uSmoke;
uniform float uLit;      // the window at the door, 0..1
uniform vec2 uEye;       // where the Eye is, px from the bottom left
uniform vec2 uBeam;      // its beam: angle, strength
uniform float uLayer;    // Mordor: 0 the far pass, 1 the near one
float hash(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float hash2(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(float x) { float i = floor(x), f = fract(x); return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f)); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), u.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}
// lays a colour over what’s drawn (kept premultiplied till the end)
void over(inout vec4 c, vec3 rgb, float a) { c = vec4(rgb * a, a) + c * (1.0 - a); }
// 1 inside a shape (d < 0, in px), 0 outside, softened over a pixel
float fill(float d) { return clamp(0.5 - d, 0.0, 1.0); }
// rolling downs, their height in px at x
float downs(float x, float base, float amp, float f, float seed) {
  return base + amp * (0.55 * sin(x * f + seed) + 0.3 * sin(x * f * 2.3 + seed * 1.7) + 0.15 * sin(x * f * 5.1 + seed * 0.3));
}
// a jagged ridge: two runs of peaks over each other, roughened
float ridge(float x, float base, float amp, float f, float seed) {
  float a = 1.0 - abs(fract(x * f + seed) - 0.5) * 2.0;
  float b = 1.0 - abs(fract(x * f * 2.7 + seed * 3.1) - 0.5) * 2.0;
  return base + amp * (0.62 * a * (0.5 + 0.5 * vnoise(x * f * 1.7 + seed * 5.0)) + 0.26 * b * vnoise(x * f * 3.3 + seed) + 0.12 * vnoise(x * f * 16.0 + seed));
}
// a hedge along a crest, in scallops, with gaps here and there: its height
float hedge(float x, float r, float seed) {
  float q = fract(x / (r * 1.7) + seed) * 2.0 - 1.0;
  return (r * 0.75 * sqrt(max(0.0, 1.0 - q * q)) + r * 0.3) * step(0.42, vnoise(x * 0.0045 + seed * 13.0));
}
// a line of downs: the slopes that face the light (the low sun, or the
// moon) a shade brighter, a rim of it along the crest, deeper down the hill
void down(inout vec4 c, vec2 px, float top, float facing, vec3 col, vec3 rim, float s) {
  float lit = clamp(facing * 3.0, -1.0, 1.0);
  vec3 k = col * (1.0 + mix(0.16, 0.08, uNight) * lit) * (1.0 - 0.12 * smoothstep(0.0, 50.0 * s, top - px.y));
  k = mix(k, rim, smoothstep(3.5 * s, 0.0, top - px.y) * (0.25 + 0.35 * max(lit, 0.0)));
  over(c, k, fill(px.y - top));
}
// the Party Tree: a broad tree of rounded tiers on a short trunk
float partyTree(vec2 p, float s) {
  p /= s;
  float d = max(max(abs(p.x) - 1.8, p.y - 18.0), -p.y);
  d = min(d, (length((p - vec2(0.0, 20.0)) / vec2(31.0, 10.0)) - 1.0) * 9.0);
  d = min(d, (length((p - vec2(-2.0, 31.0)) / vec2(25.0, 9.5)) - 1.0) * 8.0);
  d = min(d, (length((p - vec2(1.0, 41.0)) / vec2(18.0, 8.5)) - 1.0) * 7.0);
  d = min(d, (length((p - vec2(0.0, 50.0)) / vec2(10.0, 7.0)) - 1.0) * 6.0);
  d += (noise(p * 0.32) - 0.5) * 3.0 * step(18.0, p.y);
  return d * s;
}

vec4 shire(vec2 px, float s, float look) {
  float W = uRes.x, H = uRes.y;
  float day = 1.0 - uNight;
  vec4 c = vec4(0.0);
  // the sky: clear overhead, gold (a summer night’s blue) gathering low
  float low = smoothstep(H * mix(0.6, 0.7, uNight), H * 0.14, px.y);
  over(c, mix(uSky, uGlow, smoothstep(H * 0.42, H * 0.16, px.y)), pow(low, mix(1.4, 1.0, uNight)) * mix(0.7, 0.85, uNight));
  // the low sun, its light spread wide through the haze
  vec2 sun = vec2(W * ${SUN_X.toFixed(2)}, H * 0.25);
  float sd = length(px - sun);
  over(c, uGlow, day * (exp(-sd / (260.0 * s)) * 0.45 + exp(-sd / (80.0 * s)) * 0.45));
  over(c, uSun, day * exp(-sd / (30.0 * s)) * 0.7);
  over(c, mix(uSun, vec3(1.0, 0.98, 0.92), 0.5), day * fill(sd - 23.0 * s));
  // the moon, a crescent at the top right, and a few stars
  vec2 moon = vec2(W * 0.86, H * 0.84);
  float md = length(px - moon);
  over(c, uSun, uNight * exp(-md / (40.0 * s)) * 0.2);
  over(c, uSun, uNight * fill(md - 15.0 * s) * (1.0 - fill(length(px - moon - vec2(6.5, 3.5) * s) - 13.0 * s)));
  vec2 cell = floor(px / (62.0 * s));
  float h = hash2(cell);
  vec2 sp = (cell + 0.25 + 0.5 * vec2(hash2(cell + 7.1), hash2(cell + 3.7))) * 62.0 * s;
  float tw = h > 0.96 ? 0.5 + 0.5 * sin(uTime * (1.4 + h * 2.0) + h * 60.0) : 0.8;
  over(c, uSun, uNight * step(0.89, h) * smoothstep(1.9 * s, 0.4, length(px - sp)) * tw * smoothstep(H * 0.4, H * 0.6, px.y));
  // the Misty Mountains, faint and blue at the back, snow on the high peaks
  float mt = ridge(px.x + look * 0.15, H * 0.17, H * 0.11, 0.0019, 2.3);
  float snow = smoothstep(H * 0.245, H * 0.27, mt) * smoothstep(7.0 * s, 0.0, mt - px.y);
  over(c, mix(uFar, uSun, snow * 0.5), fill(px.y - mt) * mix(0.75, 0.9, uNight));

  // the downs take the light from the sun by day, from the moon by night
  float lx = mix(sun.x, moon.x, uNight);
  float sx = clamp((px.x - lx) / (150.0 * s), -1.0, 1.0);
  vec3 rim = mix(uSun, mix(uSun, uFar, 0.5), uNight);
  // the far downs, and the Party Tree on them against the sun
  float x1 = px.x + look * 0.3;
  float t1 = downs(x1, H * 0.18, H * 0.02, 0.0032, 1.0);
  down(c, px, t1, (downs(x1 + 3.0, H * 0.18, H * 0.02, 0.0032, 1.0) - t1) / 3.0 * sx, uLand1, rim, s);
  float tx = W * ${TREE_X.toFixed(2)};
  vec2 tp = vec2(x1 - tx, px.y - downs(tx, H * 0.18, H * 0.02, 0.0032, 1.0) + 2.0 * s);
  if (abs(tp.x) < 40.0 * s && tp.y > -4.0 * s && tp.y < 64.0 * s) {
    float td = partyTree(tp, s);
    // dark against the sun, its edge lit
    over(c, mix(mix(uDark, uLand1, 0.25 * day), rim, smoothstep(-2.5 * s, 0.0, td) * 0.5 * day), fill(td));
    // at night, lanterns strung from its trunk out to the boughs’ ends,
    // the strings sagging between: there’s a party on
    vec2 lp = tp / s;
    float li = clamp(floor(lp.x / 6.0 + 0.5), -4.0, 4.0);
    vec2 lan = vec2(li * 6.0, 12.5 - 6.0 * sin(3.14159 * abs(li) / 4.0));
    float ld = length(lp - lan);
    over(c, mix(uLamp, uBrass, step(0.5, fract(li * 0.5))), uNight * (fill((ld - 1.3) * s) + exp(-ld / 2.5) * 0.35));
  }

  // the middle downs, a hedge along the crest
  float x2 = px.x + look * 0.5;
  float t2 = downs(x2, H * 0.138, H * 0.024, 0.0042, 4.0);
  float g2 = hedge(x2, 3.6 * s, 0.61);
  down(c, px, t2 + g2, (downs(x2 + 3.0, H * 0.138, H * 0.024, 0.0042, 4.0) - t2) / 3.0 * sx, uLand2, rim, s);
  over(c, mix(uDark, uLand2, 0.3 * day), fill(px.y - t2 - g2) * step(t2 - 2.0 * s, px.y) * step(0.01, g2));
  // a round tree here and there along it
  float tc = floor(x2 / (130.0 * s));
  float tr = hash(tc * 7.3 + 4.0);
  float tcx = (tc + 0.2 + 0.6 * hash(tc * 1.7 + 9.0)) * 130.0 * s;
  vec2 tq = vec2(x2 - tcx, px.y - downs(tcx, H * 0.138, H * 0.024, 0.0042, 4.0));
  float rr = (5.0 + 4.0 * tr) * s;
  float treeD = min(length(tq - vec2(0.0, rr + 4.0 * s)) - rr, max(max(abs(tq.x) - 1.0 * s, tq.y - rr), -tq.y - 2.0 * s));
  over(c, mix(uDark, uLand2, 0.3 * day), fill(treeD) * step(0.5, tr) * step(0.2, abs((tcx - look * 0.5) / W - 0.5)));
  // further off, only their windows show, and only at night
  float wc2 = floor(x2 / (70.0 * s));
  float wh2 = hash(wc2 * 5.1 + 2.0);
  float wx2 = (wc2 + 0.25 + 0.5 * hash(wc2 * 2.3 + 1.0)) * 70.0 * s;
  vec2 w2 = vec2(x2 - wx2, px.y - downs(wx2, H * 0.138, H * 0.024, 0.0042, 4.0) + 9.0 * s);
  float wd2 = length(w2);
  over(c, uLamp, uNight * step(0.45, wh2) * step(0.2, abs((wx2 - look * 0.5) / W - 0.5)) * (fill(wd2 - 2.0 * s) + exp(-wd2 / (5.0 * s)) * 0.35));

  // the near downs, hedged, with hobbit-holes dug in: small round doors by
  // day, a lit window each by night (none in the middle, behind the text)
  float x3 = px.x + look * 0.75;
  float t3 = downs(x3, H * 0.096, H * 0.026, 0.0036, 7.0);
  float g3 = hedge(x3, 4.8 * s, 0.17);
  down(c, px, t3 + g3, (downs(x3 + 3.0, H * 0.096, H * 0.026, 0.0036, 7.0) - t3) / 3.0 * sx, uLand3, rim, s);
  over(c, uDark, fill(px.y - t3 - g3) * step(t3 - 2.5 * s, px.y) * step(0.01, g3));
  float hc = floor(x3 / (95.0 * s));
  float hh = hash(hc * 3.7 + 1.0);
  float hx = (hc + 0.3 + 0.4 * hash(hc * 1.3 + 5.0)) * 95.0 * s;
  if (hh > 0.3 && abs((hx - look * 0.75) / W - 0.5) > 0.2) {
    vec2 hp = vec2(x3 - hx, px.y - downs(hx, H * 0.096, H * 0.026, 0.0036, 7.0) + 14.0 * s);
    float hd = length(hp);
    over(c, uLamp, uNight * exp(-hd / (8.0 * s)) * 0.5);
    over(c, mix(uStone, uLamp, uNight), fill(hd - 6.0 * s));
    over(c, mix(hh > 0.72 ? uBrass : uDoor, uLamp, uNight), fill(hd - 4.6 * s));
    over(c, hh > 0.72 ? uStone : uBrass, day * fill(hd - 1.1 * s));
  }

  // the Hill: the nearest down rises at the right
  float x4 = px.x + look;
  float hillX = W * ${HILL_X.toFixed(2)};
  // (squared by hand: pow() of a negative number is undefined in GLSL)
  float hq = (x4 - hillX) / (155.0 * s);
  float hqb = (x4 + 3.0 - hillX) / (155.0 * s);
  float t4 = downs(x4, H * 0.04, H * 0.016, 0.003, 9.5) + 92.0 * s * exp(-hq * hq);
  float t4b = downs(x4 + 3.0, H * 0.04, H * 0.016, 0.003, 9.5) + 92.0 * s * exp(-hqb * hqb);
  down(c, px, t4, (t4b - t4) / 3.0 * sx, uLand4, rim, s);
  float R = 19.0 * s;
  vec2 dp = vec2(x4 - hillX + 26.0 * s, px.y - 40.0 * s);
  // the path from its step down the hill
  float path = abs(dp.x) - R * 0.55 + (dp.y + R) * 0.6;
  over(c, mix(uLand1, uStone, 0.2), fill(path) * step(dp.y, -R + 1.0) * mix(0.85, 0.5, uNight));
  // the garden at its foot, flowers either side of the path, and a picket
  // fence along the front of the Hill
  vec2 fc = floor(vec2(x4, px.y) / (6.0 * s));
  float fh = hash2(fc + 17.0);
  vec2 fq = (fract(vec2(x4, px.y) / (6.0 * s)) - 0.5 - (vec2(hash2(fc + 3.1), hash2(fc + 8.7)) - 0.5) * 0.5) * 6.0 * s;
  float bed = step(px.y, 20.0 * s) * step(abs(x4 - hillX + 10.0 * s), 135.0 * s) * step(4.0 * s, path);
  over(c, fh > 0.86 ? mix(uLamp, uStone, 0.45) : fh > 0.74 ? uLamp : uBrass, bed * step(0.62, fh) * fill(length(fq) - 1.4 * s) * day);
  float fx = x4 - hillX + 100.0 * s;
  float post = abs(fract(fx / (7.0 * s)) - 0.5) * 7.0 * s;
  float fence = min(max(post - 1.1 * s, px.y - 15.0 * s - (1.1 * s - post)), abs(abs(px.y - 9.5 * s) - 3.0 * s) - 0.7 * s);
  over(c, mix(mix(uSun, uStone, 0.35), uDark, uNight), fill(max(fence, abs(fx - 27.0 * s) - 27.0 * s)) * step(2.0 * s, px.y));
  float dr = length(dp);
  if (dr < R + 9.0 * s) {
    // the round frame, then the leaf of upright planks
    over(c, uStone, fill(dr - R - 3.5 * s));
    float pl = (dp.x + R) / (R * 2.0 / 7.0);
    vec3 wood = uDoor * (1.0 + 0.12 * step(0.5, fract(pl * 0.5))) * (1.0 - 0.4 * smoothstep(0.7, 1.0, abs(fract(pl) - 0.5) * 2.0));
    over(c, wood * (1.0 - 0.12 * dp.x / R), fill(dr - R));
    // its brass rim, and the knob in the very middle catching the light
    over(c, uBrass, fill(abs(dr - R) - 0.8 * s) * 0.9);
    over(c, uLamp, uNight * exp(-dr / (6.0 * s)) * 0.4);
    over(c, uBrass, fill(dr - 3.0 * s));
    over(c, mix(uBrass, vec3(1.0, 0.97, 0.85), 0.75), fill(length(dp + vec2(1.0, -1.0) * s) - 1.1 * s));
  }
  // the round window beside it, lit at dusk, and all night
  vec2 wp = vec2(x4 - hillX - 24.0 * s, px.y - 49.0 * s);
  float wr = length(wp);
  if (wr < 80.0 * s) {
    over(c, uLamp, exp(-wr / (20.0 * s)) * 0.55 * uLit);
    over(c, uStone, fill(wr - 11.0 * s));
    vec3 glass = mix(uDoor * 0.45, uLamp, uLit);
    over(c, mix(glass, uStone, fill(min(abs(wp.x), abs(wp.y)) - 0.9 * s)), fill(wr - 8.5 * s));
  }
  // the chimney on the Hill’s top, and its thread of smoke
  float cx = hillX + 44.0 * s;
  float ctop = downs(cx, H * 0.04, H * 0.016, 0.003, 9.5) + 92.0 * s * exp(-pow(44.0 / 155.0, 2.0)) + 14.0 * s;
  over(c, uStone, fill(abs(x4 - cx) - 3.8 * s - step(ctop - 3.0 * s, px.y) * 1.3 * s) * fill(px.y - ctop) * step(ctop - 24.0 * s, px.y));
  float sy = px.y - ctop;
  float drift = sy * 0.22 + sin(sy * 0.035 - uTime * 0.9) * 5.0 * s * smoothstep(0.0, 60.0 * s, sy) + (noise(vec2(sy * 0.008 - uTime * 0.25, 1.7)) - 0.5) * sy * 0.45;
  float sw = 2.0 * s + sy * 0.07;
  float sdx = x4 - cx - drift;
  if (sy > 0.0 && sy < 210.0 * s && abs(sdx) < sw * 3.0) {
    float puff = exp(-sdx * sdx / (sw * sw)) * smoothstep(0.0, 6.0 * s, sy) * pow(1.0 - sy / (210.0 * s), 1.5);
    puff *= 0.5 + 0.5 * noise(vec2(x4 * 0.04, sy * 0.05 - uTime * 0.5));
    over(c, uSmoke, puff * mix(0.8, 0.4, uNight));
  }
  return c;
}

vec4 mordorFar(vec2 px, float s, float look) {
  float W = uRes.x, H = uRes.y;
  float night = uNight;
  vec4 c = vec4(0.0);
  float doomX = W * ${DOOM_X.toFixed(2)} - look * 0.38;
  // the sky: smoke rolling slowly over, burning low down, most of all
  // behind Doom, the clouds’ undersides lit by it
  float hot = smoothstep(H * 0.6, H * 0.12, px.y);
  float bq = (px.x - doomX) / (W * 0.18 + 170.0 * s);
  float behind = exp(-bq * bq);
  vec2 sp = vec2(px.x / (480.0 * s) + uTime * 0.011, px.y / (260.0 * s) - uTime * 0.004);
  float smoke = fbm(sp);
  float cloud = smoothstep(0.36, 0.74, smoke);
  // where the smoke thins below, it is a cloud’s underside, lit by the fires
  float under = clamp((smoke - fbm(sp - vec2(0.0, 0.16))) * 5.0, 0.0, 1.0) * cloud;
  vec3 sky = mix(uSky, uGlow, hot);
  sky = mix(sky, mix(uGlow, uLamp, 0.6), hot * hot * behind * 0.85);
  // and the crater’s light on the smoke over the summit, so the cone stands
  // dark against it
  float summit = exp(-length((px - vec2(doomX, H * 0.36)) / vec2(1.25, 1.0)) / (150.0 * s));
  sky = mix(sky, mix(uGlow, uLamp, 0.7), summit * mix(0.25, 0.55, night));
  // by day the smoke is darker than the ash sky; by night lighter than the
  // dark, grey overhead and lit red from beneath lower down
  sky = mix(sky * (1.0 - 0.25 * night * (1.0 - cloud)), mix(uSmoke, mix(uStone, uLamp, 0.4), hot * hot * mix(0.3, 0.8, night)), cloud * mix(0.55, 0.8, night));
  over(c, sky, clamp(mix(0.3, 0.7, smoothstep(H * 0.95, H * 0.3, px.y)) * (0.7 + 0.45 * cloud) + hot * 0.2, 0.0, 0.95));
  over(c, mix(uLamp, uSun, 0.15 * night), under * (0.25 + 0.75 * hot) * (0.5 + 0.5 * behind) * mix(0.12, 0.45, night));

  // the Eye’s light on the reek about Barad-dûr’s crown, so the tower
  // (drawn over it) stands black against the smoke it lights
  float lit = exp(-length((px - uEye) / vec2(1.0, 1.7)) / (190.0 * s));
  over(c, mix(uStone, uLamp, 0.3 + 0.5 * lit), lit * (0.3 + 0.7 * cloud) * mix(0.18, 0.5, night));

  // the far ranges, paler for the smoke between
  float r0 = ridge(px.x + look * 0.15, H * 0.165, H * 0.085, 0.0021, 0.4);
  over(c, uFar, fill(px.y - r0) * 0.9);
  float r1 = ridge(px.x + look * 0.3, H * 0.105, H * 0.075, 0.0031, 2.9);
  over(c, uLand1, fill(px.y - r1) * 0.95);

  // Mount Doom: a broad base and a steep upper cone, the east side longer,
  // a crater broken out of the summit, lava seams running down
  float dx = px.x - doomX;
  float base = H * 0.15 * pow(max(0.0, 1.0 - abs(dx) / ((dx < 0.0 ? 340.0 : 420.0) * s)), 1.4);
  float cone = H * 0.3 * pow(max(0.0, 1.0 - abs(dx) / ((dx < 0.0 ? 150.0 : 185.0) * s)), 1.2);
  float dTop = H * 0.06 + max(base, cone) + (vnoise(dx * 0.05 / s) - 0.5) * 4.0 * s - 11.0 * s * smoothstep(17.0 * s, 0.0, abs(dx - 4.0 * s));
  float pulse = 0.65 + 0.35 * sin(uTime * 0.7);
  float inDoom = fill(px.y - dTop);
  if (inDoom > 0.0) {
    // three seams spilling from the crater, the long one west: each keeps
    // to its share of the slope’s width, so it runs down the mountain and
    // never off its edge, broken once or twice and fading where it ends
    float t = clamp((H * 0.34 - px.y) / (H * 0.28), 0.0, 1.0);
    float w = (1.3 + 1.9 * (1.0 - t)) * s;
    float up = max(px.y - H * 0.06, 0.0);
    float wCone = 1.0 - pow(min(up / (H * 0.3), 1.0), 0.83);
    float wBase = 1.0 - pow(min(up / (H * 0.15), 1.0), 0.71);
    vec3 side = vec3(-max(150.0 * wCone, 340.0 * wBase), max(185.0 * wCone, 420.0 * wBase), -max(150.0 * wCone, 340.0 * wBase)) * s;
    vec3 e = abs(vec3(dx) - side * vec3(0.42, 0.4, 0.1) - (sin(t * vec3(9.0, 7.0, 11.0) + vec3(0.0, 2.0, 1.0)) * 6.0 * t + (vec3(vnoise(t * 14.0), vnoise(t * 14.0 + 7.0), vnoise(t * 14.0 + 13.0)) - 0.5) * 5.0) * s) / w;
    vec3 on = smoothstep(vec3(1.0, 0.7, 0.45), vec3(0.85, 0.5, 0.3), vec3(t)) * smoothstep(0.08, 0.3, vec3(vnoise(t * 6.0 + 2.0), vnoise(t * 6.0 + 4.0), vnoise(t * 6.0 + 9.0)));
    vec3 cores = exp(-e * e) * on;
    vec3 halos = exp(-e * 0.7) * on;
    float core = max(cores.x, max(cores.y, cores.z));
    float halo = max(halos.x, max(halos.y, halos.z));
    // the fire in them creeping down, slowly
    float flow = 0.6 + 0.4 * sin(uTime * 0.8 - t * 5.0);
    // ash gullies down its flanks, fanning from the summit
    float fan = dx / max(H * 0.37 - px.y, 24.0 * s);
    float gully = vnoise(fan * 26.0 + 3.0) * 0.6 + vnoise(fan * 61.0 + 9.0) * 0.4;
    // rock lit from the seams, then the molten cores
    vec3 rock = mix(uDark * mix(0.78, 1.22, gully), uLamp, halo * flow * mix(0.3, 0.6, night));
    rock = mix(rock, mix(uLamp, uSun, 0.85 * core), smoothstep(0.12, 0.6, core) * (0.35 + 0.65 * flow));
    // the crater’s lip, lit from inside
    rock = mix(rock, uSun, smoothstep(3.0 * s, 0.0, dTop - px.y) * smoothstep(24.0 * s, 4.0 * s, abs(dx - 4.0 * s)) * pulse);
    over(c, rock, inDoom);
  }
  // the crater’s glow, and its smoke rising and leaning west on the wind
  vec2 cr = vec2(doomX + 4.0 * s, H * 0.352 - 9.0 * s);
  float cg = length((px - cr) / vec2(80.0, 40.0) / s);
  over(c, mix(uLamp, uSun, 0.25 * pulse), exp(-cg * 1.7) * (0.4 + 0.3 * pulse) * mix(0.6, 1.0, night));
  float py = px.y - cr.y;
  float pxd = px.x - cr.x + py * 0.22 + py * py / (H * 1.3);
  float pw = 12.0 * s + py * 0.36;
  if (py > 0.0 && abs(pxd) < pw * 3.0) {
    // billows rolling up it, the smoke thickest in their hearts
    float n = fbm(vec2(pxd / (40.0 * s) + uTime * 0.04, py / (50.0 * s) - uTime * 0.2));
    float plume = exp(-pxd * pxd / (pw * pw * (0.7 + 0.6 * n))) * smoothstep(0.0, 14.0 * s, py) * smoothstep(H * 0.44, 0.0, py) * smoothstep(0.2, 0.62, n + 0.18);
    // lit from the crater beneath, and a little along its east side
    float glowUp = exp(-py / (80.0 * s)) * mix(0.45, 0.95, night) + smoothstep(0.0, pw, -pxd) * 0.12 * night;
    over(c, mix(uSmoke * mix(1.0, 0.8, n), mix(uLamp, uStone, 0.35), clamp(glowUp, 0.0, 1.0)), plume * mix(0.45, 0.9, night));
  }

  // its beam
  if (uBeam.y > 0.0) {
    vec2 v = px - uEye;
    float off = abs(mod(atan(v.y, v.x) - uBeam.x + 3.14159, 6.28318) - 3.14159);
    over(c, uLamp, smoothstep(0.07, 0.0, off) * smoothstep(40.0 * s, 140.0 * s, length(v)) * uBeam.y * 0.45);
  }

  return c;
}

// The near pass, drawn after Barad-dûr (scenes/baradDurView.js), so its
// foot stands behind the near ridge and the reek: the plain’s haze, the
// near ridge, the ash plain, and rocks like teeth along the foot.
vec4 mordorNear(vec2 px, float s, float look) {
  float H = uRes.y;
  float night = uNight;
  vec4 c = vec4(0.0);
  // the reek over the plain: by day an ash mist, by night a smoke lit red
  // from the fires below; it rolls slowly and thins as it rises
  float low = smoothstep(H * 0.4, H * 0.03, px.y);
  float roll = noise(vec2(px.x / (260.0 * s) + uTime * 0.018, px.y / (70.0 * s) - uTime * 0.006));
  vec3 reek = mix(uSky, mix(uSmoke, uLamp, 0.3 * low), night);
  over(c, reek, low * low * (0.5 + 0.5 * roll) * mix(0.62, 0.5, night));
  float r2 = ridge(px.x + look * 0.55, H * 0.058, H * 0.05, 0.0042, 5.3);
  over(c, uLand2, fill(px.y - r2) * 0.97);
  float pl = H * 0.045 + (vnoise(px.x * 0.01) - 0.5) * 3.0 * s;
  over(c, uLand3 * (0.9 + 0.14 * noise(px * vec2(0.035, 0.11))) * mix(0.8, 1.05, smoothstep(0.0, pl, px.y)), fill(px.y - pl));
  float x5 = px.x + look * 1.1;
  float teeth = mix(2.0 * s, ridge(x5, 4.0 * s, 34.0 * s, 0.009, 8.1), smoothstep(0.35, 0.55, vnoise(x5 * 0.0035 + 2.0)));
  over(c, uLand4, fill(px.y - teeth));
  return c;
}

void main() {
  vec2 px = vUv * uRes;
  // a unit that keeps the shapes in proportion from a phone to a big screen
  float s = clamp(min(uRes.y / 860.0, uRes.x / 1100.0), 0.5, 1.4);
  // the pointer moves the eye a little: near lands further than far ones
  float look = (uPointer.x / uRes.x) * uPointer.z * 40.0;
  vec4 c;
  if (uMordor < 0.5) c = shire(px, s, look);
  else if (uLayer > 0.5) c = mordorNear(px, s, look);
  else {
    c = mordorFar(px, s, look);
    if (vUv.x < ${NEAR_LEFT.toFixed(2)}) {
      vec4 n = mordorNear(px, s, look);
      c = n + c * (1.0 - n.a);
    }
  }
  // a grain of noise, so the long soft gradients don’t band
  float a = clamp(c.a + (hash2(px) - 0.5) / 110.0 * step(0.01, c.a), 0.0, 1.0);
  // a mist over the land behind the page’s words, left of the middle and
  // low down, where the page’s mask is still strong: by day it would
  // otherwise take the muted line under them below 4.5:1 (RULES UI 6)
  // (Mordor’s keeps to the plain, so Doom’s cone stands clear of it)
  vec2 mistTop = mix(vec2(0.48, 0.66), vec2(0.2, 0.34), uMordor);
  float words = smoothstep(0.02, 0.07, vUv.x) * (1.0 - smoothstep(0.5, 0.64, vUv.x)) * (1.0 - smoothstep(mistTop.x, mistTop.y, vUv.y));
  a *= 1.0 - words * mix(0.74, 0.3, uNight);
  gl_FragColor = vec4(c.rgb / max(c.a, 0.0001), a);
}
`;

// The lands’ colours, from the colours’ palettes (docs/superpowers/specs/
// 2026-10-18-middle-earth-colours-design.md). The shader writes them just
// as they’re given (kit.js), so they go in as written, with no sRGB step;
// by day a shade deeper than the page will show them, since the page’s
// mask fades them toward the middle.
const PALETTES = {
  shire: {
    // Hobbiton at golden hour: lighter and yellower toward the back
    light: { uSky: 0xf6d98e, uGlow: 0xeca552, uSun: 0xffe3a0, uFar: 0x7896be, uLand1: 0xc4cc74, uLand2: 0x9ab852, uLand3: 0x6c9a38, uLand4: 0x437524, uDark: 0x2f531c, uDoor: 0x2f5a2e, uStone: 0x6f4a2b, uBrass: 0xc9a227, uLamp: 0xffc35a, uSmoke: 0xaaa395 },
    // a summer night on the Hill
    dark: { uSky: 0x18223a, uGlow: 0x26365a, uSun: 0xede3c4, uFar: 0x2a3858, uLand1: 0x1f2c25, uLand2: 0x19261b, uLand3: 0x132014, uLand4: 0x0e180e, uDark: 0x0a120a, uDoor: 0x1f3a22, uStone: 0x2c2a20, uBrass: 0xe2be5c, uLamp: 0xffc96b, uSmoke: 0x8a968a },
  },
  mordor: {
    // ash-fall over Gorgoroth: grey, with a sickly haze low down
    light: { uSky: 0xc9c1b5, uGlow: 0xd99a58, uSun: 0xffb347, uFar: 0xafa69b, uLand1: 0x958b80, uLand2: 0x5e5650, uLand3: 0x7f776e, uLand4: 0x24201e, uDark: 0x4e4743, uDoor: 0x1f1b19, uStone: 0xa8230e, uBrass: 0xff7a1a, uLamp: 0xd2421a, uSmoke: 0x8c857c },
    // under the Eye: a blue-black night above, fire below
    dark: { uSky: 0x151d26, uGlow: 0x8a4a22, uSun: 0xffe08a, uFar: 0x2e2724, uLand1: 0x231d1a, uLand2: 0x191412, uLand3: 0x15110f, uLand4: 0x080605, uDark: 0x120e0c, uDoor: 0x0b0908, uStone: 0xa8230e, uBrass: 0xff7a1a, uLamp: 0xff8a1e, uSmoke: 0x3a302e },
  },
};

// a dragon, wings up, for the fireworks
const DRAGON = [[64, 2], [48, 8], [30, 6], [18, 30], [-6, 46], [4, 12], [-18, 8], [-50, 14], [-80, 4], [-52, 0], [-20, -4], [-2, -10], [-16, -26], [10, -10], [30, -4], [50, -4]];

export function create(canvas, ctx) {
  return ambience(canvas, ctx, (k) => {
    const { THREE } = k;
    // a uniform for each of the palettes’ colours
    const colours = Object.fromEntries(Object.keys(PALETTES.shire.light).map((name) => [name, { value: new THREE.Color() }]));
    const lands = backdrop(k, LANDS, {
      uMordor: { value: k.theme === 'mordor' ? 1 : 0 },
      uNight: { value: 0 },
      ...colours,
      uLit: { value: 0 },
      uEye: { value: new THREE.Vector2() },
      uBeam: { value: new THREE.Vector2() },
      uLayer: { value: 0 },
    });
    // Mordor’s near pass: the same shader and uniforms (one program), its
    // own layer, on the screen’s lower right, drawn after the tower so the
    // near ridge stands in front of its foot
    const nearMat = lands.mesh.material.clone();
    nearMat.uniforms = { ...lands.uniforms, uLayer: { value: 1 } };
    const nearGeo = new THREE.BufferGeometry();
    const top = -1 + 2 * NEAR_TOP;
    const left = -1 + 2 * NEAR_LEFT;
    nearGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([left, -1, 0, 1, -1, 0, 1, top, 0, left, -1, 0, 1, top, 0, left, top, 0]), 3));
    const near = new THREE.Mesh(nearGeo, nearMat);
    near.frustumCulled = false;
    near.renderOrder = -5;
    k.scene.add(near);
    // Barad-dûr, its Eye and their lights, between the two passes
    const tower = baradDurView(k);
    const look = new THREE.Vector2();
    // the Shire’s fireflies and leaves; Mordor’s embers and ash
    const flies = field(k, { count: 60, shape: 'dot', dir: [0.2, 0.3], speed: [4, 12], size: [3, 7], sway: 30, twinkle: 0.9, repel: 50, parallax: 0.05 });
    const leaves = field(k, { count: 26, shape: 'leaf', dir: [0.4, -1], speed: [14, 28], size: [9, 15], sway: 50, spin: 1.2, repel: 60, parallax: 0.1 });
    const embers = field(k, { count: 90, shape: 'ember', dir: [0.15, 1], speed: [16, 40], size: [2, 6], sway: 24, twinkle: 0.5, repel: 40, parallax: 0.06 });
    const ash = field(k, { count: 60, shape: 'dot', dir: [-0.2, -1], speed: [8, 18], size: [2, 4], sway: 30, parallax: 0.08 });
    const sparks = bursts(k, { shape: 'spark', size: 10, max: 260 });

    const dragon = silhouette(DRAGON, [200, 60, 30], 0.9);
    dragon.visible = false;
    k.scene.add(dragon);

    let mordor = k.theme === 'mordor';
    const apply = () => {
      lands.uniforms.uMordor.value = mordor ? 1 : 0;
      near.visible = mordor;
      tower.visible = mordor;
      flies.points.visible = leaves.points.visible = !mordor;
      embers.points.visible = ash.points.visible = mordor;
    };
    apply();

    // the Shire’s fireworks: a rocket goes up, and bursts
    const COLORS = [[255, 210, 90], [120, 220, 255], [255, 120, 160], [160, 255, 140], [255, 255, 255]];
    const rockets = [];
    const show = { wait: rand(3, 6), dragon: 0, t: 0 };
    const beam = { on: false, t: 0, wait: rand(4, 8), from: 0, to: 0 };
    const erupt = { wait: rand(2, 5) };
    let litT = 0;

    return {
      step(dt, t) {
        lands.step(t);
        flies.step(t);
        leaves.step(t);
        embers.step(t);
        ash.step(t);
        sparks.step(dt);
        if (!mordor) {
          // the window at the door, lit for a while now and then (all night)
          litT += dt;
          lands.uniforms.uLit.value = k.reduced || k.dark ? 1 : Math.max(0, Math.min(1, Math.sin(litT * 0.25) * 3));
          show.wait -= dt;
          if (show.wait <= 0 && dt > 0) {
            if (show.dragon++ % 3 === 2) {
              show.t = 0;
              dragon.visible = true;
            } else {
              const side = Math.random() < 0.5 ? -1 : 1;
              rockets.push({ x: side * k.size.w * rand(0.3, 0.45), y: -k.size.h / 2, vy: rand(320, 420), top: rand(0.05, 0.35) * k.size.h, color: pick(COLORS) });
            }
            show.wait = rand(5, 9);
          }
          for (let i = rockets.length - 1; i >= 0; i--) {
            const r = rockets[i];
            r.y += r.vy * dt;
            sparks.emit(r.x, r.y, { count: 1, speed: [0, 20], life: [0.3, 0.5], colors: [[255, 220, 160]], gravity: -60, size: 6 });
            if (r.y >= r.top) {
              sparks.emit(r.x, r.y, { count: 46, speed: [80, 230], life: [0.9, 1.6], colors: [r.color, [255, 255, 255]], gravity: -90, size: 9 });
              rockets.splice(i, 1);
            }
          }
          if (dragon.visible) {
            show.t += dt;
            const span = k.size.w + 300;
            const x = span / 2 - show.t * 260;
            const y = k.size.h * 0.28 + Math.sin(show.t * 2) * 30;
            dragon.position.set(x, y, 0);
            dragon.scale.set(-1, 1 + Math.sin(show.t * 9) * 0.15, 1);
            if (Math.random() < dt * 30) sparks.emit(x + 60, y, { count: 2, speed: [10, 50], life: [0.4, 0.8], colors: [[255, 140, 40], [255, 210, 90]], gravity: -40, size: 8 });
            if (show.t * 260 > span) dragon.visible = false;
          }
        } else {
          // the Eye atop Barad-dûr at the right: it looks at the pointer,
          // and sweeps its beam across the page now and then
          const ex = tower.eye.x;
          const ey = tower.eye.y;
          const dx = k.pointer.x - ex;
          const dy = k.pointer.y - ey;
          const d = Math.hypot(dx, dy) || 1;
          const want = k.pointer.near > 0.1 ? [dx / d, dy / d] : [-0.6 + Math.sin(t * 0.4) * 0.4, -0.2];
          look.x += (want[0] - look.x) * Math.min(1, dt * 3);
          look.y += (want[1] - look.y) * Math.min(1, dt * 3);
          tower.step(dt, t, look, (k.pointer.x / k.size.w) * k.pointer.near);
          lands.uniforms.uEye.value.set(tower.eye.x + k.size.w / 2, tower.eye.y + k.size.h / 2);
          // now and then Doom throws up fire from its crater (where the
          // shader puts it, in its unit s)
          erupt.wait -= dt;
          if (erupt.wait <= 0 && dt > 0) {
            const s = Math.min(1.4, Math.max(0.5, Math.min(k.size.h / 860, k.size.w / 1100)));
            const cx = k.size.w * (DOOM_X - 0.5) + 4 * s;
            const cy = k.size.h * (0.352 - 0.5) - 9 * s;
            sparks.emit(cx, cy, { count: 9, speed: [40, 120], life: [0.8, 1.5], colors: [[255, 120, 30], [255, 200, 90]], gravity: -100, size: 6, angle: [Math.PI * 0.32, Math.PI * 0.68] });
            erupt.wait = rand(5, 11);
          }
          if (!beam.on) {
            beam.wait -= dt;
            lands.uniforms.uBeam.value.y = 0;
            // leftward, from level to down across the page
            if (beam.wait <= 0 && dt > 0) Object.assign(beam, { on: true, t: 0, from: rand(2.95, 3.2), to: rand(3.45, 3.8) });
          } else {
            beam.t += dt;
            const p = beam.t / 6;
            lands.uniforms.uBeam.value.set(beam.from + (beam.to - beam.from) * p, Math.sin(Math.PI * Math.min(1, p)) * 0.9);
            if (p >= 1) Object.assign(beam, { on: false, wait: rand(10, 16) });
          }
          // the still frame keeps its beam up in the sky, clear of the text
          if (k.reduced) lands.uniforms.uBeam.value.set(3.0, 0.7);
        }
        // reduced motion: the Shire’s still frame has a firework open over it
        if (k.reduced && !mordor && !this.stilled) {
          this.stilled = true;
          sparks.emit(k.size.w * 0.38, k.size.h * 0.2, { count: 46, speed: [80, 230], life: [1, 1], colors: [[255, 210, 90], [255, 255, 255]], gravity: 0, size: 9 });
          sparks.step(0.35);
        }
      },
      resize(w, h) {
        tower.place(w, h);
      },
      recolor(c) {
        const dark = c.dark;
        const u = lands.uniforms;
        for (const [name, hex] of Object.entries(PALETTES[mordor ? 'mordor' : 'shire'][dark ? 'dark' : 'light'])) u[name].value.setHex(hex, THREE.LinearSRGBColorSpace);
        u.uNight.value = dark ? 1 : 0;
        tower.recolor(dark);
        flies.colors(dark ? [255, 230, 120] : [214, 168, 40], dark ? [190, 255, 140] : [140, 170, 60]);
        flies.glow(dark);
        leaves.colors(dark ? [90, 130, 50] : [110, 150, 60], dark ? [170, 130, 50] : [196, 150, 60]);
        leaves.uniforms.uOpacity.value = dark ? 0.7 : 0.85;
        embers.colors([255, 120, 30], [255, 200, 80]);
        embers.glow(dark);
        ash.colors(dark ? [110, 100, 96] : [120, 110, 104], dark ? [70, 64, 60] : [160, 150, 144]);
        ash.uniforms.uOpacity.value = dark ? 0.5 : 0.6;
        sparks.glow(dark);
        rgb(dark ? [210, 70, 30] : [170, 50, 24], dragon.userData.material.color);
        this.accent = c.accent;
      },
      retheme(theme) {
        mordor = theme === 'mordor';
        // the Shire’s fireworks and dragon are only moved while it is on: put
        // them away, so none hangs over Mordor (or a still frame’s firework
        // over the Eye), and let the Shire’s still frame open its own again
        dragon.visible = false;
        rockets.length = 0;
        sparks.step(10);
        this.stilled = false;
        apply();
        this.recolor(k.colors);
      },
      dispose() {
        tower.dispose();
      },
      burst(x, y) {
        if (mordor) sparks.emit(x, y, { count: 24, speed: [60, 200], colors: [[255, 120, 30], [255, 210, 90]], gravity: 120, size: 8 });
        else sparks.emit(x, y, { count: 36, speed: [80, 240], colors: [pick(COLORS), [255, 255, 255]], gravity: -90, size: 9 });
      },
    };
    // (the tower’s spikes and horns want their edges smoothed)
  }, { antialias: true });
}

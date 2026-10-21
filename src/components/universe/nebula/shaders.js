// The nebulae’s GLSL, as strings (./index.js makes the material). Every
// cloud and its young stars are one instanced quad: a cloud’s quad covers
// its sphere and ray-marches it through the noise volume (./volume.js); a
// young star’s is a sprite so many pixels across, as the sparks were.
//
// GAS: the look’s numbers, { EMIT, ABSORB, DUST }
// FIELD: the cloud’s field at a point, a chunk of its own so the fog round
//   the ship can share it, its wisps the same gas as the cloud from outside
// SCREEN_RAY: screenRay(ndc), the view-space ray through a point of the
//   screen, lens shift and all, a vertex chunk the fog shares too; and
//   screenRay(ndc, elements), the same lines in JS for the tests
// CLOUD_VERT, CLOUD_FRAG: the one draw (MAX_STEPS defined by the tier)
// FOG: the fog’s numbers, { ABSORB, GLOW }
// FOG_VERT, FOG_FRAG: the fog round the ship (./fog.js), a layer an instance
//
// Light over a thick cloud tends to EMIT / ABSORB times its colour (at full
// strength) times a nursery’s heart: 0.75 × 2.2, under the bloom’s 1.7
// (look.js), so the gas never glows; the young stars may.

export const GAS = { EMIT: 1.5, ABSORB: 2.0, DUST: 1.5 };
// ABSORB: how much a layer’s thickness, in radii, of full gas dims (1.2 to
// start, tuned at the in-nebula pose); GLOW: the ship’s light on the gas, a
// warm white kept under the bloom with the colour at full strength (1 + 0.6)
export const FOG = { ABSORB: 1.2, GLOW: [0.6, 0.54, 0.45] };

// (GLSL wants 2.0, never 2)
const glf = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));

// p is in the cloud’s radii from its middle, along the map’s axes, so the
// cloud rolls with the stars and never with the camera. form is rules.js’s
// (inner, peak, outer, flat), core its heart’s brightness
export const FIELD = /* glsl */ `
uniform highp sampler3D uVolume;

// rules.js's envelope(), line for line
float envelopeOf(vec3 p, vec4 form) {
  float rho = length(vec3(p.x, p.y / form.w, p.z));
  if (rho >= 1.0) return 0.0;
  float hollow = form.x < 0.0 ? 1.0 : smoothstep(form.x, form.y, rho);
  return (1.0 - smoothstep(form.y, form.z, rho)) * hollow;
}

// the gas at p, 0 to 1; tint the light a unit of it gives, dust what more of
// what's behind it dims
float nebulaField(vec3 p, vec3 seed, vec4 form, float core, float detail, vec3 c0, vec3 c1, vec3 c2, out vec3 tint, out float dust) {
  tint = vec3(0.0);
  dust = 0.0;
  float env = envelopeOf(p, form);
  if (env <= 0.0) return 0.0;
  vec2 tap = texture(uVolume, p * 1.3 + seed).rg;
  float g = tap.r;
  // (near, a finer tap at four times the frequency frays the edges)
  if (detail > 0.0) g += detail * (texture(uVolume, p * 5.2 + seed.zxy).r - 0.5) * 0.35;
  float gas = env * smoothstep(0.3, 0.8, g);
  tint = mix(c0, c1, smoothstep(0.2, 0.8, tap.g));
  tint = mix(tint, c2, smoothstep(0.45, 0.85, gas));
  float rho = length(vec3(p.x, p.y / form.w, p.z));
  tint *= mix(core, 1.0, smoothstep(0.0, 0.4, rho));
  dust = env * smoothstep(0.7, 0.9, tap.g);
  return gas;
}
`;

// The universe’s camera always has a lens shift (scene.js setViewOffset:
// half the nav, and half a side panel when one is open), which puts it in
// the projection’s third column; a ray from the field of view alone would
// miss it by up to ~7°. Inverted from clip = P · (x, y, -1): the shift is
// P[2][0], P[2][1], the scale P[0][0], P[1][1] (elements 8, 9, 0, 5).
export const SCREEN_RAY = /* glsl */ `
vec3 screenRay(vec2 ndc) {
  return vec3((ndc + vec2(projectionMatrix[2][0], projectionMatrix[2][1])) / vec2(projectionMatrix[0][0], projectionMatrix[1][1]), -1.0);
}
`;
export const screenRay = ([x, y], e) => [(x + e[8]) / e[0], (y + e[9]) / e[5], -1];

const VARYINGS = /* glsl */ `
varying vec3 vRay;
varying vec3 vCentre;
varying vec4 vMarch;
varying vec4 vForm;
varying vec4 vSeed;
varying vec3 vCol0;
varying vec3 vCol1;
varying vec3 vCol2;
varying vec3 vSprite;
`;

// The mesh sits at the camera (index.js), so in its own space the eye is
// the origin and aCentre is the cloud’s middle from it, along the map’s
// axes. vRay is a point on the quad in that space, or (inside) the ray.
// vMarch is (radius, start, detail, steps); vSeed (seed, the heart’s core);
// vSprite the quad’s corner and 1 for a young star.
export const CLOUD_VERT = /* glsl */ `
attribute vec3 aCentre;
attribute float aRadius;
attribute float aDist;
attribute float aDetail;
attribute float aStart;
attribute float aKind;
attribute vec3 aCol0;
attribute vec3 aCol1;
attribute vec3 aCol2;
attribute vec4 aSeed;
attribute float aSteps;
uniform vec4 uForms[3];
uniform float uCore[3];
uniform float uNear;
uniform float uScale;
${VARYINGS}
${SCREEN_RAY}
void main() {
  vCol0 = aCol0;
  vCol1 = aCol1;
  vCol2 = aCol2;
  vSprite = vec3(position.xy, aKind);
  vCentre = aCentre;
  vMarch = vec4(aRadius, aStart, aDetail, aSteps);
  int f = int(aSeed.w + 0.5);
  vForm = uForms[f];
  vSeed = vec4(aSeed.xyz, uCore[f]);
  float D = length(aCentre);
  // pulled in from past the far plane (rules.js placement)
  bool scaled = aDist > D * 1.001;
  if (aKind > 0.5) {
    // a young star: so many pixels across, as the sparks were (a pixel is
    // 2 / the height of clip space, and the height is 2 * uScale / P[1][1])
    vRay = aCentre;
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(aCentre, 1.0);
    float px = clamp(aRadius * uScale / max(aDist, 0.001), 2.0, 30.0);
    clip.xy += position.xy * px * vec2(projectionMatrix[0][0], projectionMatrix[1][1]) / (2.0 * uScale) * clip.w;
    gl_Position = clip;
  } else if (D <= 1.02 * aRadius) {
    // in it, or all but: the whole screen, its rays the camera's own
    float d0 = max(aStart, 4.0 * uNear);
    vec4 front = projectionMatrix * vec4(0.0, 0.0, -d0, 1.0);
    gl_Position = vec4(position.xy * front.w, front.z, front.w);
    vRay = transpose(mat3(modelViewMatrix)) * screenRay(position.xy);
  } else {
    // a square facing the eye, just covering the sphere's outline, at the
    // front of it (or, pulled in, at its middle)
    float R = aRadius;
    vec3 dir = aCentre / D;
    float zp = scaled ? D : max(D - R, 4.0 * uNear);
    float h = zp * R / sqrt(D * D - R * R);
    vec3 u = normalize(cross(dir, abs(dir.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 v = cross(u, dir); // (u x v is -dir: wound toward the eye)
    vRay = dir * zp + (position.x * u + position.y * v) * h;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(vRay, 1.0);
  }
  // pulled in, it's at the far plane's depth: behind a landing's day dome,
  // behind everything; and nothing is cut by the far plane
  if (scaled) gl_Position.z = gl_Position.w;
  gl_Position.z = min(gl_Position.z, gl_Position.w * 0.999999);
}`;

export const CLOUD_FRAG = /* glsl */ `
${FIELD}
const float EMIT = ${glf(GAS.EMIT)};
const float ABSORB = ${glf(GAS.ABSORB)};
const float DUST = ${glf(GAS.DUST)};
${VARYINGS}
// interleaved gradient noise: each pixel starts its march a little further
// in, so a few steps read as grain rather than as bands
float ign(vec2 px) {
  return fract(52.9829189 * fract(dot(px, vec2(0.06711056, 0.00583715))));
}

void main() {
  if (vSprite.z > 0.5) {
    // a young star: the sparks' falloff (deepspaceShaders.js SPARK_FRAG), light only
    float r2 = dot(vSprite.xy, vSprite.xy);
    float a = exp(-r2 * 30.0) * 1.6 + exp(-r2 * 5.0) * 0.35;
    a *= 1.0 - smoothstep(0.6, 1.0, r2);
    gl_FragColor = vec4(vCol0 * a, 0.0);
  } else {
    float R = vMarch.x;
    vec3 rd = normalize(vRay);
    // the sphere on this ray, measured from the ray's nearest point to its
    // middle, which stays exact for a small sphere tens of thousands away
    float b = dot(rd, vCentre);
    vec3 off = vCentre - b * rd;
    float h2 = R * R - dot(off, off);
    if (h2 <= 0.0) discard;
    float s = sqrt(h2);
    float t0 = max(max(b - s, vMarch.y), 0.0);
    float t1 = b + s;
    if (t1 <= t0) discard;
    float steps = max(floor(vMarch.w + 0.5), 1.0);
    // the step in radii, so the picture is the same at any step count or scale
    float ds = (t1 - t0) / steps / R;
    vec3 p0 = (rd * t0 - vCentre) / R;
    vec3 dp = rd * ds;
    float j = ign(gl_FragCoord.xy);
    vec3 light = vec3(0.0);
    float T = 1.0;
    for (int i = 0; i < MAX_STEPS; i++) {
      if (float(i) >= steps) break;
      vec3 tint;
      float dust;
      float gas = nebulaField(p0 + dp * (float(i) + j), vSeed.xyz, vForm, vSeed.w, vMarch.z, vCol0, vCol1, vCol2, tint, dust);
      float sigma = ABSORB * (gas + DUST * dust);
      if (sigma < 1e-4) continue;
      // Beer-Lambert: what this step gives, dimmed by all in front of it
      float a = exp(-sigma * ds);
      light += T * tint * (EMIT * gas / sigma) * (1.0 - a);
      T *= a;
      if (T < 0.02) break;
    }
    gl_FragColor = vec4(light, 1.0 - T);
  }
  #include <colorspace_fragment>
}`;

// The fog round the ship (./fog.js): each layer is the whole screen at the
// depth of its radius, so what is nearer hides it. vRay is the ray in the
// mesh’s space (the map’s axes, the eye at the origin, as the clouds have
// it); vView the same ray in view space, where the ship is; vLayer the
// layer’s (radius, thickness).
const FOG_VARYINGS = /* glsl */ `
varying vec3 vRay;
varying vec3 vView;
varying vec2 vLayer;
`;

export const FOG_VERT = /* glsl */ `
attribute vec2 aLayer;
${FOG_VARYINGS}
${SCREEN_RAY}
void main() {
  vLayer = aLayer;
  vView = screenRay(position.xy);
  vRay = transpose(mat3(modelViewMatrix)) * vView;
  vec4 at = projectionMatrix * vec4(0.0, 0.0, -aLayer.x, 1.0);
  gl_Position = vec4(position.xy * at.w, at.z, at.w);
}`;

// One sample of the cloud’s field per layer, at the layer’s depth along the
// ray; its thickness (in radii) sets how much it dims, Beer-Lambert as the
// clouds, dust dimming without light. The ship’s light is a warm white two
// units ahead of the eye (the chase view), scattered by the gas there.
export const FOG_FRAG = /* glsl */ `
${FIELD}
const float ABSORB_FOG = ${glf(FOG.ABSORB)};
const float DUST_FOG = ${glf(GAS.DUST)}; // (dust weighs as it does in the clouds, so the same gas dims alike from inside and out)
const vec3 GLOW = vec3(${FOG.GLOW.map(glf).join(', ')});
uniform vec3 uCentre;
uniform float uR;
uniform vec3 uCol0;
uniform vec3 uCol1;
uniform vec3 uCol2;
uniform vec3 uSeed;
uniform vec4 uForm;
uniform float uCore;
uniform float uDepth;
${FOG_VARYINGS}
void main() {
  // the point on this layer, in the cloud's radii from its middle, along the map's axes
  vec3 p = (vRay * vLayer.x - uCentre) / uR;
  vec3 tint;
  float dust;
  float gas = nebulaField(p, uSeed, uForm, uCore, 1.0, uCol0, uCol1, uCol2, tint, dust);
  float sigma = gas + DUST_FOG * dust;
  if (sigma < 1e-4) discard;
  float alpha = 1.0 - exp(-ABSORB_FOG * sigma * vLayer.y / uR);
  vec3 light = tint * alpha * (gas / sigma);
  vec3 ship = vView * vLayer.x - vec3(0.0, 0.0, -2.0);
  light += GLOW * gas * exp(-dot(ship, ship) / 36.0);
  gl_FragColor = vec4(light, alpha) * uDepth;
  #include <colorspace_fragment>
}`;

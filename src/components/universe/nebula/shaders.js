// The nebulae's shaders, as GLSL strings (index.js makes the one material
// that draws them). Every cloud and its young stars are instances of one
// quad in one draw; aKind says which an instance is.
//
// A cloud is marched through its sphere, its middle aCentre (from the
// camera, drawn in when it's past the far plane) and its radius aRadius.
// Its quad holds the sphere's outline: a square facing the eye, at the
// plane through its middle when it was drawn in (so it sits at the far
// plane's depth, behind a day landing's dome) or at its front when not (so
// anything solid in front of it hides it). With the eye in it or at its
// edge the quad is the whole screen, at the depth the march starts.
//
// The march works in the map's axes, in radii from the middle, so the
// cloud is the same at any scale, rolls with the stars and never with the
// camera. Each sample's gas is the cloud's form (rules.js's envelope, line
// for line: uForms and uCore are filled from FORMS) times the noise volume,
// with a finer tap as it comes near. Light and its dimming are summed by
// Beer–Lambert over a step's length in radii, so the picture doesn't hang
// on the step count, and each step adds light in proportion to the light
// it hides: no cloud is ever brighter than GAS.emit · core / GAS.absorb
// times its brightest colour (a channel at 1 at most: index.js's), which
// is under the bloom's threshold (look.js). The out is premultiplied:
// (light, 1 − what shows through).
//
// A young star is a sprite of its size in pixels at its own distance
// (deep space's sparks: SPARK_FRAG's falloff), adding light only.
//
//   GAS          the look: emit (light a radius of gas gives), absorb (how
//                much a radius of it hides), dust (how much a radius of
//                dust hides, on top)
//   NEBULA_FIELD the field chunk: nebulaField(p, form, core, seed, detail)
//                → (gas, dust, colour mix, heat), shared with the fog
//   CLOUD_VERT, CLOUD_FRAG

export const GAS = Object.freeze({ emit: 1.5, absorb: 2.0, dust: 3.0 });

// (a number as GLSL reads a float: 2 would be an int, and GLSL ES won't mix them)
const f = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));

export const NEBULA_FIELD = `
uniform sampler3D uVolume;
// p in radii from the middle, in the map's axes; form (inner, peak, outer,
// flat); core how bright the heart is; detail 0…1, the finer tap's share
vec4 nebulaField(vec3 p, vec4 form, float core, vec3 seed, float detail) {
  float rho = length(vec3(p.x, p.y / form.w, p.z));
  if (rho >= 1.0) return vec4(0.0);
  float env = (1.0 - smoothstep(form.y, form.z, rho)) * (form.x < 0.0 ? 1.0 : smoothstep(form.x, form.y, rho));
  vec2 coarse = textureLod(uVolume, p * 1.3 + seed, 0.0).rg;
  float g = coarse.r;
  if (detail > 0.0) g += (textureLod(uVolume, p * 5.2 + seed.zxy, 0.0).r - 0.5) * 0.35 * detail;
  float gas = smoothstep(0.3, 0.8, g) * env;
  float dust = smoothstep(0.7, 0.85, coarse.g) * env;
  float heat = 1.0 + (core - 1.0) * (1.0 - smoothstep(0.0, 0.35, rho));
  return vec4(gas, dust, coarse.g, heat);
}`;

export const CLOUD_VERT = `
attribute vec3 aCentre;
attribute float aRadius;
attribute float aDist;
attribute float aDetail;
attribute float aStart;
attribute float aKind;
attribute vec3 aCol0;
attribute vec3 aCol1;
attribute vec3 aCol2;
attribute vec3 aSeed;
attribute vec4 aShape;
uniform vec4 uForms[3];
uniform float uCore[3];
uniform vec2 uTan;
uniform float uNear;
uniform float uScale;
uniform vec2 uPixel;
varying vec3 vRay;
varying vec3 vCentre;
varying float vRadius;
varying float vStart;
varying float vSteps;
varying float vDetail;
varying float vKind;
varying vec4 vForm;
varying float vCore;
varying vec3 vSeed;
varying vec3 vCol0;
varying vec3 vCol1;
varying vec3 vCol2;
varying vec2 vSprite;
void main() {
  vKind = aKind;
  vCol0 = aCol0;
  vCol1 = aCol1;
  vCol2 = aCol2;
  vSprite = position.xy;
  vec3 c = (modelViewMatrix * vec4(aCentre, 1.0)).xyz;
  if (aKind > 0.5) {
    // a young star: its size in pixels at its own distance (aShape.z its size)
    vec4 star = projectionMatrix * vec4(c, 1.0);
    float px = clamp(aShape.z * uScale / max(aDist, 0.1), 2.0, 30.0);
    star.xy += position.xy * px * uPixel * star.w;
    star.z = min(star.z, star.w * 0.999999);
    gl_Position = star;
    return;
  }
  int form = clamp(int(aShape.x + 0.5), 0, 2);
  vForm = uForms[form];
  vCore = uCore[form];
  vSeed = aSeed;
  vSteps = aShape.y;
  vDetail = aDetail;
  vStart = aStart;
  vRadius = aRadius;
  float R = aRadius;
  float D = length(c);
  vec3 ray;
  vec4 clip;
  if (D <= 1.02 * R) {
    // the eye in it or at its edge: the whole screen, at the depth the
    // march starts (or, drawn in, at its middle's)
    float z = aShape.w > 0.5 ? D : max(aStart, 4.0 * uNear);
    clip = projectionMatrix * vec4(0.0, 0.0, -z, 1.0);
    clip = vec4(position.xy * clip.w, clip.z, clip.w);
    ray = vec3(position.xy * uTan, -1.0);
  } else {
    // a square facing the eye that holds the outline, at the plane through
    // its middle when it was drawn in, else at its front
    vec3 fwd = c / D;
    vec3 ref = abs(fwd.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 right = normalize(cross(fwd, ref));
    vec3 up = cross(right, fwd);
    float plane = aShape.w > 0.5 ? D : max(D - R, 4.0 * uNear);
    float h = plane * R / sqrt(D * D - R * R);
    ray = fwd * plane + (right * position.x + up * position.y) * h;
    clip = projectionMatrix * vec4(ray, 1.0);
  }
  clip.z = min(clip.z, clip.w * 0.999999);
  gl_Position = clip;
  // the ray and the middle in the map's axes (the map turns, never scales:
  // a vector times the matrix is its transpose's, here its inverse)
  vRay = ray * mat3(modelViewMatrix);
  vCentre = c * mat3(modelViewMatrix);
}`;

export const CLOUD_FRAG = `
const float EMIT = ${f(GAS.emit)};
const float ABSORB = ${f(GAS.absorb)};
const float DUST = ${f(GAS.dust)};
${NEBULA_FIELD}
varying vec3 vRay;
varying vec3 vCentre;
varying float vRadius;
varying float vStart;
varying float vSteps;
varying float vDetail;
varying float vKind;
varying vec4 vForm;
varying float vCore;
varying vec3 vSeed;
varying vec3 vCol0;
varying vec3 vCol1;
varying vec3 vCol2;
varying vec2 vSprite;
void main() {
  vec4 shade;
  if (vKind > 0.5) {
    // a young star, its light only (the sparks' falloff)
    float r2 = dot(vSprite, vSprite);
    float a = exp(-r2 * 30.0) * 1.6 + exp(-r2 * 5.0) * 0.35;
    a *= 1.0 - smoothstep(0.6, 1.0, r2);
    shade = vec4(vCol0 * a, 0.0);
  } else {
    vec3 rd = normalize(vRay);
    // where the ray meets the sphere, from the ray's nearest point to the
    // middle (not b² − c, which loses a far one's edge to rounding)
    float b = dot(rd, vCentre);
    vec3 m = vCentre - rd * b;
    float h2 = vRadius * vRadius - dot(m, m);
    if (h2 <= 0.0) discard;
    float hw = sqrt(h2);
    float t0 = max(max(b - hw, vStart), 0.0);
    float t1 = b + hw;
    if (t1 <= t0) discard;
    int steps = int(vSteps + 0.5);
    float dt = (t1 - t0) / float(steps);
    float ds = dt / vRadius;
    // interleaved gradient noise: the steps' banding turned to a fine grain
    float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    vec3 p = (rd * (t0 + jitter * dt) - vCentre) / vRadius;
    vec3 dp = rd * ds;
    vec3 light = vec3(0.0);
    float through = 1.0;
    for (int i = 0; i < MAX_STEPS; i++) {
      if (i >= steps || through < 0.02) break;
      vec4 at = nebulaField(p, vForm, vCore, vSeed, vDetail);
      p += dp;
      if (at.x <= 0.0) continue;
      vec3 col = mix(mix(vCol0, vCol1, at.z), vCol2, smoothstep(0.5, 0.9, at.x));
      // (a hot heart, a nursery's, goes toward a warm white: no channel over 1)
      col = mix(col, vec3(1.0, 0.98, 0.88), clamp((at.w - 1.0) * 0.4, 0.0, 0.5));
      float kappa = at.x * ABSORB + at.y * DUST;
      float lost = 1.0 - exp(-kappa * ds);
      light += through * col * (EMIT * at.w * at.x / kappa) * lost;
      through *= 1.0 - lost;
    }
    shade = vec4(light, 1.0 - through);
  }
  gl_FragColor = shade;
  #include <colorspace_fragment>
}`;

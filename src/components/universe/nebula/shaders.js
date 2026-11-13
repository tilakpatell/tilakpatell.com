// The nebula renderer's GLSL (./index.js and ./fog.js make the materials).
// One field, FIELD, is shared by the clouds and the fog round the ship, so
// the wisps you fly through are the gas you saw from outside. A sample is
// taken in the map's axes (transpose(mat3(modelViewMatrix)) undoes the
// view's turn), which is why a cloud rolls with the stars and never with
// the camera. The light is emission and absorption, integrated per step
// (Beer–Lambert, step lengths in radii, so the picture doesn't depend on
// the step count or how far the cloud was pulled in). The gas stays under
// the bloom's threshold (look.js, 1.7); a young star may go over it.

// the forms' numbers (rules.js's FORMS, as uniforms) and the field: the
// envelope is rules.js's envelope, line for line
const FIELD = /* glsl */ `
precision highp sampler3D;
uniform sampler3D uVolume;
uniform vec4 uForms[3];
uniform float uCore[3];
uniform float uTime;

// Living, never spinning (the owner's ask): the gas drifts through the
// cloud (its noise carried along a slow line, never turned) and the cloud
// swells and settles by a few per cent, each on its own beat, on the
// scene's clock, which stands still under reduced motion.
vec3 nebFlow(vec3 seed) { return vec3(0.011, 0.004, -0.008) * uTime + 0.02 * sin(uTime * vec3(0.05, 0.037, 0.043) + seed * 6.2832); }
float nebBreath(vec3 seed) { return 1.0 + 0.035 * sin(uTime * 0.21 + seed.x * 6.2832); }

float nebEnvelope(int form, vec3 p) {
  vec4 f = uForms[form];
  float rho = length(vec3(p.x, p.y / f.w, p.z));
  if (rho >= 1.0) return 0.0;
  float rise = f.x < 0.0 ? 1.0 : smoothstep(f.x, f.y, rho);
  return (1.0 - smoothstep(f.y, f.z, rho)) * rise;
}

// the gas at p (radii, map axes): x its density, y the colour's mix,
// z its dust; fine adds a smaller tap where the cloud is near
vec3 nebField(int form, vec3 p, vec3 seed, float fine) {
  if (dot(p, p) >= 1.5) return vec3(0.0);
  vec3 flow = nebFlow(seed);
  vec2 n = texture(uVolume, p * 0.55 + seed + flow).rg;
  // the edge broken by the gas itself, so no cloud is a ball; breathing
  // (only ever drawn in, never out past the sphere that's marched: no hard rim)
  float env = nebEnvelope(form, p * (1.04 + 0.4 * n.g) / nebBreath(seed));
  if (env <= 0.0) return vec3(0.0);
  float gas = smoothstep(0.35, 0.85, n.r);
  // filaments: the gas's ridges, sharper in a shell
  float ridge = 1.0 - abs(2.0 * texture(uVolume, p * 1.1 + seed.yzx + flow * 1.6).r - 1.0);
  gas *= mix(0.45, 1.25, ridge * ridge);
  if (fine > 0.0) gas *= mix(1.0, 0.55 + 0.9 * texture(uVolume, p * 2.6 + seed.zxy + flow * 2.4).r, fine);
  float dust = smoothstep(0.7, 0.85, n.g) * 0.8;
  return vec3(env * gas, n.g, dust * env);
}

// its colour at a sample: the first two mixed by the field, the third
// where the gas is thickest, the heart hotter by the form's core
vec3 nebColour(int form, vec3 p, vec3 f, vec3 c0, vec3 c1, vec3 c2) {
  vec3 c = mix(c0, c1, smoothstep(0.25, 0.75, f.y));
  c = mix(c, c2, smoothstep(0.55, 0.95, f.x));
  float heart = 1.0 - smoothstep(0.0, 0.45, length(p));
  return c * (1.0 + (uCore[form] - 1.0) * heart);
}

// interleaved gradient noise: the march's jitter, so too few steps read as
// grain, not as slices
float nebJitter(vec2 px) { return fract(52.9829189 * fract(dot(px, vec2(0.06711056, 0.00583715)))); }
`;

export const CLOUD_VERT = /* glsl */ `
attribute vec3 aCentre;  // its middle less the camera, scaled (map axes)
attribute float aRadius; // scaled
attribute float aDist;   // its true distance
attribute float aDetail; // 0 far … 1 near
attribute float aStart;  // where the march starts along the ray, scaled (past the fog); 0 outside
attribute float aKind;   // 0 a cloud, 1 a young star
attribute vec3 aC0;
attribute vec3 aC1;
attribute vec3 aC2;
attribute vec4 aSeed;    // xyz the seed, w the form
attribute vec2 aSteps;   // x the steps; y a cloud's scale (under 1: pulled in), a star's size

uniform vec2 uViewport;
uniform float uScale;    // pixels a unit is at a distance of one

varying vec3 vView;
varying vec3 vCentre;
varying float vRadius;
varying float vStart;
varying float vDetail;
varying vec3 vC0;
varying vec3 vC1;
varying vec3 vC2;
varying vec4 vSeed;
varying float vSteps;
varying float vKind;
varying vec2 vCorner;

void main() {
  vKind = aKind;
  vC0 = aC0; vC1 = aC1; vC2 = aC2;
  vSeed = aSeed;
  vSteps = aSteps.x;
  vDetail = aDetail;
  vCorner = position.xy;
  vec3 c = (modelViewMatrix * vec4(aCentre, 1.0)).xyz;
  float unit = length(modelViewMatrix[0].xyz);
  float R = aRadius * unit;
  vCentre = c;
  vRadius = R;
  vStart = aStart * unit;
  float near = projectionMatrix[3][2] / (projectionMatrix[2][2] - 1.0);
  vec2 tanHalf = vec2(1.0 / projectionMatrix[0][0], 1.0 / projectionMatrix[1][1]);
  if (aKind > 0.5) {
    // a young star: a sprite at its place, sized as deepspace.js's sparks
    vec4 clip = projectionMatrix * vec4(c, 1.0);
    float px = clamp(aSteps.y * uScale / max(aDist, 0.1), 2.0, 30.0);
    clip.xy += position.xy * px / uViewport * clip.w;
    vView = vec3(0.0);
    gl_Position = clip;
    return;
  }
  float D = length(c);
  if (D <= 1.02 * R) {
    // the camera in it (or at its skin): the whole screen, at the depth the march starts
    float z = max(vStart, 4.0 * near);
    vec4 at = projectionMatrix * vec4(0.0, 0.0, -z, 1.0);
    gl_Position = vec4(position.xy, at.z / at.w, 1.0);
    vView = vec3(position.xy * tanHalf, -1.0);
    return;
  }
  // a square facing the view that covers the sphere's silhouette, at its
  // front (or, pulled in past the far plane, at its middle: behind a day
  // landing's dome)
  vec3 dir = c / D;
  float plane = aSteps.y < 0.999 ? D : max(D - R, 4.0 * near);
  float h = plane * R / sqrt(D * D - R * R);
  vec3 ref = abs(dir.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 right = normalize(cross(ref, dir));
  vec3 up = cross(dir, right);
  vec3 p = dir * plane + (right * position.x + up * position.y) * h;
  vView = p;
  gl_Position = projectionMatrix * vec4(p, 1.0);
}`;

export const CLOUD_FRAG = /* glsl */ `
uniform mat4 modelViewMatrix; // (three declares it in the vertex stage only)
uniform float uEmit;
uniform float uAbsorb;
${FIELD}
varying vec3 vView;
varying vec3 vCentre;
varying float vRadius;
varying float vStart;
varying float vDetail;
varying vec3 vC0;
varying vec3 vC1;
varying vec3 vC2;
varying vec4 vSeed;
varying float vSteps;
varying float vKind;
varying vec2 vCorner;

const int MAX_STEPS = NEB_MAX_STEPS;

void main() {
  if (vKind > 0.5) {
    // a young star: light added, nothing dimmed
    float r2 = dot(vCorner, vCorner);
    float a = exp(-r2 * 30.0) * 1.6 + exp(-r2 * 5.0) * 0.35;
    a *= 1.0 - smoothstep(0.6, 1.0, r2);
    gl_FragColor = vec4(vC0 * a * vDetail, 0.0);
    #include <colorspace_fragment>
    return;
  }
  vec3 rd = normalize(vView);
  float b = dot(rd, vCentre);
  float h2 = b * b - (dot(vCentre, vCentre) - vRadius * vRadius);
  if (h2 <= 0.0) discard;
  float sq = sqrt(h2);
  float t0 = max(b - sq, vStart);
  float t1 = b + sq;
  if (t1 <= t0) discard;
  int form = int(vSeed.w + 0.5);
  mat3 toMap = transpose(mat3(modelViewMatrix));
  float s2 = dot(modelViewMatrix[0].xyz, modelViewMatrix[0].xyz);
  // a sample's place in radii, map axes: toMap(rd·t − c) / (s² · r), r = R / s
  float k = 1.0 / (sqrt(s2) * vRadius);
  vec3 o = toMap * (-vCentre) * k;
  vec3 dirMap = toMap * rd * k;
  float steps = max(vSteps, 1.0);
  float dt = (t1 - t0) / steps;
  float dtR = dt / vRadius;
  float t = t0 + dt * nebJitter(gl_FragCoord.xy);
  vec3 light = vec3(0.0);
  float trans = 1.0;
  for (int i = 0; i < MAX_STEPS; i++) {
    if (float(i) >= steps || trans < 0.02) break;
    vec3 p = o + dirMap * t;
    vec3 f = nebField(form, p, vSeed.xyz, vDetail);
    float sigma = f.x * uAbsorb + f.z * 3.0;
    float a = 1.0 - exp(-sigma * dtR);
    vec3 c = nebColour(form, p, f, vC0, vC1, vC2) * uEmit;
    // emitted light where the gas is, dimmed by the dust in it
    light += trans * a * c * (f.x / max(sigma, 1e-4)) * uAbsorb;
    trans *= 1.0 - a;
    t += dt;
  }
  gl_FragColor = vec4(light, 1.0 - trans);
  #include <colorspace_fragment>
}`;

export const FOG_VERT = /* glsl */ `
attribute vec2 aLayer; // x its radius, y the thickness to the layer inside it
varying vec3 vView;
varying vec2 vLayer;
void main() {
  vLayer = aLayer;
  vec2 tanHalf = vec2(1.0 / projectionMatrix[0][0], 1.0 / projectionMatrix[1][1]);
  vec4 at = projectionMatrix * vec4(0.0, 0.0, -aLayer.x, 1.0);
  gl_Position = vec4(position.xy, at.z / at.w, 1.0);
  vView = vec3(position.xy * tanHalf, -1.0) * aLayer.x;
}`;

export const FOG_FRAG = /* glsl */ `
uniform mat4 modelViewMatrix; // (three declares it in the vertex stage only)
uniform vec3 uCentre; // the nebula's middle less the camera (map axes, true units)
uniform float uRadius;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec4 uSeed;
uniform float uDepth;
uniform float uAbsorb;
uniform float uEmit;
uniform vec3 uGlow;
${FIELD}
varying vec3 vView;
varying vec2 vLayer;
void main() {
  int form = int(uSeed.w + 0.5);
  mat3 toMap = transpose(mat3(modelViewMatrix));
  float s2 = dot(modelViewMatrix[0].xyz, modelViewMatrix[0].xyz);
  vec3 centre = (modelViewMatrix * vec4(uCentre, 1.0)).xyz;
  vec3 p = toMap * (vView - centre) / (s2 * uRadius);
  vec3 f = nebField(form, p, uSeed.xyz, 1.0);
  // never quite clear inside: a floor of haze, so a gap in the gas is thin, not empty
  float dens = max(f.x, 0.08 * nebEnvelope(form, p));
  float a = (1.0 - exp(-(dens * uAbsorb + f.z * 2.0) * vLayer.y / uRadius)) * uDepth;
  vec3 c = nebColour(form, p, f, uC0, uC1, uC2) * uEmit;
  // the ship's lights, scattering in the gas just ahead of the eye
  vec3 ship = vView - vec3(0.0, 0.0, -2.0);
  c += uGlow * dens * exp(-dot(ship, ship) / 36.0);
  gl_FragColor = vec4(c * a, a);
  #include <colorspace_fragment>
}`;

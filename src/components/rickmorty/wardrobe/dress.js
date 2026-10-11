// A look's colours on a figure. A Meshy figure is one mesh with one
// texture, so a coat can't be given a colour as a part: each texel is read
// instead, as Morty's clones' shirts are (portal/meshyCast.js shirted()),
// and told apart twice over. First by where it is on the body: each
// vertex's zone is the zone of the bone that moves it most (head, torso and
// arms, thighs, shins, feet; and the hands, which keep their skin), so Rick's
// light-blue hair and his light-blue shirt are
// two things. Then by its colour, in that zone: a hue, saturation and value
// window for each region of each body (KEYS, read off each texture by
// lab/zones.mjs). A texel in a region takes the swatch at its own
// brightness against the region's (so its light and shade stay), held
// inside `shade` (a floor that flattens the darker patches some textures
// bake in: HD Rick's coat comes out grey down one side, and is white again
// here with nothing picked: `fix`).
//
// addZones(geometry, boneNames) once per geometry; recolor(material, body,
// colors) on a figure's own copy of its material; dressColors(figure, look)
// does both for a figure from createMeshyCast().make().

// (The zones and keys are ./dressCore.js's; the shader is here, and its
// node twin is ./dressNodes.js.)

import { MAX_REGIONS, dressColorsWith, regionUniforms, weighs, zoneOf } from './dressCore';

export { KEYS, MAX_REGIONS, addZones, regionUniforms, zoneOf } from './dressCore';

const N = MAX_REGIONS;
const DECLARE = `
uniform float rgOn[${N}];
uniform vec3 rgSwatch[${N}];
uniform float rgZones[${N}];
uniform vec2 rgHue[${N}];
uniform vec2 rgSat[${N}];
uniform vec2 rgVal[${N}];
uniform float rgRef[${N}];
uniform vec2 rgShade[${N}];
vec3 rgHsv(vec3 c) {
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float d = mx - mn;
  float h = 0.0;
  if (d > 1e-5) {
    if (mx == c.r) h = mod((c.g - c.b) / d, 6.0);
    else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
  }
  return vec3(h * 60.0, mx > 1e-5 ? d / mx : 0.0, mx);
}
float rgIn(float x, vec2 w, float soft) {
  return smoothstep(w.x - soft, w.x + soft, x) * (1.0 - smoothstep(w.y - soft, w.y + soft, x));
}
float rgHueIn(float h, vec2 w) {
  if (w.y - w.x >= 359.0) return 1.0;
  if (w.x <= w.y) return rgIn(h, w, 5.0);
  return max(rgIn(h, vec2(w.x, 366.0), 5.0), rgIn(h, vec2(-6.0, w.y), 5.0));
}`;

const RECOLOR = `
{
  vec3 lin = diffuseColor.rgb;
  vec3 srgb = pow(max(lin, vec3(0.0)), vec3(1.0 / 2.2));
  vec3 hsv = rgHsv(srgb);
  float zone = floor(vZone + 0.5);
  // (multisampled, an edge pixel is shaded at its centre, off the triangle:
  // a blended zone goes on past its corners there, on a sliver far under 0,
  // where exp2 of it is 0 and the bit read NaN, which the bloom spreads over
  // the whole frame. A zone past 0 to 5 has no bit anyway: read only those.)
  bool known = zone >= 0.0 && zone <= ${zoneOf('LeftHand')}.0;
  for (int i = 0; i < ${N}; i++) {
    if (rgOn[i] < 0.5) continue;
    float m = (known ? mod(floor(rgZones[i] / exp2(zone)), 2.0) : 0.0) * rgHueIn(hsv.x, rgHue[i]) * rgIn(hsv.y, rgSat[i], 0.04) * rgIn(hsv.z, rgVal[i], 0.04)/*lower*/;
    float shade = clamp(hsv.z / rgRef[i], rgShade[i].x, rgShade[i].y);
    vec3 col = pow(clamp(rgSwatch[i] * shade, 0.0, 1.0), vec3(2.2));
    lin = mix(lin, col, m);
  }
  diffuseColor.rgb = lin;
}`;

// A material taught a body's regions (on top of whatever it's already
// taught: its rim, a paint). Its uniforms are in userData.regions; set(colors)
// changes the colours without a new program.
export function recolor(material, bodyId, colors = {}) {
  const u = regionUniforms(bodyId, colors);
  // (a zone blended across a triangle whose corners are in two, a wrist’s
  // between the forearm’s 1 and the hand’s 5, passes through 2, 3 and 4 on
  // the way: a band the keys for the hips, shins and feet would take. Walt’s
  // and Jesse’s keep one zone a triangle; Rick and Morty’s were tuned as
  // they blend, and are left so.)
  const weighed = weighs(bodyId);
  const zoneVarying = weighed ? 'flat varying float vZone;\nvarying float vLower;\nvarying float vUpper;' : 'varying float vZone;';
  const recolorChunk = weighed ? RECOLOR.replace('/*lower*/', ' * rgIn(vLower, rgLower[i], 0.03) * rgIn(vUpper, rgUpper[i], 0.03)') : RECOLOR.replace('/*lower*/', '');
  const uniforms = {
    rgOn: { value: u.on },
    rgSwatch: { value: u.swatch },
    rgZones: { value: u.zones },
    rgHue: { value: u.hue },
    rgSat: { value: u.sat },
    rgVal: { value: u.val },
    rgRef: { value: u.ref },
    rgShade: { value: u.shade },
    ...(weighed ? { rgLower: { value: u.lower }, rgUpper: { value: u.upper } } : {}),
  };
  const before = material.onBeforeCompile;
  const keyBefore = material.customProgramCacheKey;
  material.onBeforeCompile = (s, r) => {
    before?.call(material, s, r);
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader.replace('void main() {', weighed ? `attribute float zone;\nattribute float lower;\nattribute float upper;\n${zoneVarying}\nvoid main() {\nvZone = zone;\nvLower = lower;\nvUpper = upper;` : `attribute float zone;\n${zoneVarying}\nvoid main() {\nvZone = zone;`);
    s.fragmentShader = s.fragmentShader.replace('void main() {', `${zoneVarying}${DECLARE}${weighed ? `\nuniform vec2 rgLower[${N}];\nuniform vec2 rgUpper[${N}];` : ''}\nvoid main() {`).replace('#include <map_fragment>', `#include <map_fragment>\n${recolorChunk}`);
  };
  material.customProgramCacheKey = () => `${keyBefore.call(material)}|regions-${bodyId}`;
  material.userData.regions = {
    uniforms,
    set(next) {
      const v = regionUniforms(bodyId, next);
      uniforms.rgOn.value = v.on;
      uniforms.rgSwatch.value = v.swatch;
    },
  };
  material.needsUpdate = true;
  return material;
}

// A material's copy that keeps what's been done to its shaders (its rim of
// light, a shirt's colour): Material.clone() leaves those behind.
export function cloneShaded(material) {
  const m = material.clone();
  m.onBeforeCompile = material.onBeforeCompile;
  m.customProgramCacheKey = material.customProgramCacheKey;
  // (and the marks that say what's in them, which a copy leaves behind:
  // lib/three/house.js and core.js would put theirs on it a second time)
  for (const k of ['house', 'core']) if (material.userData[k]) Object.defineProperty(m.userData, k, { value: material.userData[k], enumerable: false, configurable: true });
  return m;
}

// A look's colours on a figure from createMeshyCast().make() (dressCore's)
export const dressColors = dressColorsWith({ recolor, cloneShaded });

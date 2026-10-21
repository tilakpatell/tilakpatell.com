// The deep-space wonders' shaders (deepspace.js builds the wonders with
// them): the GLSL every one shares, and each wonder's own vertex and fragment
// shaders. Strings only, kept apart so the builder stays readable.

import { SWIRL_GLSL } from '../rickmorty/swirl';
import { NOISE_GLSL } from './sun';

// ── GLSL shared by the shaders ──

export const COMMON = `
float sat(float x) { return clamp(x, 0.0, 1.0); }
vec3 nrm(vec3 v) { float l = length(v); return l > 1e-6 ? v / l : vec3(0.0, 1.0, 0.0); }
float hash12(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
// relief from a height, by how it changes across the screen (no tangents needed)
vec3 bumped(vec3 n, vec3 pos, float h) {
  vec3 sx = dFdx(pos);
  vec3 sy = dFdy(pos);
  vec3 r1 = cross(sy, n);
  vec3 r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  vec3 b = abs(det) * n - grad;
  float l = length(b);
  return l > 1e-20 ? b / l : n;
}
// an equirectangular lookup that doesn't seam where the longitude wraps
vec4 globe(sampler2D map, vec3 p) {
  vec2 uv = vec2(atan(p.z, p.x + 1e-7) * 0.15915494 + 0.5, asin(clamp(p.y, -1.0, 1.0)) * 0.31830989 + 0.5);
  vec2 gx = dFdx(uv);
  vec2 gy = dFdy(uv);
  gx.x -= floor(gx.x + 0.5);
  gy.x -= floor(gy.x + 0.5);
  return textureGrad(map, uv, gx, gy);
}`;

// a quad that always faces the camera, `position` its offset in world units
// (the mesh's turn is ignored); vC is that offset in its radii, vSil how much
// wider than its radius a sphere of that radius looks on the quad's plane
// (from close in you see less than half of it), vDist how far off it is
export const BILLBOARD_VERT = `
uniform float uR;
varying vec2 vC;
varying float vSil;
varying float vDist;
void main() {
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float d = length(mv.xyz);
  vDist = d;
  vSil = d > uR * 1.02 ? d / sqrt(d * d - uR * uR) : 5.0;
  vC = position.xy / uR;
  mv.xy += position.xy;
  gl_Position = projectionMatrix * mv;
}`;

// ── Planets: one shader, a look per kind ──

export const WORLD_VERT = `
varying vec3 vObj;
varying vec3 vW;
varying vec3 vNW;
varying vec3 vCentre;
varying vec3 vAxis;
void main() {
  vObj = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vNW = mat3(modelMatrix) * normal;
  vCentre = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vAxis = mat3(modelMatrix) * vec3(0.0, 1.0, 0.0);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const WORLD_FRAG = `
uniform float uTime;
uniform vec3 uLight;
uniform vec3 uLightColor;
uniform vec3 uRim;
uniform float uRimStrength;
uniform vec3 uDusk;
uniform vec3 uBase;
uniform vec3 uAccent;
uniform sampler2D uBands;
uniform sampler2D uTex;
uniform vec4 uStorm;
uniform float uTurb;
uniform float uOval;
uniform float uSeed;
uniform float uRadius;
uniform vec2 uRingSpan;
uniform sampler2D uRingTex;
varying vec3 vObj;
varying vec3 vW;
varying vec3 vNW;
varying vec3 vCentre;
varying vec3 vAxis;
${COMMON}
${NOISE_GLSL}
void main() {
  vec3 p = nrm(vObj);
  vec3 N = nrm(vNW);
  vec3 V = nrm(cameraPosition - vW);
  vec3 L = nrm(uLight - vW);
  vec3 albedo = uBase;
  float limb = 0.0;
  float gloss = 0.0;
#if defined(GAS)
  float tt = uTime * 0.004;
  // the storm: the bands round it are turned, more toward its middle, so
  // they curl round it (only the turn is added, so outside it nothing moves)
  vec3 S = uStorm.xyz;
  vec3 east = nrm(cross(vec3(0.0, 1.0, 0.0), S));
  vec3 north = cross(S, east);
  vec3 d = p - S;
  vec2 st0 = vec2(dot(d, east), dot(d, north));
  vec2 st = st0 / uStorm.w * vec2(1.0, 1.9);
  float sd = length(st);
  float inStorm = (1.0 - smoothstep(0.55, 1.3, sd)) * step(0.0, dot(p, S));
  float twist = inStorm * inStorm * 3.2;
  float cs = cos(twist);
  float sn = sin(twist);
  vec2 sr = vec2(cs * st.x - sn * st.y, sn * st.x + cs * st.y) * uStorm.w / vec2(1.0, 1.9);
  vec3 q = p + east * (sr.x - st0.x) + north * (sr.y - st0.y);
  // each latitude's colour, pushed up and down by turbulence drawn out along the bands
  float n1 = snoise(vec3(q.x * 2.0, q.y * 8.0, q.z * 2.0) + vec3(uSeed, 0.0, tt));
  float n2 = snoise(vec3(q.x * 4.5, q.y * 30.0, q.z * 4.5) + vec3(tt * 2.0, uSeed, 0.0) + n1 * 0.5);
  float n3 = snoise(vec3(q.x * 11.0, q.y * 80.0, q.z * 11.0) - vec3(uSeed) + n2 * 0.3);
  float y = q.y + n1 * uTurb * 0.7 + n2 * uTurb * 0.45 + n3 * uTurb * 0.22;
  albedo = texture2D(uBands, vec2(0.5, sat(y * 0.5 + 0.5))).rgb;
  float grain = uTurb * 25.0;
  albedo *= 1.0 + (0.08 * n2 + 0.09 * n3) * grain;
  // a chain of small white ovals along one band, carried round with it
  float lon = atan(q.z, q.x + 1e-6) * 1.9099;
  float cellX = fract(lon) - 0.5;
  float oy = (q.y - uOval) / 0.024;
  float oval = (1.0 - smoothstep(0.5, 1.0, length(vec2(cellX * 5.5, oy * 1.15)))) * step(0.45, hash12(vec2(floor(lon), uSeed)));
  albedo = mix(albedo, vec3(0.93, 0.9, 0.84), oval * step(0.001, abs(uOval)) * 0.6);
  // the storm's own colour, an oval with a paler collar
  float core = inStorm * (1.0 - smoothstep(0.2, 0.85, sd));
  float collar = inStorm * smoothstep(0.6, 0.9, sd) * (1.0 - smoothstep(0.9, 1.25, sd));
  albedo = mix(albedo, uAccent * (0.8 + 0.35 * n2), core * 0.9);
  albedo = mix(albedo, mix(albedo, vec3(0.96, 0.9, 0.8), 0.6), collar * 0.75);
  limb = 0.45;
#ifdef ICE
  // haze over it all, thicker toward the edge, and high bright clouds
  albedo = mix(albedo, uBase, 0.28 + 0.4 * (1.0 - sat(dot(N, V))));
  float cloud = smoothstep(0.5, 0.85, n2 * 0.7 + n1 * 0.45) * (1.0 - smoothstep(0.08, 0.3, abs(q.y - S.y * 0.94)));
  albedo += vec3(0.55, 0.6, 0.64) * cloud * 0.55;
  limb = 0.3;
#endif
#elif defined(ROCK)
  vec4 tx = globe(uTex, p);
  float n1 = snoise(p * 2.6 + uSeed);
  float n2 = snoise(p * 9.0 - uSeed);
  albedo = uBase * (0.8 + 0.2 * n1 + 0.08 * n2) * mix(1.0, 0.62, tx.g) * (0.7 + 0.55 * tx.r);
  albedo = mix(albedo, uAccent, smoothstep(0.3, 0.8, n1) * 0.35);
  N = bumped(N, vW, tx.r * uRadius * 0.07);
  limb = 0.12;
#elif defined(OCEAN)
  float c1 = snoise(p * 1.6 + uSeed);
  float c2 = snoise(p * 4.4 - uSeed + c1 * 0.3);
  float c3 = snoise(p * 13.0 + uSeed * 2.0);
  float landN = c1 * 0.66 + c2 * 0.26 + c3 * 0.08;
  float land = smoothstep(0.12, 0.145, landN);
  float shallow = smoothstep(-0.04, 0.12, landN) * (1.0 - land);
  float ice = smoothstep(0.8, 0.9, abs(p.y) + c2 * 0.05);
  vec3 sea = mix(uBase * 0.3, uBase * 0.8, shallow);
  vec3 ground = mix(uAccent, uAccent * vec3(0.55, 0.75, 0.5), smoothstep(-0.4, 0.4, c2 + c3 * 0.4));
  ground *= 0.85 + 0.3 * smoothstep(0.15, 0.5, landN);
  albedo = mix(sea, ground, land);
  albedo = mix(albedo, vec3(0.88, 0.92, 0.96), ice);
  float cl = snoise(vec3(p.x * 3.2, p.y * 9.0, p.z * 3.2) + vec3(uTime * 0.008, uSeed, c2 * 0.4));
  float cloud = smoothstep(0.25, 0.85, cl * 0.62 + c3 * 0.25 + c1 * 0.2);
  albedo = mix(albedo, vec3(0.9), cloud * 0.8);
  gloss = (1.0 - land) * (1.0 - cloud) * (1.0 - ice) * 0.35;
  limb = 0.2;
#endif
  float ndl = dot(N, L);
  float mu = sat(dot(N, V));
  // a soft terminator, reddened as the light grazes it
  float wrap = smoothstep(-0.22, 0.32, ndl);
  float light = wrap * (0.16 + 0.84 * max(ndl, 0.0));
  vec3 tint = mix(uDusk, vec3(1.0), smoothstep(-0.05, 0.45, ndl));
  vec3 col = albedo * uLightColor * light * tint;
  col *= 1.0 - limb + limb * sqrt(mu);
  col += albedo * 0.0035;
  if (gloss > 0.0) {
    vec3 H = nrm(L + V);
    float sp = sat(dot(N, H));
    sp *= sp;
    sp *= sp;
    sp *= sp;
    sp *= sp;
    sp *= sp;
    col += uLightColor * sp * gloss * smoothstep(0.0, 0.2, ndl);
  }
#ifdef RING_SHADOW
  // the ring's shadow: where the way to the light crosses the ring's plane
  vec3 axis = nrm(vAxis);
  float facing = dot(L, axis);
  if (abs(facing) > 1e-3) {
    float tHit = -dot(vW - vCentre, axis) / facing;
    if (tHit > 0.0) {
      float rr = length(vW + L * tHit - vCentre) / uRadius;
      float u = (rr - uRingSpan.x) / (uRingSpan.y - uRingSpan.x);
      if (u > 0.0 && u < 1.0) col *= 1.0 - textureLod(uRingTex, vec2(u, 0.5), 0.0).a * 0.8;
    }
  }
#endif
  float rim = 1.0 - mu;
  rim = rim * rim * rim;
  col += uRim * rim * uRimStrength * smoothstep(-0.35, 0.55, ndl);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

// the air round a planet: the back of a slightly bigger sphere, glowing by
// how close to the planet's edge each ray passes, on its lit side
export const HALO_VERT = `
varying vec3 vW;
varying vec3 vCentre;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vCentre = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
export const HALO_FRAG = `
uniform vec3 uColor;
uniform vec3 uLight;
uniform float uReach;
uniform float uRadius;
uniform float uStrength;
varying vec3 vW;
varying vec3 vCentre;
${COMMON}
void main() {
  vec3 ray = nrm(vW - cameraPosition);
  vec3 oc = vCentre - cameraPosition;
  float along = dot(oc, ray);
  float closest = along > 0.0 ? sqrt(max(dot(oc, oc) - along * along, 0.0)) : length(oc);
  float x = sat((closest / uRadius - 1.0) / (uReach - 1.0));
  vec3 at = along > 0.0 ? cameraPosition + ray * along : cameraPosition;
  float lit = 0.08 + 0.92 * smoothstep(-0.4, 0.5, dot(nrm(at - vCentre), nrm(uLight - vCentre)));
  float k = 1.0 - x;
  gl_FragColor = vec4(uColor * k * k * k * uStrength * lit, 1.0);
  #include <colorspace_fragment>
}`;

// a planet's ring, flat in its plane: ringlets from a profile, lit on its
// sunward face and glowing through its thin parts from behind, with the
// planet's shadow across it
export const RING_VERT = `
varying vec3 vLocal;
varying vec3 vW;
varying vec3 vCentre;
varying vec3 vN;
void main() {
  vLocal = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vCentre = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vN = mat3(modelMatrix) * vec3(0.0, 1.0, 0.0);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
export const RING_FRAG = `
uniform sampler2D uRing;
uniform vec3 uLight;
uniform vec3 uLightColor;
uniform float uInner;
uniform float uOuter;
uniform float uRadius;
uniform float uOpacity;
varying vec3 vLocal;
varying vec3 vW;
varying vec3 vCentre;
varying vec3 vN;
${COMMON}
void main() {
  float rho = length(vLocal.xz);
  float u = (rho - uInner) / (uOuter - uInner);
  if (u < 0.0 || u > 1.0) discard;
  vec4 band = texture2D(uRing, vec2(u, 0.5));
  vec3 P = vW - vCentre;
  vec3 L = nrm(uLight - vW);
  vec3 V = nrm(cameraPosition - vW);
  vec3 n = nrm(vN);
  // the planet's shadow: does the way to the light pass through it?
  float b = dot(P, L);
  float dc = sqrt(max(dot(P, P) - b * b, 0.0));
  float shadow = b < 0.0 ? smoothstep(uRadius * 0.98, uRadius * 1.04, dc) : 1.0;
  float sl = dot(n, L);
  float sv = dot(n, V);
  float sun = 0.3 + 0.7 * sqrt(abs(sl));
  // seen from its dark face, light comes through where it's thin
  float lit = sl * sv >= 0.0 ? 1.0 : 0.25 + 0.75 * (1.0 - band.a);
  vec3 col = band.rgb * uLightColor * sun * lit * (0.05 + 0.95 * shadow);
  gl_FragColor = vec4(col, band.a * uOpacity);
  #include <colorspace_fragment>
}`;

// ── Stars ──

export const STAR_FRAG = `
uniform float uTime;
uniform vec3 uColor;
uniform float uSeed;
varying vec3 vObj;
varying vec3 vW;
varying vec3 vNW;
varying vec3 vCentre;
varying vec3 vAxis;
${COMMON}
${NOISE_GLSL}
void main() {
  vec3 p = nrm(vObj) * 2.4;
  float t = uTime * 0.05;
  float w = snoise(p * 0.9 + vec3(uSeed, t, 0.0));
  vec3 q = p + vec3(w, -w, w * 0.5) * 0.22;
  float cells = snoise(q * 3.0 + t * 1.3);
  // the granules, fine as rice: gone where they'd be smaller than a pixel
  float gran = snoise(q * 17.0 - t * 4.0) * (1.0 - smoothstep(0.35, 0.9, length(fwidth(q)) * 17.0));
  // granules: bright cells in its own colour with dark lanes between them,
  // kept near 1 so the colour survives the tone map close up, and hot spots
  // where it boils over (they bloom); darker and redder toward the edge
  float mu = sat(dot(nrm(vNW), nrm(cameraPosition - vW)));
  float heat = sat(0.2 + 0.4 * (0.5 + 0.5 * cells) + 0.45 * smoothstep(-0.45, 0.55, gran));
  vec3 lanes = uColor * vec3(0.8, 0.55, 0.5) * 0.4;
  // (a warm star's granules run toward yellow, a blue one's toward white)
  vec3 toward = mix(vec3(1.0, 0.97, 0.95), vec3(1.0, 0.75, 0.4), step(uColor.b, uColor.r));
  vec3 granules = mix(uColor, toward, 0.3) * 1.15;
  vec3 hot = mix(uColor, vec3(1.0, 0.95, 0.85), 0.6) * 2.6;
  vec3 col = mix(lanes, granules, heat);
  col = mix(col, hot, smoothstep(0.6, 1.05, cells + gran * 0.3) * 0.55);
  col *= 0.82 + 0.3 * (w * 0.5 + 0.5);
  col *= 0.45 + 0.55 * sqrt(mu);
  col *= mix(vec3(1.0, 0.62, 0.45), vec3(1.0), smoothstep(0.0, 0.55, mu));
  // from far off it burns brighter, so the whole disc blooms
  float far = smoothstep(600.0, 3500.0, length(cameraPosition - vW));
  col *= 1.0 + 1.3 * far;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

// the corona close in (streamers that slowly turn and change) and a wide
// glow, stronger from further off
export const GLOW_FRAG = `
uniform float uTime;
uniform vec3 uColor;
uniform float uSeed;
uniform float uReach;
varying vec2 vC;
varying float vSil;
varying float vDist;
${COMMON}
${NOISE_GLSL}
void main() {
  float l = length(vC);
  float r = l / vSil;
  float d = max(r - 1.0, 0.0);
  float corona = 0.0;
  if (r > 0.9 && d < 3.0) {
    vec2 ring = vC / max(l, 1e-4);
    float rays = snoise(vec3(ring * 1.3, uTime * 0.04 + uSeed)) * 0.65 + snoise(vec3(ring * 3.2, uTime * 0.07 + uSeed + 3.0)) * 0.35;
    float inner = exp(-d * 7.0);
    float outer = exp(-d * (2.8 - 1.0 * sat(rays)));
    corona = inner * 1.15 + outer * (0.2 + 0.45 * smoothstep(-0.1, 0.8, rays));
    corona *= 1.0 - smoothstep(2.2, 3.0, d);
  }
  float far = smoothstep(750.0, 4500.0, vDist);
  float halo = (0.05 + 0.16 * far) / (1.0 + d * d * (0.9 - 0.6 * far)) + exp(-d * 0.9) * 0.12;
  halo *= 1.0 - smoothstep(uReach * 0.55, uReach, r);
  vec3 white = mix(uColor, vec3(1.0, 0.94, 0.86), 0.5);
  vec3 col = mix(uColor, white, exp(-d * 6.0)) * corona * 1.9 + uColor * halo;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

// ── The black hole ──

// the thin ring of light at the shadow's edge, and the far side of the disk
// bent round the shadow: over the top where the disk tips away, a fainter
// arc under the bottom, a whole ring when you look down on the disk; the
// side of the disk coming toward you brighter
export const PHOTON_VERT = `
uniform float uR;
uniform vec3 uDiskN;
varying vec2 vC;
varying float vSil;
varying vec2 vUp;
varying vec2 vSide;
varying float vIncl;
vec3 nrm(vec3 v) { float l = length(v); return l > 1e-6 ? v / l : vec3(0.0, 1.0, 0.0); }
void main() {
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float d = length(mv.xyz);
  vSil = d > uR * 1.02 ? d / sqrt(d * d - uR * uR) : 5.0;
  vec3 n = nrm(mat3(modelViewMatrix) * uDiskN);
  vIncl = abs(n.z);
  float ln = length(n.xy);
  vUp = (ln > 1e-4 ? n.xy / ln : vec2(0.0, 1.0)) * (n.z >= 0.0 ? 1.0 : -1.0);
  vec3 m = cross(n, vec3(0.0, 0.0, 1.0));
  float lm = length(m);
  vec2 side = lm > 1e-4 ? m.xy / lm : vec2(1.0, 0.0);
  vSide = side * (cross(n, m).z > 0.0 ? 1.0 : -1.0);
  vC = position.xy / uR;
  mv.xy += position.xy;
  gl_Position = projectionMatrix * mv;
}`;
export const PHOTON_FRAG = `
uniform float uTime;
uniform float uReach;
varying vec2 vC;
varying float vSil;
varying vec2 vUp;
varying vec2 vSide;
varying float vIncl;
${COMMON}
${NOISE_GLSL}
void main() {
  float l = length(vC);
  float r = l / vSil;
  if (r < 0.98) discard;
  vec2 dir = vC / max(l, 1e-4);
  float edgeOn = 1.0 - vIncl;
  float beam = 1.0 + 0.6 * dot(dir, vSide) * edgeOn;
  // the photon ring
  float pr = exp(-abs(r - 1.022) * 90.0) * 1.35 + exp(-max(r - 1.0, 0.0) * 18.0) * 0.12;
  // the bent image of the disk's far side
  float s = dot(dir, vUp);
  float top = mix(0.55, smoothstep(-0.3, 0.95, s), edgeOn);
  float bottom = mix(0.55, smoothstep(-0.3, 0.95, -s) * 0.5, edgeOn);
  float spread = 0.1 + 0.42 * edgeOn * max(s, 0.0) * max(s, 0.0) + 0.12 * vIncl;
  float arcT = smoothstep(1.04, 1.09, r) * (1.0 - smoothstep(1.08 + spread * 0.55, 1.1 + spread, r)) * top;
  float arcB = smoothstep(1.04, 1.08, r) * (1.0 - smoothstep(1.09, 1.16, r)) * bottom;
  // streaks round it, as the disk has
  float n = snoise(vec3(dir * 1.6, r * 16.0 - uTime * 0.3)) * 0.5 + 0.5;
  float arcs = (arcT + arcB) * (0.5 + 0.75 * n);
  vec3 hot = vec3(1.0, 0.86, 0.66);
  vec3 warm = vec3(1.0, 0.42, 0.13);
  vec3 col = mix(hot, warm, smoothstep(1.06, 1.5, r)) * arcs * 0.95 * beam * beam;
  col += vec3(1.0, 0.9, 0.76) * pr * (0.75 + 0.35 * beam);
  col *= 1.0 - smoothstep(uReach * 0.7, uReach, r);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export const DISK_VERT = RING_VERT;
export const DISK_FRAG = `
uniform float uTime;
uniform float uInner;
uniform float uOuter;
varying vec3 vLocal;
varying vec3 vW;
varying vec3 vCentre;
varying vec3 vN;
${COMMON}
${NOISE_GLSL}
vec2 turn(vec2 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}
float streaks(vec2 dir, float rho, float seed) {
  return snoise(vec3(dir * 1.7, rho * 0.11 + seed)) * 0.6 + snoise(vec3(dir * 4.5, rho * 0.42 + seed)) * 0.4;
}
void main() {
  vec2 p = vLocal.xz;
  float rho = length(p);
  float u = (rho - uInner) / (uOuter - uInner);
  if (u < 0.0 || u > 1.0) discard;
  vec2 dir = p / rho;
  // the inner parts go round faster (as the planets do round a sun); two
  // layers, each starting over before it winds up too tight, the one
  // fading in as the other fades out
  float omega = 0.22 * pow(uInner / rho, 1.5);
  float ph = uTime / 18.0;
  float fa = fract(ph);
  float fb = fract(ph + 0.5);
  float wa = 1.0 - abs(2.0 * fa - 1.0);
  float n = mix(streaks(turn(dir, omega * fb * 18.0), rho, 7.3), streaks(turn(dir, omega * fa * 18.0), rho, 0.0), wa);
  float heat = 1.0 - u;
  float h2 = heat * heat;
  vec3 col = mix(vec3(0.85, 0.16, 0.05), vec3(1.0, 0.5, 0.16), smoothstep(0.0, 0.45, heat));
  col = mix(col, vec3(1.0, 0.86, 0.66), smoothstep(0.5, 0.85, heat));
  col = mix(col, vec3(0.82, 0.9, 1.0), smoothstep(0.86, 1.0, heat));
  float bright = 0.05 + 0.3 * h2 + 0.65 * h2 * h2 * h2;
  float dens = 0.3 + 0.9 * smoothstep(-0.6, 0.7, n);
  // brighter, and bluer, where it comes toward you
  vec3 nd = nrm(vN);
  vec3 V = nrm(cameraPosition - vW);
  vec3 vel = nrm(cross(nd, vW - vCentre));
  float g = 1.0 + 0.45 * dot(vel, V);
  float beam = g * g;
  col = mix(col * vec3(1.15, 0.78, 0.6), col * vec3(0.82, 0.95, 1.2), smoothstep(0.6, 1.4, g));
  // thin, so brighter seen edge-on (more of it along the line of sight)
  float graze = min(1.0 / max(abs(dot(nd, V)), 0.15), 3.0);
  float edge = smoothstep(0.0, 0.035, u) * (1.0 - smoothstep(0.5, 1.0, u));
  gl_FragColor = vec4(col * bright * dens * beam * edge * mix(1.0, graze, 0.3), 1.0);
  #include <colorspace_fragment>
}`;

export const JET_VERT = `
uniform float uBase;
uniform float uLen;
varying float vAlong;
varying vec3 vW;
varying vec3 vNW;
varying vec2 vXZ;
varying vec3 vCentre;
void main() {
  vAlong = (abs(position.y) - uBase) / uLen;
  vXZ = position.xz * sign(position.y);
  vCentre = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vNW = mat3(modelMatrix) * normal;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
export const JET_FRAG = `
uniform float uTime;
uniform float uShadow;
varying float vAlong;
varying vec3 vW;
varying vec3 vNW;
varying vec2 vXZ;
varying vec3 vCentre;
${COMMON}
${NOISE_GLSL}
void main() {
  // kept off the shadow, wherever it lies across it (the shadow stays black)
  vec3 ray = nrm(vW - cameraPosition);
  vec3 oc = vCentre - cameraPosition;
  float along = dot(oc, ray);
  float miss = sqrt(max(dot(oc, oc) - along * along, 0.0));
  float clear = smoothstep(uShadow * 1.05, uShadow * 1.8, miss);
  float facing = abs(dot(nrm(vNW), nrm(cameraPosition - vW)));
  float core = facing * facing;
  float n = snoise(vec3(vXZ * 0.18, vAlong * 7.0 - uTime * 0.9)) * 0.5 + 0.5;
  float fade = (1.0 - smoothstep(0.05, 1.0, vAlong)) * smoothstep(0.0, 0.06, vAlong);
  vec3 col = mix(vec3(0.7, 0.85, 1.9), vec3(0.35, 0.3, 1.1), sat(vAlong * 1.4));
  gl_FragColor = vec4(col * core * fade * clear * (0.45 + 0.8 * n) * 0.04, 1.0);
  #include <colorspace_fragment>
}`;

// ── The Death Star ──

export const CITADEL_VERT = `
attribute float aPart;
varying vec3 vObj;
varying vec3 vW;
varying vec3 vNW;
varying float vPart;
void main() {
  vObj = position;
  vPart = aPart;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vNW = mat3(modelMatrix) * normal;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
// The Citadel as the show draws it: bronze hulls, olive ribs, a city in
// pale greens under the glass, cyan light strips, purple running lights and
// blinking beacons. Parts (aPart): 0 hull, 1 ribs and trim, 2 beacons,
// 3 cyan strips, 4 the city's towers, 5 purple lights, 6 the crystal.
export const CITADEL_FRAG = `
uniform vec3 uLight;
uniform vec3 uLightColor;
uniform float uTime;
uniform float uK; // its size, against the radius of 18 its profile is drawn for
varying vec3 vObj;
varying vec3 vW;
varying vec3 vNW;
varying float vPart;
${COMMON}
void main() {
  vec3 N = nrm(vNW);
  vec3 V = nrm(cameraPosition - vW);
  vec3 L = nrm(uLight - vW);
  vec3 p = vObj / max(uK, 1e-3); // (its patterns are drawn at a radius of 18)
  float part = floor(vPart + 0.5);
  float ndl = dot(N, L);
  // the show's flat light: two steps and a dark side that isn't black
  float light = mix(0.32, 1.0, smoothstep(0.0, 0.25, ndl)) * mix(0.82, 1.0, smoothstep(0.45, 0.6, ndl));
  if (part > 5.5) {
    // the crystal under it all: cyan, brightest at its edges
    float f = pow(1.0 - abs(dot(N, V)), 2.0);
    gl_FragColor = vec4(vec3(0.25, 0.95, 1.0) * (0.9 + f * 1.8 + 0.25 * sin(p.y * 1.4 - uTime * 2.0)), 1.0);
    #include <colorspace_fragment>
    return;
  }
  if (part > 4.5) {
    gl_FragColor = vec4(vec3(0.85, 0.45, 1.6) * (0.8 + 0.4 * sin(uTime * 3.0 + p.x)), 1.0);
    #include <colorspace_fragment>
    return;
  }
  if (part > 2.5 && part < 3.5) {
    float run = 0.75 + 0.25 * sin(p.y * 2.2 + p.x * 0.7 - uTime * 2.4);
    gl_FragColor = vec4(vec3(0.3, 1.0, 0.95) * 1.7 * run, 1.0);
    #include <colorspace_fragment>
    return;
  }
  if (part > 1.5 && part < 2.5) {
    // the beacons, blinking each on its own beat
    float beat = hash12(floor(p.xz * 3.0) + 0.5);
    float on = step(0.72, fract(uTime * 0.7 + beat));
    gl_FragColor = vec4(mix(vec3(0.5, 0.06, 0.04), vec3(4.0, 0.55, 0.35), on), 1.0);
    #include <colorspace_fragment>
    return;
  }
  vec3 albedo;
  vec3 glow = vec3(0.0);
  if (part > 3.5) {
    // a tower of the city: pale green, yellow-green or teal, rows of windows
    float id = hash12(floor(p.xz * 1.3) + 7.0);
    albedo = mix(vec3(0.68, 0.82, 0.55), vec3(0.5, 0.74, 0.7), step(0.55, id));
    albedo = mix(albedo, vec3(0.86, 0.84, 0.5), step(0.85, id));
    vec2 wc = vec2((p.x + p.z) * 5.0, p.y * 6.0);
    vec2 wf = fract(wc);
    float tiny = smoothstep(0.3, 0.8, max(fwidth(wc).x, fwidth(wc).y));
    float win = mix(step(0.25, wf.x) * step(wf.x, 0.75) * step(0.3, wf.y) * step(wf.y, 0.7) * step(0.45, hash12(floor(wc) + 3.0)), 0.25, tiny);
    glow = mix(vec3(1.0, 0.85, 0.5), vec3(0.5, 1.0, 0.9), step(0.6, hash12(floor(wc)))) * win * 0.9 * (1.0 - step(0.6, abs(N.y)));
  } else if (part > 0.5) {
    albedo = vec3(0.46, 0.4, 0.2);
  } else {
    // bronze plating, a tone a panel, dark seams between
    vec3 q = p * vec3(0.9, 1.6, 0.9);
    vec3 cell = floor(q);
    vec3 f = fract(q);
    vec3 w = fwidth(q);
    float seam = 1.0 - smoothstep(0.0, 1.5, min(min(min(f.x, 1.0 - f.x) / max(w.x, 1e-4), min(f.y, 1.0 - f.y) / max(w.y, 1e-4)), min(f.z, 1.0 - f.z) / max(w.z, 1e-4)));
    seam *= 1.0 - smoothstep(0.3, 0.6, max(w.x, max(w.y, w.z)));
    float tone = 0.86 + 0.18 * hash12(cell.xz + cell.y * 3.1);
    albedo = mix(vec3(0.66, 0.5, 0.28), vec3(0.55, 0.47, 0.3), step(0.6, hash12(cell.yz + 1.3))) * tone * (1.0 - 0.35 * seam);
    // small windows, lit
    vec2 wc = vec2(atan(p.z, p.x + 1e-6) * length(p.xz) / 0.4, p.y / 0.5);
    vec2 wf = fract(wc);
    float tiny = smoothstep(0.25, 0.65, max(fwidth(wc).x, fwidth(wc).y));
    float win = mix(step(0.3, wf.x) * step(wf.x, 0.7) * step(0.35, wf.y) * step(wf.y, 0.65) * step(0.62, hash12(floor(wc) + 11.0)), 0.12, tiny) * (1.0 - step(0.7, abs(N.y)));
    glow = mix(vec3(1.0, 0.82, 0.5), vec3(0.45, 1.0, 0.95), step(0.6, hash12(floor(wc) + 4.0))) * win * 1.2;
  }
  vec3 col = albedo * uLightColor * light * 0.62 + albedo * vec3(0.05, 0.045, 0.035) + glow;
  // a warm rim where it turns from the light
  col += vec3(1.0, 0.7, 0.35) * pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.18 * step(0.0, ndl);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
// the domes' glass: yellow-green, clear face on, bright at the edges, with
// the home sun's glint
export const CITADEL_GLASS_FRAG = `
uniform vec3 uLight;
uniform vec3 uLightColor;
uniform float uTime;
uniform float uK;
varying vec3 vObj;
varying vec3 vW;
varying vec3 vNW;
varying float vPart;
${COMMON}
void main() {
  vec3 N = nrm(vNW);
  vec3 V = nrm(cameraPosition - vW);
  vec3 L = nrm(uLight - vW);
  float f = pow(1.0 - abs(dot(N, V)), 2.2);
  vec3 H = nrm(L + V);
  float sp = pow(sat(dot(N, H)), 60.0);
  // the dome's panes: a faint diamond lattice
  vec2 g = vec2(atan(vObj.z, vObj.x) * 9.0, vObj.y / max(uK, 1e-3) * 2.2);
  vec2 gf = abs(fract(g) - 0.5);
  float lattice = (1.0 - smoothstep(0.0, 0.06, min(gf.x, gf.y))) * (1.0 - smoothstep(0.3, 0.8, max(fwidth(g).x, fwidth(g).y)));
  // lit like the rest: the side to the sun glows yellow-green, the far side
  // stays dim, so the city reads through it
  float lit = mix(0.25, 1.0, smoothstep(-0.1, 0.4, dot(N, L)));
  vec3 tint = vec3(0.8, 0.92, 0.4);
  float a = 0.3 + f * 0.5 + lattice * 0.2;
  vec3 col = tint * (0.3 + f * 0.9) * lit * a + uLightColor * sp * 0.6;
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;

export const PORTAL_FRAG = `
uniform float uTime;
varying vec2 vUv;
${SWIRL_GLSL}
void main() {
  vec2 o = (vUv * 2.0 - 1.0) * 1.35 + vec2(1.3e-5, 0.7e-5);
  vec4 c = portal(o, uTime, 1.0, 3.7);
  gl_FragColor = vec4(c.rgb * 1.7, c.a);
  #include <colorspace_fragment>
}`;

// ── The names ──

export const LABEL_VERT = `
attribute vec3 aAt;
attribute float aRow;
attribute float aAlpha;
uniform float uSize;
uniform float uRatio;
uniform float uRows;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  vUv = vec2(uv.x, 1.0 - (aRow + 1.0 - uv.y) / uRows);
  if (aAlpha < 0.003) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(aAt, 1.0);
  float aspect = projectionMatrix[0][0] / projectionMatrix[1][1];
  clip.xy += vec2(position.x * uSize * uRatio * aspect, position.y * uSize) * clip.w;
  gl_Position = clip;
}`;
export const LABEL_FRAG = `
uniform sampler2D uMap;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vec4 c = texture2D(uMap, vUv);
  gl_FragColor = vec4(c.rgb, c.a * vAlpha);
  #include <colorspace_fragment>
}`;

// ── Background galaxies ──

export const SKY_VERT = `
attribute vec3 color;
varying vec2 vUv;
varying vec3 vColor;
void main() {
  vUv = uv;
  vColor = color;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
export const SKY_FRAG = `
uniform sampler2D uMap;
varying vec2 vUv;
varying vec3 vColor;
void main() {
  vec4 c = texture2D(uMap, vUv);
  gl_FragColor = vec4(c.rgb * c.a * vColor, 1.0);
  #include <colorspace_fragment>
}`;

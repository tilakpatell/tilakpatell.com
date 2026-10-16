// What the station’s windows show, on the node renderer (lane P1, the
// inside’s port by lane T’s method): each of scripts/twin-parity/originals/deathstar/sky.js’s shaders as
// TSL, with the same factories, flags, uniforms (uniform nodes under the
// GLSL names, which views.js writes through `.value`) and arithmetic, so
// the sky, the planets and the battle draw as they did. views.js’s header
// says what each is.
//
//   skyUniforms(sun: Vector3, colour: [r, g, b]) → { uOrigin, uSun, uSunColour }   uniform nodes
//   starsMesh(pos, colour, size, u, px) → Mesh   each star a quad `size` × px pixels across, as
//     gl_PointSize drew a point (a point on the node renderer is one pixel, whatever its size)
//   bandMaterial(u, pole) · sunMaterial(u, size) · flashMaterial()
//   bodyMaterial(u, { air, map, normal, rough, clouds, giant }) → material.uniforms.uDrift, uAir …
//   haloMaterial(u, { air, r })   air: the body’s uAir node, so the two share it
//   sunlit(material, u) → a node material lit by the view’s sun as one more direct light, out of
//     the house look (a classic one is copied into its node twin first)

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, attribute, cameraPosition, cameraProjectionMatrix, cameraViewMatrix, clamp, cross, dot, exp, float, floor, fract, length, max, mix, modelViewMatrix, modelWorldMatrix, normalGeometry, normalize, positionGeometry, pow, select, smoothstep, step, texture, uniform, uv, varyingProperty, vec2, vec3, vec4, viewportSize } from 'three/tsl';
import { asNode, instanceMatrixOf, wrap } from '../../../../../lib/three/hookNodes';

// GLSL’s smoothstep with its edges reversed (1 at a, down to 0 at b), as nodes
const fall = (a, b, x) => smoothstep(b, a, x).oneMinus();

// noiseGlsl’s hash13 and value noise (−1…1), seeded by uSeed, as nodes
// (lib/three/explosionsNodes has the same for the fireballs)
const hash13 = (p, seed) => {
  const q = fract(p.add(seed).mul(0.1031));
  const r = q.add(dot(q, q.zyx.add(31.32)));
  return fract(r.x.add(r.y).mul(r.z));
};
const noise = (x, seed) => {
  const i = floor(x);
  const w = fract(x);
  const f = w.mul(w).mul(w.mul(-2).add(3));
  const h = (a, b, c) => hash13(i.add(vec3(a, b, c)), seed);
  const lo = mix(mix(h(0, 0, 0), h(1, 0, 0), f.x), mix(h(0, 1, 0), h(1, 1, 0), f.x), f.y);
  const hi = mix(mix(h(0, 0, 1), h(1, 0, 1), f.x), mix(h(0, 1, 1), h(1, 1, 1), f.x), f.y);
  return mix(lo, hi, f.z).mul(2).sub(1);
};

// The sky pinned round the eye (it never shifts as you walk past a window)
// and put on the far plane, behind everything the room has drawn: a world
// point (w 1) to the clip space the GLSL’s farClip made.
const farClip = (u, world) => {
  const clip = cameraProjectionMatrix.mul(cameraViewMatrix.mul(vec4(world.xyz.add(cameraPosition).sub(u.uOrigin), 1)));
  return vec4(clip.xy, clip.w.mul(0.99999), clip.w);
};

// (a ShaderMaterial’s defaults: opaque, front faces, no fog, no light (a
// basic node material that took the scene’s lights, using none, would still
// be built again whenever the lamps change), tone-mapped; the node renderer
// tone-maps the whole frame at its end, as the bloom chain’s output pass
// does on the classic one)
const farMaterial = (u, params = {}) => {
  const m = new MeshBasicNodeMaterial({ lights: false, depthWrite: false, fog: false, ...params });
  m.uniforms = { uOrigin: u.uOrigin };
  return m;
};

export const skyUniforms = (sun, colour) => ({ uOrigin: uniform(new THREE.Vector3()), uSun: uniform(sun.clone()), uSunColour: uniform(new THREE.Color(...colour)) });

// ── the stars ──

export function starsMesh(pos, colour, size, u, px) {
  const geo = new THREE.InstancedBufferGeometry();
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  geo.setAttribute('aStar', new THREE.InstancedBufferAttribute(pos, 3));
  geo.setAttribute('aColour', new THREE.InstancedBufferAttribute(colour, 3));
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 1));
  geo.instanceCount = size.length;
  const uPx = uniform(px);
  const mat = farMaterial(u, { blending: THREE.AdditiveBlending, toneMapped: false });
  const vC = varyingProperty('vec3', 'vStarColour');
  const vP = varyingProperty('vec2', 'vStarCorner');
  mat.vertexNode = Fn(() => {
    vC.assign(attribute('aColour', 'vec3'));
    vP.assign(positionGeometry.xy);
    const clip = farClip(u, modelWorldMatrix.mul(vec4(attribute('aStar', 'vec3'), 1)));
    // (its corners `aSize × uPx` pixels apart on the screen, as gl_PointSize drew it)
    const off = positionGeometry.xy.mul(attribute('aSize', 'float').mul(uPx)).div(viewportSize).mul(clip.w);
    return vec4(clip.xy.add(off), clip.z, clip.w);
  })();
  const a = max(0, dot(vP, vP).oneMinus());
  mat.colorNode = vC.mul(a).mul(a);
  mat.uniforms.uPx = uPx;
  return new THREE.Mesh(geo, mat);
}

// ── the galaxy’s band and the sun ──

export function bandMaterial(u, pole) {
  const uPole = uniform(new THREE.Vector3(...pole));
  const uSeed = uniform(new THREE.Vector3(3, 7, 11));
  const m = farMaterial(u, { side: THREE.BackSide, blending: THREE.AdditiveBlending, toneMapped: false });
  const vDir = varyingProperty('vec3', 'vBandDir');
  m.vertexNode = Fn(() => {
    vDir.assign(positionGeometry);
    return farClip(u, modelWorldMatrix.mul(vec4(positionGeometry, 1)));
  })();
  const d = normalize(vDir);
  const lat = dot(d, uPole);
  const n = clamp(noise(d.mul(5), uSeed).mul(0.5).add(noise(d.mul(13), uSeed).mul(0.3)).add(0.5), 0, 1);
  const band = exp(lat.mul(lat).div(0.02).negate());
  // (the GLSL’s pow(x, 2.0), as its compilers make it, x × x: a pow of a
  // negative number is undefined, and WGSL’s is not a number)
  const x = lat.sub(0.012).div(0.03);
  const lane = exp(x.mul(x).negate()).mul(0.6).mul(smoothstep(0.35, 0.75, n)).oneMinus();
  const c = mix(vec3(0.5, 0.56, 0.8), vec3(0.95, 0.84, 0.68), smoothstep(0.3, 0.8, n));
  m.colorNode = c.mul(band).mul(lane).mul(n.mul(0.8).add(0.4)).mul(0.07);
  Object.assign(m.uniforms, { uPole, uSeed });
  return m;
}

export function sunMaterial(u, size) {
  const uSize = uniform(size);
  const m = farMaterial(u, { blending: THREE.AdditiveBlending, toneMapped: false });
  const vUv = varyingProperty('vec2', 'vSunUv');
  m.vertexNode = Fn(() => {
    vUv.assign(positionGeometry.xy);
    const w = modelWorldMatrix.mul(vec4(0, 0, 0, 1)).xyz.add(cameraPosition).sub(u.uOrigin);
    const mv = cameraViewMatrix.mul(vec4(w, 1));
    const clip = cameraProjectionMatrix.mul(vec4(mv.xy.add(positionGeometry.xy.mul(uSize)), mv.z, mv.w));
    return vec4(clip.xy, clip.w.mul(0.99999), clip.w);
  })();
  // a white disc half a degree across, hot enough to bloom, in a wide soft glow
  const d = length(vUv);
  const disc = fall(0.024, 0.018, d);
  const glow = exp(d.mul(d).mul(-30)).mul(0.7).add(exp(d.mul(-6)).mul(0.15));
  m.colorNode = vec3(1, 0.93, 0.8).mul(disc.mul(6).add(glow)).mul(fall(1, 0.7, d));
  m.uniforms.uSize = uSize;
  return m;
}

// ── the planets ──

// BODY_VERT: the sphere’s normal, and east and north on it the way its
// painted map runs (u east, v north), in the world; where its point and its
// middle are, pinned round the eye
function bodyVertex(m, u) {
  const vN = varyingProperty('vec3', 'vBodyN');
  const vT = varyingProperty('vec3', 'vBodyT');
  const vB = varyingProperty('vec3', 'vBodyB');
  const vW = varyingProperty('vec3', 'vBodyW');
  const vC = varyingProperty('vec3', 'vBodyC');
  m.vertexNode = Fn(() => {
    const on = normalize(normalGeometry);
    const ot = vec3(on.z, 0, on.x.negate());
    const east = select(dot(ot, ot).greaterThan(1e-8), normalize(ot), vec3(1, 0, 0));
    const n = normalize(modelWorldMatrix.mul(vec4(on, 0)).xyz);
    const t = normalize(modelWorldMatrix.mul(vec4(east, 0)).xyz);
    vN.assign(n);
    vT.assign(t);
    vB.assign(cross(n, t));
    vC.assign(modelWorldMatrix.element(3).xyz.add(cameraPosition).sub(u.uOrigin));
    const w = modelWorldMatrix.mul(vec4(positionGeometry, 1));
    vW.assign(w.xyz.add(cameraPosition).sub(u.uOrigin));
    return farClip(u, w);
  })();
  return { vN, vT, vB, vW, vC };
}

export function bodyMaterial(u, { air, map, normal = null, rough = null, clouds = null, giant = false }) {
  const m = farMaterial(u);
  const uniforms = Object.assign(m.uniforms, { uSun: u.uSun, uSunColour: u.uSunColour, uAir: uniform(new THREE.Color(...air)), uDrift: uniform(0), uMap: texture(map) });
  if (!giant) Object.assign(uniforms, { uNormal: texture(normal), uRough: texture(rough) });
  if (!giant && clouds) uniforms.uClouds = texture(clouds);
  const { vN, vT, vB, vW } = bodyVertex(m, u);
  const v = normalize(cameraPosition.sub(vW));
  const g = normalize(vN);
  let n = g;
  let gloss = float(0);
  if (!giant) {
    const t = uniforms.uNormal.xyz.mul(2).sub(1);
    n = normalize(vT.mul(t.x).add(vB.mul(t.y)).add(g.mul(t.z)));
    gloss = uniforms.uRough.r.oneMinus();
  }
  const day = dot(g, u.uSun);
  // (the terminator soft, as the air bends a little light round it)
  let col = uniforms.uMap.rgb.mul(max(dot(n, u.uSun), 0)).mul(smoothstep(-0.08, 0.15, day));
  // the sun’s glint off open water
  col = col.add(vec3(0.5).mul(gloss).mul(gloss).mul(pow(max(dot(n, normalize(u.uSun.add(v))), 0), 80)).mul(step(0, day)));
  if (uniforms.uClouds) col = mix(col, vec3(0.92).mul(max(day, 0)), uniforms.uClouds.sample(uv().add(vec2(uniforms.uDrift, 0))).a);
  const rim = max(dot(g, v), 0).oneMinus();
  // (darker at the limb, through more of its air)
  if (giant) col = col.mul(rim.mul(rim).mul(0.45).oneMinus());
  col = col.add(uniforms.uAir.mul(pow(rim, 3)).mul(smoothstep(-0.3, 0.4, day)).mul(0.35));
  m.colorNode = col.mul(u.uSunColour).mul(0.3183);
  return m;
}

// the air round a body, seen edge on: brightest at the limb, fading out
// above it within a few hundredths of its radius, lit where the sun is up
export function haloMaterial(u, { air, r }) {
  const uR = uniform(r);
  const m = farMaterial(u, { blending: THREE.AdditiveBlending, toneMapped: false });
  const { vW, vC } = bodyVertex(m, u);
  const rd = normalize(vW.sub(cameraPosition));
  const oc = vC.sub(cameraPosition);
  // (from the middle to where the ray passes nearest it)
  const foot = rd.mul(dot(oc, rd)).sub(oc);
  const h = length(foot).div(uR);
  const a = select(h.greaterThan(1), exp(h.oneMinus().div(0.014)), pow(h, 12));
  m.colorNode = air.mul(a).mul(0.9).mul(smoothstep(-0.3, 0.45, dot(normalize(foot), u.uSun)));
  Object.assign(m.uniforms, { uSun: u.uSun, uAir: air, uR });
  return m;
}

// ── the battle’s glows ──

export function flashMaterial() {
  const m = new MeshBasicNodeMaterial({ lights: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
  const vUv = varyingProperty('vec2', 'vFlashUv');
  m.vertexNode = Fn((builder) => {
    vUv.assign(positionGeometry.xy);
    const im = instanceMatrixOf(builder);
    const mv = modelViewMatrix.mul(im ? im.mul(vec4(0, 0, 0, 1)) : vec4(0, 0, 0, 1));
    const k = im ? length(im.element(0).xyz) : 1;
    return cameraProjectionMatrix.mul(vec4(mv.xy.add(positionGeometry.xy.mul(k)), mv.z, mv.w));
  })();
  const d = dot(vUv, vUv);
  // (each flash's own colour, the GLSL's instanceColor, is three's to put
  // on: a node material multiplies its colour by an instanced mesh's
  // instanceColor itself, so the twin multiplying by it too drew every
  // flash in its colour squared, 16.8 dB off the GLSL's. And a vec3: a bare
  // float would be the colour's alpha as well, and the additive blend would
  // weigh the glow by itself)
  m.colorNode = vec3(exp(d.mul(-9)).add(exp(d.mul(-2.5)).mul(0.25)).mul(smoothstep(0.7, 1, d).oneMinus()));
  m.uniforms = {};
  return m;
}

// The view’s sun in a loaded model’s own material (three’s physical
// lighting, one more direct light: the model’s own direct term, run once
// more with the sun, as the GLSL ran RE_Direct after the scene’s lights),
// where a light in the scene would light the room too; and the room’s house
// look kept off it.
export function sunlit(material, u) {
  const m = asNode(material);
  m.userData.noHouse = true;
  const direction = normalize(cameraViewMatrix.mul(vec4(u.uSun, 0)).xyz);
  return wrap(
    m,
    'setupLightingModel',
    (model) => {
      if (!model) return model;
      const indirect = model.indirect.bind(model);
      model.indirect = (builder) => {
        model.direct({ lightDirection: direction, lightColor: u.uSunColour, reflectedLight: builder.context.reflectedLight }, builder);
        indirect(builder);
      };
      return model;
    },
    'view-sun',
    { uSun: u.uSun, uSunColour: u.uSunColour },
  );
}

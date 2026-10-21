// ../../../towns/moria/propsShaders.js on the node renderer: Moria’s
// materials and hooks, the same names and arguments, their GLSL line for
// line in TSL. A material keeps its uniforms on `material.uniforms` under
// the GLSL’s names (uniform nodes, so a `.value` write still lands); what it
// shares with the kit (U: the clock, the reveal, the fire, the rage) is a
// uniform node that reads U’s { value } every render, so the kit’s tick and
// the scenes go on writing U as before. A hook returns the node material
// for the classic one it was given (hookNodes’ asNode), and ./props.js
// already uses what each returns.
//
// What runs differently, and why:
// - The dust and the sparks are sprites, one instance a point (the node
//   renderer draws a point one pixel wide), their size the GLSL’s
//   gl_PointSize; dustPoints and sparkPoints make the object for that.
// - The additive glows’ fog (FOG_ADD: fade to nothing, not to the fog’s
//   colour) is onFog towards black; the rest take the scene’s fog as the
//   GLSL’s fog_fragment did.
// - A ShaderMaterial’s vertex is the GLSL’s (the mesh’s own position, no
//   skinning or instancing, wrap on setupPositionView), its defaults kept:
//   no tone mapping (none of them had the chunk), fog only where it had it.
// - Each falling smoothstep is a rising one turned over, and a GLSL `if`
//   a select (WGSL’s rules).
// - The ripples are cloned once an arm (the Watcher’s tentacle), so the
//   ripple’s clone makes a fresh material: a node material’s clone shares
//   its uniform nodes, and every arm would ring at once.

import * as THREE from 'three';
import { MeshBasicNodeMaterial, PointsNodeMaterial } from 'three/webgpu';
import {
  abs,
  attribute,
  cameraPosition,
  cameraViewMatrix,
  clamp,
  cos,
  diffuseColor,
  dot,
  exp,
  float,
  fract,
  instancedBufferAttribute,
  length,
  materialEmissive,
  materialRoughness,
  max,
  min,
  mix,
  modelNormalMatrix,
  modelViewMatrix,
  modelWorldMatrix,
  normalGeometry,
  normalLocal,
  normalView,
  normalize,
  positionGeometry,
  positionView,
  positionWorld,
  pow,
  reflect,
  screenDPR,
  select,
  sin,
  smoothstep,
  step,
  texture,
  transformNormalToView,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { asNode, follow, keyed, onColor, onFog, onLight, onNormal, wrap } from '../../../../../lib/three/hookNodes';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// One uniform node a { value } of the kit’s, so every material reading it
// shares it (and shares a program where nothing else differs).
const SHARED = new WeakMap();
const of = (holder) => {
  if (!SHARED.has(holder)) SHARED.set(holder, follow(holder));
  return SHARED.get(holder);
};

// GLSL’s smoothstep(a, b, x) with a > b, the edges put in order
const fall = (a, b, x) => smoothstep(b, a, x).oneMinus();

// FOG_ADD: in fog an additive glow fades to nothing
const fogAdd = (m) => onFog(m, () => vec3(0), 'moria:fog-add');

// The GLSL’s vertex: the mesh’s own position into view, nothing else moving it.
const rawVertex = (m) => wrap(m, 'setupPositionView', () => modelViewMatrix.mul(vec4(positionGeometry, 1)).xyz, 'moria:raw');

// a ShaderMaterial’s defaults on a node material
const basic = (o) => new MeshBasicNodeMaterial({ fog: false, toneMapped: false, ...o });

// ── hooks on the kit’s stone and hide ──

// "Let me risk a little more light": a cold light from the staff (the
// camera, or uRevealAt) that reaches further as uReveal goes 0 → 1, catching
// the polish of the stone, and fading up the pillars into the dark.
export function revealable(m0, U, key) {
  const m = asNode(m0);
  const u = {
    uReveal: of(U.uReveal),
    uRevealAt: of(U.uRevealAt),
    uRevealCam: of(U.uRevealCam),
    uRevealColor: of(U.uRevealColor),
  };
  // (the GLSL’s world position and normal, the instance’s matrix in both)
  const vW = varying(positionWorld, 'vRvW');
  const vN = varying(normalize(modelWorldMatrix.mul(vec4(normalLocal, 0)).xyz), 'vRvN');
  return onLight(
    m,
    (light) => {
      const src = mix(u.uRevealAt, cameraPosition, u.uRevealCam);
      const L0 = src.sub(vW);
      const d = length(L0);
      const L = L0.div(max(d, 0.001));
      const N = normalize(vN);
      const V = normalize(cameraPosition.sub(vW));
      const reach = mix(4, 46, u.uReveal);
      const fade = exp(d.negate().div(reach));
      const high = smoothstep(u.uReveal.mul(13).add(9), u.uReveal.mul(14).add(22), vW.y).oneMinus();
      const lam = max(dot(N, L), 0);
      const spec = pow(max(dot(reflect(L.negate(), N), V), 0), 40);
      const sheen = pow(max(dot(N, V), 0).oneMinus(), 2.5);
      const glow = diffuseColor.rgb.mul(lam.mul(1.5).add(sheen.mul(0.6))).add(vec3(spec.mul(0.35).add(sheen.mul(0.08))).mul(materialRoughness.oneMinus()));
      return light.add(select(u.uReveal.greaterThan(0.001), u.uRevealColor.mul(glow).mul(fade).mul(high).mul(u.uReveal), vec3(0)));
    },
    key,
    u,
  );
}

// Detail laid on a creature’s hide in its own space: a picture and its
// normal map sampled from three sides and blended by the surface’s facing.
// The picture’s green shades the colour and its blue darkens it; the normal
// map raises bumps and creases. `extra` (balrogFire’s) is a function of
// { hs, hp, hN } returning what it adds: { shade, emissive }.
export function hide(m0, { tex, nrm, scale = 1, bump = 1, shade = 0.3, extra = null, key }) {
  const m = asNode(m0);
  const u = { uHideScale: uniform(scale), uHideBump: uniform(bump) };
  // (the vertex as it came, before the skeleton moved it)
  const hN = normalize(varying(normalGeometry, 'vHideN'));
  const hw0 = pow(abs(hN), vec3(4));
  const hw = hw0.div(hw0.x.add(hw0.y).add(hw0.z));
  const hp = varying(positionGeometry, 'vHideP').mul(u.uHideScale);
  const hs = texture(tex, hp.zy).mul(hw.x).add(texture(tex, hp.xz).mul(hw.y)).add(texture(tex, hp.xy).mul(hw.z));
  const more = typeof extra === 'function' ? extra({ hs, hp, hN }) : {};
  const k = Number(shade.toFixed(3));
  onColor(
    m,
    (dc) => {
      let rgb = dc.rgb.mul(float(k).mul(float(0.5).sub(hs.g)).mul(2).oneMinus()).mul(hs.b.mul(0.55).oneMinus());
      if (more.shade) rgb = rgb.mul(more.shade);
      return rgb;
    },
    key,
    u,
  );
  onNormal(
    m,
    (n) => {
      const t = (c) => texture(nrm, c).xyz.mul(2).sub(1);
      const tX0 = t(hp.zy);
      const tY0 = t(hp.xz);
      const tZ0 = t(hp.xy);
      const tX = vec3(tX0.xy.mul(u.uHideBump).add(hN.zy), hN.x);
      const tY = vec3(tY0.xy.mul(u.uHideBump).add(hN.xz), hN.y);
      const tZ = vec3(tZ0.xy.mul(u.uHideBump).add(hN.xy), hN.z);
      const nObj = normalize(tX.zyx.mul(hw.x).add(tY.xzy.mul(hw.y)).add(tZ.xyz.mul(hw.z)));
      // (GLSL’s normalMatrix: the model’s normal matrix, then the camera’s turn)
      const dv = cameraViewMatrix.mul(vec4(modelNormalMatrix.mul(nObj.sub(hN)), 0)).xyz;
      return normalize(n.add(dv));
    },
    key,
    u,
  );
  if (more.emissive) m.emissiveNode = materialEmissive.add(more.emissive);
  return m;
}

// Durin’s Bane’s hide: fire in its cracks and a glow at its edges, what
// hide’s `extra` adds, with the uniforms it reads
export function balrogFire(U) {
  const uTime = of(U.uTime);
  const uRage = of(U.uRage);
  const noise = U.uNoise.value;
  return {
    uniforms: { uTime: U.uTime, uRage: U.uRage, uNoise: U.uNoise },
    extra: ({ hs, hp }) => {
      const cr = smoothstep(0.4, 0.95, hs.r);
      const f1 = texture(noise, hp.xy.mul(0.45).add(vec2(hp.z.mul(0.3), uTime.mul(-0.07)))).r;
      const f2 = texture(noise, hp.zy.mul(0.6).add(vec2(uTime.mul(0.03), uTime.mul(-0.11)))).g;
      const pulse = sin(uTime.mul(2.3).add(f1.mul(12)))
        .mul(0.2)
        .add(0.8);
      const heat = cr.mul(f1.mul(f2).mul(2.4).add(0.12)).mul(pulse).mul(uRage.mul(0.75).add(0.55));
      const fire0 = mix(vec3(0.5, 0.06, 0.01), vec3(2.2, 0.7, 0.1), smoothstep(0.2, 0.8, heat));
      const fire = mix(fire0, vec3(3.6, 2, 0.7), smoothstep(0.95, 1.4, heat));
      // (the normal as lit: the hide’s bumps in it)
      const rim = pow(max(abs(dot(normalView, normalize(positionView.negate()))).oneMinus(), 0), 3);
      return {
        shade: cr.mul(0.85).oneMinus(),
        emissive: fire.mul(heat).add(vec3(0.45, 0.07, 0.01).mul(rim).mul(uRage.mul(0.5).add(0.25)).mul(f1.mul(0.8).add(0.6))),
      };
    },
  };
}

// Stone over the abyss: lit from below by the fire, faces turned down
// glowing red, more so the deeper they hang.
export function underglow(m0, U, key) {
  const m = asNode(m0);
  const u = { uFire: of(U.uFire), uFireColor: of(U.uFireColor) };
  const noise = U.uNoise.value;
  const W = varying(positionWorld, 'vUgW');
  const N = normalize(varying(normalize(modelWorldMatrix.mul(vec4(normalLocal, 0)).xyz), 'vUgN'));
  const down = max(N.y.negate(), 0);
  const deep = fall(2, -55, W.y);
  const side = abs(N.y).oneMinus();
  const flick = texture(noise, W.xz.mul(0.05).add(vec2(0, W.y.mul(0.03)))).r.add(0.5);
  m.emissiveNode = materialEmissive.add(
    u.uFireColor
      .mul(u.uFire)
      .mul(flick)
      .mul(
        pow(down, 1.3)
          .mul(deep.mul(1.2).add(0.32))
          .add(side.mul(deep.mul(deep).mul(0.08).add(0.02))),
      ),
  );
  // (the emissive node is the key’s: tagged so no other stone shares its program)
  return keyed(m, key, u);
}

// The ithildin: lit by the moon (uIthil), coming out line by line in a
// shimmer as the light finds it
export function ithildinGlow(m0, U) {
  const m = asNode(m0);
  const u = { uIthil: of(U.uIthil), uTime: of(U.uTime) };
  const noise = U.uNoise.value;
  // (vEmissiveMapUv: the emissive map’s own transform on the uv)
  const em = m.emissiveMap;
  const at = em
    ? uniform(em.matrix)
        .onRenderUpdate(() => {
          if (em.matrixAutoUpdate) em.updateMatrix();
          return em.matrix;
        })
        .mul(vec3(uv(em.channel), 1)).xy
    : uv();
  const nI = texture(noise, at.mul(vec2(2, 2.8))).r;
  const on = smoothstep(nI.sub(0.2), nI.add(0.05), u.uIthil.mul(1.35).sub(0.15));
  const shim = sin(u.uTime.mul(1.7).add(nI.mul(23)))
    .mul(sin(u.uTime.mul(0.6).add(nI.mul(9))))
    .mul(0.12)
    .add(0.88);
  m.emissiveNode = materialEmissive.mul(on.mul(shim).mul(u.uIthil));
  return keyed(m, 'moria-ithildin', u);
}

// ── the Chamber of Mazarbul’s light ──

// The shaft of grey daylight from the high window: soft at its edges,
// brightest where it comes in, fading as it falls; seen from both sides.
export function beamMaterial(U) {
  const uniforms = {
    uK: uniform(1),
    uColor: uniform(new THREE.Color(0.7, 0.76, 0.84)),
    uTime: of(U.uTime),
    uNoise: texture(U.uNoise.value),
  };
  const u = uniforms;
  const m = basic({
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  rawVertex(m);
  const vN = varying(transformNormalToView(normalGeometry), 'vN');
  const vV = varying(modelViewMatrix.mul(vec4(positionGeometry, 1)).xyz.negate(), 'vV');
  const vUv = uv();
  const along = vUv.y.oneMinus();
  const facing = abs(dot(normalize(vN), normalize(vV)));
  const soft = pow(facing, 2.4);
  const start = smoothstep(0, 0.05, along);
  const fade = mix(1, 0.45, along);
  const streak = u.uNoise
    .sample(vec2(vUv.x.mul(2), along.mul(0.5).sub(u.uTime.mul(0.006))))
    .r.mul(0.6)
    .add(0.7);
  const a = soft.mul(start).mul(fade).mul(streak).mul(u.uK).mul(0.5);
  m.colorNode = u.uColor.mul(a);
  m.opacityNode = a;
  m.uniforms = uniforms;
  return fogAdd(m);
}

// Where the daylight lands: a surface lit inside the shaft (the line from
// uFrom along uDir, uR0 wide at the window and uR1 uLen on), soft at its
// edge, dappled with dust, and dark where the tomb (uBoxMin..uBoxMax)
// stands between it and the window. Laid over the stone, adding.
export function sunlitMaterial(U, beam) {
  const uniforms = {
    uK: uniform(1),
    uColor: uniform(new THREE.Color(0.8, 0.84, 0.9)),
    uFrom: uniform(V3()),
    uDir: uniform(V3()),
    uR: uniform(new THREE.Vector3()),
    uBoxMin: uniform(V3()),
    uBoxMax: uniform(V3()),
    uNoise: texture(U.uNoise.value),
  };
  const u = uniforms;
  const m = basic({
    fog: true,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    blending: THREE.AdditiveBlending,
  });
  rawVertex(m);
  const vW = varying(modelWorldMatrix.mul(vec4(positionGeometry, 1)).xyz, 'vW');
  const d = vW.sub(u.uFrom);
  const t = dot(d, u.uDir);
  const off = length(d.sub(u.uDir.mul(t)));
  const rr = mix(u.uR.x, u.uR.y, clamp(t.div(u.uR.z), 0, 1));
  const lit0 = fall(rr, rr.mul(0.55), off).mul(step(0, t));
  // shadowed by the tomb: does the way back to the window cross it?
  const o = vW.sub(u.uDir.mul(0.02));
  const inv = vec3(1).div(u.uDir.negate());
  const t0 = u.uBoxMin.sub(o).mul(inv);
  const t1 = u.uBoxMax.sub(o).mul(inv);
  const tn = min(t0, t1);
  const tf = max(t0, t1);
  const tin = max(max(tn.x, tn.y), tn.z);
  const tout = min(min(tf.x, tf.y), tf.z);
  const lit = select(tout.greaterThan(max(tin, 0)), float(0), lit0);
  const dapple = u.uNoise.sample(vW.xz.mul(0.35)).g.mul(0.5).add(0.75);
  const a = lit.mul(dapple).mul(u.uK).mul(0.32);
  m.colorNode = u.uColor.mul(a);
  m.opacityNode = a;
  m.uniforms = uniforms;
  u.uFrom.value.copy(beam.from);
  u.uDir.value.copy(beam.dir);
  u.uR.value.set(beam.r0, beam.r1, beam.len);
  return fogAdd(m);
}

// A sprite instanced once a point of `geometry` (its position and aSeed as
// instance attributes), drawn by `material`, sized in the canvas’s pixels.
function pointSprites(geometry, material) {
  const sprite = new THREE.Sprite(material);
  sprite.count = geometry.getAttribute('position').count;
  return sprite;
}
const seedsOf = (geometry) => instancedBufferAttribute(new THREE.InstancedBufferAttribute(geometry.getAttribute('aSeed').array, 4));

// gl_PointSize from the GLSL, in the canvas’s pixels (three’s sprite
// multiplies by the DPR again), and how far the point is
const pointSize = (k, p, near) => k.div(max(near, modelViewMatrix.mul(vec4(p, 1)).z.negate())).div(screenDPR);

// Dust turning slowly in the shaft of light, catching it.
function dustMaterial(U, K, geometry) {
  const uniforms = {
    uK: uniform(1),
    uScale: uniform(600),
    uTime: of(U.uTime),
  };
  const u = uniforms;
  const m = new PointsNodeMaterial({
    fog: true,
    toneMapped: false,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: false,
  });
  const aSeed = seedsOf(geometry);
  const position = instancedBufferAttribute(new THREE.InstancedBufferAttribute(geometry.getAttribute('position').array, 3));
  const t = u.uTime.mul(aSeed.y.mul(0.06).add(0.05));
  const p = position.add(vec3(sin(t.add(aSeed.x.mul(31))), sin(t.mul(0.7).add(aSeed.z.mul(17))).sub(fract(t.mul(0.1).add(aSeed.w)).mul(0.4)), cos(t.mul(0.8).add(aSeed.w.mul(23)))).mul(0.25));
  m.positionNode = p;
  m.sizeNode = pointSize(aSeed.z.mul(0.02).add(0.012).mul(u.uScale), p, 0.3);
  const vA = varying(
    sin(u.uTime.mul(aSeed.w.add(0.6)).add(aSeed.x.mul(40)))
      .mul(0.6)
      .mul(0.5)
      .add(0.4)
      .add(0.3)
      .mul(aSeed.y),
    'vA',
  );
  const c = uv().sub(0.5);
  const a = fall(0.25, 0, dot(c, c)).mul(vA).mul(u.uK);
  m.colorNode = vec3(0.95, 0.95, 1).mul(a);
  m.opacityNode = a;
  m.uniforms = uniforms;
  m.userData.fit = () => {
    const v = new THREE.Vector2();
    if (K.renderer) {
      K.renderer.getDrawingBufferSize(v);
      m.uniforms.uScale.value = v.y * 0.9;
    }
  };
  return fogAdd(m);
}

// The dust in the shaft, one sprite a mote
export function dustPoints(geometry, U, K) {
  return pointSprites(geometry, dustMaterial(U, K, geometry));
}

// ── the abyss ──

// The fire’s glow from far below: a floor of churning red light at the
// bottom of the abyss, and tall cards of glowing haze rising off it.
export function abyssMaterial(U, card) {
  const uniforms = {
    uK: uniform(1),
    uCard: uniform(card ? 1 : 0),
    uTime: of(U.uTime),
    uNoise: texture(U.uNoise.value),
  };
  const u = uniforms;
  const m = basic({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  rawVertex(m);
  const vUv = uv();
  const vP = varying(positionGeometry, 'vP');
  const deep = vec3(0.55, 0.05, 0.01);
  const hotC = vec3(2.2, 0.75, 0.12);
  // the cards
  const v = vUv.y;
  const sides = smoothstep(0, 0.3, vUv.x).mul(fall(1, 0.7, vUv.x));
  const cn = u.uNoise.sample(vec2(vUv.x.mul(1.5), v.mul(0.8).sub(u.uTime.mul(0.02)))).r;
  const cn2 = u.uNoise.sample(vec2(vUv.x.mul(3).add(0.3), v.mul(1.6).sub(u.uTime.mul(0.045)))).g;
  const up = max(v.oneMinus(), 0);
  const cardA = pow(up, 1.3).mul(sides).mul(cn.mul(cn2).mul(1.1).add(0.45)).mul(0.6);
  const cardCol = mix(deep, hotC, pow(up, 2.2).mul(cn.add(0.5)));
  // the floor
  const d = length(vP.xy).div(40);
  const fn = u.uNoise.sample(vP.xy.mul(0.012).add(vec2(u.uTime.mul(0.004), u.uTime.mul(-0.003)))).r;
  const fn2 = u.uNoise.sample(vP.xy.mul(0.03).sub(vec2(u.uTime.mul(0.006), 0))).b;
  const churn = smoothstep(0.35, 0.75, fn.mul(0.6).add(fn2.mul(0.6)));
  const floorA = pow(clamp(d.oneMinus(), 0, 1), 1.2).mul(1.4);
  const floorCol = mix(deep, hotC, churn);
  const isCard = u.uCard.greaterThan(0.5);
  const a = select(isCard, cardA, floorA).mul(u.uK);
  m.colorNode = select(isCard, cardCol, floorCol).mul(a);
  m.opacityNode = a;
  m.uniforms = uniforms;
  return m;
}

// Sparks going up out of the deep, wavering, fading as they rise.
function sparkMaterial(U, K, geometry) {
  const uniforms = {
    uK: uniform(1),
    uScale: uniform(600),
    uSpan: uniform(new THREE.Vector3(30, 60, 12)),
    uTime: of(U.uTime),
  };
  const u = uniforms;
  const m = new PointsNodeMaterial({
    fog: false,
    toneMapped: false,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: false,
  });
  const aSeed = seedsOf(geometry);
  const life = fract(u.uTime.mul(aSeed.y.mul(0.03).add(0.025)).add(aSeed.x));
  const p = vec3(
    aSeed.z
      .sub(0.5)
      .mul(u.uSpan.x)
      .add(
        sin(u.uTime.mul(0.7).add(aSeed.w.mul(30)))
          .mul(1.5)
          .mul(life),
      ),
    u.uSpan.y.negate().add(life.mul(u.uSpan.y).mul(1.05)),
    aSeed.w
      .sub(0.5)
      .mul(u.uSpan.z)
      .add(
        cos(u.uTime.mul(0.5).add(aSeed.z.mul(20)))
          .mul(1.2)
          .mul(life),
      ),
  );
  m.positionNode = p;
  m.sizeNode = pointSize(aSeed.y.mul(0.08).add(0.06).mul(u.uScale), p, 0.5);
  const vA = varying(
    sin(life.mul(3.14159)).mul(
      sin(u.uTime.mul(9).add(aSeed.x.mul(60)))
        .mul(0.5)
        .add(0.5),
    ),
    'vA',
  );
  const c = uv().sub(0.5);
  const a = fall(0.25, 0, dot(c, c)).mul(vA).mul(u.uK);
  m.colorNode = vec3(2.6, 1, 0.25).mul(a);
  m.opacityNode = a;
  m.uniforms = uniforms;
  m.userData.fit = () => {
    if (!K.renderer) return;
    const v = new THREE.Vector2();
    K.renderer.getDrawingBufferSize(v);
    m.uniforms.uScale.value = v.y * 0.9;
  };
  return m;
}

// The sparks from the deep, one sprite a spark
export function sparkPoints(geometry, U, K) {
  return pointSprites(geometry, sparkMaterial(U, K, geometry));
}

// ── Durin’s Bane’s fire ──

// a card’s place in view, from where it was born (aEmit, in its parent’s
// frame), how far it has risen and its offset on the card
const card = (m, tag, at) => wrap(m, 'setupPositionView', () => at(), `moria:${tag}`);

// Flames as soft tongues on camera-facing cards, each born at its own point
// (aEmit, in its parent's frame) and rising in the world, wavering, from
// white-yellow through orange to a dull red, gone. Bigger and faster with
// uRage. Many at once make a fire; added, so their order doesn't matter.
export function flameMaterial(U, { size = 1, rise = 2, heat = 1, rate = 1 } = {}) {
  const uniforms = {
    uSize: uniform(size),
    uRise: uniform(rise),
    uHeat: uniform(heat),
    uRate: uniform(rate),
    uTime: of(U.uTime),
    uNoise: texture(U.uNoise.value),
    uRage: of(U.uRage),
  };
  const u = uniforms;
  const m = basic({
    fog: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const aEmit = attribute('aEmit', 'vec3');
  const aSeed = attribute('aSeed', 'vec4');
  const life = fract(u.uTime.mul(aSeed.y.mul(0.9).add(0.6)).mul(u.uRate).add(aSeed.x));
  card(m, 'flame', () => {
    const wp = modelWorldMatrix.mul(vec4(aEmit, 1));
    const h = u.uRise.mul(aSeed.z.mul(0.8).add(0.6)).mul(u.uRage.mul(0.7).add(0.8));
    const w = vec4(
      wp.x.add(
        sin(u.uTime.mul(2.7).add(aSeed.w.mul(40)).add(life.mul(3)))
          .mul(0.14)
          .mul(h)
          .mul(life)
          .sub(life.mul(h).mul(0.12)),
      ),
      wp.y.add(life.mul(h)),
      wp.z.add(
        cos(u.uTime.mul(2.3).add(aSeed.x.mul(30)).add(life.mul(2)))
          .mul(0.14)
          .mul(h)
          .mul(life),
      ),
      wp.w,
    );
    const mv = cameraViewMatrix.mul(w);
    const s = u.uSize
      .mul(aSeed.z.mul(0.9).add(0.55))
      .mul(u.uRage.mul(0.4).add(0.85))
      .mul(life.mul(0.55).oneMinus())
      .mul(smoothstep(0, 0.12, life));
    return mv.xyz.add(vec3(positionGeometry.xy.mul(vec2(s, s.mul(1.6))), 0));
  });
  const vUv = varying(positionGeometry.xy.add(0.5), 'vUv');
  const vLife = varying(life, 'vLife');
  const vSeed = varying(aSeed.w, 'vSeed');
  const n = u.uNoise.sample(vec2(vUv.x.mul(0.7).add(vSeed.mul(3.7)), vUv.y.mul(0.5).sub(u.uTime.mul(1.1)).sub(vSeed))).r;
  const n2 = u.uNoise.sample(vec2(vUv.x.mul(1.5).add(vSeed), vUv.y.mul(1.1).sub(u.uTime.mul(1.9)))).g;
  const w = mix(0.42, 0.05, clamp(vUv.y, 0, 1));
  const x = abs(vUv.x.sub(0.5).add(n.sub(0.5).mul(0.25).mul(vUv.y)));
  const shape = fall(w, w.mul(0.2), x.add(n2.sub(0.5).mul(0.12)))
    .mul(smoothstep(0, 0.2, vUv.y))
    .mul(fall(1, 0.5, vUv.y.add(n.sub(0.5).mul(0.4))));
  const hot = shape.mul(vLife.mul(0.85).oneMinus()).mul(smoothstep(0, 0.08, vLife));
  const col0 = mix(vec3(0.7, 0.07, 0.01), vec3(2.6, 0.85, 0.16), smoothstep(0.08, 0.5, hot));
  m.colorNode = mix(col0, vec3(3, 1.6, 0.5), smoothstep(0.7, 1, hot));
  m.opacityNode = clamp(hot.mul(1.2), 0, 1).mul(u.uHeat);
  m.uniforms = uniforms;
  return fogAdd(m);
}

// Smoke off the fire: dark soft puffs, rising and drifting back, lit red
// from beneath while they are young.
export function smokeMaterial(U, { size = 2, rise = 6 } = {}) {
  const uniforms = {
    uSize: uniform(size),
    uRise: uniform(rise),
    uTime: of(U.uTime),
    uNoise: texture(U.uNoise.value),
    uRage: of(U.uRage),
  };
  const u = uniforms;
  const m = basic({ fog: true, transparent: true, depthWrite: false });
  const aEmit = attribute('aEmit', 'vec3');
  const aSeed = attribute('aSeed', 'vec4');
  const life = fract(u.uTime.mul(aSeed.y.mul(0.07).add(0.08)).add(aSeed.x));
  card(m, 'smoke', () => {
    const wp = modelWorldMatrix.mul(vec4(aEmit, 1));
    const w = vec4(
      wp.x.sub(life.mul(life).mul(u.uRise).mul(0.5)),
      wp.y.add(life.mul(u.uRise).mul(aSeed.z.mul(0.6).add(0.7))),
      wp.z.add(
        sin(u.uTime.mul(0.3).add(aSeed.w.mul(20)))
          .mul(life)
          .mul(1.5),
      ),
      wp.w,
    );
    const mv = cameraViewMatrix.mul(w);
    const s = u.uSize.mul(aSeed.z.mul(0.8).add(0.6)).mul(life.mul(1.2).add(0.4)).mul(u.uRage.mul(0.3).add(0.9));
    const a = aSeed.w.mul(6.283).add(u.uTime.mul(0.1).mul(aSeed.z.sub(0.5)));
    const P = positionGeometry;
    const q = vec2(cos(a).mul(P.x).sub(sin(a).mul(P.y)), sin(a).mul(P.x).add(cos(a).mul(P.y)));
    return mv.xyz.add(vec3(q.mul(s), 0));
  });
  const vUv = varying(positionGeometry.xy.add(0.5), 'vUv');
  const vLife = varying(life, 'vLife');
  const vSeed = varying(aSeed.w, 'vSeed');
  const d = length(vUv.sub(0.5)).mul(2);
  const n = u.uNoise.sample(vUv.mul(0.8).add(vec2(vSeed.mul(5), u.uTime.mul(-0.02)))).r;
  m.opacityNode = fall(1, 0.2, d.add(n.sub(0.5).mul(0.6)))
    .mul(smoothstep(0, 0.15, vLife))
    .mul(vLife.oneMinus())
    .mul(0.55);
  m.colorNode = mix(vec3(0.45, 0.08, 0.02), vec3(0.025, 0.02, 0.02), smoothstep(0, 0.35, vLife));
  m.uniforms = uniforms;
  return m;
}

// Fire as a solid: the flaming sword's blade and the whip. Unlit, flowing
// along its length (uv.y), white-hot in its core and red at its edges.
export function fireSolidMaterial(U) {
  const uniforms = {
    uHeat: uniform(1),
    uTime: of(U.uTime),
    uNoise: texture(U.uNoise.value),
    uRage: of(U.uRage),
  };
  const u = uniforms;
  const m = basic({ fog: true });
  rawVertex(m);
  const vN = varying(transformNormalToView(normalGeometry), 'vN');
  const vV = varying(modelViewMatrix.mul(vec4(positionGeometry, 1)).xyz.negate(), 'vV');
  const vUv = uv();
  const n = u.uNoise.sample(vec2(vUv.x.mul(0.5), vUv.y.mul(0.35).sub(u.uTime.mul(0.9)))).r;
  const n2 = u.uNoise.sample(vec2(vUv.x.mul(1.3).add(0.4), vUv.y.mul(0.9).sub(u.uTime.mul(1.6)))).g;
  const face = abs(dot(normalize(vN), normalize(vV)));
  const h = n.mul(n2).mul(0.9).add(0.45).add(face.mul(0.35)).mul(u.uHeat).mul(u.uRage.mul(0.4).add(0.85));
  const col0 = mix(vec3(0.9, 0.12, 0.02), vec3(3.2, 1.2, 0.25), smoothstep(0.3, 0.8, h));
  m.colorNode = mix(col0, vec3(5, 3.6, 1.8), smoothstep(0.85, 1.25, h));
  m.uniforms = uniforms;
  return m;
}

// The wings' skin: shadow and smoke, not hide. Dark and half seen through,
// smoke drifting over it, its free edges rags that come and go, the fire
// in the body glowing through it near the bones.
export function wingMaterial(U) {
  const uniforms = {
    uTime: of(U.uTime),
    uRage: of(U.uRage),
    uNoise: texture(U.uNoise.value),
  };
  const u = uniforms;
  const m = basic({
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  rawVertex(m);
  const vUv = uv();
  const vWing = attribute('aWing', 'vec2');
  const edge = vWing.x;
  const heat = vWing.y;
  const n = u.uNoise.sample(vUv.mul(vec2(0.9, 0.6)).add(vec2(u.uTime.mul(-0.035), u.uTime.mul(0.02)))).r;
  const n2 = u.uNoise.sample(vUv.mul(vec2(2.2, 1.6)).add(vec2(u.uTime.mul(0.05), u.uTime.mul(-0.03)))).g;
  const rag = fall(0.95, 0.62, edge.add(n.sub(0.5).mul(0.5)).add(n2.sub(0.5).mul(0.35)));
  const hole = fall(0.86, 0.78, n2.add(n.mul(0.25)).add(edge.mul(0.1)));
  const a = rag
    .mul(mix(1, hole, 0.6))
    .mul(heat.mul(0.3).add(0.62))
    .mul(n.mul(0.45).add(0.7));
  m.colorNode = vec3(0.012, 0.009, 0.008)
    .mul(n.add(0.6))
    .add(
      vec3(0.8, 0.16, 0.03)
        .mul(pow(max(heat, 0), 3))
        .mul(u.uRage.mul(0.15).add(0.05))
        .mul(n2.add(0.5)),
    )
    .add(
      vec3(0.5, 0.1, 0.02)
        .mul(smoothstep(0.6, 0.92, edge))
        .mul(rag)
        .mul(0.12)
        .mul(u.uRage.add(0.5)),
    );
  m.opacityNode = clamp(a, 0, 0.92);
  m.uniforms = uniforms;
  return m;
}

// The Watcher's ripples: rings spreading on the pool round an arm, a
// material each arm (uTime and uK its own)
export function rippleMaterial() {
  const uniforms = { uTime: uniform(0), uK: uniform(0) };
  const u = uniforms;
  const m = basic({
    fog: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  rawVertex(m);
  const d = length(varying(positionGeometry.xz, 'vP'));
  let rings = float(0);
  for (let i = 0; i < 3; i++) {
    const f = fract(u.uTime.mul(0.35).add(i / 3));
    const rr = f.mul(2.3).add(0.6);
    rings = rings.add(fall(0.09, 0, abs(d.sub(rr))).mul(f.oneMinus()));
  }
  const foam = fall(0.95, 0.5, d).mul(0.12);
  const a = rings
    .mul(0.22)
    .add(foam)
    .mul(u.uK)
    .mul(fall(3, 2.2, d));
  m.colorNode = vec3(0.62, 0.72, 0.85).mul(a);
  m.opacityNode = a;
  m.uniforms = uniforms;
  // (a fresh material, not one sharing these uniform nodes)
  m.clone = function () {
    const c = rippleMaterial();
    c.name = this.name;
    return c;
  };
  return fogAdd(m);
}

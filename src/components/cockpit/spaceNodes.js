// space.js on the node renderer: the same sky, planet and jump, the same
// exports and calls. Each of the five shaders is ported line for line into
// TSL, its uniforms under the GLSL’s names on `material.uniforms` (nodes,
// so the frame code’s `.value` writes reach them), every flag as the
// original had it; a ShaderMaterial took no fog and no tone mapping, so
// the twins take neither. What differs on the node renderer, and why:
//
// - The stars: the node renderer draws a point one pixel wide, so each star
//   is a sprite instanced once a star (three’s PointsNodeMaterial on a
//   Sprite, its geometry the Sprite’s quad with each star’s `aAt`, `aSize`
//   and `aColor` stepped once an instance), its sizeNode the GLSL’s
//   gl_PointSize. A star whose centre is off the picture is clipped, where
//   WebGL dropped the whole point.
// - The streaks: the GLSL’s vertex shader is the material’s vertexNode (it
//   writes the clip position itself); GLSL’s `mod` is floored, written out.
// - A reversed smoothstep (edge 0 past edge 1) is undefined in WGSL: it is
//   written as the one the right way round, taken from 1.
//
// Space outside the Falcon’s and the X-wing’s glass: a sky of stars and a
// faint nebula, a planet with its atmosphere lit from one side by a far sun,
// and the jump to lightspeed. The jump is drawn in the world, beyond the
// glass, so the canopy’s frame stays in front of it: stars a little way
// ahead stretch into lines as the ship speeds up, curl in the tunnel of blue
// light, and the white flash on the way out. All of it is drawn in the
// outside pass (scene.js), before the cockpit.

import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial, PointsNodeMaterial } from 'three/webgpu';
import {
  Fn, abs, attribute, cameraProjectionMatrix, clamp, cos, dot, exp, float, floor, fract, length, min, mix, modelViewMatrix,
  modelWorldMatrix, normalLocal, normalize, positionLocal, positionView, pow, screenDPR, select, sin, smoothstep, step,
  transformNormalToView, uniform, uv, vec2, vec3, vec4,
} from 'three/tsl';
import { glowSprite, rng } from './kitNodes';

// (GLSL’s smoothstep with its edges reversed, as nodes)
const fall = (a, b, x) => smoothstep(b, a, x).oneMinus();
// (GLSL’s mod: floored)
const fmod = (x, y) => x.sub(y.mul(floor(x.div(y))));
// (what a ShaderMaterial was: no fog, no tone mapping)
const shaded = (Kind, opts) => new Kind({ fog: false, toneMapped: false, ...opts });

// A sky: a sphere of stars (points, varied in size and colour) and the
// nebula behind them (domain-warped noise on the view direction, so it has
// no seams).
const nebHash = Fn(([q]) => {
  const p = fract(q.mul(0.3183099).add(0.1)).mul(17).toVar();
  return fract(p.x.mul(p.y).mul(p.z).mul(p.x.add(p.y).add(p.z)));
}).setLayout({ name: 'cockpitNebulaHash', type: 'float', inputs: [{ name: 'q', type: 'vec3' }] });
const nebNoise = Fn(([x]) => {
  const i = floor(x).toVar();
  const g = fract(x);
  const f = g.mul(g).mul(vec3(3).sub(g.mul(2))).toVar();
  const h = (a, b, c) => nebHash(i.add(vec3(a, b, c)));
  return mix(mix(mix(h(0, 0, 0), h(1, 0, 0), f.x), mix(h(0, 1, 0), h(1, 1, 0), f.x), f.y), mix(mix(h(0, 0, 1), h(1, 0, 1), f.x), mix(h(0, 1, 1), h(1, 1, 1), f.x), f.y), f.z);
}).setLayout({ name: 'cockpitNebulaNoise', type: 'float', inputs: [{ name: 'x', type: 'vec3' }] });
const nebFbm = Fn(([q]) => {
  const p = q.toVar();
  const v = float(0).toVar();
  let a = 0.5;
  for (let i = 0; i < 5; i++) {
    v.addAssign(nebNoise(p).mul(a));
    p.mulAssign(2.03);
    a *= 0.5;
  }
  return v;
}).setLayout({ name: 'cockpitNebulaFbm', type: 'float', inputs: [{ name: 'p', type: 'vec3' }] });

function nebulaMaterial(u) {
  const mat = shaded(MeshBasicNodeMaterial, { side: THREE.BackSide, depthWrite: false });
  const vDir = normalize(positionLocal).toVarying('vDir');
  mat.colorNode = Fn(() => {
    const d = normalize(vDir).toVar();
    const q = vec3(nebFbm(d.mul(2.2)), nebFbm(d.mul(2.2).add(5.2)), nebFbm(d.mul(2.2).add(9.7))).toVar();
    const n = nebFbm(d.mul(3).add(q.mul(2.4)));
    // a band across the sky, where the nebula gathers (a galaxy’s plane)
    // (pow(x, 2.0) as x × x: the same where GLSL’s pow is defined, and on
    // the side where x < 0, where WGSL’s is not)
    const b = dot(d, normalize(u.uBand)).mul(3.2);
    const band = exp(b.mul(b).negate()).toVar();
    const cloud = smoothstep(0.42, 0.95, n).mul(band.mul(0.65).add(0.35));
    const col = u.uDeep.add(mix(u.uA, u.uB, smoothstep(0.3, 0.8, q.x)).mul(cloud)).toVar();
    // dark lanes of dust through the band
    col.mulAssign(float(1).sub(smoothstep(0.55, 0.75, nebFbm(d.mul(7).add(3))).mul(0.55).mul(band)));
    return col.mul(u.uFade);
  })();
  mat.uniforms = u;
  return mat;
}

function starMaterial(u) {
  const mat = shaded(PointsNodeMaterial, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false });
  mat.positionNode = attribute('aAt', 'vec3');
  const vColor = attribute('aColor', 'vec3').mul(u.uFade).toVarying('vColor');
  // gl_PointSize, in the drawing buffer’s pixels (three’s sprite multiplies by the DPR again)
  mat.sizeNode = attribute('aSize', 'float').mul(u.uPx).div(screenDPR);
  const d = length(uv().sub(0.5)).mul(2);
  const a = fall(1, 0, d);
  const a2 = a.mul(a);
  mat.colorNode = vColor.mul(a2);
  mat.opacityNode = a2;
  mat.uniforms = u;
  return mat;
}

export function sky({ seed = 4, count = 5200, radius = 1800, nebula = ['#2a3f7a', '#6a2f6e'], deep = '#020309', band = [0.3, 1, 0.25] } = {}) {
  const r = rng(seed);
  const group = new THREE.Group();
  const nebU = {
    uA: uniform(new THREE.Color(nebula[0])),
    uB: uniform(new THREE.Color(nebula[1])),
    uDeep: uniform(new THREE.Color(deep)),
    uFade: uniform(1),
    uBand: uniform(new THREE.Vector3(...band)),
  };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), nebulaMaterial(nebU));
  dome.renderOrder = -10;
  group.add(dome);

  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  const bandDir = new THREE.Vector3(...band).normalize();
  for (let i = 0; i < count; i++) {
    // more stars near the band
    let v;
    do {
      v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
    } while (v.lengthSq() > 1 || v.lengthSq() < 0.01);
    v.normalize();
    if (r() < 0.45) v.addScaledVector(bandDir, -v.dot(bandDir) * (0.6 + r() * 0.4)).normalize();
    pos.set([v.x * radius * 0.9, v.y * radius * 0.9, v.z * radius * 0.9], i * 3);
    const big = Math.pow(r(), 9);
    size[i] = 1.1 + r() * 1.4 + big * 5;
    // star colours: mostly white, some blue, some warm
    const k = r();
    c.setHSL(k < 0.25 ? 0.6 : k < 0.4 ? 0.08 : 0.13, k < 0.4 ? 0.5 : 0.1, 0.75 + r() * 0.25);
    const b = 0.5 + r() * 0.7 + big * 2;
    col.set([c.r * b, c.g * b, c.b * b], i * 3);
  }
  // (a star a sprite, instanced: the quad three’s Sprite has, each star’s
  // own attributes stepped once a sprite)
  const geo = new THREE.InstancedBufferGeometry();
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
  geo.setAttribute('aAt', new THREE.InstancedBufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 1));
  geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3));
  geo.instanceCount = count;
  const starU = { uPx: uniform(1), uFade: uniform(1) };
  const stars = new THREE.Sprite(starMaterial(starU));
  stars.geometry = geo;
  stars.count = count;
  stars.renderOrder = -9;
  stars.frustumCulled = false;
  group.add(stars);
  return {
    group,
    // px: the renderer’s pixel ratio; fade: 1 shown … 0 gone (in the jump)
    set({ px, fade }) {
      if (px != null) starU.uPx.value = px;
      if (fade != null) {
        starU.uFade.value = fade;
        nebU.uFade.value = fade;
      }
    },
  };
}

// A planet: its map wrapped round a sphere, lit from `sun` (a direction),
// with a thin atmosphere that glows on its lit limb and a softer one in the
// dark. `night` lights the dark side (city lights or lava), optional.
function atmosphereMaterial(u) {
  const mat = shaded(MeshBasicNodeMaterial, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide });
  const vN = transformNormalToView(normalLocal).toVarying('vN');
  const vV = positionView.negate().toVarying('vV');
  const vW = normalize(modelWorldMatrix.mul(vec4(normalLocal, 0)).xyz).toVarying('vW');
  const rim = float(1).sub(abs(dot(normalize(vN), normalize(vV))));
  const lit = smoothstep(-0.25, 0.6, dot(normalize(vW), normalize(u.uSun)));
  const a = pow(rim, 2.4).mul(lit.mul(0.85).add(0.15)).mul(u.uStrength);
  mat.colorNode = u.uColor.mul(a);
  mat.opacityNode = a;
  mat.uniforms = u;
  return mat;
}

export function planet({ map, radius = 100, sun = [1, 0.3, 0.4], atmosphere = '#9fc2ff', strength = 1.2, tint = 0xffffff, ambient = 0.03 } = {}) {
  const group = new THREE.Group();
  const sunDir = new THREE.Vector3(...sun).normalize();
  const mat = new MeshStandardNodeMaterial({ map: map ?? null, color: tint, roughness: 0.95, metalness: 0 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), mat);
  group.add(body);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.035, 96, 64), atmosphereMaterial({ uColor: uniform(new THREE.Color(atmosphere)), uSun: uniform(sunDir), uStrength: uniform(strength) }));
  group.add(atmo);
  // its own light, so the rest of the scene can be lit differently
  const light = new THREE.DirectionalLight(0xfff4e6, 2.6);
  light.position.copy(sunDir).multiplyScalar(radius * 10);
  light.target = body;
  group.add(light, light.target);
  const amb = new THREE.AmbientLight(0x8090b0, ambient);
  group.add(amb);
  return { group, body, spin: (dt) => (body.rotation.y += dt * 0.004) };
}

// The jump to lightspeed, in the world ahead of the ship (which flies down
// −z): stars on a long cylinder round the way ahead come at you faster and
// faster, each a streak as long as the distance it covers while the eye
// holds its light; at the jump they curl round the vanishing point and the
// mottled blue tunnel opens; a flash on the way out. update() takes the
// throttle (0…1) and the tunnel (0…1).
function streakMaterial(u) {
  const mat = shaded(MeshBasicNodeMaterial, { side: THREE.DoubleSide, ...additive });
  const aRow = attribute('aRow', 'vec2'); // x: 0 head, 1 tail; y: side
  const aStar = attribute('aStar', 'vec4'); // x: angle, y: radius, z: depth phase, w: size
  const aLook = attribute('aLook', 'vec2'); // x: tint, y: brightness
  // the swirl turns the far end more, so long streaks curve
  const at = (z) => {
    const a = aStar.x.add(u.uSwirl.mul(clamp(z.negate().div(u.uDepth), 0, 1)).mul(aLook.x.mul(0.6).add(0.4)));
    return vec3(cos(a).mul(aStar.y), sin(a).mul(aStar.y), z);
  };
  const px = (c) => c.xy.div(c.w).mul(0.5).mul(u.uView);
  const zh = fmod(aStar.z.mul(u.uDepth).sub(u.uTravel), u.uDepth).negate().sub(0.5);
  const near = clamp(zh.div(u.uDepth).add(1), 0, 1);
  const hvz = modelViewMatrix.mul(vec4(at(zh), 1)).z;
  // nothing behind the eye
  const hide = step(-0.2, hvz);
  mat.vertexNode = Fn(() => {
    const zt = zh.sub(u.uLen);
    const hv = modelViewMatrix.mul(vec4(at(zh), 1)).toVar();
    const tv = modelViewMatrix.mul(vec4(at(zt), 1)).toVar();
    hv.z.assign(min(hv.z, -0.2));
    tv.z.assign(min(tv.z, -0.2));
    const hc = cameraProjectionMatrix.mul(hv).toVar();
    const tc = cameraProjectionMatrix.mul(tv).toVar();
    const hp = px(hc).toVar();
    const tp = px(tc).toVar();
    const dir0 = tp.sub(hp);
    const len = length(dir0);
    const dir = select(len.greaterThan(0.001), dir0.div(len), vec2(1, 0)).toVar();
    const side = vec2(dir.y.negate(), dir.x);
    const w = near.mul(near).mul(1.6).add(0.55).mul(aStar.w).mul(u.uPx).toVar();
    const head = aRow.x.lessThan(0.5);
    const c = select(head, hc, tc).toVar();
    const p = select(head, hp.sub(dir.mul(w)), tp.add(dir.mul(w))).add(side.mul(aRow.y).mul(w.add(u.uPx)));
    return vec4(p.div(u.uView.mul(0.5)).mul(c.w), c.z, c.w);
  })();
  const vAcross = aRow.y.toVarying('vAcross');
  const vF = aRow.x.toVarying('vF');
  // fade in out of the far dark, so nothing pops
  const arrive = float(1).sub(smoothstep(u.uDepth.mul(0.7), u.uDepth, zh.negate()));
  const vGlow = aLook.y.mul(arrive).mul(u.uFade).mul(float(1).sub(hide)).mul(near.mul(0.45).add(0.55)).toVarying('vGlow');
  const blue = mix(aLook.x.mul(0.25).add(0.12), aLook.x.mul(0.45).add(0.55), u.uTunnel);
  const vColor = vec3(float(1).sub(blue.mul(0.45)), float(1).sub(blue.mul(0.18)), 1).toVarying('vColor');
  const a = float(1).sub(smoothstep(0.35, 1, abs(vAcross))).mul(vGlow).mul(mix(1, 0.15, vF.mul(vF)));
  mat.colorNode = vColor.mul(a).mul(1.6);
  mat.opacityNode = a;
  mat.uniforms = u;
  return mat;
}

const hash2 = (p) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
const noise2 = (p) => {
  const i = floor(p);
  const g = fract(p);
  const f = g.mul(g).mul(vec2(3).sub(g.mul(2)));
  return mix(mix(hash2(i), hash2(i.add(vec2(1, 0))), f.x), mix(hash2(i.add(vec2(0, 1))), hash2(i.add(vec2(1, 1))), f.x), f.y);
};

function tunnelMaterial(u) {
  const mat = shaded(MeshBasicNodeMaterial, { side: THREE.BackSide, ...additive });
  const vUv = uv();
  // round the tunnel (u) and along it (v): long streaks rushing past
  const p = vec2(vUv.x.mul(48), vUv.y.mul(3).add(u.uScroll));
  const n = noise2(p.mul(vec2(1, 0.6))).mul(0.6).add(noise2(p.mul(vec2(2.3, 1.1)).add(7)).mul(0.4));
  const streak = smoothstep(0.45, 0.95, n);
  const mottle = noise2(vec2(vUv.x.mul(9), vUv.y.mul(0.8).add(u.uScroll.mul(0.3)).add(u.uTime.mul(0.2))));
  const deep = vec3(0.05, 0.16, 0.55);
  const bright = vec3(0.7, 0.88, 1.0);
  const col = mix(deep, bright, streak).mul(mottle.mul(0.9).add(0.55));
  // round you to far away; it fades only at the very ends
  const depth = smoothstep(0, 0.03, vUv.y).mul(float(1).sub(smoothstep(0.8, 1, vUv.y)));
  const a = u.uOn.mul(streak.mul(0.9).add(0.45)).mul(depth);
  mat.colorNode = col.mul(a);
  mat.opacityNode = a;
  mat.uniforms = u;
  return mat;
}

const additive = { blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false, toneMapped: false };

export function hyperspace({ count = 1800, depth = 260, inner = 2.5, outer = 60, seed = 21 } = {}) {
  const r = rng(seed);
  const group = new THREE.Group();
  const row = new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]);
  const star = new Float32Array(count * 4);
  const look = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const rad = inner + Math.pow(r(), 0.75) * (outer - inner);
    star.set([r() * Math.PI * 2, rad, r(), 0.6 + r() * 0.8], i * 4);
    look.set([r(), 0.35 + Math.pow(r(), 0.6) * 0.65], i * 2);
  }
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('aRow', new THREE.Float32BufferAttribute(row, 2));
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
  geo.setIndex([0, 1, 2, 1, 3, 2]);
  geo.setAttribute('aStar', new THREE.InstancedBufferAttribute(star, 4));
  geo.setAttribute('aLook', new THREE.InstancedBufferAttribute(look, 2));
  geo.instanceCount = count;
  const u = {
    uTravel: uniform(0),
    uLen: uniform(0),
    uDepth: uniform(depth),
    uSwirl: uniform(0),
    uTunnel: uniform(0),
    uFade: uniform(0),
    uView: uniform(new THREE.Vector2(1, 1)),
    uPx: uniform(1),
  };
  const streaks = new THREE.Mesh(geo, streakMaterial(u));
  streaks.frustumCulled = false;
  streaks.renderOrder = 2;
  group.add(streaks);

  // the tunnel: a long open tube down −z, seen from inside
  const tubeGeo = new THREE.CylinderGeometry(9, 9, depth * 1.6, 64, 1, true);
  tubeGeo.rotateX(-Math.PI / 2);
  tubeGeo.translate(0, 0, -depth * 0.8);
  const tu = { uTime: uniform(0), uOn: uniform(0), uScroll: uniform(0) };
  const tunnel = new THREE.Mesh(tubeGeo, tunnelMaterial(tu));
  tunnel.frustumCulled = false;
  tunnel.renderOrder = 1;
  tunnel.visible = false;
  group.add(tunnel);

  // the glow at the vanishing point, as the jump opens
  const core = glowSprite('#bcd8ff', 90, 0);
  core.position.set(0, 0, -depth * 0.9);
  core.renderOrder = 3;
  group.add(core);

  let travel = 0;
  let swirl = 0;
  let scroll = 0;
  return {
    group,
    // the canvas’s size in drawing-buffer pixels and its pixel ratio
    resize(w, h, px) {
      u.uView.value.set(w, h);
      u.uPx.value = px;
    },
    // throttle 0…1 (the ship’s speed), tunnel 0…1 (inside the jump), shown 0…1
    update(dt, t, { throttle, tunnel: inTunnel, shown = 1 }) {
      // world units a second: a slow drift at rest, a wall of light at the top
      const v = 4 + 900 * Math.pow(throttle, 2.2);
      travel += v * dt;
      u.uTravel.value = travel % depth;
      // the eye’s exposure: a dot at rest, long lines when going fast
      u.uLen.value = Math.min(depth * 0.8, v * (0.012 + 0.07 * Math.pow(throttle, 1.5)));
      if (inTunnel > 0) swirl += dt * 0.9 * inTunnel;
      u.uSwirl.value = swirl;
      u.uTunnel.value = inTunnel;
      u.uFade.value = shown;
      tunnel.visible = inTunnel > 0.01;
      scroll += dt * (2 + 10 * inTunnel);
      tu.uScroll.value = scroll;
      tu.uTime.value = t;
      tu.uOn.value = inTunnel * shown;
      core.material.opacity = Math.max(inTunnel * 0.9, Math.max(0, throttle - 0.5) * 1.2) * shown;
    },
    // the light the jump throws on the cockpit: its colour and how strong
    light(target, { throttle, tunnel: inTunnel }) {
      const k = Math.max(0, throttle - 0.3) * 0.8 + inTunnel * 1.6;
      target.setRGB(0.55 * k, 0.75 * k, 1.25 * k);
      return k;
    },
  };
}

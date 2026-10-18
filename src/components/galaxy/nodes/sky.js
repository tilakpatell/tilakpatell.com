// The galaxy's space sky (../sky.js) on the node renderer: the same sky,
// the same exports and the same calls. The galaxy's disc round the horizon,
// its lanes and star clouds, the core and three nebulae, baked once a
// system into a cube and looked up by the sphere you see; the stars, the
// system's suns and the other systems' stars drawn live over it. Each of
// the five shaders is ported line for line into TSL, its uniforms under the
// GLSL's names on `material.uniforms` (nodes, so the frame's `.value`
// writes reach them; the nebulae's arrays as { value: [...] }, an element a
// node sharing its object), every flag as the original had it. What
// differs on the node renderer, and why:
//
// - The stars and the other systems' stars: the node renderer draws a point
//   one pixel wide, so each is a quad, instanced once a star (a Mesh on an
//   InstancedBufferGeometry: `position`, `aSize`, `aColor`, `aFocus` per
//   instance, as the GLSL's attributes, and its corner per vertex), sized in
//   pixels as gl_PointSize was; the beacons' draw range is the geometry's
//   instanceCount.
// - The bake: a CubeCamera into the node renderer's CubeRenderTarget (the
//   same size, 8 bits in sRGB, no mipmaps); prepare() is the node
//   renderer's compileAsync against that cube, in place of
//   lib/three/renderer's precompile.
// - The look-up's fine grain is worked out everywhere and only shows where
//   it's lit (its weight is 0 elsewhere, so the sum is the same): WGSL
//   doesn't sample a texture in a branch that differs pixel to pixel.
// - A texture slot can't be empty in TSL, so uSky and uPano hold a stand-in
//   until there's one; their `.value` reads null till then, as before.
//
// createSky({ small, level, renderer, beacons, clouds }) → { group, setSystem(system), bake(renderer),
//   prepare(renderer) → Promise, update(camera, t), focus(id), beacons, sunDirs,
//   setRatio(r), dispose() }; nebulaeOf(sys), bakeSize({ small, level }), starCount({ small, level })

import * as THREE from 'three';
import { CubeRenderTarget, MeshBasicNodeMaterial } from 'three/webgpu';
import {
  Fn, If, abs, acos, asin, atan, attribute, cameraProjectionMatrix, clamp, cos, cubeTexture, dot, exp, float, floor, fract, length, max, mix,
  modelViewMatrix, modelWorldMatrix, normalize, positionLocal, pow, sRGBTransferEOTF, sRGBTransferOETF, screenCoordinate, sin, smoothstep,
  sqrt, texture, uniform, uv, vec2, vec3, vec4, viewportSize,
} from 'three/tsl';
import { tileFbm } from '../../../lib/texture';
import { RIM, SYSTEMS, coreBearing, courseTo, distance } from '../systems';
import { panoramaUrl } from '../skyPanorama';
import { held, rev } from '../surface/nodes/common';

const SKY_R = 5200; // (inside the camera's far plane, outside everything else)
const SUN_R = 4800;
const TODAY = 4200; // the stars the sky always had (the ones past them are fainter: STARS_PAST)
const STARS_PAST = 0.7; // how bright the stars past those are, of what they'd be
const GRAIN_SIZE = 256;

// the noise the bake draws everything through: GLSL's functions, each a
// function in the shader too (setLayout), not inlined two dozen times
const hash3 = Fn(([q]) => {
  const p = fract(q.mul(0.3183099).add(vec3(0.11, 0.17, 0.13))).mul(17).toVar();
  return fract(p.x.mul(p.y).mul(p.z).mul(p.x.add(p.y).add(p.z)));
}).setLayout({ name: 'skyHash3', type: 'float', inputs: [{ name: 'q', type: 'vec3' }] });
const vnoise = Fn(([x]) => {
  const i = floor(x).toVar();
  const g = fract(x).toVar();
  const f = g.mul(g).mul(vec3(3).sub(g.mul(2))).toVar();
  const h = (a, b, c) => hash3(i.add(vec3(a, b, c)));
  return mix(
    mix(mix(h(0, 0, 0), h(1, 0, 0), f.x), mix(h(0, 1, 0), h(1, 1, 0), f.x), f.y),
    mix(mix(h(0, 0, 1), h(1, 0, 1), f.x), mix(h(0, 1, 1), h(1, 1, 1), f.x), f.y),
    f.z,
  );
}).setLayout({ name: 'skyVnoise', type: 'float', inputs: [{ name: 'x', type: 'vec3' }] });
const fbm = (octaves) =>
  Fn(([q]) => {
    const p = q.toVar();
    const s = float(0).toVar();
    let a = 0.5;
    for (let i = 0; i < octaves; i++) {
      s.addAssign(vnoise(p).mul(a));
      p.assign(p.mul(2.03).add(vec3(1.7, 9.2, 3.4)));
      a *= 0.5;
    }
    return s;
  }).setLayout({ name: `skyFbm${octaves}`, type: 'float', inputs: [{ name: 'p', type: 'vec3' }] });
const fbm4 = fbm(4);
const fbm7 = fbm(7);

// on the far plane (a hair in front of it: z = w × k), whatever its distance
const farClip = (mv, k = 0.99999) => {
  const p = cameraProjectionMatrix.mul(mv);
  return vec4(p.xy, p.w.mul(k), p.w);
};
const basic = (opts) => new MeshBasicNodeMaterial({ fog: false, ...opts });
const additive = () => basic({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });

// a texture slot that reads null while it holds its stand-in
const slot = (node, empty) => ({
  node,
  get value() {
    return node.value === empty ? null : node.value;
  },
  set value(t) {
    node.value = t ?? empty;
  },
});
const NO_PANO = new THREE.DataTexture(new Uint8Array(4), 1, 1);
NO_PANO.needsUpdate = true;

// the sky as it's drawn every frame: the cube baked for the system, looked
// up the way you're looking, broken up finer than the cube's texels where
// it's bright, with noise of half a step either way of the cube's own steps
// (8 bits, in sRGB), against banding in the dark (LOOK_FRAG)
function lookMaterial(cube) {
  const lit = uniform(0); // (black till there's a cube)
  const sky = cubeTexture(cube.texture);
  const grainTex = texture(grainMap());
  const mat = basic({ side: THREE.BackSide, depthWrite: false });
  // (the cube's own texture from the start, never a stand-in of another
  // kind: whether a cube is flipped is settled when the shader is made)
  const uSky = {
    node: sky,
    get value() {
      return lit.value ? sky.value : null;
    },
    set value(t) {
      sky.value = t ?? cube.texture;
      lit.value = t ? 1 : 0;
    },
  };
  mat.uniforms = { uSky, uGrain: grainTex };
  const grain = (d, f) => {
    const w = pow(abs(d), vec3(4)).toVar();
    w.divAssign(w.x.add(w.y).add(w.z));
    return grainTex.sample(d.yz.mul(f)).r.mul(w.x).add(grainTex.sample(d.zx.mul(f)).r.mul(w.y)).add(grainTex.sample(d.xy.mul(f)).r.mul(w.z));
  };
  mat.vertexNode = farClip(modelViewMatrix.mul(vec4(positionLocal, 1)));
  mat.colorNode = Fn(() => {
    const d = normalize(positionLocal).toVar();
    const c = sky.sample(d).rgb.mul(lit).toVar();
    const bright = smoothstep(0.004, 0.05, dot(c, vec3(0.2126, 0.7152, 0.0722)));
    const g = grain(d, 40).mul(0.55).add(grain(d, 110).mul(0.45));
    c.mulAssign(clamp(g.sub(0.5).mul(1.6), -1, 1).mul(0.2).mul(bright).add(1));
    const n = fract(sin(dot(screenCoordinate.xy, vec2(12.9898, 78.233))).mul(43758.5453)).sub(0.5);
    return sRGBTransferEOTF(max(sRGBTransferOETF(c).add(n.div(255)), 0));
  })();
  return mat;
}

// the grain: fbm that tiles, made once (in code: nothing to fetch), with
// its mipmaps, so where it's finer than the pixels it fades to even
let grainTexture = null;
function grainMap() {
  if (grainTexture) return grainTexture;
  const fbmTile = tileFbm(11, { base: 8, octaves: 5 });
  const data = new Uint8Array(GRAIN_SIZE * GRAIN_SIZE * 4);
  for (let y = 0; y < GRAIN_SIZE; y++)
    for (let x = 0; x < GRAIN_SIZE; x++) {
      const v = Math.round(Math.min(1, Math.max(0, fbmTile(x / GRAIN_SIZE, y / GRAIN_SIZE))) * 255);
      const i = (y * GRAIN_SIZE + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  const t = new THREE.DataTexture(data, GRAIN_SIZE, GRAIN_SIZE, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  grainTexture = t;
  return t;
}

// the sky as it's baked, once a system: the band, its lanes and star clouds,
// the core, three nebulae and the dust in front, every one of them drawn
// through noise twisted by noise (BAKE_FRAG)
function bakeMaterial() {
  const u = {
    uCore: uniform(new THREE.Vector3(1, 0, 0)),
    uNear: uniform(0.3),
    uSide: uniform(0.3),
    uSeed: uniform(0),
    uNebDir: held([0, 1, 2].map(() => new THREE.Vector3(0, 0, 1))),
    uNebCol: held([0, 1, 2].map(() => new THREE.Color())),
    uNebShape: held([0, 1, 2].map(() => new THREE.Vector2(0.3, 1))), // (its size, in radians, and how twisted it is)
    uPano: slot(texture(NO_PANO), NO_PANO),
    uPanoOn: uniform(0),
  };
  const mat = basic({ side: THREE.BackSide, depthTest: false, depthWrite: false });
  mat.uniforms = u;
  const seed = u.uSeed;
  mat.colorNode = Fn(() => {
    const d = normalize(positionLocal).toVar();
    const lat = d.y;
    // a slow twist across the whole sky, that every cloud and lane is drawn through
    const s = d.mul(2.3).add(seed).toVar();
    const twist = vec3(fbm4(s), fbm4(s.add(vec3(5.2, 1.3, 2.8))), fbm4(s.add(vec3(1.7, 9.2, 4.1)))).sub(0.47).toVar();
    const dw = d.add(twist.mul(0.3)).toVar();
    // the band: the disc seen edge on, wider nearer the middle
    const width = mix(0.11, 0.2, u.uNear).toVar();
    const ww = width.mul(width);
    const wl = lat.add(twist.y.mul(0.03)).toVar();
    const band = exp(wl.mul(wl).negate().div(ww));
    const level = normalize(vec3(d.x, 0, d.z).add(vec3(1e-5, 0, 0)));
    const toward = dot(level, u.uCore).mul(0.5).add(0.5).toVar();
    // out at the rim the galaxy's all to one side
    const side = mix(1, pow(toward, 1.6).mul(0.92).add(0.08), u.uSide).toVar();
    const clouds = fbm7(dw.mul(7).add(seed)).toVar();
    const fine = fbm4(dw.mul(23).add(seed.mul(1.7))).toVar();
    // its lanes of dust, and the dust drifting in front of everything
    const lanes = smoothstep(0.46, 0.7, fbm7(dw.mul(vec3(5, 14, 5)).add(3.1).add(seed))).mul(exp(lat.mul(lat).negate().div(ww.mul(0.18)))).toVar();
    const dust = smoothstep(0.52, 0.76, fbm7(dw.mul(vec3(7, 10, 7)).add(vec3(11, 4, 7)).add(seed))).toVar();
    const dustBand = dust.mul(exp(lat.mul(lat).negate().div(ww.mul(2.5)))).toVar(); // (in the disc, over the band and the core)
    const bandCol = mix(vec3(0.5, 0.58, 0.85), vec3(1, 0.86, 0.68), toward).toVar();
    const col = bandCol.mul(band).mul(side).mul(clouds.mul(0.62).add(0.18).add(fine.mul(fine).mul(0.35))).mul(0.32).toVar();
    // its star clouds: a fine grain of light down its middle
    const grain = fbm4(d.mul(70).add(seed.mul(2.3))).toVar();
    col.addAssign(bandCol.mul(exp(wl.mul(wl).negate().div(ww.mul(0.45)))).mul(side).mul(grain).mul(grain).mul(grain).mul(0.09));
    col.mulAssign(vec3(1).sub(max(vec3(lanes.mul(0.82)), dustBand.mul(vec3(0.5, 0.55, 0.62))))); // (the dust takes more blue than red)
    // the core's bulge: bigger and brighter the nearer the middle
    const ang = acos(clamp(dot(d, u.uCore), -1, 1)).toVar();
    const size = mix(0.13, 0.95, u.uNear).toVar();
    const ss = size.mul(size);
    const squash = exp(lat.mul(lat).negate().div(ss.mul(0.32)));
    const bulge = exp(ang.mul(ang).negate().div(ss)).mul(mix(1, squash, 0.6));
    const core = exp(ang.mul(ang).negate().div(ss.mul(0.06))).toVar();
    const coreCol = mix(vec3(1, 0.78, 0.5), vec3(1, 0.95, 0.85), core);
    col.addAssign(coreCol.mul(bulge.mul(mix(0.22, 0.9, u.uNear)).add(core.mul(mix(0.18, 0.7, u.uNear)))).mul(float(1).sub(max(lanes.mul(0.55), dustBand.mul(0.3)))).mul(clouds.mul(0.25).add(0.75)));
    // the nebulae: gas glowing in its own colour, twisted its own amount,
    // whiter where it's thickest, with rifts of its own and the dust across it
    for (let i = 0; i < 3; i++) {
      const dir = u.uNebDir.nodes[i];
      const tone = u.uNebCol.nodes[i];
      const shape = u.uNebShape.nodes[i];
      const a = acos(clamp(dot(d, dir), -1, 1)).div(shape.x).toVar();
      const m = exp(a.mul(a).negate()).toVar();
      If(m.greaterThanEqual(0.004), () => {
        // (under that, too far out to show: the GLSL's continue)
        const p = d.add(twist.mul(0.25)).mul(float(2).div(shape.x)).add(float(i).mul(7.3)).add(seed).toVar();
        const q = vec3(fbm4(p), fbm4(p.add(vec3(3.1, 7.7, 1.9))), fbm4(p.add(vec3(8.3, 2.8, 5.4)))).sub(0.47).toVar();
        const gas = fbm7(p.add(q.mul(1.8).mul(shape.y)));
        const rift = smoothstep(0.56, 0.8, fbm4(p.mul(1.9).add(q.mul(2)).add(17)));
        const body = smoothstep(0.25, 0.9, gas.mul(m.mul(0.9).add(0.55))).mul(sqrt(m)).mul(float(1).sub(rift.mul(0.75))).toVar();
        const tint = mix(tone, vec3(dot(tone, vec3(0.45))), body.mul(body).mul(0.4));
        col.addAssign(tint.mul(body).mul(0.15).add(tone.mul(m).mul(0.01)).mul(float(1).sub(dust.mul(0.85))));
      });
    }
    // and the dark between
    col.addAssign(vec3(0.0035, 0.005, 0.011));
    // the game's own star field under it all (equirectangular: u round the
    // horizon, v up it), at its sharpest level so the seam's jump in u can't
    // pick a blurrier one along the join
    If(u.uPanoOn.greaterThan(0.5), () => {
      const at = vec2(atan(d.z, d.x).mul(0.15915494).add(0.5), asin(clamp(d.y, -1, 1)).mul(0.31830989).add(0.5));
      col.addAssign(u.uPano.node.sample(at).level(0).rgb);
    });
    // half a step of the cube's 8 bits either way before they round it, so
    // its long faint gradients come out smooth, not in steps
    const n = hash3(vec3(screenCoordinate.xy, seed.add(7))).sub(0.5);
    return sRGBTransferEOTF(max(sRGBTransferOETF(col).add(n.div(255)), 0));
  })();
  return mat;
}

// a point as the GLSL drew it, gl_PointSize pixels square: a quad, its
// corner (−½…½) out from the star's place by that many pixels; the corner
// as gl_PointCoord (0…1, y down) for the fragment
const corner = attribute('aCorner', 'vec2');
const pointCoord = vec2(corner.x.add(0.5), float(0.5).sub(corner.y)).toVarying('vPointCoord');
const pointClip = (sizePx, k) => {
  const p = farClip(modelViewMatrix.mul(vec4(attribute('position', 'vec3'), 1)), k);
  const off = corner.mul(sizePx).div(viewportSize.mul(0.5)).mul(p.w);
  return vec4(p.xy.add(off), p.z, p.w);
};
function pointsGeometry(n, attrs) {
  const geo = new THREE.InstancedBufferGeometry();
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.setAttribute('aCorner', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5]), 2));
  for (const [name, size] of Object.entries(attrs)) geo.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(n * size), size));
  geo.instanceCount = n;
  return geo;
}

// the stars (STAR_VERT, STAR_FRAG)
function starMaterial() {
  const u = { uDpr: uniform(1) };
  const mat = additive();
  mat.uniforms = u;
  mat.vertexNode = pointClip(clamp(attribute('aSize', 'float').mul(u.uDpr), 1, u.uDpr.mul(5)));
  const color = attribute('aColor', 'vec3').toVarying('vColor');
  mat.colorNode = color.mul(rev(0.5, 0.1, length(pointCoord.sub(0.5))));
  return mat;
}

// the other systems' stars: each a hot point in a glare with a cross of
// spikes, a size on screen whatever the screen; the picked one pulses
// (BEACON_VERT, BEACON_FRAG)
function beaconMaterial() {
  const u = { uDpr: uniform(1), uTime: uniform(0) };
  const mat = additive();
  mat.uniforms = u;
  const focusV = attribute('aFocus', 'float');
  const pulse = focusV.mul(sin(u.uTime.mul(6)).mul(0.2).add(0.45)).add(1);
  mat.vertexNode = pointClip(attribute('aSize', 'float').mul(u.uDpr).mul(pulse), 0.99998);
  const color = attribute('aColor', 'vec3').toVarying('vColor');
  const focus = focusV.toVarying('vFocus');
  mat.colorNode = Fn(() => {
    const q = pointCoord.mul(2).sub(1).toVar();
    const r = length(q).toVar();
    const core = rev(0.2, 0.05, r);
    const glow = exp(r.negate().mul(5.5)).mul(0.9);
    const spikes = exp(abs(q.x).negate().mul(30)).add(exp(abs(q.y).negate().mul(30))).mul(float(1).sub(r)).mul(focus.mul(0.8).add(0.5));
    const c = color.mul(glow.add(spikes)).add(vec3(focus.mul(1.4).add(1.6)).mul(core));
    return c.mul(rev(1, 0.75, r));
  })();
  return mat;
}

// a star of its own: a white-hot disc in a glare, with faint rays (SUN_VERT, SUN_FRAG)
function sunMaterial() {
  const u = { uColor: uniform(new THREE.Color()) };
  const mat = additive();
  mat.uniforms = u;
  const mv = modelViewMatrix.mul(vec4(0, 0, 0, 1));
  const scale = vec2(length(modelWorldMatrix.element(0).xyz), length(modelWorldMatrix.element(1).xyz));
  mat.vertexNode = farClip(vec4(mv.xy.add(positionLocal.xy.mul(scale)), mv.z, mv.w));
  mat.colorNode = Fn(() => {
    const p = uv().mul(2).sub(1).toVar();
    const r = length(p).toVar();
    const disc = rev(0.075, 0.06, r);
    const glow = exp(r.negate().mul(9)).mul(0.9).add(exp(r.negate().mul(3.2)).mul(0.22));
    const a = atan(p.y, p.x).toVar();
    const rays = pow(abs(cos(a.mul(3))), 60).mul(exp(r.negate().mul(4))).mul(0.35).add(pow(abs(cos(a.mul(2).add(0.6))), 90).mul(exp(r.negate().mul(5))).mul(0.25));
    const c = u.uColor.mul(glow.add(rays)).add(vec3(6).mul(disc));
    return c.mul(rev(1, 0.7, r));
  })();
  return mat;
}

// the same numbers for the same system, every visit (and for every pilot)
function seeded(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const NEBULAE = [
  ['#c4508f', '#4f7fd0'],
  ['#5fa8c8', '#9a5fc8'],
  ['#d07a4a', '#4a9a8a'],
  ['#7a5fd0', '#d05f7a'],
];

// A system's nebulae (../sky.js's, number for number): three clouds of
// glowing gas, each with the way to it, its colour, its size (radians) and
// how twisted it is; the first two from the system's numbers just after the
// sky's seed, the third, the sizes and the twists from numbers of their own.
function nebulaeFrom(sys, rand) {
  const more = seeded(`${sys.id}/nebulae`);
  const toward = (r) => {
    const v = new THREE.Vector3(r() * 2 - 1, (r() * 2 - 1) * 0.5, r() * 2 - 1).normalize();
    return [v.x, v.y, v.z];
  };
  const dirs = [toward(rand), toward(rand)];
  const k = Math.floor(rand() * NEBULAE.length);
  const other = NEBULAE[(k + 1 + Math.floor(more() * (NEBULAE.length - 1))) % NEBULAE.length];
  const colors = [...NEBULAE[k], other[more() < 0.5 ? 0 : 1]];
  dirs.push(toward(more));
  return dirs.map((dir, i) => ({ dir, color: colors[i], size: 0.18 + more() * 0.27, warp: 0.6 + more() }));
}
export function nebulaeOf(sys) {
  const rand = seeded(sys.id);
  rand(); // (the sky's seed)
  return nebulaeFrom(sys, rand);
}

// the size of a face of the baked sky, in pixels, by lib/device's detail level
const BAKE = { ultra: 2048, high: 1536, mid: 1024, low: 512 };
export const bakeSize = ({ small = false, level = null } = {}) => (small ? 512 : (BAKE[level] ?? 1024));
// and how many stars it has: today's 4,200 first, the rest fainter
const STAR_COUNT = { ultra: 12000, high: 12000, mid: 7000, low: 3000 };
export const starCount = ({ small = false, level = null } = {}) => (small ? 3000 : (STAR_COUNT[level] ?? TODAY));

export function createSky({ small = false, level = null, renderer = null, beacons: showBeacons = true, clouds = true } = {}) {
  const group = new THREE.Group();
  group.renderOrder = -20;
  const made = [];
  let gone = false;

  // the cube the galaxy's baked into, once a system (no mipmaps: the sky's
  // only ever magnified, and at 2048 they'd be another third)
  const cube = new CubeRenderTarget(bakeSize({ small, level }), { type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace, generateMipmaps: false, minFilter: THREE.LinearFilter });
  const cubeCamera = new THREE.CubeCamera(1, 10000, cube);

  // the sphere you see: it looks the baked cube up (black till there is one)
  const skyGeo = new THREE.SphereGeometry(SKY_R, 64, 32);
  const lookMat = lookMaterial(cube);
  const sky = new THREE.Mesh(skyGeo, lookMat);
  sky.renderOrder = -20;
  sky.frustumCulled = false;
  group.add(sky);
  made.push(skyGeo, lookMat);

  // what's baked into it: the same sphere, with the galaxy's shader on it,
  // alone in a scene of its own, seen by the cube camera from its middle
  const bakeMat = bakeMaterial();
  made.push(bakeMat);
  const bakeScene = new THREE.Scene();
  const bakeSphere = new THREE.Mesh(skyGeo, bakeMat);
  bakeSphere.frustumCulled = false;
  bakeScene.add(bakeSphere);

  // the stars: positions made per system (setSystem), drawn in one go
  const n = starCount({ small, level });
  const starGeo = pointsGeometry(n, { position: 3, aSize: 1, aColor: 3 });
  const starMat = starMaterial();
  const stars = new THREE.Mesh(starGeo, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = -19;
  group.add(stars);
  made.push(starGeo, starMat);

  // the system's suns (up to two)
  const sunGeo = new THREE.PlaneGeometry(2, 2);
  made.push(sunGeo);
  const suns = [0, 1].map(() => {
    const mat = sunMaterial();
    const m = new THREE.Mesh(sunGeo, mat);
    m.frustumCulled = false;
    m.renderOrder = -18;
    m.visible = false;
    group.add(m);
    made.push(mat);
    return m;
  });
  const sunDirs = [];

  // the other systems' stars (all but the one you're in)
  const nb = SYSTEMS.length - 1;
  const beaconGeo = pointsGeometry(nb, { position: 3, aSize: 1, aColor: 3, aFocus: 1 });
  const beaconMat = beaconMaterial();
  const beaconPoints = new THREE.Mesh(beaconGeo, beaconMat);
  beaconPoints.frustumCulled = false;
  beaconPoints.renderOrder = -17;
  beaconPoints.visible = showBeacons;
  group.add(beaconPoints);
  made.push(beaconGeo, beaconMat);
  const beacons = [];
  const beaconColor = new THREE.Color();
  let focused = null;

  const tints = [
    [1, 1, 1],
    [0.78, 0.86, 1],
    [1, 0.9, 0.76],
    [1, 0.78, 0.62],
  ];

  // the game's star field for the system, loaded once a system and baked
  // in again when it's here (null: none, the sky as it was)
  let baked = null;
  let wanted = null;
  const panoramas = new Map(); // url → Promise<texture | null>
  const setPanorama = (sys) => {
    const url = panoramaUrl(sys, level);
    wanted = url;
    bakeMat.uniforms.uPanoOn.value = 0;
    bakeMat.uniforms.uPano.value = null;
    if (!url) return;
    if (!panoramas.has(url)) panoramas.set(url, loadPanorama(url, renderer));
    panoramas.get(url).then((tex) => {
      if (gone || !tex || wanted !== url) return;
      bakeMat.uniforms.uPano.value = tex;
      bakeMat.uniforms.uPanoOn.value = 1;
      if (baked) out.bake(baked);
    });
  };
  made.push({ dispose: () => panoramas.forEach((p) => p.then((t) => t?.dispose())) });

  const out = {
    group,
    // the directions toward the system's suns, unit vectors (bodies.js lights by them)
    sunDirs,
    beacons,
    setSystem(sys) {
      setPanorama(sys);
      const rand = seeded(sys.id);
      const { dir, d } = coreBearing(sys);
      const near = Math.max(0, 1 - d / RIM);
      // what the bake draws (bake: until then the sky is the last system's)
      const u = bakeMat.uniforms;
      u.uCore.value.set(...dir);
      u.uNear.value = near * near * 0.85 + near * 0.15;
      u.uSide.value = Math.min(0.95, Math.max(0, (d / RIM - 0.45) * 1.6));
      u.uSeed.value = rand() * 40;
      nebulaeFrom(sys, rand).forEach((nb, i) => {
        u.uNebDir.value[i].set(...nb.dir);
        u.uNebCol.value[i].set(clouds ? nb.color : 0x000000);
        u.uNebShape.value[i].set(nb.size, nb.warp);
      });
      // the stars: half anywhere, the rest along the band, thickest toward the core
      const pos = starGeo.attributes.position.array;
      const size = starGeo.attributes.aSize.array;
      const col = starGeo.attributes.aColor.array;
      const v = new THREE.Vector3();
      const core = new THREE.Vector3(...dir);
      for (let i = 0; i < n; i++) {
        const k = rand();
        if (k < 0.5) v.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
        else {
          const a = rand() * Math.PI * 2;
          const lat = (rand() + rand() + rand() - 1.5) * 0.16;
          v.set(Math.cos(a), lat, Math.sin(a));
          if (k > 0.82) v.lerp(core, rand() * 0.45 * near + 0.05);
        }
        v.normalize();
        // fewer on the empty side, out at the rim
        if (u.uSide.value > 0.2 && v.dot(core) < -0.2 && rand() < u.uSide.value * 0.7) v.lerp(core, 0.9).normalize();
        pos[i * 3] = v.x * SKY_R * 0.98;
        pos[i * 3 + 1] = v.y * SKY_R * 0.98;
        pos[i * 3 + 2] = v.z * SKY_R * 0.98;
        const b = (0.18 + rand() ** 3 * 0.9) * (i < TODAY ? 1 : STARS_PAST);
        const t = tints[rand() < 0.66 ? 0 : Math.floor(rand() * tints.length)];
        col[i * 3] = t[0] * b;
        col[i * 3 + 1] = t[1] * b;
        col[i * 3 + 2] = t[2] * b;
        size[i] = 0.8 + rand() ** 5 * 2.6;
      }
      starGeo.attributes.position.needsUpdate = true;
      starGeo.attributes.aSize.needsUpdate = true;
      starGeo.attributes.aColor.needsUpdate = true;
      // its suns
      sunDirs.length = 0;
      suns.forEach((m, i) => {
        const s = sys.suns[i];
        m.visible = Boolean(s);
        if (!s) return;
        const d3 = new THREE.Vector3(...s.dir).normalize();
        sunDirs.push(d3);
        m.position.copy(d3).multiplyScalar(SUN_R);
        m.scale.setScalar(SUN_R * 0.11 * s.size);
        m.material.uniforms.uColor.value.set(s.color).multiplyScalar(2.2);
      });
      // the other systems: their stars where they are, the nearer the bigger
      // and brighter (each in its own star's colour; two suns, a bit more)
      beacons.length = 0;
      focused = null;
      const bp = beaconGeo.attributes.position.array;
      const bs = beaconGeo.attributes.aSize.array;
      const bc = beaconGeo.attributes.aColor.array;
      const bf = beaconGeo.attributes.aFocus.array;
      for (const o of SYSTEMS) {
        if (o === sys) continue;
        const i = beacons.length;
        const dir = new THREE.Vector3(...courseTo(sys, o));
        beacons.push({ id: o.id, dir });
        bp[i * 3] = dir.x * SKY_R * 0.97;
        bp[i * 3 + 1] = dir.y * SKY_R * 0.97;
        bp[i * 3 + 2] = dir.z * SKY_R * 0.97;
        const d = distance(sys, o);
        const near = 1 / (1 + d * 0.35);
        bs[i] = 9 + 16 * near + (o.suns.length > 1 ? 3 : 0);
        beaconColor.set(o.suns[0].color).lerp(new THREE.Color('#ffffff'), 0.25).multiplyScalar(1.1 + 2.4 * near);
        bc[i * 3] = beaconColor.r;
        bc[i * 3 + 1] = beaconColor.g;
        bc[i * 3 + 2] = beaconColor.b;
        bf[i] = 0;
      }
      // (the draw range: no more than there's room for, as the GLSL's buffer had)
      beaconGeo.instanceCount = Math.min(beacons.length, nb);
      for (const a of Object.values(beaconGeo.attributes)) a.needsUpdate = true;
    },
    // the star picked (an id, or null): it pulses
    focus(id) {
      if (id === focused) return;
      focused = id;
      const bf = beaconGeo.attributes.aFocus.array;
      beacons.forEach((b, i) => (bf[i] = b.id === id ? 1 : 0));
      beaconGeo.attributes.aFocus.needsUpdate = true;
    },
    // the sky and its stars round the camera, wherever it flies
    update(camera, t = 0) {
      group.position.copy(camera.position);
      beaconMat.uniforms.uTime.value = t;
    },
    setRatio(dpr) {
      starMat.uniforms.uDpr.value = dpr;
      beaconMat.uniforms.uDpr.value = dpr;
    },
    // the bake's shader made now, as the bake will draw it (into the cube:
    // the node renderer's pipeline is the target's); resolves once it has
    prepare(r = renderer) {
      if (gone || !r) return Promise.resolve();
      const job = Promise.resolve(r.initialized === false ? r.init() : null).then(() => {
        if (gone) return null;
        const was = { target: r.getRenderTarget(), face: r.getActiveCubeFace(), level: r.getActiveMipmapLevel() };
        r.setRenderTarget(cube);
        try {
          return r.compileAsync(bakeScene, cubeCamera.children[0], bakeScene);
        } finally {
          r.setRenderTarget(was.target, was.face, was.level);
        }
      });
      return job.then(
        () => {},
        () => {},
      );
    },
    // the system's sky (setSystem's) drawn into the cube, once, and the
    // sphere looking it up from then on; the renderer is left as it was
    bake(r = renderer) {
      if (gone || !r) return;
      baked = r;
      const was = { target: r.getRenderTarget(), face: r.getActiveCubeFace(), level: r.getActiveMipmapLevel(), autoClear: r.autoClear, toneMapping: r.toneMapping, xr: r.xr?.enabled };
      r.autoClear = true;
      r.toneMapping = THREE.NoToneMapping;
      try {
        cubeCamera.update(r, bakeScene);
      } finally {
        r.setRenderTarget(was.target, was.face, was.level);
        r.autoClear = was.autoClear;
        r.toneMapping = was.toneMapping;
        if (r.xr) r.xr.enabled = was.xr;
      }
      lookMat.uniforms.uSky.value = cube.texture;
    },
    dispose() {
      gone = true;
      for (const x of made) x.dispose();
      cube.dispose();
    },
  };
  return out;
}

// a panorama's KTX2, through the site's loader (lib/three/gltf.js's, its
// transcoder fetched the first time) and the asset base; null if it fails
function loadPanorama(url, renderer) {
  return Promise.all([import('../../../lib/three/gltf'), import('../../../lib/assetBase')])
    .then(([{ ktx2Loader }, { withFallback }]) => ktx2Loader({ renderer }).then((k) => withFallback((u) => k.loadAsync(u))(url)))
    .then((tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    })
    .catch(() => null);
}

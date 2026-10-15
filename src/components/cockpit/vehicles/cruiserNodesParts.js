// The pieces ./cruiserNodes.js builds Rick’s cruiser from, on the node
// renderer: cruiser.js’s own helpers, the same, their shaders line for line
// in TSL (the ink line’s push out along the normals in view space, the
// cel snap of Morty’s texture to the show’s colours, the portal’s swirl,
// the dusk sky’s bands and the dome’s glass). Split from cruiserNodes.js to
// keep each file under the size the rules allow; cruiser.js has them inline.
//
//   ink(root, width, { skip }) → the line’s MeshBasicNodeMaterial
//   flatRamp(), cel(color, extra), drawnSkin(map, palette)
//   elbow(S, W, a, b, pole, out), setBetween(mesh, a, b), UP
//   hand(skin), portalGun(m), portalDisc() → { mesh, u }, duskSky(), domeMaterial()

import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshToonNodeMaterial } from 'three/webgpu';
import {
  Fn, If, abs, dot, float, floor, fract, materialColor, max, mix, normalLocal, normalize, positionLocal, positionViewDirection,
  select, smoothstep, sqrt, step, transformNormalToView, uniform, uv, vec3, vec4,
} from 'three/tsl';
import { swirl } from '../../../lib/three/portalFxNodes';
import { wrap } from '../../../lib/three/hookNodes';
import { roundedBox } from '../kitNodes';

export const INK = 0x1b1424;

// (GLSL’s smoothstep with its edges reversed, as nodes)
const fall = (a, b, x) => smoothstep(b, a, x).oneMinus();

// The ink line: each mesh’s back faces drawn flat dark, pushed out along
// the normals in view space (so `width` is in metres whatever the scale),
// skinned meshes included. (project_vertex’s push is the material’s view
// position, after three has skinned the normal. A skinned mesh’s was the
// GLSL’s transformedNormal, which three turns round on a back-side
// material: its hull went in, not out, and drew no line round it. Kept, so
// Morty looks as he did: the twin draws what the original drew.)
export function ink(root, width, { skip = () => false } = {}) {
  const mat = new MeshBasicNodeMaterial({ color: INK, side: THREE.BackSide });
  wrap(
    mat,
    'setupPositionView',
    (pv, builder) => {
      const n = normalize(transformNormalToView(normalLocal));
      return pv.add((builder.object?.isSkinnedMesh ? n.negate() : n).mul(width).mul(max(1, pv.z.negate().mul(0.35))));
    },
    `cockpit-ink-${width}`,
  );
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh && !o.userData.ink && !skip(o)) meshes.push(o);
  });
  for (const o of meshes) {
    let h;
    if (o.isSkinnedMesh) {
      h = new THREE.SkinnedMesh(o.geometry, mat);
      h.bind(o.skeleton, o.bindMatrix);
      h.bindMode = o.bindMode;
    } else h = new THREE.Mesh(inkShape(o.geometry), mat);
    h.userData.ink = true;
    h.frustumCulled = false;
    h.renderOrder = o.renderOrder;
    // a child of its mesh, so it moves with it
    o.add(h);
  }
  return mat;
}

// The line round a hard-edged shape (a box’s faces each have their own
// normals at its corners) would split open at the edges: it’s drawn from a
// copy whose normals are averaged where points meet, so it stays whole.
const inked = new WeakMap();
function inkShape(geo) {
  if (inked.has(geo)) return inked.get(geo);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', geo.attributes.position);
  if (geo.index) g.setIndex(geo.index);
  const pos = geo.attributes.position;
  const key = (i) => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
  const sum = new Map();
  const nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    const v = sum.get(k) ?? [0, 0, 0];
    if (nrm) {
      v[0] += nrm.getX(i);
      v[1] += nrm.getY(i);
      v[2] += nrm.getZ(i);
    }
    sum.set(k, v);
  }
  const out = new Float32Array(pos.count * 3);
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const v = sum.get(key(i));
    n.set(v[0], v[1], v[2]).normalize();
    out.set([n.x, n.y, n.z], i * 3);
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  inked.set(geo, g);
  return g;
}

// The show’s light: flat colour and one soft step of shadow, no more.
let ramp = null;
export function flatRamp() {
  if (ramp) return ramp;
  ramp = new THREE.DataTexture(new Uint8Array([196, 196, 196, 255, 255, 255, 255, 255]), 2, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
}
export const cel = (color, extra = {}) => new MeshToonNodeMaterial({ color, gradientMap: flatRamp(), ...extra });

// A Meshy character’s texture as a cel: every texel snapped to the nearest
// of the show’s colours for them (the darkest stay ink), so the soft paint
// and smudges a generated texture has come out as clean flat shapes.
// (map_fragment’s swap: the material’s colour, its map in, is the diffuse
// the GLSL read; uPal an element a uniform node, on `material.uniforms`)
export function drawnSkin(map, palette) {
  const m = cel(0xffffff, { map });
  const uPal = palette.map((c) => uniform(new THREE.Color(c)));
  m.uniforms = { uPal };
  m.colorNode = Fn(() => {
    const diffuse = vec4(materialColor).toVar();
    const c = sqrt(max(diffuse.rgb, 0)).toVar();
    const best = vec3(uPal[0]).toVar();
    const bd = float(1e9).toVar();
    for (const p of uPal) {
      const d = c.sub(sqrt(p));
      const e = dot(d, d).toVar();
      If(e.lessThan(bd), () => {
        bd.assign(e);
        best.assign(p);
      });
    }
    const lum = dot(diffuse.rgb, vec3(0.2126, 0.7152, 0.0722));
    return vec4(select(lum.lessThan(0.025), vec3(0.008, 0.005, 0.012), best), diffuse.a);
  })();
  return m;
}

// Two bones, shoulder to wrist: where the elbow goes, bent towards `pole`.
const _d = new THREE.Vector3();
const _p = new THREE.Vector3();
export function elbow(S, W, a, b, pole, out) {
  _d.subVectors(W, S);
  const len = Math.min(a + b - 1e-3, Math.max(Math.abs(a - b) + 1e-3, _d.length()));
  _d.normalize();
  const x = (a * a - b * b + len * len) / (2 * len);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  _p.copy(pole).addScaledVector(_d, -pole.dot(_d)).normalize();
  return out.copy(S).addScaledVector(_d, x).addScaledVector(_p, h);
}

// A length of sleeve between two points: a cylinder stood on its end, set
// between them each frame.
export const UP = new THREE.Vector3(0, 1, 0);
export function setBetween(mesh, a, b) {
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  _d.subVectors(b, a);
  mesh.scale.set(1, Math.max(0.001, _d.length()), 1);
  mesh.quaternion.setFromUnitVectors(UP, _d.normalize());
}

// Rick’s hand, a cartoon’s: a palm, four fingers curled into a grip, and a
// thumb; it reaches along +z from the wrist.
export function hand(skin) {
  const g = new THREE.Group();
  const palm = new THREE.Mesh(roundedBox(0.07, 0.03, 0.075, 0.012), skin);
  palm.position.set(0, 0, 0.045);
  g.add(palm);
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.03, 4, 8), skin);
    f.rotation.x = Math.PI / 2 + 0.9;
    f.position.set(-0.026 + i * 0.0175, -0.018, 0.088);
    g.add(f);
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.03, 4, 8), skin);
  thumb.rotation.set(Math.PI / 2, 0, -0.7);
  thumb.position.set(-0.04, 0.008, 0.05);
  g.add(thumb);
  return g;
}

// Rick’s portal gun, as the show draws it: a chunky grey-white body with a
// grip, a round glass bulb of green fluid on top, the emitter at the front
// with its green light, a dial on the side. Points along +z.
export function portalGun(m) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(roundedBox(0.058, 0.05, 0.13, 0.014), m.gun);
  body.position.set(0, 0.03, 0.06);
  const grip = new THREE.Mesh(roundedBox(0.034, 0.075, 0.038, 0.01), m.gunDark);
  grip.position.set(0, -0.012, 0.012);
  grip.rotation.x = -0.25;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.019, 0.04, 16), m.gunDark);
  neck.rotation.x = Math.PI / 2;
  neck.position.set(0, 0.03, 0.14);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 8, 20), m.gunDark);
  lip.position.set(0, 0.03, 0.161);
  const light = new THREE.Mesh(new THREE.CircleGeometry(0.014, 20), m.green);
  light.position.set(0, 0.03, 0.163);
  light.userData.noInk = true;
  const fluid = new THREE.Mesh(new THREE.SphereGeometry(0.02, 18, 12), m.green);
  fluid.position.set(0, 0.07, 0.07);
  fluid.userData.noInk = true;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.025, 18, 12), m.bulb);
  bulb.position.copy(fluid.position);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.012, 16), m.gunDark);
  cap.position.set(0, 0.055, 0.07);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.012, 16), m.gunDark);
  dial.rotation.z = Math.PI / 2;
  dial.position.set(-0.034, 0.035, 0.03);
  g.add(body, grip, neck, lip, light, cap, fluid, bulb, dial);
  g.userData.tip = light;
  return g;
}

// the show’s portal on a disc: `open` grows it from a point (the swirl is
// lib/three/portalFxNodes’s, swirl.js’s portal() as nodes; the GLSL wrote
// its colour premultiplied, and the node material multiplies by the alpha
// itself where premultipliedAlpha is set, so it’s divided out here)
export function portalDisc() {
  const PAD = 1.22;
  const u = { t: uniform(0), open: uniform(0), seed: uniform(3.7) };
  const mat = new MeshBasicNodeMaterial({ transparent: true, premultipliedAlpha: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
  const c = swirl(uv().mul(2).sub(1).mul(PAD), u.t, u.open, u.seed);
  mat.colorNode = c.rgb.div(max(c.a, 0.004));
  mat.opacityNode = c.a;
  mat.maskNode = c.a.greaterThanEqual(0.004);
  mat.uniforms = u;
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 64), mat);
  return { mesh, u };
}

// a dusk sky in a few flat bands, as the show paints one, with the first stars
const skyHash = (q) => {
  const p = fract(q.mul(0.3183099).add(0.1)).mul(17);
  return fract(p.x.mul(p.y).mul(p.z).mul(p.x.add(p.y).add(p.z)));
};
export function duskSky() {
  const uNight = uniform(0);
  const mat = new MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, toneMapped: false, fog: false });
  const vDir = normalize(positionLocal).toVarying('vDir');
  mat.colorNode = Fn(() => {
    const h = vDir.y;
    // horizon peach, rose, violet, deep indigo: stepped, not smooth
    const c = vec3(0.98, 0.72, 0.52).toVar();
    c.assign(mix(c, vec3(0.93, 0.52, 0.55), step(0.04, h)));
    c.assign(mix(c, vec3(0.62, 0.38, 0.62), step(0.12, h)));
    c.assign(mix(c, vec3(0.32, 0.24, 0.52), step(0.24, h)));
    c.assign(mix(c, vec3(0.14, 0.12, 0.33), step(0.42, h)));
    // the glow where the sun went down, behind you
    c.addAssign(vec3(0.25, 0.12, 0.02).mul(smoothstep(0.6, 1.0, vDir.z.negate())).mul(fall(0.3, 0.0, h)));
    // stars, up high
    const g = floor(vDir.mul(260));
    const s = step(0.997, skyHash(g)).mul(smoothstep(0.18, 0.5, h));
    return c.add(vec3(s));
  })();
  mat.uniforms = { uNight };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
  dome.renderOrder = -10;
  return dome;
}

// the dome: a bubble of glass, faintly cyan, white where it turns away
// (color_fragment’s line: the alpha by how far the glass turns from the eye)
export function domeMaterial() {
  const mat = new MeshBasicNodeMaterial({ color: 0xc8f4f4, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const vN = transformNormalToView(normalLocal).toVarying('vN');
  const f = float(1).sub(abs(dot(normalize(vN), positionViewDirection)));
  mat.opacityNode = f.mul(f).mul(0.5).add(0.05);
  return mat;
}

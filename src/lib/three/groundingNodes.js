// grounding.js on the node renderer: the same three layers (the floor's
// baked masks, the bounce, the blobs under what moves), as node hooks
// (./hookNodes.js) on node materials instead of chunk swaps on classic
// ones. Same names, same arguments, same uniforms (now uniform nodes under
// the names the GLSL had: userData.floorShadow.uShadeMix.value…), so a
// caller changes only the file it imports from.
//
//   floorShadow(material, bake)   the floor: the sun's light cut by the mask (directional lights alone, as
//                                 getDirectionalLightInfo was), the indirect by the sky's, the dark warmed
//   standIn(material, bake)       a mover dims in the floor's baked shade
//   bounce(material, opts)        the floor's colour on low, downward faces
//   createBlobShadows(opts)       a soft pool under each mover, one instanced draw
//   setFloorTime, setFloorMask, maskWeights, blobPlacement, shadeTint, SHADE_TINT, BOUNCE, loadFloorShadow
//
// A material passed in may be a classic one: it comes back as its node
// twin (hookNodes' asNode), so use what's returned. The pure helpers are
// grounding.js's, copied, not imported: importing them would bring its
// GLSL into a 'nodes' world's closure. grounding.js keeps its own until its
// last GLSL caller moves, and then re-exports these.

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, attribute, clamp, cos, dot, float, length, max, min, mix, modelWorldMatrix, normalWorldGeometry, normalize, positionWorld, pow, select, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { forgetTexture, loadTexture } from './textures';
import { asNode, colourOf, instanceMatrixOf, isSun, onColor, onDirect, onIndirect, onLight } from './hookNodes';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ── the time of day, between the masks (grounding.js's, the same) ──

export function maskWeights(tod, times) {
  if (!times?.length) return [3, 3, 0];
  const t = (((tod % 1) + 1) % 1) || 0;
  const list = [...times].sort((a, b) => a.tod - b.tod);
  let i = list.length - 1;
  for (let k = 0; k < list.length; k++) if (list[k].tod <= t) i = k;
  const a = list[i];
  const b = list[(i + 1) % list.length];
  if (list.length === 1) return [a.channel, a.channel, 0];
  let span = b.tod - a.tod;
  if (span <= 0) span += 1;
  let into = t - a.tod;
  if (into < 0) into += 1;
  return [a.channel, b.channel, clamp01(into / span)];
}

export const SHADE_TINT = { luminance: 0.45, saturation: 0.6, mix: 0.65 };

export function shadeTint(color, luminance = SHADE_TINT.luminance, saturation = 1) {
  const c = new THREE.Color(color);
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  if (l <= 0) return c.setRGB(luminance, luminance, luminance);
  c.multiplyScalar(luminance / l);
  return c.setRGB(luminance + (c.r - luminance) * saturation, luminance + (c.g - luminance) * saturation, luminance + (c.b - luminance) * saturation);
}

// ── the floor's masks ──

// gPick: a mask's channel by number (0 R, 1 G, 2 B, 3 none: full sun)
const pick = (m, c) => select(c.lessThan(0.5), m.r, select(c.lessThan(1.5), m.g, select(c.lessThan(2.5), m.b, float(1))));

// gRead: the sun's and the sky's share at a world point, 1 and 1 outside
// every mask; a later area wins where two overlap, as the GLSL's loop did
function readMasks(u, p) {
  let v = vec2(1, 1);
  u.uMask.forEach((mask, i) => {
    const rect = u.uMaskRect[i];
    const at = p.xz.sub(rect.xy).mul(rect.zw);
    const inside = at.x.greaterThan(0).and(at.y.greaterThan(0)).and(at.x.lessThan(1)).and(at.y.lessThan(1));
    const m = mask.sample(at);
    v = select(inside, vec2(mix(pick(m, u.uMaskMix.x), pick(m, u.uMaskMix.y), u.uMaskMix.z), m.a), v);
  });
  return v;
}

// The uniforms every floor material of one bake shares, so a frame sets the
// time once for all of them: uMask and uMaskRect are arrays of nodes, one
// an area (the GLSL's sampler and vec4 arrays).
const shared = new WeakMap();
function floorUniforms(bake) {
  let u = shared.get(bake);
  if (!u) {
    const shade = bake.shade?.isColor ? bake.shade : new THREE.Color(bake.shade ?? 0x5a3420);
    u = {
      uMask: bake.areas.map((a) => texture(a.texture)),
      uMaskRect: bake.areas.map((a) => uniform(new THREE.Vector4(a.x0, a.z0, 1 / a.w, 1 / a.d))),
      uMaskMix: uniform(new THREE.Vector3(3, 3, 0)),
      uShadeTint: uniform(shadeTint(shade, bake.shadeLuminance ?? SHADE_TINT.luminance, SHADE_TINT.saturation)),
      uShadeMix: uniform(bake.shadeMix ?? SHADE_TINT.mix),
      uSunFloor: uniform(bake.sunFloor ?? 0),
    };
    shared.set(bake, u);
  }
  return u;
}

const nodesOf = (u) => ({ ...u, ...Object.fromEntries(u.uMask.map((m, i) => [`m${i}`, m])), ...Object.fromEntries(u.uMaskRect.map((r, i) => [`r${i}`, r])) });

// The masks read once a fragment, at its start (after the colour), and kept
// in a variable the light's hooks read: one read however many lights.
function hookMasks(material, u, { mover, tag }) {
  const reads = new WeakMap(); // builder → the variable
  onColor(
    material,
    (_, builder) => {
      let gV = readMasks(u, positionWorld);
      if (mover) gV = select(positionWorld.y.lessThan(u.uMoverRange.x).or(positionWorld.y.greaterThan(u.uMoverRange.y)), vec2(1, 1), gV);
      reads.set(builder, vec2(0, 0).toVar('gV').assign(gV));
      return null;
    },
    `${tag}:read`,
    nodesOf(u),
  );
  return (builder) => reads.get(builder) ?? vec2(1, 1);
}

function shadowHooks(material, u, { mover, tag }) {
  const read = hookMasks(material, u, { mover, tag });
  // (a mover in shade keeps some of the sun, a floor uSunFloor of it: grounding.js says why)
  onDirect(
    material,
    (input, call, builder) => {
      if (!isSun(input.lightNode)) return call();
      const gSun = read(builder).x;
      const cut = mover ? mix(0.45, 1, gSun) : mix(u.uSunFloor, 1, gSun);
      return call({ ...input, lightColor: input.lightColor.mul(cut) });
    },
    `${tag}:sun`,
  );
  onIndirect(
    material,
    (reflected, builder) => {
      const gSky = mix(mover ? 0.7 : 0.35, 1, read(builder).y);
      reflected.indirectDiffuse.mulAssign(gSky);
      reflected.indirectSpecular.mulAssign(gSky);
    },
    `${tag}:sky`,
  );
  if (!mover) {
    onLight(
      material,
      (light, builder) => {
        const gV = read(builder);
        return light.mul(mix(vec3(1, 1, 1), u.uShadeTint, u.uShadeMix.mul(min(gV.x, gV.y).oneMinus())));
      },
      `${tag}:shade`,
    );
  }
  return material;
}

export function floorShadow(material, bake) {
  if (!material || !bake?.areas?.length) return material;
  const m = asNode(material);
  const uniforms = floorUniforms(bake);
  shadowHooks(m, uniforms, { mover: false, tag: `floorShadow:${bake.areas.length}` });
  m.userData.floorShadow = uniforms;
  return m;
}

export function setFloorMask(bake, index, tex) {
  const area = bake?.areas?.[index];
  if (!area) return;
  area.texture = tex;
  const u = shared.get(bake);
  if (u) u.uMask[index].value = tex;
}

export function standIn(material, bake) {
  if (!material || !bake?.areas?.length || material.userData?.standIn) return material;
  const m = asNode(material);
  const f = floorUniforms(bake);
  const [lo, hi] = bake.range ?? [-1e9, 1e9];
  const uniforms = { uMask: f.uMask, uMaskRect: f.uMaskRect, uMaskMix: f.uMaskMix, uShadeTint: uniform(new THREE.Color(1, 1, 1)), uShadeMix: uniform(0), uSunFloor: uniform(0), uMoverRange: uniform(new THREE.Vector2(lo - 2, hi + 8)) };
  shadowHooks(m, uniforms, { mover: true, tag: `standIn:${bake.areas.length}` });
  m.userData.standIn = uniforms;
  return m;
}

export function setFloorTime(bake, tod, sun = 1) {
  if (!bake?.areas?.length) return;
  const [a, b, t] = maskWeights(tod, bake.times);
  const u = floorUniforms(bake);
  u.uMaskMix.value.set(a, b, t);
  u.uShadeMix.value = (bake.shadeMix ?? SHADE_TINT.mix) * clamp01(Number.isFinite(sun) ? sun : 1);
}

export async function loadFloorShadow(dir, { renderer = null, shade = 0x5a3420, fetcher = globalThis.fetch } = {}) {
  try {
    const res = await fetcher(`${dir}/index.json`);
    if (!res.ok) return null;
    const index = await res.json();
    const urls = index.areas.map((a) => `${dir}/${a.file}`);
    const textures = await Promise.all(urls.map((u) => loadTexture(u, { renderer, color: false, mipmaps: false, wrap: false })));
    return {
      areas: index.areas.map((a, i) => ({ texture: textures[i], x0: a.x0, z0: a.z0, w: a.w, d: a.d })),
      times: index.times,
      shade: new THREE.Color(shade),
      dispose() {
        textures.forEach((t, i) => {
          t.dispose();
          forgetTexture(urls[i]);
        });
      },
    };
  } catch {
    return null;
  }
}

// ── the bounce ──

export const BOUNCE = { height: 1.75, strength: 0.5, angleOffset: 0.6 };

// the floor's height under a point from the mask baked on arrival (G and B,
// grounding-bake's packHeight), or the one height outside it
const maskFloor = Fn(([p, mask, rect, range, floor]) => {
  const at = p.xz.sub(rect.xy).mul(rect.zw);
  const outside = at.x.lessThanEqual(0).or(at.y.lessThanEqual(0)).or(at.x.greaterThanEqual(1)).or(at.y.greaterThanEqual(1));
  const m = mask.sample(at);
  const v = m.g.mul(65280).add(m.b.mul(255));
  const h = range.x.add(v.sub(1).div(65534).mul(range.y.sub(range.x)));
  return select(outside.or(v.lessThan(0.5)), floor, h);
});

export function bounce(material, { color, height = BOUNCE.height, strength = BOUNCE.strength, angleOffset = BOUNCE.angleOffset, floor = 0, mask = null } = {}) {
  if (!material || material.userData?.bounce) return material;
  const m = asNode(material);
  const base = floor === 'instance';
  const area = !base && mask?.areas?.[0];
  const uniforms = {
    uBounceColor: uniform(colourOf(color, 0xb08a5a)),
    uBounceFloor: uniform(base ? 0 : Number(floor) || 0),
    uBounceHeight: uniform(height),
    uBounceStrength: uniform(strength),
    uBounceOffset: uniform(angleOffset),
  };
  if (area) {
    const [lo, hi] = mask.range ?? [0, 1];
    Object.assign(uniforms, {
      uBounceMask: texture(area.texture),
      uBounceRect: uniform(new THREE.Vector4(area.x0, area.z0, 1 / area.w, 1 / area.d)),
      uBounceRange: uniform(new THREE.Vector2(lo, hi)),
    });
  }
  onLight(
    m,
    (light, builder) => {
      let at = uniforms.uBounceFloor;
      if (base) {
        // vGroundBase: the instance's origin in the world, its foot
        const im = instanceMatrixOf(builder);
        const origin = im ? im.mul(vec4(0, 0, 0, 1)) : vec4(0, 0, 0, 1);
        at = modelWorldMatrix.mul(origin).y.toVarying('vGroundBase').add(uniforms.uBounceFloor);
      } else if (area) at = maskFloor(positionWorld, uniforms.uBounceMask, uniforms.uBounceRect, uniforms.uBounceRange, uniforms.uBounceFloor);
      const bD = pow(clamp(positionWorld.y.sub(at).div(uniforms.uBounceHeight).oneMinus(), 0, 1), 2).mul(uniforms.uBounceStrength);
      const bA = clamp(dot(normalize(normalWorldGeometry), vec3(0, -1, 0)).add(uniforms.uBounceOffset).mul(1.5), 0, 1);
      return mix(light, uniforms.uBounceColor, bD.mul(bA));
    },
    `bounce:${base ? 1 : 0}${area ? ':mask' : ''}`,
    uniforms,
  );
  m.userData.bounce = uniforms;
  return m;
}

// ── blobs under what moves ──

const MIN_UP = 0.08;

export function blobPlacement(sun, pos, height = 0, tilt = 0, out = {}) {
  const up = Math.max(MIN_UP, sun?.y ?? 1);
  const h = Math.max(0, Number.isFinite(height) ? height : 0);
  out.x = pos.x - ((sun?.x ?? 0) / up) * h;
  out.z = pos.z - ((sun?.z ?? 0) / up) * h;
  out.alpha = clamp01((3 - h) / 3) ** 2 * clamp01(1 - (Number.isFinite(tilt) ? tilt : 0)) ** 2;
  out.scale = 1 + 0.15 * h;
  return out;
}

// BLOB_FRAG as a node material: a rounded rectangle, solid in its middle,
// falling off over uFade of its size (sine in and out), premultiplied over
// a multiply. The colour is the shade and the opacity a: three's
// premultiplied output makes it (shade × a, a), what the GLSL wrote.
export function blobMaterial({ color = 0x5a3420, opacity = 0.75, fade = 0.35 } = {}) {
  const u = { uShade: uniform(colourOf(color)), uOpacity: uniform(opacity), uFade: uniform(fade) };
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, premultipliedAlpha: true, blending: THREE.MultiplyBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false });
  const q = uv().sub(0.5).abs();
  const d = clamp(length(max(q.sub(u.uFade.oneMinus().sub(0.5)), 0)).div(u.uFade), 0, 1);
  const a = cos(d.mul(3.14159265)).mul(0.5).add(0.5).mul(attribute('aBlob', 'float')).mul(u.uOpacity);
  material.colorNode = u.uShade;
  material.opacityNode = a;
  return { material, u };
}

export function createBlobShadows({ color = 0x5a3420, max: most = 64, ground = () => 0, opacity = 0.75, fade = 0.35 } = {}) {
  const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const alpha = new Float32Array(most);
  const attr = new THREE.InstancedBufferAttribute(alpha, 1);
  attr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aBlob', attr);
  const { material, u } = blobMaterial({ color, opacity, fade });
  material.uniforms = u; // (the names ShaderMaterial's had, for a caller that reads them)
  const mesh = new THREE.InstancedMesh(geometry, material, most);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  const sun = new THREE.Vector3(0, 1, 0);
  let strength = 1;
  let used = 0;
  const place = {};
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  return {
    mesh,
    setSun(dir, k = 1) {
      if (dir) sun.copy(dir).normalize();
      strength = k;
    },
    set(i, pos, height = 0, tilt = 0, size = [2, 2], yaw = 0) {
      if (i < 0 || i >= most) return;
      blobPlacement(sun, pos, height, tilt, place);
      p.set(place.x, ground(place.x, place.z) + 0.012, place.z);
      q.setFromAxisAngle(UP, yaw);
      s.set(size[0] * place.scale, 1, size[1] * place.scale);
      mesh.setMatrixAt(i, m4.compose(p, q, s));
      alpha[i] = place.alpha * strength;
      if (i + 1 > used) used = i + 1;
      mesh.count = used;
      mesh.instanceMatrix.needsUpdate = true;
      attr.needsUpdate = true;
    },
    clear() {
      used = 0;
      mesh.count = 0;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    },
  };
}

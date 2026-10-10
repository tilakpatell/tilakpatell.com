// A level's volumetric light: the placed glows (SimpleVolumetricsEntityData,
// boxes) and the light cones (the FX_*LightCone* spawns), from volumes.json
// (scripts/bf2017-volumes.mjs) beside the pack, ray-marched as three's
// webgpu_volume_lighting example does: each volume a VolumeNodeMaterial on
// its box, drawn on a layer of its own by a second scene pass at a quarter
// of the resolution, dithered (bayer16), blurred, brought up to the full
// resolution over the depth (joint bilateral, as webgpu_postprocessing_fog
// does, so a shaft does not halo round a trooper's edge) and added to the
// scene's colour before the bloom and the output transform, so twelve
// overlapping shafts are tone-mapped with the scene and do not blow out.
//
// A volume's look is the record's: its colour (the emission, linear HDR),
// its EmissionScale and its Exponent, the falloff from the box's centre or
// across the cone's width. A volume with a placed spot within CONE_REACH of
// its apex (coneLight) is lit by that spot instead: the slot's spot, on the
// volume layer only (it lights no surface: the placed pool already does),
// at the placed one's place, colour and strength and casting a shadow, so a
// trooper walking through the shaft cuts it. A volume with no spot glows by
// its emission alone.
//
// Read from the r186 source (VolumetricLightingModel): the march takes only
// analytic lights with a `distance` (spots and points, not SunLight), and
// only those whose layers the volume pass's camera tests, so the pool of
// spots here is the whole of its light; the scattering is scaled by 0.01
// per metre and the emissive term is not cut by the depth, so the depth
// test is done here (a volume behind a wall does not glow through it).
//
// Budgets (the fidelity design): CONES_LIT nearest by screen area, none on
// mid and low; VOLUME_SCALE of the resolution; VOLUME_STEPS per volume.
//
// conesFor(json, cells, camera, { max }) → [{ cell, i, area, weight }]   (pure)
// coneLight(cone, lights) → the nearest spot within CONE_REACH of the apex, or null   (pure)
// apexOf(volume) → [x, y, z]   (pure)
// upsample(tsl, low, depth, projInv, scale) → node   (the joint bilateral upsampling, shared with fog.js)
// createVolumetrics(scene, renderer, { tier, source, lights, scale })
//   → Promise<{ set(list), update(camera), pass(colorNode, { depth, camera }), setScale(k), lit, slots, dispose }>

import { CELL, cellsNear, screenArea } from './placed.js';
import { loadThree } from './three.js';

export const CONES_LIT = { ultra: 12, high: 6 };
export const VOLUME_SCALE = 0.25;
export const VOLUME_STEPS = { ultra: 16, high: 10 }; // the example's 12 either side of its default
export const VOLUME_LAYER = 10; // the example's layer: drawn by the volume pass only
export const CONE_REACH = 1; // m: a spot this near a cone's apex is its light
// VolumetricLightingModel scales what it gathers by 0.01 per metre: this
// takes the record's emission back to radiance per metre of air
export const VOLUME_GAIN = 100;
// the share of a lit volume's spot scattered toward the eye per metre at
// full density (the record's emission is its glow, not its density: the
// lit fixture's shot set this so a lit cone reads as bright as its glow)
export const SCATTER = 0.25;
export const BLUR = 0.6; // the example's denoise strength
export const UPSAMPLE = { sigma: 1.2, depth: 30 }; // the fog example's joint bilateral numbers
const SHADOW_MAP = 512;

const xyz = (p) => (Array.isArray(p) ? p : [p.x, p.y, p.z]);

// a vector turned by a unit quaternion [x, y, z, w]
function turn(v, [x, y, z, w]) {
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}

// a cone stands on its spawn and its apex is its height above it, along its
// local +Y; a box's light sits at its centre
export function apexOf(v) {
  if (v.kind !== 'cone') return v.pos.slice();
  const up = turn([0, v.scale[1], 0], v.quat ?? [0, 0, 0, 1]);
  return [v.pos[0] + up[0], v.pos[1] + up[1], v.pos[2] + up[2]];
}
const centreOf = (v) => {
  if (v.kind !== 'cone') return v.pos.slice();
  const a = apexOf(v);
  return [(v.pos[0] + a[0]) / 2, (v.pos[1] + a[1]) / 2, (v.pos[2] + a[2]) / 2];
};
const radiusOf = (v) => Math.hypot(...v.scale) / 2;

export function coneLight(cone, lights) {
  const a = apexOf(cone);
  let best = null;
  let bd = CONE_REACH;
  for (const l of lights ?? []) {
    if (l.kind !== 'spot') continue;
    const d = Math.hypot(l.pos[0] - a[0], l.pos[1] - a[1], l.pos[2] - a[2]);
    if (d <= bd) {
      bd = d;
      best = l;
    }
  }
  return best;
}

// the volumes of the cells round the camera, the most of the screen first;
// one past its record's fade (`fade: [from, to]` m) is not drawn
export function conesFor(json, cells, camera, { max = CONES_LIT.ultra } = {}) {
  const c = xyz(camera.position);
  const picked = [];
  for (const cell of cells) {
    const list = json?.cells?.[cell];
    if (!list) continue;
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      const at = centreOf(v);
      let weight = 1;
      if (v.fade) {
        const d = Math.hypot(at[0] - c[0], at[1] - c[1], at[2] - c[2]);
        weight = 1 - Math.min(1, Math.max(0, (d - v.fade[0]) / Math.max(1e-3, v.fade[1] - v.fade[0])));
        if (weight <= 0) continue;
      }
      const area = screenArea({ pos: at, range: radiusOf(v) }, camera);
      picked.push({ cell, i, area, weight });
    }
  }
  picked.sort((a, b) => b.area - a.area);
  if (picked.length > max) picked.length = max;
  return picked;
}

// Joint bilateral upsampling (Kopf et al. 2007; three's fog example's 5 × 5):
// a low-resolution texture brought up to the screen, each tap weighted by
// its distance and by how near its depth is to the pixel's, so nothing
// bleeds across a depth edge. `projInv` a uniform of the camera's inverse
// projection; `scale` the low texture's share of the resolution.
export function upsample(tsl, low, depthNode, projInv, scale) {
  const { Fn, vec2, vec4, float, exp, fwidth, getViewPosition, screenUV } = tsl;
  const viewDepth = (uv) => getViewPosition(uv, depthNode.sample(uv).r, projInv).z.negate().max(0.001);
  return Fn(() => {
    const centre = viewDepth(screenUV);
    const texel = fwidth(screenUV).div(scale);
    const sum = vec4(0).toVar();
    const wsum = float(0).toVar();
    for (let y = -2; y <= 2; y++) {
      for (let x = -2; x <= 2; x++) {
        const uv = screenUV.add(vec2(x, y).mul(texel));
        const dd = viewDepth(uv).sub(centre).div(centre.max(0.1));
        const w = exp(float((-(x * x + y * y) * 0.5) / (UPSAMPLE.sigma * UPSAMPLE.sigma))).mul(exp(dd.mul(dd).mul(-0.5 * UPSAMPLE.depth * UPSAMPLE.depth)));
        sum.addAssign(low.sample(uv).mul(w));
        wsum.addAssign(w);
      }
    }
    return sum.div(wsum.max(1e-4));
  })();
}

const flatSpots = (json) => Object.values(json?.cells ?? {}).flat().filter((l) => l.kind === 'spot');

export async function createVolumetrics(scene, renderer, { tier = 'high', source = null, lights = null, scale = 1, cell = CELL } = {}) {
  const n = CONES_LIT[tier] ?? 0;
  const inert = { set: () => 0, update: () => 0, pass: (colorNode) => colorNode, setScale() {}, lit: 0, slots: [], dispose() {} };
  if (!n) return inert;
  const [{ THREE, tsl }, { bayer16 }, { gaussianBlur }] = await Promise.all([loadThree(), import('three/addons/tsl/math/Bayer.js'), import('three/addons/tsl/display/GaussianBlurNode.js')]);
  const { Fn, uniform, vec3, vec4, float, screenCoordinate, screenUV, clamp, pow, length, max, select, cameraViewMatrix, cameraNear, cameraFar, linearDepth, viewZToPerspectiveDepth, pass } = tsl;

  const group = new THREE.Group();
  group.name = 'volumetrics';
  const box = new THREE.BoxGeometry(1, 1, 1);
  const layer = new THREE.Layers();
  layer.set(VOLUME_LAYER);
  // a spot's shadow is drawn from every layer but the volumes' own (the
  // shadow pass takes the volume pass's camera's layers otherwise, and
  // there is nothing on that layer to cast)
  const shadowMask = 0xffffffff & ~(1 << VOLUME_LAYER);
  const spots = flatSpots(lights);
  const lightOf = new WeakMap(); // (a volume's spot, found once)
  const depth = { node: null };

  const slots = [];
  for (let s = 0; s < n; s++) {
    const u = {
      cone: uniform(0),
      color: uniform(new THREE.Color(1, 1, 1)),
      exponent: uniform(2),
      emission: uniform(0),
      lit: uniform(0),
      toLocal: uniform(new THREE.Matrix4()),
    };
    const mat = new THREE.VolumeNodeMaterial();
    mat.steps = VOLUME_STEPS[tier] ?? VOLUME_STEPS.high;
    mat.offsetNode = bayer16(screenCoordinate);
    // the density at a point: the box's glow falling off from its centre, the
    // cone's across its width (its base at local y −½, its apex at +½)
    const density = Fn(([p]) => {
      const local = u.toLocal.mul(vec4(p, 1)).xyz;
      const r = length(local).mul(2);
      const boxD = pow(clamp(float(1).sub(r), 0, 1), u.exponent);
      const t = float(0.5).sub(local.y); // 0 at the apex, 1 at the base
      const across = length(local.xz).div(max(t.mul(0.5), 1e-3));
      const inside = select(t.greaterThanEqual(0).and(t.lessThanEqual(1)), float(1), float(0));
      const coneD = pow(clamp(float(1).sub(across), 0, 1), u.exponent).mul(inside);
      return select(u.cone.greaterThan(0.5), coneD, boxD);
    });
    const look = u.color.mul(u.emission);
    mat.scatteringNode = Fn(({ positionRay }) => vec3(density(positionRay)).mul(look).mul(u.lit).mul(SCATTER * VOLUME_GAIN));
    // (the model does not cut the emissive term by the scene's depth: done here)
    mat.scatteringEmissiveNode = Fn(({ positionRay }) => {
      let glow = vec3(density(positionRay)).mul(look).mul(float(1).sub(u.lit)).mul(VOLUME_GAIN);
      if (depth.node) {
        const viewZ = cameraViewMatrix.mul(vec4(positionRay, 1)).z;
        const rayDepth = linearDepth(viewZToPerspectiveDepth(viewZ, cameraNear, cameraFar));
        glow = glow.mul(select(linearDepth(depth.node).greaterThanEqual(rayDepth), float(1), float(0)));
      }
      return glow;
    });
    const mesh = new THREE.Mesh(box, mat);
    mesh.name = `volume-${s}`;
    mesh.layers.set(VOLUME_LAYER);
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    const spot = new THREE.SpotLight(0xffffff, 0, 1, Math.PI / 4, 0.5, 2);
    spot.name = `volume-spot-${s}`;
    spot.layers.set(VOLUME_LAYER);
    spot.castShadow = true;
    spot.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
    spot.shadow.camera.layers.mask = shadowMask;
    spot.shadow.autoUpdate = false;
    group.add(mesh, spot, spot.target);
    slots.push({ mesh, mat, spot, u, light: null });
  }
  scene.add(group);

  let lit = 0;
  let last = [];
  function set(list) {
    last = list;
    let s = 0;
    for (const v of list) {
      if (s >= slots.length) break;
      const slot = slots[s++];
      const w = v.weight ?? 1;
      const { mesh, u, spot } = slot;
      const at = centreOf(v);
      mesh.position.set(...at);
      mesh.quaternion.set(...(v.quat ?? [0, 0, 0, 1]));
      mesh.scale.set(...v.scale);
      mesh.updateMatrixWorld(true);
      u.toLocal.value.copy(mesh.matrixWorld).invert();
      u.cone.value = v.kind === 'cone' ? 1 : 0;
      u.color.value.setRGB(...(v.color ?? [1, 1, 1]));
      u.exponent.value = v.exponent ?? 1;
      u.emission.value = (v.emission ?? 1) * w;
      mesh.visible = true;
      // (found once per record: `rec` is the source's own when update made the list)
      const key = v.rec ?? v;
      if (!lightOf.has(key)) lightOf.set(key, coneLight(v, spots));
      const l = lightOf.get(key);
      slot.light = l;
      u.lit.value = l ? 1 : 0;
      if (l) {
        const [inner, outer] = l.cone ?? [Math.PI / 4, Math.PI / 3];
        spot.position.set(...l.pos);
        spot.target.position.set(l.pos[0] + (l.dir?.[0] ?? 0), l.pos[1] + (l.dir?.[1] ?? -1), l.pos[2] + (l.dir?.[2] ?? 0));
        spot.angle = Math.min(Math.PI / 2 - 1e-3, outer / 2);
        spot.penumbra = outer > 0 ? Math.min(1, Math.max(0, 1 - inner / outer)) : 0;
        spot.distance = l.range ?? 10;
        spot.color.setRGB(...(l.color ?? [1, 1, 1]));
        spot.intensity = (l.candela ?? 0) * w * scale;
        spot.shadow.camera.far = spot.distance;
        spot.updateMatrixWorld();
        spot.target.updateMatrixWorld();
        spot.shadow.autoUpdate = true;
      } else {
        spot.intensity = 0;
        spot.shadow.autoUpdate = false;
      }
    }
    for (let i = s; i < slots.length; i++) {
      slots[i].mesh.visible = false;
      slots[i].spot.intensity = 0;
      slots[i].spot.shadow.autoUpdate = false;
      slots[i].light = null;
    }
    lit = s;
    return lit;
  }

  let made = []; // (the last pass's nodes)
  const projInv = new THREE.Matrix4();
  const projInvU = uniform(projInv);

  return {
    set,
    update(camera) {
      if (!source || !camera) return lit;
      projInv.copy(camera.projectionMatrixInverse);
      const cells = cellsNear(xyz(camera.position), cell);
      return set(
        conesFor(source, cells, camera, { max: slots.length }).map((p) => {
          const rec = source.cells[p.cell][p.i];
          return { ...rec, weight: p.weight, rec };
        }),
      );
    },
    // the volumes drawn on their layer at VOLUME_SCALE, blurred, brought up
    // over the depth and added to the colour so far
    pass(colorNode, { depth: depthNode, camera }) {
      for (const node of made) node.dispose?.();
      depth.node = depthNode.sample(screenUV);
      for (const slot of slots) {
        slot.mat.depthNode = depth.node;
        slot.mat.needsUpdate = true;
      }
      const vp = pass(scene, camera, { depthBuffer: false });
      vp.name = 'volumetrics';
      vp.setLayers(layer);
      vp.setResolutionScale(VOLUME_SCALE);
      const blurred = gaussianBlur(vp, BLUR);
      const low = blurred.getTextureNode();
      projInv.copy(camera.projectionMatrixInverse);
      const up = upsample(tsl, low, depthNode, projInvU, VOLUME_SCALE);
      made = [vp, blurred];
      return colorNode.add(vec4(up.rgb, 0));
    },
    setScale(k) {
      if (k === scale) return;
      scale = k;
      set(last);
    },
    get lit() {
      return lit;
    },
    slots,
    dispose() {
      group.removeFromParent();
      for (const node of made) node.dispose?.();
      for (const s of slots) {
        s.mat.dispose();
        s.spot.shadow?.dispose?.();
        s.spot.dispose();
      }
      box.dispose();
    },
  };

}

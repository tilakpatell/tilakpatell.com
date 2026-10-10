// The sun: a DirectionalLight casting through three's CSMShadowNode
// (three/addons/csm), its colour, strength and direction from the weather's
// entry (entry.js), its shadow from the record's ShadowsComponentData and
// OutdoorLightComponentData (lane S of the fidelity design).
//
// - Four cascades on ultra and high, two on mid, none on low, split by the
//   practical scheme at lambda 0.5 (CSMShadowNode's 'practical', the same
//   as splitsFor), out to the record's SunShadowmapViewDistance for the
//   tier: 30 m on low to high on Hoth, 70 m on its ultra; the site's ultra
//   takes ULTRA_SHADOW_FAR (the game's ultra was a 2017 console).
// - Each cascade's bias scales with its texel (biasFor), so a figure's feet
//   touch its shadow in the first cascade and the far ones do not acne.
// - The shadow sun: where the record has ShadowSunRotationX/Y, the
//   cascades are cast along it while the light shines along
//   SunRotationX/Y (Hoth Sunny: lit from 33° up, cast from 82° up, so the
//   shadows stay short and tight at any sun). CSMShadowNode fits its
//   cascades along the light's position → target; SunCSM moves the
//   position to the shadow sun for that fit only, so the light's own
//   direction (its matrixWorld) is untouched.
// - The far edge: over the last BLEND of the last cascade the cascades fade
//   into `farShadow` (the record's SmoothTransitionToDistantShadows): lane
//   G's distant shadow cache once it lands (its PR #833 left it for lane L);
//   until then a lit 1, so the seam is a fade and not a line.
// - The filter: `filter` (shadows.js's PCSS, or null for three's own)
//   is set on every cascade's shadow, since LightShadow.copy() does not
//   carry `filterNode` into CSMShadowNode's clones.
// - The clouds: `cloud` (clouds.js's term) multiplies the whole shadow.
//
// GodraysNode marches a plain DirectionalLight's or a PointLight's shadow
// map, not a CSM's cascades, so a chain with god rays asks for `rays`: a
// DirectionalLight that casts and adds no light, following the camera,
// whose one shadow map the rays read (assumption B2 is lane V's).
//
// readShadowRecord(entry) → { viewDistance: { low, mid, high, ultra }, shadowSun: [x, y] | null }   (pure)
// cascadesFor(tier, viewDistance) → { n, far, map }   (pure)
// splitsFor(near, far, n, lambda = 0.5) → n + 1 distances  (pure)
// biasFor(texel, { bias, normalBias }) → { bias, normalBias }   (pure)
// createSun(entry, { tier, rays, filter, farShadow, cloud }) → Promise<{ light, rays, csm, shadowDir, set(params), setShadowSun([x, y] | null), update(camera), dispose }>

import { readEntry, sunDir } from './entry.js';
import { loadCSM, loadThree } from './three.js';

export const ULTRA_SHADOW_FAR = 140; // m: the site's ultra (the record's Ultra is 70, a 2017 console's)
export const BLEND = 0.15; // the last cascade's share faded into the distant shadow
// m: the texel the entry's bias and normal bias are set for (a 2048 map
// over 40 m, the first cascade on ultra); each cascade scales from it
export const REF_TEXEL = 40 / 2048;
const MIN_BIAS_SHARE = 0.25; // a cascade's bias never under this share of the base
const LIGHT_MARGIN = 120; // m: casters this far sunward of a cascade still cast into it (Hoth's walkers stand 22 m)
const SUN_DISTANCE = 1; // the light shines from its position to its target: only the direction counts
const RAYS_BOX = 80; // m: half the side of the god rays' shadow box round the camera
const RAYS_FAR = 400; // m
// Hoth's record where an entry has none
const VIEW_DISTANCE = { low: 30, mid: 30, high: 30, ultra: 70 };
const TIERS = { ultra: { n: 4, map: 2048 }, high: { n: 4, map: 2048 }, mid: { n: 2, map: 1024 }, low: { n: 0, map: 0 } };
const RECORD_TIER = { low: 'Low', mid: 'Medium', high: 'High', ultra: 'Ultra' };

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));
const field = (o, name, sub) => num(o?.[`${name}.${sub}`] ?? o?.[name]?.[sub]);

export function readShadowRecord(entry) {
  const r = entry?.record ?? {};
  const shadows = r.ShadowsComponentData?.[0] ?? entry?.shadows ?? {};
  const outdoor = r.OutdoorLightComponentData?.[0] ?? entry?.sun?.raw ?? {};
  const viewDistance = {};
  for (const [tier, name] of Object.entries(RECORD_TIER)) {
    const v = field(shadows, 'SunShadowmapViewDistance', name);
    viewDistance[tier] = v > 0 ? v : VIEW_DISTANCE[tier];
  }
  const x = num(outdoor.ShadowSunRotationX);
  const y = num(outdoor.ShadowSunRotationY);
  return { viewDistance, shadowSun: x !== undefined && y !== undefined ? [x, y] : null };
}

export function cascadesFor(tier, viewDistance = VIEW_DISTANCE) {
  const t = TIERS[tier] ?? TIERS.high;
  if (!t.n) return { n: 0, far: 0, map: 0 };
  const key = TIERS[tier] ? tier : 'high';
  return { n: t.n, far: key === 'ultra' ? ULTRA_SHADOW_FAR : (viewDistance[key] ?? VIEW_DISTANCE[key]), map: t.map };
}

// The practical split: each inner edge the average, weighted by lambda, of
// the logarithmic and the uniform split.
export function splitsFor(near, far, n, lambda = 0.5) {
  if (!(n > 0)) return [near];
  const out = [near];
  for (let i = 1; i < n; i++) {
    const f = i / n;
    const uniform = near + (far - near) * f;
    const log = near > 0 ? near * (far / near) ** f : uniform;
    out.push(lambda * log + (1 - lambda) * uniform);
  }
  out.push(far);
  return out;
}

// A cascade's biases: the depth error a texel can hide grows with the
// texel's size, the light's depth range being the same for every cascade.
export function biasFor(texel, base) {
  const k = Math.max(MIN_BIAS_SHARE, texel / REF_TEXEL);
  return { bias: base.bias * k, normalBias: base.normalBias * k };
}

let SunCSM = null;
async function sunCSM() {
  if (SunCSM) return SunCSM;
  const [CSMShadowNode, { tsl }] = await Promise.all([loadCSM(), loadThree()]);
  const { float, mix, positionView, smoothstep, uniform, vec4 } = tsl;
  SunCSM = class extends CSMShadowNode {
    constructor(light, data, { shadowDir, filter, farShadow, cloud, base }) {
      super(light, data);
      // (three's CSMShadowNode carries no flag; post.js's raysLight reads this
      // one to keep god rays off the cascades, which have no single map)
      this.isCSMShadowNode = true;
      this.cloud = cloud;
      this.shadowDir = shadowDir;
      this.filter = filter;
      this.farShadow = farShadow;
      this.base = base;
    }

    _init(builder) {
      super._init(builder);
      for (const lw of this.lights) lw.shadow.filterNode = this.filter ?? undefined;
      this.applyBias();
    }

    // each cascade's bias from its texel (after a fit: CSMShadowNode sizes
    // the cascades' cameras when the view's projection changes)
    applyBias() {
      for (const lw of this.lights) {
        const cam = lw.shadow.camera;
        const b = biasFor((cam.right - cam.left) / lw.shadow.mapSize.width, this.base);
        lw.shadow.bias = b.bias;
        lw.shadow.normalBias = b.normalBias;
      }
    }

    // the cascades' maps freed too (CSMShadowNode.dispose only detaches its lights)
    dispose() {
      for (const n of this._shadowNodes) n.dispose();
      super.dispose();
    }

    updateFrustums() {
      super.updateFrustums();
      if (this.lights.length) this.applyBias();
    }

    // the cascades fitted along the shadow sun; the light keeps its own
    updateBefore(frame) {
      const light = this.light;
      const was = light.position.clone();
      light.position.copy(light.target.position).addScaledVector(this.shadowDir, SUN_DISTANCE);
      try {
        super.updateBefore(frame);
      } finally {
        light.position.copy(was);
      }
    }

    // over the last BLEND of the last cascade, into the distant shadow
    setup(builder) {
      const cascades = super.setup(builder);
      const far = uniform(this.maxFar).onRenderUpdate(() => Math.min(this.maxFar, this.camera.far));
      const t = positionView.z.negate().div(far);
      const w = smoothstep(float(1 - BLEND), float(1), t);
      const distant = this.farShadow ?? float(1);
      // (past the far, the distant shadow alone: no cascade is read there)
      const out = t.greaterThanEqual(1).select(vec4(distant), mix(cascades, vec4(distant), w));
      return this.cloud ? out.mul(vec4(this.cloud)) : out;
    }
  };
  return SunCSM;
}

export async function createSun(entry, { tier = 'high', rays = false, filter = null, farShadow = null, cloud = null } = {}) {
  const { THREE } = await loadThree();
  const record = readShadowRecord(entry);
  const { n, far, map } = cascadesFor(tier, record.viewDistance);
  const params = readEntry(entry);
  const light = new THREE.DirectionalLight(new THREE.Color(...params.sun.color), params.sun.intensity);
  light.name = 'sun';
  light.castShadow = n > 0;
  const shadowDir = new THREE.Vector3();
  let lockShadow = false;
  // the record's shadow sun, or (null) cast along the light
  const setShadowSun = (rot) => {
    lockShadow = Boolean(rot);
    if (lockShadow) shadowDir.set(...sunDir(rot[0], rot[1])).normalize();
    else shadowDir.copy(light.position).sub(light.target.position).normalize();
  };
  setShadowSun(record.shadowSun);
  let csm = null;
  if (light.castShadow) {
    const size = Math.min(map, params.shadow.mapSize);
    light.shadow.mapSize.set(size, size);
    light.shadow.bias = params.shadow.bias;
    light.shadow.normalBias = params.shadow.normalBias;
    Object.assign(light.shadow.camera, { near: 0.5, far: LIGHT_MARGIN * 2 + far * 2 });
    const Csm = await sunCSM();
    csm = new Csm(light, { cascades: n, maxFar: Math.min(far, params.shadow.far ?? far), mode: 'practical', lightMargin: LIGHT_MARGIN }, { shadowDir, filter, farShadow, cloud, base: { bias: params.shadow.bias, normalBias: params.shadow.normalBias } });
    csm.fade = true;
    light.shadow.shadowNode = csm;
  }
  let raysLight = null;
  if (rays && light.castShadow) {
    raysLight = new THREE.DirectionalLight(0xffffff, 0);
    raysLight.name = 'sun-rays';
    raysLight.castShadow = true;
    raysLight.shadow.mapSize.set(1024, 1024);
    Object.assign(raysLight.shadow.camera, { left: -RAYS_BOX, right: RAYS_BOX, top: RAYS_BOX, bottom: -RAYS_BOX, near: 1, far: RAYS_FAR });
    raysLight.shadow.camera.updateProjectionMatrix();
  }
  const dir = new THREE.Vector3();
  const set = (p) => {
    dir.set(...p.sun.dir).normalize();
    if (!lockShadow) shadowDir.copy(dir);
    light.position.copy(light.target.position).addScaledVector(dir, SUN_DISTANCE);
    light.color.setRGB(...p.sun.color);
    light.intensity = p.sun.intensity;
    light.updateMatrixWorld();
  };
  set(params);
  let projection = '';
  return {
    light,
    rays: raysLight,
    csm,
    shadowDir,
    set,
    setShadowSun,
    // (the cascades follow the view's pose each frame by themselves; a new
    // projection, a resize or a zoom, refits their splits and sizes)
    update(camera) {
      if (csm?.camera && camera?.isCamera) {
        const key = `${camera.fov},${camera.aspect},${camera.near},${camera.far},${camera.zoom}`;
        if (projection && key !== projection) csm.updateFrustums();
        projection = key;
      }
      if (!raysLight || !camera) return;
      raysLight.target.position.copy(camera.position);
      raysLight.position.copy(camera.position).addScaledVector(dir, RAYS_FAR / 2);
      raysLight.target.updateMatrixWorld();
      raysLight.updateMatrixWorld();
    },
    dispose() {
      csm?.dispose();
      light.removeFromParent();
      light.target.removeFromParent();
      light.dispose();
      raysLight?.removeFromParent();
      raysLight?.target.removeFromParent();
      raysLight?.dispose();
    },
  };
}

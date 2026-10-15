// Soft sun shadows: percentage-closer soft shadows (PCSS) on each of the
// sun's cascades, from the record's OutdoorLightComponentData, set through
// the shadow's filter hook (lane S, assumption B1).
//
// B1, answered from the r186 source: ShadowNode.setupShadow takes
// `shadow.filterNode || getShadowFilterFn(renderer.shadowMap.type)`, and
// calls it with { depthTexture, shadowCoord, shadow, depthLayer }, inside
// the frustum test of setupShadowFilter. So a kernel of our own is a
// function on `shadow.filterNode`, no subclass. LightShadow.copy() does
// not carry it, so sun.js sets it on every cascade's clone.
//
// The kernel, per cascade:
// 1. The blocker search: `initial` samples (the record's
//    SunPcssInitialSampleCount, 8) on three's Vogel disc, turned per pixel
//    by interleaved gradient noise, over the widest penumbra a blocker up
//    to SEARCH_DEPTH above the receiver can cast.
// 2. The early-out (earlyOut): a share of blockers within the record's
//    SunPcssFilterErrorThresholdPct (0.05) of none is lit, of all is
//    shadow; such a texel stops after the initial samples.
// 3. Else the penumbra (penumbraWidth): the receiver's depth below the
//    blockers' mean times the sun's disc (tan SunAngularRadius 0.29°)
//    times the record's SunPenumbraSize (4) and SunPcssShadowFilterScale,
//    filtered with `max` samples: the record's SunPcssMaximumSampleCount
//    (256) on ultra, the site's 32 on high.
// The kernel reads raw depth (the compare sampler cannot give a blocker's
// depth), so it turns the depth texture's comparison off and filters it
// nearest; the depth is the shadow camera's orthographic one, so a
// difference times (far − near) is metres.
//
// Mid takes three's own PCF; where the hook is missing (FILTER_HOOK false,
// not on r186), VSM with the initial count as its blur samples.
//
// readPcss(entry) → { initial, max, threshold, angularRadius, penumbraSize, filterScale }   (pure)
// filterFor(tier, pcss, { hook }) → { kind: 'pcss' | 'pcf' | 'vsm' | 'none', … }            (pure)
// vogelDisk(i, n, phi) → [x, y]; earlyOut(blocked, n, threshold); penumbraWidth(metres, pcss) (pure)
// pcssFilter(filter) → Promise<filterFn for shadow.filterNode>
// vsmFallback(renderer, light, samples)
//
// The far cache (GPU-first lane N3, "Shadows cached"): past the sun's last
// cascade, the level's own distant shadow cache, the export's 16-bit depth
// map of the DistantShadowCacheVolumeEntityData (level.json's `shadowCache`,
// lane E0; 2,048² on Hoth) over its box (centre, and right, up, forward each
// the box's full size, as the reflection volumes' are). Read as a height
// field of what stands in the box seen from its top (u along right, v along
// forward): a point is in shadow when, marching from it toward the shadow
// sun to the box's top in FAR_STEPS, the field stands over the march. Which
// end of the 16-bit range is the top is not in the record: depthConvention
// picks it from the map itself (the end that puts the map's median nearest
// the pack's ground). No row, no cache: the record's distant term as today,
// a lit 1 (sun.js fades the last cascade into it over BLEND).
//
// farShadowOf(levelJson) → row | null; boxUv(row, p) → [u, v, height]  (pure)
// depthConvention(row, samples, groundY) → 'top' | 'bottom'           (pure)
// farShadowAt(row, depthAt(u, v), p, sunDir, { zero, steps }) → 0 | 1   (pure: farTerm's CPU twin)
// createFarCache(row, { loadPng, groundY, shadowDir }) → Promise<{ node: farTerm (vec4), zero, dispose } | null>

import { decodePng16 } from '../../level/png16.js';
import { loadThree } from './three.js';

export const FILTER_HOOK = true; // ShadowNode reads shadow.filterNode on r186
export const PCSS_SAMPLES = { ultra: 256, high: 32 }; // the filter's samples (ultra: the record's maximum)
// the video setting's shadow quality (lib/video.js `shadows`): the filter and its samples
const VIDEO_SAMPLES = { medium: 32, high: 128, ultra: 256 };
const SEARCH_DEPTH = 20; // m: the tallest blocker above a receiver the search looks for (a walker's legs)
const MIN_TEXELS = 1.5; // the narrowest penumbra, in texels, so a contact edge is still filtered
const VSM_SHADOW_MAP = 3; // three's VSMShadowMap
const GOLDEN = 2.399963229728653; // three's vogelDiskSample's golden angle
// steps of the far cache's march toward the sun: the site's choice, the record has none (judged on the laptop)
export const FAR_STEPS = 8;
const HOTH = { initial: 8, max: 256, threshold: 0.05, angularRadius: 0.29, penumbraSize: 4, filterScale: 1 };

const num = (v, d) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? d : Number(v));

export function readPcss(entry) {
  const o = entry?.record?.OutdoorLightComponentData?.[0] ?? entry?.sun?.raw ?? {};
  return {
    // (at least one sample each: the kernel divides by them)
    initial: Math.max(1, num(o.SunPcssInitialSampleCount, HOTH.initial)),
    max: Math.max(1, num(o.SunPcssMaximumSampleCount, HOTH.max)),
    threshold: num(o.SunPcssFilterErrorThresholdPct, HOTH.threshold),
    angularRadius: num(o.SunAngularRadius, HOTH.angularRadius),
    penumbraSize: num(o.SunPenumbraSize, HOTH.penumbraSize),
    filterScale: num(o.SunPcssShadowFilterScale, HOTH.filterScale),
  };
}

export function filterFor(tier, pcss = HOTH, { hook = FILTER_HOOK, video = null } = {}) {
  const asked = video?.shadows;
  if (asked === 'off' || (!asked && tier === 'low')) return { kind: 'none' };
  if (asked === 'low' || (!asked && (tier === 'mid' || !PCSS_SAMPLES[tier]))) return { kind: 'pcf' };
  if (!hook) return { kind: 'vsm', samples: pcss.initial };
  const max = asked && VIDEO_SAMPLES[asked] ? VIDEO_SAMPLES[asked] : PCSS_SAMPLES[tier] ?? PCSS_SAMPLES.high;
  return { kind: 'pcss', ...pcss, max: Math.min(pcss.max, max) };
}

// three's vogelDiskSample: the i-th of n points, radius √((i + ½)/n)
export function vogelDisk(i, n, phi) {
  const r = Math.sqrt((i + 0.5) / n);
  const t = i * GOLDEN + phi;
  return [Math.cos(t) * r, Math.sin(t) * r];
}

export function earlyOut(blocked, n, threshold) {
  const share = blocked / n;
  if (share <= threshold) return 'lit';
  if (share >= 1 - threshold) return 'shadow';
  return null;
}

// m: the penumbra a blocker `metres` above the receiver casts
export function penumbraWidth(metres, pcss = HOTH) {
  if (!(metres > 0)) return 0;
  return metres * Math.tan((pcss.angularRadius * Math.PI) / 180) * pcss.penumbraSize * pcss.filterScale;
}

export async function pcssFilter(filter) {
  const { THREE, tsl } = await loadThree();
  const { Fn, Loop, If, float, texture, reference, renderGroup, screenCoordinate, interleavedGradientNoise, vogelDiskSample, int, abs, max } = tsl;
  const perMetre = penumbraWidth(1, filter);
  const initial = filter.initial;
  const samples = filter.max;
  const threshold = filter.threshold;
  return Fn(({ depthTexture, shadowCoord, shadow, depthLayer }, builder) => {
    // (raw depth: no comparison, no filtering between texels)
    depthTexture.compareFunction = null;
    depthTexture.minFilter = depthTexture.magFilter = THREE.NearestFilter;
    const reversed = builder.renderer.reversedDepthBuffer === true;
    const depthAt = (uv) => {
      let d = texture(depthTexture, uv);
      if (depthTexture.isArrayTexture) d = d.depth(depthLayer);
      return d.r;
    };
    const blocks = (d, z) => (reversed ? d.greaterThan(z) : d.lessThan(z));
    const cam = shadow.camera;
    const ref = (k) => reference(k, 'float', cam).setGroup(renderGroup);
    const width = ref('right').sub(ref('left')); // m: the cascade's side
    const depthRange = ref('far').sub(ref('near')); // m
    const mapSize = reference('mapSize', 'vec2', shadow).setGroup(renderGroup);
    const texel = float(1).div(mapSize.x);
    const z = shadowCoord.z;
    const phi = interleavedGradientNoise(screenCoordinate.xy).mul(Math.PI * 2);

    // 1. the blockers in the widest penumbra
    const search = max(float(perMetre * SEARCH_DEPTH).div(width), texel.mul(MIN_TEXELS));
    const sum = float(0).toVar();
    const count = float(0).toVar();
    Loop({ start: int(0), end: int(initial), type: 'int', condition: '<' }, ({ i }) => {
      const d = depthAt(shadowCoord.xy.add(vogelDiskSample(i, int(initial), phi).mul(search)));
      If(blocks(d, z), () => {
        sum.addAssign(d);
        count.addAssign(1);
      });
    });

    // 2. lit or shadow after the initial samples, within the threshold
    const share = count.div(initial);
    const lit = float(1).toVar();
    If(share.greaterThanEqual(1 - threshold), () => {
      lit.assign(0);
    }).ElseIf(share.greaterThan(threshold), () => {
      // 3. the penumbra from the receiver's depth below the blockers
      const metres = abs(z.sub(sum.div(count))).mul(depthRange);
      const radius = max(metres.mul(perMetre).div(width), texel.mul(MIN_TEXELS));
      const open = float(0).toVar();
      Loop({ start: int(0), end: int(samples), type: 'int', condition: '<' }, ({ i }) => {
        const d = depthAt(shadowCoord.xy.add(vogelDiskSample(i, int(samples), phi).mul(radius)));
        If(blocks(d, z).not(), () => {
          open.addAssign(1);
        });
      });
      lit.assign(open.div(samples));
    });
    return lit;
  });
}

export function vsmFallback(renderer, light, samples) {
  if (renderer.shadowMap) renderer.shadowMap.type = VSM_SHADOW_MAP;
  light.shadow.blurSamples = samples;
}

// ---- the far cache (lane N3)

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len2 = (v) => (Array.isArray(v) ? dot(v, v) : 0);

export function farShadowOf(level) {
  const c = level?.farShadow ?? level?.shadowCache ?? null;
  if (!c?.png || !Array.isArray(c.size) || !Array.isArray(c.centre)) return null;
  if (![c.right, c.up, c.forward].every((v) => len2(v) > 0)) return null;
  return c;
}

export function boxUv(c, p) {
  const d = [p[0] - c.centre[0], p[1] - c.centre[1], p[2] - c.centre[2]];
  return [dot(d, c.right) / len2(c.right) + 0.5, dot(d, c.forward) / len2(c.forward) + 0.5, dot(d, c.up) / len2(c.up) + 0.5];
}

const heightOf = (d, zero) => (zero === 'bottom' ? d : 1 - d);

export function depthConvention(c, samples, groundY = 0) {
  const s = [...samples].sort((a, b) => a - b);
  const m = s[Math.floor(s.length / 2)] ?? 0.5;
  const ground = boxUv(c, [c.centre[0], groundY, c.centre[2]])[2];
  return Math.abs(heightOf(m, 'top') - ground) <= Math.abs(heightOf(m, 'bottom') - ground) ? 'top' : 'bottom';
}

// the map's own texel, in the box's height (the march's bias)
const biasOf = (c) => Math.max(Math.sqrt(len2(c.right)) / c.size[0], Math.sqrt(len2(c.forward)) / c.size[1]) / Math.sqrt(len2(c.up));

export function farShadowAt(c, depthAt, p, sun, { zero = 'top', steps = FAR_STEPS } = {}) {
  if (!c) return 1;
  const [u, v, h] = boxUv(c, p);
  if (u < 0 || u > 1 || v < 0 || v > 1 || h > 1) return 1;
  const up = Math.sqrt(len2(c.up));
  // (the sun's climb per metre along it, in the box's height)
  const climb = dot(sun, c.up) / up / up;
  const length = climb > 0 ? (1 - h) / climb : 0;
  const bias = biasOf(c);
  for (let k = 0; k < steps; k++) {
    const t = (length * k) / steps;
    const q = [p[0] + sun[0] * t, p[1] + sun[1] * t, p[2] + sun[2] * t];
    const [qu, qv, qh] = boxUv(c, q);
    if (qu < 0 || qu > 1 || qv < 0 || qv > 1) break;
    if (heightOf(depthAt(qu, qv), zero) > qh + bias) return 0;
  }
  return 1;
}

export async function createFarCache(row, { loadPng, groundY = 0, shadowDir = null } = {}) {
  const c = farShadowOf({ farShadow: row });
  if (!c || typeof loadPng !== 'function') return null;
  let png = null;
  try {
    png = await decodePng16(new Uint8Array(await loadPng(c.png)));
  } catch {
    return null;
  }
  const { THREE, tsl } = await loadThree();
  const n = png.w * png.h;
  const half = new Uint16Array(n);
  const samples = [];
  const every = Math.max(1, Math.floor(n / 4096));
  for (let i = 0; i < n; i++) {
    const d = png.data[i] / 65535;
    half[i] = THREE.DataUtils.toHalfFloat(d);
    if (i % every === 0) samples.push(d);
  }
  const zero = depthConvention(c, samples, groundY);
  const tex = new THREE.DataTexture(half, png.w, png.h, THREE.RedFormat, THREE.HalfFloatType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  const { Fn, Loop, If, float, int, vec3, vec4, texture, uniform, positionWorld, dot: tdot } = tsl;
  const v3 = (a) => new THREE.Vector3(...a);
  const U = { centre: uniform(v3(c.centre)), right: uniform(v3(c.right)), up: uniform(v3(c.up)), forward: uniform(v3(c.forward)), sun: uniform(shadowDir ?? new THREE.Vector3(0, 1, 0)) };
  const bias = biasOf(c);
  const r2 = len2(c.right);
  const u2 = len2(c.up);
  const f2 = len2(c.forward);
  const upLen = Math.sqrt(u2);
  // farShadowAt's twin, at the fragment's world position
  const node = Fn(() => {
    const local = (q) => {
      const d = q.sub(U.centre);
      return vec3(tdot(d, U.right).div(r2), tdot(d, U.forward).div(f2), tdot(d, U.up).div(u2)).add(0.5);
    };
    const p = positionWorld;
    const l = local(p);
    const lit = float(1).toVar();
    const inside = l.x.greaterThanEqual(0).and(l.x.lessThanEqual(1)).and(l.y.greaterThanEqual(0)).and(l.y.lessThanEqual(1)).and(l.z.lessThanEqual(1));
    If(inside, () => {
      const climb = tdot(U.sun, U.up).div(upLen * upLen);
      const length = climb.greaterThan(0).select(float(1).sub(l.z).div(climb.max(1e-6)), float(0));
      Loop({ start: int(0), end: int(FAR_STEPS), type: 'int', condition: '<' }, ({ i }) => {
        const q = p.add(U.sun.mul(length.mul(float(i)).div(FAR_STEPS)));
        const lq = local(q);
        const d = texture(tex, lq.xy).r;
        const height = zero === 'bottom' ? d : float(1).sub(d);
        If(height.greaterThan(lq.z.add(bias)), () => {
          lit.assign(0);
        });
      });
    });
    return vec4(lit);
  })();
  return {
    node,
    zero,
    row: c,
    uniforms: U,
    // (the shadow sun turned: the march follows it)
    setSun: (dir) => U.sun.value.copy(dir),
    sample: (u, v) => {
      const x = Math.min(png.w - 1, Math.max(0, Math.floor(u * png.w)));
      const y = Math.min(png.h - 1, Math.max(0, Math.floor(v * png.h)));
      return png.data[y * png.w + x] / 65535;
    },
    dispose: () => tex.dispose(),
  };
}

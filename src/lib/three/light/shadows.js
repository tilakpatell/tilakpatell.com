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

import { loadThree } from './three.js';

export const FILTER_HOOK = true; // ShadowNode reads shadow.filterNode on r186
export const PCSS_SAMPLES = { ultra: 256, high: 32 }; // the filter's samples (ultra: the record's maximum)
const SEARCH_DEPTH = 20; // m: the tallest blocker above a receiver the search looks for (a walker's legs)
const MIN_TEXELS = 1.5; // the narrowest penumbra, in texels, so a contact edge is still filtered
const VSM_SHADOW_MAP = 3; // three's VSMShadowMap
const GOLDEN = 2.399963229728653; // three's vogelDiskSample's golden angle
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

export function filterFor(tier, pcss = HOTH, { hook = FILTER_HOOK } = {}) {
  if (tier === 'low') return { kind: 'none' };
  if (tier === 'mid' || !PCSS_SAMPLES[tier]) return { kind: 'pcf' };
  if (!hook) return { kind: 'vsm', samples: pcss.initial };
  return { kind: 'pcss', ...pcss, max: Math.min(pcss.max, PCSS_SAMPLES[tier]) };
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
        If(blocks(d, z).not(), () => open.addAssign(1));
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

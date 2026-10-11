// The surface's post on the game's chain (the picture-everywhere design,
// lane T2): lib/three/light/post.js's chain for the quality level (ultra:
// SSGI, GTAO, SSR, the volumes, the bloom, god rays, the flare, the motion
// blur, TRAA; high: SSGI, GTAO, SSR, the volumes, the bloom, the motion
// blur, SMAA; mid: GTAO, the bloom, SMAA; what the backend cannot build left
// out, post.js's CANNOT) built by its passes.js, ending in the surface's
// FINAL grade (./final.js) as the chain's `grade` pass, so the hit's red
// edges, the rush, the grain and the rest stay the surface's. The bloom is
// the house's (universe/look.js's, three times over for the TSL node:
// ./post.js's UNREAL) unless the record's picture gives its five Gaussians.
// With the picture, FINAL takes the record's linear tone map and reads its
// LUT before the encoding (uLinear).
//
// The pace's sharpness is the internal resolution: each step is
// runtime/quality.js's headroomAt (the picture drawn under the screen and
// brought up by FSR1 or TAAU, then passes shed), and the chain is built
// again for it. The same face as ./post.js's createPost, so the scene
// calls one or the other.
//
//   createChainPost(renderer, scene, camera, { small, tier, backend, bloom })
//     → the post; light({ entry, light, lut, volumetrics, grade, picture })
//     builds the chain once the sun and the record are known (until then
//     the scene is drawn plain); `ready` settles when it is built
//   chainPasses(tier, entry, backend, refs, { bloom, grade }) → the passes (pure but for the node maker)
//   stepOf(sharpness) → the pace's step for a sharpness (pure)

import { finalGrade, finalUniforms, finite } from './final';
import { UNREAL } from './post';
import { LOOK } from '../../../universe/look';
import { STEPS } from '../../../../lib/three/pace';
import { headroom, passesFor } from '../../../../lib/three/light/post';
import { headroomAt } from '../../../../runtime/quality';

const SOFTEST = 0.6;

export const stepOf = (k) => {
  let best = 0;
  for (let i = 1; i < STEPS.length; i++) if (Math.abs(STEPS[i] - k) < Math.abs(STEPS[best] - k)) best = i;
  return best;
};

// The tier's chain with the surface's bloom and its FINAL as the grade
export function chainPasses(tier, entry, backend, refs, { bloom = LOOK.bloom, grade = null } = {}) {
  const passes = passesFor(tier, entry, backend, refs).map((p) => (p.kind === 'bloom' && !p.gaussians ? { ...p, strength: bloom.strength * UNREAL, radius: bloom.radius, threshold: bloom.threshold } : p));
  return grade ? headroom([...passes, { kind: 'grade', node: grade }], { scale: 1, shed: 0 }) : passes;
}

export function createChainPost(renderer, scene, camera, { small = false, tier = 'high', backend = 'webgpu', bloom: look = null } = {}) {
  const BLOOM = { ...LOOK.bloom, ...look };
  const { u, tNoise, noiseSize } = finalUniforms({ small });
  const grade = (tex) => finalGrade(u, (at) => finite(tex.sample(at).rgb), { tNoise });
  let refs = null; // what light() was handed
  let chain = null;
  let building = null;
  let builtFor = '';
  let disposed = false;
  let on = true;
  let glow = true;
  let flareK = 1;
  let sharp = 1;
  let level = 0;
  let aberrationWant = 0;
  let defocusWant = 0;
  let houseGrade = null;
  let frame = 0;
  let resolveReady = null;
  const ready = new Promise((r) => (resolveReady = r));
  const bloomNow = { threshold: BLOOM.threshold, radius: BLOOM.radius };
  const strength = () => (glow ? BLOOM.strength * UNREAL * Math.min(flareK, BLOOM.flareMax ?? Infinity) : 0);
  const setBloom = () => {
    const b = chain?.parts.bloom;
    if (!b || refs?.gaussians) return;
    b.strength.value = strength();
    b.threshold.value = bloomNow.threshold;
    b.radius.value = bloomNow.radius;
  };

  // the chain for the pace's step: built again only when what it draws changes
  const build = () => {
    if (!refs || disposed || !on) return building;
    const pixels = renderer.domElement ? renderer.domElement.width * renderer.domElement.height : 0;
    const room = headroomAt(stepOf(sharp), { tier, pixels });
    const passes = headroom(chainPasses(tier, refs.entry, backend, refs, { bloom: BLOOM, grade }), room);
    const key = passes.map((p) => `${p.kind}${p.scale ?? ''}`).join(',');
    if (key === builtFor) return building;
    builtFor = key;
    const was = building;
    building = (async () => {
      await was?.catch(() => {});
      const { buildChain } = await import('../../../../lib/three/light/passes.js');
      const next = await buildChain(renderer, passes);
      if (disposed || builtFor !== key) {
        next.dispose();
        return;
      }
      chain?.dispose();
      chain = next;
      setBloom();
      resolveReady();
    })().catch((e) => {
      if (import.meta.env?.DEV) console.warn('surface chain failed', e);
      builtFor = '';
      resolveReady();
    });
    return building;
  };

  return {
    ready,
    get on() {
      return on;
    },
    get target() {
      return null;
    },
    // (the node renderer compiles a pass by rendering it: no composer)
    composer: null,
    get scenePass() {
      return chain?.parts.scenePass ?? null;
    },
    get passes() {
      return builtFor.split(',').filter(Boolean);
    },
    get ratio() {
      return renderer.getPixelRatio();
    },
    get sharpness() {
      return sharp;
    },
    set sharpness(k) {
      sharp = k;
      build();
    },
    // the record, the sun's rays light, the LUT, the volumes: the chain built
    light(next) {
      refs = { scene, camera, ...next, gaussians: Boolean(next?.grade?.bloom) };
      u.uLinear.value = next?.grade?.tonemap === 'linear' ? 1 : 0;
      builtFor = '';
      return build();
    },
    render(w, h) {
      u.uAspect.value = w / h;
      const r = renderer.getPixelRatio() * Math.max(SOFTEST, sharp);
      u.uTexel.value.set(1 / Math.max(1, w * r), 1 / Math.max(1, h * r));
      frame = (frame + 1) % 997;
      u.uFrame.value.set((frame * 37) % noiseSize, (frame * 23) % noiseSize);
      if (on && chain) chain.pipeline.render();
      else renderer.render(scene, camera);
    },
    bloom: {
      get threshold() {
        return bloomNow.threshold;
      },
      set threshold(v) {
        bloomNow.threshold = v;
        setBloom();
      },
      get strength() {
        return BLOOM.strength;
      },
      set strength(v) {
        BLOOM.strength = v;
        setBloom();
      },
      get radius() {
        return bloomNow.radius;
      },
      set radius(v) {
        bloomNow.radius = v;
        setBloom();
      },
    },
    flare(k) {
      flareK = k;
      setBloom();
    },
    rush(k, x = 0.5, y = 0.5) {
      u.uRush.value = k;
      u.uCenter.value.set(x, y);
    },
    hit(k) {
      u.uHit.value = k;
    },
    grain(k) {
      u.uGrain.value = k;
    },
    aberration(k) {
      aberrationWant = k;
      u.uAberration.value = level >= 3 ? 0 : k;
    },
    exposure(k) {
      u.uExposure.value = k;
    },
    // a game's grade (./post.js's): its LUT over the finished colour, the
    // house's contrast and saturation set aside while it is on
    grading(g) {
      if (g?.lut) {
        houseGrade ??= { contrast: u.uContrast.value, sat: u.uSat.value };
        u.tLut.value = g.lut;
        u.uLutSize.value = g.size;
        u.uLutMix.value = g.mix ?? 1;
        u.uContrast.value = 0;
        u.uSat.value = 1;
      } else {
        u.uLutMix.value = 0;
        if (houseGrade) {
          u.uContrast.value = houseGrade.contrast;
          u.uSat.value = houseGrade.sat;
          houseGrade = null;
        }
      }
    },
    setToe(lo, hi) {
      u.uToe.value.set(lo, hi);
    },
    contrast(k) {
      u.uContrast.value = k;
    },
    defocus(k) {
      defocusWant = k;
      u.uDefocus.value = level >= 3 ? 0 : k;
    },
    setLevel(l) {
      level = l;
      u.uAberration.value = level >= 3 ? 0 : aberrationWant;
      u.uDefocus.value = level >= 3 ? 0 : defocusWant;
    },
    get flareOn() {
      return level < 2;
    },
    off() {
      if (!on) return;
      on = false;
      chain?.dispose();
      chain = null;
    },
    lite() {
      glow = false;
      setBloom();
    },
    uniforms: u,
    dispose() {
      disposed = true;
      chain?.dispose();
      chain = null;
      tNoise.dispose();
      resolveReady();
    },
  };
}

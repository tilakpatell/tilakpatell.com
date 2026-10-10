// The post chain a lit world asks for, as data for `rt.gfx.post`, in one
// fixed order, per tier, shed from the top when frames come late. Pure:
// the runtime builds it (src/runtime/webgpu.js, through passes.js here).
//
// The order (the design, "The light", post.js): render → ssgi (and its
// denoise) → ao → ssr → bloom → godrays → lensflare → lut → traa | smaa →
// output. A chain given out of order is put in it.
//
// Rules three's sources set:
// - SSGINode's temporal filtering needs TRAANode; without it a chain with
//   `ssgi` gains `denoise` (DenoiseNode) and takes the non-temporal preset.
// - TRAA wants no multisampling and is the anti-aliasing: `traa` and
//   `smaa` together keep `traa`.
// - LensflareNode reads the bloom's texture: no `bloom`, no `lensflare`.
// - GodraysNode marches a DirectionalLight's shadow map (not SunLight's):
//   no light given, no `godrays` (sun.js's `rays`).
// - `lut` needs the record's grading LUT as a Data3DTexture; none, none.
// - SSGI already darkens its creases; with `ao` beside it, its own AO is
//   left out of the composite (passes.js) so the two do not double.
//
// Backends: every pass builds on 'webgpu'. 'nodes-webgl' builds what the
// lit fixture shows it can (CANNOT: not SSR, not TRAA, which SMAA
// replaces); the classic 'webgl' builds none of these, so its chain is
// render, bloom, output as today.
//
// ORDER, NODE_PASSES, CANNOT, SSGI
// passesFor(tier, entry, backend = 'webgpu', refs = { scene, camera, light, lut }) → passes
// shed(passes, level) → passes   (level 1 drops ssgi, 2 ssr, 3 god rays and flare, 4 ao)
// arrange(passes) → passes       (the order and the rules above)

import { BLOOM } from '../bloom.js';
import { readEntry } from './entry.js';

export const ORDER = ['render', 'ssgi', 'denoise', 'ao', 'ssr', 'bloom', 'godrays', 'lensflare', 'lut', 'traa', 'smaa', 'output'];
// the kinds only the node renderer builds
export const NODE_PASSES = new Set(['ssgi', 'denoise', 'ao', 'ssr', 'godrays', 'lensflare', 'lut', 'traa', 'smaa']);
// What each backend cannot build. On 'nodes-webgl' the lit fixture
// (scripts/light-fixture.mjs, pass by pass) drew SSR as white smears below
// every pillar and TRAA as a flat grey frame, so both are left out there
// and SMAA takes TRAA's place; the rest drew as on the design. Lane S's
// calibration shot (--hoth) found SSGI the same: the chain render → ssgi →
// output lifts the frame's mean luminance from 0.320 to 0.787 whatever its
// GI intensity (0, 0.1, 0.25 and 1 gave the same frame), so it is the node
// on this backend, not the bounce; it is left out there too.
export const CANNOT = { webgpu: new Set(), 'nodes-webgl': new Set(['ssr', 'traa', 'ssgi']), webgl: NODE_PASSES };
// SSGINode's presets, from its own doc: with TRAA, and without
export const SSGI = {
  temporal: { low: { slices: 1, steps: 12 }, medium: { slices: 2, steps: 8 }, high: { slices: 3, steps: 16 } },
  plain: { low: { slices: 2, steps: 6 }, medium: { slices: 3, steps: 8 }, high: { slices: 4, steps: 12 } },
};
// SSGINode's giIntensity is 10, for an interior lit through a window; under
// an open sky the bounce at 10 whitens every wall, and at 2 with the bloom
// over it still washes the fixture out (its shots), so the game light asks
// for a tenth
export const GI = 1;
// m: how far SSGI gathers (SSGINode's 12 suits a hall; on open ground it
// reaches the sky's pixels above every surface that faces up)
export const SSGI_RADIUS = 4;
const SHED = [['ssgi', 'denoise'], ['ssr'], ['godrays', 'lensflare'], ['ao']];

const TIERS = {
  ultra: ['render', ['ssgi', 'high'], 'ao', 'ssr', 'bloom', 'godrays', 'lensflare', 'lut', 'traa', 'output'],
  high: ['render', ['ssgi', 'medium'], 'ao', 'ssr', 'bloom', 'lut', 'smaa', 'output'],
  mid: ['render', 'ao', 'bloom', 'smaa', 'output'],
  low: ['render', 'bloom', 'output'],
};

const rank = (k) => {
  const i = ORDER.indexOf(k);
  return i < 0 ? ORDER.length - 1.5 : i; // (anything else just before the output)
};
const has = (passes, kind) => passes.some((p) => p.kind === kind);

export function arrange(passes) {
  let out = passes
    .map((p, i) => [{ ...p }, i])
    .sort((a, b) => rank(a[0].kind) - rank(b[0].kind) || a[1] - b[1])
    .map(([p]) => p);
  if (has(out, 'traa')) out = out.filter((p) => p.kind !== 'smaa');
  if (!has(out, 'bloom')) out = out.filter((p) => p.kind !== 'lensflare');
  if (!has(out, 'ssgi')) out = out.filter((p) => p.kind !== 'denoise');
  out = out.filter((p) => p.kind !== 'godrays' || p.light);
  out = out.filter((p) => p.kind !== 'lut' || p.texture);
  const ssgi = out.find((p) => p.kind === 'ssgi');
  if (ssgi) {
    const temporal = has(out, 'traa');
    if (ssgi.temporal !== temporal) {
      const preset = SSGI[temporal ? 'temporal' : 'plain'][ssgi.preset ?? 'medium'];
      Object.assign(ssgi, { temporal, ...preset });
    }
    if (!temporal && !has(out, 'denoise')) out.splice(out.indexOf(ssgi) + 1, 0, { kind: 'denoise' });
  }
  return out;
}

export function passesFor(tier, entry, backend = 'webgpu', refs = {}) {
  const p = readEntry(entry);
  const cannot = CANNOT[backend] ?? CANNOT.webgl;
  const make = {
    render: () => ({ kind: 'render', scene: refs.scene, camera: refs.camera }),
    ssgi: (preset) => ({ kind: 'ssgi', preset, temporal: tier === 'ultra', ...SSGI[tier === 'ultra' ? 'temporal' : 'plain'][preset], radius: SSGI_RADIUS, gi: GI, camera: refs.camera }),
    ao: () => ({ kind: 'ao', radius: p.ao.radius, bias: p.ao.bias, power: p.ao.power, camera: refs.camera }),
    ssr: () => ({ kind: 'ssr', maxDistance: 40, thickness: 0.1, camera: refs.camera }),
    bloom: () => ({ kind: 'bloom', strength: BLOOM.strength * p.bloom.scale, radius: BLOOM.radius, threshold: BLOOM.threshold }),
    godrays: () => ({ kind: 'godrays', light: refs.light ?? null, color: p.sun.color.slice(), density: 0.7, maxDensity: 0.5, camera: refs.camera }),
    lensflare: () => ({ kind: 'lensflare', threshold: 0.5, ghostSamples: 4, ghostSpacing: 0.25 }),
    lut: () => ({ kind: 'lut', texture: refs.lut ?? p.grade.lut ?? null, intensity: 1 }),
    traa: () => ({ kind: 'traa', camera: refs.camera }),
    smaa: () => ({ kind: 'smaa' }),
    output: () => ({ kind: 'output' }),
  };
  const chain = (TIERS[tier] ?? TIERS.high).map((k) => (Array.isArray(k) ? make[k[0]](k[1]) : make[k]()));
  // (no TRAA on this backend: SMAA is the anti-aliasing instead)
  if (cannot.has('traa') && !cannot.has('smaa') && chain.some((x) => x.kind === 'traa')) chain.push(make.smaa());
  return arrange(chain.filter((x) => !cannot.has(x.kind)));
}

export function shed(passes, level = 0) {
  const drop = new Set(SHED.slice(0, Math.max(0, level)).flat());
  return arrange(passes.filter((p) => !drop.has(p.kind)));
}

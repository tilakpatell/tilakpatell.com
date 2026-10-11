// The video settings: every control of the picture a visitor may turn, under
// the quality presets (lane V1 of the Frostbite gaps design: docs/
// superpowers/specs/2026-10-11-frostbite-gaps-design.md, §6). A preset is a
// whole row of these; a control turned marks the picture Custom. Each
// control is a knob the code already has (its `reader` names the module
// that takes it), so the schema says what is drawn and the readers draw it;
// nothing here imports three.js or opens a store of its own but the one
// below. A default is what the code drew at that preset before this lane,
// except `aa` on high: TRAA, since SMAA cannot integrate the dithers PCSS,
// the fog march and the volumes draw (the audit's §1.7 and the spec's §6).
//
//   PRESETS, CONTROLS: the schema (id, group, label, hint, kind 'choice' |
//     'range', values, defaults by preset, live, cost(value), reader)
//   presetValues(preset) → { [id]: value }
//   resolve({ preset, overrides }, { ceiling = 'ultra' }) → { values,
//     custom, held }: the preset's row under the overrides, a value whose
//     cost is above the ceiling preset's default held at that default and
//     named in `held`; no preset reads as high
//   read(store) → { preset, overrides }; write(patch, store) → the same (a
//     `preset` in the patch sets 'tp-quality' and drops every override; a
//     control written back to its preset's value drops its override);
//     subscribe(fn) → stop; EVENT 'tp:video' on window with the resolved values
//   textureTier(level, values), samplesFor(values), anisotropyOf(values):
//     the small readers device.js and lod.js take

export const PRESETS = ['low', 'mid', 'high', 'ultra'];
export const KEY = 'tp-video';
export const EVENT = 'tp:video';

const rank = (list) => (v) => Math.max(0, list.indexOf(v));
const onOff = rank(['off', 'on']);
const choice = (id, group, label, hint, values, defaults, live, reader, cost = rank(values.map(([v]) => v))) => ({ id, group, label, hint, kind: 'choice', values, defaults, live, cost, reader });
const range = (id, group, label, hint, values, defaults, live, reader) => ({ id, group, label, hint, kind: 'range', values, defaults, live, cost: (v) => Number(v), reader });
const row = (low, mid, high, ultra) => ({ low, mid, high, ultra });

export const CONTROLS = Object.freeze([
  choice('aa', 'Anti-aliasing', 'Method', 'TRAA integrates the shadows’ and the fog’s noise over frames; SMAA smooths edges only.', [['off', 'Off'], ['smaa', 'SMAA'], ['traa', 'TRAA']], row('off', 'smaa', 'traa', 'traa'), true, 'light/post.js'),
  choice('msaa', 'Anti-aliasing', 'Multisampling (classic renderer)', 'Samples a pixel’s edges on the classic renderer; the node renderer’s chain does without.', [['0', 'Off'], ['2', '2×'], ['4', '4×'], ['8', '8×']], row('0', '2', '4', '8'), false, 'lib/device.js'),
  choice('shadows', 'Shadows', 'Quality', 'How many cascades the sun casts, how big each map is and how soft the edges are filtered.', [['off', 'Off'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']], row('off', 'low', 'medium', 'ultra'), false, 'light/sun.js, light/shadows.js'),
  range('shadowDistance', 'Shadows', 'Distance', 'How far from you the sun’s shadows are drawn, in metres.', { min: 30, max: 140, step: 10, show: (v) => `${v} m` }, row(30, 30, 30, 140), false, 'light/sun.js'),
  choice('contactShadows', 'Shadows', 'Contact shadows', 'Darkens the ground under each figure’s feet.', [['off', 'Off'], ['on', 'On']], row('off', 'off', 'on', 'on'), false, 'light/contact.js', onOff),
  choice('cloudShadows', 'Shadows', 'Cloud shadows', 'The record’s cloud layers drift across the sun’s shadow.', [['off', 'Off'], ['on', 'On']], row('off', 'on', 'on', 'on'), false, 'light/clouds.js', onOff),
  choice('gi', 'Lighting', 'Global illumination', 'Light bounced off nearby surfaces; SSAO darkens corners only.', [['off', 'Off'], ['ssao', 'SSAO'], ['low', 'SSGI low'], ['medium', 'SSGI medium'], ['high', 'SSGI high']], row('off', 'ssao', 'medium', 'high'), true, 'light/post.js'),
  choice('reflections', 'Lighting', 'Reflections', 'Screen-space reflections on glossy surfaces; probes alone elsewhere.', [['probes', 'Probes'], ['half', 'SSR half'], ['full', 'SSR full']], row('probes', 'probes', 'half', 'half'), true, 'light/post.js'),
  choice('volumetric', 'Lighting', 'Volumetric light', 'The level’s lit haze and light cones.', [['off', 'Off'], ['low', 'Low'], ['high', 'High']], row('off', 'off', 'low', 'high'), true, 'light/volumetrics.js'),
  choice('fogQuality', 'Lighting', 'Fog quality', 'How finely the fog is marched.', [['low', 'Low'], ['high', 'High']], row('low', 'low', 'low', 'high'), true, 'light/fog.js'),
  choice('localLights', 'Lighting', 'Local lights', 'The level’s lamps: the nearest few, or all of them clustered.', [['nearest', 'Nearest'], ['all', 'All']], row('nearest', 'nearest', 'all', 'all'), false, 'light/placed.js'),
  choice('bloom', 'Post', 'Bloom', 'The glow round bright things.', [['off', 'Off'], ['on', 'On']], row('on', 'on', 'on', 'on'), true, 'light/post.js', onOff),
  choice('lensFlare', 'Post', 'Lens flare', 'The record’s flare off the sun.', [['off', 'Off'], ['on', 'On']], row('off', 'off', 'off', 'on'), true, 'light/post.js', onOff),
  choice('godRays', 'Post', 'God rays', 'Shafts of sunlight through the air.', [['off', 'Off'], ['on', 'On']], row('off', 'off', 'off', 'on'), true, 'light/post.js', onOff),
  choice('depthOfField', 'Post', 'Depth of field', 'Focus in the cinematic cameras.', [['off', 'Off'], ['on', 'On']], row('on', 'on', 'on', 'on'), true, 'light/post.js', onOff),
  choice('motionBlur', 'Post', 'Motion blur', 'Blur with movement, where the record asks for it.', [['off', 'Off'], ['camera', 'Camera'], ['full', 'Full']], row('off', 'off', 'full', 'full'), true, 'light/post.js'),
  choice('filmGrain', 'Post', 'Film grain', 'The universe’s grain.', [['off', 'Off'], ['low', 'Low'], ['full', 'Full']], row('off', 'full', 'full', 'full'), true, 'lib/three/noise.js'),
  choice('aberration', 'Post', 'Chromatic aberration', 'Colour fringing at speed.', [['off', 'Off'], ['on', 'On']], row('off', 'on', 'on', 'on'), true, 'universe/post.js', onOff),
  choice('textures', 'Textures', 'Texture quality', 'The size of the maps a level loads.', [['low', 'Low'], ['mid', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']], row('low', 'mid', 'high', 'ultra'), false, 'lib/level/lod.js'),
  choice('anisotropy', 'Textures', 'Anisotropic filtering', 'Keeps a surface sharp at a glancing angle.', [['1', 'Off'], ['4', '4×'], ['8', '8×'], ['16', '16×']], row('1', '4', '16', '16'), false, 'lib/device.js'),
]);

const byId = new Map(CONTROLS.map((c) => [c.id, c]));
const preset = (p) => (PRESETS.includes(p) ? p : 'high');

export function presetValues(p) {
  const key = preset(p);
  return Object.fromEntries(CONTROLS.map((c) => [c.id, c.defaults[key]]));
}

const known = (c, v) => {
  if (c.kind === 'choice') return c.values.some(([x]) => x === v) ? v : undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= c.values.min && n <= c.values.max ? n : undefined;
};

export function resolve({ preset: p = null, overrides = {} } = {}, { ceiling = 'ultra' } = {}) {
  const base = presetValues(p);
  const top = presetValues(ceiling);
  const values = { ...base };
  const held = {};
  let custom = false;
  for (const [id, raw] of Object.entries(overrides ?? {})) {
    const c = byId.get(id);
    if (!c) continue;
    const v = known(c, raw);
    if (v === undefined) continue;
    if (c.cost(v) > c.cost(top[id])) {
      held[id] = v;
      values[id] = top[id];
    } else values[id] = v;
    if (values[id] !== base[id]) custom = true;
  }
  return { values, custom, held };
}

const pageStore = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};
const get = (store, k) => {
  try {
    return store?.getItem(k) ?? null;
  } catch {
    return null;
  }
};
const set = (store, k, v) => {
  try {
    if (v == null) store?.removeItem(k);
    else store?.setItem(k, v);
  } catch {
    /* storage unavailable: it lasts for this page */
  }
};
const json = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

export function read(store = pageStore()) {
  const q = get(store, 'tp-quality');
  const kept = json(get(store, KEY));
  const overrides = {};
  if (kept && kept.v === 1) {
    for (const [id, v] of Object.entries(kept)) {
      const c = byId.get(id);
      if (c && known(c, v) !== undefined) overrides[id] = known(c, v);
    }
  }
  return { preset: PRESETS.includes(q) ? q : null, overrides };
}

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function write(patch = {}, store = pageStore()) {
  const was = read(store);
  let { preset: p, overrides } = was;
  if ('preset' in patch) {
    p = PRESETS.includes(patch.preset) ? patch.preset : null;
    overrides = {};
    set(store, 'tp-quality', p);
  }
  const base = presetValues(p);
  for (const [id, raw] of Object.entries(patch)) {
    const c = byId.get(id);
    if (!c) continue;
    const v = known(c, raw);
    if (v === undefined || v === base[id]) delete overrides[id];
    else overrides[id] = v;
  }
  set(store, KEY, Object.keys(overrides).length ? JSON.stringify({ v: 1, ...overrides }) : null);
  const next = { preset: p, overrides };
  const values = resolve(next).values;
  for (const fn of listeners) fn(next, values);
  if (typeof window !== 'undefined' && typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent(EVENT, { detail: values }));
  return next;
}

export const textureTier = (level, values) => (values?.textures && PRESETS.includes(values.textures) ? values.textures : level);
const number = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
export const samplesFor = (values) => number(values?.msaa);
export const anisotropyOf = (values) => number(values?.anisotropy);

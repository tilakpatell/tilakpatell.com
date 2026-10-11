// A look's colours on a figure, without the shader that paints them: the
// zones, the colour keys and the uniforms' numbers (all of what ./dress.js
// says below), and dressColors for a paint passed in, so ./dress.js
// recolours in GLSL and ./dressNodes.js in nodes.
//
// A look's colours on a figure. A Meshy figure is one mesh with one
// texture, so a coat can't be given a colour as a part: each texel is read
// instead, as Morty's clones' shirts are (portal/meshyCast.js shirted()),
// and told apart twice over. First by where it is on the body: each
// vertex's zone is the zone of the bone that moves it most (head, torso and
// arms, thighs, shins, feet; and the hands, which keep their skin), so Rick's
// light-blue hair and his light-blue shirt are
// two things. Then by its colour, in that zone: a hue, saturation and value
// window for each region of each body (KEYS, read off each texture by
// lab/zones.mjs). A texel in a region takes the swatch at its own
// brightness against the region's (so its light and shade stay), held
// inside `shade` (a floor that flattens the darker patches some textures
// bake in: HD Rick's coat comes out grey down one side, and is white again
// here with nothing picked: `fix`).
//
// addZones(geometry, boneNames) once per geometry; recolor(material, body,
// colors) on a figure's own copy of its material; dressColors(figure, look)
// does both for a figure from createMeshyCast().make().

import * as THREE from 'three';
import { bodyById, swatchById } from './looks';

export const MAX_REGIONS = 6; // (five a body’s own at most, and Mr. White’s hands besides)

// 0 head, 1 torso and arms, 2 hips and thighs, 3 shins, 4 feet, 5 hands (a
// zone no region takes: skin stays skin)
export const zoneOf = (bone) => (/neck|Head|head/.test(bone) ? 0 : /Hand/.test(bone) ? 5 : /Foot|Toe/.test(bone) ? 4 : /UpLeg|Hips/.test(bone) ? 2 : /Leg/.test(bone) ? 3 : 1);

// A float `zone` for each vertex, from its strongest bone; and `lower`, how
// much of it the hips and legs move (zones 2 to 4), which blends smoothly
// across the body where `zone` steps: a waist follows its 0.5. `upper`, how
// much the head and neck move it (zone 0), does the same for a collar.
export function addZones(geometry, boneNames) {
  if (geometry.attributes.zone && geometry.attributes.lower && geometry.attributes.upper) return geometry;
  const idx = geometry.attributes.skinIndex;
  const w = geometry.attributes.skinWeight;
  const n = geometry.attributes.position.count;
  const out = new Float32Array(n);
  const lower = new Float32Array(n);
  const upper = new Float32Array(n);
  if (idx && w) {
    const zones = boneNames.map(zoneOf);
    for (let i = 0; i < n; i++) {
      let best = 0;
      for (let k = 1; k < 4; k++) if (w.getComponent(i, k) > w.getComponent(i, best)) best = k;
      out[i] = zones[idx.getComponent(i, best)] ?? 1;
      for (let k = 0; k < 4; k++) {
        const z = zones[idx.getComponent(i, k)] ?? 1;
        if (z >= 2 && z <= 4) lower[i] += w.getComponent(i, k);
        else if (z === 0) upper[i] += w.getComponent(i, k);
      }
    }
  }
  if (!geometry.attributes.zone) geometry.setAttribute('zone', new THREE.BufferAttribute(out, 1));
  geometry.setAttribute('lower', new THREE.BufferAttribute(lower, 1));
  geometry.setAttribute('upper', new THREE.BufferAttribute(upper, 1));
  return geometry;
}

// Each body's regions, as windows in its texture's sRGB colour (hue in
// degrees, a window that wraps if it starts after it ends; saturation and
// value 0…1), the zones they're in (zoneOf's), the value a typical texel of it has (ref), the range the shade is
// held to, a colour it takes when none is picked (fix), and (Walt’s and
// Jesse’s only) how much of it the hips and legs must move (lower: a
// window, 0…1).
const key = (zones, hue, sat, val, ref, shade = [0.45, 1.25], fix = null, lower = null, upper = null) => ({ zones, hue, sat, val, ref, shade, fix, lower, upper });
const ANY = [0, 360];
const GREY = [0, 0.13];
const HAIR_BLUE = key([0], [178, 232], [0.06, 0.55], [0.72, 1], 0.95);
const MORTY = {
  inner: key([0, 1, 2, 3], [42, 78], [0.3, 1], [0.55, 1], 0.98),
  legs: key([2, 3, 4], [192, 240], [0.3, 1], [0.2, 0.85], 0.55),
  hair: key([0], [12, 48], [0.5, 1], [0.15, 0.62], 0.4),
};
// Walt’s and Jesse’s, read off Albuquerque’s figures of them (sampled by
// zone as lab/zones.mjs does: every triangle at fifteen points in UV space,
// each texel’s HSV counted by the zone of its nearest corner’s strongest
// bone; then each region shown in a loud colour on the turntable, to see it
// takes its part and nothing else). Every region is measured by one of the
// few windows here, so a new texture on the same figures (an HD retexture)
// is retuned here, sampled the same way.
//
// Walt’s one figure, in the lab’s yellow suit: by zone, the suit is a
// jacket (the torso and arms), a shirt’s collar (its hood, down round his
// neck) and trousers (the hips down); and his long black gloves, his brown
// work boots. Mr. White’s and Heisenberg’s gloves are his bare forearms
// and hands (`gloves` and `hands` aren’t their regions: nobody picks them).
const SUIT = [[36, 58], [0.42, 1], [0.45, 1], 0.85];
const suit = (zones, fix = null, lower = null, upper = null) => key(zones, ...SUIT, undefined, fix, lower, upper);
const ABOVE = [0, 0.5]; // (the jacket, down to his waist: half his weight the hips’…)
const BELOW = [0.5, 1]; // (…and the trousers from there)
// (and the hood round his neck: the collar where the head and neck move it
// most, the jacket below; the hood's triangles are split between the head's
// zone and the torso's every which way, so the line is drawn by `upper`)
const COLLAR = [0.45, 1]; // (a little over each other: where both edges soften at once, the suit’s own yellow would show between)
const UNDER = [0, 0.55];
const gloves = (fix = null, zones = [1, 5]) => key(zones, [160, 300], [0, 0.8], [0, 0.22], 0.09, [0.8, 1.15], fix);
const BOOTS = key([3, 4], ANY, [0, 0.66], [0, 0.37], 0.24);
const HANDS = '#c39283'; // (his skin’s own colour, off his face)
// (his hands are all glove: any dark texel there, its creases and shine too;
// his forearms, `gloves` in zone 1, only the glove’s own blue-black)
const HANDS_KEY = key([5], ANY, [0, 1], [0, 0.45], 0.12, [0.8, 1.15], HANDS);
// Jesse: the burnt-orange hoodie (its hood down round his neck), baggy
// jeans, white high-tops, his buzzed light-brown hair (and brows)
// (the buzzed sides lighter than the top: 24–32°, value to 0.58, where
// his skin’s 13–20° and brighter)
const jesseHair = key([0], [21, 40], [0.26, 0.68], [0.2, 0.6], 0.34);
const BB = {
  walt: { outer: suit([0, 1, 2, 3, 4]), inner: gloves(), shoes: BOOTS },
  mrwhite: { outer: suit([0, 1, 2], 'tanjacket', ABOVE, UNDER), inner: suit([0, 1], 'waltgreen', null, COLLAR), legs: suit([1, 2, 3, 4], 'khaki', BELOW), shoes: BOOTS, gloves: gloves(HANDS, [1]), hands: HANDS_KEY },
  heisenberg: { outer: suit([0, 1, 2], 'heisenbergblack', ABOVE, UNDER), inner: suit([0, 1], 'beaniegrey', null, COLLAR), legs: suit([1, 2, 3, 4], 'khaki', BELOW), shoes: BOOTS, gloves: gloves(HANDS, [1]), hands: HANDS_KEY },
  jesse: {
    outer: key([0, 1, 2], [4, 28], [0.55, 1], [0.3, 0.72], 0.54),
    legs: key([2, 3], [192, 240], [0.14, 0.85], [0.08, 0.62], 0.25),
    hair: jesseHair,
    shoes: key([3, 4], ANY, [0, 0.12], [0.4, 1], 0.8),
  },
  jesselab: { outer: suit([0, 1, 2, 3, 4]), inner: gloves(), hair: key([0], [15, 40], [0.15, 0.6], [0.2, 0.52], 0.34) }, // (his own figure, its hair painted darker and warmer)
};
const WEIGHED = new Set(Object.keys(BB)); // (the bodies whose shader reads `lower`, its zones one a triangle)
export const weighs = (bodyId) => WEIGHED.has(bodyId);
export const KEYS = {
  rick: { outer: key([1, 2, 3], ANY, GREY, [0.3, 1], 0.95, [0.86, 1.08], 'labwhite'), inner: key([1], [158, 205], [0.06, 0.5], [0.55, 1], 0.85), legs: key([2, 3], [22, 66], [0.28, 1], [0.15, 0.7], 0.4), hair: HAIR_BLUE },
  tinyrick: { outer: key([1, 2, 3], ANY, GREY, [0.3, 1], 0.9, [0.86, 1.08], 'labwhite'), inner: key([1], [158, 205], [0.06, 0.5], [0.55, 1], 0.85), legs: key([2, 3], [22, 66], [0.28, 1], [0.15, 0.7], 0.4), hair: HAIR_BLUE },
  cowboyrick: { outer: key([1, 2], [12, 48], [0.28, 0.85], [0.22, 0.62], 0.42), inner: key([1], ANY, GREY, [0.72, 1], 0.97), legs: key([2, 3], [188, 232], [0.22, 0.75], [0.38, 0.85], 0.62) },
  cop: { outer: key([0, 1, 2, 3], [198, 248], [0.3, 0.95], [0.08, 0.58], 0.35), hair: HAIR_BLUE },
  detectiverick: { outer: key([1, 2, 3], [12, 48], [0.24, 0.62], [0.45, 0.82], 0.62), legs: key([2, 3], ANY, [0, 0.16], [0.05, 0.35], 0.22) },
  sweaterrick: { outer: key([1, 2, 3], [338, 16], [0.5, 1], [0.3, 1], 0.8), legs: key([2, 3], [14, 52], [0.22, 0.7], [0.08, 0.36], 0.22), hair: HAIR_BLUE },
  suitrick: { outer: key([1, 2, 3], [188, 232], [0.08, 0.55], [0.42, 0.96], 0.8), hair: key([0], [178, 232], [0.06, 0.55], [0.86, 1], 0.97) },
  factoryrick: { outer: key([1, 2, 3], [178, 222], [0.08, 0.48], [0.52, 0.96], 0.8) },
  constructionrick: { outer: key([0, 1, 2, 3], [4, 40], [0.55, 1], [0.6, 1], 0.98) },
  'councilrick-a': { outer: key([1, 2, 3], ANY, GREY, [0.55, 1], 0.95), hair: key([0], [188, 232], [0.06, 0.5], [0.75, 1], 0.95) },
  'councilrick-b': { outer: key([1, 2, 3], [198, 252], [0.22, 0.85], [0.06, 0.42], 0.22), hair: HAIR_BLUE },
  'councilrick-c': { outer: key([1, 2, 3], ANY, GREY, [0.6, 1], 0.97), legs: key([2, 3], [195, 240], [0.25, 0.7], [0.25, 0.6], 0.42) },
  morty: { ...MORTY, shoes: key([4], ANY, [0, 0.16], [0.6, 1], 0.97) },
  evilmorty: { inner: MORTY.inner, legs: key([2, 3, 4], [192, 245], [0.3, 1], [0.15, 0.7], 0.4), hair: MORTY.hair },
  copmorty: { outer: key([0, 1, 2, 3], [198, 248], [0.3, 0.95], [0.08, 0.58], 0.35), hair: MORTY.hair },
  ...BB,
};

// A key that isn’t one of the body’s regions (Mr. White’s gloves) is
// nobody’s to pick: it’s always its `fix` (a swatch’s id, or a colour of
// its own), in a slot after the regions’.
const fixed = (f) => swatchById(f) ?? (/^#[0-9a-f]{6}$/.test(f ?? '') ? { hex: f } : null);
export function regionUniforms(bodyId, colors = {}) {
  const body = bodyById(bodyId);
  const regions = Object.keys(body?.regions ?? {});
  const order = [...regions, ...Object.keys(KEYS[bodyId] ?? {}).filter((r) => !regions.includes(r))].slice(0, MAX_REGIONS);
  while (order.length < MAX_REGIONS) order.push(null);
  const u = { order, on: [], swatch: [], zones: [], hue: [], sat: [], val: [], ref: [], shade: [], lower: [], upper: [] };
  for (const r of order) {
    const k = r ? KEYS[bodyId]?.[r] : null;
    const pick = r ? ((regions.includes(r) ? swatchById(colors[r]) : null) ?? fixed(k?.fix)) : null;
    const on = Boolean(k && pick);
    u.on.push(on ? 1 : 0);
    u.swatch.push(new THREE.Color().setStyle(pick?.hex ?? '#ffffff', THREE.NoColorSpace)); // (sRGB numbers, as the windows are)
    u.zones.push((k?.zones ?? []).reduce((n, z) => n + 2 ** z, 0)); // (a bit for each zone)
    u.hue.push(new THREE.Vector2(...(k?.hue ?? ANY)));
    // (a window open at 0 or 1 is open past it: its soft edge would halve a texel right at the end)
    const open = ([lo, hi]) => new THREE.Vector2(lo <= 0 ? -1 : lo, hi >= 1 ? 2 : hi);
    u.sat.push(open(k?.sat ?? [0, 1]));
    u.val.push(open(k?.val ?? [0, 1]));
    u.ref.push(k?.ref ?? 1);
    u.shade.push(new THREE.Vector2(...(k?.shade ?? [0.45, 1.25])));
    u.lower.push(open(k?.lower ?? [0, 1]));
    u.upper.push(open(k?.upper ?? [0, 1]));
  }
  return u;
}

// A look's colours on a figure from createMeshyCast().make(): its meshes'
// zones, and its own copies of their materials (cloneShaded), taught the
// body's regions (recolor). Returns the copies, for the caller to dispose
// (or set() again).
export function dressColorsWith({ recolor, cloneShaded }) {
  return function dressColors(figure, look) {
    const made = [];
    figure.group.traverse((o) => {
      if (!o.isSkinnedMesh || o.userData.ink) return;
      addZones(o.geometry, o.skeleton.bones.map((b) => b.name));
      const m = recolor(cloneShaded(o.material), look.body, look.colors);
      o.material = m;
      made.push(m);
    });
    return made;
  };
}

// Lothlórien’s kit, made for the Road: the materials the Lothlórien
// chapter’s builders read (towns/lorien/{mallorn,flets,mirror,boat,
// argonath}.js), under the same names and from the same painted canvases as
// the chapter’s kit (towns/lorien/props.js’s createLorienKit), added to a
// town kit (townKit.js’s) on the Road’s house look. The chapter’s leaves
// glow in their own colours by a shader hook; here by an emissive node on
// the same colours. Its waters are its shaders; here the basin and the
// falls are pale sheets, and the Mirror’s water a dark still disc that
// shows the Eye (creatures/eye.js) as the vision rises.
//
//   addLorien(town, road, renderer) → { tex, setNight(k), tick(t), dispose() }
//     town: createTownKit’s; K gains Lothlórien’s mats, K.water, K.night, K.shaders

import * as THREE from 'three';
import { MeshBasicNodeMaterial, SpriteNodeMaterial } from 'three/webgpu';
import { color, float, mix, uniform, uv, vec3, vertexColor } from 'three/tsl';
import { canvasTexture, hot } from '../../../lib/three/canvasTexture';
import { normalFromField } from '../../../lib/paint';
import { stoneTextures } from '../stoneTextures';
import { barkCanvas, haloCanvas, leafCardCanvas, weatheredCanvas, woodCanvas } from '../towns/lorien/canvases';
import { fieldOf } from '../towns/lorien/helpers';
import { eyeColour } from './creatures/eye';

const S = 256;
const GOLD = new THREE.Color(0xffd884);

export function addLorien(town, road, renderer) {
  const { K, mats } = town;
  const T = (c, o) => canvasTexture(c, renderer, o);
  const made = [];
  const M = (o, glow = 0) => {
    const m = road.material(o);
    // (the leaves glow softly in their own colours: a crown luminous gold, not lit lumps)
    if (glow) m.emissiveNode = vertexColor().rgb.mul(color(GOLD)).mul(glow);
    made.push(m);
    return m;
  };
  const bark = barkCanvas(S);
  const wood = woodCanvas(S);
  const stone = weatheredCanvas(S, 11);
  const tex = {
    bark: T(bark),
    barkN: T(normalFromField(fieldOf(bark), S, S, 1.2), { srgb: false }),
    wood: T(wood),
    woodN: T(normalFromField(fieldOf(wood), S, S, 1.0), { srgb: false }),
    leafCard: T(leafCardCanvas(), { wrap: false }),
    weathered: T(stone.c),
    weatheredN: T(normalFromField(stone.field, S, S, 2.5), { srgb: false }),
    halo: T(haloCanvas(), { wrap: false }),
  };
  const pale = stoneTextures(renderer, { seed: 61, dark: [186, 188, 184], light: [250, 250, 246], joint: 0.12, relief: 1.4 });
  const tTime = uniform(0);
  const night = { value: 0 };
  K.night = night;
  K.water = { uTime: { value: 0 }, uNight: night };
  // the Mirror’s water: dark and still, the Eye rising in it with the vision
  // (the builder keeps the uniforms it passes and sets them: they become the nodes’ own)
  const mirrorWater = (given = {}) => {
    const u = Object.assign(given, { uK: uniform(given.uK?.value ?? 0), uKind: uniform(given.uKind?.value ?? 0), uTime: tTime });
    const m = new MeshBasicNodeMaterial();
    const still = mix(vec3(0.05, 0.07, 0.1), vec3(0.2, 0.26, 0.34), float(1).sub(uv().sub(0.5).length().mul(1.6)));
    // (the slit upright as the basin is seen from the road, its steps’ side)
    const eye = eyeColour(uv().yx, { k: u.uK.mul(u.uKind.equal(1).select(1, 0)), time: tTime });
    m.colorNode = still.add(eye);
    m.uniforms = u;
    made.push(m);
    return m;
  };
  K.shaders = { mirrorWater };
  K.tex = { ...K.tex, ...tex };
  const sheet = (o) => {
    const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, ...o });
    made.push(m);
    return m;
  };
  const halo = new SpriteNodeMaterial({ map: tex.halo, color: hot(0xbcdcff, 1.4), transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending });
  made.push(halo);
  Object.assign(mats, {
    // the mallorns: silver bark, gold leaves, the far wood
    // (warmer than the chapter’s: under the Road’s cold sky a white bark reads lilac)
    bark: M({ map: tex.bark, normalMap: tex.barkN, vertexColors: true, color: 0xc8beac }),
    canopy: M({ map: K.tex.leaves, normalMap: K.tex.leavesN, color: new THREE.Color(1.5, 1.46, 1.36), vertexColors: true }, 0.4),
    leafCard: M({ map: tex.leafCard, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide }, 0.4),
    far: M({ vertexColors: true, color: 0xd8ccb0 }, 0.2),
    // white-grey elven woodwork, the boat, silver, the lamps’ light
    elfwood: M({ map: tex.wood, normalMap: tex.woodN, color: 0xd6ccb8 }),
    boat: M({ map: tex.wood, normalMap: tex.woodN, color: 0xd0c8b8 }),
    silver: M({ color: 0xf4f6fa, emissive: new THREE.Color(0x30343a) }),
    lamp: M({ color: 0xeaf4ff, emissive: hot(0xbfe0ff, 2.4), emissiveIntensity: 0.35 }),
    halo,
    // stone: the kings, the river’s rocks and banks, pale carved work
    kingStone: M({ map: tex.weathered, normalMap: tex.weatheredN, normalScale: new THREE.Vector2(1.3, 1.3), vertexColors: true }),
    riverRock: M({ map: tex.weathered, normalMap: tex.weatheredN, vertexColors: true }),
    cliff: M({ map: tex.weathered, normalMap: tex.weatheredN, vertexColors: true }),
    paleStone: M({ map: pale.map, normalMap: pale.normalMap, color: 0xf4f2ec }),
    // the forest floor and what grows on it
    earth: M({ map: K.tex.leaves, normalMap: K.tex.leavesN, vertexColors: true }),
    fern: M({ vertexColors: true }),
    litter: M({ vertexColors: true, side: THREE.DoubleSide }),
    petal: M({ vertexColors: true, side: THREE.DoubleSide }, 0.12),
    // the fountains’ water and falls: pale sheets
    water: sheet({ color: 0xbcd4e6, opacity: 0.75 }),
    fall: sheet({ color: 0xe6f0f8, opacity: 0.7, side: THREE.DoubleSide }),
  });

  return {
    tex,
    // dusk and night: the lanterns brighten and their halos spread, the gold fades
    setNight(k) {
      const t = Math.min(1, Math.max(0, k));
      night.value = t;
      mats.lamp.emissiveIntensity = 0.35 + 0.9 * t;
      halo.opacity = 0.22 + 0.4 * t;
    },
    tick(t) {
      tTime.value = t;
      K.water.uTime.value = t;
    },
    dispose() {
      for (const m of made) m.dispose();
      for (const t of Object.values(tex)) t.dispose();
      pale.map.dispose();
      pale.normalMap.dispose();
    },
  };
}

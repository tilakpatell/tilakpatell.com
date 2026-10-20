// Lothlórien, made in code: the kit the golden wood is built from. The
// great mallorns with their smooth silver bark and their crowns of pale
// gold, and far ones for the wood beyond; the flets that ring their trunks
// and the stairs that wind up to them; the elves' blue-white lanterns;
// Galadriel's Mirror in its hollow, and what it shows; a grey boat with a
// swan's neck at its prow; the Argonath on the Anduin, wet rocks for the
// rapids and cliffs for the banks; fallen leaves, ferns, and a little white
// fountain.
//
// Built with the Shire's kit (../../shire/props.js) as Rivendell's is: its
// materials and helpers, and its own for silver bark, gold leaves, pale
// elven woodwork, silver, weathered stone and water. The same conventions:
// each builder's group stands on y = 0 at its origin, fronts face +z,
// figures and boats face +x, and fixed parts are merged one mesh per
// material. Angles round a trunk are measured as the ground plane's
// (cos a, sin a) in (x, z): a = 0 is +x, a = π/2 is +z.

import * as THREE from 'three';
import { canvasTexture, hot } from '../../../../lib/three/canvasTexture';
import { clamp01, mix, normalFromField } from '../../../../lib/paint';
import { stoneTextures } from '../../stoneTextures';
import { createShireKit } from '../../shire/props';
import { sharpen } from '../../../../lib/three/textures';
import { argonath, fountain, riverCliffGeo, riverRockGeo } from './argonath';
import { boat } from './boat';
import { barkCanvas, haloCanvas, leafCardCanvas, shireVisionCanvas, skyCanvas, weatheredCanvas, woodCanvas } from './canvases';
import { fernGeo, flet, goldLeavesGeo, lantern, spiralStair } from './flets';
import { C, fieldOf } from './helpers';
import { mallorn, mallornFarGeo } from './mallorn';
import { mirror } from './mirror';
import { basinWaterMaterial, fallSheetMaterial, glowByColour, mirrorWaterMaterial } from '../../nodes/towns/lorien/propsShaders';

// ── the kit ──


export function createLorienKit(renderer) {
  const kit = createShireKit(renderer);
  const { K, mats } = kit;
  const S = 256;
  const T = (c, o) => canvasTexture(c, renderer, o);
  const bark = barkCanvas(S);
  const wood = woodCanvas(S);
  const stone = weatheredCanvas(S, 11);
  // the wood's light, for silver to show
  const sky = new THREE.CanvasTexture(skyCanvas());
  sharpen(sky);
  sky.mapping = THREE.EquirectangularReflectionMapping;
  sky.colorSpace = THREE.SRGBColorSpace;
  const tex = {
    bark: T(bark),
    barkN: T(normalFromField(fieldOf(bark), S, S, 1.2), { srgb: false }),
    wood: T(wood),
    woodN: T(normalFromField(fieldOf(wood), S, S, 1.0), { srgb: false }),
    leafCard: T(leafCardCanvas(), { wrap: false }),
    weathered: T(stone.c),
    weatheredN: T(normalFromField(stone.field, S, S, 2.5), { srgb: false }),
    halo: T(haloCanvas(), { wrap: false }),
    shire: T(shireVisionCanvas(), { wrap: false }),
    woodSky: sky,
  };
  const pale = stoneTextures(renderer, { seed: 61, dark: [186, 188, 184], light: [250, 250, 246], joint: 0.12, relief: 1.4 });
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const gold = C(0xffd884);
  // dusk to night, 0 to 1, shared by every water shader
  const night = { value: 0 };
  K.night = night;
  K.water = { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 }, uNight: night };
  // (the Mirror reaches its water’s shader through the kit: its own file carries none)
  K.shaders = { mirrorWater: mirrorWaterMaterial };
  K.tex = { ...K.tex, ...tex };
  Object.assign(mats, {
    // the mallorns: silver bark, gold leaves, the far wood
    bark: M({ map: tex.bark, normalMap: tex.barkN, vertexColors: true, roughness: 0.5, envMap: sky, envMapIntensity: 0.3 }),
    canopy: M({ map: K.tex.leaves, normalMap: K.tex.leavesN, color: new THREE.Color(1.5, 1.46, 1.36), vertexColors: true, roughness: 0.8, emissive: gold, emissiveIntensity: 0.4 }),
    leafCard: M({ map: tex.leafCard, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, emissive: gold, emissiveIntensity: 0.4 }),
    far: M({ vertexColors: true, roughness: 0.9, emissive: gold, emissiveIntensity: 0.2 }),
    // white-grey elven woodwork, the boat, silver, the lamps' light
    elfwood: M({ map: tex.wood, normalMap: tex.woodN, color: 0xe2e5e8, roughness: 0.55 }),
    boat: M({ map: tex.wood, normalMap: tex.woodN, color: 0xd2d7dc, roughness: 0.42, envMap: sky, envMapIntensity: 0.35 }),
    silver: M({ color: 0xe8ecf2, metalness: 0.92, roughness: 0.2, envMap: sky }),
    lamp: M({ color: 0xeaf4ff, emissive: hot(0xbfe0ff, 2.4), emissiveIntensity: 0.35, roughness: 0.25 }),
    halo: new THREE.SpriteMaterial({ map: tex.halo, color: hot(0xbcdcff, 1.4), transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }),
    // stone: the kings, the river's rocks and banks, pale carved work
    kingStone: M({ map: tex.weathered, normalMap: tex.weatheredN, normalScale: new THREE.Vector2(1.3, 1.3), vertexColors: true, roughness: 0.95 }),
    riverRock: M({ map: tex.weathered, normalMap: tex.weatheredN, vertexColors: true, roughness: 0.38, envMap: sky, envMapIntensity: 0.4 }),
    cliff: M({ map: tex.weathered, normalMap: tex.weatheredN, vertexColors: true, roughness: 0.93 }),
    paleStone: M({ map: pale.map, normalMap: pale.normalMap, color: 0xf4f2ec, roughness: 0.62 }),
    // the forest floor and what grows on it
    earth: M({ map: K.tex.leaves, normalMap: K.tex.leavesN, vertexColors: true, roughness: 1 }),
    fern: M({ vertexColors: true, roughness: 0.8 }),
    litter: M({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 }),
    petal: M({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6, emissive: C(0xffffff), emissiveIntensity: 0.12 }),
    // the fountains' water
    water: basinWaterMaterial(K.water),
    fall: fallSheetMaterial(K.water),
  });
  for (const k of ['canopy', 'leafCard', 'far', 'petal']) mats[k] = glowByColour(mats[k]);
  for (const [k, m] of Object.entries(mats)) if (!m.name) m.name = k;
  const shireNight = kit.setNight;
  // dusk and night: the lanterns brighten and their halos spread, the gold
  // leaves' own glow fades, the waters turn to the night sky
  const setNight = (k) => {
    shireNight(k);
    const t = clamp01(k);
    night.value = t;
    mats.lamp.emissiveIntensity = mix(0.35, 1, t);
    mats.halo.opacity = mix(0.22, 0.9, t);
    mats.canopy.emissiveIntensity = mix(0.4, 0.18, t);
    mats.leafCard.emissiveIntensity = mix(0.4, 0.18, t);
    mats.far.emissiveIntensity = mix(0.2, 0.07, t);
    mats.petal.emissiveIntensity = mix(0.12, 0.7, t);
  };
  const rocks = [riverRockGeo(3), riverRockGeo(7), riverRockGeo(12)];
  return {
    ...kit,
    mats,
    K,
    setNight,
    mallorn: (o) => mallorn(K, o),
    mallornFar: (seed = 1) => mallornFarGeo(seed),
    flet: (o) => flet(K, o),
    spiralStair: (o) => spiralStair(K, o),
    lantern: () => lantern(K),
    mirror: () => mirror(K),
    boat: () => boat(K),
    argonath: () => argonath(K, rocks),
    riverRock: (seed = 1) => riverRockGeo(seed),
    riverCliff: (seed = 1) => riverCliffGeo(seed),
    goldLeaves: (seed = 1) => goldLeavesGeo(seed),
    fern: (seed = 1) => fernGeo(seed),
    fountain: () => fountain(K),
  };
}

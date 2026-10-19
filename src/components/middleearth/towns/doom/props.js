// Mordor and Mount Doom, made in code: the kit the last walkable chapter is
// built from. Orodruin itself, black with ash and cinder, its gullies running
// with fire and its plume going up red into the reek, the road sweeping up
// its western side to the door of the Sammath Naur; Barad-dûr far off, its
// Eye between the horns of its crown and the long beam of its searching; the
// plain of Gorgoroth, its boulders and fangs of rock, an orc camp, a column
// of orcs on the march, the orcs themselves and their slave-driver with his
// whip; inside the Mountain, the spur over the Crack of Doom; the lava that
// comes after, and the rock Frodo and Sam wait on; Gwaihir the Windlord;
// Gollum, at the last; and the Ring, its letters burning.
//
// Built with the Shire's kit (../../shire/props.js) as the other towns are,
// and to the same conventions: metres, +x east, +z south, y up; each
// builder's group stands on y = 0 at its origin, fronts face +z, creatures
// face +x, and fixed parts are merged one mesh per material. Things meant for
// an InstancedMesh come back as one vertex-coloured geometry. What glows is
// brighter than 1, so the bloom (threshold about 0.8) takes it.
//
// Far things (the Mountain, the Tower) take the fog only so far (uFogCap),
// so they stand out of the reek as dark shapes with fire on them.
//
// The builders are in their own files, by what they draw: helpers.js,
// canvases.js, mountain.js (Orodruin), tower.js (Barad-dûr), plain.js,
// orcs.js (and the camp), inside.js (the Sammath Naur), after.js (the lava
// field, the refuge), eagle.js and ring.js; the GLSL is alone in shaders.js,
// and this file keeps the kit. A builder that makes a shader material asks
// the kit for it (K.shaders), so no builder's file carries GLSL and a
// 'nodes' world may import them.

import * as THREE from 'three';
import { canvasTexture, hot } from '../../../../lib/three/canvasTexture';
import { normalFromField } from '../../../../lib/paint';
import { createShireKit } from '../../shire/props';
import { gollum } from '../marshes/props';
import { lavaField, refuge } from './after';
import { bannerCanvas, basaltCanvas, cinderCanvas, envCanvas, featherCanvas, flameCanvas, glowCanvas, gollumEyeCanvas, hideCanvas, lettersCanvas, noiseCanvas, puffCanvas } from './canvases';
import { eagle } from './eagle';
import { sammathNaur } from './inside';
import { mountDoom } from './mountain';
import { camp, orc, orcColumnGeo } from './orcs';
import { ashRockGeo, spikeGeo } from './plain';
import { ring } from './ring';
import { beamMaterial, bombMaterial, emberish, eyeMaterial, flameMaterial, hazeMaterial, lavaMaterial, orcMaterial, ringMaterial, smokeMaterial, sparkMaterial, underglow } from './shaders';
import { baradDur } from './tower';

// ── Gollum ── (the Marshes' builder, ../marshes/props.js, with this kit's
// materials: one Gollum for every town he's in, the fall at the last his
// own pose there)

// ── the kit ──

export function createDoomKit(renderer) {
  const kit = createShireKit(renderer);
  const S = 256;
  const T = (c, o) => canvasTexture(c, renderer, o);
  const basalt = basaltCanvas(S, 31);
  const cinder = cinderCanvas(S, 37);
  const feather = featherCanvas(S, 43);
  const tex = {
    rock: T(basalt.c),
    rockN: T(normalFromField(basalt.field, S, S, 3), { srgb: false }),
    cinder: T(cinder.c),
    cinderN: T(normalFromField(cinder.field, S, S, 2.5), { srgb: false }),
    hide: T(hideCanvas(S, 47)),
    feather: T(feather.c),
    featherN: T(normalFromField(feather.field, S, S, 2), { srgb: false }),
    glow: T(glowCanvas(64), { wrap: false }),
    flame: T(flameCanvas(), { wrap: false }),
    puff: T(puffCanvas(), { wrap: false }),
    noise: T(noiseCanvas(), { srgb: false }),
    letters: T(lettersCanvas(), { srgb: false }),
    banner: T(bannerCanvas(), { wrap: false }),
    eye: T(gollumEyeCanvas(), { wrap: false }),
  };
  const env = T(envCanvas(), { wrap: false });
  env.mapping = THREE.EquirectangularReflectionMapping;
  tex.env = env;
  // one clock and one eruption for every shader in the kit
  const U = { uTime: { value: 0 }, uErupt: { value: 0 }, uNoise: { value: tex.noise }, uPuff: { value: tex.puff } };
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const rockish = { map: tex.rock, normalMap: tex.rockN, vertexColors: true };
  const ashish = { map: tex.cinder, normalMap: tex.cinderN, vertexColors: true };
  const mats = {
    ...kit.mats,
    // the scene's: rock (boulders, fangs), ash (the plain), orc (the column)
    rock: M({ ...rockish, roughness: 0.92 }),
    ash: M({ ...ashish, roughness: 1 }),
    orc: orcMaterial(env),
    // the Mountain: its ash and its fire, its rock and road, held up out of the fog
    doom: emberish(M({ ...ashish, roughness: 0.96 }), U, { cap: 0.72, glow: { value: 1 }, key: 'doom-mountain' }),
    doomRock: emberish(M({ ...rockish, roughness: 0.9 }), U, { cap: 0.72, key: 'doom-rock' }),
    doomRoad: emberish(M({ ...ashish, roughness: 1 }), U, { cap: 0.72, key: 'doom-road' }),
    doorDark: emberish(new THREE.MeshBasicMaterial({ vertexColors: true }), U, { cap: 0.72, key: 'doom-door' }),
    doomLava: lavaMaterial(U, { ribbon: true, cap: 0.45, flow: 1.6 }),
    doomLake: lavaMaterial(U, { cap: 0.45, flow: 0.4, heat: 1.2 }),
    plume: smokeMaterial(U, { size: 125, rise: 620, spread: 200, wind: [0.55, 0, -0.2], cap: 0.6, alpha: 0.72, speed: 0.01 }),
    ventSmoke: smokeMaterial(U, { size: 30, rise: 160, spread: 30, wind: [0.6, 0, -0.1], cap: 0.6, alpha: 0.45, speed: 0.02 }),
    fountain: flameMaterial(U, { size: 26, rise: 120, rate: 0.45, cap: 0.4 }),
    bombs: bombMaterial(U, { speed: 55, cap: 0.4 }),
    // the Tower and the Eye
    tower: emberish(M({ ...rockish, roughness: 0.55, metalness: 0.35, envMap: env, envMapIntensity: 0.6, side: THREE.DoubleSide }), U, { cap: 0.62, glow: { value: 1 }, key: 'doom-tower' }),
    eye: eyeMaterial(U),
    beam: beamMaterial(U),
    beamPool: new THREE.MeshBasicMaterial({ map: tex.glow, color: hot(0xffa848, 1.2), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }),
    // the camp
    tentHide: M({ map: tex.hide, vertexColors: true, roughness: 0.92, side: THREE.DoubleSide }),
    camp: M({ vertexColors: true, roughness: 0.8 }),
    banner: M({ map: tex.banner, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }),
    lash: M({ color: 0x2a1e16, roughness: 0.6 }),
    // inside the Mountain, and after
    cavern: underglow(M({ ...rockish, roughness: 0.82 }), U, 'doom-cavern'),
    crackLava: lavaMaterial(U, { swell: 0.4, heat: 0.95, flow: 0.5 }),
    burst: flameMaterial(U, { size: 5, rise: 16, rate: 0.6 }),
    lavaField: lavaMaterial(U, { swell: 0.35, heat: 0.92, flow: 0.6 }),
    scorch: underglow(M({ ...rockish, roughness: 0.9 }), U, 'doom-scorch'),
    // Gwaihir
    eagle: M({ map: tex.feather, normalMap: tex.featherN, vertexColors: true, roughness: 0.82, side: THREE.DoubleSide }),
    eagleHorn: M({ vertexColors: true, roughness: 0.38, envMap: env, envMapIntensity: 0.5 }),
    eagleEye: M({ color: 0xd8a024, roughness: 0.08, emissive: new THREE.Color(0x4a2a00), envMap: env }),
    // the Ring
    gold: ringMaterial(env, tex.letters, U),
    // Gollum
    gollumSkin: M({ vertexColors: true, roughness: 0.42 }),
    gollumEye: M({ map: tex.eye, roughness: 0.08, emissive: new THREE.Color(0xffffff), emissiveMap: tex.eye, emissiveIntensity: 0.3 }),
    gollumHair: M({ color: 0x3a362e, roughness: 0.6 }),
    mouth: M({ color: 0x1a0d0c, roughness: 0.6 }),
    tooth: M({ color: 0xb4a472, roughness: 0.5 }),
    loin: M({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
  };
  mats.orcFlesh = mats.orc;
  mats.hide = mats.tentHide;
  mats.doomLava.polygonOffset = true;
  mats.doomLava.polygonOffsetFactor = -4;
  mats.doomLava.polygonOffsetUnits = -4;
  mats.scorch.userData.depth.value = 4;
  for (const [k, m] of Object.entries(mats)) if (!m.name) m.name = k;
  // (the builders reach the shaders through the kit: their own files carry none)
  const shaders = { haze: hazeMaterial, spark: sparkMaterial };
  const DK = { mats, tex: { ...kit.K.tex, ...tex }, U, renderer, shaders };
  // the scene shares one geometry each among its instances
  const memo = new Map();
  const once = (key, fn) => {
    if (!memo.has(key)) memo.set(key, fn());
    return memo.get(key);
  };
  return {
    ...kit,
    mats,
    tex: DK.tex,
    uniforms: U,
    tick: (t) => {
      U.uTime.value = t;
    },
    mountDoom: () => mountDoom(DK),
    baradDur: () => baradDur(DK),
    ashRock: (seed = 1) => once(`ash${seed}`, () => ashRockGeo(seed)),
    spike: (seed = 1) => once(`spike${seed}`, () => spikeGeo(seed)),
    camp: () => camp(DK),
    orcColumn: () => once('column', orcColumnGeo),
    orc: (seed = 1, o = {}) => orc(DK, seed, o),
    sammathNaur: () => sammathNaur(DK),
    lavaField: (w = 200, d = 200) => lavaField(DK, w, d),
    refuge: () => refuge(DK),
    eagle: () => eagle(DK),
    gollum: () => gollum(DK),
    ring: () => ring(DK),
  };
}

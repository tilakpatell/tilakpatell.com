// The Emyn Muil, the Dead Marshes and the Black Gate, made in code: the
// kit the Two Towers road is built from. The sheer grey cliff of the Emyn
// Muil with its spurs, the razor spires round it, and Sam's elven rope;
// Gollum himself; the marsh's tussocks, reeds and drowned snags, the
// candle-lights over the pools and the dead faces under them; a Nazgûl on
// his fell beast; and the Morannon, its iron gates between the Towers of
// the Teeth, the Easterlings marching in, ash-grey boulders on the slope,
// and the elven cloak that makes a hobbit a rock.
//
// Built with the Shire's kit (../../shire/props.js) as the other towns are:
// its helpers, and its own materials for sharp grey rock, black iron, wet
// skin, membrane and red lacquer. The same conventions: each builder's
// group stands on y = 0 at its origin, fronts face +z, creatures face +x,
// and fixed parts are merged one mesh per material. Things meant for an
// InstancedMesh come back as one vertex-coloured geometry.
//
// The builders live in their own files (helpers.js, canvases.js, cliff.js,
// gollum.js, marsh.js, beast.js, gate.js, east.js), the GLSL alone in
// shaders.js; this file keeps the kit and Gollum on his own.

import * as THREE from 'three';
import { canvasTexture, hot } from '../../../../lib/stage3d';
import { normalFromField } from '../../../../lib/paint';
import { createShireKit } from '../../shire/props';
import { fellBeast } from './beast';
import { eyeCanvas, faceCanvas, flameCanvas, glowCanvas, ironCanvas, rockCanvas, ropeCanvas } from './canvases';
import { cliff, rope, spikeGeo } from './cliff';
import { columnGeo, easterling, elvenCloak } from './east';
import { ashRockGeo, blackGate } from './gate';
import { gollum } from './gollum';
import { deadTreeGeo, face, faceGeo, reedsGeo, tussockGeo, wisp } from './marsh';
import { faceMaterial } from './shaders';

export { gollum };

// ── Gollum on his own ──
// For the towns further on, without building the rest of the kit.
export function createGollum(renderer) {
  const eye = canvasTexture(eyeCanvas(), renderer, { wrap: false });
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const mats = {
    gollumSkin: M({ vertexColors: true, roughness: 0.42 }),
    gollumEye: M({ map: eye, roughness: 0.08, emissive: new THREE.Color(0xffffff), emissiveMap: eye, emissiveIntensity: 0.3 }),
    gollumHair: M({ color: 0x3a362e, roughness: 0.6 }),
    mouth: M({ color: 0x1a0d0c, roughness: 0.6 }),
    tooth: M({ color: 0xb4a472, roughness: 0.5 }),
    loin: M({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
  };
  return gollum({ mats, tex: { eye }, renderer });
}

// ── the kit ──

export function createMarshesKit(renderer) {
  const kit = createShireKit(renderer);
  const { K } = kit;
  const S = 256;
  const T = (c, o) => canvasTexture(c, renderer, o);
  const rock = rockCanvas(S, 23);
  const iron = ironCanvas(S, 29);
  const tex = {
    rock: T(rock.c),
    rockN: T(normalFromField(rock.field, S, S, 3), { srgb: false }),
    iron: T(iron.c),
    ironN: T(normalFromField(iron.field, S, S, 3), { srgb: false }),
    glow: T(glowCanvas(), { wrap: false }),
    flame: T(flameCanvas(), { wrap: false }),
    eye: T(eyeCanvas(), { wrap: false }),
    rope: T(ropeCanvas()),
    faces: [0, 1, 2].map((k) => T(faceCanvas(k), { wrap: false })),
  };
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const mats = {
    ...kit.mats,
    // the scene's: rock (the cliff, spires, boulders), wood (the snags),
    // reeds (reeds and tussocks), easterling (the column)
    rock: M({ map: tex.rock, normalMap: tex.rockN, vertexColors: true, roughness: 0.93 }),
    wood: M({ map: K.tex.bark, normalMap: K.tex.barkN, vertexColors: true, roughness: 0.92 }),
    reeds: M({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }),
    easterling: M({ vertexColors: true, roughness: 0.42, metalness: 0.25 }),
    elvenRope: M({ map: tex.rope, color: 0xe4e8ec, roughness: 0.4, metalness: 0.2, emissive: new THREE.Color(0x2c3238) }),
    gollumSkin: M({ vertexColors: true, roughness: 0.42 }),
    gollumEye: M({ map: tex.eye, roughness: 0.08, emissive: new THREE.Color(0xffffff), emissiveMap: tex.eye, emissiveIntensity: 0.3 }),
    gollumHair: M({ color: 0x3a362e, roughness: 0.6 }),
    mouth: M({ color: 0x1a0d0c, roughness: 0.6 }),
    tooth: M({ color: 0xb4a472, roughness: 0.5 }),
    loin: M({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
    beastHide: M({ vertexColors: true, roughness: 0.55 }),
    beastHorn: M({ color: 0x4a423c, roughness: 0.45 }),
    beastEye: new THREE.MeshBasicMaterial({ color: hot(0xff7a2a, 1.6) }),
    membrane: M({ vertexColors: true, roughness: 0.72, side: THREE.DoubleSide }),
    nazgulRobe: M({ color: 0x0e0e10, roughness: 0.92, side: THREE.DoubleSide }),
    gauntlet: M({ color: 0x2a2a2e, roughness: 0.35, metalness: 0.8 }),
    saddle: M({ color: 0x1e1612, roughness: 0.7 }),
    void: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    gateStone: M({ map: tex.rock, normalMap: tex.rockN, vertexColors: true, roughness: 0.9 }),
    gateIron: M({ map: tex.iron, normalMap: tex.ironN, vertexColors: true, roughness: 0.42, metalness: 0.4 }),
    slit: new THREE.MeshBasicMaterial({ color: hot(0xff5a1a, 2.2) }),
    mountain: M({ map: tex.rock, vertexColors: true, roughness: 0.95 }),
    lacquer: M({ vertexColors: true, roughness: 0.32, metalness: 0.05, side: THREE.DoubleSide }),
    eastMetal: M({ vertexColors: true, roughness: 0.3, metalness: 0.85 }),
    cloak: M({ map: tex.rock, normalMap: tex.rockN, vertexColors: true, roughness: 0.96, side: THREE.DoubleSide }),
  };
  // (the faces reach their shader through the kit: their own file carries none)
  const MK = { mats, tex: { ...K.tex, ...tex }, renderer, faceGeo: faceGeo(), shaders: { face: faceMaterial } };
  // the scene shares one geometry each among its instances
  const memo = new Map();
  const once = (key, fn) => {
    if (!memo.has(key)) memo.set(key, fn());
    return memo.get(key);
  };
  return {
    ...kit,
    mats,
    tex: MK.tex,
    cliff: (o) => cliff(MK, o),
    spike: (seed = 1) => once(`spike${seed}`, () => spikeGeo(seed)),
    rope: () => rope(MK),
    gollum: () => gollum(MK),
    tussock: (seed = 1) => once(`tussock${seed}`, () => tussockGeo(seed)),
    reeds: (seed = 1) => once(`reeds${seed}`, () => reedsGeo(seed)),
    deadTree: (seed = 1) => once(`tree${seed}`, () => deadTreeGeo(seed)),
    wisp: () => wisp(MK),
    face: (seed = 1) => face(MK, seed),
    fellBeast: () => fellBeast(MK),
    blackGate: () => blackGate(MK),
    easterling: (seed = 1) => easterling(MK, seed),
    column: () => once('column', columnGeo),
    ashRock: (seed = 1) => once(`ash${seed}`, () => ashRockGeo(seed)),
    elvenCloak: () => elvenCloak(MK),
  };
}

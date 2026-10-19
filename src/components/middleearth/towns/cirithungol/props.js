// Cirith Ungol, made in code: the kit the chapter is built from. Minas
// Morgul across its valley, pale and glowing a dead green, its bridge of
// twisted statues and the beam that goes up from its tower; the host that
// marches out over the bridge, and the Witch-king on his fell beast; the
// endless stairs up their black cliff; Shelob's tunnels, her webs and the
// bones in them, Shelob herself, the phial of Galadriel and Frodo bound in
// silk; the courtyard of the orcs' Tower, and the orcs.
//
// Built with the Shire's kit (../../shire/props.js) as the other towns are,
// on the same conventions: metres, +x east, +z south, y up; each builder's
// group stands on y = 0 at its origin, fronts face +z, creatures face +x;
// fixed parts are merged one mesh per material, and things meant for an
// InstancedMesh come back as one vertex-coloured geometry. The creatures
// that move are skinned, every part bound whole to one bone, so each is a
// mesh or two however many joints it has.

import * as THREE from 'three';
import { canvasTexture, hot } from '../../../../lib/three/canvasTexture';
import { normalFromField } from '../../../../lib/paint';
import { createShireKit } from '../../shire/props';
import { blockCanvas, flagCanvas, flameCanvas, glowCanvas, hairCanvas, noiseCanvas, rockCanvas, starCanvas, wartCanvas, webCanvas } from './canvases';
import { court } from './court';
import { C, envFrom } from './helpers';
import { morgul } from './morgul';
import { orc, orcColumnGeo } from './orcs';
import { phial, silk } from './phial';
import { beamMaterial, ghostMaterial, hide, splashMaterial } from './shaders';
import { shelob } from './shelob';
import { rockGeo, stairs } from './stairs';
import { tunnels, webGeo } from './tunnels';
import { witchKing } from './witchking';

// ── the kit ──

export function createCirithKit(renderer) {
  const kit = createShireKit(renderer);
  const S = 256;
  const T = (c, o) => canvasTexture(c, renderer, o);
  const rock = rockCanvas(S, 23);
  const block = blockCanvas(S, 31);
  const flag = flagCanvas(S, 37);
  const hair = hairCanvas(256);
  const wart = wartCanvas(256);
  const tex = {
    rock: T(rock.c),
    rockN: T(normalFromField(rock.field, S, S, 3), { srgb: false }),
    block: T(block.c),
    blockN: T(normalFromField(block.field, S, S, 2.5), { srgb: false }),
    flags: T(flag.c),
    flagsN: T(normalFromField(flag.field, S, S, 2.5), { srgb: false }),
    glow: T(glowCanvas(), { wrap: false }),
    star: T(starCanvas(), { wrap: false }),
    flame: T(flameCanvas(), { wrap: false }),
    web: T(webCanvas(), { wrap: false }),
    noise: T(noiseCanvas(), { srgb: false }),
    hair: T(hair.c, { srgb: false }),
    hairN: T(normalFromField(hair.field, 256, 256, 3), { srgb: false }),
    wart: T(wart.c, { srgb: false }),
    wartN: T(normalFromField(wart.field, 256, 256, 5), { srgb: false }),
  };
  // what glossy things see: the lair's dark with a cold light in it; the
  // vale's, lit green by the city
  const lair = envFrom(renderer, [0.004, 0.004, 0.006], [0.016, 0.018, 0.024], [
    [0xdfe8ff, 1.8, 3, 3, [2, 9, 5]],
    [0x9aa8c0, 0.5, 10, 2, [-8, 2, -4]],
  ]);
  const vale = envFrom(renderer, [0.005, 0.008, 0.006], [0.02, 0.04, 0.03], [
    [0x7aff9a, 1.6, 8, 4, [0, 4, -9]],
    [0x2a4a3a, 0.6, 16, 4, [-8, 9, 4]],
  ]);
  const U = { uTime: { value: 0 }, uNoise: { value: tex.noise } };
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const mats = {
    ...kit.mats,
    // the scene's: rock (cliff, stairs, tunnels, boulders), web (the web
    // sheets), orc (the marching column, the dead)
    rock: M({ map: tex.rock, normalMap: tex.rockN, vertexColors: true, roughness: 0.88 }),
    web: M({ map: tex.web, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.6, color: 0xb8bab6, emissive: C(0x0a0b0c) }),
    orc: M({ vertexColors: true, roughness: 0.55, metalness: 0.3, envMap: lair, envMapIntensity: 0.6 }),
    orcSkin: hide(M({ vertexColors: true, roughness: 0.6 }), { tex: tex.wart, nrm: tex.wartN, scale: 3.2, bump: 0.8, shade: 0.4, key: 'cirith-orc' }),
    orcGear: M({ vertexColors: true, roughness: 0.45, metalness: 0.55, envMap: lair, envMapIntensity: 0.9 }),
    // Shelob: glossy black-brown, hairy; a faint rim so she reads against
    // the dark; eyes like wet beads; her fangs and sting like horn
    shelob: hide(M({ vertexColors: true, roughness: 0.36, metalness: 0.05, envMap: lair, envMapIntensity: 1.1 }), {
      tex: tex.hair,
      nrm: tex.hairN,
      scale: 1.7,
      bump: 1.2,
      shade: 0.5,
      key: 'cirith-shelob',
      extra: `{
        float rimK = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
        totalEmissiveRadiance += vec3(0.05, 0.055, 0.065) * rimK * (0.4 + hs.g);
      }`,
    }),
    shelobEye: M({ color: 0x050303, roughness: 0.03, metalness: 0.6, envMap: lair, envMapIntensity: 3, emissive: hot(0x8a9a58, 0.16) }),
    fang: M({ color: 0x2e1e12, roughness: 0.18, metalness: 0.1, envMap: lair, envMapIntensity: 1.8 }),
    silk: M({ vertexColors: true, roughness: 0.72, emissive: C(0x121210) }),
    bone: M({ vertexColors: true, roughness: 0.72 }),
    // Minas Morgul's
    statue: M({ vertexColors: true, roughness: 0.6, emissive: C(0x9ad0aa), emissiveIntensity: 0.35 }),
    morgulWater: M({ color: 0x020504, roughness: 0.22, metalness: 0.7, envMap: vale, envMapIntensity: 0.45, emissive: C(0x010402) }),
    // the fell beast and the Witch-king
    beastHide: M({ vertexColors: true, roughness: 0.55 }),
    beastHorn: M({ color: 0x4a423c, roughness: 0.45 }),
    beastEye: new THREE.MeshBasicMaterial({ color: hot(0xff7a2a, 1.6) }),
    membrane: M({ vertexColors: true, roughness: 0.72, side: THREE.DoubleSide }),
    nazgulRobe: M({ color: 0x0e0e10, roughness: 0.92, side: THREE.DoubleSide }),
    gauntlet: M({ color: 0x2a2a2e, roughness: 0.35, metalness: 0.8, envMap: vale, envMapIntensity: 1 }),
    crownHelm: M({ color: 0x3a3a3e, roughness: 0.3, metalness: 0.85, envMap: vale, envMapIntensity: 1.4, side: THREE.DoubleSide }),
    wraithEye: new THREE.MeshBasicMaterial({ color: hot(0xd8e6ff, 2.4) }),
    saddle: M({ color: 0x1e1612, roughness: 0.7 }),
    mouth: M({ color: 0x1a0d0c, roughness: 0.6 }),
    void: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    // the Tower's
    blackStone: M({ map: tex.block, normalMap: tex.blockN, vertexColors: true, roughness: 0.82 }),
    flags: M({ map: tex.flags, normalMap: tex.flagsN, color: 0x5e5650, roughness: 0.75 }),
    slit: new THREE.MeshBasicMaterial({ color: hot(0xff4410, 1.7) }),
  };
  for (const [k, m] of Object.entries(mats)) if (!m.name) m.name = k;
  // (the builders reach the shaders through the kit: their own files carry none)
  const shaders = { ghost: ghostMaterial, beam: beamMaterial, splash: splashMaterial };
  const MK = { mats, tex: { ...kit.K.tex, ...tex }, U, renderer, shaders };
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
    uniforms: U,
    tick: (t) => {
      U.uTime.value = t;
    },
    morgul: () => morgul(MK),
    orcColumn: () => once('column', orcColumnGeo),
    host: () => once('column', orcColumnGeo),
    witchKing: () => witchKing(MK),
    stairs: (o) => stairs(MK, o),
    tunnels: (list, o) => tunnels(MK, list, o),
    shelob: () => shelob(MK),
    phial: () => phial(MK),
    silk: () => silk(MK),
    court: (o) => court(MK, o),
    orc: (seed = 1, o) => orc(MK, seed, o),
    rock: (seed = 1) => once(`rock${seed}`, () => rockGeo(seed)),
    web: (seed = 1) => once(`web${seed}`, () => webGeo(seed)),
  };
}

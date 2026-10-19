// Amon Hen, made in code: the kit the seventh walkable town is built from.
// The Seat of Seeing on its round paved platform on the summit, the ruined
// stair up the hill, and the great stone kings of old fallen among the
// trees; broken columns, mossy boulders, ferns, tall pines and old beeches,
// fallen sticks and leaves; the camp on the lawn of Parth Galen, and the
// elven boats drawn up by the lake; the Uruk-hai and Lurtz, and the Horn of
// Gondor; and far off, the falls of Rauros, and the Eye on its tower.
//
// Built with the Shire's kit (../../shire/props.js) as the other towns are:
// its helpers, and its own materials for pale weathered stone gone green
// with moss, the forest, black iron, painted faces, water and fire. The
// same conventions: each builder's group stands on y = 0 at its origin,
// fronts face +z, figures, statues and boats face +x, and fixed parts are
// merged one mesh per material.


import * as THREE from 'three';
import { canvasTexture } from '../../../../lib/three/canvasTexture';
import { normalFromField } from '../../../../lib/paint';
import { createShireKit } from '../../shire/props';
import { boat, camp } from './camp';
import { grainCanvas, mossCanvas, puffCanvas, warpaintCanvas, weatheredCanvas, woolCanvas } from './canvases';
import { eye } from './eye';
import { beechGeo, fernGeo, mossRockGeo, pillarGeo, pineGeo, stickGeo } from './forest';
import { envCanvas } from './helpers';
import { king } from './kings';
import { rauros } from './rauros';
import { ruinStair, seat } from './seat';
import { eyeMaterial, fallsMaterial, foamMaterial, mistMaterial, urukMaterial } from './shaders';
import { fallenLeavesGeo } from './stone';
import { horn, uruk } from './uruks';

// ── the kit ──

export function createAmonHenKit(renderer) {
  const kit = createShireKit(renderer);
  const { K, mats } = kit;
  const S = 256;
  const T = (c, o) => canvasTexture(c, renderer, o);
  const stone = weatheredCanvas(S, 7);
  const moss = mossCanvas(S, 9);
  const wool = woolCanvas(S, 13);
  const grain = grainCanvas(S, 15);
  const tex = {
    stone: T(stone.c),
    stoneN: T(normalFromField(stone.field, S, S, 3), { srgb: false }),
    moss: T(moss.c),
    mossN: T(normalFromField(moss.field, S, S, 3), { srgb: false }),
    wool: T(wool.c, { repeat: [3, 3] }),
    woolN: T(normalFromField(wool.field, S, S, 2.4), { srgb: false, repeat: [3, 3] }),
    grain: T(grain.c),
    grainN: T(normalFromField(grain.field, S, S, 1.2), { srgb: false }),
    puff: T(puffCanvas(), { wrap: false }),
  };
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  Object.assign(mats, {
    // pale old stone, its colour in its vertices; rock; carved statues
    ruin: M({ map: tex.stone, normalMap: tex.stoneN, vertexColors: true, roughness: 0.93 }),
    rock: M({ map: tex.stone, normalMap: tex.stoneN, vertexColors: true, roughness: 0.96 }),
    statue: M({ map: tex.stone, normalMap: tex.stoneN, normalScale: new THREE.Vector2(1.3, 1.3), vertexColors: true, roughness: 0.92 }),
    moss: M({ map: tex.moss, normalMap: tex.mossN, vertexColors: true, roughness: 1 }),
    grass: M({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }),
    leaves: M({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }),
    // the forest, for instancing: trees, ferns
    tree: M({ vertexColors: true, roughness: 0.9 }),
    fern: M({ vertexColors: true, roughness: 0.8 }),
    earth: M({ vertexColors: true, roughness: 1 }),
  });
  // the light of the woods, for metal and polished wood to catch
  const env = T(envCanvas(), { wrap: false });
  env.mapping = THREE.EquirectangularReflectionMapping;
  tex.env = env;
  tex.warpaint = T(warpaintCanvas(), { wrap: false });
  // the falls' water, foam and mist keep one clock; so does the Eye
  const fall = { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 } };
  const glare = { uTime: { value: 0 }, uK: { value: 0.5 } };
  Object.assign(mats, {
    // what the scene instances and lays about: stone in its own colours
    // (boulders, broken columns), wood in its own (sticks, kindling)
    stone: mats.rock,
    wood: M({ vertexColors: true, roughness: 0.9 }),
    // the camp's blankets and packs: wool, dyed in their vertices
    blanket: M({ map: tex.wool, normalMap: tex.woolN, vertexColors: true, roughness: 1 }),
    // the elven boats, grey-white and fine-grained, and their silver
    boat: M({ map: tex.grain, normalMap: tex.grainN, color: 0xd2d7dc, roughness: 0.42, envMap: env, envMapIntensity: 0.35 }),
    silver: M({ color: 0xe8ecf2, metalness: 0.92, roughness: 0.22, envMap: env }),
    horn: M({ vertexColors: true, roughness: 0.36, envMap: env, envMapIntensity: 0.45 }),
    // the Uruk-hai: skin, hair, leather, black iron and the White Hand
    uruk: urukMaterial(tex.warpaint, env),
    // Rauros
    falls: fallsMaterial(fall),
    foam: foamMaterial(fall),
    mist: mistMaterial({ ...fall, uPuff: { value: tex.puff } }),
    // the Eye and its tower, far off, unfogged
    tower: new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }),
    eye: eyeMaterial(glare),
  });
  for (const [k, m] of Object.entries(mats)) if (!m.name) m.name = k;
  K.tex = { ...K.tex, ...tex };

  return {
    ...kit,
    mats,
    K,
    seat: () => seat(K),
    ruinStair: (o) => ruinStair(K, o),
    king: (o) => king(K, o),
    pillar: (seed = 1) => pillarGeo(seed),
    pine: (seed = 1) => pineGeo(seed),
    beech: (seed = 1) => beechGeo(seed),
    fern: (seed = 1) => fernGeo(seed),
    mossRock: (seed = 1) => mossRockGeo(seed),
    stick: (seed = 1) => stickGeo(seed),
    fallenLeaves: (seed = 1, o) => fallenLeavesGeo(seed, o),
    camp: () => camp(K),
    boat: () => boat(K),
    uruk: (seed = 1, o = {}) => uruk(K, seed, o),
    horn: () => horn(K),
    rauros: () => rauros(K),
    eye: () => eye(K),
  };
}

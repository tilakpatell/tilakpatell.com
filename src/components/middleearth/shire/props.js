// The Shire, made in code: the kit the walkable Hobbiton is built from.
// Hobbit holes in their grassy mounds and Bag End on the Hill, the mill and
// Maggot's barn, the Green Dragon, the double-arched bridge over the Water,
// the Party Tree and its pavilion, Gandalf's cart of fireworks, sheep, farm
// dogs and a Black Rider, the old tree whose roots hid the hobbits, and the
// small things a lane is dressed with: fences, hedges, crops, flowers,
// washing, a signpost.
//
// All of it at the toy figures' scale (../mapFigures.js: a hobbit is about
// 1.55 tall, Gandalf 2.6) and in their storybook colours. createShireKit
// paints a few small textures once and shares its materials between every
// builder. Each builder's group stands on y = 0 at its origin; buildings
// have their doors to +z, creatures (and the Rider) face +x. A building's
// fixed parts are merged into one mesh per material, so it is a dozen draw
// calls, not hundreds.
//
// The builders themselves are in ./build.js (free of GLSL, for the Road);
// this file makes the kit they are given, and re-exports the helpers.

import * as THREE from 'three';
import { canvasTexture, hot } from '../../../lib/three/stage3dNodes';
import { clamp01, mix, normalFromField } from '../../../lib/paint';
import { stoneTextures } from '../nodes/kit';
import { parts, mergeAll, heightOf, grassCanvas, thatchCanvas, planksCanvas, plasterCanvas, leavesCanvas, barkCanvas, slateCanvas, benchParts, barrelParts, lampParts, mailboxParts, hole, bagEnd, mill, barn, greenDragon, bridge, partyTree, oaks, rootTree, pavilion, cart, sheep, dog, blackRider, scarecrowParts, beehiveParts, wheelbarrowParts, hayBaleParts, mushroomParts, fencePostGeo, fenceRailGeo, hedgeGeo, cabbageGeo, pumpkinGeo, wheatGeo, flowerGeo, signpost, washingLine } from './build';
import { flowerTint } from '../nodes/shire/propsShaders';

export function createShireKit(renderer) {
  const S = 256;
  const T = (c, o) => canvasTexture(c, renderer, o);
  const thatch = thatchCanvas(S);
  const planks = planksCanvas(S);
  const leaves = leavesCanvas(S);
  const bark = barkCanvas(S);
  const slate = slateCanvas(S);
  const tex = {
    grass: T(grassCanvas(S)),
    thatch: T(thatch.c),
    thatchN: T(normalFromField(thatch.field, S, S, 2.5), { srgb: false }),
    planks: T(planks),
    planksN: T(normalFromField(heightOf(planks), S, S, 1.6), { srgb: false }),
    plaster: T(plasterCanvas(S)),
    leaves: T(leaves),
    leavesN: T(normalFromField(heightOf(leaves), S, S, 2), { srgb: false }),
    bark: T(bark),
    barkN: T(normalFromField(heightOf(bark), S, S, 3), { srgb: false }),
    slate: T(slate.c),
    slateN: T(normalFromField(slate.field, S, S, 2), { srgb: false }),
  };
  const field = stoneTextures(renderer, { seed: 12, dark: [70, 62, 54], light: [196, 182, 160], relief: 3 });
  const coursed = stoneTextures(renderer, { seed: 14, courses: 8, dark: [140, 128, 112], light: [222, 212, 192], joint: 0.36, relief: 2.5 });
  const brick = stoneTextures(renderer, { seed: 16, courses: 10, dark: [84, 42, 30], light: [190, 108, 76], joint: 0.4, relief: 2 });
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const mats = {
    turf: M({ map: tex.grass, vertexColors: true, roughness: 0.95 }),
    stone: M({ map: field.map, normalMap: field.normalMap, roughness: 0.92 }),
    ashlar: M({ map: coursed.map, normalMap: coursed.normalMap, color: 0xe2d8c6, roughness: 0.9 }),
    dressed: M({ map: coursed.map, normalMap: coursed.normalMap, color: 0xfff9f0, roughness: 0.85 }),
    brick: M({ map: brick.map, normalMap: brick.normalMap, roughness: 0.9 }),
    clay: M({ color: 0xb4583a, roughness: 0.8 }),
    ridge: M({ color: 0x5e4c46, roughness: 0.7 }),
    plaster: M({ map: tex.plaster, color: 0xf4e6c6, roughness: 0.95 }),
    timber: M({ map: tex.planks, normalMap: tex.planksN, color: 0x5e4029, roughness: 0.85 }),
    wood: M({ map: tex.planks, normalMap: tex.planksN, color: 0xa47c52, roughness: 0.85 }),
    barnwood: M({ map: tex.planks, normalMap: tex.planksN, color: 0x8a6a4c, roughness: 0.9 }),
    fence: M({ map: tex.planks, normalMap: tex.planksN, color: 0x9a8670, roughness: 0.9 }),
    thatch: M({ map: tex.thatch, normalMap: tex.thatchN, roughness: 0.95 }),
    slate: M({ map: tex.slate, normalMap: tex.slateN, roughness: 0.78 }),
    brass: M({ color: 0xd9a845, metalness: 0.85, roughness: 0.3 }),
    iron: M({ color: 0x2e2b28, roughness: 0.6 }),
    window: M({ color: 0x2c4656, roughness: 0.15, emissive: hot(0xffa040, 2.6), emissiveIntensity: 0 }),
    inside: M({ color: 0x1e140c, roughness: 1, emissive: hot(0xff9a48, 1.4), emissiveIntensity: 0.1 }),
    lantern: M({ color: 0xf2c27a, roughness: 0.6, emissive: hot(0xff9438, 3.2), emissiveIntensity: 0.05 }),
    foliage: M({ map: tex.leaves, normalMap: tex.leavesN, vertexColors: true, roughness: 0.9 }),
    trunk: M({ map: tex.bark, normalMap: tex.barkN, color: 0xa88c70, roughness: 0.95 }),
    canvas: M({ map: tex.plaster, color: 0xfbf7ee, roughness: 0.9, side: THREE.DoubleSide }),
    cloth: M({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }),
    paper: M({ vertexColors: true, roughness: 0.75 }),
    rope: M({ color: 0xbfa77e, roughness: 1 }),
    sack: M({ map: tex.plaster, color: 0xcbb68a, roughness: 1 }),
    wool: M({ map: tex.leaves, color: 0xf6efe2, roughness: 1 }),
    beast: M({ vertexColors: true, roughness: 0.8 }),
    hide: M({ color: 0x1a1a1f, roughness: 0.45 }),
    robe: M({ color: 0x18181d, roughness: 0.85, side: THREE.DoubleSide }),
    void: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    steel: M({ color: 0x3c3f45, roughness: 0.4 }),
    pewter: M({ color: 0xa3a39a, roughness: 0.45 }),
    food: M({ vertexColors: true, roughness: 0.7 }),
    mushroom: M({ vertexColors: true, roughness: 0.7 }),
    cabbage: M({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }),
    pumpkin: M({ vertexColors: true, roughness: 0.6 }),
    wheat: M({ vertexColors: true, roughness: 0.9 }),
    flower: M({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }),
  };
  mats.crown = mats.foliage;
  mats.hedge = mats.foliage;
  // the flowers' heads take an instance's colour, their stems don't: the
  // geometry's `tint` (1 on the petals) says how much
  mats.flower.userData.tint = true;
  flowerTint(mats.flower);
  const paints = new Map();
  const paint = (hex) => {
    if (!paints.has(hex)) paints.set(hex, M({ map: tex.planks, normalMap: tex.planksN, color: hex, roughness: 0.75 }));
    return paints.get(hex);
  };
  const K = { mats, tex, paint, renderer };

  // Night: windows, lanterns and doorways glow (above 1, so bloom finds them).
  const setNight = (k) => {
    const t = clamp01(k);
    mats.window.emissiveIntensity = mix(0, 1, t);
    mats.lantern.emissiveIntensity = mix(0.05, 1, t);
    mats.inside.emissiveIntensity = mix(0.1, 1, t);
  };

  const crops = { cabbage: cabbageGeo(), pumpkin: pumpkinGeo(), wheat: wheatGeo() };
  // a small prop from a parts function: { group, ...whatever it returns }
  const prop = (name, fn) => {
    const group = new THREE.Group();
    group.name = name;
    const bk = parts();
    const extra = fn(bk) || {};
    bk.build(group);
    return { group, ...extra };
  };

  return {
    mats,
    paint,
    setNight,
    K,
    hobbitHole: ({ door = 0x2e6b3a, radius = 4, seed = 1, windows } = {}) => hole(K, { R: radius, door, seed, windows }),
    bagEnd: () => bagEnd(K),
    mill: () => mill(K),
    barn: () => barn(K),
    greenDragon: () => greenDragon(K),
    bridge: (o) => bridge(K, o),
    partyTree: () => partyTree(K),
    oaks: () => oaks(),
    rootTree: () => rootTree(K),
    pavilion: () => pavilion(K),
    cart: () => cart(K),
    sheep: (o) => sheep(K, o),
    dog: (o) => dog(K, o),
    blackRider: () => blackRider(K),
    scarecrow: () => prop('scarecrow', (bk) => scarecrowParts(bk, K)),
    beehive: () => prop('beehive', (bk) => beehiveParts(bk, K)),
    wheelbarrow: () => prop('wheelbarrow', (bk) => wheelbarrowParts(bk, K, crops)),
    barrel: () => prop('barrel', (bk) => barrelParts(bk, K)),
    hayBale: () => prop('hayBale', (bk) => hayBaleParts(bk, K)),
    mailbox: () => prop('mailbox', (bk) => mailboxParts(bk, K)),
    bench: () => prop('bench', (bk) => ({ seatHeight: benchParts(bk, K) })),
    lampPost: () => prop('lampPost', (bk) => ({ light: lampParts(bk, K) })),
    mushroom: () => prop('mushroom', (bk) => mushroomParts(bk, K)),
    signpost: (lines) => signpost(K, lines),
    washingLine: (len) => washingLine(K, len),
    fencePost: fencePostGeo(),
    fenceRail: mergeAll([fenceRailGeo()]),
    fenceRails: mergeAll([fenceRailGeo(0.45, 1), fenceRailGeo(0.85, 2)]),
    hedge: () => hedgeGeo(),
    crops,
    flower: flowerGeo(),
  };
}

// The helpers the other walkable towns (../towns) build their own houses with.
export { parts, tf, B, cyl, ball, cylX, cylZ, lathe, tube, blob, roundBox, sector, roofGeo, gableGeo, underRidge, beam, squareWindow, timberWall, plankDoor, roundWindow, lanternParts, barrelParts, benchParts, lampParts, bush, boxUV, fillColor, mergeAll, rng } from './build';

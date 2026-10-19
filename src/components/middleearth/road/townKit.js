// The towns’ kit, made for the Road: the materials the Shire’s and the
// towns’ builders read (shire/build.js, towns/*/build.js: each takes a kit
// K = { mats, tex, paint(hex), renderer }), under the same names and from
// the same painted canvases as the Shire’s kit (shire/props.js’s
// createShireKit), but on the Road’s house look: node materials, with the
// Ring vision’s drain on every one. So a Bree house, Amon Sûl’s ruin or a
// pavilion of Rivendell on the Road is the one its chapter is walked in.
// The Shire’s kit itself has a shader hook (its flowers’ tint) and its
// stone comes through a file with more, so the Road makes its own.
//
//   createTownKit(road, renderer, { wild }) → { K, mats, setNight(k), dispose() }
//     road: hooks.js’s house (road.material(opts) → a Lambert in the look)
//     setNight(k): windows, doorways and lanterns lit, 0…1
//     wild: Weathertop’s materials too (towns/weathertop/build.js and
//       trollshaws.js read them: the ruin’s weathered stone, the rocks, the
//       trolls, the camp’s blankets and embers, the athelas, the dead wood),
//       as that chapter’s kit adds them, its shader hooks (the embers dimmed
//       by their colours, hair lit from either side) left out

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { canvasTexture, hot } from '../../../lib/three/canvasTexture';
import { normalFromField } from '../../../lib/paint';
import { barkCanvas, grassCanvas, heightOf, leavesCanvas, planksCanvas, plasterCanvas, slateCanvas, thatchCanvas } from '../shire/build';
import { stoneTextures } from '../stoneTextures';
import { haloCanvas, weatheredCanvas, woolCanvas } from '../towns/weathertop/build';

const S = 256; // the painted canvases’ size, the Shire kit’s

// (a Lambert has no roughness or metalness: the kit’s values for a standard
// material are dropped, its colour, maps and glow kept)
const LAMBERT = new Set(['color', 'map', 'normalMap', 'normalScale', 'vertexColors', 'side', 'emissive', 'emissiveIntensity', 'transparent', 'opacity', 'depthWrite', 'polygonOffset', 'polygonOffsetFactor']);
const lambert = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => LAMBERT.has(k)));

export function createTownKit(road, renderer, { wild = false } = {}) {
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
  const made = [];
  const M = (o) => {
    const m = road.material(lambert(o));
    made.push(m);
    return m;
  };
  const mats = {
    turf: M({ map: tex.grass, vertexColors: true }),
    stone: M({ map: field.map, normalMap: field.normalMap }),
    ashlar: M({ map: coursed.map, normalMap: coursed.normalMap, color: 0xe2d8c6 }),
    dressed: M({ map: coursed.map, normalMap: coursed.normalMap, color: 0xfff9f0 }),
    brick: M({ map: brick.map, normalMap: brick.normalMap }),
    clay: M({ color: 0xb4583a }),
    ridge: M({ color: 0x5e4c46 }),
    plaster: M({ map: tex.plaster, color: 0xf4e6c6 }),
    timber: M({ map: tex.planks, normalMap: tex.planksN, color: 0x5e4029 }),
    wood: M({ map: tex.planks, normalMap: tex.planksN, color: 0xa47c52 }),
    barnwood: M({ map: tex.planks, normalMap: tex.planksN, color: 0x8a6a4c }),
    fence: M({ map: tex.planks, normalMap: tex.planksN, color: 0x9a8670 }),
    thatch: M({ map: tex.thatch, normalMap: tex.thatchN }),
    slate: M({ map: tex.slate, normalMap: tex.slateN }),
    brass: M({ color: 0xd9a845 }),
    iron: M({ color: 0x2e2b28 }),
    window: M({ color: 0x2c4656, emissive: hot(0xffa040, 2.6), emissiveIntensity: 0 }),
    inside: M({ color: 0x1e140c, emissive: hot(0xff9a48, 1.4), emissiveIntensity: 0.1 }),
    lantern: M({ color: 0xf2c27a, emissive: hot(0xff9438, 3.2), emissiveIntensity: 0.05 }),
    foliage: M({ map: tex.leaves, normalMap: tex.leavesN, vertexColors: true }),
    trunk: M({ map: tex.bark, normalMap: tex.barkN, color: 0xa88c70 }),
    canvas: M({ map: tex.plaster, color: 0xfbf7ee, side: THREE.DoubleSide }),
    cloth: M({ vertexColors: true, side: THREE.DoubleSide }),
    paper: M({ vertexColors: true }),
    rope: M({ color: 0xbfa77e }),
    sack: M({ map: tex.plaster, color: 0xcbb68a }),
    wool: M({ map: tex.leaves, color: 0xf6efe2 }),
    beast: M({ vertexColors: true }),
    hide: M({ color: 0x1a1a1f }),
    robe: M({ color: 0x18181d, side: THREE.DoubleSide }),
    void: new MeshBasicNodeMaterial({ color: 0x000000 }),
    steel: M({ color: 0x3c3f45 }),
    pewter: M({ color: 0xa3a39a }),
    food: M({ vertexColors: true }),
    mushroom: M({ vertexColors: true }),
    cabbage: M({ vertexColors: true, side: THREE.DoubleSide }),
    pumpkin: M({ vertexColors: true }),
    wheat: M({ vertexColors: true }),
    // (the Shire’s flowers take an instance’s colour on their heads by a
    // shader hook; here a flower is its geometry’s own colours)
    flower: M({ vertexColors: true, side: THREE.DoubleSide }),
  };
  made.push(mats.void);
  mats.crown = mats.foliage;
  mats.hedge = mats.foliage;
  const paints = new Map();
  const paint = (hex) => {
    if (!paints.has(hex)) paints.set(hex, M({ map: tex.planks, normalMap: tex.planksN, color: hex }));
    return paints.get(hex);
  };
  if (wild) {
    const stone = weatheredCanvas(S, 7);
    const wool = woolCanvas(S, 13);
    Object.assign(tex, {
      stone: T(stone.c),
      stoneN: T(normalFromField(stone.field, S, S, 3), { srgb: false }),
      wool: T(wool.c, { repeat: [3, 3] }),
      woolN: T(normalFromField(wool.field, S, S, 2.4), { srgb: false, repeat: [3, 3] }),
      halo: T(haloCanvas(), { wrap: false }),
    });
    Object.assign(mats, {
      ruin: M({ map: tex.stone, normalMap: tex.stoneN, vertexColors: true }),
      rock: M({ map: tex.stone, normalMap: tex.stoneN, vertexColors: true }),
      troll: M({ map: tex.stone, normalMap: tex.stoneN, normalScale: new THREE.Vector2(1.4, 1.4), vertexColors: true }),
      earth: M({ vertexColors: true }),
      scorch: M({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      grass: M({ vertexColors: true, side: THREE.DoubleSide }),
      ember: M({ color: 0x140804, emissive: new THREE.Color(0xff5a1c), emissiveIntensity: 1.6, vertexColors: true }),
      char: M({ vertexColors: true }),
      blanket: M({ map: tex.wool, normalMap: tex.woolN, vertexColors: true, side: THREE.DoubleSide }),
      copper: M({ color: 0xa8643a }),
      leaf: M({ vertexColors: true, side: THREE.DoubleSide, emissive: new THREE.Color(0) }),
      petal: M({ vertexColors: true, side: THREE.DoubleSide, emissive: new THREE.Color(0) }),
      deadwood: M({ map: tex.bark, normalMap: tex.barkN, color: 0x8e8a84 }),
      pinebark: M({ map: tex.bark, normalMap: tex.barkN, color: 0x6a5446 }),
      tree: M({ vertexColors: true }),
      pitch: M({ color: 0x0b0907 }),
      brand: M({ color: 0x100604, emissive: new THREE.Color(0xff7a2a), emissiveIntensity: 2.2 }),
      coat: M({ vertexColors: true }),
      silverHair: M({ vertexColors: true, side: THREE.DoubleSide }),
      silver: M({ color: 0xdde2ea }),
      eye: M({ color: 0x0c0a0a }),
      skin: M({ color: 0xf0ddd2 }),
      hair: M({ vertexColors: true, side: THREE.DoubleSide }),
      riding: M({ map: tex.wool, normalMap: tex.woolN, color: 0x4a5670, side: THREE.DoubleSide }),
      dress: M({ color: 0x2e3546 }),
      leather: M({ color: 0x2a1f18 }),
      gold: M({ color: 0xd8a840, emissive: hot(0xffc040, 0.6) }),
    });
  }
  const K = { mats, tex, paint, renderer };
  const lerp = (a, b, t) => a + (b - a) * t;
  return {
    K,
    mats,
    // night: the windows, the doorways and the lanterns lit (over 1, so the bloom finds them)
    setNight(k) {
      const t = Math.min(1, Math.max(0, k));
      mats.window.emissiveIntensity = lerp(0, 1, t);
      mats.lantern.emissiveIntensity = lerp(0.05, 1, t);
      mats.inside.emissiveIntensity = lerp(0.1, 1, t);
    },
    dispose() {
      for (const m of made) m.dispose();
      for (const t of Object.values(tex)) t.dispose();
      for (const s of [field, coursed, brick]) {
        s.map.dispose();
        s.normalMap.dispose();
      }
    },
  };
}

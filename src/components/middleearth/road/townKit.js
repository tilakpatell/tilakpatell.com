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
//   createTownKit(road, renderer, { wild, elven }) → { K, mats, setNight(k), dispose() }
//     road: hooks.js’s house (road.material(opts) → a Lambert in the look)
//     setNight(k): windows, doorways and lanterns lit, 0…1
//     wild: Weathertop’s materials too (towns/weathertop/build.js and
//       trollshaws.js read them: the ruin’s weathered stone, the rocks, the
//       trolls, the camp’s blankets and embers, the athelas, the dead wood),
//       as that chapter’s kit adds them, its shader hooks (the embers dimmed
//       by their colours, hair lit from either side) left out
//     elven: Rivendell’s too (towns/rivendell/build.js reads them: the pale
//       carved stone, the gilt, the leaf roofs, the tracery, the glass, the
//       linen and the moss), as createRivendellKit adds them; no sky in the
//       metal, a Lambert having none to show

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { canvasTexture, hot } from '../../../lib/three/canvasTexture';
import { normalFromField } from '../../../lib/paint';
import { barkCanvas, grassCanvas, heightOf, leavesCanvas, planksCanvas, plasterCanvas, slateCanvas, thatchCanvas } from '../shire/build';
import { stoneTextures } from '../stoneTextures';
import { haloCanvas, weatheredCanvas, woolCanvas } from '../towns/weathertop/build';
import { archFillCanvas, carvingCanvas, courtCanvas, elfstoneCanvas, glassCanvas, linenCanvas, puffCanvas, roofCanvas, traceryCanvas } from '../towns/rivendell/canvases';
import { dress } from '../../../lib/three/coreNodes';
import { SHIRE_CORE } from '../shire/dress';

// (the wild’s and Rivendell’s stone and wood wear the same scans: the ruin’s
// and the crags’ rough rock, the trees’ bark, the elves’ pale dressed stone and wood)
const WILD_CORE = { ruin: 'rock', rock: 'rock', deadwood: 'bark', pinebark: 'bark' };
const ELVEN_CORE = { elfstone: 'stone', pave: 'stone', court: 'stone', elfwood: 'wood' };

const S = 256; // the painted canvases’ size, the Shire kit’s

// (a Lambert has no roughness or metalness: the kit’s values for a standard
// material are dropped, its colour, maps and glow kept)
const LAMBERT = new Set(['color', 'map', 'alphaTest', 'normalMap', 'normalScale', 'vertexColors', 'side', 'emissive', 'emissiveIntensity', 'transparent', 'opacity', 'depthWrite', 'polygonOffset', 'polygonOffsetFactor']);
const lambert = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => LAMBERT.has(k)));

export function createTownKit(road, renderer, { wild = false, elven = false } = {}) {
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
      // (the Lone-lands’ stone warm grey, not the cold purple its vertices turn at dusk)
      rock: M({ map: tex.stone, normalMap: tex.stoneN, vertexColors: true, color: 0xd2bea0 }),
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
  const pave = elven ? stoneTextures(renderer, { seed: 44, courses: 4, dark: [170, 156, 134], light: [246, 238, 220], joint: 0.3, relief: 2 }) : null;
  if (elven) {
    const stone = elfstoneCanvas(S, 3, { rows: 2, across: 1 });
    const fine = elfstoneCanvas(S, 8, { rows: 1, across: 1, joint: 0 });
    const carving = carvingCanvas();
    const roof = roofCanvas(S);
    const linen = linenCanvas(128);
    Object.assign(tex, {
      elfstone: T(stone.c),
      elfstoneN: T(normalFromField(stone.field, S, S, 2), { srgb: false }),
      fine: T(fine.c),
      fineN: T(normalFromField(fine.field, S, S, 1.5), { srgb: false }),
      carving: T(carving.c),
      carvingN: T(normalFromField(carving.field, carving.W, carving.H, 6), { srgb: false }),
      roof: T(roof.c),
      roofN: T(normalFromField(roof.field, S, S, 3), { srgb: false }),
      linen: T(linen.c, { repeat: [2, 2] }),
      linenN: T(normalFromField(linen.field, 128, 128, 1.5), { srgb: false, repeat: [2, 2] }),
      tracery: T(traceryCanvas()),
      archFill: T(archFillCanvas(), { wrap: false }),
      glass: T(glassCanvas(), { wrap: false }),
      court: T(courtCanvas(), { wrap: false }),
      puff: T(puffCanvas(), { wrap: false }),
    });
    const traced = { alphaTest: 0.5, side: THREE.DoubleSide };
    Object.assign(mats, {
      elfstone: M({ map: tex.elfstone, normalMap: tex.elfstoneN, color: 0xf0e4cc }),
      carve: M({ map: tex.fine, normalMap: tex.fineN, color: 0xfaf0dc }),
      frieze: M({ map: tex.carving, normalMap: tex.carvingN, normalScale: new THREE.Vector2(1.5, 1.5), color: 0xf2e2c4 }),
      pave: M({ map: pave.map, normalMap: pave.normalMap, color: 0xf2e6cc }),
      court: M({ map: tex.court }),
      roof: M({ map: tex.roof, normalMap: tex.roofN, color: 0x6e927c }),
      // (gilt without a sky to show: a warmer, lighter gold carries it)
      gilt: M({ color: 0xf0c468 }),
      elfwood: M({ map: tex.planks, normalMap: tex.planksN, color: 0x7e5434 }),
      soffit: M({ map: tex.planks, normalMap: tex.planksN, color: 0xa87a52 }),
      tracery: M({ map: tex.tracery, color: 0xf2e4c8, ...traced }),
      stoneFill: M({ map: tex.archFill, color: 0xf2e4c8, ...traced }),
      giltTracery: M({ map: tex.archFill, color: 0xf0c468, ...traced }),
      pane: M({ map: tex.glass, color: 0x56656e, emissive: hot(0xffb060, 2.4), emissiveIntensity: 0 }),
      sunpane: M({ map: tex.glass, color: 0xfff0d0, emissive: hot(0xfff0d0, 1.2), emissiveIntensity: 1 }),
      shaft: new MeshBasicNodeMaterial({ map: tex.puff, color: hot(0xffd49a, 1), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
      glow: M({ color: 0xffe6b0, emissive: hot(0xffb04a, 2.8), emissiveIntensity: 0.25 }),
      linen: M({ map: tex.linen, normalMap: tex.linenN, color: 0xfbf8f0 }),
      curtain: M({ map: tex.linen, color: 0xfdf8ee, side: THREE.DoubleSide, transparent: true, opacity: 0.88 }),
      coverlet: M({ map: tex.linen, normalMap: tex.linenN, color: 0xf0e2c0, side: THREE.DoubleSide }),
      velvet: M({ map: tex.linen, color: 0x6e1c1a, side: THREE.DoubleSide }),
      moss: M({ map: tex.linen, color: 0x3e5a3a }),
      glaze: M({ color: 0xe9e2d2 }),
      leafGold: M({ color: 0xe0a030, side: THREE.DoubleSide }),
      rug: M({ color: 0x7a3a2a }),
      map: M({ color: 0xe0d0a8, side: THREE.DoubleSide }),
      book: M({ color: 0x6a3a22, side: THREE.DoubleSide }),
      notes: M({ color: 0xece0c4 }),
      parchment: M({ color: 0xe8d8b0 }),
      redLeather: M({ color: 0x7a1e16 }),
      inkpot: M({ color: 0x1a1a24 }),
      quill: M({ color: 0xf4efe4, side: THREE.DoubleSide }),
      wicker: M({ map: tex.thatch, color: 0xc89a5a }),
      wax: M({ color: 0xf6eedc, emissive: new THREE.Color(0xffb060), emissiveIntensity: 0.15 }),
      flame: new MeshBasicNodeMaterial({ color: hot(0xffb048, 3) }),
      mural: M({ color: 0xb8a078 }),
      marble: M({ map: tex.fine, normalMap: tex.fineN, color: 0xeae6de }),
      blade: M({ color: 0xdfe3e8 }),
      hiltSteel: M({ color: 0xc8ccd2 }),
      leather: M({ map: tex.planks, color: 0x3a2214 }),
    });
    made.push(mats.shaft, mats.flame);
  }
  // the site’s scanned surfaces worn over the builders’ own pictures, as the
  // chapters wear them (shire/dress.js; lib/three/coreNodes, on stand-ins
  // at once, the scans in as they come): the grain of real stone, wood and
  // bark at its real size
  dress(mats, { ...SHIRE_CORE, ...(wild ? WILD_CORE : {}), ...(elven ? ELVEN_CORE : {}) }, { keep: true, strength: 0.4, normal: 0.8 });
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
      if (elven) {
        mats.pane.emissiveIntensity = t;
        mats.glow.emissiveIntensity = lerp(0.25, 1, t);
      }
    },
    dispose() {
      for (const m of made) m.dispose();
      for (const t of Object.values(tex)) t.dispose();
      for (const s of [field, coursed, brick, pave].filter(Boolean)) {
        s.map.dispose();
        s.normalMap.dispose();
      }
    },
  };
}

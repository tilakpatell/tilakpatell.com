// The rush's things: everything that can be carried, set down, cooked or
// served (the kinds in ./rules.js's KINDS), made in code and shared between
// copies. itemMaker(kit.K) → { make({ k, s }), M (the materials), dispose }.

import * as THREE from 'three';
import { hot } from '../../../lib/three/stage3dNodes';
import { B, ball, cyl, lathe } from '../shire/props';

// ── the things in hand and on the counters ──

export function itemMaker(K) {
  const { mats, paint } = K;
  const m = (hex, o = {}) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.6, ...o });
  const M = {
    pewter: mats.pewter,
    dirty: m(0x6a6458, { roughness: 0.9 }),
    ale: m(0xc07a1c, { roughness: 0.3, emissive: hot(0x6a3a08, 0.4) }),
    foam: m(0xfff4dc, { roughness: 0.9 }),
    wood: paint(0xb08050),
    stew: m(0x7a4a22, { roughness: 0.5 }),
    carrot: m(0xe8741c),
    leaf: m(0x4a8a2a),
    potato: m(0xb8925a, { roughness: 0.95 }),
    flesh: m(0xf0dca0),
    dough: m(0xf2e2c0, { roughness: 1 }),
    loaf: m(0xb8742a, { roughness: 0.8 }),
    burnt: m(0x1e1814, { roughness: 1 }),
    smear: m(0x5a4a30, { roughness: 1 }),
    silver: m(0xd8dce4, { roughness: 0.22, metalness: 0.9 }),
    wine: m(0x5a0a18, { roughness: 0.15, emissive: hot(0x3a0410, 0.5) }),
    cap: m(0xa8703c, { roughness: 0.7 }),
    gill: m(0xeedcc0, { roughness: 0.9 }),
    herb: m(0x3e8a34, { roughness: 0.8 }),
    soup: m(0x8a7438, { roughness: 0.45 }),
    rock: m(0x5a5a62, { roughness: 0.95 }),
    fleck: m(0xe8f0ff, { roughness: 0.2, metalness: 0.9, emissive: hot(0x8aa8ff, 0.35) }),
    clay: m(0x8a6a50, { roughness: 0.9 }),
    soot: m(0x22201e, { roughness: 1 }),
    mithril: m(0xf2f6ff, { roughness: 0.12, metalness: 1, emissive: hot(0xa8c0ff, 0.45) }),
    iron: m(0x3a3a40, { roughness: 0.5, metalness: 0.7 }),
    haft: m(0x6a4a2a, { roughness: 0.8 }),
    lembas: m(0xf2e6c4, { roughness: 0.85 }),
    mallorn: m(0x5a8a3a, { roughness: 0.7 }),
    twine: m(0xc8b890, { roughness: 1 }),
    silk: m(0xe8ecf0, { roughness: 0.5, metalness: 0.2 }),
    glass: m(0xd8ecff, { roughness: 0.05, transparent: true, opacity: 0.55 }),
    starlight: new THREE.MeshBasicMaterial({ color: hot(0xe8f2ff, 3) }),
    scale: m(0x8a9aa4, { roughness: 0.3, metalness: 0.45 }),
    fillet: m(0xf2c8b0, { roughness: 0.7 }),
    grilled: m(0xa8682a, { roughness: 0.6 }),
    leather: m(0x8a5a32, { roughness: 0.8 }),
    mud: m(0x5a4a36, { roughness: 1 }),
    chowder: m(0xeadfc4, { roughness: 0.5 }),
    tea: m(0x8a4a1a, { roughness: 0.2 }),
    sponge: m(0xe0b070, { roughness: 0.9 }),
    icing: m(0xfff6ea, { roughness: 0.6 }),
    seed: m(0x5a3a1a, { roughness: 1 }),
    pan: m(0x2a2a2e, { roughness: 0.4, metalness: 0.6 }),
    fried: m(0x8a5a2a, { roughness: 0.5 }),
    log: m(0x6a4a2a, { roughness: 0.95 }),
    tomato: m(0xd8341c, { roughness: 0.4 }),
    banger: m(0xc8806a, { roughness: 0.6 }),
    browned: m(0x8a4a22, { roughness: 0.5 }),
    china: m(0xf2ece0, { roughness: 0.35 }),
    fur: m(0x8a7660, { roughness: 1 }),
    meat: m(0xa8384a, { roughness: 0.6 }),
    grey: m(0x7a6a6a, { roughness: 0.8 }), // (an orc's meat; best not to ask)
    roast: m(0x7a3a14, { roughness: 0.5 }),
    bone: m(0xece4d0, { roughness: 0.7 }),
    gold: m(0xd8b048, { roughness: 0.3, metalness: 0.8 }),
  };
  const mesh = (geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = 1) => {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(...p);
    o.rotation.set(...r);
    o.scale.setScalar(s);
    o.castShadow = true;
    return o;
  };
  // a fish: its body, and its tail (flat, upright)
  const fishOf = (mat, y) => {
    const body = mesh(G.fish, mat, [0, y, 0]);
    body.scale.set(2.2, 0.8, 0.9);
    const tail = mesh(G.fin, mat, [-0.16, y, 0], [0, 0, -Math.PI / 2]);
    tail.scale.set(1, 1, 0.35);
    return [body, tail];
  };
  const G = {
    mug: lathe([[0, 0], [0.085, 0], [0.09, 0.02], [0.09, 0.2], [0.078, 0.2], [0.078, 0.025], [0, 0.025]], 14),
    handle: new THREE.TorusGeometry(0.05, 0.014, 6, 12, Math.PI),
    top: new THREE.CircleGeometry(0.078, 14),
    bowl: lathe([[0, 0], [0.07, 0], [0.13, 0.05], [0.15, 0.1], [0.135, 0.1], [0.115, 0.055], [0, 0.03]], 16),
    bowlTop: new THREE.CircleGeometry(0.125, 16),
    carrot: cyl(0.045, 0.004, 0.24, 8),
    tuft: cyl(0.01, 0.03, 0.07, 5),
    disc: cyl(0.04, 0.04, 0.02, 8),
    potato: ball(0.075, 8, 6),
    cube: B(0.045, 0.045, 0.045),
    dough: ball(0.1, 10, 6),
    loaf: ball(0.12, 12, 8),
    goblet: lathe([[0, 0], [0.07, 0], [0.07, 0.015], [0.015, 0.03], [0.012, 0.11], [0.06, 0.13], [0.075, 0.22], [0.068, 0.22], [0.055, 0.14], [0, 0.135]], 14),
    wineTop: new THREE.CircleGeometry(0.066, 14),
    cap: new THREE.SphereGeometry(0.07, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    stem: cyl(0.022, 0.028, 0.08, 8),
    sprig: cyl(0.006, 0.006, 0.2, 4),
    leaf: new THREE.SphereGeometry(0.03, 6, 4),
    rock: new THREE.IcosahedronGeometry(0.075, 0),
    pebble: new THREE.IcosahedronGeometry(0.03, 0),
    tray: B(0.26, 0.05, 0.16),
    bar: B(0.2, 0.05, 0.08),
    blade: new THREE.CylinderGeometry(0.11, 0.11, 0.025, 12, 1, false, 0, Math.PI),
    pole: cyl(0.014, 0.016, 0.34, 6),
    cake: B(0.15, 0.035, 0.15),
    parcel: B(0.17, 0.06, 0.17),
    band: B(0.18, 0.064, 0.025),
    coil: new THREE.TorusGeometry(0.07, 0.022, 6, 16),
    strand: cyl(0.006, 0.006, 0.22, 4),
    vial: lathe([[0, 0], [0.04, 0], [0.045, 0.02], [0.045, 0.1], [0.018, 0.13], [0.016, 0.16], [0, 0.16]], 12),
    glow: ball(0.035, 8, 6),
    fish: ball(0.06, 10, 6),
    fin: new THREE.ConeGeometry(0.045, 0.07, 4),
    fillet: B(0.11, 0.022, 0.05),
    skin: ball(0.1, 10, 8),
    neck: cyl(0.025, 0.03, 0.06, 8),
    seedcake: cyl(0.12, 0.12, 0.1, 16),
    pan: lathe([[0, 0], [0.12, 0], [0.14, 0.04], [0.13, 0.04], [0.115, 0.012], [0, 0.012]], 16),
    panHandle: cyl(0.012, 0.014, 0.16, 6),
    log: cyl(0.035, 0.04, 0.26, 7),
    tomato: ball(0.06, 10, 8),
    banger: cyl(0.025, 0.025, 0.14, 8),
    plate: lathe([[0, 0], [0.12, 0], [0.15, 0.02], [0.14, 0.022], [0.11, 0.01], [0, 0.01]], 18),
    slice: cyl(0.04, 0.04, 0.015, 10),
    coney: ball(0.07, 10, 8),
    ear: cyl(0.012, 0.02, 0.08, 5),
    joint: ball(0.08, 10, 8),
    bone: cyl(0.012, 0.012, 0.1, 6),
    salver: lathe([[0, 0], [0.18, 0], [0.21, 0.025], [0.2, 0.028], [0.17, 0.01], [0, 0.01]], 20),
  };
  const build = {
    mug(s) {
      const g = new THREE.Group();
      g.add(mesh(G.mug, s === 'dirty' ? M.dirty : M.pewter));
      g.add(mesh(G.handle, s === 'dirty' ? M.dirty : M.pewter, [0.09, 0.1, 0], [0, 0, -Math.PI / 2]));
      if (s === 'ale') {
        g.add(mesh(G.top, M.ale, [0, 0.17, 0], [-Math.PI / 2, 0, 0]));
        const foam = mesh(G.potato, M.foam, [0, 0.19, 0]);
        foam.scale.set(1.05, 0.35, 1.05);
        g.add(foam);
      } else if (s === 'tea') g.add(mesh(G.top, M.tea, [0, 0.16, 0], [-Math.PI / 2, 0, 0]));
      else if (s === 'dirty') g.add(mesh(G.top, M.smear, [0, 0.06, 0], [-Math.PI / 2, 0, 0]));
      return g;
    },
    bowl(s) {
      const g = new THREE.Group();
      g.add(mesh(G.bowl, s === 'dirty' ? M.dirty : M.wood));
      if (s === 'soup') {
        g.add(mesh(G.bowlTop, M.soup, [0, 0.085, 0], [-Math.PI / 2, 0, 0]));
        for (let i = 0; i < 5; i++) g.add(mesh(G.leaf, i % 2 ? M.herb : M.cap, [Math.cos(i * 1.3) * 0.06, 0.09, Math.sin(i * 1.3) * 0.06], [0, i, 0], 0.7));
      } else if (s === 'chowder') {
        g.add(mesh(G.bowlTop, M.chowder, [0, 0.085, 0], [-Math.PI / 2, 0, 0]));
        for (let i = 0; i < 5; i++) g.add(mesh(i % 2 ? G.leaf : G.cube, i % 2 ? M.herb : M.fillet, [Math.cos(i * 1.4) * 0.06, 0.09, Math.sin(i * 1.4) * 0.06], [i, i * 2, 0], 0.7));
      } else if (s === 'stew') {
        g.add(mesh(G.bowlTop, M.stew, [0, 0.085, 0], [-Math.PI / 2, 0, 0]));
        for (let i = 0; i < 4; i++) g.add(mesh(G.cube, i % 2 ? M.carrot : M.flesh, [Math.cos(i * 1.7) * 0.06, 0.09, Math.sin(i * 1.7) * 0.06], [i, i * 2, 0], 0.8));
      } else if (s === 'dirty') g.add(mesh(G.bowlTop, M.smear, [0, 0.05, 0], [-Math.PI / 2, 0, 0], 0.8));
      return g;
    },
    carrot(s) {
      const g = new THREE.Group();
      if (s === 'chopped') for (let i = 0; i < 5; i++) g.add(mesh(G.disc, M.carrot, [Math.cos(i * 1.3) * 0.06, 0.012 + (i % 2) * 0.014, Math.sin(i * 1.3) * 0.06], [0.3 * i, 0, 0.2]));
      else {
        g.add(mesh(G.carrot, M.carrot, [0, 0.05, 0], [0, 0, Math.PI / 2]));
        g.add(mesh(G.tuft, M.leaf, [0.15, 0.05, 0], [0, 0, -Math.PI / 2]));
      }
      return g;
    },
    potato(s) {
      const g = new THREE.Group();
      if (s === 'chopped') for (let i = 0; i < 6; i++) g.add(mesh(G.cube, M.flesh, [Math.cos(i * 1.1) * 0.06, 0.025 + (i % 2) * 0.03, Math.sin(i * 1.1) * 0.06], [i, i, 0]));
      else {
        const o = mesh(G.potato, M.potato, [0, 0.07, 0]);
        o.scale.set(1.25, 0.85, 0.95);
        g.add(o);
      }
      return g;
    },
    dough() {
      const g = new THREE.Group();
      const o = mesh(G.dough, M.dough, [0, 0.06, 0]);
      o.scale.set(1.2, 0.6, 1);
      g.add(o);
      return g;
    },
    goblet(s) {
      const g = new THREE.Group();
      g.add(mesh(G.goblet, s === 'dirty' ? M.dirty : M.silver));
      if (s === 'wine') g.add(mesh(G.wineTop, M.wine, [0, 0.2, 0], [-Math.PI / 2, 0, 0]));
      else if (s === 'dirty') g.add(mesh(G.wineTop, M.smear, [0, 0.16, 0], [-Math.PI / 2, 0, 0], 0.8));
      return g;
    },
    mushroom(s) {
      const g = new THREE.Group();
      if (s === 'chopped') for (let i = 0; i < 5; i++) g.add(mesh(G.disc, i % 2 ? M.gill : M.cap, [Math.cos(i * 1.3) * 0.06, 0.012 + (i % 2) * 0.014, Math.sin(i * 1.3) * 0.06], [0.3 * i, 0, 0.2]));
      else {
        g.add(mesh(G.stem, M.gill, [0, 0.04, 0]));
        g.add(mesh(G.cap, M.cap, [0, 0.07, 0]));
      }
      return g;
    },
    herb(s) {
      const g = new THREE.Group();
      if (s === 'chopped') for (let i = 0; i < 7; i++) g.add(mesh(G.leaf, M.herb, [Math.cos(i * 1.1) * 0.06, 0.015, Math.sin(i * 1.1) * 0.06], [0, i, 0], 0.7));
      else {
        for (let i = 0; i < 3; i++) {
          g.add(mesh(G.sprig, M.herb, [0, 0.03, (i - 1) * 0.03], [0, 0, Math.PI / 2 + (i - 1) * 0.3]));
          for (let k = 0; k < 3; k++) g.add(mesh(G.leaf, M.herb, [(k - 1) * 0.06, 0.04, (i - 1) * 0.04]));
        }
      }
      return g;
    },
    ore(s) {
      const g = new THREE.Group();
      if (s === 'chopped') for (let i = 0; i < 6; i++) g.add(mesh(G.pebble, i % 3 ? M.rock : M.fleck, [Math.cos(i * 1.1) * 0.06, 0.03 + (i % 2) * 0.02, Math.sin(i * 1.1) * 0.06], [i, i * 2, 0]));
      else {
        g.add(mesh(G.rock, M.rock, [0, 0.07, 0], [0.4, 0.8, 0]));
        for (let i = 0; i < 3; i++) g.add(mesh(G.pebble, M.fleck, [Math.cos(i * 2.1) * 0.05, 0.1, Math.sin(i * 2.1) * 0.05], [i, 0, i], 0.5));
      }
      return g;
    },
    mould(s) {
      const g = new THREE.Group();
      g.add(mesh(G.tray, s === 'dirty' ? M.soot : M.clay, [0, 0.025, 0]));
      if (s === 'mithril') g.add(mesh(G.bar, M.mithril, [0, 0.055, 0], [0, 0, 0], 0.95));
      return g;
    },
    iron() {
      const g = new THREE.Group();
      g.add(mesh(G.bar, M.iron, [0, 0.03, 0]));
      g.add(mesh(G.bar, M.iron, [0.02, 0.08, 0], [0, 0.4, 0]));
      return g;
    },
    axe(s) {
      const g = new THREE.Group();
      g.add(mesh(G.pole, s === 'ruined' ? M.soot : M.haft, [0, 0.02, 0], [0, 0, Math.PI / 2]));
      g.add(mesh(G.blade, s === 'ruined' ? M.soot : M.iron, [0.15, 0.02, 0], [Math.PI / 2, 0, -Math.PI / 2]));
      return g;
    },
    lembas(s) {
      const g = new THREE.Group();
      if (s === 'wrapped') {
        g.add(mesh(G.parcel, M.mallorn, [0, 0.03, 0], [0, 0.4, 0]));
        g.add(mesh(G.band, M.twine, [0, 0.03, 0], [0, 0.4, 0]));
      } else {
        g.add(mesh(G.cake, s === 'burnt' ? M.burnt : M.lembas, [0, 0.02, 0], [0, 0.3, 0]));
        g.add(mesh(G.cake, s === 'burnt' ? M.burnt : M.lembas, [0.03, 0.055, -0.02], [0, 0.9, 0], 0.9));
      }
      return g;
    },
    fibre(s) {
      const g = new THREE.Group();
      if (s === 'chopped') {
        g.add(mesh(G.coil, M.silk, [0, 0.025, 0], [Math.PI / 2, 0, 0]));
        g.add(mesh(G.coil, M.silk, [0, 0.06, 0], [Math.PI / 2, 0, 0.6], 0.85));
      } else for (let i = 0; i < 7; i++) g.add(mesh(G.strand, M.silk, [Math.cos(i) * 0.03, 0.03, Math.sin(i) * 0.03], [0.3, i, Math.PI / 2 + (i - 3) * 0.08]));
      return g;
    },
    phial(s) {
      const g = new THREE.Group();
      g.add(mesh(G.vial, s === 'dirty' ? M.dirty : M.glass));
      if (s === 'light') g.add(mesh(G.glow, M.starlight, [0, 0.06, 0], [0, 0, 0], 1.1));
      return g;
    },
    fish(s) {
      const g = new THREE.Group();
      if (s === 'chopped') for (let i = 0; i < 3; i++) g.add(mesh(G.fillet, M.fillet, [(i - 1) * 0.05, 0.012 + (i % 2) * 0.02, (i - 1) * 0.03], [0, 0.3 + i * 0.5, 0]));
      else g.add(...fishOf(M.scale, 0.04));
      return g;
    },
    // a fish on a stick, over the campfire
    skewer(s) {
      const g = new THREE.Group();
      g.add(mesh(G.pole, M.haft, [0, 0.05, 0], [0, 0, Math.PI / 2]));
      g.add(...fishOf(s === 'charred' ? M.burnt : M.grilled, 0.05));
      return g;
    },
    skin(s) {
      const g = new THREE.Group();
      const full = s === 'water';
      const hide = s === 'dirty' ? M.mud : M.leather;
      const body = mesh(G.skin, hide, [0, full ? 0.075 : 0.05, 0]);
      body.scale.set(1, full ? 0.75 : 0.45, 0.7);
      g.add(body);
      g.add(mesh(G.neck, hide, [0.09, full ? 0.11 : 0.07, 0], [0, 0, -0.9]));
      if (full) g.add(mesh(G.disc, M.cap, [0.115, 0.13, 0], [0, 0, -0.9], 0.6)); // a cork
      return g;
    },
    // Bilbo's seed-cake: iced, seeded
    cake(s) {
      const g = new THREE.Group();
      g.add(mesh(G.seedcake, s === 'burnt' ? M.burnt : M.sponge, [0, 0.05, 0]));
      if (s !== 'burnt') {
        const top = mesh(G.seedcake, M.icing, [0, 0.103, 0]);
        top.scale.set(1.02, 0.08, 1.02);
        g.add(top);
        for (let i = 0; i < 6; i++) g.add(mesh(G.pebble, M.seed, [Math.cos(i * 1.05) * 0.07, 0.11, Math.sin(i * 1.05) * 0.07], [i, i, 0], 0.5));
      }
      return g;
    },
    // mushrooms, fried in a pan
    skillet(s) {
      const g = new THREE.Group();
      g.add(mesh(G.pan, M.pan));
      g.add(mesh(G.panHandle, M.pan, [0.21, 0.025, 0], [0, 0, Math.PI / 2]));
      for (let i = 0; i < 5; i++) g.add(mesh(G.cap, s === 'burnt' ? M.burnt : M.fried, [Math.cos(i * 1.3) * 0.06, 0.012, Math.sin(i * 1.3) * 0.06], [0, i, 0], 0.7));
      return g;
    },
    wood() {
      const g = new THREE.Group();
      g.add(mesh(G.log, M.log, [0, 0.035, -0.035], [0, 0, Math.PI / 2]));
      g.add(mesh(G.log, M.log, [0.02, 0.035, 0.04], [0, 0.3, Math.PI / 2]));
      g.add(mesh(G.log, M.log, [0, 0.1, 0], [0, -0.2, Math.PI / 2]));
      return g;
    },
    tomato(s) {
      const g = new THREE.Group();
      if (s === 'chopped') for (let i = 0; i < 3; i++) g.add(mesh(G.slice, M.tomato, [(i - 1) * 0.05, 0.01, (i % 2) * 0.03], [0, i, 0]));
      else {
        g.add(mesh(G.tomato, M.tomato, [0, 0.055, 0]));
        g.add(mesh(G.tuft, M.leaf, [0, 0.115, 0], [0, 0, 0], 0.6));
      }
      return g;
    },
    sausage(s) {
      const g = new THREE.Group();
      if (s === 'chopped') for (let i = 0; i < 4; i++) g.add(mesh(G.slice, M.banger, [(i - 1.5) * 0.045, 0.01, (i % 2) * 0.03], [0, i, 0], 0.7));
      else for (let i = 0; i < 3; i++) g.add(mesh(G.banger, M.banger, [(i - 1) * 0.055, 0.025, 0], [Math.PI / 2, 0, 0]));
      return g;
    },
    // sausages on a stick, over the fire
    banger(s) {
      const g = new THREE.Group();
      g.add(mesh(G.pole, M.haft, [0, 0.05, 0], [0, 0, Math.PI / 2]));
      for (let i = 0; i < 3; i++) g.add(mesh(G.banger, s === 'burnt' ? M.burnt : M.browned, [(i - 1) * 0.07, 0.05, 0], [0, 0, Math.PI / 2]));
      return g;
    },
    plate(s) {
      const g = new THREE.Group();
      g.add(mesh(G.plate, s === 'dirty' ? M.dirty : M.china));
      if (s === 'fryup') {
        for (let i = 0; i < 2; i++) g.add(mesh(G.banger, M.browned, [-0.04 + i * 0.05, 0.035, 0.03], [Math.PI / 2, 0.3, 0]));
        for (let i = 0; i < 2; i++) g.add(mesh(G.slice, M.tomato, [0.05 - i * 0.07, 0.025, -0.05], [0, i, 0]));
      } else if (s === 'dirty') g.add(mesh(G.slice, M.smear, [0, 0.015, 0], [0, 0, 0], 2));
      return g;
    },
    coney(s) {
      const g = new THREE.Group();
      if (s === 'chopped') for (let i = 0; i < 3; i++) g.add(mesh(G.cube, M.meat, [(i - 1) * 0.05, 0.025, (i % 2) * 0.03], [i, i, 0]));
      else {
        const body = mesh(G.coney, M.fur, [0, 0.06, 0]);
        body.scale.set(1.4, 0.9, 0.9);
        g.add(body);
        g.add(mesh(G.coney, M.fur, [0.09, 0.09, 0], [0, 0, 0], 0.55));
        for (const z of [-0.02, 0.02]) g.add(mesh(G.ear, M.fur, [0.11, 0.15, z], [0, 0, -0.4]));
      }
      return g;
    },
    // a roast: browned on a bone (or charred)
    roast(s) {
      const g = new THREE.Group();
      const joint = mesh(G.joint, s === 'charred' ? M.burnt : M.roast, [0, 0.065, 0]);
      joint.scale.set(1.3, 0.8, 1);
      g.add(joint);
      g.add(mesh(G.bone, M.bone, [0.13, 0.07, 0], [0, 0, Math.PI / 2]));
      return g;
    },
    meat(s) {
      const g = new THREE.Group();
      const mat = M.grey;
      if (s === 'chopped') for (let i = 0; i < 3; i++) g.add(mesh(G.cube, mat, [(i - 1) * 0.05, 0.025, (i % 2) * 0.03], [i, i, 0], 1.2));
      else {
        const lump = mesh(G.joint, M.meat, [0, 0.05, 0]);
        lump.scale.set(1.2, 0.6, 0.9);
        g.add(lump);
        g.add(mesh(G.bone, M.bone, [0.12, 0.05, 0], [0, 0, Math.PI / 2]));
      }
      return g;
    },
    // the feast: a roast, bread and herbs on a gilt platter
    platter() {
      const g = new THREE.Group();
      g.add(mesh(G.salver, M.gold));
      const joint = mesh(G.joint, M.roast, [-0.04, 0.06, 0]);
      joint.scale.set(1.1, 0.7, 0.9);
      g.add(joint);
      const loaf = mesh(G.loaf, M.loaf, [0.09, 0.05, 0.05]);
      loaf.scale.set(0.8, 0.45, 0.6);
      g.add(loaf);
      for (let i = 0; i < 5; i++) g.add(mesh(G.leaf, M.herb, [Math.cos(i * 1.3) * 0.15, 0.03, Math.sin(i * 1.3) * 0.12], [0, i, 0], 0.9));
      return g;
    },
    loaf(s) {
      const g = new THREE.Group();
      const o = mesh(G.loaf, s === 'burnt' ? M.burnt : M.loaf, [0, 0.07, 0]);
      o.scale.set(1.5, 0.7, 0.95);
      g.add(o);
      return g;
    },
  };
  const protos = new Map();
  return {
    // a fresh copy of one (sharing its geometry and materials)
    make(it) {
      const sig = `${it.k}:${it.s}`;
      if (!protos.has(sig)) protos.set(sig, build[it.k](it.s));
      return protos.get(sig).clone();
    },
    M,
    dispose() {
      for (const g of Object.values(G)) g.dispose();
      // (all but the kit's own, which it disposes)
      for (const [k, x] of Object.entries(M)) if (k !== 'pewter' && k !== 'wood') x.dispose();
    },
  };
}

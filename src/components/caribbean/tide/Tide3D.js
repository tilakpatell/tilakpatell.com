// Dead man's tide, drawn: the game in ./rules.js as a WebGL scene. The sea
// and sky are ./sea.js, the smoke and foam ./fx.js; the ships, the kraken and
// the islands are models made for the site with Meshy (scripts/caribbean.mjs),
// lit by the sky they sit under. Captain Jack Sparrow (also Meshy's, rigged,
// with an idle clip) stands at the Black Pearl's helm, and the title screen
// looks over his shoulder. Your ship, he and the navy load first; the rest
// arrive while you sail and appear when they land.
//
// render(g, ms, view) draws one frame of a game: it reads g and g.events and
// changes neither. Everyone else online sailing this sea (view.travellers,
// the towns' travellers.js list()) shows as a ghost ship from another world.

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createStage } from '../../../lib/stage3d';
import { prepareScene } from '../../../lib/three/gpuWork';
import { settle } from '../../../lib/settle';
import { houseOn } from '../../../lib/three/house';
import { SUN, createSea, loadSky } from './sea';
import { DECAL, createBalls, createDecals, createFoam, createParticles } from './fx';
import { ARM, CHAPTERS, ISLES, SHIPS, TIDE, bearing, fitted } from './rules';
import { gltfLoader } from '../../../lib/three/gltf';
import { createGhosts } from '../../middleearth/towns/ghosts';
import { WHEEL_AHEAD, createCaptain, makeWheel } from './captain';
import { createArm } from './arm';
import { bendArm } from './bend';

const BASE = '/games/caribbean';
const FIRST = ['pearl', 'navy', 'jack']; // what a game can't start without
const LATER = ['palms', 'port', 'skull', 'fort', 'chest', 'ghost', 'tentacle', 'kraken'];

// How each model sits in the sea: `draft` is how much of it is under water,
// as a share of its height; `up` lifts a ship's guns to deck height.
const SHIP = {
  pearl: { model: 'pearl', draft: 0.13, deck: 5.5, mast: 30 },
  navy: { model: 'navy', draft: 0.135, deck: 5.5, mast: 30 },
  sloop: { model: 'navy', draft: 0.135, deck: 4, mast: 20 },
  ghost: { model: 'ghost', draft: 0.15, deck: 6, mast: 32 },
};
const ISLE = {
  port: { draft: 0.07, wide: 2.25 },
  skull: { draft: 0.05, wide: 2.2 },
  fort: { draft: 0.1, wide: 2.2 },
  palms: { draft: 0.035, wide: 2.3 },
};

const ease = (k) => k * k * (3 - 2 * k);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;

export async function createTide3D(canvas, { soft = false, alive = () => true, onLost, onProgress } = {}) {
  onProgress?.(0.05, 'Raising the sky');
  const stage = createStage(canvas, { soft, shadows: true, fov: 50, near: 1, far: 9000, exposure: 0.92, bloom: { strength: 0.24, radius: 0.5, threshold: 1 }, onLost });
  const { scene, camera, renderer } = stage;
  stage.grade({ contrast: 0.16, saturation: 1.08, vignette: 0.26, shadow: [0.0, 0.012, 0.02], high: [0.03, 0.012, 0.0] });

  const skyTex = await loadSky();
  if (!alive()) {
    skyTex.dispose();
    stage.dispose();
    return null;
  }
  const sea = createSea(stage, skyTex, ISLES);
  scene.fog = new THREE.FogExp2(0x8fa3b4, 0.00062);

  const sun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.76, 0.52), 3.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 10, far: 700 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.5;
  scene.add(sun, sun.target);
  // a little cool light from the sky side, so the shadowed side isn't flat
  const hemi = new THREE.HemisphereLight(0x9cc4ff, 0x1c2f33, 0.35);
  scene.add(hemi);
  // the house look (lib/three/house): the shade one colour from the sky
  // light, as in every world, under the house tone mapper (the sea's own
  // shader, and its fog, left as they are)
  const house = houseOn({ renderer, scene, sun, hemi, look: { fog: false } });
  let houseFrames = 0;

  const particles = createParticles(scene, sea.ripples);
  const decals = createDecals(scene, sea);
  const foam = createFoam();
  const balls = createBalls(scene);
  const wind = new THREE.Vector3();

  // ── the models ──
  const loader = gltfLoader();
  const models = new Map();
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const loadModel = async (name) => {
    const gltf = await loader.loadAsync(`${BASE}/${name}.glb`);
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const m = o.material;
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) if (m[k]) m[k].anisotropy = aniso;
      // Meshy's metal maps run high for wood, stone and skin; under a real
      // sky that reads as chrome
      m.metalness = Math.min(m.metalness, 0.35);
      m.envMapIntensity = 0.9;
    });
    models.set(name, { root, box, size: box.getSize(new THREE.Vector3()), clips: gltf.animations ?? [] });
  };
  let landed = 0;
  await Promise.all(
    FIRST.map((n) =>
      loadModel(n).then(() => {
        landed += 1;
        onProgress?.(0.2 + (landed / FIRST.length) * 0.75, 'Rigging the ships');
      }),
    ),
  );
  if (!alive()) {
    stage.dispose();
    sea.dispose();
    return null;
  }

  // a copy of a model with materials of its own (so one ship can flash or
  // fade without the others), scaled so its longest side is `long`
  const copy = (name, long, draft = 0) => {
    const src = models.get(name);
    if (!src) return null;
    const model = src.root.clone();
    const mats = [];
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      mats.push(o.material);
    });
    const k = long / Math.max(src.size.x, src.size.z);
    model.scale.setScalar(k);
    model.position.y = (src.size.y / 2 - src.size.y * draft) * k;
    return { model, mats, height: src.size.y * k, k };
  };
  const drop = (o) => {
    o.root.removeFromParent();
    for (const m of o.mats ?? []) m.dispose();
    o.captain?.body.dispose();
    o.bend?.dispose();
  };

  // islands, as each model lands
  const isleDone = new Set();
  let fortObj = null;
  const placeIsles = () => {
    ISLES.forEach((isle, i) => {
      if (isleDone.has(i) || !models.has(isle.kind)) return;
      const spec = ISLE[isle.kind];
      const c = copy(isle.kind, isle.r * spec.wide, spec.draft);
      const root = new THREE.Group();
      root.add(c.model);
      root.position.set(isle.x, 0, isle.y);
      root.rotation.y = isle.a;
      scene.add(root);
      isleDone.add(i);
      if (isle.kind === 'fort') fortObj = { root, mats: c.mats, height: c.height, smoke: 0 };
    });
  };
  let disposed = false;
  // the rest, one after another, behind the game (or, the first time, behind
  // the loading screen: prepare, below)
  const laterJob = (async () => {
    for (const n of LATER) {
      if (disposed) return;
      try {
        await loadModel(n);
        if (!disposed) placeIsles();
      } catch {
        /* that one stays away */
      }
    }
  })();

  // ── what's afloat ──
  const ships = new Map(); // game ship id → { root, tilt, mats, … }
  const loot = new Map();
  const armObjs = new Map();
  let krakenObj = null;
  let lastGame = null;
  const shells = []; // mortar shells in the air

  // The captain at the Pearl's helm: on the quarterdeck, facing the bow. The
  // deck under him is found with a plumb line, so he stands on the model as
  // it is: her main deck is about 3.3 above the water, the quarterdeck 4.9
  // and the poop deck behind it 7.3, and it is the quarterdeck that's wanted.
  const plumb = new THREE.Raycaster();
  const DOWN = new THREE.Vector3(0, -1, 0);
  const captain = (tilt, hull, s) => {
    const src = models.get('jack');
    if (!src) return null;
    const figure = cloneSkinned(src.root);
    const k = 2.9 / src.size.y;
    figure.scale.setScalar(k);
    const x = s.len * 0.235; // toward the stern: her bow is −x
    tilt.updateWorldMatrix(true, true);
    plumb.set(new THREE.Vector3(x, 200, 0).applyMatrix4(tilt.matrixWorld), DOWN);
    const decks = plumb.intersectObject(hull, true).map((h) => tilt.worldToLocal(h.point.clone()).y).filter((y) => y > 3.9 && y < 5.7);
    const deck = decks.length ? Math.max(...decks) : 4.9;
    figure.position.set(x, deck - src.box.min.y * k, 0);
    figure.rotation.y = -Math.PI / 2; // facing the bow
    figure.traverse((m) => {
      if (m.isMesh) m.frustumCulled = false; // a skinned mesh's bounds don't follow its pose
    });
    tilt.add(figure);
    // his wheel just ahead of him (the model has none there), its helmsman's
    // side to him; and his body on it (./captain.js: his own idle, the clip
    // library's for the rest, his hands on the spokes)
    const tall = src.size.y * k;
    const wheel = makeWheel(tall);
    wheel.group.position.set(x - WHEEL_AHEAD * tall, deck, 0);
    tilt.add(wheel.group);
    const body = createCaptain(figure, src, { wheel });
    // where the title screen stands (on the main deck ahead of him, looking aft: the captain to the right of
    // the picture, the stern lantern and the sky behind) and what it looks at
    return { body, eye: new THREE.Vector3(x - 5.0, deck + 2.5, 0.9), gaze: new THREE.Vector3(x + 2, deck + 2.25, -1.9), sight: new THREE.Vector3(x - 40, deck + tall * 0.92, 0), ahead: new THREE.Vector3() };
  };
  // a point on the sea (rules.js's x, y), a little over the water, in the world
  const seaPoint = (p, out) => out.set(p.x, sea.height(p.x, p.y) + 4, p.y);

  const makeShip = (s) => {
    const spec = SHIP[s.kind];
    // a ship whose own model hasn't landed yet sails as a navy ship until it does
    const stand = !models.has(spec.model);
    const c = copy(stand ? 'navy' : spec.model, s.len * 1.09, spec.draft);
    if (!c) return null;
    const root = new THREE.Group();
    const tilt = new THREE.Group();
    tilt.add(c.model);
    root.add(tilt);
    scene.add(root);
    if (s.kind === 'ghost') for (const m of c.mats) m.emissive = new THREE.Color(0.02, 0.14, 0.07);
    return { root, tilt, mats: c.mats, spec, stand, captain: s.kind === 'pearl' ? captain(tilt, c.model, s) : null, h: 0, pitch: 0, roll: 0, kick: 0, kickV: 0, wake: 0, smoke: 0, base: s.kind === 'ghost' ? new THREE.Color(0.02, 0.14, 0.07) : new THREE.Color(0, 0, 0) };
  };

  const flash = new THREE.Color();
  const poseShip = (o, s, dt) => {
    const fx = Math.cos(s.a);
    const fz = Math.sin(s.a);
    const L = s.len * 0.34;
    const B = s.beam * 0.5;
    const bow = sea.height(s.x + fx * L, s.y + fz * L);
    const stern = sea.height(s.x - fx * L, s.y - fz * L);
    const port = sea.height(s.x + fz * B, s.y - fx * B);
    const star = sea.height(s.x - fz * B, s.y + fx * B);
    const k = 1 - Math.exp(-dt * 3.2);
    o.h += ((bow + stern + port + star) / 4 - o.h) * k;
    o.pitch += (Math.atan2(bow - stern, 2 * L) * 0.8 - o.pitch) * k;
    o.roll += (Math.atan2(port - star, 2 * B) * 0.45 - o.roll) * k;
    // the roll back from a broadside: a damped spring
    o.kickV += (-o.kick * 38 - o.kickV * 5) * dt;
    o.kick += o.kickV * dt;
    // heeling out of a turn
    const heel = s.rudder * Math.min(1, s.v / 22) * 0.085;
    let y = o.h * 0.9;
    let pitch = o.pitch;
    let roll = o.roll + heel + o.kick;
    if (s.sunk) {
      // down by the stern, rolling over
      const t = s.sunk;
      pitch += Math.min(0.75, t * 0.16);
      roll += Math.min(0.5, t * 0.09) * (s.id % 2 ? 1 : -1);
      y -= t * t * 0.5 + t * 1.2;
    }
    if (s.under) y -= ease(s.under) * (o.spec.mast + 12);
    o.root.position.set(s.x, y, s.y);
    o.root.rotation.y = Math.PI - s.a;
    o.tilt.rotation.z = -pitch;
    o.tilt.rotation.x = -roll;
    o.root.visible = !(s.under >= 1) && y > -(o.spec.mast + 14);
    // struck: a flash through the timbers
    const f = s.hit > 0 ? (s.hit / 0.3) ** 2 : 0;
    flash.setRGB(o.base.r + f * 0.42, o.base.g + f * 0.18, o.base.b + f * 0.06);
    for (const m of o.mats) m.emissive.copy(flash);
  };

  // smoke from a ship that's been knocked about, and her wake
  const trail = (o, s, dt, max) => {
    if (s.sunk || s.under > 0.4) return;
    const fx = Math.cos(s.a);
    const fz = Math.sin(s.a);
    const hurt = 1 - s.hp / max;
    if (hurt > 0.4) {
      o.smoke += dt * (hurt > 0.7 ? 14 : 6);
      while (o.smoke > 1) {
        o.smoke -= 1;
        const along = (Math.random() - 0.5) * s.len * 0.5;
        const x = s.x + fx * along;
        const z = s.y + fz * along;
        const y = o.root.position.y + o.spec.deck + 2;
        const dark = 0.05 + Math.random() * 0.08;
        particles.add(x, y, z, (Math.random() - 0.5) * 2, 5 + Math.random() * 4, (Math.random() - 0.5) * 2, { life: 2.6 + Math.random() * 1.6, size: 2.2, grow: 4.5, color: [dark, dark, dark * 1.1], alpha: 0.55, drag: 0.25, spin: (Math.random() - 0.5) * 0.8 });
        if (hurt > 0.7 && Math.random() < 0.6) particles.add(x, y - 1, z, (Math.random() - 0.5) * 2, 6 + Math.random() * 5, (Math.random() - 0.5) * 2, { life: 0.5 + Math.random() * 0.4, size: 1.6, grow: 1.8, color: [5, 1.9, 0.35], glow: 1, alpha: 1, drag: 0.4 });
      }
    }
    o.wake += s.v * dt;
    if (o.wake > 4.2 && s.v > 3) {
      o.wake = 0;
      const pace = Math.min(1, s.v / 24);
      foam.add(s.x - fx * s.len * 0.47, s.y - fz * s.len * 0.47, s.beam * 0.5, s.beam * (1 + pace * 0.9), 3.6 + pace * 3, 0.75 * pace + 0.15);
      // and where the bow cuts the water
      for (const side of [-1, 1]) foam.add(s.x + fx * s.len * 0.36 - fz * side * s.beam * 0.42, s.y + fz * s.len * 0.36 + fx * side * s.beam * 0.42, s.beam * 0.2, s.beam * 0.62, 1.5, 0.5 * pace);
      if (pace > 0.55 && Math.random() < 0.5) {
        const side = Math.random() < 0.5 ? -1 : 1;
        particles.add(s.x + fx * s.len * 0.44 - fz * side * 2, o.root.position.y + 1.5, s.y + fz * s.len * 0.44 + fx * side * 2, -fz * side * 5 + fx * 3, 4 + Math.random() * 4, fx * side * 5 + fz * 3, { life: 0.9, size: 0.9, grow: 3, color: [0.85, 0.92, 0.95], alpha: 0.5, gravity: 11, drag: 0.2 });
      }
    }
  };

  // ── the other players ──
  // each a pale, see-through Black Pearl (the Middle-earth towns' ghosts,
  // ../../middleearth/towns/ghosts.js) with the captain's name over her masts
  // and a ring of light on the water round her, riding the swell; nothing
  // here touches them, nor they anything here. (The ring floats a little over
  // the swell, so the waves don't cut it; she sits back down into the water.)
  const LIFT = 2.5;
  const ghosts = createGhosts({
    height: (x, z) => sea.height(x, z) * 0.9 + LIFT,
    make: () => {
      const c = copy('pearl', SHIPS.pearl.len * 1.09, SHIP.pearl.draft);
      const tilt = new THREE.Group();
      tilt.add(c.model);
      const group = new THREE.Group();
      group.add(tilt);
      // (her geometry is your own ship's: left alone when a ghost goes)
      return { group, tilt, top: SHIP.pearl.mast, dispose: () => {} };
    },
    animate: (f, t) => {
      f.group.position.y = -LIFT;
      f.tilt.rotation.z = Math.sin(t * 0.8) * 0.025;
      f.tilt.rotation.x = Math.sin(t * 1.1 + 1) * 0.04;
    },
    tag: 4.5,
    halo: 70,
    snap: 60, // (a ship covers ground between steps)
  });
  scene.add(ghosts.group);

  // ── things that happen ──
  let trauma = 0;
  let fovKick = 0;
  const spray = (x, y, z, n, power, size = 1) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283;
      const out = Math.random() * power * 0.35;
      particles.add(x, y, z, Math.cos(a) * out, power * (0.55 + Math.random() * 0.6), Math.sin(a) * out, { life: 0.8 + Math.random() * 0.7, size: (0.7 + Math.random() * 0.7) * size, grow: 2.6, color: [0.86, 0.93, 0.96], alpha: 0.75, gravity: 22, drag: 0.15 });
    }
  };
  const burst = (x, y, z, n, { speed = 10, color, life = 0.6, size = 0.5, gravity = 26, glow = 0, up = 0.6 }) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283;
      const v = speed * (0.3 + Math.random() * 0.7);
      particles.add(x, y, z, Math.cos(a) * v, v * (up + Math.random() * 0.8), Math.sin(a) * v, { life: life * (0.6 + Math.random() * 0.8), size: size * (0.6 + Math.random() * 0.8), grow: glow ? 0.3 : 1, color, alpha: 1, gravity, drag: 0.3, glow, spin: (Math.random() - 0.5) * 12, fade: 0.02 });
    }
  };
  const blast = (x, y, z, big = 1) => {
    for (let i = 0; i < 8 * big; i++) {
      const a = Math.random() * 6.283;
      const v = Math.random() * 7 * big;
      particles.add(x, y + Math.random() * 3, z, Math.cos(a) * v, 4 + Math.random() * 9 * big, Math.sin(a) * v, { life: 0.45 + Math.random() * 0.4, size: 2.5 * big, grow: 2.2, color: [6, 2.4, 0.5], glow: 1, drag: 1.2 });
      const dark = 0.06 + Math.random() * 0.1;
      particles.add(x, y + 2, z, Math.cos(a) * v * 0.6, 5 + Math.random() * 7 * big, Math.sin(a) * v * 0.6, { life: 2.2 + Math.random() * 2, size: 3 * big, grow: 3.6, color: [dark, dark, dark], alpha: 0.6, drag: 0.5, spin: (Math.random() - 0.5) * 1.2 });
    }
  };
  const near = (x, z, reach) => clamp(1 - Math.hypot(x - camera.position.x, z - camera.position.z) / reach, 0, 1);

  const onEvent = (e, g) => {
    const h = e.x == null ? 0 : sea.height(e.x, e.y);
    switch (e.type) {
      case 'gun': {
        const dx = Math.cos(e.dir);
        const dz = Math.sin(e.dir);
        const y = h + (e.owner === 'p' ? 5.2 : 4.6);
        const hot = e.hot ? [1.2, 5.5, 2.2] : [7, 3.4, 0.9];
        particles.add(e.x + dx * 1.5, y, e.y + dz * 1.5, dx * 14, 0.5, dz * 14, { life: 0.11, size: 1.6, grow: 2.6, color: hot, glow: 1, drag: 3, fade: 0.01 });
        for (let i = 0; i < 7; i++) {
          const v = 5 + Math.random() * 26;
          const grey = 0.34 + Math.random() * 0.22;
          particles.add(e.x + dx * 2, y, e.y + dz * 2, dx * v + (Math.random() - 0.5) * 5, 0.5 + Math.random() * 3.5, dz * v + (Math.random() - 0.5) * 5, { life: 1.4 + Math.random() * 2.2, size: 0.6 + Math.random() * 0.5, grow: 5.5, color: e.hot ? [grey * 0.6, grey, grey * 0.7] : [grey, grey * 0.97, grey * 0.92], alpha: 0.26, drag: 1.9, spin: (Math.random() - 0.5) * 1.5, fade: 0.08 });
        }
        break;
      }
      case 'broadside': {
        const o = e.owner === 'p' ? ships.get(g.p.id) : null;
        if (o) {
          o.kickV += -e.side * 0.75;
          trauma = Math.min(1, trauma + 0.2);
          fovKick = 1;
        }
        break;
      }
      case 'splash':
        spray(e.x, h + 0.5, e.y, e.big ? 18 : 9, e.big ? 20 : 13, e.big ? 1.6 : 1);
        foam.add(e.x, e.y, 1, e.big ? 9 : 4.5, 2.2, 0.8);
        foam.add(e.x, e.y, 0.5, e.big ? 12 : 6.5, 1.3, 0.7, DECAL.ring);
        break;
      case 'hit':
        if (e.on === 'ship') {
          burst(e.x, h + 5, e.y, 9, { speed: 13, color: [0.32, 0.2, 0.1], life: 0.9, size: 0.45 });
          particles.add(e.x, h + 5, e.y, 0, 2, 0, { life: 0.16, size: 2.4, grow: 2, color: [7, 3, 0.8], glow: 1, fade: 0.01 });
          particles.add(e.x, h + 5.5, e.y, 0, 3, 0, { life: 1.3, size: 2, grow: 3.5, color: [0.3, 0.27, 0.24], alpha: 0.5, drag: 0.6 });
        } else if (e.on === 'stone') {
          burst(e.x, h + 9, e.y, 8, { speed: 11, color: [0.55, 0.52, 0.46], life: 1, size: 0.5 });
          particles.add(e.x, h + 9, e.y, 0, 2, 0, { life: 1.6, size: 2.5, grow: 4, color: [0.6, 0.57, 0.5], alpha: 0.5, drag: 0.5 });
        } else {
          burst(e.x, h + 8, e.y, 10, { speed: 12, color: [0.12, 0.02, 0.1], life: 0.9, size: 0.7 });
          particles.add(e.x, h + 8, e.y, 0, 2, 0, { life: 1.1, size: 2.5, grow: 3, color: [0.2, 0.03, 0.14], alpha: 0.6, drag: 0.6 });
        }
        break;
      case 'hurt':
        trauma = Math.min(1, trauma + 0.25 + e.dmg * 0.025);
        burst(e.x, h + 5, e.y, 10, { speed: 14, color: [0.2, 0.14, 0.08], life: 1, size: 0.5 });
        particles.add(e.x, h + 5, e.y, 0, 2, 0, { life: 0.18, size: 3, grow: 2, color: [7, 2.6, 0.6], glow: 1, fade: 0.01 });
        break;
      case 'sunk':
        blast(e.x, h + 6, e.y, e.kind === 'sloop' ? 1.2 : 2);
        burst(e.x, h + 6, e.y, 26, { speed: 20, color: [0.3, 0.19, 0.1], life: 1.6, size: 0.8 });
        foam.add(e.x, e.y, 6, 34, 7, 0.85);
        trauma = Math.min(1, trauma + 0.45 * near(e.x, e.y, 260));
        break;
      case 'mortar':
        shells.push({ x: e.x, z: e.y, tx: e.tx, tz: e.ty, t: 0, life: e.fuse });
        blast(e.x, 22, e.y, 0.7);
        break;
      case 'boom':
        spray(e.x, h, e.y, 34, 34, 2.2);
        particles.add(e.x, h + 2, e.y, 0, 5, 0, { life: 0.22, size: 7, grow: 2, color: [7, 3.2, 1], glow: 1, fade: 0.01 });
        foam.add(e.x, e.y, 4, e.r * 1.25, 3.4, 0.9);
        foam.add(e.x, e.y, 2, e.r * 1.7, 1.5, 0.8, DECAL.ring);
        trauma = Math.min(1, trauma + 0.6 * near(e.x, e.y, 150));
        break;
      case 'arm':
      case 'risen':
      case 'kraken':
        spray(e.x, h, e.y, e.type === 'arm' ? 22 : 46, e.type === 'arm' ? 24 : 34, e.type === 'arm' ? 1.5 : 2.6);
        foam.add(e.x, e.y, 3, e.type === 'arm' ? 15 : 44, 4, 0.9);
        if (e.type !== 'arm') trauma = Math.min(1, trauma + 0.5 * near(e.x, e.y, 300));
        break;
      case 'slam':
        for (let i = 0; i < 6; i++) {
          const d = (i / 5 - 0.6) * ARM.reach * 0.8;
          const x = e.x + Math.cos(e.dir) * d;
          const z = e.y + Math.sin(e.dir) * d;
          spray(x, h, z, 8, 26, 1.8);
          foam.add(x, z, 2, 13, 3.2, 0.85);
        }
        trauma = Math.min(1, trauma + 0.55 * near(e.x, e.y, 170));
        break;
      case 'severed':
        burst(e.x, h + 6, e.y, 26, { speed: 16, color: [0.15, 0.02, 0.12], life: 1.3, size: 1 });
        foam.add(e.x, e.y, 3, 18, 4, 0.8);
        break;
      case 'dive':
      case 'surface':
        foam.add(e.x, e.y, 8, e.big ? 46 : 32, 5, 0.8);
        spray(e.x, h, e.y, 20, 16, 1.6);
        break;
      case 'pickup':
        burst(e.x, h + 4, e.y, 18, { speed: 9, color: e.kind === 'chest' ? [6, 4.2, 0.9] : [1.2, 4.5, 2.2], life: 0.9, size: 0.5, gravity: 6, glow: 1, up: 1.2 });
        foam.add(e.x, e.y, 2, 9, 1.2, 0.7, DECAL.ring);
        break;
      case 'thud':
        burst(e.x, 6, e.y, 6, { speed: 8, color: [0.5, 0.46, 0.38], life: 0.9, size: 0.5 });
        break;
      case 'aground':
      case 'ram':
        burst(e.x, h + 4, e.y, 16, { speed: 15, color: [0.3, 0.2, 0.1], life: 1.1, size: 0.6 });
        spray(e.x, h, e.y, 14, 14, 1.4);
        trauma = Math.min(1, trauma + 0.5);
        break;
      case 'spit':
        burst(e.x + Math.cos(e.dir) * 14, h + 10, e.y + Math.sin(e.dir) * 14, 10, { speed: 9, color: [0.1, 0.03, 0.14], life: 0.8, size: 0.9 });
        break;
      default:
    }
  };

  // ── the camera: behind the ship, swung by `look` to face a broadside ──
  const cam = { yaw: 0, look: 0, x: 0, z: 0, set: false, t: 0, deck: 1 }; // deck: 1 on the quarterdeck (the title), 0 in the chase view
  const target = new THREE.Vector3();
  const deckAt = new THREE.Vector3();
  const deckTo = new THREE.Vector3();
  const noise = (t, s) => {
    const x = Math.sin(t * 12.9898 + s * 78.233) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1;
  };
  const moveCamera = (g, dt, view) => {
    const p = g.p;
    if (!cam.set) {
      cam.yaw = p.a;
      cam.x = p.x;
      cam.z = p.y;
      cam.look = view.look ?? 0;
      cam.set = true;
    }
    const k = 1 - Math.exp(-dt * 2.6);
    // the short way round
    let d = (p.a - cam.yaw) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    cam.yaw += d * k;
    cam.look += ((view.look ?? 0) - cam.look) * (1 - Math.exp(-dt * 5));
    cam.x += (p.x - cam.x) * (1 - Math.exp(-dt * 6));
    cam.z += (p.y - cam.z) * (1 - Math.exp(-dt * 6));
    const yaw = cam.yaw + cam.look;
    const side = Math.min(1, Math.abs(cam.look) / 1.3);
    // a tall screen sees less to either side: stand further off
    const tall = 1 + Math.max(0, 1.6 - camera.aspect) * 0.42;
    const back = lerp(74, 66, side) * (view.wide ? 1.2 : 1) * tall;
    const up = lerp(26, 21, side) * (view.wide ? 1.15 : 1) * tall;
    const sink = p.sunk ? Math.min(1, p.sunk / 3) : 0;
    camera.position.set(cam.x - Math.cos(yaw) * back, up + sink * 10, cam.z - Math.sin(yaw) * back);
    camera.position.y = Math.max(camera.position.y, sea.height(camera.position.x, camera.position.z) + 5);
    target.set(cam.x + Math.cos(yaw) * lerp(16, 34, side), 8 - sink * 6, cam.z + Math.sin(yaw) * lerp(16, 34, side));
    // The title screen stands on the quarterdeck, behind the captain's
    // shoulder; weighing anchor pulls back from there to the chase view.
    cam.deck += ((view.deck ? 1 : 0) - cam.deck) * (1 - Math.exp(-dt * (view.deck ? 3 : 0.9)));
    const helm = ships.get(p.id);
    const onDeck = helm?.captain && !p.sunk ? ease(clamp(cam.deck, 0, 1)) : 0;
    if (onDeck > 0.001) {
      deckAt.copy(helm.captain.eye).applyMatrix4(helm.tilt.matrixWorld);
      deckTo.copy(helm.captain.gaze).applyMatrix4(helm.tilt.matrixWorld);
      camera.position.lerp(deckAt, onDeck);
      target.lerp(deckTo, onDeck);
    }
    camera.lookAt(target);
    // a kick of the lens on a broadside, and the deck shaking under a hit
    fovKick = Math.max(0, fovKick - dt * 3.2);
    const fov = lerp(50 + (p.v / 30) * 4 + fovKick * fovKick * 2.2, 46, onDeck);
    if (Math.abs(camera.fov - fov) > 0.02) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    trauma = Math.max(0, trauma - dt * 1.3);
    if (trauma > 0 && !view.calm) {
      cam.t += dt;
      const s = trauma * trauma;
      camera.position.x += noise(cam.t * 31, 1) * s * 1.1;
      camera.position.y += noise(cam.t * 31, 2) * s * 0.9;
      camera.rotation.z += noise(cam.t * 31, 3) * s * 0.035;
    }
  };

  // ── a frame ──
  const tmp = new THREE.Vector3();
  const cost = { sim: 0, draw: 0 }; // milliseconds a frame, smoothed, for the diagnostics
  renderer.info.autoReset = false; // count a whole frame, every pass of it
  const render = (g, ms, view = {}) => {
    if (stage.disposed) return;
    const t0 = performance.now();
    renderer.info.reset();
    const dt = Math.min(0.05, ms / 1000);
    if (g !== lastGame) {
      // a new game: clear the decks
      for (const o of ships.values()) drop(o);
      for (const o of loot.values()) drop(o);
      for (const o of armObjs.values()) drop(o);
      ships.clear();
      loot.clear();
      armObjs.clear();
      shells.length = 0;
      particles.clear();
      foam.clear();
      cam.set = false;
      lastGame = g;
    }
    const chapter = CHAPTERS[g.chapter].id;
    wind.set(Math.cos(g.wind.a) * 6, 0, Math.sin(g.wind.a) * 6);

    for (const e of g.events) onEvent(e, g);

    moveCamera(g, dt, view);
    sea.update(dt, camera, chapter === 'kraken' ? 1.3 : chapter === 'cursed' ? 1.1 : 0.85);
    sun.target.position.set(g.p.x, 0, g.p.y);
    sun.position.copy(sun.target.position).addScaledVector(SUN, 320);

    decals.begin();

    // you and the navy
    const live = new Set();
    for (const s of [g.p, ...g.ships]) {
      live.add(s.id);
      let o = ships.get(s.id);
      if (o?.stand && models.has(o.spec.model)) {
        drop(o);
        o = null;
      }
      if (!o) {
        o = makeShip(s);
        if (!o) continue; // its model hasn't landed yet
        ships.set(s.id, o);
      }
      poseShip(o, s, dt);
      if (o.captain) {
        // the captain: the wheel over with her helm, his eyes ahead, swung the way she turns
        const c = o.captain;
        c.ahead.copy(c.sight);
        c.ahead.z = -s.rudder * 16; // (his left is her +z: a turn to starboard is to his right)
        o.tilt.updateWorldMatrix(true, false);
        o.tilt.localToWorld(c.ahead);
        c.body.update(dt, { rudder: s.sunk ? 0 : s.rudder, ahead: c.ahead });
      }
      trail(o, s, dt, s.max);
      if (!s.sunk && s.under < 0.3) {
        // where the hull meets the water: froth round it, and its shade under it
        decals.put(DECAL.foam, s.x, s.y, s.beam * 0.92, s.len * 0.62, s.a - Math.PI / 2, 0.86, 0.92, 0.94, 0.3 + 0.4 * Math.min(1, s.v / 22));
        decals.put(DECAL.shade, s.x, s.y, s.beam * 0.8, s.len * 0.56, s.a - Math.PI / 2, 0, 0.02, 0.035, 0.6);
      }
      if (s.sunk && s.sunk < 5 && Math.random() < dt * 9) foam.add(s.x + (Math.random() - 0.5) * s.len * 0.7, s.y + (Math.random() - 0.5) * s.len * 0.7, 2, 9, 2.5, 0.7);
    }
    for (const [id, o] of ships)
      if (!live.has(id)) {
        drop(o);
        ships.delete(id);
      }
    // what the captain makes of what's happened (./jack.js), his eyes on it
    const helm = ships.get(g.p.id)?.captain?.body;
    if (helm) for (const e of g.events) helm.hear(e, g.p, seaPoint);
    // one of them about to fire: the arc its guns cover, in red, while it aims
    for (const s of g.ships) {
      if (!s.aim || s.sunk) continue;
      const dir = s.a + (s.aim.side * Math.PI) / 2;
      const half = TIDE.range / 2;
      const ox = s.x + Math.cos(dir) * s.beam * 0.5;
      const oz = s.y + Math.sin(dir) * s.beam * 0.5;
      decals.put(DECAL.arc, ox + Math.cos(dir) * half, oz + Math.sin(dir) * half, half, half, dir - Math.PI / 2, 2.2, 0.3, 0.15, 0.55, 1 - s.aim.t);
    }

    // the arcs your guns cover, lit when something's in them
    const p = g.p;
    if (!p.sunk && g.status === 'sail' && !view.attract) {
      const f = fitted(g);
      const b = bearing(g);
      for (const side of [-1, 1]) {
        const at = side < 0 ? b.port : b.star;
        const load = p.reload[side < 0 ? 0 : 1];
        const ready = load <= 0;
        const dir = p.a + (side * Math.PI) / 2;
        const ox = p.x + Math.cos(dir) * p.beam * 0.5;
        const oz = p.y + Math.sin(dir) * p.beam * 0.5;
        const half = f.range / 2;
        const aimed = view.side === side || !view.side;
        const lit = at && ready ? 1 : 0.25;
        const c = at && ready ? [1.6, 1.15, 0.35] : ready ? [0.9, 0.95, 1] : [1, 0.45, 0.3];
        decals.put(DECAL.arc, ox + Math.cos(dir) * half, oz + Math.sin(dir) * half, half, half, dir - Math.PI / 2, c[0], c[1], c[2], (aimed ? 0.6 : 0.3) * (ready ? 1 : 0.5), lit);
        if (at && ready) {
          const r = at.m.r * 1.25;
          decals.put(DECAL.mark, at.m.x, at.m.y, r, r, sea.time, 1.7, 1.2, 0.35, 0.7, 0);
        }
      }
    }

    // what's about to land
    for (const z of g.zones) {
      const k = 1 - z.t / z.t0;
      if (z.kind === 'mortar') decals.put(DECAL.mark, z.x, z.y, z.r, z.r, 0, 2.2, 0.25, 0.12, 0.85, k);
      else if (z.kind === 'slam') decals.put(DECAL.strip, z.x + Math.cos(z.dir) * z.len * 0.5, z.y + Math.sin(z.dir) * z.len * 0.5, z.r, z.len * 0.5, z.dir - Math.PI / 2, 2.2, 0.25, 0.12, 0.8, k);
      else {
        // something coming up: the water boils
        decals.put(DECAL.foam, z.x, z.y, z.r * (0.6 + 0.4 * k), z.r * (0.6 + 0.4 * k), sea.time * 0.7, 0.8, 0.95, 0.92, 0.5 + 0.4 * k);
        if (Math.random() < dt * (10 + 30 * k)) {
          const a = Math.random() * 6.283;
          const d = Math.random() * z.r * 0.8;
          spray(z.x + Math.cos(a) * d, sea.height(z.x, z.y), z.y + Math.sin(a) * d, 2, 7 + 9 * k, 1);
        }
      }
    }

    // the fort, once it's been silenced
    const f = g.fort;
    if (fortObj && f) {
      const hit = f.hit > 0 ? (f.hit / 0.3) ** 2 : 0;
      for (const m of fortObj.mats) m.emissive.setRGB(hit * 0.3, hit * 0.12, hit * 0.04);
      if (f.hp <= 0) {
        fortObj.smoke += dt * 10;
        while (fortObj.smoke > 1) {
          fortObj.smoke -= 1;
          const dark = 0.05 + Math.random() * 0.07;
          const x = f.x + (Math.random() - 0.5) * 40;
          const z = f.y + (Math.random() - 0.5) * 40;
          particles.add(x, 20, z, 0, 7 + Math.random() * 5, 0, { life: 4 + Math.random() * 2, size: 4, grow: 4.5, color: [dark, dark, dark], alpha: 0.6, drag: 0.2 });
          if (Math.random() < 0.5) particles.add(x, 19, z, 0, 7, 0, { life: 0.7, size: 2.4, grow: 1.6, color: [5, 1.8, 0.3], glow: 1, drag: 0.4 });
        }
      }
    }

    // chests and casks
    live.clear();
    for (const c of g.pickups) {
      live.add(c.id);
      let o = loot.get(c.id);
      if (!o) {
        const root = new THREE.Group();
        if (c.kind === 'chest') {
          const made = copy('chest', 11, 0.14);
          if (!made) continue;
          root.add(made.model);
          o = { root, mats: made.mats };
        } else {
          const cask = new THREE.Mesh(caskGeo, caskMat);
          cask.rotation.z = Math.PI / 2;
          cask.castShadow = true;
          cask.userData.shared = true;
          root.add(cask);
          o = { root, mats: [] };
        }
        o.spin = Math.random() * 6.283;
        scene.add(root);
        loot.set(c.id, o);
      }
      const h = sea.height(c.x, c.y);
      o.root.position.set(c.x, h + (c.kind === 'chest' ? 0 : 0.6), c.y);
      o.root.rotation.set(Math.sin(sea.time * 1.3 + o.spin) * 0.12, o.spin + sea.time * 0.25, Math.cos(sea.time * 1.1 + o.spin) * 0.12);
      // a ring on the water so it can be found, gold for the ones the chapter wants
      const beat = 0.5 + 0.5 * Math.sin(sea.time * 3 + o.spin);
      if (c.quest) decals.put(DECAL.ring, c.x, c.y, 13 + beat * 3, 13 + beat * 3, 0, 1.9, 1.35, 0.4, 0.8, 0.75);
      else decals.put(DECAL.ring, c.x, c.y, 7 + beat * 1.5, 7 + beat * 1.5, 0, c.kind === 'chest' ? 1.6 : 0.5, 1.2, c.kind === 'chest' ? 0.4 : 0.8, 0.5, 0.8);
      if (c.quest && Math.random() < dt * 5) particles.add(c.x + (Math.random() - 0.5) * 5, h + 3, c.y + (Math.random() - 0.5) * 5, 0, 5 + Math.random() * 5, 0, { life: 1.4, size: 0.45, grow: 0.4, color: [6, 4.2, 0.9], glow: 1, drag: 0.1 });
    }
    for (const [id, o] of loot)
      if (!live.has(id)) {
        drop(o);
        loot.delete(id);
      }

    // the kraken's arms
    live.clear();
    for (const a of g.arms) {
      live.add(a.id);
      let o = armObjs.get(a.id);
      if (!o) {
        const made = copy('tentacle', 9.5, 0.04);
        if (!made) continue;
        // the model stands 4.8 times as tall as it is wide
        const root = new THREE.Group();
        const lean = new THREE.Group();
        made.model.rotation.y = Math.random() * 6.283;
        lean.add(made.model);
        root.add(lean);
        scene.add(root);
        // a chain, not a pole: bent along its length (./arm.js, ./bend.js),
        // the lean group turning only where it leaves the water
        o = { root, lean, mats: made.mats, height: made.height, sway: Math.random() * 6.283, chain: createArm({ seed: a.id }), bend: bendArm(made.model, lean), struck: 0 };
        armObjs.set(a.id, o);
      }
      const h = sea.height(a.x, a.y);
      let rise = 1;
      let fall = 0;
      let curl = 1; // the hook at its tip
      let droop = 0; // laid on the water, its end bent down into it
      if (a.st === 'warn') rise = 0;
      else if (a.st === 'rise') rise = ease(1 - a.t / ARM.rise);
      else if (a.st === 'hold') {
        // drawn back, before it comes down, the hook cocked
        const k = ease(1 - a.t / ARM.hold);
        fall = -0.22 * k;
        curl = 1 + 0.3 * k;
      } else if (a.st === 'slam') {
        const k = (1 - a.t / ARM.slam) ** 2;
        fall = lerp(-0.22, 1.45, k);
        curl = 1.3 * (1 - k);
        droop = k;
      } else if (a.st === 'down') {
        fall = 1.45;
        curl = 0;
        droop = 1;
      } else if (a.st === 'sink') {
        // going back down: still laid out, or (cut off) limp
        fall = a.hp > 0 ? 1.45 : 0.3;
        curl = a.hp > 0 ? 0 : 0.6;
        droop = a.hp > 0 ? 1 : 0;
        rise = a.t / ARM.sink;
      }
      // struck: it recoils
      if (a.hit > o.struck + 0.05) o.chain.flinch(0.7);
      o.struck = a.hit;
      const pose = o.chain.step(dt, { fall, curl, droop, t: sea.time });
      o.bend.set(pose);
      o.root.visible = rise > 0.01;
      o.root.position.set(a.x, h - (1 - rise) * o.height * 1.02, a.y);
      o.root.rotation.y = -a.dir;
      o.lean.rotation.z = -pose.base;
      o.lean.rotation.x = Math.cos(sea.time * 1.9 + o.sway) * 0.05;
      const hit = a.hit > 0 ? (a.hit / 0.3) ** 2 : 0;
      for (const m of o.mats) m.emissive.setRGB(hit * 0.5, hit * 0.08, hit * 0.08);
      if (rise > 0.2 && Math.abs(fall) < 0.5) decals.put(DECAL.foam, a.x, a.y, 10, 10, sea.time, 0.86, 0.92, 0.94, 0.7);
    }
    for (const [id, o] of armObjs)
      if (!live.has(id)) {
        drop(o);
        armObjs.delete(id);
      }

    // and its head
    const k = g.kraken;
    if (k && !krakenObj && models.has('kraken')) {
      const made = copy('kraken', 46, 0);
      const root = new THREE.Group();
      root.add(made.model);
      scene.add(root);
      krakenObj = { root, mats: made.mats, height: made.height };
    }
    if (krakenObj) {
      const o = krakenObj;
      o.root.visible = Boolean(k) && k.up > 0.01;
      if (k && o.root.visible) {
        const up = ease(clamp(k.up, 0, 1));
        o.root.position.set(k.x, sea.height(k.x, k.y) - o.height * (1 - up * 0.82) + Math.sin(sea.time * 1.4) * 1.2, k.y);
        o.root.rotation.set(Math.sin(sea.time * 0.9) * 0.05, Math.PI / 2 - k.a, Math.cos(sea.time * 1.1) * 0.05 + (k.phase === 'dead' ? (1 - up) * 0.7 : 0));
        const hit = k.hit > 0 ? (k.hit / 0.3) ** 2 : 0;
        for (const m of o.mats) m.emissive.setRGB(hit * 0.5, hit * 0.08, hit * 0.08);
        decals.put(DECAL.foam, k.x, k.y, 34, 34, sea.time * 0.3, 0.86, 0.92, 0.94, 0.75 * up);
      }
    }

    // shot in the air
    balls.begin();
    for (const b of g.balls) {
      const u = clamp(b.t / b.life, 0, 1);
      const y = sea.height(b.x, b.y) * (u * u) + 5 * (1 - u) + (b.ink ? 9 : 2.2 + b.life * 4.5) * 4 * u * (1 - u) * (b.ink ? 0.55 : 0.5);
      balls.put(b.x, y, b.y, b.ink ? 'ink' : b.hot ? 'hot' : 'iron');
      if (b.ink && Math.random() < dt * 30) particles.add(b.x, y, b.y, 0, 0, 0, { life: 0.7, size: 2, grow: 0.4, color: [0.1, 0.02, 0.14], alpha: 0.6, drag: 1 });
    }
    for (let i = shells.length - 1; i >= 0; i--) {
      const s = shells[i];
      s.t += dt;
      const u = s.t / s.life;
      if (u >= 1) {
        shells.splice(i, 1);
        continue;
      }
      const x = lerp(s.x, s.tx, u);
      const z = lerp(s.z, s.tz, u);
      const y = 22 * (1 - u) + 150 * 4 * u * (1 - u) * 0.5;
      balls.put(x, y, z, 'iron');
      if (Math.random() < dt * 40) particles.add(x, y, z, 0, 0, 0, { life: 0.9, size: 0.9, grow: 2.4, color: [0.5, 0.48, 0.45], alpha: 0.4, drag: 1 });
    }
    balls.end();

    // everyone else online
    ghosts.update(view.travellers ?? [], sea.time, dt);

    foam.draw(dt, decals);
    decals.end();
    particles.update(dt, wind);
    const t1 = performance.now();
    // (the ships and the crews that came since, taken on now and then)
    if (houseFrames++ % 60 === 0) house.follow({ adopt: true });
    stage.render(ms);
    cost.sim += (t1 - t0 - cost.sim) * 0.05;
    cost.draw += (performance.now() - t1 - cost.draw) * 0.05;
  };

  // a cask of rum: the one thing here made of plain shapes
  const caskGeo = new THREE.CylinderGeometry(1.5, 1.5, 3.4, 14);
  const caskMat = new THREE.MeshStandardMaterial({ color: 0x6b4526, roughness: 0.8, metalness: 0.05 });

  // where a place on the sea is on the screen (0…1 each way), for the HUD
  const project = (x, y, up = 10) => {
    tmp.set(x, up, y).project(camera);
    return { x: tmp.x * 0.5 + 0.5, y: 0.5 - tmp.y * 0.5, ahead: tmp.z < 1 };
  };

  const dispose = () => {
    disposed = true;
    caskGeo.dispose();
    caskMat.dispose();
    ghosts.dispose();
    // the prepare's twins in the house look: their own materials (the geometry's the models')
    for (const twin of twins) twin.traverse((o) => o.isMesh && [].concat(o.material).forEach((m) => m.dispose()));
    for (const m of models.values()) scene.add(m.root); // so the stage frees the originals too
    sea.dispose();
    stage.dispose();
  };

  placeIsles();
  onProgress?.(1, 'Ready');

  // Everything sent to the graphics chip behind the page's loading screen
  // before the first frame (lib/three/gpuWork's prepareScene): the rest of
  // the models in (eight seconds at most), the islands placed, the passes'
  // shaders, then every picture, shader and one draw of it all, a slice at a
  // time. A ship's copy starts in its model's own shader and takes on the
  // house look a moment later (house.follow), so both are made: the models as
  // they are, and a twin of each in the look, kept so its shader is too.
  const twins = [];
  const prepare = async (onReport, { alive = () => true } = {}) => {
    const on = () => alive() && !disposed && !stage.lost && !stage.disposed;
    // (a failure here must not fail the whole game: the world stands, its
    // shaders made as it's drawn)
    try {
      onReport?.(0, 'load');
      await settle(laterJob, 8000);
      if (!on()) return;
      placeIsles();
      const sources = [...models.values()].map((m) => m.root);
      if (!twins.length)
        for (const root of sources) {
          const twin = cloneSkinned(root);
          twin.traverse((o) => {
            if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
          });
          house.adopt(twin);
          twins.push(twin);
        }
      await settle(stage.precompile(null), 8000);
      if (!on()) return;
      await prepareScene({
        renderer,
        roots: [scene, ...sources, ...twins],
        scene,
        camera,
        target: soft ? null : stage.composer.readBuffer,
        render: () => stage.render(0),
        onProgress: onReport,
        alive: on,
      });
    } catch (err) {
      if (import.meta.env.DEV) console.warn('Tide: prepare failed', err);
    }
  };

  return {
    // everything onto the graphics chip behind the page's loading screen
    prepare,
    render,
    project,
    dispose,
    resize: stage.resize,
    info: () => ({ ...renderer.info.render, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, quality: stage.quality, particles: particles.count }),
    cpu: () => ({ sim: Number(cost.sim.toFixed(2)), draw: Number(cost.draw.toFixed(2)) }),
    get loaded() {
      return [...models.keys()];
    },
    get yaw() {
      return cam.yaw;
    },
  };
}

export { TIDE };

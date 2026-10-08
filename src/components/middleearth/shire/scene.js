// Hobbiton, the world, in WebGL: the Hill with Bag End on top and Bagshot
// Row under it, the Party Field and its great tree, the pond and the mill,
// the bridge to the Green Dragon, Farmer Maggot's field and his dogs, the
// East Road and the old tree by it, all on rolling green under a long
// golden afternoon that turns to the night of the party. Made in code
// (./props.js, ./ground.js, ./sky.js, ./fx.js), so nothing is downloaded.
//
// It draws what the component hands it every frame (the hobbit, the
// activity in hand, the camera) and decides nothing; ./rules.js has the rules.
//
// createShireWorld(canvas) returns { render(state, ms), fx(type, data),
// aim(kind, ndcX, ndcY), screenOf(kind, id), resize, dispose, lost, info }.

import * as THREE from 'three';
import { createStage, disposeTree } from '../../../lib/stage3d';
import { bake, dotTexture, farTree } from '../towns/bake';
import { createGhosts } from '../towns/ghosts';
import { budget, device } from '../../../lib/device';
import { createHouse } from '../../../lib/three/house';
import { dress } from '../../../lib/three/core';
import { debugOn, debugPanel } from '../../../lib/debugPanel';
import { pose } from '../mapFigures';
import { createShireKit } from './props';
import { loadDoorLeaf } from './models';
import { instances, makeFlowers, makeTerrain, makeWater, shireGroundMap } from './ground';
import { createGrass } from '../../../lib/three/grass';
import { createWind } from '../../../lib/three/wind';
import { floorShadow } from '../../../lib/three/grounding';
import { FIGURE, groundTown } from '../towns/grounded';
import { MOODS, makeAtmosphere, makeSky } from './sky';
import { SHIRE_CORE } from './dress';
import { shireTuning } from './tune';
import { createFx } from './fx';
import { calm, dance, makePerson, sit } from './people';
import { INSIDE, buildInside } from './inside';
import {
  BAG_END,
  BARN,
  BRIDGE,
  CART,
  CAST,
  COLLIDERS,
  DOG_ROUNDS,
  FENCES,
  FIELD,
  HEDGES,
  HOLES,
  HOLLOW,
  HUNT,
  INN,
  MILL,
  MUSHROOMS,
  PARTY_TREE,
  PAVILION,
  POND,
  RIDER,
  RINGS,
  ROOT_TREE,
  SCARECROW,
  SPOON_SPOTS,
  SPOTS,
  TREES,
  WORLD,
  bridgeY,
  groundY,
  height,
  hisAt,
  inWater,
  newFlock,
  riderAt,
  seeded,
  spoonLeft,
  stepFlock,
} from './rules';
import { attend, castDo, releaseCast, tickCast } from '../cast3d';
import { nextFrame as breathe } from '../../../lib/three/gpuWork';

const val = (x, ...args) => (typeof x === 'function' ? x(...args) : x);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// a creature or rider faces +x; turn it to face `face` (see rules.js)
const faceTo = (obj, face) => {
  obj.rotation.y = face;
};

export async function createShireWorld(canvas, { onLost } = {}) {
  const dev = device();
  const tier = dev.tier;
  const fit = budget();
  const stage = createStage(canvas, { shadows: true, fov: 50, near: 0.1, far: 520, bloom: { strength: 0.5, radius: 0.55, threshold: 0.9 }, onLost });
  stage.grade({ contrast: 0.1, saturation: 1.1, vignette: 0.22, grain: 0.012, shadow: [0.0, 0.01, 0.03], high: [0.03, 0.015, 0] });
  const { scene, camera, renderer } = stage;
  renderer.info.autoReset = false; // counted over the whole frame, every pass
  // the house look (lib/three/house): one shadow colour and a fog that is
  // the sky, on everything, under the house tone mapper; the moods in
  // ./sky.js move it with the time of day
  const house = createHouse();
  renderer.toneMapping = house.toneMapping;
  scene.fog = new THREE.Fog(0xe8dcb8, 46, 210);
  const many = tier === 'high' ? 1 : tier === 'mid' ? 0.55 : 0.28;

  // ── light ──
  const hemi = new THREE.HemisphereLight(0xcfe2ff, 0x6a7a3a, 1.0);
  const sun = new THREE.DirectionalLight(0xffe2b0, 2.6);
  sun.castShadow = renderer.shadowMap.enabled;
  const map = fit.shadowMap ?? 1024;
  sun.shadow.mapSize.set(map, map);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 160 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(hemi, sun, sun.target);

  // everything outside, so it can all be put away while you're in Bag End;
  // the buildings and props that never move go in `statics`, to be merged
  const outdoors = new THREE.Group();
  const statics = new THREE.Group();
  scene.add(outdoors);
  outdoors.add(statics);

  const sky = makeSky(400);
  scene.add(sky.dome);
  const water = makeWater();
  outdoors.add(water.group);
  const atmosphere = makeAtmosphere({ sky, sun, hemi, fog: scene.fog, water: water.material, stage, house });

  // (a frame's breath between the build's big steps, so the loading
  // screen keeps moving: made in one go, it held the page for seconds)
  await breathe();
  // ── the ground ──
  // (one map of its colour, its grass and its height: the ground, the grass
  // and the light it bounces up onto everything low all read it)
  const groundMap = shireGroundMap({ size: tier === 'high' ? 512 : tier === 'mid' ? 384 : 256 });
  house.ground(groundMap);
  const terrain = makeTerrain(renderer, { seg: tier === 'high' ? 220 : tier === 'mid' ? 160 : 110, map: groundMap });
  outdoors.add(terrain);
  // one wind for the grass, the flowers and the oaks' crowns (lib/three/wind),
  // and Bruno's grass: a triangle a blade, the ground's own colour, in a
  // patch that goes wherever you look (lib/three/grass)
  const wind = createWind({ strength: 0.45, angle: 0.6 * Math.PI });
  const grass = createGrass({ ground: groundMap, wind, side: tier === 'high' ? 280 : tier === 'mid' ? 200 : 120, size: 44 });
  outdoors.add(grass.mesh);

  const kit = createShireKit(renderer);
  const mats = kit.mats ?? {};
  // the site's core kit of surfaces on the Shire's stone, wood, plaster,
  // bark and turf (lib/three/core): their own painted pictures folded into
  // their colours, the same scanned grain at the same scale as every world
  dress(mats, SHIRE_CORE, { strength: 0.4, normal: 0.8 });
  const fallback = (colour) => new THREE.MeshStandardMaterial({ color: colour, roughness: 0.9 });
  const flowerGeo = val(kit.flower);
  if (flowerGeo) outdoors.add(makeFlowers(flowerGeo, mats.flower ?? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), Math.round(1400 * many), wind));

  await breathe();
  // ── the buildings ──
  const chimneys = [];
  const placed = (part, x, z, { y = null, turn = 0, sink = 0.12 } = {}) => {
    const at = part.doorAt ? V(part.doorAt.x, 0, part.doorAt.z).applyAxisAngle(V(0, 1, 0), turn) : V(0, 0, 0);
    part.group.position.set(x, (y ?? height(x + at.x, z + at.z)) - sink, z);
    part.group.rotation.y = turn;
    statics.add(part.group);
    part.group.updateMatrixWorld(true);
    if (part.chimneyTop) chimneys.push(part.chimneyTop.clone().applyMatrix4(part.group.matrixWorld));
    return part;
  };
  const bagEnd = placed(kit.bagEnd(), BAG_END.x, BAG_END.z);
  // Bag End's door is a model (./models.js): the built leaf stands until it's come
  const doorModel = tier !== 'low' && !dev.saveData && bagEnd.door?.userData.leaf ? bagEnd.door : null;
  let gone = false;
  if (doorModel)
    loadDoorLeaf(doorModel.userData.leaf.r, { anisotropy: fit.aniso }).then((leaf) => {
      if (!leaf) return;
      if (gone) return disposeTree(leaf);
      for (const built of [...doorModel.children]) {
        built.removeFromParent();
        built.geometry?.dispose();
      }
      leaf.position.set(doorModel.userData.leaf.x, 0, doorModel.userData.leaf.z);
      house.adopt(leaf);
      doorModel.add(leaf);
    });
  const benchAt = bagEnd.bench ? bagEnd.bench.clone().applyMatrix4(bagEnd.group.matrixWorld) : V(BAG_END.x + 4.4, height(BAG_END.x + 4.4, BAG_END.z + 5.4) + 0.45, BAG_END.z + 5.4);
  for (const h of HOLES) placed(kit.hobbitHole({ door: h.door, radius: h.r, seed: h.seed }), h.x, h.z);
  const mill = placed(kit.mill(), MILL.x, MILL.z, { y: height(MILL.x, MILL.z), sink: 0.05 });
  placed(kit.greenDragon(), INN.x, INN.z, { y: height(INN.x, INN.z), turn: Math.PI, sink: 0.05 });
  const bridge = kit.bridge({ span: BRIDGE.z1 - BRIDGE.z0, width: BRIDGE.w, rise: BRIDGE.rise });
  bridge.group.position.set(BRIDGE.x, bridgeY(BRIDGE.z0) - 0.02, (BRIDGE.z0 + BRIDGE.z1) / 2);
  statics.add(bridge.group);
  placed(kit.partyTree(), PARTY_TREE.x, PARTY_TREE.z, { y: height(PARTY_TREE.x, PARTY_TREE.z), sink: 0.1 });
  placed(kit.pavilion(), PAVILION.x, PAVILION.z, { y: height(PAVILION.x, PAVILION.z), sink: 0.02 });
  placed(kit.cart(), CART.x, CART.z, { y: height(CART.x, CART.z), turn: 0, sink: 0 });
  if (kit.barn) placed(kit.barn(), BARN.x, BARN.z, { y: height(BARN.x, BARN.z), turn: Math.PI / 2, sink: 0.05 });
  const rootTree = kit.rootTree();
  {
    // turned so the hollow under its roots faces the road, and placed so the
    // hollow is where the rules say
    const h = rootTree.hollow ?? V(0, 0, 1.8);
    rootTree.group.rotation.y = Math.PI;
    rootTree.group.position.set(HOLLOW.x + h.x, height(ROOT_TREE.x, ROOT_TREE.z) - 0.1, HOLLOW.z + h.z);
    statics.add(rootTree.group);
  }
  // the party's light at night (the kit's lanterns glow; these light the grass)
  const lampA = new THREE.PointLight(0xffb060, 0, 22, 1.6);
  lampA.position.set(PAVILION.x, 3.2, PAVILION.z);
  const lampB = new THREE.PointLight(0xffb060, 0, 18, 1.6);
  lampB.position.set(PARTY_TREE.x, 3.6, PARTY_TREE.z + 2);
  const innLamp = new THREE.PointLight(0xffa850, 0, 14, 1.8);
  innLamp.position.set(INN.x, 2.2, INN.z - INN.d / 2 - 1.2);
  const doorLamp = new THREE.PointLight(0xffb870, 0, 10, 1.8);
  doorLamp.position.set(BAG_END.x, height(BAG_END.x, BAG_END.z + BAG_END.r) + 2, BAG_END.z + BAG_END.r + 1);
  scene.add(lampA, lampB, innLamp, doorLamp);

  await breathe();
  // ── the dressing ──
  const prop = (name, x, z, turn = 0, ...args) => {
    if (!kit[name]) return null;
    const p = kit[name](...args);
    p.group.position.set(x, height(x, z), z);
    p.group.rotation.y = turn;
    statics.add(p.group);
    return p;
  };
  prop('scarecrow', SCARECROW.x, SCARECROW.z, 0.3);
  prop('signpost', 9.2, -6.6, 0.4, ['Bag End', 'The Party Field', 'Bywater', 'The East Road']);
  prop('signpost', 13.8, 8.6, -0.2, ['The Green Dragon', 'Hobbiton']);
  prop('signpost', -28.4, -1.2, 0.2, ['Farmer Maggot’s', 'The Mill']);
  prop('signpost', 46.5, -6.4, 0.9, ['Bree', 'Hobbiton']);
  prop('washingLine', -20.5, -13.2, 0.2, 5);
  prop('wheelbarrow', -22.8, -8.6, 1.1);
  for (const [x, z] of [[-47, -13.5], [-48.6, -12.2], [-46, -11.6]]) prop('beehive', x, z, x);
  for (const [x, z] of [[-52, 20.5], [-50.2, 19.6], [-53.4, 18.8]]) prop('hayBale', x, z, x * 0.7);
  for (const [x, z] of [[18.6, 29.6], [19.4, 30.4], [9.4, 30.3]]) prop('barrel', x, z, x);
  for (const [x, z, t] of [[-3, 4.8, 0], [5.5, -14.5, 0.4], [33, -14, -1.2]]) prop('bench', x, z, t);
  for (const [x, z] of [[-20, -2], [0, -6], [16, -6], [32, -2], [12.9, 9], [12.9, 22]]) prop('lampPost', x, z, 0);

  // trees: three oaks, instanced, in the world and on the hills round it
  const oaks = val(kit.oaks) ?? [];
  const rand = seeded(5);
  const rim = [];
  const rimCount = Math.round(260 * many);
  for (let i = 0, tries = 0; i < rimCount && tries < 4000; tries++) {
    const a = rand() * Math.PI * 2;
    const r = WORLD.radius + 4 + Math.pow(rand(), 0.8) * (WORLD.edge - WORLD.radius - 8);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (inWater(x, z) || height(x, z) < 0.3) continue;
    rim.push({ x, z, s: 0.9 + rand() * 0.8, kind: Math.floor(rand() * 3), turn: rand() * 6.28 });
    i += 1;
  }
  if (mats.crown) wind.sway(mats.crown, { strength: 0.5, height: 6 });
  oaks.forEach((oak, k) => {
    const list = TREES.filter((t) => t.kind % oaks.length === k).map((t) => ({ x: t.x, z: t.z, y: height(t.x, t.z) - 0.1, s: t.s, turn: t.turn }));
    if (!list.length) return;
    // (only the sharpest tier has the trees cast shadows)
    outdoors.add(instances(oak.trunk, mats.trunk ?? fallback(0x5a4028), list, { shadow: tier === 'high' }));
    outdoors.add(instances(oak.crown, mats.crown ?? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), list, { shadow: tier === 'high' }));
  });
  // the woods on the hills round about: far off, so a few blobs of leaf will do
  const far = farTree();
  const rimList = rim.map((t) => ({ x: t.x, z: t.z, y: height(t.x, t.z) - 0.2, s: t.s * 1.1, turn: t.turn }));
  // (the far rim of trees in matcaps made from the Shire's own light: seen
  // only in passing, one texture fetch and no lights for each: ../towns/grounded.js)
  const rimTrees = instances(far, new THREE.MeshLambertMaterial({ vertexColors: true }), rimList, { shadow: false });
  outdoors.add(rimTrees);

  // hedges along the lane
  const hedgeGeo = val(kit.hedge);
  if (hedgeGeo) {
    const list = [];
    for (const [x0, z0, x1, z1] of HEDGES) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(len / 2.4));
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n;
        const x = x0 + (x1 - x0) * k;
        const z = z0 + (z1 - z0) * k;
        list.push({ x, z, y: height(x, z) - 0.05, sx: (len / n) * 1.06, sy: 0.9 + rand() * 0.3, sz: 1, turn: -Math.atan2(z1 - z0, x1 - x0) });
      }
    }
    outdoors.add(instances(hedgeGeo, mats.hedge ?? fallback(0x3f6a2a), list));
  }
  // Maggot's fence: posts and two rails between
  const postGeo = val(kit.fencePost);
  const railGeo = val(kit.fenceRail);
  if (postGeo && railGeo) {
    const posts = [];
    const rails = [];
    for (const [x0, z0, x1, z1] of FENCES) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(len / 2.4));
      const turn = -Math.atan2(z1 - z0, x1 - x0);
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        const z = z0 + ((z1 - z0) * i) / n;
        posts.push({ x, z, turn: turn + i });
        if (i < n) {
          const mx = x0 + ((x1 - x0) * (i + 0.5)) / n;
          const mz = z0 + ((z1 - z0) * (i + 0.5)) / n;
          for (const y of [0.45, 0.85]) rails.push({ x: mx, z: mz, y: height(mx, mz) + y, sx: len / n, s: 1, turn });
        }
      }
    }
    const wood = mats.fence ?? mats.wood ?? fallback(0x7a5a3a);
    outdoors.add(instances(postGeo, wood, posts), instances(railGeo, wood, rails));
  }
  // Maggot's crops, in rows
  const crops = val(kit.crops) ?? {};
  const rows = { cabbage: [], pumpkin: [], wheat: [] };
  for (let z = FIELD.z0 + 1.6; z < FIELD.z1 - 1; z += 1.25) {
    for (let x = FIELD.x0 + 1.2; x < FIELD.x1 - 1; x += 1.1) {
      if (Math.hypot(x - SCARECROW.x, z - SCARECROW.z) < 1.6) continue;
      if (MUSHROOMS.some((m) => Math.hypot(m.x - x, m.z - z) < 0.9)) continue;
      const kind = x < -42 ? 'wheat' : z > 33 ? 'pumpkin' : 'cabbage';
      // (thinner rows where the device can afford less)
      if (kind !== 'wheat' && rand() < 0.18) continue;
      if (rand() > Math.max(0.45, many)) continue;
      rows[kind].push({ x: x + (rand() - 0.5) * 0.25, z: z + (rand() - 0.5) * 0.2, s: 0.85 + rand() * 0.3, turn: rand() * 6.28 });
    }
  }
  for (const kind of ['cabbage', 'pumpkin', 'wheat']) if (crops[kind] && rows[kind].length) outdoors.add(instances(crops[kind], mats[kind] ?? fallback(0x6a9a3a), rows[kind], { shadow: kind !== 'wheat' }));

  // the buildings and props that never move, merged by material: a few
  // dozen draws instead of several hundred
  outdoors.add(bake(statics, [mill.wheel, doorModel])); // the door's built leaf stays its own, to be taken away

  // ── the mushrooms, glinting so they can be found ──
  const mushrooms = MUSHROOMS.map((m) => {
    const p = kit.mushroom();
    p.group.position.set(m.x, height(m.x, m.z), m.z);
    p.group.rotation.y = m.x * 3;
    p.group.scale.setScalar(1.6);
    outdoors.add(p.group);
    return p;
  });
  const glintGeo = new THREE.BufferGeometry();
  const glintPos = new Float32Array(MUSHROOMS.length * 3);
  MUSHROOMS.forEach((m, i) => glintPos.set([m.x, height(m.x, m.z) + 0.55, m.z], i * 3));
  glintGeo.setAttribute('position', new THREE.BufferAttribute(glintPos, 3));
  const glintMat = new THREE.PointsMaterial({ color: new THREE.Color(2.4, 2.1, 1.2), size: 0.5, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, map: dotTexture() });
  const glints = new THREE.Points(glintGeo, glintMat);
  outdoors.add(glints);

  // ── on the side: Bilbo's silver spoons, out only while Lobelia's after them ──
  const silver = new THREE.MeshStandardMaterial({ color: 0xeef0f6, metalness: 0.95, roughness: 0.16, emissive: 0x3a3e48, emissiveIntensity: 0.5 });
  const handleGeo = new THREE.BoxGeometry(0.34, 0.014, 0.036).translate(0.13, 0, 0);
  const bowlGeo = new THREE.SphereGeometry(0.065, 12, 8).scale(1.35, 0.32, 0.95).translate(-0.1, 0, 0);
  const spoons = SPOON_SPOTS.map((p, i) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(handleGeo, silver), new THREE.Mesh(bowlGeo, silver));
    g.position.set(p.x, groundY(p.x, p.z) + 0.06, p.z);
    g.rotation.set(0, i * 1.9, 0.18); // dropped, not laid
    g.scale.setScalar(2.4);
    g.visible = false;
    outdoors.add(g);
    return g;
  });
  const spoonGlintPos = new Float32Array(SPOON_SPOTS.length * 3);
  const spoonGlintGeo = new THREE.BufferGeometry();
  spoonGlintGeo.setAttribute('position', new THREE.BufferAttribute(spoonGlintPos, 3));
  const spoonGlintMat = new THREE.PointsMaterial({ color: new THREE.Color(1.9, 2.1, 2.6), size: 0.7, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, map: dotTexture() });
  outdoors.add(new THREE.Points(spoonGlintGeo, spoonGlintMat));

  await breathe();
  // ── the people ──
  const frodo = makePerson('frodo');
  outdoors.add(frodo.group);
  // other travellers, online, from other worlds (../towns/ghosts.js)
  const ghosts = createGhosts({ height: groundY });
  outdoors.add(ghosts.group);
  const people = {};
  for (const c of CAST) {
    const p = makePerson(c.look);
    p.group.position.set(c.x, height(c.x, c.z), c.z);
    faceTo(p.group, c.face);
    p.home = { x: c.x, z: c.z, face: c.face };
    outdoors.add(p.group);
    people[c.id] = p;
  }
  const gandalf = makePerson('gandalf');
  outdoors.add(gandalf.group);
  const lobelia = makePerson('lobelia');
  lobelia.group.visible = false;
  outdoors.add(lobelia.group);
  // the party: guests about the pavilion, dancing once it's dark
  const guests = [];
  const GUESTS = tier === 'high' ? 7 : tier === 'mid' ? 4 : 0;
  for (let i = 0; i < GUESTS; i++) {
    const p = makePerson('guest', { guest: i });
    const a = (i / GUESTS) * Math.PI * 2;
    p.home = { x: PAVILION.x - 1 + Math.cos(a) * 4.2, z: PAVILION.z + 4.8 + Math.sin(a) * 2.2, face: a + Math.PI };
    p.group.position.set(p.home.x, height(p.home.x, p.home.z), p.home.z);
    faceTo(p.group, p.home.face);
    outdoors.add(p.group);
    guests.push(p);
  }

  await breathe();
  // ── the animals ──
  const dogs = DOG_ROUNDS.map((_, i) => {
    const d = kit.dog({ seed: i + 1 });
    outdoors.add(d.group);
    return d;
  });
  const coneMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
  const cones = DOG_ROUNDS.map(() => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(HUNT.sight, 24, -HUNT.cone, HUNT.cone * 2).rotateX(-Math.PI / 2), coneMat(0xffd27a));
    m.renderOrder = 1;
    outdoors.add(m);
    return m;
  });
  const sheep = [];
  for (let i = 0; i < Math.round(6 * Math.max(0.5, many)); i++) {
    const s = kit.sheep({ seed: i + 1 });
    s.free = true;
    outdoors.add(s.group);
    sheep.push(s);
  }
  // where they go is the rules' (seeded, the same every visit): the scene only draws them
  const flock = newFlock(sheep.length, 7);
  const rider = kit.blackRider();
  rider.group.visible = false;
  outdoors.add(rider.group);
  // a cold light that comes with it, so it's a shape and not a hole
  const riderLight = new THREE.PointLight(0x8aa4ff, 0, 14, 1.6);
  riderLight.position.set(-1.2, 4.2, 1.5);
  rider.group.add(riderLight);
  // everyone who moves about, for culling by distance. Frodo and the rest
  // stand on soft blobs slid away from the sun, all of them one draw, and dim
  // in the baked shade (../towns/grounded.js): no shadow pass
  const crowd = [...Object.values(people), gandalf, lobelia, ...guests, ...sheep];
  const movers = [frodo, ...crowd, ...dogs].map((f) => ({ object: f.group, size: [FIGURE, FIGURE] }));

  // ── markers: where there's something to do ──
  const markerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.9, 0.7) });
  const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.9, 0.4), transparent: true, opacity: 0.09, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const markers = Array.from({ length: 8 }, () => {
    const g = new THREE.Group();
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), markerMat);
    gem.scale.y = 1.5;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.35, 9, 12, 1, true), beamMat);
    beam.position.y = -1.2;
    g.add(gem, beam);
    g.visible = false;
    outdoors.add(g);
    return g;
  });
  const hereRing = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.08, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.05, 0.4), transparent: true, opacity: 0.55, depthWrite: false }));
  hereRing.visible = false;
  outdoors.add(hereRing);

  await breathe();
  // ── effects ──
  const fx = createFx(scene, { scale: many });
  fx.placeFlies([...HOLES.map((h) => ({ x: h.x, y: height(h.x, h.z + h.r), z: h.z + h.r + 1.5, r: 4 })), { x: POND.x, y: 0, z: POND.z - POND.rz - 1, r: 8 }, { x: PARTY_TREE.x, y: 0.6, z: PARTY_TREE.z + 4, r: 7 }]);
  fx.placeButterflies([...HOLES.slice(0, 3).map((h) => ({ x: h.x, y: height(h.x, h.z + h.r + 1), z: h.z + h.r + 1.5 })), { x: BAG_END.x, y: height(BAG_END.x, BAG_END.z + 8), z: BAG_END.z + 8 }, { x: -2, y: 0.5, z: 4 }]);
  const inside = buildInside(renderer, { fx });
  scene.add(inside.group);

  // the sky the fireworks burst in, seen from the Party Field
  // the camera low on the field looking up, the great tree to one side and
  // the sky over the party for the fireworks
  const SHOW_CAM = { at: V(8.4, 1.9, -9.2), look: V(14, 15, -34) };
  const SHOW_SKY = { centre: V(15, 22, -38), across: 22, up: 17 };
  const showBasis = (() => {
    const fwd = SHOW_CAM.look.clone().sub(SHOW_CAM.at).normalize();
    const right = fwd.clone().cross(V(0, 1, 0)).normalize();
    const up = right.clone().cross(fwd).normalize();
    return { right, up, normal: fwd.clone().negate() };
  })();
  const SHOW_BACK = SHOW_CAM.at.clone().sub(SHOW_CAM.look).setY(0).normalize();
  const skyPoint = (u, v, out = new THREE.Vector3()) => out.copy(SHOW_SKY.centre).addScaledVector(showBasis.right, u * SHOW_SKY.across).addScaledVector(showBasis.up, (v - 0.45) * SHOW_SKY.up);
  const cartTop = V(CART.x, height(CART.x, CART.z) + 1.4, CART.z);

  // the smoke-ring plane, out in front of the bench
  const pipe = () => frodoPipe.clone();
  const frodoPipe = new THREE.Vector3();
  const RINGS_CAM = { at: new THREE.Vector3(), look: new THREE.Vector3() };
  const ringPoint = (u, v, out = new THREE.Vector3()) => out.set(frodoPipe.x - u, frodoPipe.y + v - 0.5, frodoPipe.z + RINGS.depth);

  // the lens: narrower while walking (a diorama to frame, not a horizon to
  // fill), the camera further back so Frodo keeps his size; the set pieces
  // (the smoke rings, the fireworks, the hollow, Bag End) keep their 50°
  const lens = { walk: 38, wide: 50 };
  const lensBack = () => Math.tan((lens.wide * Math.PI) / 360) / Math.tan((lens.walk * Math.PI) / 360);

  await breathe();
  // ── state ──
  const A = { t: 0, night: 0, dawn: 0, wraith: 0, shake: 0, cam: { at: V(0, 6, 8), look: V(0, 1, 0) }, mode: 'walk', last: null, smoke: 0, dogHop: [0, 0, 0], sniff: 0 };
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const WRAITH_FOG = new THREE.Color(0.32, 0.35, 0.42);
  const look = new THREE.Vector3();

  const render = (s, ms, fast = 1) => {
    const dt = Math.min(0.05 * fast, ms / 1000);
    A.t += dt;
    const t = A.t;
    wind.update(dt);
    water.material.uniforms.uTime.value = t;
    sky.uniforms.uTime.value = t;

    // the time of day, eased
    const wantNight = s.mode === 'show' || s.sky === 'night' || s.mode === 'inside' ? 1 : s.sky === 'dawn' ? 0 : 0;
    const wantDawn = s.sky === 'dawn' && s.mode !== 'show' ? 1 : 0;
    A.night += (wantNight - A.night) * Math.min(1, dt * (s.mode === 'show' ? 0.9 : 0.5));
    A.dawn += (wantDawn - A.dawn) * Math.min(1, dt * 0.5);
    A.wraith += ((s.wearing ? 1 : 0) - A.wraith) * Math.min(1, dt * 4);
    const sunDir = atmosphere(A.night, A.dawn);
    kit.setNight?.(A.night);
    const lit = A.night;
    lampA.intensity = lit * 30;
    lampB.intensity = lit * 22;
    innLamp.intensity = lit * 18;
    doorLamp.intensity = lit * 9;
    // the Ring: the world goes grey and blurred, the Eye looks
    sky.uniforms.uGrey.value = A.wraith * 0.85;
    sky.uniforms.uEye.value = A.wraith * (0.4 + 0.6 * (s.gaze ?? 0));
    stage.grade({ saturation: 1.1 - A.wraith * 0.95, contrast: 0.1 + A.wraith * 0.18, vignette: 0.22 + A.wraith * 0.45 + (s.rider?.phase === 'sniff' ? 0.2 : 0), shadow: [A.wraith * 0.03, 0.01 + A.wraith * 0.03, 0.03 + A.wraith * 0.06] });
    // (the Ring's grey fog is its own colour, not the sky's)
    house.set({ fogMix: 1 - A.wraith * 0.8 });
    if (A.wraith > 0.01) {
      scene.fog.near *= 1 - A.wraith * 0.7;
      scene.fog.far *= 1 - A.wraith * 0.55;
      scene.fog.color.lerp(WRAITH_FOG, A.wraith * 0.8);
    }

    // ── the hobbit ──
    const h = s.hobbit;
    const hy = groundY(h.x, h.z);
    frodo.group.position.set(h.x, hy, h.z);
    faceTo(frodo.group, h.face);
    frodo.group.visible = A.wraith < 0.5 && s.mode !== 'inside';
    if (frodo.ringMesh) frodo.ringMesh.visible = Boolean(s.hasRing);
    if (s.mode === 'rings') {
      // on the bench beside Gandalf, looking out
      frodo.group.position.copy(benchAt).add(tmp.set(-0.45, -0.42, 0.05));
      faceTo(frodo.group, -Math.PI / 2);
      sit(frodo, true);
      pose(frodo, t, { moving: false });
      sit(frodo, true);
    } else {
      if (frodo.sitting) sit(frodo, false);
      pose(frodo, t, { moving: h.speed > 0.3, speed: h.running ? 1.45 : 1 });
      if (s.mode === 'rider' && s.rider?.phase === 'sniff' && s.hidden) frodo.body.position.y = frodo.baseY - 0.18; // crouched
    }
    // (on the cast: crouched in the hollow on its knees, not sunk into the ground)
    castDo(frodo, { crouch: s.mode === 'rider' && s.rider?.phase === 'sniff' && Boolean(s.hidden) });
    frodoPipe.copy(frodo.group.position).add(tmp.set(0, 1.08, 0.32));
    ghosts.update(s.travellers ?? [], t, dt, { ringOn: Boolean(s.wearing) });

    // ── the cast ──
    for (const c of CAST) {
      const p = people[c.id];
      const on = !c.when || c.when === (A.night > 0.5 ? 'night' : 'day');
      p.group.visible = on && s.mode !== 'inside';
      if (!p.group.visible) continue;
      // they turn to Frodo as he comes by: on the cast the head first, a greeting the first time
      attend(p, h, p.home.face, dt, { who: frodo });
      if ((c.id === 'merry' || c.id === 'pippin') && A.night > 0.5 && s.mode !== 'show') dance(p, t, c.id === 'merry' ? 0 : 1.7);
      else {
        calm(p);
        pose(p, t, { moving: false, wave: s.talk === c.id ? 0.6 : 0, talk: s.talk === c.id ? 1 : 0 });
      }
    }
    // Gandalf: the bench by day, his cart for the fireworks, gone by night
    // (he's in Bag End), and at the edge of the Shire at dawn
    const gSpot = s.mode === 'show' ? { p: tmp2.set(CART.x + 1.6, height(CART.x + 1.6, CART.z + 1.2), CART.z + 1.2), face: Math.PI / 2 } : s.sky === 'day' ? { p: tmp2.copy(benchAt).add(tmp.set(0.55, -0.5, 0.05)), face: -Math.PI / 2, sit: true } : s.sky === 'dawn' ? { p: tmp2.set(SPOTS[3].x - 1.5, height(SPOTS[3].x - 1.5, SPOTS[3].z - 2), SPOTS[3].z - 2), face: Math.PI } : null;
    gandalf.group.visible = Boolean(gSpot) && s.mode !== 'inside';
    if (gSpot) {
      gandalf.group.position.copy(gSpot.p);
      if (gSpot.sit) gandalf.group.position.y -= 0.12;
      const near = Math.hypot(h.x - gSpot.p.x, h.z - gSpot.p.z) < 6 && s.mode === 'walk';
      if (gandalf.cast?.ready) {
        // on the cast: sat on the bench by day, his head (not the bench) turned to Frodo
        faceTo(gandalf.group, gSpot.face);
        castDo(gandalf, { look: near || s.talk === 'gandalf' ? frodo : null });
      } else faceTo(gandalf.group, near ? Math.atan2(-(h.z - gSpot.p.z), h.x - gSpot.p.x) : gSpot.face);
      if (gandalf.cast?.ready) sit(gandalf, Boolean(gSpot.sit));
      pose(gandalf, t, { moving: false, talk: s.talk === 'gandalf' ? 1 : 0 });
    }
    guests.forEach((g, i) => {
      g.group.visible = s.mode !== 'inside' && A.night > 0.3; // they come for the party
      if (A.night > 0.5) dance(g, t, i * 1.3);
      else {
        calm(g);
        pose(g, t + i, { moving: false });
      }
      // (on the cast, a guest's eyes follow Frodo through the party)
      castDo(g, { look: Math.hypot(h.x - g.group.position.x, h.z - g.group.position.z) < 6 ? frodo : null });
    });

    // the people and animals far off aren't drawn
    if (s.mode !== 'inside') {
      const cx = camera.position.x;
      const cz = camera.position.z;
      for (const f of crowd) {
        if (f.free) f.group.visible = true; // the sheep are always out
        if (f.group.visible && Math.hypot(f.group.position.x - cx, f.group.position.z - cz) > 60) f.group.visible = false;
      }
    }

    // ── the dogs, and what they can see ──
    const dogsNear = Math.hypot(h.x - (FIELD.x0 + FIELD.x1) / 2, h.z - (FIELD.z0 + FIELD.z1) / 2) < 30;
    (s.hunt?.dogs ?? []).forEach((d, i) => {
      const dog = dogs[i];
      if (!dog) return;
      A.dogHop[i] = Math.max(0, A.dogHop[i] - dt * 3);
      dog.group.position.set(d.x, height(d.x, d.z) + Math.sin(A.dogHop[i] * Math.PI) * 0.35, d.z);
      faceTo(dog.group, d.face);
      // its legs from the ground it covers, its head, ears and tail from its mode (props.js)
      dog.animate?.(t, { mode: d.mode, look: d.look ?? 0 });
      const cone = cones[i];
      cone.visible = dogsNear && s.mode === 'walk' && d.mode !== 'back';
      cone.position.set(d.x, height(d.x, d.z) + 0.06, d.z);
      cone.rotation.y = d.face + (d.mode === 'patrol' ? d.look : 0);
      const alarmed = d.mode === 'alert' || d.mode === 'chase';
      cone.material.color.set(alarmed ? 0xff5a3a : 0xffd27a);
      cone.material.opacity = alarmed ? 0.3 : 0.17;
    });
    MUSHROOMS.forEach((m, i) => {
      const picked = s.hunt?.picked?.includes(i);
      if (mushrooms[i]) mushrooms[i].group.visible = !picked;
      glintPos[i * 3 + 1] = picked ? -100 : height(m.x, m.z) + 0.5 + Math.sin(t * 2 + i) * 0.08;
    });
    glintGeo.attributes.position.needsUpdate = true;
    glintMat.opacity = 0.35 + 0.45 * Math.abs(Math.sin(t * 1.7));
    glintMat.size = Math.hypot(h.x - (FIELD.x0 + FIELD.x1) / 2, h.z - (FIELD.z0 + FIELD.z1) / 2) < 22 ? 0.55 : 0;

    // Bilbo's spoons, and Lobelia: at her post by the lane, or out after them
    SPOON_SPOTS.forEach((p, i) => {
      const left = Boolean(s.spoons) && spoonLeft(s.spoons, i) && s.mode !== 'inside';
      spoons[i].visible = left;
      spoonGlintPos.set([p.x, left ? groundY(p.x, p.z) + 0.42 + Math.sin(t * 2.4 + i) * 0.08 : -100, p.z], i * 3);
    });
    spoonGlintGeo.attributes.position.needsUpdate = true;
    spoonGlintMat.opacity = 0.45 + 0.5 * Math.abs(Math.sin(t * 2.1));
    const lb = s.lobelia;
    lobelia.group.visible = Boolean(lb) && s.mode !== 'inside' && Math.hypot(lb.x - camera.position.x, lb.z - camera.position.z) < 60;
    if (lb) {
      lobelia.group.position.set(lb.x, groundY(lb.x, lb.z), lb.z);
      const near = !lb.moving && Math.hypot(h.x - lb.x, h.z - lb.z) < 5;
      const want = lb.moving ? lb.face : near ? Math.atan2(-(h.z - lb.z), h.x - lb.x) : lb.face;
      let d = want - lobelia.group.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      lobelia.group.rotation.y += d * Math.min(1, dt * (lb.moving ? 10 : 4));
      // talking, she shakes her umbrella at you (on the cast: a scolding, a wagging finger)
      pose(lobelia, t, { moving: lb.moving, speed: 0.85, wave: s.talk === 'lobelia' ? 0.5 : 0, talk: s.talk === 'lobelia' ? 1 : 0 });
      castDo(lobelia, { upper: s.talk === 'lobelia' ? 'talk.angry' : null, look: near || s.talk === 'lobelia' ? frodo : null });
    }

    // sheep, grazing and wandering, and trotting off from Frodo when he's on foot among them
    stepFlock(flock, dt, { near: s.mode === 'walk' ? [h] : [] });
    sheep.forEach((sh, i) => {
      const a = flock.sheep[i];
      sh.group.position.set(a.x, height(a.x, a.z), a.z);
      faceTo(sh.group, a.face);
      sh.animate?.(t, { graze: a.speed < 0.02 && !a.shy });
    });

    // the mill wheel turns
    if (mill.wheel) mill.wheel.rotation.z -= dt * 0.6;

    // ── the Rider ──
    const r = s.rider;
    rider.group.visible = Boolean(r) && ['coming', 'sniff', 'leaving'].includes(r.phase);
    if (rider.group.visible) {
      const p = riderAt(r.s);
      rider.group.position.set(p.x, groundY(p.x, p.z), p.z);
      faceTo(rider.group, p.face);
      // the horse's legs from the ground it covers; at the hollow its head goes down (props.js)
      rider.animate?.(t, { sniff: r.phase === 'sniff' ? 1 : 0 });
      if (rider.rider?.body) {
        // leaning out over the hollow, sniffing
        const lean = r.phase === 'sniff' ? 1 : 0;
        A.sniff += (lean - A.sniff) * Math.min(1, dt * 2);
        rider.rider.body.rotation.x = A.sniff * 0.5;
        if (rider.rider.head) rider.rider.head.rotation.y = A.sniff * (Math.sin(t * 0.9) * 0.6 - 0.4);
      }
      if (r.phase === 'sniff') A.shake = Math.max(A.shake, 0.03);
      riderLight.intensity = 6 + Math.sin(t * 2.3) * 1.5;
    }

    // ── markers, and the ring at your feet ──
    const showMarks = s.mode === 'walk';
    markers.forEach((m, i) => {
      const q = (s.markers ?? [])[i];
      m.visible = showMarks && Boolean(q) && Math.hypot(q.x - h.x, q.z - h.z) > 6;
      if (!m.visible) return;
      m.position.set(q.x, groundY(q.x, q.z) + 3.1 + Math.sin(t * 2 + i) * 0.15, q.z);
      m.children[0].rotation.y = t * 1.5;
    });
    const near = s.near ? SPOTS.find((x) => x.id === s.near) : null;
    hereRing.visible = Boolean(near) && s.mode === 'walk';
    if (near) {
      hereRing.position.set(near.x, groundY(near.x, near.z) + 0.05, near.z);
      hereRing.scale.setScalar(1 + Math.sin(t * 4) * 0.06);
    }

    // ── smoke from the chimneys ──
    A.smoke += dt;
    if (A.smoke > 0.32 / Math.max(0.4, many)) {
      A.smoke = 0;
      for (const c of chimneys) if (c.distanceToSquared(camera.position) < 70 * 70) fx.chimney(c);
    }

    // ── the activities' visuals ──
    // smoke rings
    if (s.mode === 'rings' && s.rings) {
      const list = [];
      const his = hisAt(s.rings.his);
      list.push({ at: ringPoint(his.u, his.v, new THREE.Vector3()), r: his.r, opacity: 0.75 * Math.min(1, s.rings.his.age * 2), face: V(0, 0, -1) });
      for (const m of s.rings.mine) {
        const k = Math.min(1, m.t / RINGS.flight);
        const e = 1 - (1 - k) * (1 - k);
        const at = new THREE.Vector3().lerpVectors(frodoPipe, ringPoint(m.u, m.v, tmp), e);
        list.push({ at, r: 0.08 + RINGS.mine * e, opacity: 0.9 - k * 0.2, face: V(0, 0, -1) });
      }
      // where you're aiming: a faint ring
      if (s.aim) list.push({ at: ringPoint(s.aim.u, s.aim.v, new THREE.Vector3()), r: RINGS.mine, opacity: 0.18 + 0.08 * Math.sin(t * 6), face: V(0, 0, -1) });
      fx.showRings(list, t);
    } else fx.showRings([], t);

    fx.step(dt, t, { night: A.night, day: 1 - A.night });

    // ── the camera ──
    let camAt;
    let camLook;
    let follow = false;
    outdoors.visible = s.mode !== 'inside';
    inside.group.visible = s.mode === 'inside';
    if (s.mode === 'inside') {
      lampA.intensity = lampB.intensity = innLamp.intensity = doorLamp.intensity = 0;
      const c = inside.update(s.ringStep ?? 'envelope', t, dt);
      camAt = c.at;
      camLook = c.look;
      sun.intensity *= 0.1;
      hemi.intensity *= 0.25;
      // (full light in Bag End is the fire's, a couple of metres off)
      house.uniforms.uLookRef.value.setRGB(1.0, 0.72, 0.45);
    } else if (s.mode === 'rings') {
      // out in front of the bench, looking back at the two of them, with the
      // rings coming towards you
      // (further back on a tall, narrow screen, so his ring stays in view)
      RINGS_CAM.at.copy(frodoPipe).add(tmp.set(-0.5, 0.9, RINGS.depth + 3.6 + Math.max(0, 1.2 - camera.aspect) * 6));
      RINGS_CAM.look.copy(frodoPipe).add(tmp.set(-0.5, 0.55, 0));
      camAt = RINGS_CAM.at;
      camLook = RINGS_CAM.look;
    } else if (s.mode === 'rider' && s.hidden && s.rider && s.rider.phase !== 'warn') {
      // hiding under the roots: from the side, the hollow and the road above it
      camAt = tmp.set(HOLLOW.x + 5.5, groundY(HOLLOW.x + 5.5, HOLLOW.z - 9) + 3.4, HOLLOW.z - 9);
      camLook = look.set(HOLLOW.x + 0.2, groundY(HOLLOW.x, HOLLOW.z) + 1.1, (HOLLOW.z + RIDER.stopAt[1]) / 2 + 0.5);
    } else if (s.mode === 'show') {
      // (and further back for the sky on a narrow screen)
      camAt = tmp.copy(SHOW_CAM.at).addScaledVector(SHOW_BACK, Math.max(0, 1.2 - camera.aspect) * 7);
      camLook = SHOW_CAM.look;
    } else {
      const yaw = s.camYaw ?? 0;
      const pitch = s.camPitch ?? 0.36;
      const dist = (s.camDist ?? 6.4) * lensBack();
      follow = true;
      look.set(h.x, hy + 1.15, h.z);
      camAt = tmp.set(h.x + Math.sin(yaw) * Math.cos(pitch) * dist, hy + 1.15 + Math.sin(pitch) * dist, h.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      // in front of anything it would be inside (a mound, a wall, a hedge),
      // and never under the ground
      const k = clearance(look, camAt);
      if (k < 1) camAt.lerpVectors(look, camAt, k);
      const floor = groundY(camAt.x, camAt.z) + 0.6;
      if (camAt.y < floor) camAt.y = floor;
      camLook = look;
    }
    if (import.meta.env.DEV && s.debugCam) {
      camAt = tmp.set(...s.debugCam.at);
      camLook = look.set(...s.debugCam.look);
    }
    const jump = A.mode !== s.mode;
    A.mode = s.mode;
    const ease = jump ? 1 : Math.min(1, dt * (s.mode === 'walk' ? 8 : 2.5));
    A.cam.at.lerp(camAt, ease);
    A.cam.look.lerp(camLook, ease);
    camera.position.copy(A.cam.at);
    const fov = camera.fov + ((follow ? lens.walk : lens.wide) - camera.fov) * ease;
    if (Math.abs(fov - camera.fov) > 1e-3) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    if (A.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * A.shake;
      camera.position.y += (Math.random() - 0.5) * A.shake;
      A.shake = Math.max(0, A.shake - dt * 0.8);
    }
    camera.lookAt(A.cam.look);
    sky.dome.position.copy(camera.position);
    // the grass's patch a little ahead of the eye, where the view lands
    camera.getWorldDirection(tmp2).setY(0);
    if (tmp2.lengthSq() < 1e-6) tmp2.set(0, 0, -1);
    grass.update(tmp.copy(camera.position).addScaledVector(tmp2.normalize(), 13));
    // the sun's shadows follow where you are
    const focus = s.mode === 'inside' ? INSIDE : s.mode === 'show' ? tmp2.set(20, 0, -14) : frodo.group.position;
    sun.target.position.copy(focus);
    sun.position.copy(focus).addScaledVector(sunDir, 70);
    ground.update();
    // the people on the cast (../cast3d.js), drawn for this frame
    tickCast(scene, camera, dt);
    renderer.info.reset();
    stage.render(ms);
  };

  // ── events: bursts, puffs and barks ──
  const fxEvent = (type, d = {}) => {
    if (type === 'pick') {
      const m = MUSHROOMS[d.i];
      if (m) fx.pop(V(m.x, height(m.x, m.z) + 0.3, m.z), 'gold', 26, 2.6);
    } else if (type === 'spoon') {
      const p = SPOON_SPOTS[d.i];
      if (p) fx.pop(V(p.x, groundY(p.x, p.z) + 0.4, p.z), d.hers ? 'red' : 'white', 24, 2.2);
    } else if (type === 'seen') {
      A.dogHop[d.dog] = 1;
    } else if (type === 'caught') {
      A.shake = 0.25;
    } else if (type === 'puff') {
      fx.puff(frodoPipe, V(0, 0.2, 1), 8);
    } else if (type === 'through') {
      const at = ringPoint(d.u ?? 0, d.v ?? 1, new THREE.Vector3());
      fx.pop(at, 'white', 30, 1.8);
    } else if (type === 'launch') {
      fx.rocket(cartTop, skyPoint(d.u, d.v), d.flight ?? 0.9);
    } else if (type === 'burst') {
      fx.burst(skyPoint(d.u, d.v), d.colour, 1.45);
      A.shake = Math.max(A.shake, 0.015);
    } else if (type === 'dragon') {
      const pts = [cartTop.clone(), V(8, 6, -20), V(14, 13, -32), V(30, 9, -22), V(PAVILION.x, 3.4, PAVILION.z + 3), V(14, 5, -2), V(6, 12, -18), V(20, 21, -34)];
      fx.startDragon(pts, d.duration ?? 6.8, () => {
        A.shake = 0.12;
      });
    } else if (type === 'found') {
      A.shake = 0.35;
    } else if (type === 'leaving') {
      A.shake = 0.08;
    }
  };

  // Where a click lands, as the activity's own coordinates: the smoke-ring
  // plane's (u, v) or the fireworks sky's.
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane();
  const aim = (kind, nx, ny) => {
    ray.setFromCamera({ x: nx, y: ny }, camera);
    if (kind === 'rings') {
      plane.set(V(0, 0, -1), frodoPipe.z + RINGS.depth);
      const p = ray.ray.intersectPlane(plane, tmp);
      if (!p) return null;
      return { u: frodoPipe.x - p.x, v: p.y - frodoPipe.y + 0.5 };
    }
    plane.setFromNormalAndCoplanarPoint(showBasis.normal, SHOW_SKY.centre);
    const p = ray.ray.intersectPlane(plane, tmp);
    if (!p) return null;
    const d = p.sub(SHOW_SKY.centre);
    return { u: d.dot(showBasis.right) / SHOW_SKY.across, v: d.dot(showBasis.up) / SHOW_SKY.up + 0.45 };
  };

  // Where something is on screen, for the speech bubbles: { x, y } in CSS
  // pixels of the canvas, or null when it's behind the camera.
  const screenOf = (kind, id) => {
    let p = null;
    if (kind === 'cast' && people[id]) p = tmp.copy(people[id].group.position).add(tmp2.set(0, 2.15, 0));
    else if (kind === 'cast' && id === 'gandalf') p = tmp.copy(gandalf.group.position).add(tmp2.set(0, 2.9, 0));
    else if (kind === 'cast' && id === 'lobelia') p = tmp.copy(lobelia.group.position).add(tmp2.set(0, 2.15, 0));
    else if (kind === 'frodo') p = tmp.copy(frodo.group.position).add(tmp2.set(0, 2.1, 0));
    else if (kind === 'dog' && dogs[id]) p = tmp.copy(dogs[id].group.position).add(tmp2.set(0, 1.2, 0));
    if (!p) return null;
    p.project(camera);
    if (p.z > 1 || Math.abs(p.x) > 1.2 || Math.abs(p.y) > 1.2) return null;
    const { w, h: hh } = stage.size;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * hh };
  };

  // ── the floor's light, baked when the Shire is first drawn outdoors ──
  // (its bounce off: the house look's, from the ground map, is the bounce)
  // (the grass out of the bake: drawn from above it would wrap round the
  // bake's own camera; it reads the baked shade instead, as the floor does)
  const ground = groundTown({ place: 'shire', renderer, scene, terrain, outdoors, sun, height: groundY, people: movers, skip: [sky.dome, ghosts.group, water.group, grass.mesh], tier, radius: WORLD.radius + 10, shade: 0x2c3018, matcap: [rimTrees], bounce: false });
  floorShadow(grass.material, ground.mask);
  // (last, over the floor light's own tints: one shadow colour everywhere)
  house.adopt(scene);

  // ?debug: the look, the grass, the wind and the lens on sliders (lib/debugPanel)
  const panel = debugOn() ? debugPanel({ title: 'The Shire', groups: shireTuning({ house, grass, wind, lens, moods: MOODS }) }) : null;

  return {
    ground: import.meta.env.DEV ? ground : null, // for the QA scripts
    scene: import.meta.env.DEV ? scene : null, // for the QA scripts
    house: import.meta.env.DEV ? house : null, // for the QA scripts
    grass: import.meta.env.DEV ? grass : null, // for the QA scripts
    wind: import.meta.env.DEV ? wind : null, // for the QA scripts
    render,
    prepare: stage.prepare, // (everything sent to the graphics chip before it's seen: lib/stage3d)
    fx: fxEvent,
    aim,
    screenOf,
    pipe,
    resize: stage.resize,
    get info() {
      const i = renderer.info;
      return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, quality: stage.quality, tier };
    },
    get lost() {
      return stage.lost;
    },
    dispose() {
      gone = true;
      panel?.dispose();
      ground.dispose();
      grass.dispose();
      wind.dispose();
      groundMap.dispose();
      ghosts.dispose();
      releaseCast(scene);
      stage.dispose();
    },
  };
}

// What the camera can't go through, with how high each stands above the
// ground at its middle: the mounds, the buildings, the hedges.
const TOPS = { bagend: 6.5, 'party-tree': 4, 'root-tree': 2.6, mill: 7.5, inn: 8, barn: 7.5, cart: 2.2, tables: 1.1 };
const BLOCKERS = COLLIDERS.filter((c) => !c.id.startsWith('oak') && c.id !== 'scarecrow').map((c) => {
  const top = TOPS[c.id] ?? (/-p[we]$/.test(c.id) ? 2.2 : /-[we]$/.test(c.id) ? 2.6 : 3.4);
  return { ...c, y: height(c.x, c.z) + top };
});
const HEDGE_TOP = 1.5;
function inside(x, y, z) {
  for (const c of BLOCKERS) {
    if (y > c.y) continue;
    if (c.kind === 'circle' ? Math.hypot(x - c.x, z - c.z) < c.r + 0.25 : Math.abs(x - c.x) < c.w / 2 + 0.25 && Math.abs(z - c.z) < c.d / 2 + 0.25) return true;
  }
  for (const [x0, z0, x1, z1] of HEDGES) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz)));
    if (Math.hypot(x - (x0 + t * dx), z - (z0 + t * dz)) < 0.75 && y < height(x, z) + HEDGE_TOP) return true;
  }
  return false;
}
// how far from `from` to `to` the camera can go before it's inside
// something, as a fraction
function clearance(from, to) {
  const N = 14;
  for (let i = 1; i <= N; i++) {
    const k = i / N;
    if (inside(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, from.z + (to.z - from.z) * k)) return Math.max(0.18, (i - 1) / N);
  }
  return 1;
}

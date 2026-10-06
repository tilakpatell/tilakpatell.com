// A world in a galaxy far, far away, from the ground (pages/GalaxySurface.jsx,
// /galaxy/tatooine/surface): you come down out of the sky in your ship, it
// sets down, and you and your crewmate climb out onto the sand (or the
// snow, or the forest floor, or a platform over the clouds). Then it's
// yours to walk: the stick or WASD to go (from the camera), Shift to run,
// Space to jump, a drag (or the right of the screen, on a phone) to look
// round, E to do whatever's to hand: talk to whoever's there, climb onto
// a speeder or a tauntaun (and off again), or get back in the ship and
// take off, back up to the system. Each world has its places to find (the
// Lars homestead, Echo Base, the Ewok village…), each named on the compass
// till you've been; its people and creatures about their business; ships
// going over; the weather.
//
// What's built, from the site (sites/*.js): the land (terrain.js, ground.js)
// under its sky (sky.js) with its water (water.js) and its weather
// (weather.js); its things (placer.js: models where there are models,
// props built in code where there aren't); its life (actors.js); what you
// can ride (rides.js). Moving about is walker.js's.
//
// A scene module, a world on the world runtime through ./module.js
// (src/runtime's fromScene): create(canvas, ctx) draws with the runtime's
// renderer (ctx.rt.gfx: the runtime sizes it and sets its sharpness) and
// returns { ready, resize, render, update, setVisible, input, dispose }.
// Props: system (the world's id), ship (the crew's ship: xwing, falcon…),
// loadout (its paint), onEvent(e), compass (a ref: the compass bar, its
// marks by data-id), found (the places already found, by id), net (the
// online client, universe/online/client.js: your crew goes out to the
// others, and theirs, down on the same world, are drawn here: peers.js).
// Events: { type: 'phase', phase } (landing, walk, ride, leaving),
// { type: 'prompt', text } (what E does, or null), { type: 'found', id },
// { type: 'here', id } (the place you're in, or null), { type: 'talk',
// who, text }, { type: 'edge' }, { type: 'fell' }, { type: 'leave' } (the
// ship's away: back to space).

import { readBuildWire, writeBuild } from '../../universe/shipyard/build';
import * as THREE from 'three';
import { disposeTree, precompile, singlePass } from '../../../lib/three/renderer';
import { dropTransmission } from '../../../lib/three/glass';
import { device } from '../../../lib/device';
import { createPost } from '../../universe/post';
import { SHIP_MODELS, buildShip, LENGTH } from '../../universe/shipModels';
import { loadModel } from '../../universe/planets';
import { paintById } from '../../universe/paint';
import { readLoadout, STOCK_LOADOUT } from '../../universe/outfit';
import { flybySound, gunSound, impactSound, shipEngine } from '../../universe/sounds';
import { PARTY, loadPartyFigure } from '../../universe/footScene';
import { createGunplay } from '../../universe/gunplay';
import { createGunFx } from '../../universe/gunfx';
import { spring } from '../../../lib/three/ik';
import { METRE } from '../../universe/foot';
import { createMeshyCast } from '../../rickmorty/portal/meshyCast';
import { withWardrobe } from '../../rickmorty/wardrobe/wear';
import { buildGalaxyShip } from '../fleet';
import { audioContext } from '../../../lib/audio';
import { siteOf } from './sites';
import { heightGrid, makeHeight } from './terrain';
import { createMarks, groundMaterial, groundMesh } from './ground';
import { createSky } from './sky';
import { createWater } from './water';
import { createWeather } from './weather';
import { createKit } from './kit';
import { PROPS } from './props';
import { createPlacer } from './placer';
import { createActors, modelFigure } from './actors';
import { RIDES } from './rides';
import { createPeers } from './peers';
import { createSounds } from './sounds';
import { createActivity } from './activity';
import { snapToTexel } from './shadow';
import { createShadowPhase } from './near';
import { createBlaster } from './blaster';
import { feed, nextQuest, questsOf, start as startQuest, stepTarget, stepText } from './quests';
import { buildFigure } from './figures';
import { WALK, createSolids, groundAt, ride, rider, turnToward, walk, walker } from './walker';
import { rng } from './noise';
import { endRun, missionOf, newRun, tickRun } from './missions';
import { createChaseMission } from './missions/chaseScene';

const V = THREE.Vector3;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// the ships you land in: how long they are (m), how high their belly sits
const SHIPS = { xwing: { metres: 12.5, lift: 0.4 }, falcon: { metres: 34.7, lift: 1.2 }, cruiser: { metres: 6.5, lift: 0.3 }, rv: { metres: 11, lift: 0.3 } };
const LAND = { descend: 7.5, settle: 1.2, out: 1.6 }; // seconds
// the crew who have models of their own on the worlds (catalog/people.js), by
// who they are in the universe's crews (footScene.js's PARTY)
export const CREW_MODELS = { artoo: 'r2d2' };
const LEAVE = { lift: 3.2, away: 3.4 };
const CAM = { dist: 4.8, up: 1.55, pitch: [-0.45, 1.15], far: 14, near: 2.2 };
const REACH = 3.2; // metres: close enough to use something
const KEYS = { w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', shift: 'run', ' ': 'jump', e: 'act', enter: 'act', f: 'fire' };
const FIRE_EVERY = 0.24; // seconds between shots
const BIKE_FIRE_EVERY = 0.3; // (a bike's cannon: a touch slower)

export async function create(canvas, ctx) {
  const { reduced, rt } = ctx;
  let props = ctx;
  let disposed = false;
  const tier = device().tier;
  const small = tier !== 'high' || Math.min(window.innerWidth, window.innerHeight) < 600;
  const site = siteOf(ctx.system);
  if (!site) throw new Error(`no surface for ${ctx.system}`);
  // a mission played down here (missions/): you start in it, not landing
  const mission = ctx.mission ? missionOf(ctx.system, ctx.mission) : null;
  const emit = (e) => props.onEvent?.(e);

  // ── The renderer, the camera, the light ──
  // (the runtime's: shared with whatever world comes next, so its shadows go back as they were at dispose)
  const { renderer } = rt.gfx;
  const shadowMapWas = { enabled: renderer.shadowMap.enabled, type: renderer.shadowMap.type };
  renderer.shadowMap.enabled = !small;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.12, 16000);
  scene.add(camera);
  canvas.setAttribute('aria-hidden', 'true');
  const post = createPost(renderer, scene, camera, { small });
  const warm = (root) => precompile(renderer, singlePass(root), camera, scene, post.on ? post.composer.readBuffer : undefined);

  const sky = createSky(site);
  scene.add(sky.mesh);
  const sunDir = sky.sunDirs[0] ?? new V(0.3, 0.8, 0.4).normalize();
  const sun = new THREE.DirectionalLight(site.sky.suns?.[0]?.color ?? '#ffffff', site.light.sun ?? 3);
  sun.castShadow = !small;
  if (sun.castShadow) {
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -42;
    sc.right = sc.top = 42;
    // (SHADOW below says the same, for the snapping)
    sc.near = 1;
    sc.far = 600;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.05;
  }
  scene.add(sun, sun.target);
  // the shadow camera's right and up (it looks down the sun's way, up as three
  // turns it), for its focus to be snapped to whole texels along them (shadow.js)
  const SHADOW = { extent: 42, map: 2048 };
  const shadowFrame = new THREE.Matrix4().lookAt(sunDir, new V(), new V(0, 1, 0));
  const shadowRight = new V().setFromMatrixColumn(shadowFrame, 0);
  const shadowUp = new V().setFromMatrixColumn(shadowFrame, 1);
  const second = sky.sunDirs[1] ? new THREE.DirectionalLight(site.sky.suns[1].color, site.light.second ?? 1) : null;
  if (second) {
    second.position.copy(sky.sunDirs[1]).multiplyScalar(300);
    scene.add(second);
  }
  const hemi = new THREE.HemisphereLight(site.light.sky ?? '#bcd0ee', site.light.ground ?? '#8a7a66', site.light.ambient ?? 0.9);
  scene.add(hemi);
  scene.fog = new THREE.FogExp2(site.fog.color, site.fog.density);
  // what shiny things reflect: the sky
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envSky = sky.envScene();
  const env = pmrem.fromScene(envSky.scene, 0, 1, 2000);
  envSky.dispose();
  pmrem.dispose();
  scene.environment = env.texture;
  scene.environmentIntensity = 0.4;

  // ── The land ──
  const height = makeHeight(site.ground);
  const grid = heightGrid(height, { n: small ? 160 : 256, grow: small ? 1.13 : 1.08 });
  const gmat = groundMaterial(site, { small });
  const marks = createMarks(small ? 256 : 512);
  gmat.uniforms.uMarks.value = marks.texture;
  const ground = groundMesh(grid, gmat.material);
  if (!site.noGround) scene.add(ground);
  const water = site.water ? createWater(site, sunDir, site.sky.suns?.[0]?.color ?? '#ffffff') : null;
  if (water) {
    scene.add(water.mesh);
    if (water.glow) scene.add(water.glow);
  }
  const world = {
    heightAt: site.noGround ? () => site.fall ?? -1000 : grid.heightAt,
    normalAt: site.noGround ? () => [0, 1, 0] : (x, z) => grid.normalAt(x, z),
    solids: createSolids(),
    floors: [...(site.floors ?? [])],
    reach: site.reach,
    // (water you wade in: not lava, not cloud, and not a sea far under a
    // platform with nothing else under it, which you'd fall into)
    water: site.water && !site.noGround && site.water.kind !== 'clouds' && site.water.kind !== 'lava' ? site.water.level : null,
  };
  const weather = reduced ? null : createWeather(site, { small });
  if (weather) scene.add(weather.group);

  // ── What's on it ──
  const kit = createKit({ seed: 31 });
  // (the scatter casts its shadow only near you: near.js)
  const shadowPhase = sun.castShadow ? createShadowPhase(scene, sun) : null;
  const placer = createPlacer({ parent: scene, kit, world, warm, shadowOnly: shadowPhase?.only ?? null });
  for (const t of site.things_all) placer.put(t);
  const r = rng(site.ground.seed ?? 1);
  const avoid = [...site.places.map((p) => ({ at: p.at, r: p.flat?.r ?? p.r * 0.6 })), { at: site.land.at, r: 30 }];
  for (const s of site.scatter) {
    const items = [];
    const [r0, r1] = s.within ?? [20, site.reach];
    let tries = 0;
    while (items.length < Math.round(s.n * (small ? 0.6 : 1)) && tries++ < s.n * 20) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r0 * r0 + r() * (r1 * r1 - r0 * r0));
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (avoid.some((v) => Math.hypot(x - v.at[0], z - v.at[1]) < v.r + (s.clear ?? 4))) continue;
      if (s.flat && grid.normalAt(x, z)[1] < s.flat) continue;
      if (world.water != null && s.dry !== false && grid.heightAt(x, z) < world.water + (s.above ?? 0.2)) continue;
      const [lo, hi] = s.scale ?? [1, 1];
      items.push({ at: [x, z], yaw: r() * Math.PI * 2, scale: lo + (hi - lo) * r() ** 1.6, sink: s.sink ?? 0.1, stretch: s.stretch ? s.stretch[0] + r() * (s.stretch[1] - s.stretch[0]) : 1 });
    }
    placer.scatter(s.kind, items, { opts: s.opts, solid: s.solid ?? true, model: s.model ?? true });
  }
  const life = createActors({ parent: scene, world, life: site.life, seed: (site.ground.seed ?? 1) + 7, warm, small, kit, fog: () => scene.fog.density });

  // ── The places you go into (zones): built high over the world, out of
  // sight, each with its own lamps ──
  for (const z of site.zones) placer.put({ kind: z.inside.build, at: [z.origin[0], z.origin[2]], y: z.origin[1], abs: true, model: false, opts: z.inside.opts, zone: true });
  // (hidden outdoors: a light with nothing to light still costs every pixel of
  // every lit thing, and four of them a good deal; the warm-up compiles both ways)
  const lamps = Array.from({ length: 4 }, () => {
    const l = new THREE.PointLight('#ffffff', 0, 30, 1.6);
    l.visible = false;
    scene.add(l);
    return l;
  });

  // ── Things to do: the quest you're on, out in the world, and the blaster ──
  const activity = createActivity({ parent: scene, world, warm, kit, color: site.accent });
  const blaster = createBlaster({ parent: scene, world });
  // what a shot does round the gun and where it lands (universe/gunfx.js),
  // and a light that flares with each muzzle flash: in the scene from the
  // start and dark between shots, so the count of lights never changes and
  // nothing recompiles when you fire (not on a small screen or a low tier)
  const UP = new V(0, 1, 0);
  const flare = small || reduced ? null : new THREE.PointLight('#ffd36b', 0, 7, 2);
  if (flare) {
    flare.userData.peak = 2.5;
    scene.add(flare);
  }
  const fx = createGunFx({
    parent: scene,
    unit: 1,
    ground: (p) => ({ h: p.y - groundAt(world, p.x, p.z, p.y + 0.3), n: UP }),
    light: flare && { obj: flare, place: (p) => flare.position.copy(p) },
  });
  const fwdV = new V();
  const rightV = new V();
  // (a quest mission's quest is the mission's own, not one of the world's)
  const questOf = (id) => site.quests.find((q) => q.id === id) ?? (mission?.quest?.id === id ? mission.quest : null);
  // who gives each quest, with a mark over them till it's done
  const givers = [];
  const markMat = new THREE.SpriteMaterial({ map: (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#ffd36a';
    g.beginPath();
    g.arc(32, 32, 26, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1a1206';
    g.font = 'bold 40px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('!', 32, 34);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })(), depthWrite: false, transparent: true });

  // what you can ride, where it's parked
  const rides = [...site.rides, ...(mission?.ride ? [{ kind: mission.ride, at: mission.start, yaw: mission.yaw }] : [])]
    .filter((x) => RIDES[x.kind])
    .map((x) => {
      const spec = RIDES[x.kind];
      const y0 = groundAt(world, x.at[0], x.at[1]);
      const state = rider(x.at[0], x.at[1], y0 + (spec.hover ?? 0), x.yaw ?? 0);
      const holder = new THREE.Group();
      scene.add(holder);
      const ridee = { spec, kind: x.kind, state, holder, fig: null, body: null, solid: null };
      if (spec.figure) {
        const fig = buildFigure(spec.figure);
        if (fig) {
          holder.add(fig.model);
          ridee.fig = fig;
        }
      } else {
        // its model (or its build), held in the holder so it can bank
        const tmp = new THREE.Group();
        placer
          .put({ kind: x.kind, at: [0, 0], abs: true, solid: false })
          .then((o) => {
            if (!o || disposed) return;
            tmp.add(o);
            o.position.set(0, 0, 0);
            o.rotation.set(0, 0, 0);
          });
        holder.add(tmp);
        ridee.body = tmp;
      }
      return ridee;
    });

  // ── Ships going over, and hanging in the sky ──
  const flights = [];
  let nextFlight = 12 + r() * 10;
  const flyover = (spec) => {
    const n = spec.n ?? 1;
    const a = r() * Math.PI * 2;
    const dir = new V(Math.sin(a), 0, Math.cos(a));
    const side = new V(dir.z, 0, -dir.x);
    const centre = new V(you.x, 0, you.z).addScaledVector(side, (r() - 0.5) * 200);
    for (let i = 0; i < n; i++) {
      const m = buildGalaxyShip(spec.kind);
      m.group.scale.setScalar(spec.metres ?? 10);
      m.group.traverse((o) => {
        if (o.isMesh) o.castShadow = false;
      });
      const offset = side.clone().multiplyScalar((i - (n - 1) / 2) * (spec.metres ?? 10) * 3).addScaledVector(dir, -i * (spec.metres ?? 10) * 2);
      const from = centre.clone().addScaledVector(dir, -1600).add(offset);
      from.y = (spec.alt ?? 100) + groundAt(world, centre.x, centre.z) + i * 6;
      m.group.position.copy(from);
      m.group.lookAt(from.clone().add(dir));
      scene.add(m.group);
      flights.push({ m, dir, speed: spec.speed ?? 100, age: 0, life: 3200 / (spec.speed ?? 100), kind: spec.kind, heard: false });
    }
  };
  const skyships = site.skyships.map((s) => {
    const m = buildGalaxyShip(s.kind);
    m.group.scale.setScalar(s.metres);
    m.group.position.set(...s.at);
    m.group.rotation.y = s.yaw ?? 0;
    m.group.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false;
      for (const mat of Array.isArray(o.material) ? o.material : [o.material]) mat.fog = false;
    });
    scene.add(m.group);
    return m;
  });

  // ── Your ship ──
  const shipKind = SHIPS[ctx.ship] ? ctx.ship : 'xwing';
  const S = SHIPS[shipKind];
  const landAt = site.land.at;
  const landY = groundAt(world, landAt[0], landAt[1]);
  const shipHolder = new THREE.Group(); // where it is
  const shipTilt = new THREE.Group(); // how it's tilted, coming down
  shipHolder.add(shipTilt);
  scene.add(shipHolder);
  const shipBuild = ctx.build ? readBuildWire(writeBuild(ctx.build)) : null; // (a garage build from the hangar's shipyard)
  const ship = buildShip(shipKind, {}, { build: shipBuild });
  ship.group.rotation.y = Math.PI; // (built nose to −z: the world's things face +z)
  ship.group.scale.setScalar(S.metres / LENGTH);
  shipTilt.add(ship.group);
  const loadout = readLoadout(ctx.loadout ?? STOCK_LOADOUT);
  ship.paint?.(paintById(loadout.paint));
  const shipBox = { w: S.metres * 0.5, l: S.metres * 0.5 };
  const seat = () => {
    // sat on its belly: its lowest point on the ground (measured in its own
    // frame: where it is and how it's tilted put by while it's measured)
    const at = shipHolder.position.clone();
    const yaw = shipHolder.rotation.y;
    const tilt = shipTilt.rotation.clone();
    shipHolder.position.set(0, 0, 0);
    shipHolder.rotation.y = 0;
    shipTilt.rotation.set(0, 0, 0);
    ship.group.position.y = 0;
    shipHolder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(ship.group);
    ship.group.position.y = -box.min.y;
    const size = box.getSize(new V());
    shipBox.w = size.x / 2;
    shipBox.l = size.z / 2;
    shipHolder.position.copy(at);
    shipHolder.rotation.y = yaw;
    shipTilt.rotation.copy(tilt);
  };
  seat();
  if (shipBuild) {
    // a garage build is whole as it is
  } else if (SHIP_MODELS[shipKind]) {
    loadModel(SHIP_MODELS[shipKind])
      .then((m) => m && (dropTransmission(m), warm(ship.dress ? ship.dress(m) : m).then(() => m))) // (the Falcon's glass, without its extra pass)
      .then((m) => {
        if (!m) return;
        if (disposed || !ship.mount(m)) disposeTree(m);
        else seat();
      })
      .catch(() => {});
  } else if (shipKind === 'cruiser') {
    import('../../rickmorty/cruiser3d')
      .then((mod) => mod.buildCruiser({ ink: 0.36 / 2.7 }))
      .then((c) => {
        if (!c) return;
        if (disposed || !ship.mount(c.group, { update: c.update, dispose: c.dispose, ownGlow: true, tint: c.tint })) {
          c.dispose();
          disposeTree(c.group);
        } else seat();
      })
      .catch(() => {});
  }
  // once it's down it's solid
  let shipSolid = false;
  const solidShip = () => {
    if (shipSolid) return;
    shipSolid = true;
    world.solids.box(landAt[0], landAt[1], shipBox.w * 0.8, shipBox.l * 0.85, site.land.yaw);
  };

  // ── You, and your crewmate ──
  const party = PARTY[shipKind] ?? PARTY.xwing;
  const out = new V(Math.cos(site.land.yaw), 0, -Math.sin(site.land.yaw)); // the ship's right
  // (a mission on foot starts you at its start, facing its way)
  const onFoot = Boolean(mission && !mission.ride);
  const spawnAt = onFoot ? [...mission.start] : [landAt[0] + out.x * (shipBox.w + 2.5), landAt[1] + out.z * (shipBox.w + 2.5)];
  const you = walker(spawnAt[0], spawnAt[1], groundAt(world, ...spawnAt), onFoot ? mission.yaw : site.land.yaw + 0.5);
  const mateAt = [spawnAt[0] + out.x * 1.6, spawnAt[1] + out.z * 1.6];
  const mate = walker(mateAt[0], mateAt[1], groundAt(world, ...mateAt), you.yaw);
  const people = [
    { spec: party[0], st: you, holder: new THREE.Group(), fig: null },
    { spec: party[1], st: mate, holder: new THREE.Group(), fig: null },
  ];
  let lead = 0; // which of them you are
  let cast = null;
  for (const p of people) {
    p.holder.visible = false;
    scene.add(p.holder);
  }
  (async () => {
    if (people.some((p) => p.spec.src.meshy)) {
      cast = createMeshyCast(withWardrobe());
      await cast
        .load(
          null,
          people.filter((p) => p.spec.src.meshy).map((p) => p.spec.src.meshy),
        )
        .catch(() => {});
    }
    await Promise.all(
      people.map(async (p) => {
        // (one of the crew with a model of their own here: that, in metres)
        const own = CREW_MODELS[p.spec.id] ? await modelFigure(CREW_MODELS[p.spec.id]).catch(() => null) : null;
        const fig = own ?? (await loadPartyFigure(p.spec, cast).catch(() => null));
        if (!fig || disposed) return;
        const inner = new THREE.Group();
        if (!own) inner.scale.setScalar(1 / METRE);
        inner.add(fig.model);
        fig.model.traverse((o) => {
          if (o.isMesh) o.castShadow = true;
        });
        p.holder.add(inner);
        p.fig = fig;
        // the gun they carry, in the hand (universe/gunplay.js; the world here is in metres)
        if (p.spec.gun && !own) {
          p.holder.updateMatrixWorld(true);
          p.gp = createGunplay(fig, fig.gun ?? p.spec.gun, { unit: 1, who: fig.built ? 'built' : p.spec.id });
        }
        await warm(p.holder);
      }),
    );
  })();

  // ── Sound: the air, your steps, a speeder's whine (once you've touched
  // something: browsers only let sound start then) ──
  const kinds = new Set(site.weather.map((w) => w.kind));
  const sounds = createSounds({
    ...site,
    sound: site.sound ?? {
      wind: kinds.has('sand') ? 0.8 : kinds.has('snow') ? 1 : 0.35,
      rain: kinds.has('rain') ? 1 : 0,
      sea: site.water?.kind === 'sea' ? 0.7 : 0,
      lava: site.water?.kind === 'lava' || kinds.has('embers') ? 0.7 : 0,
      critters: kinds.has('motes') ? 0.6 : 0,
      ground: kinds.has('snow') ? 'snow' : site.water?.kind === 'swamp' ? 'mud' : 'sand',
    },
  });
  let strode = 0;

  // ── The other pilots down here (online) ──
  const peers = createPeers({ parent: scene, placer, getCast: () => (cast ??= createMeshyCast(withWardrobe())) });

  // ── State ──
  const state = {
    phase: mission ? (mission.ride ? 'ride' : 'walk') : reduced ? 'walk' : 'landing',
    age: 0,
    t: 0,
    frames: 0,
    keys: {},
    stick: { x: 0, y: 0 },
    buttons: { run: false },
    jumpQueued: false,
    actQueued: false,
    cam: { yaw: mission ? mission.yaw : you.yaw, pitch: 0.2, dist: mission?.ride ? RIDES[mission.ride].cam[0] : CAM.dist, drag: -10 },
    riding: mission?.ride ? rides[rides.length - 1] : null,
    prompt: null,
    here: null,
    found: new Set(props.found ?? []),
    edgeAt: -10,
    shake: 0,
    dust: 0,
    quest: null, // quests.js's progress on the one you're on
    tracked: null, // the one picked from the list (its giver on the compass)
    done: new Set(props.done ?? []),
    health: 100,
    hurtAt: -10,
    firedAt: -10,
    aim: 0, // your gun up, 1 fading to 0 after a shot
    aimDir: new V(0, 0, 1),
    shot: null, // a shot to send once you've turned to it
    kick: { x: 0, v: 0 }, // the view's kick on a shot
    zone: null, // the place you're in, if you've gone into one
    outside: null, // where you were before you went in
  };
  const camPos = new V();
  const camLook = new V();
  let camInit = false;
  if (state.phase === 'walk' || state.phase === 'ride') {
    for (const p of people) p.holder.visible = true;
    solidShip();
  }

  // the ship's way down: in from behind, low over the land, onto its spot
  const shipLanded = new V(landAt[0], landY, landAt[1]);
  const approach = new V(-Math.sin(site.land.yaw), 0, -Math.cos(site.land.yaw));
  const shipFrom = shipLanded.clone().addScaledVector(approach, 700).add(new V(0, 320, 0));
  shipHolder.position.copy(state.phase === 'landing' ? shipFrom : shipLanded);
  shipHolder.rotation.y = site.land.yaw;
  ship.park?.(state.phase !== 'landing');
  let engine = null;
  const engineOn = (speed) => {
    if (!engine) {
      if (!audioContext()) return;
      engine = shipEngine(shipKind);
    }
    engine.set({ speed, boost: false, on: true });
  };

  // ── Dust: kicked up landing and taking off, behind a speeder ──
  const DUST = 160;
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST * 3), 3));
  const dustVel = new Float32Array(DUST * 3);
  const dustAge = new Float32Array(DUST).fill(99);
  const puff = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const dustMat = new THREE.PointsMaterial({ color: site.dust ?? site.ground.palette.high ?? '#d8c8a8', map: puff, size: 2.4, transparent: true, opacity: 0.5, depthWrite: false, sizeAttenuation: true });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);
  let dustNext = 0;
  const kick = (x, y, z, spread, up = 2) => {
    const i = dustNext++ % DUST;
    const a = r() * Math.PI * 2;
    dustGeo.attributes.position.setXYZ(i, x + Math.cos(a) * spread * 0.3, y + 0.2, z + Math.sin(a) * spread * 0.3);
    dustVel.set([Math.cos(a) * spread * (0.6 + r()), up * (0.3 + r()), Math.sin(a) * spread * (0.6 + r())], i * 3);
    dustAge[i] = 0;
  };
  const stepDust = (dt) => {
    const p = dustGeo.attributes.position;
    let any = false;
    for (let i = 0; i < DUST; i++) {
      if (dustAge[i] > 3) {
        if (p.getY(i) > -1e5) p.setY(i, -1e6);
        continue;
      }
      any = true;
      dustAge[i] += dt;
      const k = Math.exp(-dt * 1.4);
      dustVel[i * 3] *= k;
      dustVel[i * 3 + 1] = dustVel[i * 3 + 1] * k - 0.4 * dt;
      dustVel[i * 3 + 2] *= k;
      p.setXYZ(i, p.getX(i) + dustVel[i * 3] * dt, p.getY(i) + dustVel[i * 3 + 1] * dt, p.getZ(i) + dustVel[i * 3 + 2] * dt);
    }
    p.needsUpdate = true;
    dustMat.opacity = any ? 0.5 : 0;
  };

  // ── Input ──
  const onKey = (down) => (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
    const k = KEYS[e.key.toLowerCase()];
    if (e.key === 'Tab' && down) {
      e.preventDefault();
      swap();
      return;
    }
    if (!k) return;
    if (k === 'jump' || k === 'up' || k === 'down') e.preventDefault();
    if (down && !e.repeat) {
      sounds.start();
      if (state.phase === 'landing') skipLanding();
      if (k === 'jump') state.jumpQueued = true;
      if (k === 'act') state.actQueued = true;
      if (k === 'fire') state.fireQueued = true;
    }
    state.keys[k] = down;
    ctx.invalidate();
  };
  const keyDown = onKey(true);
  const keyUp = onKey(false);
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  const blur = () => (state.keys = {});
  window.addEventListener('blur', blur);
  // a drag looks round
  let dragging = null;
  const down = (e) => {
    if (e.pointerType === 'touch') return; // (the page's own look pad, on a phone)
    dragging = { x: e.clientX, y: e.clientY, id: e.pointerId };
    sounds.start();
    canvas.setPointerCapture?.(e.pointerId);
    if (state.phase === 'landing') skipLanding();
  };
  const move = (e) => {
    if (!dragging || e.pointerId !== dragging.id) return;
    look(e.clientX - dragging.x, e.clientY - dragging.y);
    dragging.x = e.clientX;
    dragging.y = e.clientY;
  };
  const up = (e) => {
    if (dragging && e.pointerId === dragging.id) dragging = null;
  };
  const wheel = (e) => {
    e.preventDefault();
    state.cam.dist = clamp(state.cam.dist * (e.deltaY > 0 ? 1.12 : 1 / 1.12), CAM.near, CAM.far);
    ctx.invalidate();
  };
  canvas.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  canvas.addEventListener('wheel', wheel, { passive: false });
  function look(dx, dy) {
    state.cam.yaw -= dx * 0.0055;
    state.cam.pitch = clamp(state.cam.pitch + dy * 0.0045, CAM.pitch[0], CAM.pitch[1]);
    state.cam.drag = state.t;
    ctx.invalidate();
  }

  // ── Doing things ──
  function skipLanding() {
    if (state.phase !== 'landing' || state.age < 0.6) return;
    state.age = LAND.descend + LAND.settle;
  }
  function swap() {
    if (state.phase !== 'walk') return;
    lead = 1 - lead;
    const a = people[lead].st;
    state.cam.yaw = a.yaw;
    emit({ type: 'swap', who: people[lead].spec.id });
  }
  const me = () => people[lead];
  const other = () => people[1 - lead];

  // what E does here, now
  const target = () => {
    const p = me().st;
    if (state.phase === 'ride') return state.riding.state.speed < 7 && !chaseOn() ? { kind: 'dismount', text: `Get off ${state.riding.spec.name}` } : null;
    if (state.phase !== 'walk') return null;
    // a quest's thing to do here
    const step = state.quest && questOf(state.quest.id)?.steps[state.quest.step];
    if (step?.type === 'use' && Math.hypot(p.x - step.at[0], p.z - step.at[1]) < (step.r ?? 3)) return { kind: 'use', id: step.id, text: step.prompt ?? 'Use' };
    // the way out of where you are, or into somewhere
    if (state.zone) {
      const ex = state.zone.inside.exit;
      if (Math.hypot(p.x - (state.zone.origin[0] + ex.at[0]), p.z - (state.zone.origin[2] + ex.at[1])) < (ex.r ?? 2.5)) return { kind: 'leave', text: `Leave ${state.zone.name}` };
    } else
      for (const z of site.zones) if (Math.hypot(p.x - z.door.at[0], p.z - z.door.at[1]) < (z.door.r ?? 3)) return { kind: 'enter', zone: z, text: z.door.prompt ?? `Go into ${z.name}` };
    // the ship
    const sx = p.x - landAt[0];
    const sz = p.z - landAt[1];
    if (!state.zone && Math.hypot(sx, sz) < Math.max(shipBox.w, shipBox.l) + 3.5) return { kind: 'board', text: 'Get in and take off' };
    let best = null;
    let bestD = REACH;
    for (const x of rides) {
      const d = Math.hypot(p.x - x.state.x, p.z - x.state.z) - x.spec.radius;
      if (d < bestD) {
        best = { kind: 'mount', ridee: x, text: `Ride ${x.spec.name}` };
        bestD = d;
      }
    }
    if (best) return best;
    const a = life.talker(p.x, p.z, REACH, p.y);
    if (a) return { kind: 'talk', actor: a, text: `Talk to ${a.spec.named ? '' : 'the '}${a.spec.name ?? a.spec.kind}` };
    return null;
  };

  // ── Quests ──
  // the door into somewhere a step's inside of, when you're not in it
  const doorFor = (step) => {
    const zid = step?.zone ?? (step?.type === 'talk' ? life.find(step.actor)?.spec.zone : null);
    if (!zid || state.zone?.id === zid) return null;
    return site.zones.find((z) => z.id === zid)?.door.at ?? null;
  };
  // where someone is (for a talk step's marker)
  const actorAt = (id) => {
    const a = life.find(id);
    return a ? [a.b.x, a.b.z] : null;
  };
  // lines: a list, or a list for each ship's crew ({ xwing, falcon, …, all })
  const linesFor = (lines) => (Array.isArray(lines) ? lines : lines ? [...(lines.all ?? []), ...(lines[shipKind] ?? [])] : null);
  const say = (raw) => {
    const lines = linesFor(raw);
    if (lines?.length) emit({ type: 'say', lines: lines.map((l) => (Array.isArray(l) ? { who: l[0], text: l[1] } : { who: null, text: l })) });
  };
  const announce = () => {
    const q = state.quest && questOf(state.quest.id);
    const step = q?.steps[state.quest.step];
    emit({ type: 'quest', id: q?.id ?? null, name: q?.name ?? null, text: q ? stepText(q, state.quest) : null, left: step?.time ? Math.max(0, Math.ceil(step.time - state.quest.time)) : null, shoot: step?.type === 'shoot' });
  };
  // what you've got on your back (a step's { carry: kind }: Yoda, on
  // Dagobah's run), a prop of that kind peering over your shoulder; each
  // built once and kept (the kit owns what it's made of, and lets it go
  // with the scene), so carrying it again doesn't build another
  const carriable = new Map();
  let carried = null;
  function carry(kind) {
    carried?.removeFromParent();
    carried = null;
    if (!kind || !PROPS[kind]) return;
    if (!carriable.has(kind)) {
      const o = PROPS[kind](kit, {}).object;
      o.position.set(0, 1.0, -0.3);
      carriable.set(kind, o);
    }
    carried = carriable.get(kind);
    me().holder.add(carried);
  }
  // what a step does as it starts or ends: a trapdoor opens, a gate comes
  // down, the band strikes up, someone's gone, you're thrown out
  function effects(list) {
    for (const e of list ?? []) {
      if (e.signal) placer.signal(e.signal, e.on ?? true);
      if (e.floor) for (const f of world.floors) if (f.tag === e.floor) f.off = Boolean(e.off);
      if (e.solid) for (const x of world.solids.all) if (x.tag === e.solid) x.off = Boolean(e.off);
      if (e.kill) activity.kill(e.kill);
      if (e.hide) life.hide(e.hide, true);
      if (e.show) life.hide(e.show, false);
      if (e.music !== undefined) sounds.music?.(e.music);
      if (e.sound) sounds[e.sound]?.();
      if (e.shake) state.shake = Math.min(1, state.shake + e.shake);
      if (e.say) say(e.say);
      if (e.leave) leaveZone();
      if ('carry' in e) carry(e.carry);
      if (e.to) {
        const p = me().st;
        putAt(p, e.to[0], e.to[1], e.yaw);
        camInit = false;
      }
    }
  }
  function beginQuest(q) {
    if (!q || state.done.has(q.id) || state.quest) return;
    state.quest = startQuest(q);
    say(q.intro);
    effects(q.steps[0].start);
    say(q.steps[0].lines);
    activity.show(q, state.quest);
    announce();
    emit({ type: 'questStart', id: q.id });
  }
  function questEvent(ev) {
    if (!state.quest) return;
    const q = questOf(state.quest.id);
    const was = state.quest;
    const { progress, out } = feed(state.quest, q, ev);
    state.quest = progress;
    for (const o of out) {
      if (o.type === 'step') {
        effects(q.steps[o.step - 1].end);
        effects(q.steps[o.step].start);
        say(q.steps[o.step].lines);
      }
      if (o.type === 'done') {
        effects(q.steps.at(-1).end);
        effects(q.end);
        state.done.add(q.id);
        say(q.done);
        emit({ type: 'questDone', id: q.id, achievement: q.achievement ?? null });
        if (q === mission?.quest) endMission('won');
      }
      if (o.type === 'fail') {
        emit({ type: 'questFail', id: q.id, why: o.why });
        if (q === mission?.quest) endMission('lost', o.why);
      }
    }
    if (out.length || (ev.type === 'tick' && Math.ceil(was.time) !== Math.ceil(progress?.time ?? 0))) announce();
    activity.show(q, state.quest);
  }
  const act = (tg) => {
    if (!tg) return;
    if (tg.kind === 'talk') {
      const spec = tg.actor.spec;
      // (what they offer now: their next quest not done, or their last, done)
      const offered = nextQuest(spec, state.done) ?? questsOf(spec).at(-1);
      const q = offered && questOf(offered);
      const step = state.quest && questOf(state.quest.id)?.steps[state.quest.step];
      if (q && !state.done.has(q.id) && !state.quest) beginQuest(q);
      else if (step?.type === 'talk' && step.actor === spec.id) questEvent({ type: 'talk', actor: spec.id });
      else {
        const line = life.say(tg.actor);
        if (line) emit({ type: 'talk', ...line });
        else if (q && state.done.has(q.id)) say(q.after ?? [[spec.name, 'Thanks again.']]);
      }
    } else if (tg.kind === 'use') questEvent({ type: 'use', id: tg.id });
    else if (tg.kind === 'enter') enterZone(tg.zone);
    else if (tg.kind === 'leave') leaveZone();
    else if (tg.kind === 'mount') {
      state.riding = tg.ridee;
      state.phase = 'ride';
      state.cam.dist = tg.ridee.spec.cam[0];
      emit({ type: 'phase', phase: 'ride', kind: tg.ridee.kind });
      questEvent({ type: 'mount', kind: tg.ridee.kind });
    } else if (tg.kind === 'dismount') {
      const x = state.riding;
      const p = me().st;
      const side = new V(Math.cos(x.state.yaw), 0, -Math.sin(x.state.yaw));
      p.x = x.state.x + side.x * (x.spec.radius + 0.9);
      p.z = x.state.z + side.z * (x.spec.radius + 0.9);
      p.y = groundAt(world, p.x, p.z);
      p.vx = p.vz = p.vy = 0;
      p.grounded = true;
      x.state.speed = 0;
      state.riding = null;
      state.phase = 'walk';
      state.cam.dist = CAM.dist;
      emit({ type: 'phase', phase: 'walk' });
    } else if (tg.kind === 'board') board();
  };
  // into the ship and up: the climb out (stepLeaving; the page hands over to
  // space as it goes, and 'leave' at the end is for a page that can't)
  function board() {
    if (state.phase !== 'walk') return false;
    state.phase = 'leaving';
    state.age = 0;
    for (const q of people) q.holder.visible = false;
    ship.park?.(false);
    emit({ type: 'phase', phase: 'leaving' });
    return true;
  }

  // ── Going in and out ──
  let shadows = sun.castShadow; // (outdoors: the tier's, until lowerQuality)
  const outdoors = { sun: sun.intensity, second: second?.intensity ?? 0, sky: hemi.color.clone(), ground: hemi.groundColor.clone(), ambient: hemi.intensity, fog: scene.fog.color.clone(), density: scene.fog.density, env: scene.environmentIntensity };
  function lighting(z) {
    const L = z?.inside.light;
    sun.intensity = z ? 0 : outdoors.sun;
    if (second) second.intensity = z ? 0 : outdoors.second;
    hemi.color.set(L?.sky ?? outdoors.sky);
    hemi.groundColor.set(L?.ground ?? outdoors.ground);
    hemi.intensity = z ? (L?.ambient ?? 0.4) : outdoors.ambient;
    scene.fog.color.set(L?.fog ?? outdoors.fog);
    scene.fog.density = z ? (L?.density ?? 0.02) : outdoors.density;
    scene.environmentIntensity = z ? 0.15 : outdoors.env;
    sky.mesh.visible = !z;
    if (weather) weather.group.visible = !z;
    if (water) water.mesh.visible = !z;
    // (inside, the world outside isn't drawn, and outside, no room is)
    ground.visible = !z;
    if (water?.glow) water.glow.visible = !z;
    placer.setZone(Boolean(z));
    life.setZone(Boolean(z));
    // (indoors, the room's lamps and no sun to cast a shadow; outdoors, the sun's
    // shadow unless the frame rate has had it off, lowerQuality)
    sun.castShadow = !z && shadows;
    lamps.forEach((l, i) => {
      const d = z?.inside.lamps?.[i];
      l.intensity = d ? d[4] : 0;
      l.visible = Boolean(d);
      if (d) {
        l.position.set(z.origin[0] + d[0], z.origin[1] + d[1], z.origin[2] + d[2]);
        l.color.set(d[3]);
        l.distance = d[5] ?? 30;
      }
    });
  }
  const putAt = (st, x, z, yaw) => {
    st.x = x;
    st.z = z;
    st.y = groundAt(world, x, z);
    st.vx = st.vz = st.vy = 0;
    st.grounded = true;
    if (yaw != null) st.yaw = yaw;
  };
  function enterZone(z) {
    const p = me().st;
    state.outside = [p.x, p.z, p.yaw];
    state.zone = z;
    world.reach = Infinity;
    const [sx, sz] = z.inside.spawn ?? [0, 0];
    putAt(p, z.origin[0] + sx, z.origin[2] + sz, z.inside.yaw ?? 0);
    putAt(other().st, z.origin[0] + sx + 1.2, z.origin[2] + sz - 1, z.inside.yaw ?? 0);
    state.cam.yaw = p.yaw;
    state.cam.dist = Math.min(state.cam.dist, 3.4);
    camInit = false;
    lighting(z);
    sounds.music(z.music ?? null);
    emit({ type: 'zone', id: z.id, name: z.name });
    questEvent({ type: 'enter', zone: z.id });
  }
  function leaveZone() {
    const z = state.zone;
    if (!z) return;
    state.zone = null;
    world.reach = site.reach;
    const [bx, bz] = z.back ?? z.door.at;
    const yaw = state.outside?.[2] ?? 0;
    putAt(me().st, bx, bz, yaw + Math.PI);
    putAt(other().st, bx + 1.2, bz + 1, yaw + Math.PI);
    state.cam.yaw = yaw + Math.PI;
    state.cam.dist = CAM.dist;
    camInit = false;
    lighting(null);
    sounds.music(site.music ?? null);
    emit({ type: 'zone', id: null });
  }

  // ── A chase (missions/chase.js): the scouts, drawn and run here ──
  const chase = mission?.kind === 'chase' ? createChaseMission({ parent: scene, world, placer, blaster, mission, emit, say, sounds }) : null;
  // (on from the start, before the trees are in and it's begun, until it's
  // won or lost: no getting off the bike before then)
  const chaseOn = () => Boolean(chase && !chase.view()?.result);
  let chaseViewAt = -1;

  // ── A quest mission (missions/index.js): the quest engine runs it, this
  // keeps its clock and says how it ended ──
  let run = null;
  const runOn = () => Boolean(run && !run.result);
  function beginMission() {
    if (mission?.kind !== 'quest') return;
    state.quest = null;
    state.done.delete(mission.quest.id);
    activity.show(null, null);
    effects(mission.reset);
    run = newRun();
    say(mission.lines?.start);
    beginQuest(mission.quest);
    emit({ type: 'mission', view: run });
  }
  function endMission(how, why) {
    if (!runOn()) return;
    run = endRun(run, mission, how, why);
    if (how !== 'won') {
      state.quest = null;
      activity.show(null, null);
      announce();
    }
    say(mission.lines?.[how]);
    emit({ type: 'mission', event: { type: how }, view: run });
  }

  // ── Shooting, and being shot ──
  const camDir = new V();
  function fire() {
    const p = me().st;
    if (state.t - state.firedAt < FIRE_EVERY) return;
    // on a bike in a chase: its cannon, from the nose, where you're looking
    if (state.phase === 'ride' && chase) {
      if (state.t - state.firedAt < BIKE_FIRE_EVERY || !chase.running()) return;
      state.firedAt = state.t;
      camera.getWorldDirection(camDir);
      const b = state.riding.state;
      chase.fire(new V(b.x + Math.sin(b.yaw) * 1.8, b.y + 0.7, b.z + Math.cos(b.yaw) * 1.8), camDir, me().spec.bolt ?? '#ff3b30');
      emit({ type: 'fire' });
      return;
    }
    if (state.phase !== 'walk') return;
    state.firedAt = state.t;
    camera.getWorldDirection(camDir);
    p.yaw = Math.atan2(camDir.x, camDir.z);
    const right = new V(-Math.cos(p.yaw), 0, Math.sin(p.yaw));
    const from = new V(p.x, p.y + 1.35, p.z).addScaledVector(right, -0.25).addScaledVector(camDir, 0.5);
    // (what it hits is decided now, from your eyes' line; the bolt leaves the
    // muzzle once you've turned to it this frame, place() then shot())
    const gp = me().gp;
    state.aim = 1;
    state.aimDir.copy(camDir);
    if (gp) {
      state.shot = { from, dir: camDir.clone() };
      return;
    }
    const hit = blaster.fire(from, camDir, activity.targets, me().spec.bolt ?? '#ff3b30');
    if (hit.target) activity.hit(hit.target, 1);
    landed(hit, camDir);
    sounds.blast?.();
    emit({ type: 'fire' });
  }
  // the shot fired with the gun up: out of the muzzle, a flash, smoke and
  // brass from a powder gun, the gun's own sound, the view kicked a touch
  function shot() {
    const o = state.shot;
    state.shot = null;
    const p = me();
    if (!o || !p.gp) return;
    const r = p.gp.fire();
    const hit = blaster.fire(o.from, o.dir, activity.targets, p.spec.bolt ?? '#ff3b30', undefined, r.muzzle);
    if (hit.target) activity.hit(hit.target, 1);
    const spec = p.gp.spec;
    const out = hit.at.clone().sub(r.muzzle).normalize();
    fx.flash(r.muzzle, out, spec.flash);
    if (spec.smoke) fx.smoke(r.muzzle, out, spec.smoke);
    if (spec.casing && r.eject) fx.casing(r.eject, new V(-1, 0, 0).transformDirection(r.gun.matrixWorld), UP);
    landed(hit, out, r.muzzle);
    if (!reduced) state.kick.v += spec.kick.up;
    gunSound(p.spec.gun);
    emit({ type: 'fire' });
  }
  // where a shot lands, when it gets there: sparks off it, and on the ground a burn
  const impacts = [];
  function landed(hit, dir, from = null) {
    const d = from ? from.distanceTo(hit.at) : 30;
    if (d >= 89) return; // (out of range: it went nowhere)
    impacts.push({ t: state.t + d / 140, at: hit.at.clone(), dir: dir.clone(), ground: !hit.target });
  }
  function stepImpacts() {
    for (let i = impacts.length - 1; i >= 0; i--) {
      const o = impacts[i];
      if (state.t < o.t) continue;
      impacts.splice(i, 1);
      const p = me().st;
      const near = 1 - Math.min(1, Math.hypot(o.at.x - p.x, o.at.z - p.z) / 40);
      if (near > 0) impactSound(Math.max(0.15, near));
      if (o.ground) {
        const n = world.normalAt ? new V(...world.normalAt(o.at.x, o.at.z)) : UP.clone();
        o.at.y = groundAt(world, o.at.x, o.at.z, o.at.y + 0.5);
        fx.sparks(o.at, n.clone().addScaledVector(o.dir, -0.6).normalize(), me().spec.bolt ?? '#ffd0a0', 12);
        fx.scorch(o.at, n);
      } else fx.sparks(o.at, o.dir.clone().negate(), me().spec.bolt ?? '#ffd0a0', 9);
    }
  }
  function hurt(n) {
    state.health = Math.max(0, state.health - n);
    state.hurtAt = state.t;
    state.shake = Math.min(1, state.shake + 0.3);
    emit({ type: 'health', value: state.health });
    if (state.health > 0) return;
    if (chaseOn()) {
      state.health = 100;
      emit({ type: 'health', value: 100 });
      chase.knocked();
      return;
    }
    if (runOn()) {
      state.health = 100;
      emit({ type: 'health', value: 100 });
      endMission('lost', 'down');
      return;
    }
    // down: back on your feet where the quest's step began (or by the ship)
    state.health = 100;
    emit({ type: 'health', value: 100 });
    emit({ type: 'down' });
    if (state.quest) {
      state.quest = { ...state.quest, count: 0, time: 0 };
      const q = questOf(state.quest.id);
      activity.show(null, null);
      activity.show(q, state.quest);
      announce();
    }
    const p = me().st;
    const step = state.quest && questOf(state.quest.id)?.steps[state.quest.step];
    if (step?.respawn) putAt(p, step.respawn[0], step.respawn[1]);
    else if (!state.zone) putAt(p, spawnAt[0], spawnAt[1]);
  }

  // ── Each frame ──
  const tmp = new V();
  const flash = { k: 0 };

  function input() {
    const k = state.keys;
    let x = (k.right ? 1 : 0) - (k.left ? 1 : 0) + state.stick.x;
    let y = (k.up ? 1 : 0) - (k.down ? 1 : 0) + state.stick.y;
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    const run = Boolean(k.run || state.buttons.run || Math.hypot(state.stick.x, state.stick.y) > 0.92);
    return { x, y, run, heading: state.cam.yaw };
  }

  function stepLanding(dt) {
    state.age += dt;
    const k = clamp(state.age / LAND.descend, 0, 1);
    const e = ease(k);
    // along, and down (most of the drop near the end)
    const pos = shipFrom.clone().lerp(shipLanded, e);
    pos.y = shipLanded.y + (shipFrom.y - shipLanded.y) * (1 - k) ** 2.2;
    shipHolder.position.copy(pos);
    shipTilt.rotation.x = (1 - k) * 0.12 - Math.sin(k * Math.PI) * 0.05 + (k > 0.85 ? (k - 0.85) * -0.6 : 0);
    shipTilt.rotation.z = Math.sin(state.age * 0.9) * 0.03 * (1 - k);
    ship.setThrottle?.(0.3 + (1 - k) * 0.7);
    engineOn((1 - k) * 60 + 8);
    // dust as it comes in over the ground
    const over = pos.y - groundAt(world, pos.x, pos.z);
    if (over < 30) for (let i = 0; i < 3; i++) kick(pos.x, groundAt(world, pos.x, pos.z), pos.z, 14 * (1 - over / 30) + 2, 3);
    if (state.age >= LAND.descend + LAND.settle) {
      state.phase = 'out';
      state.age = 0;
      shipHolder.position.copy(shipLanded);
      shipTilt.rotation.set(0, 0, 0);
      ship.park?.(true);
      engine?.set({ speed: 0, on: false });
      solidShip();
      for (const p of people) p.holder.visible = true;
      emit({ type: 'phase', phase: 'out' });
    }
  }

  function stepLeaving(dt) {
    state.age += dt;
    const k = clamp(state.age / LEAVE.lift, 0, 1);
    const lift = ease(k) * 26;
    const away = Math.max(0, state.age - LEAVE.lift);
    const fwd = new V(Math.sin(site.land.yaw), 0, Math.cos(site.land.yaw));
    shipHolder.position.copy(shipLanded).add(new V(0, lift + away * away * 22, 0)).addScaledVector(fwd, away * away * 60);
    shipTilt.rotation.x = -Math.min(0.5, away * 0.35);
    ship.setThrottle?.(0.6 + Math.min(1, away));
    engineOn(20 + away * 60);
    if (lift < 20) for (let i = 0; i < 3; i++) kick(shipLanded.x, shipLanded.y, shipLanded.z, 16 - lift * 0.5, 3);
    if (state.age > LEAVE.lift + LEAVE.away && !state.left) {
      state.left = true;
      emit({ type: 'leave' });
    }
  }

  function stepWalk(dt) {
    const inp = input();
    const p = me().st;
    const o = walk(p, { ...inp, jump: state.jumpQueued }, dt, world);
    life.shove(p, WALK.radius);
    // (and out of whatever's parked: a speeder, a tauntaun)
    for (const x of rides) {
      const dx = p.x - x.state.x;
      const dz = p.z - x.state.z;
      const d = Math.hypot(dx, dz);
      const min = x.spec.radius * 0.8 + WALK.radius;
      if (d < min && d > 1e-6) {
        p.x = x.state.x + (dx / d) * min;
        p.z = x.state.z + (dz / d) * min;
      }
    }
    if (o.bumped && Math.hypot(p.x, p.z) > world.reach - 1 && state.t - state.edgeAt > 8) {
      state.edgeAt = state.t;
      emit({ type: 'edge' });
    }
    if (site.fall != null && p.y < site.fall) {
      // over the edge: back where you landed
      p.x = spawnAt[0];
      p.z = spawnAt[1];
      p.y = groundAt(world, ...spawnAt);
      p.vy = 0;
      emit({ type: 'fell' });
    }
    // your crewmate keeps up: a step behind, beside you
    const q = other().st;
    const behind = new V(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
    const side = new V(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
    const goal = [p.x + behind.x * 1.1 + side.x * 1.7, p.z + behind.z * 1.1 + side.z * 1.7];
    const gd = Math.hypot(goal[0] - q.x, goal[1] - q.z);
    if (gd > 40) {
      q.x = goal[0];
      q.z = goal[1];
      q.y = groundAt(world, q.x, q.z);
    }
    const toward = gd > 0.8 ? Math.atan2(goal[0] - q.x, goal[1] - q.z) : q.yaw;
    const mag = gd > 0.8 ? clamp((gd - 0.6) / 2, 0, 1) : 0;
    walk(q, { x: 0, y: mag, heading: toward, run: gd > 7, jump: false }, dt, world);
    if (mag === 0) q.yaw = turnToward(q.yaw, p.yaw, dt * 2);
    // footprints and marks, and footsteps
    if (p.grounded && p.speed > 0.5 && site.ground.palette.mark && r() < dt * 6) marks.dab(p.x, p.z, 0.7, 0.18);
    if (p.grounded) {
      strode += p.speed * dt;
      const stride = p.speed > WALK.walk + 1 ? 1.25 : 0.8;
      if (strode > stride) {
        strode = 0;
        sounds.step(p.speed > WALK.walk + 1 ? 1.3 : 1);
      }
    }
    if (o.landed > 3) sounds.step(1.6);
  }

  function stepRide(dt) {
    const x = state.riding;
    const inp = chase?.stalled() ? { x: 0, y: 0, run: false } : input();
    const o = ride(x.state, { ...inp, x: inp.x, y: inp.y, jump: state.jumpQueued }, dt, world, x.spec);
    if (o.hit > 20 && chaseOn()) chase.knocked();
    if (o.hit > 6) {
      state.shake = Math.min(1, o.hit / 20);
      emit({ type: 'bump', hard: o.hit > 14 });
    }
    // you, on it
    const p = me().st;
    p.x = x.state.x;
    p.z = x.state.z;
    p.y = x.state.y;
    p.yaw = x.state.yaw;
    // dust behind a fast one, a trail where it marks the ground
    const fast = Math.abs(x.state.speed);
    if (fast > 6 && x.spec.hover > 0 && r() < dt * fast * 0.6) kick(x.state.x, groundAt(world, x.state.x, x.state.z), x.state.z, 3, 1.4);
    if (x.spec.trail && fast > 2) marks.dab(x.state.x, x.state.z, 2.4, Math.min(0.5, fast / 40));
    // your crewmate waits where you got on
    const q = other().st;
    walk(q, { x: 0, y: 0, heading: q.yaw }, dt, world);
  }

  function place(dt) {
    // the people
    people.forEach((pp, i) => {
      const st = pp.st;
      pp.holder.position.set(st.x, st.y, st.z);
      pp.holder.rotation.y = st.yaw;
      if (state.phase === 'ride' && i === lead) {
        const x = state.riding;
        const seat = x.spec.seat;
        const yaw = x.state.yaw;
        pp.holder.position.set(x.state.x + seat[0] * Math.cos(yaw) + seat[2] * Math.sin(yaw), x.state.y + seat[1] - 0.55, x.state.z - seat[0] * Math.sin(yaw) + seat[2] * Math.cos(yaw));
        pp.holder.rotation.set(x.state.pitch * -1, yaw, x.state.bank, 'YXZ');
        pp.fig?.update(dt, 0);
      } else {
        pp.holder.rotation.set(0, st.yaw, 0);
        // going which way, how fast, turning, off the ground (locomotion.js
        // works in the universe map's units: METRE to the metre)
        fwdV.set(Math.sin(st.yaw), 0, Math.cos(st.yaw));
        rightV.set(-Math.cos(st.yaw), 0, Math.sin(st.yaw));
        const turn = pp.prevYaw == null || dt <= 0 ? 0 : wrap(st.yaw - pp.prevYaw) / dt;
        pp.prevYaw = st.yaw;
        const air = st.grounded ? 0 : Math.max(0, st.y - groundAt(world, st.x, st.z, st.y));
        const mine = i === lead;
        const motion = { speed: (st.vx * fwdV.x + st.vz * fwdV.z) * METRE, side: (st.vx * rightV.x + st.vz * rightV.z) * METRE, turn, air, hurt: mine ? Math.max(0, 1 - (state.t - state.hurtAt) / 0.35) : 0, knock: 0.5 };
        pp.fig?.update(dt, clamp(st.speed / WALK.run, 0, 1), motion);
        pp.holder.updateMatrixWorld(true);
        pp.fig?.after?.(dt, motion, { forward: fwdV, up: UP });
        const drop = pp.fig?.loco?.drop ?? 0;
        if (drop > 1e-7) {
          pp.holder.position.y -= drop / METRE;
          pp.holder.updateMatrixWorld(true);
        }
      }
      // the gun: up along your aim while there's shooting, carried otherwise; put away to ride
      if (pp.gp) {
        const riding = state.phase === 'ride' && i === lead;
        pp.gp.gun.visible = !riding;
        if (!riding) pp.gp.set(dt, { aim: i === lead ? state.aim : 0, look: i === lead ? state.aim : 0, dir: i === lead && state.aim > 0 ? state.aimDir : null, forward: fwdV.set(Math.sin(st.yaw), 0, Math.cos(st.yaw)), up: UP });
      }
    });
    // what you can ride
    for (const x of rides) {
      const s = x.state;
      if (state.riding !== x) {
        // parked: hovering where it's left, bobbing
        s.y += (groundAt(world, s.x, s.z) + (x.spec.hover ?? 0) * 0.75 - s.y) * Math.min(1, dt * 3);
        s.bank *= 0.95;
      }
      x.holder.position.set(s.x, s.y + (x.spec.hover > 0 ? Math.sin(state.t * 2 + s.x) * 0.04 : 0), s.z);
      x.holder.rotation.set(-s.pitch, s.yaw, -s.bank, 'YXZ');
      x.fig?.update(dt, clamp(Math.abs(s.speed) / 6, 0, 1));
    }
  }

  function follow(dt) {
    const c = state.cam;
    const p = me().st;
    const riding = state.phase === 'ride';
    const focus = new V(p.x, p.y + (riding ? 1.6 : CAM.up), p.z);
    // behind you as you go, unless you've been looking round
    const moving = riding ? Math.abs(state.riding.state.speed) > 1 : p.speed > 0.6 && input().y > 0.2;
    if (moving && state.t - c.drag > 1.6) {
      const want = riding ? state.riding.state.yaw + (state.riding.state.speed < 0 ? Math.PI : 0) : p.yaw;
      c.yaw += wrap(want - c.yaw) * Math.min(1, dt * (riding ? 2.6 : 1.1));
      if (riding) c.pitch += (0.16 - c.pitch) * Math.min(1, dt * 1.5);
    }
    const dist = c.dist * (riding ? 1 + Math.min(0.35, Math.abs(state.riding.state.speed) / 120) : 1);
    const back = new V(-Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), -Math.cos(c.yaw) * Math.cos(c.pitch));
    const want = focus.clone().addScaledVector(back, dist);
    // never under the ground
    const floor = (state.zone ? groundAt(world, want.x, want.z, p.y + 0.6, 0) : groundAt(world, want.x, want.z, want.y + 2, 4)) + 0.5;
    if (want.y < floor) want.y = floor;
    if (!camInit) {
      camPos.copy(want);
      camLook.copy(focus);
      camInit = true;
    }
    // inside, the camera keeps inside the walls (of the room you're in,
    // where it has rooms: [x, z, hw, hd, floor, ceiling], relative to it)
    if (state.zone?.inside.bounds) {
      const o = state.zone.origin;
      const lx = p.x - o[0];
      const lz = p.z - o[2];
      const ly = p.y - o[1];
      const room = state.zone.inside.rooms?.find(([x, z, hw, hd, y0, y1]) => Math.abs(lx - x) <= hw && Math.abs(lz - z) <= hd && ly >= y0 - 0.5 && ly < y1);
      const [cx, cz, hw, hd, y0, y1, round] = room ?? [0, 0, ...state.zone.inside.bounds.slice(0, 2), 0, state.zone.inside.bounds[2]];
      if (round) {
        // (a round room: inside its circle)
        const dx = want.x - o[0] - cx;
        const dz = want.z - o[2] - cz;
        const d = Math.hypot(dx, dz);
        if (d > hw - 0.5) {
          want.x = o[0] + cx + (dx / d) * (hw - 0.5);
          want.z = o[2] + cz + (dz / d) * (hw - 0.5);
        }
      } else {
        want.x = clamp(want.x, o[0] + cx - hw + 0.4, o[0] + cx + hw - 0.4);
        want.z = clamp(want.z, o[2] + cz - hd + 0.4, o[2] + cz + hd - 0.4);
      }
      want.y = clamp(want.y, o[1] + y0 + 0.4, o[1] + y1 - 0.4);
    }
    camPos.lerp(want, 1 - Math.exp(-dt * (riding ? 9 : 12)));
    camLook.lerp(focus, 1 - Math.exp(-dt * 14));
    camera.position.copy(camPos);
    if (state.shake > 0) {
      camera.position.x += (r() - 0.5) * state.shake * 0.4;
      camera.position.y += (r() - 0.5) * state.shake * 0.4;
      state.shake = Math.max(0, state.shake - dt * 2.5);
    }
    camera.lookAt(camLook);
    if (Math.abs(state.kick.x) > 1e-4) camera.rotateX(state.kick.x * 0.04); // your own shot's kick
  }

  // watching the ship come in (or go), from beside where it lands
  const watchFrom = shipLanded.clone().add(new V(Math.cos(site.land.yaw) * 38 + Math.sin(site.land.yaw) * 30, 7, -Math.sin(site.land.yaw) * 38 + Math.cos(site.land.yaw) * 30));
  watchFrom.y = Math.max(watchFrom.y, groundAt(world, watchFrom.x, watchFrom.z) + 3);
  function watch(dt, k = 1) {
    camPos.lerp(watchFrom, k);
    tmp.copy(shipHolder.position).add(new V(0, 2, 0));
    camLook.lerp(tmp, 1 - Math.exp(-dt * 6));
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  // places: found as you come near; the one you're in
  function places() {
    const p = me().st;
    let here = null;
    for (const pl of site.places) {
      const d = Math.hypot(p.x - pl.at[0], p.z - pl.at[1]);
      if (d < pl.r) {
        here = pl.id;
        if (!state.found.has(pl.id)) {
          state.found.add(pl.id);
          emit({ type: 'found', id: pl.id });
        }
        // (a quest that starts when you get there)
        const q = site.quests.find((x) => x.place === pl.id);
        if (q && !state.quest && !state.done.has(q.id)) beginQuest(q);
      }
    }
    if (here !== state.here) {
      state.here = here;
      emit({ type: 'here', id: here });
    }
  }

  // the compass: each place's mark slid along the bar to its bearing
  let compassW = 0;
  let compassT = 0;
  // (the page told only what's changed: a style written is a style the
  // browser works out again)
  const styled = new WeakMap();
  const setStyle = (m, key, v) => {
    let had = styled.get(m);
    if (!had) styled.set(m, (had = {}));
    if (had[key] === v) return;
    had[key] = v;
    m.style[key] = v;
  };
  let compassMarks = [];
  function compass() {
    const el = props.compass?.current;
    if (!el) return;
    if (!compassW || state.t - compassT > 2) {
      compassW = el.clientWidth;
      compassT = state.t;
      compassMarks = [...el.querySelectorAll('[data-id]')];
    }
    const p = me().st;
    const span = Math.PI * 0.75; // the bar's half-width, in radians
    for (const m of compassMarks) {
      const id = m.dataset.id;
      let at;
      if (id === 'quest' && chase && chaseOn()) {
        at = chase.target(p.x, p.z);
        if (!at) {
          setStyle(m, 'opacity', '0');
          continue;
        }
      } else if (id === 'quest') {
        const q = state.quest && questOf(state.quest.id);
        const step = q?.steps[state.quest.step];
        const giver = !step && state.tracked ? life.actors.find((x) => questsOf(x.spec).includes(state.tracked)) : null;
        at = step ? (doorFor(step) ?? stepTarget(step, state.quest, actorAt)) : giver ? (giver.spec.zone && state.zone?.id !== giver.spec.zone ? site.zones.find((z) => z.id === giver.spec.zone)?.door.at : [giver.b.x, giver.b.z]) : null;
        if (!at || state.zone) {
          setStyle(m, 'opacity', '0');
          continue;
        }
      } else if (id === 'ship') at = landAt;
      else if (id === 'n') at = [p.x, p.z + 1000];
      else if (id === 'e') at = [p.x - 1000, p.z];
      else if (id === 's') at = [p.x, p.z - 1000];
      else if (id === 'w') at = [p.x + 1000, p.z];
      else at = site.places.find((q) => q.id === id)?.at;
      if (!at) continue;
      const a = wrap(Math.atan2(at[0] - p.x, at[1] - p.z) - state.cam.yaw);
      const x = (-a / span) * 0.5 * compassW;
      const on = Math.abs(a) < span;
      setStyle(m, 'transform', `translateX(${x.toFixed(1)}px)`);
      setStyle(m, 'opacity', on ? (1 - (Math.abs(a) / span) ** 3).toFixed(2) : '0');
      const d = m.querySelector('.d');
      if (d && (state.t * 4) % 1 < 0.3) d.textContent = `${Math.round(Math.hypot(at[0] - p.x, at[1] - p.z))} m`;
    }
  }

  const size = { w: 1, h: 1 };
  let shown = true;
  function render(ms, now) {
    state.frames = (state.frames ?? 0) + 1;
    tick(Math.min(0.05, ms / 1000));
    draw(now);
    return shown && !disposed;
  }

  // the world moving on by dt seconds
  function tick(dt) {
    state.t += dt;
    const t = state.t;

    if (state.phase === 'landing') {
      stepLanding(dt);
      watch(dt, 1 - Math.exp(-dt * 3));
    } else if (state.phase === 'leaving') {
      stepLeaving(dt);
      watch(dt, 1 - Math.exp(-dt * 1.5));
    } else {
      if (state.phase === 'out') {
        state.age += dt;
        if (state.age > LAND.out) {
          state.phase = 'walk';
          emit({ type: 'phase', phase: 'walk' });
        }
      }
      if (state.phase === 'ride') stepRide(dt);
      else stepWalk(dt);
      follow(dt);
      if (state.phase === 'walk' || state.phase === 'ride') {
        const tg = target();
        const text = tg?.text ?? null;
        if (text !== state.prompt) {
          state.prompt = text;
          emit({ type: 'prompt', text });
        }
        if (state.actQueued) act(tg);
        places();
      }
    }
    // the blaster (F, held to keep firing)
    if ((state.fireQueued || state.keys.fire || state.buttons.fire) && (state.phase === 'walk' || (state.phase === 'ride' && chase))) fire();
    state.fireQueued = false;
    // the chase: on with it, and a shove when you ride into one
    if (chase && (state.phase === 'walk' || state.phase === 'ride')) {
      const b = state.riding ? state.riding.state : me().st;
      const { push } = chase.update(dt, { x: b.x, y: b.y, z: b.z, vx: b.vx ?? 0, vz: b.vz ?? 0 });
      if (push) {
        b.vx += push[0];
        b.vz += push[1];
        state.shake = Math.min(1, state.shake + 0.5);
      }
      if (state.t - chaseViewAt > 0.1) {
        chaseViewAt = state.t;
        emit({ type: 'mission', view: chase.view() });
      }
    }
    // a quest mission's clock
    if (runOn() && (state.phase === 'walk' || state.phase === 'ride')) {
      run = tickRun(run, dt);
      if (state.t - chaseViewAt > 0.1) {
        chaseViewAt = state.t;
        emit({ type: 'mission', view: run });
      }
    }
    // the quest: its clock, where you are, what's out there for it
    if (state.quest && (state.phase === 'walk' || state.phase === 'ride')) {
      const p = me().st;
      questEvent({ type: 'tick', dt });
      questEvent({ type: 'at', x: p.x, z: p.z, riding: state.riding?.kind ?? null });
    }
    for (const ev of activity.update(dt, state.phase === 'walk' || state.phase === 'ride' ? me().st : null, state.t, { actors: actorAt, door: doorFor })) questEvent(ev);
    if (state.phase === 'walk' || state.phase === 'ride')
      for (const s of activity.shooters(dt, me().st)) {
        if (s.melee) {
          // a swipe: knocked back, away from it
          const p = me().st;
          const away = Math.atan2(p.x - s.from[0], p.z - s.from[2]);
          p.vx += Math.sin(away) * 6;
          p.vz += Math.cos(away) * 6;
          p.vy = 3;
          p.grounded = false;
          state.shake = 1;
          sounds.roar?.();
          hurt(s.damage);
        } else blaster.enemy(s.from, new V(me().st.x, me().st.y + 1.1, me().st.z), s.spread, '#ff4a3d', s.damage);
      }
    const hit = blaster.update(dt, state.phase === 'walk' || state.phase === 'ride' ? me().st : null);
    if (hit) hurt(hit);
    if (state.health < 100 && state.t - state.hurtAt > 4) {
      state.health = Math.min(100, state.health + dt * 12);
      if (Math.round(state.health) % 10 === 0) emit({ type: 'health', value: Math.round(state.health) });
    }
    // the marks over whoever has a quest to give
    for (const a of life.actors) {
      if (!a.spec.quest) continue;
      const q = nextQuest(a.spec, state.done);
      let m = givers.find((g) => g.a === a);
      if (!m) {
        m = { a, sprite: new THREE.Sprite(markMat) };
        m.sprite.scale.set(0.6, 0.6, 1);
        scene.add(m.sprite);
        givers.push(m);
      }
      const on = q && !state.quest && a.fig;
      m.sprite.visible = Boolean(on);
      if (on) m.sprite.position.set(a.b.x, a.holder.position.y + (a.fig.tall ?? 1.8) * (a.spec.scale ?? 1) + 0.6 + Math.sin(state.t * 3) * 0.08, a.b.z);
    }
    state.jumpQueued = false;
    state.actQueued = false;
    place(dt);
    shot();
    stepImpacts();
    fx.update(dt);
    spring(state.kick, dt, 240, 22);
    state.aim = Math.max(0, state.aim - dt / 2.5);
    life.update(dt, state.phase === 'walk' ? me().st : null, state.phase === 'walk' || state.phase === 'ride' ? me().st : camera.position);
    placer.update(t, dt, me().st);
    stepDust(dt);
    storm(dt);
    online(dt);
    sounds.update(dt, { riding: state.phase === 'ride' ? Math.abs(state.riding.state.speed) + 1 : 0 });
    marks.flush();
    ship.update?.(t);

    // ships over
    if (!reduced && site.flyovers.length && t > nextFlight && state.phase !== 'landing') {
      flyover(site.flyovers[Math.floor(r() * site.flyovers.length)]);
      const spec = site.flyovers[0];
      nextFlight = t + (spec.every ?? 60) * (0.6 + r() * 0.8);
    }
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      f.age += dt;
      f.m.group.position.addScaledVector(f.dir, f.speed * dt);
      f.m.update?.(t);
      const d = f.m.group.position.distanceTo(camera.position);
      if (!f.heard && d < 400) {
        f.heard = true;
        flybySound(f.kind);
      }
      if (f.age > f.life) {
        scene.remove(f.m.group);
        f.m.dispose?.();
        disposeTree(f.m.group);
        flights.splice(i, 1);
      }
    }
  }

  // what goes out to the others online: your two, where they are (or
  // nothing, while the ship's coming down or going)
  function online(dt) {
    const net = props.net;
    if (!net) return;
    const out = state.phase === 'walk' || state.phase === 'ride' || state.phase === 'out';
    const w = (p) => ({ who: p.spec.id, x: p.st.x, y: p.st.y, z: p.st.z, yaw: p.st.yaw, speed: state.phase === 'ride' && p === me() ? state.riding.state.speed : p.st.speed, aim: p === me() ? state.aim : 0 });
    net.walk?.(out ? { world: site.id, kind: shipKind, lead: w(me()), mate: w(other()), ride: state.riding?.kind ?? null } : null);
    peers.update(net, site.id, dt);
  }

  // lightning (Kamino's storms): a flash across the sky now and
  // then, lighting everything up for a moment
  let nextBolt = 4 + r() * 6;
  function storm(dt) {
    if (!site.lightning || reduced) return;
    if (state.t > nextBolt) {
      flash.k = 1;
      nextBolt = state.t + (site.lightning.every ?? 8) * (0.4 + r() * 1.2);
    }
    flash.k = Math.max(0, flash.k - dt * (flash.k > 0.5 ? 6 : 2.5));
    // (a flicker, not a fade)
    const k = flash.k * (0.6 + 0.4 * Math.sin(state.t * 90));
    hemi.intensity = (site.light.ambient ?? 0.9) + k * (site.lightning.strength ?? 2.5);
  }

  const snapped = new V();
  function draw(now) {
    const t = state.t;
    // the sun (and its shadows) follow you about
    // (snapped to whole texels of the shadow map along its right and up, so the
    // shadows don't crawl as you walk: shadow.js)
    const focus = me().st;
    snapped.set(focus.x, focus.y, focus.z);
    const [sr, su] = snapToTexel(snapped.dot(shadowRight), snapped.dot(shadowUp), SHADOW.extent, SHADOW.map);
    const along = snapped.dot(sunDir);
    snapped.copy(sunDir).multiplyScalar(along).addScaledVector(shadowRight, sr).addScaledVector(shadowUp, su);
    sun.position.copy(snapped).addScaledVector(sunDir, 300);
    sun.target.position.copy(snapped);
    sky.update(camera, t, flash.k);
    water?.update(t);
    weather?.update(t, camera, world.heightAt, size.h);
    compass();
    const tPost = performance.now();
    post.render(size.w, size.h);
    if (import.meta.env.DEV) state.ms = { js: Math.round(tPost - now), post: Math.round(performance.now() - tPost) };
  }

  if (import.meta.env.DEV) window.__surfaceScene = { scene, post, renderer };

  // ── Ready ──
  const ready = (async () => {
    // (the props' scanned surfaces on before their shaders are made, so
    // they're made once)
    await Promise.all([placer.ready.catch(() => {}), kit.ready.catch(() => {})]);
    // (the scouts' way is planned round the trees, so once they're down)
    if (!disposed) chase?.begin();
    if (!disposed) beginMission();
    // (both ways the lights can be, so a door doesn't stall on new shaders: the
    // lamps lit and the sun's shadow off, as in a room, then as outdoors)
    const inside = Boolean(state.zone);
    if (site.zones.length && !disposed) {
      for (const l of lamps) l.visible = true;
      sun.castShadow = false;
      await warm(scene).catch(() => {});
      for (const l of lamps) l.visible = false;
      sun.castShadow = shadows;
      if (inside) lighting(state.zone);
    }
    if (!disposed) await warm(scene).catch(() => {});
  })();
  emit({ type: 'phase', phase: state.phase });

  return {
    ready,
    resize(w, h) {
      size.w = Math.max(1, w);
      size.h = Math.max(1, h);
      camera.aspect = size.w / size.h;
      camera.fov = size.w < size.h ? 72 : 60;
      camera.updateProjectionMatrix();
      compassW = 0;
    },
    render,
    update(next) {
      props = next;
      for (const id of next.found ?? []) state.found.add(id);
      for (const id of next.done ?? []) state.done.add(id);
    },
    setVisible(on) {
      shown = on;
    },
    // still slow at the lowest sharpness (the watchdog, useScene): no sun shadow,
    // and the post without its bloom (the grade kept, so the colours stay right)
    lowerQuality() {
      shadows = false;
      sun.castShadow = false;
      post.lite();
    },
    // from the page's touch controls
    input: {
      stick(x, y) {
        state.stick.x = x;
        state.stick.y = y;
        ctx.invalidate();
      },
      look,
      press(name) {
        sounds.start();
        if (state.phase === 'landing') skipLanding();
        if (name === 'jump') state.jumpQueued = true;
        if (name === 'act') state.actQueued = true;
        if (name === 'run') state.buttons.run = true;
        if (name === 'fire') state.buttons.fire = true;
        if (name === 'swap') swap();
        ctx.invalidate();
      },
      release(name) {
        if (name === 'run') state.buttons.run = false;
        if (name === 'fire') state.buttons.fire = false;
      },
      // the quest list: follow one (its giver on the compass; one with
      // nobody to give it starts), or drop the one you're on
      track(id) {
        const q = questOf(id);
        if (!q || state.done.has(id)) return;
        state.tracked = id;
        if (!q.giver && !q.place && !state.quest) beginQuest(q);
      },
      // a mission again, from the start, on the bike
      restart() {
        if (!chase && !run) return;
        const p = me().st;
        leaveZone();
        if (!mission.ride) {
          // on foot, back at the start: off anything you've got on
          if (state.phase === 'ride') {
            state.riding.state.speed = 0;
            state.riding = null;
            state.phase = 'walk';
            state.cam.dist = CAM.dist;
            emit({ type: 'phase', phase: 'walk' });
          }
          putAt(p, mission.start[0], mission.start[1], mission.yaw);
          state.cam.yaw = mission.yaw;
          camInit = false;
          state.health = 100;
          emit({ type: 'health', value: 100 });
          beginMission();
          return;
        }
        const x = rides[rides.length - 1];
        // (back on the mission's own ride, off any other)
        if (state.riding !== x) {
          if (state.riding) state.riding.state.speed = 0;
          state.riding = x;
          state.phase = 'ride';
          state.cam.dist = x.spec.cam[0];
          emit({ type: 'phase', phase: 'ride', kind: x.kind });
        }
        Object.assign(x.state, { x: mission.start[0], z: mission.start[1], y: groundAt(world, mission.start[0], mission.start[1]) + x.spec.hover, yaw: mission.yaw, speed: 0, vx: 0, vz: 0, vy: 0, bank: 0 });
        p.x = x.state.x;
        p.z = x.state.z;
        state.cam.yaw = mission.yaw;
        camInit = false;
        state.health = 100;
        emit({ type: 'health', value: 100 });
        if (chase) chase.restart();
        else beginMission();
      },
      drop() {
        if (!state.quest || runOn()) return;
        state.quest = null;
        activity.show(null, null);
        announce();
      },
    },
    // back to the ship and up, from anywhere outdoors on foot: true once the climb's begun
    takeOff() {
      if (state.zone || state.phase !== 'walk') return false;
      return board();
    },
    // (for tests: the world moved on without drawing it, in steps)
    advance(secs) {
      if (!import.meta.env.DEV) return;
      for (let i = 0; i < secs * 30; i++) tick(1 / 30);
      ctx.invalidate();
    },
    // (for tests: finish the chase, 'win' or 'lose')
    missionDo(how) {
      if (!import.meta.env.DEV) return null;
      if (how === 'audit') return chase?.audit() ?? null;
      if (run) {
        // (a quest mission: 'win', 'lose', or 'skip' the step you're on)
        if (how === 'win') endMission('won');
        else if (how === 'lose') endMission('lost', 'time');
        else if (how === 'skip' && state.quest) {
          const step = mission.quest.steps[state.quest.step];
          if (step.type === 'race') for (const g of step.gates.slice(state.quest.count)) questEvent({ type: 'at', x: g[0], z: g[1], riding: step.ride });
          else if (step.type === 'use') questEvent({ type: 'use', id: step.id });
          else if (step.type === 'reach') questEvent({ type: 'at', x: step.at[0], z: step.at[1], riding: state.riding?.kind ?? null });
          else if (step.type === 'shoot') activity.kill(step.tag);
        }
        ctx.invalidate();
        return run;
      }
      if (how === 'near' && state.riding) {
        const b = chase?.behind();
        if (b) {
          Object.assign(state.riding.state, { x: b.x, z: b.z, yaw: b.yaw, y: groundAt(world, b.x, b.z) + state.riding.spec.hover, speed: 30, vx: Math.sin(b.yaw) * 30, vz: Math.cos(b.yaw) * 30 });
          state.cam.yaw = b.yaw;
          camInit = false;
        }
        return b;
      }
      chase?.force(how);
      ctx.invalidate();
      return null;
    },
    // (for tests: pretend others are down here: [{ id, name, walk }])
    fakePeers(list) {
      if (!import.meta.env.DEV) return;
      const at = performance.now();
      const net = { peers: new Map(list.map((p) => [p.id, { ...p, walk: { ...p.walk, at } }])) };
      props = { ...props, net: { ...net, walk() {} } };
    },
    // (for tests: put you somewhere, facing somewhere)
    // (dev: into a zone by its id, or out of the one you're in)
    zone(id = null) {
      const z = id && site.zones.find((o) => o.id === id);
      if (z) enterZone(z);
      else leaveZone();
    },
    teleport(x, z, yaw = null) {
      if (!import.meta.env.DEV) return;
      const p = me().st;
      p.x = x;
      p.z = z;
      p.y = groundAt(world, x, z, 1e4, 1e4);
      if (yaw != null) {
        p.yaw = yaw;
        state.cam.yaw = yaw;
      }
      camInit = false;
      ctx.invalidate();
    },
    // (for tests: where you are, what's going on)
    debug: () => ({ ship: { at: shipHolder.position.toArray().map((v) => +v.toFixed(1)), y: +ship.group.position.y.toFixed(2), box: [+shipBox.w.toFixed(1), +shipBox.l.toFixed(1)], visible: ship.group.visible }, ms: state.ms, frames: state.frames, t: +state.t.toFixed(1), phase: state.phase, you: { ...me().st }, here: state.here, found: [...state.found], prompt: state.prompt, riding: state.riding?.kind ?? null, quest: state.quest, zone: state.zone?.id ?? null, health: state.health, mission: chase?.view() ?? run }),
    dispose() {
      disposed = true;
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('wheel', wheel);
      engine?.stop();
      props.net?.walk?.(null);
      sounds.dispose();
      peers.dispose();
      activity.dispose();
      chase?.dispose();
      blaster.dispose();
      markMat.map.dispose();
      markMat.dispose();
      life.dispose();
      placer.dispose();
      shadowPhase?.dispose();
      for (const p of people) {
        p.gp?.dispose();
        p.fig?.dispose?.();
      }
      fx.dispose();
      cast?.dispose();
      ship.dispose();
      for (const s of skyships) s.dispose?.();
      for (const f of flights) f.m.dispose?.();
      weather?.dispose();
      water?.dispose();
      sky.dispose();
      marks.dispose();
      puff.dispose();
      env.dispose();
      kit.dispose();
      disposeTree(scene);
      post.dispose();
      Object.assign(renderer.shadowMap, shadowMapWas);
      canvas.removeAttribute('aria-hidden');
    },
  };
}

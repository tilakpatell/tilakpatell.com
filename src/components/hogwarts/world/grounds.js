// The grounds and the castle outside, put together for the world module
// (module.js): the land baked (land.js), the ground drawn far and near
// (ground.js, cells.js), what grows on it (scatter.js through the kit’s
// pools, canopy.js past their reach), the Black Lake and its squid
// (lake.js), the sky and the day (sky.js, daylight.js on rules/clock.js),
// the weather (weather.js on rules/weather.js), the castle near and far
// (castle/castle.js) and its doors (castle/doors.js), and the sound
// (ambience.js). The module owns the scene, the camera, the walk and the
// HUD; this owns everything you see outside and the light it is seen in.
//
// Built over a few frames’ worth of time before it is shown (the runtime
// shows its loading screen while `create` is awaited), each step handing
// the browser back its turn, so the page never freezes.
//
//   createGrounds(rt, { scene, camera, tier, house, hour, week, day, rate, onBuild, skip }) → Promise<{
//     step(dt, { at: [x, y, z], act, awake }) → { prompt, enter, toast }   (a door’s prompt, a room to go into, a line to show)
//     beforeDraw(renderer)   called by the module’s draw before its chain renders (the lake’s mirror)
//     groundAt(x, z, y) → the height a figure stands at there (the ground, or a deck or a stair near y)
//     colliders() → what can’t be walked through (plan.js’s footprints, the shut gates)
//     places, hour, light, weather, clock,
//     setHour(h), setWeek(w), setRate(k),
//     passes: the post chain for rt.gfx.post (hooks.js’s chainFor),
//     stats(), dispose() }>

import * as THREE from 'three';
import { uniform } from 'three/tsl';
import { loadKit } from '../../../lib/three/kitNodes';
import { loadGltf } from '../../../lib/three/gltf';
import { createWind } from '../../../lib/three/windNodes';
import { createGrass } from '../../../lib/three/grassNodes';
import { onColor } from '../../../lib/three/hookNodes';
import { dot, mix, positionWorld, smoothstep, vec3 } from 'three/tsl';
import { ARRIVE, hourOf, light as lightAt, newClock, setHour, step as stepClock, strikes } from '../rules/clock';
import { weatherAt } from '../rules/weather';
import { PLACES, placeById } from '../rules/places';
import { heightAt } from './terrain';
import { landJob } from './land';
import { createGroundMaps, createGroundMaterial, farGeometry } from './ground';
import { createCells } from './cells';
import { createScatter } from './scatter';
import { createCanopy } from './canopy';
import { REFLECTED, createLake } from './lake';
import { createSky } from './sky';
import { createDaylight } from './daylight';
import { createWeather } from './weather';
import { createAmbience } from './ambience';
import { chainFor, gradeNode, tierOf } from './hooks';
import { createCastle } from './castle/castle';
import { createDoors } from './castle/doors';
import { floorAt } from './castle/plan';

const LIGHT_EVERY = 0.1; // s between the light’s updates (a world minute is a real second: no one sees a tenth of it)
const BLADES = { mid: { side: 160, size: 38 }, high: { side: 220, size: 44 }, ultra: { side: 240, size: 46 } };
const LUMA = vec3(0.2126, 0.7152, 0.0722);

// The kit’s models with every packed vertex attribute widened to floats:
// the MegaKit’s files are meshopt-quantized (positions as 16-bit triples,
// the wind’s weight as a byte), which WebGL reads and WebGPU has no vertex
// format for, so on WebGPU no tree drew. Widened once, in the page’s cached
// model (a few hundred kilobytes more on the graphics chip).
function widened(root) {
  root?.traverse?.((o) => {
    const g = o.geometry;
    if (!g || g.userData.widened) return;
    for (const [name, a] of Object.entries(g.attributes)) {
      if (!a.isInterleavedBufferAttribute && a.array instanceof Float32Array) continue;
      const out = new Float32Array(a.count * a.itemSize);
      const get = [a.getX, a.getY, a.getZ, a.getW];
      for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = get[k].call(a, i);
      g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
    }
    g.userData.widened = true;
  });
  return root;
}
const loadWide = (url) => loadGltf(url).then((got) => (got ? (widened(got.scene), got) : got));

// a turn back to the browser between the build’s steps
const breathe = () => new Promise((r) => setTimeout(r, 0));
async function runSliced(job, ms = 30) {
  for (;;) {
    const t0 = performance.now();
    for (;;) {
      const r = job.next();
      if (r.done) return r.value;
      if (performance.now() - t0 > ms) break;
    }
    await breathe();
  }
}

export async function createGrounds(rt, { scene, camera, tier = 'high', house = null, hour = ARRIVE, week = 1, day = 0, rate = 1, onBuild = () => {}, skip = [] } = {}) {
  // (`skip`: parts left out, for the checks that measure what each costs: 'reflection', 'blades', 'shadows', or a pass of the chain by its kind)
  const off = new Set(skip);
  const T = { ...tierOf(tier) };
  if (off.has('reflection')) T.reflection = false;
  if (off.has('blades')) T.blades = false;
  if (off.has('shadows')) T.shadows = 0;
  const renderer = rt?.gfx?.renderer ?? null;
  const t0 = performance.now();
  const timings = {};
  const mark = (name, since) => (timings[name] = Math.round(performance.now() - since));

  // the land, baked a slice at a time
  let since = performance.now();
  const land = await runSliced(landJob());
  mark('land', since);
  onBuild(0.3, 'land');

  since = performance.now();
  const maps = createGroundMaps(land, { tier });
  mark('maps', since);
  if (house) house.ground(maps.groundMap, { height: 1.4, strength: 0.35 });
  onBuild(0.5, 'ground');
  await breathe();

  // the far ground, and the near cells’ material
  const farMat = createGroundMaterial({ house, groundMap: maps.groundMap, coverMap: maps.coverMap, tier, sink: true });
  const nearMat = createGroundMaterial({ house, groundMap: maps.groundMap, coverMap: maps.coverMap, tier });
  const farMesh = new THREE.Mesh(farGeometry(land, { tier }), farMat.material);
  farMesh.name = 'hogwarts:ground';
  farMesh.receiveShadow = T.shadows > 0;
  farMesh.layers.enable(REFLECTED);
  scene.add(farMesh);

  // the wind, the kits, the scatter and the canopy past its reach
  const windTime = { value: 0 };
  const wind = createWind({ strength: 0.45 });
  const kits = new Map();
  const kitFor = (tint, pack = null) => {
    const kit = pack ?? 'naturemega';
    const key = `${kit}|${tint ? JSON.stringify(tint) : ''}`;
    if (!kits.has(key)) kits.set(key, loadKit(kit, { house, wind: { time: windTime }, tint, ...(rt?.gfx?.backend === 'webgpu' ? { load: loadWide } : {}) }));
    return kits.get(key);
  };
  const scatter = createScatter({ kitFor, tier });
  scene.add(scatter.group);
  since = performance.now();
  const canopy = createCanopy({ land, house, tier });
  canopy.mesh.layers.enable(REFLECTED);
  scene.add(canopy.mesh);
  mark('canopy', since);
  const cells = createCells({ land, tier, scatter, material: nearMat.material, far: farMat, exact: heightAt, layer: REFLECTED });
  scene.add(cells.group);
  onBuild(0.65, 'castle');
  await breathe();

  // the castle near and far, its doors
  since = performance.now();
  const castle = createCastle({ house, tier, ground: heightAt });
  scene.add(castle.group, castle.far);
  castle.far.layers.enable(REFLECTED);
  castle.group.traverse((o) => o.isMesh && o.layers.enable(REFLECTED));
  const doors = createDoors({ materials: castle.materials, ground: heightAt });
  scene.add(doors.group);
  mark('castle', since);
  await breathe();

  // the sky, the light, the lake, the weather
  const sky = createSky();
  sky.mesh.layers.enable(REFLECTED);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.name = 'hogwarts:sun';
  const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x3d4a2c, 0.6);
  scene.add(sky.mesh, sun, sun.target, hemi);
  // (the lights on the mirror’s layer too: what it draws is lit)
  sun.layers.enable(REFLECTED);
  hemi.layers.enable(REFLECTED);
  if (!scene.fog) scene.fog = new THREE.FogExp2(0x9aa4b0, 0.0015);
  const daylight = createDaylight({ scene, renderer, house, sky, sun, hemi });
  const lake = createLake({ camera, sky, groundMap: maps.groundMap, tier, reflection: T.reflection });
  scene.add(lake.mesh, lake.squid);
  if (lake.target) scene.add(lake.target);
  const uNight = uniform(0);
  const passes = chainFor(tier, rt?.gfx?.backend, { scene, camera, grade: (tex) => gradeNode(tex, uNight) }).filter((p) => !off.has(p.kind));
  const has = (kind) => passes.some((p) => p.kind === kind);
  const weather = createWeather(renderer, { tier, outputs: [has('ao') && 'normal', has('traa') && 'velocity'].filter(Boolean), groundMap: maps.groundMap });
  scene.add(weather.group);
  const ambience = createAmbience(rt);

  // the grass close round you, on mid and up
  let blades = null;
  if (T.blades && BLADES[tier]) {
    const patch = BLADES[tier];
    const grass = createGrass({ ground: maps.groundMap, wind, side: patch.side, size: patch.size, height: 0.42, width: 0.09, root: 0.72, near: 4.5, faceCamera: true });
    grass.mesh.name = 'hogwarts:blades';
    const noise = wind.uniforms.uWindNoise;
    // (a little greyed, in slow lighter and darker patches, here and there gone dry, as the Road’s are)
    onColor(
      grass.material,
      (d) => {
        const grey = mix(vec3(dot(d.rgb, LUMA)), d.rgb, 0.85);
        const lit = noise.sample(positionWorld.xz.mul(0.021)).r;
        const dry = smoothstep(0.58, 0.82, noise.sample(positionWorld.xz.mul(0.0083).add(0.37)).r);
        return mix(grey, grey.mul(vec3(1.18, 1.06, 0.62)), dry.mul(0.6)).mul(lit.mul(0.36).add(0.82));
      },
      'grounds:blades',
      { ...wind.uniforms },
    );
    grass.mesh.receiveShadow = T.shadows >= 60;
    scene.add(grass.mesh);
    const centre = new THREE.Vector3();
    blades = { grass, update: (x, z) => grass.update(centre.set(x, 0, z)) };
  }

  // the sun’s soft shadows through cascades round the camera, on mid and up (the Road’s, lib/three/light/sun.js)
  const shadowWas = renderer?.shadowMap ? { enabled: renderer.shadowMap.enabled, type: renderer.shadowMap.type } : null;
  let cascades = null;
  let unlit = false;
  if (T.shadows > 0 && renderer?.shadowMap) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    sun.castShadow = true;
    sun.shadow.radius = 1.5;
    // (waited for, a few seconds at most, before the grounds are shown: a
    // shadow node coming in after the first frames remade every pipeline
    // that takes it, and one still being made the old way then failed)
    const made = import('../../../lib/three/light/sun')
      .then(async ({ castCascades }) => {
        if (unlit) return;
        const c = await castCascades(sun, null, { tier, filter: null, video: { shadowDistance: T.shadows, cascades: 2 } });
        if (unlit) c?.dispose();
        else cascades = c;
      })
      .catch(() => {});
    await Promise.race([made, new Promise((r) => setTimeout(r, 3000))]);
  }
  if (house) house.adopt(scene);

  // the day
  let clock = newClock({ hour, day, rate });
  let termWeek = week;
  let w = weatherAt({ week: termWeek, day, hour });
  let l = lightAt(hour, { week: termWeek, day, weather: w });
  let sinceLight = Infinity;
  let cold = 0; // (the dementors’ cold, 0…1: the module’s, from Lane F’s rules/dementors.js)
  const relight = () => {
    const h = hourOf(clock);
    const d = Math.floor(clock.t / 24);
    w = weatherAt({ week: termWeek, day: d, hour: h });
    l = lightAt(h, { week: termWeek, day: d, weather: w });
    daylight.set(l, { cold });
    lake.set(l, { wind: w.wind, rain: w.rain });
    weather.set(w, l);
    sky.wind(0.6 + w.wind);
    farMat.uniforms.uSnow.value = nearMat.uniforms.uSnow.value = w.lying;
    farMat.uniforms.uWet.value = nearMat.uniforms.uWet.value = Math.max(w.rain, w.mist * 0.3);
    uNight.value = l.windows;
    ambience.set({ wind: w.wind, rain: w.rain, night: l.sun.el < -0.05 ? 1 : 0 });
  };
  relight();
  daylight.follow(camera);
  cells.at(camera.position.x, camera.position.z);
  onBuild(0.9, 'light');
  mark('total', t0);

  const clockTower = placeById('clock-tower').at;
  let adoptIn = 1;
  return {
    passes,
    get hour() {
      return hourOf(clock);
    },
    get light() {
      return l;
    },
    get weather() {
      return w;
    },
    get clock() {
      return clock;
    },
    places: PLACES,
    // (the sky, for the arrival’s moon over the Astronomy Tower)
    sky,
    land,
    castle,
    doors,
    lake,
    cells,
    // (`forward`: never back, the hour today if it’s still to come, else tomorrow’s)
    setHour(h, { forward = false } = {}) {
      clock = setHour(clock, h, { forward });
      sinceLight = Infinity;
    },
    // the clock going on while the grounds aren’t drawn (a room’s up): the hour, the bell’s count, nothing else
    pass(dt) {
      clock = stepClock(clock, dt);
    },
    // the cold off the dementors, 0…1: the house look’s shade drained toward grey with it
    setCold(k) {
      if (Math.abs(k - cold) < 0.01) return;
      cold = k;
      sinceLight = Infinity;
    },
    setWeek(k) {
      termWeek = Math.min(12, Math.max(1, Math.round(k)));
      sinceLight = Infinity;
    },
    setRate(k) {
      clock = { ...clock, rate: Math.max(0, k) };
    },
    groundAt(x, z, y = null) {
      const g = heightAt(x, z);
      if (y == null) return g;
      // (a deck or a stair’s step near your height is what you stand on, over the ground or cut into it)
      return floorAt(castle.floors, x, z, y) ?? g;
    },
    colliders: () => [...castle.colliders, ...doors.colliders()],
    // (before the frame’s chain draws: the lake’s mirror, on high)
    beforeDraw(renderer) {
      lake.reflect(renderer ?? rt?.gfx?.renderer, scene, camera);
    },
    step(dt, { at = null, act = false, awake = false } = {}) {
      const was = clock.t;
      clock = stepClock(clock, dt);
      if ((sinceLight += dt) >= LIGHT_EVERY) {
        sinceLight = 0;
        relight();
      }
      // the bell on the hour, louder the nearer the clock tower
      const n = strikes(was, clock.t);
      if (n) {
        const p = at ?? camera.position.toArray();
        const d = Math.hypot(p[0] - clockTower[0], p[2] - clockTower[1]);
        ambience.strike(n, Math.max(0, 1 - d / 900));
      }
      if (awake) ambience.wake();
      const p = at ?? [camera.position.x, camera.position.y, camera.position.z];
      ambience.set({ height: p[1], water: Math.max(0, 1 - Math.max(0, land.shoreAt(p[0], p[2])) / 60) });
      ambience.update(dt);
      castle.update(dt, camera, { hour: hourOf(clock), night: l.windows, snow: w.lying, wet: w.rain });
      cells.at(camera.position.x, camera.position.z);
      cells.step();
      windTime.value += dt;
      wind.update(dt);
      scatter.update(camera, dt);
      blades?.update(camera.position.x, camera.position.z);
      lake.update(dt);
      weather.update(dt, camera, { wind: null });
      sky.update(camera, dt);
      daylight.follow(camera);
      cascades?.follow?.();
      cascades?.update?.(camera);
      // (what the pools and the kits have brought in since, into the house’s look)
      if (house && (adoptIn -= dt) <= 0) {
        adoptIn = 1;
        house.adopt(scene);
      }
      return doors.step(dt, { at, act });
    },
    stats() {
      return { timings, cells: cells.built, wanted: cells.wanted, scatter: scatter.stats, castle: { ...castle.stats, near: castle.near }, canopy: canopy.triangles, weather: weather.stats(), ambience: ambience.stats(), hour: hourOf(clock), week: termWeek };
    },
    dispose() {
      unlit = true;
      cascades?.dispose?.();
      if (shadowWas && renderer) Object.assign(renderer.shadowMap, shadowWas);
      daylight.dispose();
      cells.dispose();
      scatter.dispose();
      for (const k of kits.values()) k.dispose();
      canopy.dispose();
      farMesh.geometry.dispose();
      farMat.dispose();
      nearMat.dispose();
      maps.dispose();
      castle.dispose();
      doors.dispose();
      lake.dispose();
      sky.dispose();
      weather.dispose();
      ambience.dispose();
      wind.dispose();
      blades?.grass.dispose();
    },
  };
}

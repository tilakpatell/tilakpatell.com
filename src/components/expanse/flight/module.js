// The flight over a planet (/fly/:planet) as a world module on the runtime:
// the ship under ./flightRules.js from the runtime's input snapshot, the
// scene round it (./scene.js), the planet's ground streamed in under it
// (./ground.js: leaves made in a worker through rt.workers), all drawn
// relative to the floating origin (rt.origin, moved after anchor() before
// each step). The planet comes in as props.spec
// (lib/land/flight/planetSpec.js's). It starts at lib/device's tier (the
// runtime's quality) and sheds uploads and clutter a tier at a time when
// the pace says the frames run late (lowerQuality).
//
// It tells the page through rt.events:
//   'hud' { speed, alt } (ten times a second at most)
//   'toast' { text } (a crash, a build)
//   'shared' { build, unbuild, shield, others, kept } (./shared.js's prompt, four times a second)
// and gives the page (and the checks) the world's `ship`, `stats()` and
// `throttle(v)` (the touch buttons'); ?debug shows the ground's numbers.

import * as THREE from 'three';
import { houseOn } from '../../../lib/three/houseNodes';
import { planetField } from '../../../lib/land/flight/field';
import { seeded } from '../../../lib/seeded';
import { LEVELS } from '../../../lib/device';
import { SHIP, crashed, stepShip } from './flightRules';
import { createFlightScene } from './scene';
import { createGround, heroOf } from './ground';
import { createMap } from './map';
import { createWater } from './water';
import { drawnAsClassic } from './drawn';
import { STRIP } from './look';
import { SHARED_KEYS, createSharedWorld } from './shared';
import { createFlightOnline } from './online';

export const KEYS = {
  noseDown: ['KeyW', 'ArrowUp'],
  noseUp: ['KeyS', 'ArrowDown'],
  rollLeft: ['KeyA'],
  rollRight: ['KeyD'],
  yawLeft: ['KeyQ', 'ArrowLeft'],
  yawRight: ['KeyE', 'ArrowRight'],
  faster: ['ShiftLeft', 'ShiftRight', 'KeyR'],
  // (Ctrl alone: the input drops a key held with Ctrl, so F is the one that works)
  slower: ['KeyF', 'ControlLeft', 'ControlRight'],
};
// (pitch −1 is the nose down, yaw +1 a turn to the left: flightRules.js's)
export const AXES = { pitch: ['noseDown', 'noseUp'], roll: ['rollLeft', 'rollRight'], yaw: ['yawRight', 'yawLeft'], throttle: ['slower', 'faster'] };

const HUD_EVERY = 0.1; // s
const ADOPT_EVERY = 12; // frames: what came into the scene put in the look within a fifth of a second

// where a place's buildings stand: a part's `count` of them seeded round the
// place, between `inner` and `outer` of its r (0.12 and 0.7 unless the part
// says), the centre part in its middle, the same every visit → [{ part, x, z, yaw }]
export function settle(poi, parts, rnd) {
  const out = [];
  for (const part of parts) {
    for (let k = 0; k < (part.count ?? 1); k++) {
      if (part.centre) {
        out.push({ part, x: poi.at[0], z: poi.at[1], yaw: part.yaw ?? 0 });
        continue;
      }
      const a = rnd() * Math.PI * 2;
      const d = ((part.inner ?? 0.12) + ((part.outer ?? 0.7) - (part.inner ?? 0.12)) * Math.sqrt(rnd())) * poi.r;
      out.push({ part, x: poi.at[0] + Math.cos(a) * d, z: poi.at[1] + Math.sin(a) * d, yaw: rnd() * Math.PI * 2 });
    }
  }
  return out;
}

// a model in a colour: a copy whose materials are copies with their colour
// multiplied by `tint` (the walkable site dresses these models in its scans;
// from the air a tint is what reads), made once a part, shared by its copies
export function tinted(root, tint) {
  const out = root.clone(true);
  const made = new Map();
  out.traverse((o) => {
    if (!o.isMesh) return;
    const was = o.material;
    if (!made.has(was)) {
      const m = was.clone();
      m.color?.multiply(new THREE.Color(tint));
      made.set(was, m);
    }
    o.material = made.get(was);
  });
  return out;
}

// the URLs to try for a planet's model, best first: on a strong machine the
// high-detail file the site carries (`hq`), then the lighter one for
// everyone. Both go through the galaxy's loader (rt.assets, lib/three/gltf),
// which is where any asset host is resolved
export const modelSources = (m, { strong }) => (strong && m.hq ? [`/${m.hq}`, m.url] : [m.url]);

// a landmark's model scaled so its length along `along` ('x', 'y', 'z', or
// 'max': its longest) is `metres`, its foot on y = 0 (the galaxy's models
// stand there, facing +z)
export function placeLandmark(root, { metres, along = 'x', yaw = 0 }) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const k = metres / Math.max(1e-3, along === 'max' ? Math.max(size.x, size.y, size.z) : size[along]);
  root.scale.setScalar(k);
  root.rotation.y = yaw;
  return root;
}
const RESPAWN_UP = 200; // m over the ground, after a crash
const START = { speed: 160, up: 300 };

// the tier the ground keeps at a pace level: one lower from the third step on, two at the floor
export function tierAt(tier, level = 0) {
  const i = Math.max(0, LEVELS.indexOf(tier));
  return LEVELS[Math.max(0, i - (level >= 4 ? 2 : level >= 2 ? 1 : 0))];
}

// where a planet's flight begins: south of its first POI, heading for it, or over the middle
export function spawnOf(spec, groundAt) {
  const poi = spec.pois?.[0];
  const [x, z] = poi ? [poi.at[0], poi.at[1] + 3400] : [0, 0];
  const g = groundAt(x, z);
  return { x, y: (Number.isFinite(g) ? g : 0) + START.up, z, pitch: 0, yaw: 0, roll: 0, speed: START.speed };
}

// the input snapshot as the ship's four axes, the touch stick added in
export function inputOf(snap) {
  const stick = snap?.stick ?? { x: 0, y: 0 };
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  return {
    pitch: clamp((snap?.axis?.('pitch') ?? 0) + stick.y),
    roll: clamp((snap?.axis?.('roll') ?? 0) + stick.x),
    yaw: snap?.axis?.('yaw') ?? 0,
    throttle: snap?.axis?.('throttle') ?? 0,
  };
}

export default {
  id: 'flight',
  shading: 'nodes', // (everything it reaches is TSL: ./nodes.js and lib/three's twins; the node renderer, on WebGPU or WebGL 2)
  mb: 22, // (WORLD_MB['/fly']: the scans a planet wears, Coruscant's models, the heaviest planet's landmarks)
  label: 'A ship flying low over an endless planet',
  async create(rt, props = {}) {
    const spec = props.spec;
    if (!spec) throw new Error('the flight needs a planet');
    let renderer = rt.gfx.renderer;
    const was = { toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure, shadows: renderer.shadowMap.enabled };
    renderer.shadowMap.enabled = false;

    // (the house before the ground: the kits' pools are made in its look, and
    // the landmarks' placer takes it when it is first asked for; the node
    // renderer has no frame guard to put the look on as a thing first draws)
    let house = null;
    const view = createFlightScene({ spec, palette: STRIP, house: () => house });
    // (its fog mixed as the classic renderer mixed it, after the frame's
    // tone mapping, for everything the house adopts or makes: ./drawn.js)
    house = drawnAsClassic(houseOn({ renderer, scene: view.scene, sun: view.sun, hemi: view.hemi, look: { fog: true } }));
    house.adopt(view.scene);
    const tier = LEVELS.includes(rt.quality?.tier) ? rt.quality.tier : 'mid';
    const ground = createGround(view.scene, { rt, spec, tier, palette: STRIP, house });
    // the planet map's rasters, asked of the ground's worker behind its leaves (./map.js; the HUD draws it)
    const map = createMap({ spec, workers: rt.workers });
    const water = createWater(view.scene, spec);
    // the planet's models (Coruscant's: the Senate, the Jedi Temple, its
    // nearest towers), fetched behind the first frames; a planet without
    // them, or a fetch that fails, flies on without
    const strong = tier === 'high' || tier === 'ultra';
    let gone = false;
    const fetchModel = async (urls) => {
      for (const url of urls) {
        const got = await Promise.resolve(rt.assets?.gltf?.(url)).catch(() => null);
        if (got?.scene) return got;
      }
      return null;
    };
    for (const l of spec.landmarks ?? []) {
      const poi = spec.pois.find((p) => p.id === l.at);
      if (!poi) continue;
      const spots = settle(poi, l.parts, seeded(spec.seed ^ l.id.length * 7919));
      for (const part of l.parts) {
        fetchModel(modelSources(part, { strong })).then((got) => {
          if (!got || gone) return;
          const model = part.tint ? tinted(got.scene, part.tint) : got.scene;
          for (const at of spots.filter((x) => x.part === part)) {
            const obj = placeLandmark(model.clone(true), { ...part, yaw: at.yaw });
            obj.name = `flight-${l.id}`;
            // (inside the place's r its ground is flat at its h: the field says so exactly)
            obj.position.set(at.x, field.heightAt(at.x, at.z) + (part.lift ?? 0), at.z);
            ground.root.add(obj);
            house?.adopt(obj);
          }
        });
      }
    }
    // (the film-made tower only where the tier can take a few hundred of it)
    if (spec.hero && tier !== 'low')
      fetchModel(modelSources(spec.hero, { strong })).then((got) => {
        const made = got && !gone ? heroOf(got.scene) : null;
        const mesh = made ? ground.heroTower(made) : null;
        if (mesh) house?.adopt(mesh);
      });
    // the planet's own field, here on the page, for where to start and to come
    // back up to before the ground under the ship is in (a few samples, not a mesh)
    const field = planetField(spec);
    const groundAt = (x, z) => {
      const h = ground.heightUnder(x, z);
      return Number.isFinite(h) ? h : field.heightAt(x, z);
    };

    // (the ground's and the clutter's materials, on no leaf yet: in the look before their first draw)
    for (const m of [...ground.materials, ...(water ? [water.mesh.material] : [])]) house.adopt(new THREE.Mesh(undefined, m));
    house.sky({ low: new THREE.Color(spec.palette.skyLow ?? spec.palette.low), high: new THREE.Color(spec.palette.skyHigh ?? STRIP[3]), sunDir: view.sunDir });

    rt.input.bind({ ...KEYS, ...SHARED_KEYS }, { axes: AXES });
    let ship = spawnOf(spec, groundAt);
    let hudIn = 0;
    let adoptIn = 0;
    let held = false; // (a parity view's: world.view, development's)
    let down = false; // crashed: put back up once the ground under it is in
    let touchThrottle = 0; // the touch buttons' (FlightHud), −1, 0 or 1
    const tell = (type, data) => rt.events?.emit(type, data);
    // the other pilots and what's built (./shared.js): joined by the page (world.shared.join)
    // (its room heard by the planet's occurrences too: ./occurrenceScene.js, so pilots together see one event)
    const shared = createSharedWorld({ parent: view.scene, spec, palette: STRIP, groundAt, tell, respawn: () => (down = true), makeOnline: (o) => view.occurrences.link(createFlightOnline(o)) });
    const unOrigin =
      rt.origin?.on?.((shift) => {
        view.shift(shift);
        ground.origin(rt.origin.at);
      }) ?? (() => {});

    const world = {
      map,
      get ship() {
        return ship;
      },
      set ship(s) {
        ship = { ...ship, ...s };
      },
      anchor: () => [ship.x, ship.y, ship.z],
      // put the ship back up over the ground (a crash does; the checks may)
      respawn() {
        down = true;
      },
      throttle(v) {
        touchThrottle = v;
      },
      shared,
      // (the planet map's markers: ./FlightMap.jsx reads them)
      pilots: () => shared.pilots(),
      built: () => shared.built(),
      occurrences: () => view.occurrences.markers(),
      resize(w, h) {
        view.resize(w, h);
      },
      step(dt, snap) {
        // after a crash, back up 200 m over the ground drawn, never under it:
        // where that isn't in yet, the ship holds still a frame and asks again
        if (down) {
          ground.update(ship);
          const h = ground.heightUnder(ship.x, ship.z);
          if (Number.isFinite(h)) {
            ship = { ...ship, y: h + RESPAWN_UP, pitch: 0, roll: 0, speed: Math.max(SHIP.speedMin, 120) };
            down = false;
          }
          view.place(ship, rt.origin?.at ?? [0, 0, 0], dt);
          return;
        }
        // (a parity view holds the ship where it put it: development's)
        if (held) {
          const at = rt.origin?.at ?? [0, 0, 0];
          ground.update(ship);
          view.place(ship, at, dt);
          water?.place(ship, at);
          return;
        }
        const input = inputOf(snap);
        input.throttle = Math.max(-1, Math.min(1, input.throttle + touchThrottle));
        ship = stepShip(ship, input, dt);
        ground.update(ship);
        // (a crash only on ground drawn: what isn't in yet can't be hit)
        const g = ground.heightUnder(ship.x, ship.z);
        // (a soft world's ground is cloud: flown into, it's fog, not a crash)
        if (!spec.soft && crashed(ship, g)) {
          tell('toast', { text: 'Too low: back up you go.' });
          ship = { ...ship, y: g + RESPAWN_UP, pitch: 0, roll: 0, speed: Math.max(SHIP.speedMin, 120) };
        }
        shared.step(dt, ship, snap);
        const at = rt.origin?.at ?? [0, 0, 0];
        view.place(ship, at, dt);
        water?.place(ship, at);
        hudIn -= dt;
        if (hudIn <= 0) {
          hudIn = HUD_EVERY;
          tell('hud', { speed: ship.speed, alt: ship.y - groundAt(ship.x, ship.z) });
        }
      },
      draw(frame) {
        renderer = frame?.renderer ?? rt.gfx.renderer;
        shared.draw(rt.origin?.at ?? [0, 0, 0]);
        // (what came into the scene since, put in the house's look: the GLSL
        // house's frame guard did it before a material's first frame, and the
        // node renderer has none; a few times a second, the scene walked and
        // each material already in the look passed by: life, occurrences,
        // the other pilots' ships)
        if (++adoptIn >= ADOPT_EVERY) {
          adoptIn = 0;
          house.adopt(view.scene);
        }
        renderer.render(view.scene, view.camera);
      },
      wants: () => true,
      lowerQuality(level) {
        ground.setTier(tierAt(tier, level));
      },
      // the scene, for the checks (scripts/.cache's flights wait on a landmark in it)
      scene: view.scene,
      stats: () => ground.stats(),
      // the height of the ground drawn under the ship (NaN: none in yet)
      groundUnder: () => ground.heightUnder(ship.x, ship.z),
      tune: () => [
        {
          name: 'Ground',
          items: ['leaves', 'flying', 'pending', 'clutter'].map((key) => ({ key, label: key, type: 'range', min: 0, max: 5000, step: 1, get: () => ground.stats()[key], set: () => {} })),
        },
      ],
      dispose() {
        gone = true;
        if (typeof window !== 'undefined' && window.__FLIGHT__ === world) delete window.__FLIGHT__;
        unOrigin();
        rt.input.unbind();
        shared.dispose();
        map.dispose();
        ground.dispose();
        water?.dispose();
        view.dispose();
        Object.assign(renderer, { toneMapping: was.toneMapping, toneMappingExposure: was.exposure });
        renderer.shadowMap.enabled = was.shadows;
      },
    };
    view.place(ship, rt.origin?.at ?? [0, 0, 0]);
    // (development: a named view for scripts/gpu-parity.mjs, the ship put
    // where it starts, level, nose north and still, so two renders of the
    // flight can be compared; and settled(): the ground under it all in)
    if (import.meta.env.DEV) {
      world.view = (name) => {
        if (name !== 'start') throw new Error(`no view ${name}`);
        ship = { ...spawnOf(spec, groundAt), speed: 0 };
        held = true;
        view.place(ship, rt.origin?.at ?? [0, 0, 0], 0);
      };
      world.settled = () => {
        const s = ground.stats();
        return s.leaves > 0 && !s.pending && !s.flying;
      };
    }
    // (the dev hook the checks fly by: scripts/autopilot-check's smoke, scripts/perf-probe's journey)
    if (typeof window !== 'undefined') window.__FLIGHT__ = world;
    return world;
  },
};

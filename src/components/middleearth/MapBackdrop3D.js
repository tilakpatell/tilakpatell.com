// The map behind the page, in WebGL: the painted sheet (./mapPaint.js) lying
// on a desk with its props (./mapRoom.js), seen from a camera that glides
// over it the way the films open.
// On the hub it shows the whole sheet and leans a little towards the pointer
// and towards the place under it; choosing a place flies the camera down to
// it, and a chapter keeps it there, close. By day the sheet lies in window
// light; at night (dark mode) a candle lights it, and it flickers. In Mordor
// the light turns to fire. It draws only while something is moving, or the
// candle is lit; under a chapter's town, less often (./mapCover.js).

import * as THREE from 'three';
import { normalCanvas } from '../../lib/texture';
import { SHEET } from './mapData';
import { mapFont, paintMap, paintRelief } from './mapPaint';
import { buildDiorama } from './mapDiorama';
import { buildRoom } from './mapRoom.js';
import { flightAt } from './mapFlight.js';
import { framing } from './mapFraming.js';
import { prefersReducedMotion } from '../../lib/hooks';
import { budget, device, pixelRatio } from '../../lib/device';
import { guard } from '../../lib/three/frameGuard';
import { precompile, quiet, releaseContext } from '../../lib/three/renderer';

const SCALE = 10; // sheet units to one of the scene's
const at = (x, y) => [(x - SHEET.w / 2) / SCALE, (y - SHEET.h / 2) / SCALE];
const HUB = framing();

export { mapFont };

export function createMapBackdrop(canvas, { onLost } = {}) {
  const renderer = quiet(new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false }));
  // (what arrives late is held back until it's ready, not waited for: lib/three/frameGuard)
  guard(renderer);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  // lib/device: less sharp, and no shadows, on a weak device
  renderer.setPixelRatio(pixelRatio(1.5));
  renderer.shadowMap.enabled = budget().shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x140d08);
  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 1, 400);

  const map = new THREE.CanvasTexture(paintMap(2048));
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const relief = new THREE.CanvasTexture(normalCanvas(paintRelief(1024), 5));
  relief.anisotropy = map.anisotropy;
  const W = SHEET.w / SCALE;
  const H = SHEET.h / SCALE;
  // the desk, its props and the candle; the sheet takes its torn edge from it
  const room = buildRoom(scene, { W, H, tier: budget().tier });
  const plane = new THREE.PlaneGeometry(W, H, 1, 1).rotateX(-Math.PI / 2);
  // The corners lift a little off the desk, as paper does. With one segment
  // the four corners are all the plane’s vertices; the terrain builder that
  // comes next subdivides the sheet and keeps this lift at its corners.
  const lift = plane.attributes.position;
  for (let i = 0; i < lift.count; i++) lift.setY(i, lift.getY(i) + 0.15);
  const sheet = new THREE.Mesh(plane, new THREE.MeshStandardMaterial({ map, normalMap: relief, normalScale: new THREE.Vector2(1.5, 1.5), roughness: 0.94, ...room.sheetOptions }));
  sheet.receiveShadow = true;
  scene.add(sheet);

  const ambient = new THREE.AmbientLight(0xffe8c8, 0.8);
  // The candle light stands at the flame, on the sheet’s north-west corner,
  // so the pool it throws is where the candle is, and stays there as the
  // camera moves. Its intensity is (60 + 140 × night) × the flicker, at a
  // decay of 1.6: measured with `node lab/me/measure.mjs --dark` (the mean
  // luminance of a 300 × 200 px patch round the corner, 0.18 or over
  // wanted), 900 + 1400 gave a pool of 0.746 and 200 + 600 one of 0.575,
  // both a glare that washed the names out; 60 + 140 gives about 0.31, a pool
  // with the names legible in it (0.35 with the night fill below raised).
  // Low by day too, where the candle is unlit.
  const candle = new THREE.PointLight(0xffb870, 60, 0, 1.6);
  candle.position.copy(room.candle.position);
  const low = new THREE.DirectionalLight(0xffdcb0, 1.1);
  low.position.set(-30, 42, 22);
  low.castShadow = true;
  low.shadow.mapSize.set(2048, 2048);
  Object.assign(low.shadow.camera, { left: -46, right: 46, top: 34, bottom: -34, near: 1, far: 140 });
  low.shadow.bias = -0.0006;
  low.shadow.normalBias = 0.03;
  scene.add(ambient, candle, low);

  // the toy world on the sheet, and Frodo and Sam on the road
  const reduced = prefersReducedMotion();
  const dev = device();
  const world = buildDiorama(scene, { reduced, models: dev.tier !== 'low' && !dev.saveData });
  // by day, by candle at night, and by Mordor's fire
  const day = { ambient: new THREE.Color(0xfff1dc), candle: new THREE.Color(0xffd6a0), low: new THREE.Color(0xfff0dc) };
  const night = { ambient: new THREE.Color(0x6a7590), candle: new THREE.Color(0xffa458), low: new THREE.Color(0x8fa2c8) };
  const fire = { ambient: new THREE.Color(0x8a5a44), candle: new THREE.Color(0xff8648), low: new THREE.Color(0xff9a66) };
  const tint = new THREE.Color();

  let lost = false;
  const onContextLost = (e) => {
    e.preventDefault();
    lost = true;
    onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  // where the camera is, and where it is going: a point on the sheet, a
  // height (1 is close, about 3 the whole sheet), how far into Mordor, how
  // dark the room is, and the pointer's lean
  const cur = { x: 0, z: 0, zoom: 3.4, m: 0, n: 0, lx: 0, lz: 0 };
  const goal = { x: 0, z: 0, zoom: 2.6, m: 0, n: 0, lx: 0, lz: 0 };
  const want = { ...goal }; // what the page asked for; a walk overrides it while it lasts
  let wide = 1;
  let first = true;
  let candleLit = false;
  let alive = false;
  let t = 0;
  // under a town: the time since the last frame drawn, and whether the
  // camera has moved on from it
  let since = 0;
  let behind = false;
  // the visitor's own look about on the map: a pan and a zoom on top of the
  // page's view, and whether a hurried walk (to open a place) is on
  const user = { x: 0, z: 0, zoom: 1 };
  let hurry = false;
  let hub = false;
  // the opening’s flight down the road, where it has the camera now, or null
  // when the page has it
  let flying = null;

  // { at: [x, y] on the sheet or null for the whole map, zoom, mordor, dark,
  //   alive: the candle flickers (it keeps drawing), lean: [-1..1, -1..1] the
  //   pointer, hover: [x, y] a place to lean towards }
  const setView = ({ at: spot = null, zoom = null, mordor = false, dark = false, alive: live = false, lean = [0, 0], hover = null }) => {
    // the whole map is framed on the road's stops, Hobbiton to Barad-dûr (./mapFraming.js)
    const [x, z] = at(...(spot || HUB.at));
    const [hx, hz] = hover ? at(...hover) : [x, z];
    want.x = x + (hx - x) * 0.04;
    want.z = z + (hz - z) * 0.04;
    // a tall screen can't hold the whole sheet: show its middle, bigger
    want.zoom = zoom ?? (spot ? 1.45 : camera.aspect < 1 ? 0.8 : HUB.zoom);
    want.m = mordor ? 1 : 0;
    want.n = dark ? 1 : 0;
    want.lx = lean[0];
    want.lz = lean[1];
    candleLit = dark && live;
    alive = live;
    hub = !spot && live;
  };

  let dragging = false;
  // keep the middle of the view on the sheet
  const clampUser = () => {
    const lx = SHEET.w / SCALE / 2;
    const lz = SHEET.h / SCALE / 2;
    user.x = Math.max(-lx - want.x, Math.min(lx - want.x, user.x));
    user.z = Math.max(-lz - want.z, Math.min(lz - want.z, user.z));
  };

  // Where a point on the sheet is on the screen, in CSS pixels of the canvas.
  const v = new THREE.Vector3();
  const project = (x, y, h = 0) => {
    const [px, pz] = at(x, y);
    v.set(px, h, pz).project(camera);
    return { x: ((v.x + 1) / 2) * size.w, y: ((1 - v.y) / 2) * size.h, on: v.z < 1 };
  };
  let size = { w: 1, h: 1 };
  // and the other way: a point on the screen to the sheet, where it meets the table
  const ray = new THREE.Raycaster();
  const table0 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ndc = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const unproject = (sx, sy) => {
    ndc.set((sx / size.w) * 2 - 1, 1 - (sy / size.h) * 2);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(table0, hit)) return null;
    return { x: hit.x * SCALE + SHEET.w / 2, y: hit.z * SCALE + SHEET.h / 2 };
  };

  const resize = (w, h) => {
    size = { w: Math.max(1, w), h: Math.max(1, h) };
    renderer.setSize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    wide = Math.max(1, 1.25 / camera.aspect); // a tall screen stands further back
    first = true;
  };

  // Draws one frame, and says whether to keep drawing: the camera is on its
  // way, or the candle is lit. `wait`, when the page has a town over the map,
  // says how long it may wait between frames (./mapCover.js): asked only
  // while the camera moves, since it reads the page's layout.
  const render = (ms = 16, slow = 1, wait = null) => {
    if (lost) return false;
    const dt = Math.min(0.05, ms / 1000);
    t += dt;
    // on a walk the camera follows Frodo, close
    Object.assign(goal, want);
    if (hurry && !world.walking) hurry = false;
    if (hurry) {
      goal.x = world.frodo.x;
      goal.z = world.frodo.z;
      goal.zoom = 1.15;
    } else if (hub) {
      // on the map: the visitor's pan and zoom, and Frodo kept in view as he walks
      if (world.walking && !dragging) {
        v.copy(world.frodo).project(camera);
        if (Math.abs(v.x) > 0.45 || Math.abs(v.y) > 0.45) {
          user.x += (world.frodo.x - (want.x + user.x)) * Math.min(1, dt * 1.6);
          user.z += (world.frodo.z - (want.z + user.z)) * Math.min(1, dt * 1.6);
        }
      }
      goal.x = want.x + user.x;
      goal.z = want.z + user.z;
      goal.zoom = want.zoom * user.zoom;
    }
    if (flying) {
      // the opening leads the camera wherever the page has asked it to be
      [goal.x, goal.z] = at(...flying.at);
      goal.zoom = flying.zoom;
    }
    const k = 1 - Math.exp(-(hurry || flying ? 3.5 : dragging ? 14 : 2.4) * slow * dt);
    const kl = 1 - Math.exp(-4 * dt);
    let far = 0;
    for (const key of ['x', 'z', 'zoom', 'm', 'n', 'lx', 'lz']) far += Math.abs(goal[key] - cur[key]) * (key === 'x' || key === 'z' ? 1 : 4);
    const moving = first || far > 0.004 || world.walking || hurry || flying !== null;
    // on the map itself the world is alive (smoke, the Eye, the hobbits):
    // keep drawing; behind a chapter, only while the camera moves
    if (!moving && !alive && !candleLit && !behind) return false;
    // (a canvas just sized is blank: drawn at once)
    const fresh = first;
    first = false;
    for (const key of ['x', 'z', 'zoom', 'm', 'n']) cur[key] += (goal[key] - cur[key]) * k;
    cur.lx += (goal.lx - cur.lx) * kl;
    cur.lz += (goal.lz - cur.lz) * kl;
    world.update(dt, t, { night: cur.n });
    const z = cur.zoom * wide;
    // the pointer swings the camera a little round the point it looks at
    const sx = cur.lx * 1.6 * z;
    const sz = cur.lz * 1.1 * z;
    camera.position.set(cur.x + 1.5 * z + sx, 17 * z, cur.z + 14 * z + sz);
    camera.lookAt(cur.x + sx * 0.25, 0, cur.z - 1.2 * z + sz * 0.25);
    // Mount Doom shakes the table a little when it goes up
    const q = reduced ? 0 : world.shake * world.shake * 0.12 * z;
    if (q) camera.position.add(v.set(Math.sin(t * 61) * q, Math.sin(t * 47) * q, Math.cos(t * 53) * q));
    const flick = candleLit ? 1 + 0.06 * Math.sin(t * 11.3) * Math.sin(t * 7.1 + 1.3) + 0.04 * Math.sin(t * 23.7) : 1;
    room.update(dt, t, { night: cur.n, m: cur.m, flick });
    ambient.color.copy(tint.copy(day.ambient).lerp(night.ambient, cur.n)).lerp(fire.ambient, cur.m);
    // The night fill: the candle lights only its corner, so the room and the
    // moon at the window must let the rest of the sheet read. At full night
    // the ambient is 0.70 and the window 0.75 (from 0.5 and 0.35, which left
    // the names away from the candle unreadable): measured with
    // `node lab/me/measure.mjs --dark [--phone]`, the sheet’s middle (a 300 ×
    // 200 px patch round its centre, 0.12 or over wanted) is 0.195 on a phone
    // and 0.182 on a desktop, from 0.145 and 0.144, and the candle’s pool 0.348.
    ambient.intensity = (0.85 - 0.15 * cur.n) * (1 - 0.45 * cur.m);
    candle.color.copy(tint.copy(day.candle).lerp(night.candle, cur.n)).lerp(fire.candle, cur.m);
    candle.intensity = (60 + 140 * cur.n) * flick;
    low.color.copy(tint.copy(day.low).lerp(night.low, cur.n)).lerp(fire.low, cur.m);
    low.intensity = (1.2 - 0.45 * cur.n) * (1 - 0.5 * cur.m);
    // behind most of a town the camera moves on between frames drawn, and is
    // drawn once more where it comes to rest
    since += ms;
    if (moving && !fresh && wait && since < wait()) {
      behind = true;
      return true;
    }
    since = 0;
    behind = false;
    renderer.render(scene, camera);
    return true;
  };

  const dispose = () => {
    canvas.removeEventListener('webglcontextlost', onContextLost);
    world.dispose();
    room.dispose();
    map.dispose();
    relief.dispose();
    scene.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    renderer.dispose();
    releaseContext(renderer); // (lib/three/renderer: once nothing is compiling)
  };

  return {
    setView,
    project,
    // send Frodo and Sam down the road to a stop; how long they'll take, in ms
    travel: (stop) => {
      const ms = world.walkTo(stop);
      hurry = ms > 0;
      first = true;
      return ms;
    },
    // the opening’s flight (./mapFlight.js): `ms` into it, or null to hand
    // the camera back to the page, which it eases to
    flight(ms) {
      const was = flying;
      flying = ms == null ? null : flightAt(ms);
      // a flight from the very first frame starts where it starts, low over
      // the Shire, rather than swooping down to it from the whole map
      if (flying && !was && t === 0) {
        [cur.x, cur.z] = at(...flying.at);
        cur.zoom = flying.zoom;
      }
      first = true;
    },
    // ── the visitor's hands on the map ──
    // drag: move the map with the pointer, by a screen delta in px
    panBy(dx, dy, x = size.w / 2, y = size.h / 2) {
      const a = unproject(x, y);
      const b = unproject(x + dx, y + dy);
      if (!a || !b) return;
      user.x -= (b.x - a.x) / SCALE;
      user.z -= (b.y - a.y) / SCALE;
      clampUser();
      first = true;
    },
    // zoom by a factor (below 1 is closer) towards a point on the screen
    zoomBy(f, x = size.w / 2, y = size.h / 2) {
      const before = user.zoom;
      user.zoom = Math.max(0.3, Math.min(1.3, user.zoom * f));
      const k = user.zoom / before;
      const p = unproject(x, y);
      if (p) {
        const px = (p.x - SHEET.w / 2) / SCALE;
        const pz = (p.y - SHEET.h / 2) / SCALE;
        user.x += (px - (want.x + user.x)) * (1 - k);
        user.z += (pz - (want.z + user.z)) * (1 - k);
      }
      clampUser();
      first = true;
    },
    holding(on) {
      dragging = on;
    },
    resetView() {
      Object.assign(user, { x: 0, z: 0, zoom: 1 });
      first = true;
    },
    // centre the map on Frodo (a phone shows only part of it)
    lookAtFrodo() {
      user.x = world.frodo.x - want.x;
      user.z = world.frodo.z - want.z;
      clampUser();
      first = true;
    },
    // a tap: who's there, or where on the sheet it landed
    tap(x, y) {
      ndc.set((x / size.w) * 2 - 1, 1 - (y / size.h) * 2);
      world.ray.setFromCamera(ndc, camera);
      const who = world.pick(world.ray);
      if (who) return { who };
      const p = unproject(x, y);
      return p ? { at: [p.x, p.y] } : null;
    },
    say: (id) => world.say(id),
    walkToSheet(x, y) {
      world.walkToPoint((x - SHEET.w / 2) / SCALE, (y - SHEET.h / 2) / SCALE);
    },
    drive: (dx, dz) => world.drive(dx, dz),
    on: (f) => world.on(f),
    // where someone's head is on the screen, for a speech bubble
    headOf(id) {
      if (!world.headOf(id, v)) return null;
      v.project(camera);
      return { x: ((v.x + 1) / 2) * size.w, y: ((1 - v.y) / 2) * size.h, on: v.z < 1 };
    },
    // the other travellers online on the map (towns/travellers.js), and where
    // your Frodo is, to tell them
    travellers: (list) => world.travellers(list),
    get step() {
      return world.step;
    },
    get frodoSheet() {
      return { x: world.frodo.x * SCALE + SHEET.w / 2, y: world.frodo.z * SCALE + SHEET.h / 2 };
    },
    place: (stop) => world.place(stop),
    get walking() {
      return world.walking;
    },
    unproject,
    render,
    resize,
    dispose,
    renderer,
    info: () => ({ ...renderer.info.render }), // the lab’s counts
    // its shaders, linked in the background, and the sheet’s own pictures
    // sent: the page waits for this before the first frame, so that frame
    // has the sheet in it (lib/three/frameGuard leaves out a material whose
    // pictures aren’t on the chip yet) and fades in over the flat one whole
    ready: precompile(renderer, scene, camera).then(() => {
      if (lost) return;
      renderer.initTexture(map);
      renderer.initTexture(relief);
      for (const picture of room.textures) renderer.initTexture(picture);
    }),
    get lost() {
      return lost;
    },
  };
}

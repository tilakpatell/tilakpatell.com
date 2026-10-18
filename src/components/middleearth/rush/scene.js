// The rush, drawn: a kitchen built from the level's tiles out of the
// Shire's timber, plaster and stone (../shire/props), the stations on their
// counters, the hobbits, whatever's being carried or cooked, a ring over
// each station that's working, and a fixed camera up over the front, as
// Overcooked has it. ./rules.js says what's where; this only shows it.
//
// createRushScene(canvas, level, { onLost }) → { render(view, ms), resize,
// screenOf(x, y, z), dispose, lost, info }. view = { s (the rules' state),
// players (where to draw each: { slot, x, z, face, held, moving, work }),
// me (your slot, or null), t }.

import * as THREE from 'three';
import { createStage, disposeTree, hot } from '../stage';
import { houseOn } from '../../../lib/three/house';
import { pose } from '../mapFigures';
import { makePerson } from '../shire/people';
import { B, ball, createShireKit, parts } from '../shire/props';
import { dotTexture } from '../towns/bake';
import { itemMaker } from './items';
import { COLOURS, HOBBITS } from './cast';
import { facingTile, KINDS, ovenFor, recipesOf } from './rules';
import { STATIONS, TOP, V, crate, innCounter, innPot, shelf, stream } from './themes/common';
import { themeOf } from './themes';
import { castDo, castPlay, releaseCast, tickCast } from '../cast3d';
import { turn as easeYaw } from '../../../lib/three/gait';
import { RUSH_BLOOM } from './look';
import { houseGroups } from '../../../lib/three/houseTuning';

const SCALE = 0.92; // the hobbits, to the tiles
const BIG = 1.7; // things, chunky enough to read from up here

// A ring over a station, filling clockwise from the top.
function ringMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: { uK: { value: 0 }, uCol: { value: new THREE.Color() }, uFlash: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float uK; uniform vec3 uCol; uniform float uFlash; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float a = atan(p.x, p.y) / 6.2831853 + 0.5;
        vec3 back = vec3(0.08, 0.06, 0.05);
        vec3 col = r < 0.6 ? back : (a > 1.0 - uK ? uCol : vec3(0.22, 0.2, 0.18));
        col = mix(col, vec3(1.0, 0.25, 0.15), uFlash * step(0.6, r));
        float edge = smoothstep(1.0, 0.92, r);
        gl_FragColor = vec4(col, 0.95 * edge);
      }`,
  });
}

export function createRushScene(canvas, level, { onLost } = {}) {
  const stage = createStage(canvas, { shadows: true, fov: 38, near: 0.1, far: 80, bloom: RUSH_BLOOM, onLost });
  stage.grade({ contrast: 0.1, saturation: 1.02, vignette: 0.26, grain: 0.012, shadow: [0.02, 0.012, 0.0], high: [0.03, 0.02, 0.0] });
  const { scene, camera, renderer } = stage;
  renderer.info.autoReset = false; // (counted over the whole frame, for the QA scripts)
  const kit = createShireKit(renderer);
  const { mats, paint } = kit;
  const items = itemMaker(kit.K);
  const rows = level.tiles;
  const W = rows[0].length;
  const D = rows.length;
  const X = (x) => x - W / 2; // tile units to the world
  const Z = (z) => z - D / 2;
  const at = (i, j) => (i < 0 || j < 0 || i >= W || j >= D ? 'x' : rows[j][i]);
  const R = recipesOf(level);
  // the kitchen's look: its theme (./themes)
  const theme = themeOf(level);
  const sky = theme.sky;
  scene.background = new THREE.Color(sky.background);
  scene.fog = new THREE.Fog(...sky.fog);
  const hemi = new THREE.HemisphereLight(...sky.hemi);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(...sky.sun);
  sun.position.set(...(sky.sunAt ?? [-4, 10, 7]));
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -W / 2 - 1, right: W / 2 + 1, top: D / 2 + 2, bottom: -D / 2 - 2, near: 1, far: 30 });
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);

  // ── the room ──
  const room = new THREE.Group();
  scene.add(room);
  const bk = parts();
  const lamps = [];
  const wet = (i, j) => at(i, j) === '~';
  const m = { darkWood: paint(0x5a3418), board: paint(0xd8b484), topWood: paint(0xd2a46c), paleWood: paint(0xb89a70), brick: mats.brick, line: new THREE.MeshBasicMaterial({ color: 0xe8e8e0 }) };
  const ctx = { kit, mats, paint, items, bk, room, scene, W, D, X, Z, at, wet, R, lamps, wallH: 3.2, m };
  const T = theme.setup?.(ctx) ?? {};
  theme.room(ctx, T);

  // which way a station faces: towards the floor next to it (the camera's side first)
  const frontOf = (i, j) => {
    for (const [a, b, turn] of [[0, 1, 0], [-1, 0, -Math.PI / 2], [1, 0, Math.PI / 2], [0, -1, Math.PI]]) if (at(i + a, j + b) === '.' || at(i + a, j + b) === ',') return { a, b, turn };
    return { a: 0, b: 1, turn: 0 };
  };

  const stations = {}; // key → { c, x, z, front, contents, glow }
  const fires = [];
  const counterOf = theme.counter ?? innCounter;
  for (let j = 0; j < D; j++)
    for (let i = 0; i < W; i++) {
      const c = at(i, j);
      if (c === '.' || c === ',' || c === 'x' || c === '~') continue;
      const x = X(i + 0.5);
      const z = Z(j + 0.5);
      const f = frontOf(i, j);
      const st = { c, x, z, front: f, key: `${i},${j}` };
      stations[`${i},${j}`] = st;
      // the counter (but a fishing rock stands in the water, with none)
      const counter = c === 'F' ? null : counterOf(c, c === 'P' || c === 'O', ctx, T);
      if (counter) {
        bk.add(counter[0], B(0.98, TOP - 0.06, 0.98), { p: [x, (TOP - 0.06) / 2, z], uv: 1 });
        bk.add(counter[1], B(1.0, 0.06, 1.0), { p: [x, TOP - 0.03, z], uv: 1 });
        // a dark lip round the top, so each counter reads as one
        bk.add(m.darkWood, B(1.02, 0.05, 1.02), { p: [x, TOP - 0.085, z], uv: 1 });
      }
      // what's on it: the theme's own, or the shared station, or the level's shelves and crates
      bk.at([x, TOP, z], f.turn, () => {
        const own = theme.stations?.[c] ?? STATIONS[c];
        if (own) own(ctx, T);
        else if (R.shelves[c]) shelf(ctx, theme.shelf?.(ctx, T) ?? [mats.timber, mats.wood]);
        else if (R.crates[c]) crate(ctx, R.crates[c]);
      });
      // the crates' heaps, the dough: things, not built in (they share the items' look)
      if (R.crates[c]) {
        const heap = new THREE.Group();
        const kind = R.crates[c];
        const n = kind === 'dough' ? 1 : 7;
        for (let k = 0; k < n; k++) {
          const it = items.make({ k: kind, s: 'raw' });
          it.position.set(Math.cos(k * 2.4) * 0.18 * (k > 0), 0.12 + (k % 3) * 0.05, Math.sin(k * 2.4) * 0.18 * (k > 0));
          it.rotation.y = k * 1.3;
          if (kind === 'dough') it.scale.setScalar(2.4);
          heap.add(it);
        }
        heap.position.set(x, TOP, z);
        room.add(heap);
      }
      if (c === 'F') {
        // the float, out on the water (it bobs when someone's fishing)
        const bob = new THREE.Mesh(ball(0.045, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd83a2a, roughness: 0.5 }));
        bob.position.set(x + 0.75 * Math.cos(f.turn) - 0.45 * Math.sin(f.turn), -0.05, z - 0.75 * Math.sin(f.turn) - 0.45 * Math.cos(f.turn));
        room.add(bob);
        st.bob = bob;
      }
      if (c === 'P' || c === 'O') {
        // the fire's glow (a campfire's, a flame)
        const flame = theme.flame?.includes(c);
        const glow = new THREE.Mesh(flame ? new THREE.ConeGeometry(0.13, 0.34, 7) : B(0.5, 0.18, 0.04), new THREE.MeshBasicMaterial({ color: hot(0xff7a2a, 2.4) }));
        const out = flame ? 0 : c === 'P' ? 0.5 : 0.42;
        const low = flame && theme.pan && c === 'P'; // (under a frying pan: low, and small)
        glow.position.set(x + f.a * out, low ? TOP + 0.08 : flame ? TOP + 0.17 : c === 'P' ? 0.32 : TOP + 0.1, z + f.b * out);
        st.size = low ? 0.5 : 1;
        glow.rotation.y = f.turn;
        room.add(glow);
        st.glow = glow;
        st.flame = flame;
        fires.push(st);
      }
    }
  // the '~' tiles: the theme's (a drop, a lake), or a stream (or a channel of molten rock)
  const water = theme.water ? theme.water(ctx, T) : stream(ctx);
  bk.build(room);
  room.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true;
  });
  // (and anything of the theme's that moves: fireworks, Riders on the hill)
  const extra = theme.extras?.(ctx, T);

  // the fires' light: two point lights, shared out among the hearths and ovens
  const fireLights = [0, 1].map(() => {
    const l = new THREE.PointLight(0xff8a3a, 3, 5, 1.6);
    scene.add(l);
    return l;
  });
  fireLights.forEach((l, k) => {
    const group = fires.filter((_, n) => n % 2 === k);
    if (!group.length) return;
    const cx = group.reduce((a, f) => a + f.x, 0) / group.length;
    const cz = group.reduce((a, f) => a + f.z, 0) / group.length;
    l.position.set(cx, TOP + 0.6, cz + 0.8);
  });

  // ── the stations' changing parts ──
  const potTops = {};
  const potMat = (hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.5 });
  const POT = (theme.pot ?? innPot)(potMat);
  const tubWater = new THREE.MeshStandardMaterial({ color: 0x5a7a8a, roughness: 0.2, metalness: 0.1 });
  for (const [k, st] of Object.entries(stations)) {
    if (st.c === 'P') {
      const top = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), POT.empty);
      top.rotation.x = -Math.PI / 2;
      top.position.set(st.x, TOP + (theme.pan ? 0.26 : 0.3), st.z);
      room.add(top);
      potTops[k] = top;
    } else if (st.c === 'W') {
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.38, 16), tubWater);
      w.rotation.x = -Math.PI / 2;
      w.position.set(st.x, TOP + 0.24, st.z);
      room.add(w);
    }
  }

  // ── the thief (Sméagol, in Ithilien): he creeps up to the counter he's
  // after, crouched and reaching, then slinks off, with it or without ──
  const thief = { model: null, at: null, mode: null, t0: null, x: 0, z: 0, face: 0, away: 1 };
  let gone = false;
  if (level.thief)
    import('../towns/marshes/props').then(({ createGollum }) => {
      if (gone) return;
      thief.model = createGollum(renderer);
      thief.model.group.scale.setScalar(SCALE * 1.4); // (crouched, he's small: big enough to see him coming)
      thief.model.group.visible = false;
      scene.add(thief.model.group);
    });
  const thiefAt = (e) => {
    const st = stations[`${e.at[0]},${e.at[1]}`];
    if (!st) return;
    if (e.type === 'sneak') {
      // at the counter, on its open side, facing it
      Object.assign(thief, { at: st, mode: 'creep', t0: null, x: st.x + st.front.a * 0.75, z: st.z + st.front.b * 0.75, face: Math.atan2(st.front.b, -st.front.a) });
    } else if (thief.at === st) Object.assign(thief, { mode: e.type === 'stolen' ? 'off' : 'shoo', t0: null, away: st.x < 0 ? -1 : 1 });
  };
  const thiefStep = (dt, t) => {
    const g = thief.model;
    if (!g) return;
    const shown = g.group.visible;
    g.group.visible = Boolean(thief.mode);
    if (!thief.mode) return;
    // (just come up to a counter: put there, facing it)
    const arrived = !shown || (thief.mode === 'creep' && thief.t0 == null);
    thief.t0 ??= t;
    const u = t - thief.t0;
    if (thief.mode !== 'creep') {
      // off to the nearest side, at a scuttle
      thief.x += thief.away * dt * (thief.mode === 'off' ? 4.5 : 5.5);
      thief.face = thief.away > 0 ? 0 : Math.PI;
      if (Math.abs(thief.x) > W / 2 + 2) thief.mode = null;
    }
    g.group.position.set(thief.x, 0, thief.z);
    // he turns to go as a thing on all fours turns, not on the spot (put facing the counter as he appears)
    g.group.rotation.y = arrived ? thief.face : easeYaw(g.group.rotation.y, thief.face, dt, 9);
    g.animate?.(t, { pose: thief.mode === 'creep' ? 'crouch' : 'crawl', speed: thief.mode === 'creep' ? 0 : 1, look: Math.sin(t * 5) * 0.3, reach: thief.mode === 'creep' ? Math.min(1, u / (level.thief.warn * 0.8)) : 0 });
  };

  // ── hobbits ──
  const figures = HOBBITS.map((id, slot) => {
    const f = makePerson(id);
    f.group.scale.setScalar(SCALE);
    const disc = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.4, 24), new THREE.MeshBasicMaterial({ color: COLOURS[slot], transparent: true, opacity: 0.85, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.02;
    const g = new THREE.Group();
    g.add(f.group, disc);
    g.visible = false;
    scene.add(g);
    return { f, g, disc };
  });

  // ── what's held and what's set down ──
  const shown = new Map(); // where → { sig, mesh }
  const place = (where, it, x, y, z, ry = 0, s0 = 1) => {
    const s = s0 * BIG;
    if (!it) return;
    const sig = `${it.k}:${it.s}`;
    let e = shown.get(where);
    if (!e || e.sig !== sig) {
      if (e) room.remove(e.mesh);
      e = { sig, mesh: items.make(it) };
      room.add(e.mesh);
      shown.set(where, e);
    }
    e.used = true;
    e.mesh.position.set(x, y, z);
    e.mesh.rotation.y = ry;
    e.mesh.scale.setScalar(s);
  };

  // ── progress rings ──
  const ringGeo = new THREE.PlaneGeometry(0.5, 0.5);
  const rings = Array.from({ length: 16 }, () => {
    const r = new THREE.Mesh(ringGeo, ringMaterial());
    r.renderOrder = 10;
    r.visible = false;
    scene.add(r);
    return r;
  });
  const GREEN = new THREE.Color(0x6ad04a);
  const BLUE = new THREE.Color(0x5ab4f0);
  const GOLD = new THREE.Color(0xf0c040);
  const RED = new THREE.Color(0xf05030);
  const ORANGE = new THREE.Color(0xff9a2a);

  // the tile you'd act on, lit up in your colour
  const aim = new THREE.Group();
  const aimEdge = new THREE.LineSegments(new THREE.EdgesGeometry(B(1.02, 0.16, 1.02)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
  const aimFill = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.98).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false }));
  aimFill.position.y = 0.075;
  aim.add(aimEdge, aimFill);
  aim.visible = false;
  scene.add(aim);

  // ── puffs: steam, smoke, sparkle ──
  const dot = dotTexture();
  const puffs = Array.from({ length: 48 }, () => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, transparent: true, depthWrite: false, color: 0xffffff }));
    sp.visible = false;
    sp.userData = { life: 0, max: 1, v: V() };
    scene.add(sp);
    return sp;
  });
  let puffAt = 0;
  const puff = (x, y, z, { color = 0xffffff, size = 0.3, life = 1.2, v = [0, 0.6, 0], opacity = 0.6 } = {}) => {
    const sp = puffs[puffAt++ % puffs.length];
    sp.visible = true;
    sp.position.set(x, y, z);
    sp.material.color.set(color);
    sp.material.opacity = opacity;
    sp.scale.setScalar(size);
    Object.assign(sp.userData, { life, max: life, size, opacity });
    sp.userData.v.set(...v);
  };

  // ── the camera: up over the front, the whole kitchen in view ──
  const look = V(0, 0.4, 0.5);
  const fit = (w, h) => {
    const aspect = w / Math.max(1, h);
    const pitch = aspect < 0.9 ? 1.2 : 0.98; // steeper on a tall screen
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const needH = D * Math.sin(pitch) + 1.6;
    const needW = W + 1.2;
    const d = Math.max(needH / (2 * tan), needW / (2 * tan * aspect));
    camera.position.set(look.x, look.y + Math.sin(pitch) * d, look.z + Math.cos(pitch) * d);
    camera.lookAt(look);
  };
  const resize = (w, h) => {
    stage.resize(w, h);
    fit(w, h);
  };

  let last = 0;
  // the house look (lib/three/house), as in Middle-earth's towns: the house
  // tone mapper, the shade one colour from the kitchen's sky light; its own fog kept
  // (the stage starts at the house's exposure already: lifting it again would wash the kitchen out)
  const house = houseOn({ renderer, scene, sun: sun, hemi, keepExposure: true, look: { fog: false } });
  let houseFrames = 0;

  const render = (view, ms = 16) => {
    const dt = Math.min(0.05, ms / 1000);
    const { s, players, me, t } = view;
    last = t;
    for (const e of shown.values()) e.used = false;

    // stations: their contents, their rings
    let ri = 0;
    const ring = (x, y, z, k, col, flash = 0) => {
      const r = rings[ri++];
      if (!r) return;
      r.visible = true;
      r.position.set(x, y, z);
      r.quaternion.copy(camera.quaternion);
      r.material.uniforms.uK.value = Math.max(0, Math.min(1, k));
      r.material.uniforms.uCol.value.copy(col);
      r.material.uniforms.uFlash.value = flash;
    };
    const T = level.times;
    for (const [k, st] of Object.entries(stations)) {
      const sp = s.spots[k];
      if (!sp) continue;
      const { x, z, front } = st;
      if (st.c === '#' || st.c === 'B' || st.c === 'S') {
        if (sp.item) place(k, sp.item, x, TOP + (st.c === 'B' ? 0.05 : 0), z, front.turn);
        if (st.c === 'B' && sp.item?.s === 'raw' && sp.prog > 0) ring(x, TOP + 0.75, z, sp.prog, GREEN);
      } else if (st.c === 'F') {
        // the catch on the rock, and the float bobbing while someone holds the line
        if (sp.item) place(k, sp.item, x + front.a * 0.15, TOP + 0.02, z + front.b * 0.15, front.turn);
        if (sp.prog > 0) ring(x, TOP + 0.75, z, sp.prog, BLUE);
        st.bob.position.y = -0.05 + (sp.prog > 0 ? Math.sin(t * 9) * 0.025 - sp.prog * 0.03 : Math.sin(t * 1.4 + x) * 0.008);
      } else if (st.c === 'O') {
        if (sp.item && theme.spit) place(k, sp.item, x, TOP + 0.46 - 0.05 * BIG, z, front.turn);
        else if (sp.item) place(k, sp.item, x + front.a * (theme.ovenAt?.out ?? 0.18), TOP + (theme.ovenAt?.y ?? 0.02), z + front.b * (theme.ovenAt?.out ?? 0.18), front.turn);
        const o = sp.item && ovenFor(R, sp.item.k);
        if (o && sp.item.k === o.takes) ring(x, TOP + 0.95, z, sp.prog / T.bake, GREEN);
        else if (o && sp.item.s === KINDS[o.makes][0] && sp.prog > T.char * 0.35) ring(x, TOP + 0.95, z, sp.prog / T.char, RED, Math.sin(t * 14) > 0 ? 0.6 : 0);
        if (o && sp.item.s === KINDS[o.makes][1] && Math.random() < dt * 6) puff(x, TOP + 0.6, z, { color: 0x222222, size: 0.5, life: 1.8, opacity: 0.5 });
      } else if (st.c === 'G') {
        // the patch: what's coming up, growing, then up and ready to pick
        if (sp.item) place(k, sp.item, x, TOP + 0.02, z, front.turn);
        else if (sp.prog > 0.15) place(`${k}:up`, { k: R.patch.grows, s: 'raw' }, x, TOP - 0.06 + sp.prog * 0.08, z, front.turn, 0.3 + sp.prog * 0.6);
      } else if (st.c === 'A') {
        // the carving table: the parts on so far, or the platter
        if (sp.item) place(k, sp.item, x, TOP + 0.02, z, front.turn);
        sp.parts?.forEach((it, n) => place(`${k}:${n}`, it, x + (n - 1) * 0.26, TOP + 0.02, z, front.turn, 0.75));
      } else if (st.c === 'L') {
        // on the leaves, and wrapped while someone works at it
        if (sp.item) place(k, sp.item, x, TOP + 0.04, z, front.turn);
        if (sp.prog > 0) ring(x, TOP + 0.75, z, sp.prog, GREEN);
      } else if (st.c === 'T') {
        if (sp.item) place(k, sp.item, x + front.a * 0.3, TOP, z + front.b * 0.3, front.turn);
        if (sp.item?.s === 'clean') ring(x, TOP + 0.95, z, sp.prog / T.fill, GOLD);
        else if (sp.item?.s === R.tap.makes && sp.prog > T.spill * 0.35) ring(x, TOP + 0.95, z, sp.prog / T.spill, RED, Math.sin(t * 14) > 0 ? 0.6 : 0);
      } else if (st.c === 'P') {
        const top = potTops[k];
        top.material = POT[sp.s] ?? POT.empty;
        const full = Math.min(3, sp.n || (sp.s === 'empty' ? 0 : 3));
        top.position.y = TOP + (theme.pan ? 0.24 + 0.01 * full : 0.18 + 0.05 * full) + (sp.s === 'cooking' || sp.s === 'done' ? Math.sin(t * 9) * 0.006 : 0);
        if (sp.s === 'cooking') {
          ring(x, TOP + 1.05, z, sp.cook / T.cook, GREEN);
          if (Math.random() < dt * 5) puff(x + (Math.random() - 0.5) * 0.3, TOP + 0.4, z, { size: 0.32, life: 1.4, opacity: 0.35 });
        } else if (sp.s === 'done') {
          const k2 = (sp.cook - T.cook) / T.burn;
          if (k2 > 0.35) ring(x, TOP + 1.05, z, k2, RED, Math.sin(t * 14) > 0 ? 0.6 : 0);
          if (Math.random() < dt * 8) puff(x + (Math.random() - 0.5) * 0.3, TOP + 0.4, z, { size: 0.36, life: 1.4, opacity: 0.45 });
        } else if (sp.s === 'burnt') {
          if (sp.prog > 0) ring(x, TOP + 1.05, z, sp.prog, BLUE);
          if (Math.random() < dt * 10) puff(x + (Math.random() - 0.5) * 0.3, TOP + 0.5, z, { color: 0x1a1a1a, size: 0.55, life: 2, opacity: 0.55 });
        } else if (sp.s === 'part' && sp.n) {
          // the pieces in, before it's full
          for (let n = 0; n < sp.n; n++) place(`${k}:${n}`, { k: R.pot.takes[n % R.pot.takes.length], s: 'chopped' }, x + Math.cos(n * 2.1) * 0.1, TOP + (theme.pan ? 0.25 : 0.22), z + Math.sin(n * 2.1) * 0.1, n, 0.8);
        }
      } else if (st.c === 'W') {
        sp.dirty.slice(0, 3).forEach((kind, n) => place(`${k}:d${n}`, { k: kind, s: 'dirty' }, x - 0.12 + n * 0.12, TOP + 0.12 + n * 0.02, z - 0.05, n, 0.9));
        sp.clean.slice(0, 3).forEach((kind, n) => place(`${k}:c${n}`, { k: kind, s: 'clean' }, x + front.a * 0.35 - 0.25 + n * 0.16, TOP + 0.31, z + front.b * 0.35 + 0.1, n, 0.85));
        if (sp.prog > 0) ring(x, TOP + 0.95, z, sp.prog, BLUE);
        if (sp.dirty.length && s.players.some((p) => p.work) && Math.random() < dt * 6) puff(x, TOP + 0.3, z, { color: 0xeaf6ff, size: 0.18, life: 0.7, v: [0, 0.4, 0], opacity: 0.8 });
      } else if (R.shelves[st.c]) {
        const kind = R.shelves[st.c];
        for (let n = 0; n < Math.min(6, sp.n); n++) {
          const row = n < 3 ? 0 : 1;
          const col = n % 3;
          // along the shelf, a little back from its front edge (turned as the station is)
          const ox = (col - 1) * 0.26;
          const oz = -0.18;
          const c = Math.cos(front.turn);
          const sn = Math.sin(front.turn);
          place(`${k}:${n}`, { k: kind, s: 'clean' }, x + c * ox + sn * oz, TOP + (row ? 0.47 : 0.04), z - sn * ox + c * oz, 0, 0.9);
        }
      } else if (st.c === 'R') {
        let n = 0;
        for (const kind of Object.keys(sp))
          for (let q = 0; q < Math.min(4, sp[kind] ?? 0); q++, n++) place(`${k}:${kind}${q}`, { k: kind, s: 'dirty' }, x - 0.28 + (n % 4) * 0.19, TOP + 0.04 + Math.floor(n / 4) * 0.06, z + (n >= 4 ? 0.12 : -0.1), n, 0.85);
      }
    }

    // the hobbits, and what they carry
    figures.forEach((h, slot) => {
      const p = players.find((q) => q.slot === slot);
      h.g.visible = Boolean(p);
      if (!p) return;
      h.g.position.set(X(p.x), 0, Z(p.z));
      // (turned over a moment, not snapped)
      h.f.group.rotation.y = easeYaw(h.f.group.rotation.y, p.face, dt, 16);
      pose(h.f, t + slot, { moving: p.moving, speed: 1.1 });
      // on the cast (../cast3d.js): arms out under what he carries, at work at a station
      castDo(h.f, { upper: p.held ? 'walk.carry' : p.work ? 'interact' : null });
      const arms = h.f.arms;
      if (p.held) {
        arms[0].rotation.z = -1.25;
        arms[1].rotation.z = -1.25;
        const hx = X(p.x) + Math.cos(p.face) * 0.34;
        const hz = Z(p.z) - Math.sin(p.face) * 0.34;
        place(`p${slot}`, p.held, hx, 0.55 + (p.moving ? Math.abs(Math.sin(t * 13)) * 0.03 : 0), hz, p.face);
      } else if (p.work) {
        arms[1].rotation.z = -1.0 + Math.sin(t * 22) * 0.6;
        arms[0].rotation.z = -0.6;
      }
      h.disc.material.opacity = slot === me ? 0.95 : 0.6;
    });

    // your aim
    const mine = me != null ? s.players[me] : null;
    const tile = mine ? facingTile(s, players.find((q) => q.slot === me) ?? mine) : null;
    aim.visible = Boolean(tile);
    if (tile) {
      aim.position.set(X(tile[0] + 0.5), TOP + 0.02, Z(tile[1] + 0.5));
      aimEdge.material.color.set(COLOURS[me]);
      aimFill.material.color.set(COLOURS[me]);
      aimEdge.material.opacity = 0.7 + Math.sin(t * 6) * 0.25;
      aimFill.material.opacity = 0.2 + Math.sin(t * 6) * 0.08;
    }

    for (const [where, e] of shown) {
      if (e.used) continue;
      room.remove(e.mesh);
      shown.delete(where);
    }

    // the stream runs
    water?.tick(dt);
    extra?.tick?.(dt, t, s);
    thiefStep(dt, t);
    // the fires flicker (and burn down, where they need feeding: a ring as
    // one gets low, and nothing at all once it's out)
    for (const st of fires) {
      const fuel = s.spots[st.key]?.fuel;
      const k = fuel == null ? 1 : fuel > 0 ? 0.35 + 0.65 * Math.min(1, fuel * 3) : 0;
      st.glow.visible = k > 0;
      st.glow.material.color.copy(hot(0xff7a2a, (2 + Math.sin(t * 11 + st.x) * 0.4 + Math.sin(t * 17) * 0.2) * k));
      if (st.flame) st.glow.scale.setScalar((0.4 + 0.6 * k + Math.sin(t * 13 + st.z) * 0.05) * st.size);
      if (fuel != null && fuel < 0.3) ring(st.x, TOP + 1.2, st.z, fuel / 0.3, ORANGE, fuel < 0.12 && Math.sin(t * 14) > 0 ? 0.6 : 0);
      if (fuel === 0 && Math.random() < dt * 3) puff(st.x, TOP + 0.3, st.z, { color: 0x555555, size: 0.3, life: 1.6, opacity: 0.35 });
    }
    for (; ri < rings.length; ri++) rings[ri].visible = false;
    fireLights.forEach((l, k) => (l.intensity = 2.6 + Math.sin(t * 9 + k * 2) * 0.5 + Math.sin(t * 23 + k) * 0.25));

    for (const sp of puffs) {
      const u = sp.userData;
      if (!sp.visible) continue;
      u.life -= dt;
      if (u.life <= 0) {
        sp.visible = false;
        continue;
      }
      sp.position.addScaledVector(u.v, dt);
      const k = u.life / u.max;
      sp.material.opacity = u.opacity * k;
      sp.scale.setScalar(u.size * (1.6 - k * 0.6));
    }
    // (what's come in since, taken on now and then)
    house.follow({ adopt: houseFrames++ % 60 === 0 });
    // the people on the cast (../cast3d.js), drawn for this frame
    tickCast(scene, camera, dt);
    renderer.info.reset();
    stage.render(ms);
  };

  // effects for what happened (the rules' events)
  const fx = (e) => {
    if (!e.at) return;
    if (e.type === 'sneak' || e.type === 'shooed' || e.type === 'stolen') thiefAt(e);
    const x = X(e.at[0] + 0.5);
    const z = Z(e.at[1] + 0.5);
    // on the cast: the hobbit nearest it cheers a dish served, starts at a spill, wags a finger at a no
    const react = { served: 'cheer.one', spilt: 'scared', nope: 'nope' }[e.type];
    if (react) {
      const near = figures.filter((h) => h.g.visible).sort((a, b) => Math.hypot(a.g.position.x - x, a.g.position.z - z) - Math.hypot(b.g.position.x - x, b.g.position.z - z))[0];
      if (near) castPlay(near.f, react, { layer: 'upper' });
    }
    if (e.type === 'served') for (let k = 0; k < 10; k++) puff(x, TOP + 0.4, z, { color: 0xffd060, size: 0.16, life: 0.9, v: [(Math.random() - 0.5) * 1.6, 1.2 + Math.random(), (Math.random() - 0.5) * 1.6], opacity: 1 });
    else if (e.type === 'spilt') for (let k = 0; k < 8; k++) puff(x, TOP + 0.1, z + 0.4, { color: 0xd09030, size: 0.14, life: 0.8, v: [(Math.random() - 0.5) * 1.2, 0.8, 0.6 + Math.random() * 0.6], opacity: 0.9 });
    else if (e.type === 'chopped' || e.type === 'washed') for (let k = 0; k < 5; k++) puff(x, TOP + 0.2, z, { color: e.type === 'washed' ? 0xeaf6ff : 0xffffff, size: 0.12, life: 0.5, v: [(Math.random() - 0.5), 1, (Math.random() - 0.5)], opacity: 0.9 });
    else if (e.type === 'caught' && stations[`${e.at[0]},${e.at[1]}`]?.bob) {
      const b = stations[`${e.at[0]},${e.at[1]}`].bob.position;
      for (let k = 0; k < 10; k++) puff(b.x, 0.05, b.z, { color: 0xe8f6ff, size: 0.14, life: 0.7, v: [(Math.random() - 0.5) * 1.4, 1.2 + Math.random(), (Math.random() - 0.5) * 1.4], opacity: 0.9 });
    } else if (e.type === 'nope') for (let k = 0; k < 3; k++) puff(x, TOP + 0.4, z, { color: 0xff4030, size: 0.14, life: 0.4, v: [(Math.random() - 0.5) * 0.6, 0.6, 0], opacity: 0.9 });
  };

  // where a point in tile units is on screen (CSS px), or null
  const screenOf = (x, y, z) => {
    const p = V(X(x), y, Z(z)).project(camera);
    if (p.z > 1) return null;
    const { w, h } = stage.size;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h };
  };

  // ?debug: the bloom, the look, and whatever the page adds (the dash’s press), on one panel
  const tune = (more = []) => stage.tune([...houseGroups(house), ...more]);
  return {
    tune,
    render,
    fx,
    resize,
    screenOf,
    get lost() {
      return stage.lost;
    },
    get info() {
      const i = renderer.info;
      return { calls: i.render.calls, triangles: i.render.triangles, quality: stage.quality, t: last };
    },
    dispose() {
      gone = true;
      if (thief.model) disposeTree(thief.model.group);
      items.dispose();
      dot.dispose();
      water?.tex.dispose();
      for (const r of rings) r.material.dispose();
      ringGeo.dispose();
      for (const sp of puffs) sp.material.dispose();
      disposeTree(room);
      releaseCast(scene);
      stage.dispose();
    },
  };
}

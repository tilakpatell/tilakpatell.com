// Dunder Mifflin Scranton in WebGL: the set (./set.js) under the office's
// fluorescent light and its HDRI, the Scranton branch at their desks (the
// page's rigged cast, ../people.js), Jim walking about among them with the
// third-person camera the towns use, kept inside the walls and under the
// drop ceiling, and the documentary's look: a little flat, a little warm,
// a little grain. The state it draws comes from ./OfficeWorld.jsx.
//
// createOfficeWorld(canvas, { onLost }) → Promise<{ render(state, ms),
// fx(type, at?), screenOf(id), resize, dispose, lost, suggestYaw, info }>

import * as THREE from 'three';
import { createStage } from '../../../lib/stage3d';
import { device } from '../../../lib/device';
import { createFx } from '../../middleearth/shire/fx';
import { createGhosts } from '../../middleearth/towns/ghosts';
import { loadKit } from '../kit';
import { CAST as STAFF_HEIGHTS, loadPeople } from '../people';
import { makeProps } from '../props';
import { buildSet } from './set';
import { buildWarehouse } from './warehouse';
import { buildOutside } from './outside';
import { buildContactShade } from './ao';
import { bakeStatic } from './batch';
import { amblePaths } from './paths';
import { CEILING, CAST, COLLIDERS, DWIGHT_BACK, ERIN_BREAK, FIRE_BIN, PANIC, WALLS, inWarehouse, seatOf, spot } from './layout';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ── the camera keeps inside the walls and under the ceiling ──
const BLOCKERS = COLLIDERS.filter((c) => c.top).map((c) => ({ ...c }));
function boxDist(b, x, z) {
  return Math.max(Math.abs(x - b.x) - b.w / 2, Math.abs(z - b.z) - b.d / 2);
}
function segHits(ax, az, bx, bz) {
  for (const [x0, z0, x1, z1] of WALLS) {
    const d1 = (bx - ax) * (z0 - az) - (bz - az) * (x0 - ax);
    const d2 = (bx - ax) * (z1 - az) - (bz - az) * (x1 - ax);
    const d3 = (x1 - x0) * (az - z0) - (z1 - z0) * (ax - x0);
    const d4 = (x1 - x0) * (bz - z0) - (z1 - z0) * (bx - x0);
    if (d1 * d2 < 0 && d3 * d4 < 0) return true;
  }
  return false;
}
function nearWall(x, z, pad) {
  for (const [x0, z0, x1, z1] of WALLS) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz || 1)));
    if (Math.hypot(x - (x0 + t * dx), z - (z0 + t * dz)) < pad) return true;
  }
  return false;
}
// how far from `from` to `to` the camera can go, as a fraction
function clearance(from, to) {
  const N = 14;
  let px = from.x;
  let pz = from.z;
  for (let i = 1; i <= N; i++) {
    const k = i / N;
    const x = from.x + (to.x - from.x) * k;
    const y = from.y + (to.y - from.y) * k;
    const z = from.z + (to.z - from.z) * k;
    let bad = y > CEILING - 0.18 || segHits(px, pz, x, z) || nearWall(x, z, 0.22);
    if (!bad) for (const c of BLOCKERS) if (y < c.top + 0.1 && (c.kind === 'circle' ? Math.hypot(x - c.x, z - c.z) < c.r + 0.18 : boxDist(c, x, z) < 0.18)) bad = true;
    if (bad) return Math.max(0.12, (i - 1) / N);
    px = x;
    pz = z;
  }
  return 1;
}

export async function createOfficeWorld(canvas, { onLost } = {}) {
  const tier = device().tier;
  const soft = tier === 'low';
  const stage = createStage(canvas, { soft, shadows: tier === 'high', fov: 58, near: 0.05, far: 170, exposure: 0.94, bloom: { strength: 0.22, radius: 0.5, threshold: 1.6 }, onLost });
  // the show's look: fluorescent, a touch green and flat, with a little grain
  stage.grade({ contrast: 0.02, saturation: 0.92, vignette: 0.22, grain: 0.022, shadow: [0.0, 0.01, 0.006], high: [0.012, 0.012, 0.0] });
  const { scene, camera, renderer } = stage;
  renderer.info.autoReset = false;
  scene.background = new THREE.Color(0xd8d4c8);

  let kit;
  let props;
  let set;
  let cast;
  let wh;
  let out;
  try {
    kit = await loadKit(renderer);
    props = makeProps(kit);
    set = await buildSet(kit, props, { tier });
    wh = buildWarehouse(kit);
    out = buildOutside();
  } catch (e) {
    set?.dispose();
    kit?.dispose();
    stage.dispose();
    throw e;
  }
  // the soft dark where things meet the floor and the walls meet both
  const shade = buildContactShade();
  scene.add(set.group, wh.group, out.group, shade.group);
  // everything that stays put, merged by material a patch of floor at a time
  const baked = [
    bakeStatic(set.group, { keep: [set.stapler, set.jelloOnDesk, set.carried, set.pot, set.fireGlow, set.flicker?.mesh], shadowMin: 0.45 }),
    bakeStatic(wh.group, { keep: [wh.ball], shadowMin: 0.45 }),
    bakeStatic(out.group, { cell: 40 }),
  ];
  if (import.meta.env.DEV) console.info('office: baked', baked.map((b) => `${b.before}→${b.after}`).join(' '));
  const LAMPS = [...set.lights, ...wh.lights];
  const ballHome = wh.ball.position.clone();

  // ── light: the HDRI's office for the fill and reflections, the troffers'
  // cool overhead light, a soft daylight from the windows, and a pool of
  // the nearest troffers round Jim ──
  if (kit.env) {
    scene.environment = kit.env;
    scene.environmentIntensity = 0.6;
  }
  const hemi = new THREE.HemisphereLight(0xf6f8ff, 0x6a6458, 1.15);
  const key = new THREE.DirectionalLight(0xf3f6ff, 1.1);
  key.position.set(1.5, 14, 2.5); // nearly overhead, as under a grid of troffers
  key.target.position.set(0, 0, 0);
  if (tier === 'high') {
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const c = key.shadow.camera;
    c.left = -18;
    c.right = 18;
    c.top = 12;
    c.bottom = -12;
    c.near = 1;
    c.far = 40;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.03;
  }
  const day = new THREE.DirectionalLight(0xfff4e2, 0.35);
  day.position.set(-6, 5, -10);
  scene.add(hemi, key, key.target, day);
  // the troffers nearest Jim, as lights: each a wide cone straight down
  // from the fixture, so it pools on the desks and the carpet and leaves the
  // ceiling tiles round it alone (a point light there burnt them white)
  const POOL = tier === 'high' ? 6 : tier === 'mid' ? 4 : 2;
  const pool = Array.from({ length: POOL }, () => {
    const l = new THREE.SpotLight(0xf4f6ff, 0, 9, 1.18, 0.85, 2);
    scene.add(l, l.target);
    return l;
  });
  const alarm = new THREE.PointLight(0xff3a2a, 0, 30, 1.2);
  alarm.position.set(0, CEILING - 0.3, -2);
  scene.add(alarm);

  // smoke and sparks
  const fxRoot = new THREE.Group();
  scene.add(fxRoot);
  const fx = createFx(fxRoot, { scale: tier === 'high' ? 1 : tier === 'mid' ? 0.6 : 0.35 });

  // ── the people: everyone at their desk as their model comes; Jim on his
  // feet; the ones who get up for a job, standing copies ──
  const seated = new Map(); // who → person, in their chair
  const standing = new Map(); // who → person, on their feet (made when needed)
  let jim = null;
  let gone = false;
  const SIT_TYPING = new Set(['dwight', 'oscar', 'angela', 'kelly', 'ryan', 'toby', 'andy', 'erin']);
  const sitDown = (id) => {
    const seat = set.seats.get(id);
    const p = cast?.person(id, { pose: 'sit', typing: SIT_TYPING.has(id), idle: !SIT_TYPING.has(id), shadows: tier === 'high', keys: id === 'erin' ? 0.4 : 0.49 });
    if (!seat || !p) return;
    p.group.position.copy(seat.chair.position);
    p.group.rotation.y = seat.chair.rotation.y;
    seat.group.add(p.group);
    seated.set(id, p);
  };
  const stand = (id) => {
    if (standing.has(id)) return standing.get(id);
    const p = cast?.person(id, { pose: 'stand', idle: true, shadows: tier === 'high' });
    if (!p) return null;
    p.group.visible = false;
    scene.add(p.group);
    standing.set(id, p);
    return p;
  };
  // Jim first, then everyone else as they come
  const order = ['jim', 'dwight', 'erin', 'michael', 'pam', 'kevin', 'andy', 'stanley', 'phyllis', 'angela', 'oscar', 'creed', 'meredith', 'darryl', 'ryan', 'toby', 'kelly'].filter((id) => STAFF_HEIGHTS[id]);
  const loading = loadPeople(order, (id, c) => {
    cast = c;
    if (gone) return;
    if (id === 'jim') {
      jim = c.person('jim', { pose: 'stand', idle: true, shadows: tier === 'high' });
      if (jim) scene.add(jim.group);
    } else sitDown(id);
  });
  // wait for Jim at least, a few seconds at most, so the office opens with him in it
  await Promise.race([
    loading,
    new Promise((r) => {
      const t0 = performance.now();
      const poll = () => (jim || performance.now() - t0 > 6000 ? r() : setTimeout(poll, 60));
      poll();
    }),
  ]);
  // others online here (OfficeWorld's useTravellers), as the Middle-earth
  // towns and the Avengers compound show theirs: each a pale, shimmering Jim
  // from another branch, with their name over him. Nothing here bumps into
  // them, and they can't touch your jobs, nor you theirs.
  const ghosts = createGhosts({
    make: () => {
      const p = cast?.person('jim', { pose: 'stand', shadows: false });
      const group = new THREE.Group();
      if (!p) {
        // (Jim's model not to hand: a plain shape of him)
        group.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.3, 4, 10).translate(0, 0.86, 0), new THREE.MeshStandardMaterial()));
        return { group, top: 1.75 };
      }
      p.group.rotation.y = Math.PI / 2; // (a ghost's face, like Jim's, is measured from +x; a figure faces +z)
      group.add(p.group);
      // (his mesh and its materials are the cast's, shared with the real Jim:
      // not the ghost's to dispose; only his own skeleton is)
      return { group, top: 1.9, person: p, shared: true, dispose: () => p.group.traverse((o) => o.skeleton?.dispose()) };
    },
    animate: (f, t, p, dt) => {
      if (!f.person) return;
      f.person.walk(p.moving, Math.max(0.6, (p.speed ?? 1.4) / 2.3));
      f.person.update(t, dt);
      f.person.group.position.y = f.person.bob();
    },
    tag: 0.3,
    halo: 0.8,
  });
  scene.add(ghosts.group);

  // the runners in the fire drill: these get up and go
  const RUNNERS = ['michael', 'angela', 'kevin', 'oscar', 'andy', 'phyllis', 'stanley', 'dwight'];
  // the coworkers who get up now and then (layout's AMBLES, their ways
  // round the desks found once, ./paths.js)
  const WALK = 1.05; // an office's stroll, m/s
  const ambles = amblePaths()
    .filter((a) => a.path)
    .map((a) => {
      const len = a.path.reduce((n, p, i) => (i ? n + Math.hypot(p.x - a.path[i - 1].x, p.z - a.path[i - 1].z) : 0), 0);
      return { ...a, len, walk: len / WALK, back: [...a.path].reverse() };
    });

  // ── where to go next: a marker over each, bobbing, and a ring on the floor ──
  const markers = Array.from({ length: 4 }, () => {
    const g = new THREE.Group();
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), new THREE.MeshStandardMaterial({ color: 0x9cc8ff, emissive: 0x4a9bff, emissiveIntensity: 2.6, roughness: 0.3, metalness: 0.1 }));
    gem.scale.y = 1.55;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7fb4ff, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }));
    ring.renderOrder = 2;
    g.add(gem, ring);
    g.visible = false;
    scene.add(g);
    return { g, gem, ring };
  });

  const A = { t: 0, cam: { at: V(0, 2, 6), look: V(0, 1.4, 0) }, mode: null, shake: 0, suggest: null, nearAt: -1, near: [], fire: 0, smokeAt: 0 };
  const tmp = V(0, 0, 0);
  const tmp2 = V(0, 0, 0);
  const look = V(0, 0, 0);
  const head = V(0, 0, 0);
  const graded = { vignette: 0.22, high: [0.012, 0.012, 0], shadow: [0, 0.01, 0.006] };

  // someone standing moved to (x, z) facing `face`, walking or not
  const place = (p, x, z, face, walking, rate = 1) => {
    p.group.visible = true;
    p.group.position.set(x, 0, z);
    p.group.rotation.y = face + Math.PI / 2; // (face: 0 is +x, as the walker has it; a figure faces +z)
    p.walk(walking, rate);
    p.group.position.y = p.bob();
  };
  const along = (path, k) => {
    // a point k (0..1) of the way along a path of points, and its heading
    const segs = [];
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      const l = Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
      segs.push(l);
      total += l;
    }
    let d = Math.max(0, Math.min(1, k)) * total;
    for (let i = 0; i < segs.length; i++) {
      if (d <= segs[i] || i === segs.length - 1) {
        const a = path[i];
        const b = path[i + 1];
        const f = segs[i] ? Math.min(1, d / segs[i]) : 1;
        return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, face: Math.atan2(-(b.z - a.z), b.x - a.x) };
      }
      d -= segs[i];
    }
    return { ...path[path.length - 1], face: 0 };
  };

  const render = (s, ms) => {
    const dt = Math.min(0.05, ms / 1000);
    A.t += dt;
    if (import.meta.env.DEV && s.warp) A.t += s.warp; // (a dev hook: skip the clock ahead)
    const t = A.t;
    const h = s.jim;

    ghosts.update(s.travellers ?? [], t, dt);

    // ── Jim ──
    if (jim) {
      place(jim, h.x, h.z, h.face, h.speed > 0.3, h.running ? 1.45 : Math.max(0.6, h.speed / 2.3));
      jim.update(t, dt);
    }
    // what he's carrying: the Jell-O or the chili, held out in front
    const carrying = s.carry;
    set.jelloCarry.visible = carrying === 'jello';
    set.carried.visible = carrying === 'jello';
    if (carrying === 'jello' || carrying === 'chili') {
      const fwdX = Math.cos(h.face);
      const fwdZ = -Math.sin(h.face);
      const tip = carrying === 'chili' ? Math.sin(t * 9) * (s.slosh ?? 0) * 0.12 : 0;
      const target = carrying === 'chili' ? set.pot : set.carried;
      target.visible = true;
      target.position.set(h.x + fwdX * 0.42, 1.0 + (jim?.bob() ?? 0), h.z + fwdZ * 0.42);
      target.rotation.set(tip, h.face + Math.PI / 2, tip * 0.6);
      if (jim) {
        const hand = target.position;
        jim.reach('left', tmp.set(hand.x - fwdZ * 0.16, hand.y + 0.08, hand.z + fwdX * 0.16));
        jim.reach('right', tmp2.set(hand.x + fwdZ * 0.16, hand.y + 0.08, hand.z - fwdX * 0.16));
      }
    } else if (jim) {
      jim.reach('left', null);
      jim.reach('right', null);
    }
    // the pot where it is when it's not carried
    if (carrying !== 'chili') {
      if (s.chiliDone) {
        const k = spot('kitchen');
        set.pot.position.set(k.x, 0.92, k.z - 0.45);
      } else set.pot.position.set(set.potHome.x, 0, set.potHome.z);
      set.pot.rotation.set(0, 0, 0);
    }
    // the stapler, in Jell-O or not
    set.jelloOnDesk.visible = !!s.jelloSet;
    set.stapler.visible = !s.jelloSet;

    // ── who's where ──
    const away = new Set();
    // Erin on her break: at the vending machines
    if (s.erinBreak) {
      away.add('erin');
      const e = stand('erin');
      if (e) {
        place(e, ERIN_BREAK.at.x, ERIN_BREAK.at.z, ERIN_BREAK.face, false);
        e.update(t, dt);
      }
    } else standing.get('erin')?.group && (standing.get('erin').group.visible = false);
    // Dwight in the men's room, then on his way back
    const dw = standing.get('dwight') ?? (s.dwight !== 'desk' ? stand('dwight') : null);
    if (s.dwight === 'away') {
      away.add('dwight');
      if (dw) dw.group.visible = false;
    } else if (s.dwight === 'back') {
      away.add('dwight');
      if (dw) {
        const p = along(DWIGHT_BACK, s.dwightK ?? 0);
        place(dw, p.x, p.z, p.face, (s.dwightK ?? 0) < 1);
        dw.update(t, dt);
      }
    } else if (dw && !s.fire) dw.group.visible = false;
    // the fire drill: everyone who can, running about
    if (s.fire) {
      RUNNERS.forEach((id, i) => {
        const p = stand(id);
        if (!p) return;
        away.add(id);
        const [a, b] = PANIC[i % PANIC.length];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        const speed = 2.6 + (i % 3) * 0.5;
        const cyc = (s.fireT * speed + i * 3.1) / len;
        const k = cyc % 2 < 1 ? cyc % 1 : 1 - (cyc % 1);
        const dir = cyc % 2 < 1 ? 1 : -1;
        const x = a.x + (b.x - a.x) * k + Math.sin(t * 3 + i) * 0.25;
        const z = a.z + (b.z - a.z) * k + Math.cos(t * 2.6 + i) * 0.25;
        place(p, x, z, Math.atan2(-(b.z - a.z) * dir, (b.x - a.x) * dir), true, 1.6);
        if (i % 3 === 0) p.gesture('cheer'); // arms in the air
        p.update(t, dt);
        s.runners?.push({ x, z });
      });
    } else {
      for (const id of RUNNERS) {
        const p = standing.get(id);
        if (p && !(id === 'dwight' && s.dwight === 'back') && !(id === 'erin' && s.erinBreak)) p.group.visible = false;
      }
    }
    // the amblers: up from the desk, along their way, a moment there, back
    // and sat down again (not in the fire drill: then everyone runs)
    if (!s.fire)
      for (const a of ambles) {
        const cyc = (t + a.offset) % a.every;
        const sit = a.every - (a.walk * 2 + a.wait);
        if (cyc < sit || (s.dwight !== 'desk' && a.who === 'dwight')) {
          if (standing.get(a.who) && !RUNNERS.includes(a.who)) standing.get(a.who).group.visible = false;
          continue;
        }
        const p = stand(a.who);
        if (!p) continue;
        away.add(a.who);
        const k = cyc - sit;
        let at;
        let walking = true;
        if (k < a.walk) at = along(a.path, k / a.walk);
        else if (k < a.walk + a.wait) {
          const end = a.path[a.path.length - 1];
          at = { x: end.x, z: end.z, face: a.face };
          walking = false;
        } else at = along(a.back, (k - a.walk - a.wait) / a.walk);
        place(p, at.x, at.z, at.face, walking, 0.8);
        p.look(Math.hypot(at.x - h.x, at.z - h.z) < 2.6 ? head.set(h.x, 1.55, h.z) : null);
        p.update(t, dt);
        s.runners?.push({ x: at.x, z: at.z });
        s.ambling?.push({ id: a.who, x: at.x, z: at.z });
      }
    // the seated: in their chairs unless they're up; heads turning to Jim
    // when he's close
    head.set(h.x, 1.55, h.z);
    for (const [id, p] of seated) {
      p.group.visible = !away.has(id);
      if (!p.group.visible) continue;
      const c = CAST.find((x) => x.id === id);
      const close = c && Math.hypot(c.x - h.x, c.z - h.z) < 3.2;
      p.look(close || s.talkTo === id ? head : null);
      if (s.wave === id) p.wave();
      p.update(t, dt);
    }

    // ── light: the nearest troffers to Jim, picked now and then ──
    if (t - A.nearAt > 0.4) {
      A.nearAt = t;
      A.near = LAMPS
        .map((p) => [p, Math.hypot(p[0] - h.x, p[2] - h.z)])
        .sort((a, b) => a[1] - b[1])
        .slice(0, POOL)
        .map((p) => p[0]);
    }
    // the warehouse: its lamps are higher and brighter
    const down = inWarehouse(h.x, h.z);
    // the basketball
    if (s.ballAt) wh.ball.position.set(s.ballAt.x, s.ballAt.y, s.ballAt.z);
    else wh.ball.position.copy(ballHome);
    if (s.ballAt?.spin) wh.ball.rotation.z += dt * 9;
    const red = s.fire ? 0.5 + 0.5 * Math.sin(t * 7) : 0;
    A.fire += ((s.fire ? 1 : 0) - A.fire) * Math.min(1, dt * 2);
    // the markers over where to go next: the nearest three on Jim's floor,
    // not over where he already is (the corner map shows them all)
    const next = (s.markers ?? [])
      .filter((at) => (at.x > 25) === (h.x > 25) && Math.hypot(at.x - h.x, at.z - h.z) > 1.3)
      .sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z))
      .slice(0, 3);
    markers.forEach((m, i) => {
      const at = next[i];
      const show = !!at;
      m.g.visible = !!show;
      if (!show) return;
      m.g.position.set(at.x, 0, at.z);
      m.gem.position.y = 2.05 + Math.sin(t * 2.2 + i) * 0.07;
      m.gem.rotation.y = t * 1.4 + i;
      const pulse = (t * 0.8 + i * 0.3) % 1;
      m.ring.scale.setScalar(0.8 + pulse * 0.5);
      m.ring.material.opacity = 0.55 * (1 - pulse);
      m.ring.position.y = 0.015;
    });
    // the annex's tired tube: steady, then a stutter now and then
    let flick = 1;
    if (set.flicker) {
      const c = t % 9.3;
      flick = c < 0.9 ? (Math.sin(c * 61) * Math.sin(c * 23) > -0.1 ? 1 : 0.08) : c < 1.2 ? 0.35 : 1;
      set.flicker.material.emissiveIntensity = 2.4 * flick;
    }
    pool.forEach((l, i) => {
      const v = A.near[i];
      if (!v) return (l.intensity = 0);
      l.position.set(v[0], v[1] + 0.15, v[2]);
      l.target.position.set(v[0], 0, v[2]);
      l.intensity = (down ? 60 : 9) * (1 - A.fire * 0.4) * (set.flicker && v === set.lights[set.flicker.index] ? flick : 1);
      l.distance = down ? 16 : 9;
      return undefined;
    });
    alarm.intensity = A.fire * red * 60;
    alarm.position.set(h.x, CEILING - 0.3, h.z);
    hemi.intensity = 1.15 * (1 - A.fire * 0.25);
    graded.vignette = 0.22 + A.fire * 0.2;
    graded.high[0] = 0.012 + A.fire * red * 0.06;
    stage.grade(graded);
    // the fire in Dwight's bin, and its smoke
    set.fireGlow.intensity = A.fire * (6 + Math.sin(t * 17) * 2);
    if (s.fire && t - A.smokeAt > 0.06) {
      A.smokeAt = t;
      fx.flame(V(FIRE_BIN.x, 0.35, FIRE_BIN.z), 0.12);
      fx.chimney(V(FIRE_BIN.x, 0.6, FIRE_BIN.z));
    }

    // ── the camera: behind Jim, kept inside the walls and under the ceiling ──
    let camAt;
    let camLook;
    if (s.deskCam && s.mode !== 'walk') {
      camAt = tmp.set(...s.deskCam.at);
      camLook = look.set(...s.deskCam.look);
    } else {
      const yaw = s.camYaw ?? 0;
      const pitch = s.camPitch ?? 0.24;
      const dist = s.mode === 'talk' ? 2.4 : (s.camDist ?? 3.4);
      look.set(h.x, 1.5, h.z);
      camAt = tmp.set(h.x + Math.sin(yaw) * Math.cos(pitch) * dist, 1.5 + Math.sin(pitch) * dist, h.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      const k = clearance(look, camAt);
      A.suggest = null;
      if (k < 0.55) {
        let best = k;
        for (const dy of [0.6, -0.6, 1.2, -1.2, 2, -2]) {
          const y2 = yaw + dy;
          const kk = clearance(look, tmp2.set(h.x + Math.sin(y2) * Math.cos(pitch) * dist, 1.5 + Math.sin(pitch) * dist, h.z + Math.cos(y2) * Math.cos(pitch) * dist));
          if (kk > best + 0.15) {
            best = kk;
            A.suggest = y2;
          }
        }
      }
      if (k < 1) camAt.lerpVectors(look, camAt, k);
      camLook = look;
    }
    if (import.meta.env.DEV && s.debugCam) {
      camAt = tmp.set(...s.debugCam.at);
      camLook = look.set(...s.debugCam.look);
    }
    const jump = A.mode !== s.mode || s.snapCam;
    A.mode = s.mode;
    const ease = jump ? 1 : Math.min(1, dt * (s.mode === 'walk' ? 9 : 3));
    A.cam.at.lerp(camAt, ease);
    A.cam.look.lerp(camLook, ease);
    camera.position.copy(A.cam.at);
    if (A.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * A.shake;
      camera.position.y += (Math.random() - 0.5) * A.shake;
      A.shake = Math.max(0, A.shake - dt * 0.8);
    }
    camera.lookAt(A.cam.look);
    // upstairs or down: the office and the warehouse with its lot can't see
    // each other, so only the one the camera's on is drawn (and the lot's
    // horizon, which would otherwise run through the office, stays outside)
    const below = camera.position.x > 25;
    set.group.visible = !below;
    wh.group.visible = below;
    out.group.visible = below;

    set.windows.step(t);
    out.step(t);
    fx.step(dt, t, { night: 0, day: 1 });
    renderer.info.reset();
    stage.render(ms);
  };

  const fxEvent = (type, at = null) => {
    const p = at ? V(at.x ?? 0, at.y ?? 1.2, at.z ?? 0) : null;
    if (type === 'pop' && p) fx.pop(p, at.colour ?? 'gold', 20, 1.8);
    else if (type === 'spill' && p) {
      set.spill(p);
      fx.puff(V(p.x, 0.3, p.z), V(0, 0.6, 0), 10);
      A.shake = Math.max(A.shake, 0.06);
    } else if (type === 'clearSpills') set.clearSpills();
    else if (type === 'caught') A.shake = 0.18;
    else if (type === 'fire') {
      fx.pop(V(FIRE_BIN.x, 1, FIRE_BIN.z), 'red', 26, 2);
      A.shake = 0.12;
    } else if (type === 'award') {
      const m = seatOf('michael');
      fx.pop(V(m.x, 1.8, m.z + 0.6), 'gold', 40, 2.4);
      fx.pop(V(m.x, 2, m.z + 0.6), 'white', 20, 2);
    } else if (type === 'jello') {
      const d = seatOf('dwight');
      fx.pop(V(d.x, 1.0, d.z), 'green', 22, 1.5);
    }
  };

  // where someone's head is on screen, for the speech bubbles
  const screenOf = (id) => {
    let p = null;
    if (standing.get(id)?.group.visible) p = standing.get(id).headAt(V());
    else if (seated.get(id)?.group.visible) p = seated.get(id).headAt(V());
    if (!p) {
      const c = CAST.find((x) => x.id === id);
      if (!c) return null;
      p = V(c.x, 1.3, c.z);
    }
    p.y += 0.32;
    p.project(camera);
    if (p.z > 1 || Math.abs(p.x) > 1.2 || Math.abs(p.y) > 1.2) return null;
    const { w, h } = stage.size;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h };
  };

  // everything's shaders linked before the first frame
  await stage.precompile();
  // and the people who come later, as they come (they're shown at once;
  // the page's 3D office links theirs the same way)
  loading.then(() => !gone && stage.precompile());

  return {
    scene: import.meta.env.DEV ? scene : null,
    renderer: import.meta.env.DEV ? renderer : null,
    render,
    fx: fxEvent,
    screenOf,
    resize: stage.resize,
    info() {
      const i = renderer.info;
      return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, quality: stage.quality, tier, people: seated.size };
    },
    get lost() {
      return stage.lost;
    },
    get suggestYaw() {
      return A.suggest ?? null;
    },
    get ready() {
      return !!jim;
    },
    dispose() {
      gone = true;
      ghosts.dispose();
      fx.dispose?.();
      set.dispose();
      wh.dispose();
      out.dispose();
      shade.dispose();
      for (const b of baked) b.dispose();
      props.dispose();
      loading.then((c) => c?.dispose());
      kit.dispose();
      stage.dispose();
    },
  };
}


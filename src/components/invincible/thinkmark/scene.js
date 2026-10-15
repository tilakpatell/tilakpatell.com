// Think, Mark! in 3D: the city by day, at dusk and at night under a
// photographed sky (Poly Haven, CC0), and the people in it as HD models:
// Invincible (made for this page with Meshy), Omni-Man and Thragg (from
// Sketchfab, CC BY), posed every frame by lib/three/rig from the rules'
// state: hanging in the air, flat out with a fist ahead, winding up,
// punching, knocked flying. The Flaxans are built in code. The rules
// (./rules.js) say what happens; this draws it, turns its events into
// sparks, shockwaves and broken concrete, and keeps a camera behind Mark
// that never ends up inside a tower. The HUD is drawn by the page on top.

import * as THREE from 'three';
import { createStage, hot } from '../../avengers/hq/stage';
import { createVfx } from '../../avengers/hq/vfx';
import { createFeel } from '../../avengers/hq/feel';
import { buildHumanoid, poseHumanoid } from '../../avengers/hq/kit/humanoid';
import { POSES, figure, loadFigure } from '../../../lib/three/rig';
import { prefersReducedMotion } from '../../../lib/hooks';
import { reach } from './city';
import { CHAPTERS, PORTAL, QUAKE, RINGS, bossTell, city, lockTarget } from './rules';
import { buildTown } from './town';
import { CAST, asset } from '../cast';
import { LOOK as ART } from './look';
const FOV = 62;
const YELLOW = 0xffd23a;
const FLAX = 0xd04dff;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (v, to, rate, dt) => v + (to - v) * (1 - Math.exp(-rate * dt));
const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// how each chapter looks: its sky, how the sky sits, the light, the fog, the night
const LOOK = {
  noon: { sky: 'noon', rotate: 0.6, env: 1, bg: 1, sun: 3, fill: 0.2, fog: { density: 0.0011 }, night: 0, exposure: 1 },
  dusk: { sky: 'dusk', rotate: 2.2, env: 0.62, bg: 1, sun: 2.6, sunColor: [1, 0.66, 0.4], fill: 0.16, fog: { density: 0.0012, tint: 0.62 }, night: 0.45, exposure: 1 },
  // (the sky's photo is exposed like a day's: turned right down, it's night; the haze, its colour at the horizon)
  night: { sky: 'night', rotate: 0, env: 0.22, bg: 0.2, sun: 0.75, sunDir: [-0.3, 0.75, -0.4], sunColor: [0.62, 0.72, 1], fill: 0.42, fog: { density: 0.0011, color: new THREE.Color(0.075, 0.088, 0.105) }, night: 1, exposure: 1 },
};

export async function create(rt, { onSlow } = {}) {
  const calm = prefersReducedMotion();
  const engine = createStage(rt, { exposure: 1, fov: FOV, near: 0.1, far: 2800, bloom: ART.bloom, onSlow });
  const { scene, camera } = engine;
  const small = engine.small;
  const C = city();

  // ── the city ──
  const town = buildTown(C, { small });
  scene.add(town.group);

  // ── the people ──
  const [markT, omniT, thraggT] = await Promise.all(['mark', 'omni', 'thragg'].map((n) => loadFigure(asset(CAST[n].file))));
  const mark = figure(markT, CAST.mark);
  const omni = figure(omniT, CAST.omni);
  const thragg = figure(thraggT, CAST.thragg);
  for (const f of [mark, omni, thragg]) {
    scene.add(f.holder);
    f.snap(POSES.hover(0));
    f.lean = new THREE.Quaternion();
  }
  omni.holder.visible = false;
  thragg.holder.visible = false;
  // a glow in each Viltrumite's fist as he winds up
  const fistGlow = (color) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshBasicMaterial({ color: hot(color, 4), toneMapped: false, transparent: true, opacity: 0 }));
    s.renderOrder = 9;
    scene.add(s);
    return s;
  };
  omni.glow = fistGlow(0xffe2c0);
  thragg.glow = fistGlow(0xff6a5a);

  // the Flaxans: small, armoured, purple, with something glowing on their arms
  const flaxMats = {
    armour: new THREE.MeshStandardMaterial({ color: 0x4b3a78, metalness: 0.65, roughness: 0.38 }),
    skin: new THREE.MeshStandardMaterial({ color: 0x8b8fa8, roughness: 0.65 }),
    glow: new THREE.MeshBasicMaterial({ color: hot(FLAX, 2.6), toneMapped: false }),
  };
  const flaxans = Array.from({ length: 10 }, () => {
    const h = buildHumanoid({ style: 'chitauri', materials: flaxMats, scale: 0.74 });
    const holder = new THREE.Group();
    h.root.position.y = -0.95 * 0.74; // the hips at the holder
    holder.add(h.root);
    holder.visible = false;
    scene.add(holder);
    return { h, holder, id: null };
  });

  // ── the lesson's rings ──
  const ringMat = new THREE.MeshBasicMaterial({ color: hot(YELLOW, 2.2), toneMapped: false, transparent: true });
  const ringGeo = new THREE.TorusGeometry(RINGS.r, 0.32, 10, 64);
  const ringMeshes = Array.from({ length: RINGS.n }, () => {
    const m = new THREE.Mesh(ringGeo, ringMat.clone());
    m.visible = false;
    scene.add(m);
    return m;
  });

  // ── the Flaxans' portal ──
  const portalMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uOpen: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOpen;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        float r = length(vUv) / max(0.001, uOpen);
        if (r > 1.0) discard;
        float a = atan(vUv.y, vUv.x);
        float s = a - uTime * 0.6 + 2.2 / (r + 0.3);
        float n = noise(vec2(cos(s), sin(s)) * 3.0 + r * 5.0 - uTime * 0.5) * 0.65 + noise(vec2(s * 2.0, r * 9.0 - uTime)) * 0.35;
        vec3 col = mix(vec3(0.03, 0.0, 0.06), mix(vec3(0.35, 0.05, 0.6), vec3(1.6, 0.6, 2.0), n * n), smoothstep(0.1, 0.95, r) * (0.3 + n * 0.7));
        float rim = smoothstep(0.75, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r));
        col += vec3(1.8, 0.7, 2.4) * rim * (1.6 + n * 2.0);
        gl_FragColor = vec4(col, smoothstep(1.0, 0.93, r));
      }`,
  });
  const portal = new THREE.Mesh(new THREE.CircleGeometry(PORTAL.r, 72), portalMat);
  portal.position.set(...PORTAL.p);
  portal.visible = false;
  portal.renderOrder = 4;
  scene.add(portal);

  // ── the Flaxans' bolts ──
  const BOLTS = 40;
  const bolts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshBasicMaterial({ color: hot(FLAX, 3.2), toneMapped: false }), BOLTS);
  bolts.frustumCulled = false;
  bolts.count = 0;
  scene.add(bolts);

  // ── a Viltrumite's dive: the shockwave, a dome of air ──
  const quakeMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 40, 20),
    new THREE.MeshBasicMaterial({ color: hot(0xfff0dc, 1.6), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }),
  );
  quakeMesh.visible = false;
  scene.add(quakeMesh);

  // the lock-on and the charge's line are drawn by the page; the effects are pooled
  const vfx = createVfx(scene, { calm, maxSparks: small ? 500 : 900, maxPuffs: small ? 160 : 260, maxDebris: small ? 90 : 160, debrisMaterial: new THREE.MeshStandardMaterial({ color: 0x9a968e, roughness: 0.85 }) });
  const feel = createFeel({ calm, baseFov: FOV, offset: 0.35 });

  // ── the sky, per chapter ──
  let look = null;
  async function setChapter(i) {
    const L = LOOK[CHAPTERS[i].sky];
    if (look === L) return;
    look = L;
    scene.fog = null;
    await engine.setSky(L.sky, { rotate: L.rotate, envIntensity: L.env, bgIntensity: L.bg, sunIntensity: L.sun, sunColor: L.sunColor, sunDir: L.sunDir, fill: L.fill, fog: L.fog });
    engine.exposure = L.exposure;
    town.setNight(L.night);
  }
  await setChapter(0);

  // ── the camera: behind Mark, toward what he's fighting ──
  const cam = { yaw: Math.PI, pitch: -0.12, dist: 7.5, speed: 0, manual: 0, ready: false, pos: new THREE.Vector3(), at: new THREE.Vector3() };
  const look3 = (yaw, pitch) => new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  function placeCamera(g, dt) {
    const m = g.mark;
    const P = V(m.p);
    const speed = Math.hypot(...m.v);
    const lock = lockTarget(g);
    const fight = CHAPTERS[g.chapter].id !== 'lesson';
    cam.manual -= dt;
    if (lock && fight && dist3(lock.p, m.p) < 160) {
      // over his shoulder, at what he's fighting
      const d = V(lock.p).sub(P);
      const yaw = Math.atan2(d.x, d.z);
      const pitch = clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)) * 0.55 - 0.14, -0.85, 0.7);
      const rate = cam.manual > 0 ? 0.6 : 3.2;
      cam.yaw += angle(yaw - cam.yaw) * (1 - Math.exp(-rate * dt));
      cam.pitch = damp(cam.pitch, pitch, rate, dt);
    } else if (speed > 7 && cam.manual <= 0) {
      // behind where he's going
      const yaw = Math.atan2(m.v[0], m.v[2]);
      cam.yaw += angle(yaw - cam.yaw) * (1 - Math.exp(-1.8 * dt));
      const pitch = clamp(Math.atan2(m.v[1], Math.hypot(m.v[0], m.v[2])) * 0.5 - 0.1, -0.7, 0.6);
      cam.pitch = damp(cam.pitch, pitch, 1.4, dt);
    }
    // how fast he's flying (a dash or a knock doesn't pull the camera back)
    cam.speed = dt === 0 ? (m.state === 'fly' ? speed : 0) : damp(cam.speed, m.state === 'fly' ? speed : Math.min(cam.speed, 30), 2.5, dt);
    const want = clamp(4.8 + cam.speed * 0.045, 4.8, 7.4) + (fight ? 0.9 : 0);
    cam.dist = dt === 0 ? want : damp(cam.dist, want, 3, dt);
    const f = look3(cam.yaw, cam.pitch);
    const anchor = P.clone().add(new THREE.Vector3(0, 1.1, 0));
    const pos = anchor.clone().addScaledVector(f, -cam.dist).add(new THREE.Vector3(0, 0.55, 0));
    // never inside a tower: stop short of the wall
    const k = reach(C.idx, anchor.toArray(), pos.toArray(), 0.8);
    pos.lerpVectors(anchor, pos, Math.max(0.12, k));
    const at = P.clone().addScaledVector(f, 5).add(new THREE.Vector3(0, 0.9, 0));
    if (!cam.ready || dt === 0) {
      cam.pos.copy(pos);
      cam.at.copy(at);
      cam.ready = true;
    } else {
      cam.pos.lerp(pos, 1 - Math.exp(-14 * dt));
      cam.at.lerp(at, 1 - Math.exp(-16 * dt));
    }
    camera.position.copy(cam.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(cam.at);
    feel.setBaseFov(FOV + clamp((cam.speed - 28) / 36, 0, 1) * 9);
    feel.update(dt, camera);
    engine.setShadowBox(P, 46, 300);
  }
  const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  // ── a flyer's body: upright when still, along his flight when fast ──
  // (his crown along it; or, `ahead`, his front, when his fly clip lies along it itself)
  const Y = new THREE.Vector3(0, 1, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  const qTmp = new THREE.Quaternion();
  const qYaw = new THREE.Quaternion();
  const vTmp = new THREE.Vector3();
  function carry(f, p, yaw, v, dt, { lean = 1, roll = 0, toward = null, ahead = false } = {}) {
    f.holder.position.set(p[0], p[1], p[2]);
    f.holder.rotation.set(0, yaw, 0);
    const speed = Math.hypot(v[0], v[1], v[2]);
    const k = clamp((speed - 8) / 30, 0, 1) * lean;
    // which way is up for him: blend from the sky to his flight (or to where he's punching)
    const dir = toward ? V(toward).normalize() : speed > 0.1 ? V(v).divideScalar(speed) : Y.clone();
    const axis = ahead ? Z : Y;
    qYaw.setFromAxisAngle(Y, -yaw);
    dir.applyQuaternion(qYaw); // into his own frame
    vTmp.copy(axis).lerp(dir, toward ? lean : k).normalize();
    qTmp.setFromUnitVectors(axis, vTmp);
    if (roll) qTmp.multiply(new THREE.Quaternion().setFromAxisAngle(Y, roll));
    f.lean.slerp(qTmp, dt === 0 ? 1 : 1 - Math.exp(-9 * dt));
    f.body.quaternion.copy(f.lean);
    return k;
  }
  // where a world point is, in a figure's own frame (for aiming a punch)
  const inFrame = (f, worldDir) => {
    f.body.getWorldQuaternion(qTmp);
    const d = V(worldDir).normalize().applyQuaternion(qTmp.invert());
    return [d.x, d.y, d.z];
  };

  // Mark: his own motion-captured hover under everything (the hit clip when
  // he's knocked flying), and the aimed poses over it, laid on and eased
  // off (a punch at the one he's locked on, the guard of a dodge, flat out)
  function poseMark(g, dt, t) {
    const m = g.mark;
    let pose = null;
    let rate = 12;
    if (m.state === 'dash' || m.state === 'jab') {
      const tgt = m.state === 'dash' ? lockTarget(g) : null;
      const dir = tgt ? [tgt.p[0] - m.p[0], tgt.p[1] - m.p[1], tgt.p[2] - m.p[2]] : m.v;
      carry(mark, m.p, m.yaw, m.v, dt, { toward: dir, lean: 0.55 });
      pose = POSES.punch(inFrame(mark, dir));
      rate = m.state === 'dash' ? 26 : 18;
    } else if (m.state === 'dodge') {
      const k = clamp(m.t / 0.26, 0, 1);
      carry(mark, m.p, m.yaw, m.v, dt, { lean: 0.5, roll: m.side * k * Math.PI * 2 });
      pose = POSES.guard();
    } else if (m.state === 'hurt') {
      carry(mark, m.p, m.yaw, m.v, dt, { lean: 0.4, roll: m.t * 6 });
      if (!mark.act('hit', { once: true, fade: 0.08 })) pose = POSES.hurt();
    } else {
      // flat out, his fly clip lies along his flight itself (as the city's does)
      const fast = clamp((Math.hypot(...m.v) - 8) / 30, 0, 1) > 0.45 && mark.clips.includes('fly');
      const k = carry(mark, m.p, m.yaw, m.v, dt, { ahead: fast });
      if (k > 0.45) {
        if (!mark.act('fly', { fade: 0.35 })) pose = POSES.fly();
      } else if (!mark.act('hover', { fade: 0.35 })) pose = POSES.hover(t);
    }
    if (m.state !== 'hurt' && pose) mark.act('hover', { fade: 0.25 });
    if (pose) mark.pose(pose, dt, rate);
    mark.tick(dt);
  }

  // Omni-Man or Thragg, from the boss state (or the guide in the lesson):
  // his own hover under the poses that tell what's coming (the windup, the
  // charge flat out, hands on his hips sizing Mark up), his hit clip when
  // he's staggered, his landing at a dive's end; turned to face where the
  // rules face him, but eased round, not snapped; his eyes on Mark
  const yaws = new Map();
  const markHead = new THREE.Vector3();
  function faceOf(f, yaw, dt, rate = 10) {
    const was = yaws.get(f) ?? yaw;
    const now = dt === 0 ? yaw : was + angle(yaw - was) * (1 - Math.exp(-rate * dt));
    yaws.set(f, now);
    return now;
  }
  const HIPS = (() => {
    const p = POSES.proud();
    return { armL: p.armL, foreL: p.foreL, armR: p.armR, foreR: p.foreR };
  })();
  function poseViltrumite(f, b, dt, t, g) {
    const toward = b.dir ?? [0, 0, 1];
    const yaw = faceOf(f, b.yaw ?? 0, dt, b.state === 'charge' || b.state === 'dive' ? 16 : 8);
    let pose = null;
    let clip = 'hover';
    switch (b.state) {
      case 'windup':
        carry(f, b.p, yaw, b.v, dt, { lean: 0.3 });
        pose = POSES.windup();
        break;
      case 'charge':
      case 'dive':
        carry(f, b.p, yaw, b.v, dt, { toward, lean: 0.9 });
        pose = POSES.fly();
        break;
      case 'recover':
        carry(f, b.p, yaw, b.v, dt, { lean: 0.3 });
        break;
      case 'stagger':
        carry(f, b.p, yaw, b.v, dt, { lean: 0.3, roll: Math.sin(b.t * 9) * 0.3 });
        clip = 'hit';
        break;
      case 'rise':
      case 'leave':
        carry(f, b.p, yaw, b.v, dt, { lean: 1 });
        pose = POSES.fly();
        break;
      case 'down':
        carry(f, b.p, yaw, [0, 1, 0], dt, { lean: 0 });
        f.body.rotation.x = -0.6 - b.t * 0.4;
        pose = POSES.fall(t);
        break;
      default: {
        const k = carry(f, b.p, yaw, b.v, dt);
        pose = k > 0.45 ? POSES.fly() : b.state === 'circle' ? HIPS : null;
      }
    }
    // coming in: a taunt (his arms; his hover goes on under it)
    if (b.state === 'intro' && f.was !== 'intro') f.play('taunt', { layer: 'upper' });
    f.was = b.state;
    if (!f.act(clip, clip === 'hit' ? { once: true, fade: 0.08 } : { fade: 0.3 })) pose ??= clip === 'hit' ? POSES.hurt() : POSES.hover(t * 1.6);
    if (pose) f.pose(pose, dt, b.state === 'charge' ? 20 : 10);
    // sizing him up, his eyes on him (not while he's flat out at him: the pose has his head)
    const m = g.mark;
    f.look(b.state === 'charge' || b.state === 'dive' || b.state === 'down' ? null : markHead.set(m.p[0], m.p[1] + 1.6, m.p[2]));
    f.tick(dt);
    // the fist glows through the windup and the climb
    const tell = bossTell(b);
    const glow = tell?.windup ?? 0;
    const hand = f.bones.handR;
    if (hand && glow > 0) hand.getWorldPosition(f.glow.position);
    f.glow.material.opacity = glow > 0 ? 0.25 + glow * 0.75 : 0;
    f.glow.scale.setScalar(0.6 + glow * 1.6 + (glow > 0.85 ? Math.sin(t * 60) * 0.3 : 0));
    f.glow.visible = glow > 0;
  }

  // ── a frame ──
  let time = 0;
  let mode = null;
  function render(g, dt) {
    time += dt;
    const id = CHAPTERS[g.chapter].id;
    if (mode !== id) {
      mode = id;
      omni.holder.visible = id === 'lesson' || id === 'omni';
      thragg.holder.visible = id === 'thragg';
      portal.visible = id === 'flaxans';
      for (const r of ringMeshes) r.visible = false;
      vfx.clear();
      cam.ready = false;
    }
    poseMark(g, dt, time);
    // the guide (his hover, hands on his hips, his eyes on his son), the boss
    if (id === 'lesson' && g.guide) {
      const gd = g.guide;
      const k = carry(omni, gd.p, faceOf(omni, gd.yaw, dt, 6), gd.v, dt);
      if (omni.act('hover', { fade: 0.4 })) omni.pose(k > 0.45 ? POSES.fly() : HIPS, dt, 8);
      else omni.pose(k > 0.45 ? POSES.fly() : POSES.proud(), dt, 8);
      omni.look(k > 0.45 ? null : markHead.set(g.mark.p[0], g.mark.p[1] + 1.6, g.mark.p[2]));
      omni.tick(dt);
      omni.glow.visible = false;
    }
    if (g.boss) poseViltrumite(g.boss.kind === 'omni' ? omni : thragg, g.boss, dt, time, g);
    if (g.boss?.kind === 'omni' && g.boss.state === 'leave' && g.boss.p[1] > 600) omni.holder.visible = false;

    // the rings: the next one bright and turning, the two after it dim
    if (id === 'lesson') {
      g.rings.forEach((r, i) => {
        const m = ringMeshes[i];
        const ahead = i - g.ring;
        m.visible = ahead >= 0 && ahead < 3;
        if (!m.visible) return;
        m.position.set(...r.p);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), V(r.n));
        const s = (ahead === 0 ? 1 + Math.sin(time * 5) * 0.04 : 1) * (g.difficulty === 'guardian' ? 1.3 : g.difficulty === 'viltrumite' ? 0.85 : 1);
        m.scale.setScalar(s);
        m.material.opacity = ahead === 0 ? 1 : ahead === 1 ? 0.45 : 0.2;
      });
    }

    // the portal opening, turning, closing
    if (g.portal) {
      portalMat.uniforms.uTime.value = time;
      portalMat.uniforms.uOpen.value = g.portal.open;
      portal.lookAt(portal.position.clone().add(V(PORTAL.n)));
      if (!calm && g.portal.open > 0.2 && Math.random() < dt * 20) vfx.sparks(V(PORTAL.p).add(new THREE.Vector3((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 1)), { count: 2, speed: 3, color: 0xf0a0ff, to: 0x6020a0, life: 0.8, size: 0.25, gravity: 0 });
    }

    // the Flaxans, by id, onto the pool
    const alive = new Set(g.enemies.map((e) => e.id));
    for (const fx of flaxans) if (fx.id != null && !alive.has(fx.id)) fx.id = null;
    for (const e of g.enemies) {
      let fx = flaxans.find((x) => x.id === e.id);
      if (!fx) {
        fx = flaxans.find((x) => x.id == null);
        if (!fx) continue;
        fx.id = e.id;
      }
      fx.holder.visible = true;
      fx.holder.position.set(...e.p);
      fx.holder.rotation.set(0, e.yaw ?? 0, 0);
      if (e.state === 'ko') {
        fx.holder.rotation.x = e.spin;
        poseHumanoid(fx.h, { t: time, mode: 'hover', flinch: 1 });
      } else poseHumanoid(fx.h, { t: time + e.id, mode: 'hover', aim: e.state === 'aim' ? 1 : 0.35, lean: Math.min(1, Math.hypot(...e.v) / 20) * 0.6 });
      // the old ones are greyer
      fx.h.root.scale.setScalar(1 - e.age * 0.04);
    }
    for (const fx of flaxans) if (fx.id == null) fx.holder.visible = false;
    flaxMats.skin.color.setHex(g.wave >= 2 ? 0xa9a9b0 : g.wave === 1 ? 0x9a9cb0 : 0x8b8fa8);

    // bolts and their trails
    const m4 = new THREE.Matrix4();
    bolts.count = Math.min(BOLTS, g.bolts.length);
    for (let i = 0; i < bolts.count; i++) {
      const b = g.bolts[i];
      bolts.setMatrixAt(i, m4.makeTranslation(...b.p));
      if (!calm) vfx.trail(V(b.p), { size: 0.7, life: 0.25, color: 0xe070ff, to: 0x300060, a: 0.7 });
    }
    bolts.instanceMatrix.needsUpdate = true;

    // the shockwave
    if (g.quake) {
      const k = g.quake.t / QUAKE.time;
      quakeMesh.visible = true;
      quakeMesh.position.set(...g.quake.p);
      quakeMesh.scale.setScalar(Math.max(0.1, k * QUAKE.r));
      quakeMesh.material.opacity = (1 - k) * 0.35;
    } else quakeMesh.visible = false;

    // wind off a flyer going flat out
    const speed = Math.hypot(...g.mark.v);
    if (!calm && speed > 40 && Math.random() < dt * 30) vfx.trail(V(g.mark.p).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5)), { size: 1.1, life: 0.3, color: 0xffffff, to: 0x6688aa, a: 0.25 });
    if (g.boss && g.boss.state === 'charge' && !calm) vfx.trail(V(g.boss.p), { size: 2.2, life: 0.45, color: g.boss.kind === 'omni' ? 0xffd8b0 : 0xff8070, to: 0x402018, a: 0.5 });

    // the spires' lights blink
    town.beacons.material.color.copy(hot(0xff2a2a, Math.sin(time * 2.4) > 0.2 ? 3 : 0.4));

    placeCamera(g, dt);
    vfx.update(dt, camera, engine.size.h);
    engine.render();
  }

  // ── what happened, seen and felt ──
  function fx(events, g) {
    for (const e of events) {
      switch (e.type) {
        case 'hit': {
          const at = V(e.at);
          const big = e.boss;
          vfx.sparks(at, { count: big ? 34 : 22, speed: big ? 14 : 10, color: 0xffffff, to: 0xffc04a, life: 0.4, size: 0.16 });
          vfx.ring(at, { color: 0xfff2c0, from: 0.3, to: big ? 7 : 4.5, life: 0.35, normal: camera.position.clone().sub(at).normalize(), opacity: 0.8 });
          vfx.flash(at, { color: 0xffe0a0, intensity: big ? 60 : 30, distance: 16, life: 0.18 });
          feel.hitstop(big ? 70 : 45);
          feel.trauma(big ? 0.32 : 0.18);
          feel.punch(big ? 3 : 1.5);
          break;
        }
        case 'block':
          vfx.sparks(V(e.at), { count: 26, speed: 9, color: 0xcfe8ff, to: 0x5a8aff, life: 0.35, size: 0.14 });
          vfx.ring(V(e.at), { color: 0xbfe0ff, from: 0.3, to: 3.5, life: 0.3, normal: camera.position.clone().sub(V(e.at)).normalize() });
          feel.trauma(0.22);
          break;
        case 'ko':
          vfx.sparks(V(e.at), { count: 16, speed: 7, color: 0xf0a0ff, to: 0x6020a0, life: 0.6 });
          break;
        case 'crash':
        case 'smash': {
          const at = V(e.at);
          vfx.debris(at, { count: e.type === 'smash' ? 22 : 12, speed: e.type === 'smash' ? 16 : 9, size: 0.4, life: 3.2, dir: e.dir ? V(e.dir) : null, spread: 1.2 });
          vfx.smoke(at, { size: e.type === 'smash' ? 7 : 4, count: e.type === 'smash' ? 10 : 6, life: 2.6, color: 0x8a8580, to: 0xb8b2aa, rise: 1.2, opacity: 0.55, spread: 2 });
          vfx.sparks(at, { count: 14, speed: 8, color: 0xfff0d0, to: 0x907050, life: 0.5 });
          feel.trauma(e.type === 'smash' ? 0.35 : 0.3);
          break;
        }
        case 'charge':
          vfx.ring(V(e.from), { color: 0xffffff, from: 1, to: 9, life: 0.4, normal: V(e.dir), opacity: 0.7 });
          feel.trauma(0.12);
          break;
        case 'slugged':
          vfx.sparks(V(e.at), { count: 40, speed: 16, color: 0xffffff, to: 0xff7040, life: 0.5, size: 0.2 });
          vfx.flash(V(e.at), { color: 0xffb070, intensity: 80, distance: 20, life: 0.2 });
          feel.hitstop(110);
          feel.trauma(0.6);
          feel.punch(5);
          break;
        case 'cleared':
        case 'won':
          // a chapter done: his cheer (his arms; his hover goes on under it)
          mark.play('cheer', { layer: 'upper' });
          break;
        case 'quake':
          // the dive's end: the boss comes down on it (his own landing)
          if (g?.boss) (g.boss.kind === 'omni' ? omni : thragg).play('land');
          vfx.ring(V(e.at), { color: 0xfff0dc, from: 1, to: QUAKE.r, life: QUAKE.time, normal: new THREE.Vector3(0, 1, 0), opacity: 0.9 });
          vfx.debris(V(e.at), { count: 18, speed: 14, size: 0.35, life: 2.5, spread: 1.6 });
          vfx.flash(V(e.at), { color: 0xffe8c0, intensity: 70, distance: 40, life: 0.25 });
          feel.trauma(0.5);
          break;
        case 'perfect':
          vfx.ring(V(e.at), { color: 0x7fd6ff, from: 0.5, to: 6, life: 0.5, normal: camera.position.clone().sub(V(e.at)).normalize(), opacity: 0.9 });
          vfx.sparks(V(e.at), { count: 20, speed: 6, color: 0xbfeaff, to: 0x3a7aff, life: 0.6, gravity: 0 });
          break;
        case 'hurt':
          feel.trauma(0.3);
          break;
        case 'zap':
        case 'spark':
          vfx.sparks(V(e.at), { count: 12, speed: 6, color: 0xf6b0ff, to: 0x7020c0, life: 0.35 });
          break;
        case 'bolt':
          vfx.flash(V(e.at), { color: 0xd070ff, intensity: 18, distance: 8, life: 0.12 });
          break;
        case 'ring':
          vfx.sparks(V(e.at), { count: 30, speed: 9, color: 0xfff0a0, to: 0xffb000, life: 0.6, size: 0.18, gravity: 0, spread: 1.4 });
          break;
        case 'portal-close':
          vfx.flash(V(e.at), { color: 0xd070ff, intensity: 120, distance: 80, life: 0.5 });
          vfx.ring(V(e.at), { color: 0xf0b0ff, from: PORTAL.r, to: PORTAL.r * 2.4, life: 0.8, normal: V(PORTAL.n) });
          break;
        case 'spawn':
          vfx.sparks(V(e.at), { count: 10, speed: 5, color: 0xf0a0ff, to: 0x6020a0, life: 0.5, gravity: 0 });
          break;
        case 'leave':
          vfx.ring(V(g.boss.p), { color: 0xffffff, from: 1, to: 14, life: 0.6, normal: new THREE.Vector3(0, 1, 0) });
          feel.trauma(0.25);
          break;
        default:
      }
    }
  }

  // straight to the state given: the first frame, a screenshot
  const snap = (g) => {
    cam.ready = false;
    render(g, 0);
  };

  return {
    engine,
    setChapter,
    render,
    fx,
    snap,
    // camera control from the page: turn it (radians), and its frame for steering
    look(dx, dy) {
      cam.yaw -= dx;
      cam.pitch = clamp(cam.pitch - dy, -1.2, 1.05);
      cam.manual = 1.4;
    },
    basis() {
      const f = look3(cam.yaw, cam.pitch);
      const right = new THREE.Vector3(-f.z, 0, f.x).normalize();
      return { forward: [f.x, f.y, f.z], right: [right.x, right.y, right.z], yaw: cam.yaw };
    },
    project(p) {
      return engine.project(V(p));
    },
    timeScale: (dt) => feel.scale(dt),
    resize: (w, h) => engine.resize(w, h),
    precompile: () => engine.precompile(),
    info: () => engine.info(),
    dispose() {
      vfx.dispose?.();
      for (const f of [mark, omni, thragg]) f.dispose();
      engine.dispose();
    },
  };
}

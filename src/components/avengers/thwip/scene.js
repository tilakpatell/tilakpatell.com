// Thwip! in 3D: an avenue in Queens on a bright morning (a Poly Haven sky,
// CC0), its buildings painted in the shader (lib/three/facade, as the
// Invincible page's city is), rising toward Midtown, with the traffic below
// and Peter's backpacks webbed up between the buildings. Spider-Man is the
// HD model from Sketchfab (CC BY), posed every frame by lib/three/rig from
// the rules' state: reaching up his web, flying with his arms out, a flip
// off a perfect release. His web is drawn from his hand to the wall. The
// rules (./rules.js) say what happens; this draws it.

import * as THREE from 'three';
import { createStage, hot } from '../hq/stage';
import { createVfx } from '../hq/vfx';
import { createFeel, feelGroups } from '../hq/feel';
import { instanced } from '../hq/kit/instanced';
import { canvasTexture } from '../hq/kit/shapes';
import { CAR_COLOURS, CAR_KINDS, carGeometries, carMaterials } from '../smash/models';
import { boxField, facadeMaterial } from '../../../lib/three/facade';
import { POSES, figure, loadFigure } from '../../../lib/three/rig';
import { prefersReducedMotion } from '../../../lib/hooks';
import { AVENUE, SCHOOL, buildAvenue, distance } from './rules';
import { AVENGERS_MANIFEST } from '../people/models';
import { clipsFor, loadClips } from '../world/people';
import { GAIT, gaitFor } from '../world/rules';

const SPIDEY = '/models/marvel/spiderman.glb';
const asset = (file) => `${import.meta.env?.BASE_URL ?? '/'}${file.replace(/^\//, '')}`;
const FOV = 64;
const DEPTH = 26; // how deep the buildings go back from the avenue
const VIEW = 260; // how far ahead the traffic is drawn

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// the avenue's paint: lanes and crossings, a block long, repeated
function roadTexture() {
  return canvasTexture(256, 1024, (x, w, h) => {
    x.fillStyle = '#3a3c3f';
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${(Math.random() * 0.06).toFixed(3)})`;
      x.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 2 + Math.random() * 6);
    }
    // the double yellow down the middle, dashed white between the lanes
    x.fillStyle = '#d6b23e';
    x.fillRect(w / 2 - 5, 0, 3, h);
    x.fillRect(w / 2 + 2, 0, 3, h);
    x.fillStyle = 'rgba(235,235,230,0.85)';
    for (const lx of [w * 0.26, w * 0.74]) for (let y = 0; y < h; y += 64) x.fillRect(lx - 1.5, y, 3, 34);
    // the crossing at the end of the block
    for (let i = 0; i < 12; i++) x.fillRect(8 + i * 20.5, h - 70, 12, 60);
  }, { repeat: [1, AVENUE.length / AVENUE.block] });
}

export async function create(rt, { onSlow } = {}) {
  const calm = prefersReducedMotion();
  const engine = createStage(rt, { exposure: 1, fov: FOV, near: 0.1, far: 1400, bloom: { strength: 0.45, radius: 0.4, threshold: 0.95 }, onSlow });
  const { scene, camera } = engine;
  const small = engine.small;
  await engine.setSky('noon', { rotate: 2.6, envIntensity: 0.9, bgIntensity: 1, sunIntensity: 3, fill: 0.22, fog: { density: small ? 0.0032 : 0.0024 } });

  // ── the avenue ──
  const avenue = buildAvenue();
  const list = [];
  for (const b of avenue) {
    const len = b.z0 - b.z1 - 0.8;
    list.push({ x: b.side * (AVENUE.wall + DEPTH / 2), z: (b.z0 + b.z1) / 2, w: DEPTH, d: len, h: b.h, kind: b.kind, tone: b.tone, seed: (Math.abs(b.z0) * 0.0137) % 1 });
    // a taller one behind some, for a skyline
    if (b.tone > 0.55) list.push({ x: b.side * (AVENUE.wall + DEPTH + 16), z: (b.z0 + b.z1) / 2, w: 26, d: len, h: b.h * (1.2 + b.tone), kind: 0, tone: 1 - b.tone, seed: b.tone });
  }
  // Midtown School of Science and Technology, across the end of the avenue
  list.push({ x: 0, z: -SCHOOL - 70, w: 90, d: 40, h: 26, kind: 2, tone: 0.7, seed: 0.3 });
  const towers = boxField(list, facadeMaterial());
  towers.castShadow = true;
  towers.receiveShadow = true;
  scene.add(towers);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 5),
    new THREE.MeshBasicMaterial({
      map: canvasTexture(1024, 128, (x, w, h) => {
        x.fillStyle = '#0d2a5a';
        x.fillRect(0, 0, w, h);
        x.fillStyle = '#f2f2f2';
        x.font = '700 54px Archivo, Arial, sans-serif';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText('MIDTOWN SCHOOL OF SCIENCE & TECHNOLOGY', w / 2, h / 2 + 2);
      }),
    }),
  );
  sign.position.set(0, 17, -SCHOOL - 49.9);
  scene.add(sign);

  // the ground: asphalt, the avenue's paint, the pavement in front of each building
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, AVENUE.length + 900).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3b3d40, roughness: 0.95 }));
  ground.position.set(0, -0.02, -AVENUE.length / 2);
  ground.receiveShadow = true;
  scene.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(AVENUE.road * 2, AVENUE.length).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.9 }));
  road.position.set(0, 0.01, -AVENUE.length / 2);
  road.receiveShadow = true;
  scene.add(road);
  const kerbs = [];
  for (const b of avenue) kerbs.push({ x: b.side * ((AVENUE.road + AVENUE.wall) / 2), z: (b.z0 + b.z1) / 2, w: AVENUE.wall - AVENUE.road, d: b.z0 - b.z1, h: 0.18 });
  const pavement = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0x9a9893, roughness: 0.92 }), kerbs.length);
  const m4 = new THREE.Matrix4();
  kerbs.forEach((k, i) => pavement.setMatrixAt(i, m4.compose(new THREE.Vector3(k.x, 0, k.z), new THREE.Quaternion(), new THREE.Vector3(k.w, k.h, k.d))));
  pavement.receiveShadow = true;
  scene.add(pavement);

  // ── the traffic ──
  const cmats = carMaterials();
  const pools = Object.fromEntries(CAR_KINDS.map((kind) => [kind, instanced(carGeometries(kind), cmats, small ? 14 : 22, { shadows: !small })]));
  for (const p of Object.values(pools)) scene.add(p.group);
  const colour = new THREE.Color();

  // ── the backpacks, webbed up ──
  const packMat = new THREE.MeshStandardMaterial({ color: 0x2a3a5a, roughness: 0.7 });
  const packs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.65, 0.28), packMat, 40);
  const webBall = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.62, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, transparent: true, opacity: 0.45, wireframe: true }), 40);
  packs.frustumCulled = false;
  webBall.frustumCulled = false;
  scene.add(packs, webBall);

  // ── Spider-Man, and his web ──
  const spidey = figure(await loadFigure(asset(SPIDEY)), { h: 1.75 });
  spidey.lean = new THREE.Quaternion();
  scene.add(spidey.holder);
  // his own moves (the compound's: motion-captured idle, walk and run made
  // for this model, manifest.json's spiderman), for running along the
  // street; if they can't be had, he's posed by the rig as before
  const moves = await (async () => {
    try {
      const man = await fetch(asset(AVENGERS_MANIFEST)).then((r) => (r.ok ? r.json() : null));
      const spec = man?.spiderman;
      const clips = spec?.moves ? await loadClips(spec.moves) : null;
      if (!clips?.idle || !clips?.walk || !clips?.run) return null;
      return { set: clipsFor(spidey.model, Object.values(clips)), speeds: { walk: GAIT.walk, run: GAIT.run, ...spec.speeds } };
    } catch {
      return null;
    }
  })();
  moves?.set.play('run');
  const bones = [];
  spidey.model.traverse((o) => o.isBone && bones.push(o));
  const clipQ = bones.map(() => new THREE.Quaternion());
  const W = { w: 1, hurt: 0, lift: 0 }; // the rig's pose over his clips (1: all pose); a stumble's time left; his feet's lift to the street
  const webMat = new THREE.MeshBasicMaterial({ color: hot(0xffffff, 1.2), transparent: true, opacity: 0.95, toneMapped: false });
  const web = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6).translate(0, 0.5, 0), webMat);
  web.visible = false;
  scene.add(web);
  const vfx = createVfx(scene, { calm, maxSparks: small ? 300 : 600, maxPuffs: small ? 80 : 140, maxDebris: 40 });
  const feel = createFeel({ calm, baseFov: FOV, offset: 0.2 });
  // ?debug: the feel's numbers on the one panel (hq/stage's tune)
  engine.tune(feelGroups(feel), 'thwip');

  const Y = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const qi = new THREE.Quaternion();
  const hand = new THREE.Vector3();
  let webOut = 0; // the web's last moment, after it's let go
  let lastAnchor = null;
  const cam = { pos: new THREE.Vector3(), at: new THREE.Vector3(), ready: false, fov: FOV };
  let time = 0;

  function poseSpidey(g, dt) {
    const f = spidey;
    f.holder.position.set(...g.p);
    // (running on his own clips, his feet on the street: the rules hold his
    // middle 0.9 m up; eased, so leaving the street doesn't pop him)
    const lift = moves && g.mode === 'street' && !g.web ? f.hipHeight - 0.9 : 0;
    W.lift += (lift - W.lift) * (dt === 0 ? 1 : 1 - Math.exp(-12 * dt));
    f.holder.position.y += W.lift;
    f.holder.rotation.set(0, Math.PI, 0); // he faces down the avenue (−z)
    // which way is up for him: along his web while he swings, else upright, tipped into his flight
    let up = Y.clone();
    if (g.web) up = V(g.web.a).sub(V(g.p)).normalize();
    else if (g.mode !== 'street') up = Y.clone().lerp(V(g.v).normalize(), 0.35).normalize();
    qi.setFromAxisAngle(Y, -Math.PI);
    q.setFromUnitVectors(Y, up.applyQuaternion(qi));
    // a perfect release: a flip, forward, all the way round
    if (g.flip > 0) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (1 - g.flip) * Math.PI * 2));
    f.lean.slerp(q, dt === 0 ? 1 : 1 - Math.exp(-10 * dt));
    f.body.quaternion.copy(f.lean);
    let pose;
    if (g.web) {
      // the web arm reaches up the line; the other one out, the legs together
      const arm = g.web.side < 0 ? 'L' : 'R'; // (facing −z, his left is −x)
      const other = arm === 'L' ? 'R' : 'L';
      pose = { ...POSES.hover(time) };
      pose[`arm${arm}`] = [0, 1, 0.05];
      pose[`fore${arm}`] = [0, 1, 0.05];
      pose[`arm${other}`] = [other === 'L' ? 0.9 : -0.9, -0.2, 0.2];
      pose[`fore${other}`] = [other === 'L' ? 0.7 : -0.7, 0.2, 0.5];
      Object.assign(pose, { thighL: [0.05, -1, 0.25], calfL: [0.03, -1, -0.35], thighR: [-0.05, -1, 0.2], calfR: [-0.03, -1, -0.4], torso: { pitch: 0.12, yaw: 0, roll: 0 } });
    } else if (g.flip > 0) pose = POSES.guard();
    else if (g.mode === 'street') pose = moves ? POSES.hurt() : POSES.hover(time * 3);
    else pose = POSES.fall(time);
    if (!moves) {
      f.pose(pose, dt, 14);
      return;
    }
    // On the street: his own walk or run, paced to how fast he's going (the
    // rules run him at 9 m/s), a stumble thrown over it as he hits the
    // street or a car honks into him. Off it: the rig's pose, faded in over
    // the clips as he leaves the street and out as he lands, so neither snaps.
    W.hurt = Math.max(0, W.hurt - dt);
    const street = g.mode === 'street' && !g.web && !(g.flip > 0);
    const want = street ? Math.min(1, W.hurt / 0.3) * 0.75 : 1;
    W.w += (want - W.w) * (dt === 0 ? 1 : 1 - Math.exp(-dt * (want > W.w ? 16 : 7)));
    const sp = Math.hypot(g.v[0], g.v[2]);
    const m = moves.set;
    if (!street) m.play('run', { speed: 0.6 });
    else {
      const gait = gaitFor(m.playing, sp);
      const { walk, run } = GAIT.rates;
      if (gait === 'idle') m.play('idle');
      else if (gait === 'walk') m.play('walk', { speed: clamp(sp / moves.speeds.walk, walk[0], walk[1]) });
      else m.play('run', { speed: clamp(sp / moves.speeds.run, run[0], run[1]) });
    }
    m.update(dt);
    if (W.w > 0.01) {
      for (let i = 0; i < bones.length; i++) clipQ[i].copy(bones[i].quaternion);
      f.pose(pose, dt, 14);
      if (W.w < 0.99) for (let i = 0; i < bones.length; i++) bones[i].quaternion.slerp(clipQ[i], 1 - W.w);
    }
  }

  function render(g, dt) {
    time += dt;
    poseSpidey(g, dt);
    // the web: from his hand to the wall
    if (g.web) {
      lastAnchor = V(g.web.wall);
      webOut = 1;
    } else webOut = Math.max(0, webOut - dt * 8);
    web.visible = webOut > 0 && lastAnchor != null;
    if (web.visible) {
      const bone = g.web ? (g.web.side < 0 ? spidey.bones.handL : spidey.bones.handR) : spidey.bones.handR;
      (bone ?? spidey.holder).getWorldPosition(hand);
      const d = lastAnchor.clone().sub(hand);
      web.position.copy(hand);
      web.quaternion.setFromUnitVectors(Y, d.clone().normalize());
      web.scale.set(1, d.length(), 1);
      webMat.opacity = 0.95 * webOut;
    }

    // the traffic near him
    for (const p of Object.values(pools)) p.begin();
    for (const c of g.cars) {
      if (c.z > g.p[2] + 30 || c.z < g.p[2] - VIEW) continue;
      const kind = CAR_KINDS[c.kind];
      const pal = CAR_COLOURS[kind];
      m4.makeRotationY(c.v < 0 ? Math.PI : 0).setPosition(c.x, 0, c.z);
      pools[kind].set(m4, { paint: colour.setHex(pal[c.id % pal.length]) });
    }
    for (const p of Object.values(pools)) p.end();

    // the backpacks left to get, turning slowly in their webs
    let n = 0;
    for (const k of g.packs) {
      if (k.got || k.p[2] > g.p[2] + 20 || k.p[2] < g.p[2] - VIEW || n >= 40) continue;
      m4.makeRotationY(time * 0.8 + k.id).setPosition(k.p[0], k.p[1], k.p[2]);
      packs.setMatrixAt(n, m4);
      webBall.setMatrixAt(n, m4);
      n++;
    }
    packs.count = n;
    webBall.count = n;
    packs.instanceMatrix.needsUpdate = true;
    webBall.instanceMatrix.needsUpdate = true;

    // the camera: behind and above, looking down the avenue
    const speed = Math.hypot(...g.v);
    const P = V(g.p);
    const pos = new THREE.Vector3(g.p[0] * 0.55, Math.max(3, g.p[1] + 2.2), g.p[2] + 6.5 + speed * 0.04);
    const at = new THREE.Vector3(g.p[0] * 0.7, g.p[1] + 0.5 - Math.min(3, speed * 0.035), g.p[2] - 16);
    if (!cam.ready || dt === 0) {
      cam.pos.copy(pos);
      cam.at.copy(at);
      cam.ready = true;
    } else {
      // across and up it eases; along the avenue it keeps up, however fast he goes
      const k = 1 - Math.exp(-6 * dt);
      cam.pos.set(cam.pos.x + (pos.x - cam.pos.x) * k, cam.pos.y + (pos.y - cam.pos.y) * k, pos.z);
      cam.at.set(cam.at.x + (at.x - cam.at.x) * k, cam.at.y + (at.y - cam.at.y) * k, at.z);
    }
    camera.position.copy(cam.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(cam.at);
    feel.setBaseFov(FOV + clamp((speed - 25) / 30, 0, 1) * 10);
    feel.update(dt, camera);
    engine.setShadowBox(P, 30, 160);
    if (!calm && speed > 40 && Math.random() < dt * 20) vfx.trail(P.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 1)), { size: 0.9, life: 0.25, color: 0xffffff, to: 0x8899aa, a: 0.25 });
    vfx.update(dt, camera, engine.size.h);
    engine.render();
  }

  function fx(events, g) {
    for (const e of events) {
      switch (e.type) {
        case 'perfect':
          vfx.ring(V(e.at), { color: 0xffffff, from: 0.3, to: 2.4, life: 0.35, normal: camera.position.clone().sub(V(e.at)).normalize(), opacity: 0.8 });
          vfx.sparks(V(e.at), { count: 18, speed: 7, color: 0xffffff, to: 0xff3040, life: 0.5, gravity: 0 });
          feel.punch(2);
          break;
        case 'pack':
          vfx.sparks(V(e.at), { count: 24, speed: 8, color: 0xffffff, to: 0x6aa0ff, life: 0.6, gravity: 2 });
          break;
        case 'street':
        case 'land':
          vfx.smoke(V(e.at), { size: 2.5, count: 6, life: 1.4, color: 0x8a8580, to: 0xb8b2aa, rise: 0.6, opacity: 0.5, spread: 1.5 });
          feel.trauma(e.type === 'street' ? 0.45 : 0.2);
          // down on the street the hard way: a stumble before he runs on,
          // and the game stops a beat as he hits (the loop's timeScale)
          if (e.type === 'street') {
            W.hurt = 0.55;
            feel.hitstop(70);
          }
          break;
        case 'wall':
          vfx.debris(V(e.at), { count: 5, speed: 4, size: 0.18, life: 1.5 });
          feel.trauma(0.12);
          break;
        case 'honk':
          feel.trauma(0.25);
          W.hurt = Math.max(W.hurt, 0.4);
          break;
        default:
      }
    }
    void g;
  }

  return {
    engine,
    render,
    fx,
    snap: (g) => {
      cam.ready = false;
      render(g, 0);
    },
    project: (p) => engine.project(V(p)),
    timeScale: (dt) => feel.scale(dt),
    resize: (w, h) => engine.resize(w, h),
    distance,
    dispose() {
      vfx.dispose?.();
      moves?.set.dispose();
      spidey.dispose();
      engine.dispose();
    },
  };
}

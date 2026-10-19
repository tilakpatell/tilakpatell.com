// Ricochet in 3D: Cap's training hall from above and behind him. It draws a
// room (./rules.js), its walls, bots and switches, Cap with the shield on his
// arm, and the shield in flight along the path the rules worked out.

import * as THREE from 'three';
import { createStage, hot } from '../hq/stage';
import { pbr, preload } from '../hq/assets';
import { buildHumanoid, poseHumanoid } from '../hq/kit/humanoid';
import { canvasTexture, rbox } from '../hq/kit/shapes';
import { logoTexture, scatter } from '../hq/kit/world';
import { createVfx } from '../hq/vfx';
import { createFeel, feelGroups } from '../hq/feel';
import { prefersReducedMotion } from '../../../lib/hooks';
import { botAt, simulateThrow } from './rules';
import { buildShield, courtTexture, hazardTexture } from './models';
import { freeRoom } from './free';

const WALL_H = 1.05;
const WALL_T = 0.26;

export async function create(rt, { onSlow } = {}) {
  const calm = prefersReducedMotion();
  const engine = createStage(rt, { exposure: 1.2, fov: 40, near: 0.1, far: 200, bloom: { strength: 0.45, radius: 0.4, threshold: 0.96 }, onSlow });
  const { scene, camera } = engine;
  const small = engine.small;
  await preload({ sets: ['concrete-floor', 'rubber-tiles', 'sci-panels', 'concrete-wall', 'painted-metal', 'leather', 'brushed-steel', 'corrugated'], skies: ['hall'], models: ['fluorescent', 'shelves', 'crate', 'toolchest', 'extinguisher', 'tyre', 'barrel'], small });
  await engine.setSky('hall', { background: false, envIntensity: 1.1, sunDir: [0.25, 1, 0.35], sunIntensity: 3.2, sunColor: [1, 0.97, 0.92], fill: 0.4 });
  scene.background = new THREE.Color(0x15171b);
  scene.fog = new THREE.Fog(0x15171b, 34, 70);
  engine.setShadowBox(new THREE.Vector3(0, 0, 0), 12, 40);
  engine.sun.shadow.bias = -0.0006;

  // ── the hall ──
  const hall = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 60).rotateX(-Math.PI / 2), await pbr('concrete-floor', { repeat: [14, 12], small, metalness: 0, roughness: 1, color: 0xa9a7a2 }));
  floor.receiveShadow = true;
  hall.add(floor);
  const court = new THREE.Mesh(new THREE.PlaneGeometry(16, 12).rotateX(-Math.PI / 2), await pbr('concrete-wall', { repeat: [4, 3], small, metalness: 0, roughness: 0.85, color: 0xb4bfcf, envMapIntensity: 0.6 }));
  court.position.y = 0.01;
  court.receiveShadow = true;
  hall.add(court);
  const lines = new THREE.Mesh(new THREE.PlaneGeometry(16, 12).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: courtTexture(), transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  lines.position.y = 0.02;
  lines.receiveShadow = true;
  hall.add(lines);
  const centre = new THREE.Mesh(new THREE.PlaneGeometry(3, 3).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: logoTexture(512, { color: '#1c305c' }), transparent: true, opacity: 0.4, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
  centre.position.y = 0.025;
  hall.add(centre);
  // the hall's walls, and the Avengers' A on the far one
  const wallMat = await pbr('concrete-wall', { repeat: [10, 3], small, metalness: 0, roughness: 1, color: 0xbab6ae });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(56, 12), wallMat);
  back.position.set(0, 6, -16);
  back.receiveShadow = true;
  hall.add(back);
  for (const sd of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(40, 12), wallMat);
    side.position.set(sd * 26, 6, 2);
    side.rotation.y = -sd * Math.PI / 2;
    side.receiveShadow = true;
    hall.add(side);
  }
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshStandardMaterial({ map: logoTexture(512, { color: '#e6e3dc' }), transparent: true, roughness: 0.9, depthWrite: false }));
  logo.position.set(0, 5.4, -15.95);
  hall.add(logo);
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(56, 0.5), new THREE.MeshStandardMaterial({ color: 0x23406e, roughness: 0.8 }));
  stripe.position.set(0, 1.6, -15.94);
  hall.add(stripe);
  // steel columns along the walls
  const beam = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 12, 0.5), new THREE.MeshStandardMaterial({ color: 0x3d434b, metalness: 0.8, roughness: 0.45 }), 14);
  let bi = 0;
  for (let x = -24; x <= 24; x += 8) beam.setMatrixAt(bi++, new THREE.Matrix4().makeTranslation(x, 6, -15.6));
  for (const sd of [-1, 1]) for (let z = -8; z <= 16; z += 8) beam.setMatrixAt(bi++, new THREE.Matrix4().makeTranslation(sd * 25.6, 6, z));
  beam.count = bi;
  beam.castShadow = true;
  hall.add(beam);
  scene.add(hall);

  // equipment round the edge of the hall
  const props = await Promise.all([
    scatter('shelves', [[-17, -15.2, 1.3, 0], [-12.5, -15.2, 1.3, 0], [14, -15.2, 1.3, 0]]),
    scatter('crate', [[18.5, -13, 1, 0.2], [19.6, -11.6, 1, 1.1], [18.9, -12.3, 1, 0.6], [-20, 6, 1.1, 0.4]]),
    scatter('toolchest', [[21, -6, 1.2, -Math.PI / 2]]),
    scatter('tyre', [[-20.5, -9, 1.6, 0], [-19.4, -8.2, 1.6, 0.4], [-20.2, -7.4, 1.6, 1.1]]),
    scatter('barrel', [[20.5, 4, 1.1, 0], [21.1, 4.8, 1.1, 1]]),
    scatter('fluorescent', [-8, 0, 8].flatMap((z) => [[-18, z, 1.4, Math.PI / 2], [18, z, 1.4, Math.PI / 2]])),
  ]);
  props.forEach((p) => scene.add(p));
  // the fluorescent fittings hang from the roof: lift them, and light them
  props[5].position.y = 6.5;
  props[5].traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      if (o.material?.emissive) {
        o.material.emissive.set(0xffffff);
        o.material.emissiveIntensity = 1.2;
      }
    }
  });
  // punching bags on chains
  const leather = await pbr('leather', { repeat: [2, 2], small, roughness: 1, metalness: 0, color: 0x6e3b24 });
  const chainMat = new THREE.MeshStandardMaterial({ color: 0x8a9097, metalness: 1, roughness: 0.4 });
  for (const [x, z] of [
    [-12, 9.5],
    [-9.5, 10.5],
    [12, 9.8],
  ]) {
    const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.9, 6, 18), leather);
    bag.position.set(x, 1.55, z);
    bag.castShadow = true;
    scene.add(bag);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 4, 6), chainMat);
    chain.position.set(x, 4.2, z);
    scene.add(chain);
  }

  // ── materials for the room's pieces ──
  const steel = await pbr('sci-panels', { repeat: [1, 0.5], small, metalness: 1, roughness: 0.75, color: 0xc9d0d9, envMapIntensity: 0.55 });
  const capMat = await pbr('brushed-steel', { repeat: [4, 0.2], small, metalness: 0.9, roughness: 0.6, color: 0xd6dce3, envMapIntensity: 0.4 });
  const hz = hazardTexture();
  hz.wrapS = THREE.RepeatWrapping;
  const trimMat = new THREE.MeshStandardMaterial({ map: hz, roughness: 0.6, metalness: 0.2 });
  const matMat = await pbr('rubber-tiles', { repeat: [1, 0.5], small, metalness: 0, roughness: 1, color: 0x2f62c0, normalScale: 1.6 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, metalness: 0, roughness: 0.08, transparent: true, opacity: 0.28, clearcoat: 1, envMapIntensity: 0.8, depthWrite: false, side: THREE.DoubleSide });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x5a6068, metalness: 0.9, roughness: 0.35 });
  const doorMat = await pbr('painted-metal', { repeat: [0.6, 0.3], small, metalness: 0.6, roughness: 0.8, color: 0xd9a21c });
  const lidMat = await pbr('sci-panels', { repeat: [0.6, 0.6], small, metalness: 1, roughness: 0.7, color: 0x7d858f });
  const glassShards = new THREE.MeshPhysicalMaterial({ color: 0xd8f1ff, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.6 });

  // the bots' and Cap's materials
  const botMats = {
    shell: new THREE.MeshPhysicalMaterial({ color: 0xe9ebee, metalness: 0, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1d2025, metalness: 0.6, roughness: 0.5 }),
    visor: new THREE.MeshBasicMaterial({ color: hot(0x58c8ff, 2.2), toneMapped: false }),
  };
  const armorMat = new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.95, roughness: 0.35 });
  const hostageMats = {
    suit: new THREE.MeshStandardMaterial({ color: 0xe0661c, roughness: 0.85 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.6 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xc9a07c, roughness: 0.7 }),
  };
  const capMats = {
    suit: new THREE.MeshPhysicalMaterial({ color: 0x1d2f5c, roughness: 0.65, metalness: 0.1, sheen: 0.6, sheenColor: new THREE.Color(0x4a66a8) }),
    red: new THREE.MeshStandardMaterial({ color: 0x9c1b20, roughness: 0.6 }),
    white: new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.55 }),
    leather: await pbr('leather', { small, roughness: 1, metalness: 0, color: 0x6a4428 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xd2d6dc, metalness: 1, roughness: 0.3 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xd2a07e, roughness: 0.6 }),
    helmet: new THREE.MeshPhysicalMaterial({ color: 0x223a70, metalness: 0.4, roughness: 0.35, clearcoat: 0.8 }),
  };

  // ── Cap and his shield ──
  const cap = buildHumanoid({ style: 'cap', materials: capMats, scale: 0.98 });
  scene.add(cap.root);
  const heldShield = await buildShield({ radius: 0.46, small });
  heldShield.scale.setScalar(1);
  cap.bones.elbowL.add(heldShield);
  heldShield.position.set(0.11, -0.16, 0.02);
  heldShield.rotation.set(0, Math.PI / 2, 0);
  const flyShield = await buildShield({ radius: 0.56, small });
  flyShield.visible = false;
  scene.add(flyShield);

  // the aim line: dashes along the first stretch, fainter after the bounce
  const dashGeo = new THREE.BoxGeometry(0.06, 0.02, 0.3);
  const dashMat = new THREE.MeshBasicMaterial({ color: hot(0xffffff, 1.4), transparent: true, toneMapped: false, depthWrite: false });
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, 160);
  dashes.frustumCulled = false;
  dashes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(160 * 3), 3);
  scene.add(dashes);
  const ghost = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: hot(0xffffff, 1.2), transparent: true, opacity: 0.7, toneMapped: false, depthWrite: false }));
  scene.add(ghost);

  const vfx = createVfx(scene, { calm, debrisMaterial: glassShards, ground: 0 });
  const feel = createFeel({ seed: 3, calm, baseFov: 40, offset: 0.08 });
  // ?debug: the feel's numbers on the one panel (hq/stage's tune)
  engine.tune(feelGroups(feel), 'ricochet');

  // made once above: a room's rebuild keeps them
  const shared = new Set([steel, capMat, hz, trimMat, matMat, glassMat, frameMat, doorMat, lidMat, armorMat, ...Object.values(botMats), ...Object.values(hostageMats)]);

  // ── a room's pieces, rebuilt when the room changes ──
  let built = null;
  const roomGroup = new THREE.Group();
  scene.add(roomGroup);
  const figures = [];
  const wallMeshes = [];
  const switchMeshes = [];

  function wallMesh(w) {
    const [ax, az] = w.a;
    const [bx, bz] = w.b;
    const len = Math.hypot(bx - ax, bz - az);
    const g = new THREE.Group();
    g.position.set((ax + bx) / 2, 0, (az + bz) / 2);
    g.rotation.y = -Math.atan2(bz - az, bx - ax);
    if (w.kind === 'glass') {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(len, WALL_H * 1.25, 0.06), glassMat);
      pane.position.y = (WALL_H * 1.25) / 2;
      pane.name = 'pane';
      g.add(pane);
      for (const x of [-len / 2, len / 2]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, WALL_H * 1.3, 0.14), frameMat);
        post.position.set(x, (WALL_H * 1.3) / 2, 0);
        post.castShadow = true;
        g.add(post);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.12), frameMat);
      rail.position.y = 0.04;
      g.add(rail);
    } else {
      const mat = w.kind === 'mat' ? matMat : w.kind === 'door' ? doorMat : steel;
      const h = w.kind === 'mat' ? WALL_H * 1.1 : WALL_H;
      const body = new THREE.Mesh(rbox(len + WALL_T * (w.kind === 'mat' ? 0 : 1), h, w.kind === 'mat' ? WALL_T * 1.6 : WALL_T, 0.05), mat);
      body.position.y = h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      body.name = 'body';
      g.add(body);
      if (w.kind === 'steel') {
        const top = new THREE.Mesh(new THREE.BoxGeometry(len + WALL_T, 0.06, WALL_T + 0.04), capMat);
        top.position.y = h + 0.02;
        g.add(top);
      }
      if (w.kind === 'door') {
        const t = trimMat.clone();
        t.map = hz.clone();
        t.map.repeat.set(len * 2, 1);
        t.map.needsUpdate = true;
        const trim = new THREE.Mesh(new THREE.BoxGeometry(len + WALL_T, 0.1, WALL_T + 0.02), t);
        trim.position.y = h + 0.03;
        g.add(trim);
      }
      if (w.kind === 'door') {
        const light = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), new THREE.MeshBasicMaterial({ color: hot(0xff3a2a, 2), toneMapped: false }));
        light.position.set(len / 2 + 0.2, h + 0.15, 0);
        light.name = 'light';
        g.add(light);
      }
    }
    g.userData = { wall: w };
    return g;
  }

  function botFigure(b) {
    const style = b.kind === 'hostage' ? 'hostage' : 'bot';
    const h = buildHumanoid({ style, materials: style === 'hostage' ? hostageMats : botMats, scale: 0.92 });
    h.kind = b.kind;
    h.key = b.key;
    h.fall = null;
    if (b.kind === 'armored') {
      // dark plates over the chest and shoulders
      const plate = (bone, geo, p, r = [0, 0, 0]) => {
        const m = new THREE.Mesh(geo, armorMat);
        m.position.set(...p.map((v) => v * 0.92));
        m.rotation.set(...r);
        m.scale.setScalar(0.92);
        m.castShadow = true;
        h.bones[bone].add(m);
        return m;
      };
      h.plates = [plate('chest', rbox(0.48, 0.36, 0.3, 0.08), [0, 0.15, 0.01]), plate('shoulderL', rbox(0.17, 0.12, 0.2, 0.05), [0.02, 0.04, 0], [0, 0, -0.35]), plate('shoulderR', rbox(0.17, 0.12, 0.2, 0.05), [-0.02, 0.04, 0], [0, 0, 0.35]), plate('head', rbox(0.24, 0.12, 0.25, 0.06), [0, 0.2, 0])];
    }
    if (b.kind === 'hostage') {
      // hands behind the back
      h.bones.shoulderL.rotation.set(0.5, 0, 0.15);
      h.bones.shoulderR.rotation.set(0.5, 0, -0.15);
    }
    return h;
  }

  function switchMesh(sw) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.1, 10), frameMat);
    post.position.y = 0.55;
    post.castShadow = true;
    g.add(post);
    const face = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.06, 32).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({
        map: canvasTexture(256, 256, (x, w) => {
          for (const [r, c] of [
            [1, '#c8251d'],
            [0.7, '#f1efe8'],
            [0.42, '#c8251d'],
            [0.16, '#f1efe8'],
          ]) {
            x.fillStyle = c;
            x.beginPath();
            x.arc(w / 2, w / 2, (r * w) / 2, 0, Math.PI * 2);
            x.fill();
          }
        }),
        roughness: 0.6,
        emissive: 0x000000,
      }),
    );
    face.position.y = 1.15;
    face.castShadow = true;
    face.name = 'face';
    g.add(face);
    g.position.set(sw.x, 0, sw.z);
    // face into the room
    g.rotation.y = Math.atan2(-sw.x, -sw.z) + Math.PI;
    return g;
  }

  function build(room) {
    for (const f of figures) {
      scene.remove(f.root);
      freeRoom(f.root, shared);
    }
    figures.length = 0;
    wallMeshes.length = 0;
    switchMeshes.length = 0;
    freeRoom(roomGroup, shared);
    roomGroup.clear();
    // pillar lids
    const lids = new Map();
    for (const w of room.walls) {
      const m = wallMesh(w);
      roomGroup.add(m);
      wallMeshes[w.key] = m;
      if (w.box) lids.set(w.box.join(), w.box);
    }
    for (const [x0, z0, x1, z1] of lids.values()) {
      const lid = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0) - 0.05, 0.1, Math.abs(z1 - z0) - 0.05), lidMat);
      lid.position.set((x0 + x1) / 2, WALL_H, (z0 + z1) / 2);
      lid.castShadow = true;
      roomGroup.add(lid);
    }
    for (const b of room.bots) {
      const f = botFigure(b);
      figures[b.key] = f;
      scene.add(f.root);
    }
    for (const sw of room.switches) {
      const m = switchMesh(sw);
      roomGroup.add(m);
      switchMeshes[sw.key] = m;
    }
    cap.root.position.set(room.def.cap[0], 0, room.def.cap[1]);
    built = room;
  }

  // the camera, fitted to show the whole court from behind Cap
  const fit = () => {
    const aspect = engine.size.w / Math.max(1, engine.size.h);
    const pts = [
      [-8.4, 0, -6.4],
      [8.4, 0, -6.4],
      [-8.4, 0, 6.6],
      [8.4, 0, 6.6],
      [-8.4, WALL_H, -6.4],
      [8.4, WALL_H, -6.4],
    ].map((p) => new THREE.Vector3(...p));
    const pitch = aspect < 1 ? 1.12 : 0.96;
    const look = new THREE.Vector3(0, 0, aspect < 1 ? 0.3 : 0.6);
    let lo = 8;
    let hi = 80;
    for (let i = 0; i < 24; i++) {
      const d = (lo + hi) / 2;
      camera.position.set(look.x, look.y + Math.sin(pitch) * d, look.z + Math.cos(pitch) * d);
      camera.lookAt(look);
      camera.updateMatrixWorld();
      const ok = pts.every((p) => {
        const v = p.clone().project(camera);
        return Math.abs(v.x) < 0.94 && Math.abs(v.y) < 0.9;
      });
      if (ok) hi = d;
      else lo = d;
    }
    camera.position.set(look.x, look.y + Math.sin(pitch) * hi, look.z + Math.cos(pitch) * hi);
    camera.lookAt(look);
    camera.userData.base = camera.position.clone();
    camera.userData.look = look;
  };

  // ── per frame ──
  let clock = 0;
  let throwAnim = 0;
  let catchAnim = 0;
  const v3 = new THREE.Vector3();

  function pointOnPath(path, t) {
    for (let i = 1; i < path.length; i++) {
      if (t <= path[i].t) {
        const a = path[i - 1];
        const b = path[i];
        const k = (t - a.t) / Math.max(1e-6, b.t - a.t);
        return [a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k];
      }
    }
    const l = path[path.length - 1];
    return [l.x, l.z];
  }

  function drawAim(room, angle, full) {
    let n = 0;
    if (room.phase === 'aim' && angle != null) {
      const f = simulateThrow(room, angle);
      // the first stretch in full; then, on early rooms, the second
      const stretches = full ? 3 : 2;
      for (let i = 1; i < Math.min(f.path.length, stretches + 1); i++) {
        const a = f.path[i - 1];
        const b = f.path[i];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        const reach = i === stretches ? Math.min(len, 2.6) : len;
        const dir = Math.atan2(b.x - a.x, b.z - a.z);
        for (let d = 0.6; d < reach && n < 160; d += 0.55) {
          const k = d / len;
          const fade = i === 1 ? 1 : i === stretches ? (1 - d / reach) * 0.6 : 0.75;
          dashes.setMatrixAt(n, new THREE.Matrix4().compose(new THREE.Vector3(a.x + (b.x - a.x) * k, 0.06, a.z + (b.z - a.z) * k), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dir), new THREE.Vector3(1, 1, 1)));
          dashes.setColorAt(n, new THREE.Color(1, 0.35 + 0.65 * fade, 0.3 + 0.7 * fade).multiplyScalar(fade));
          n++;
        }
      }
      const end = f.path[Math.min(1, f.path.length - 1)];
      ghost.position.set(end.x, 0.05, end.z);
      ghost.visible = true;
    } else ghost.visible = false;
    dashes.count = n;
    dashes.instanceMatrix.needsUpdate = true;
    if (dashes.instanceColor) dashes.instanceColor.needsUpdate = true;
  }

  function render(room, dt, { angle = null, assist = false } = {}) {
    const realDt = Math.min(0.05, dt);
    clock += realDt;
    if (room && built !== room) build(room);

    // the camera, breathing a little
    const base = camera.userData.base;
    if (base) {
      camera.position.copy(base);
      if (!calm) camera.position.x += Math.sin(clock * 0.3) * 0.08;
      camera.lookAt(camera.userData.look);
    }
    feel.update(realDt, camera);

    if (!room) {
      engine.render();
      return;
    }

    // walls: broken glass gone, open doors sunk into the floor
    for (const w of room.walls) {
      const m = wallMeshes[w.key];
      if (!m) continue;
      if (w.kind === 'glass') m.getObjectByName('pane').visible = !w.broken;
      if (w.kind === 'door') {
        const target = w.open ? -WALL_H - 0.1 : 0;
        m.position.y += (target - m.position.y) * Math.min(1, realDt * 5);
        const light = m.getObjectByName('light');
        if (light) light.material.color.copy(hot(w.open ? 0x3aff6a : 0xff3a2a, 2));
      }
    }
    for (const sw of room.switches) {
      const m = switchMeshes[sw.key]?.getObjectByName('face');
      if (m) {
        m.material.emissive.set(sw.on ? 0x2aff6a : 0x000000);
        m.material.emissiveIntensity = sw.on ? 0.9 : 0;
      }
    }

    // bots: standing, walking their rail, or falling down
    for (const b of room.bots) {
      const f = figures[b.key];
      if (!f) continue;
      const [bx, bz] = botAt(b, room.t);
      if (f.fall) {
        f.fall.t += realDt;
        const k = Math.min(1, f.fall.t / 0.55);
        const e = 1 - (1 - k) ** 3;
        f.root.position.set(f.fall.x + f.fall.dx * e * 0.8, 0, f.fall.z + f.fall.dz * e * 0.8);
        f.root.rotation.set(0, f.fall.yaw, 0);
        f.root.rotateX(e * 1.5);
        continue;
      }
      f.root.position.set(bx, 0, bz);
      let yaw = Math.atan2(room.def.cap[0] - bx, room.def.cap[1] - bz);
      let mode = 'idle';
      if (b.patrol && !b.down) {
        const [nx, nz] = botAt(b, room.t + 0.05);
        if (Math.hypot(nx - bx, nz - bz) > 1e-4) {
          yaw = Math.atan2(nx - bx, nz - bz);
          mode = 'walk';
        }
      }
      f.root.rotation.set(0, yaw, 0);
      if (b.kind !== 'hostage') poseHumanoid(f, { t: clock, mode, phase: b.key * 1.7, speed: 1.2, flinch: b.dents ? 0.4 : 0 });
      else f.bones.hips.position.y = f.rest.hips.y + Math.sin(clock * 2 + b.key) * 0.005;
      if (f.plates) f.plates.forEach((p) => (p.visible = !b.dents));
    }

    // Cap: ready stance, the throw, the catch
    throwAnim = Math.max(0, throwAnim - realDt * 3);
    catchAnim = Math.max(0, catchAnim - realDt * 3);
    const aimYaw = angle != null ? -angle : 0;
    cap.root.rotation.set(0, Math.PI + aimYaw * 0.6, 0);
    poseHumanoid(cap, { t: clock, mode: 'idle', speed: 0.6 });
    // the shield arm: across the body to throw, out to catch
    const k = throwAnim;
    cap.bones.shoulderL.rotation.set(-0.6 - k * 0.8 - catchAnim * 0.6, 0.3, 0.25 - k * 1.4);
    cap.bones.elbowL.rotation.set(-1.2 + k * 1.1, 0, 0);
    cap.bones.spine.rotation.y = -k * 0.5;
    cap.bones.thighL.rotation.x = -0.25;
    cap.bones.thighR.rotation.x = 0.2;
    cap.bones.kneeR.rotation.x = 0.25;

    // the shield: on his arm, or in flight
    const f = room.flight;
    heldShield.visible = !f;
    flyShield.visible = !!f;
    if (f) {
      const [x, z] = pointOnPath(f.path, f.elapsed);
      flyShield.position.set(x, 0.85, z);
      flyShield.rotation.set(-Math.PI / 2 + 0.25, 0, 0);
      flyShield.rotateZ(clock * 22);
      if (!calm && Math.random() < 0.7) vfx.trail(v3.set(x, 0.75, z), { size: 0.5, life: 0.18, color: 0xc8dcff, to: 0x223355, a: 0.35 });
    }

    drawAim(room, angle, assist);
    vfx.update(realDt, camera, engine.size.h);
    engine.render();
  }

  // the rules' events, as effects
  function fx(events) {
    for (const e of events) {
      const at = new THREE.Vector3(e.x ?? 0, 0.75, e.z ?? 0);
      if (e.type === 'bounce') {
        vfx.sparks(at, { count: 22, speed: 7, color: 0xfff0c0, to: 0xff9a40, life: 0.4, size: 0.07 });
        vfx.flash(at, { color: 0xffd9a0, intensity: 8, distance: 5, life: 0.12 });
        feel.trauma(0.12);
      } else if (e.type === 'down') {
        const fig = figures[e.key];
        if (fig) {
          const d = Math.hypot(e.dx, e.dz) || 1;
          fig.fall = { t: 0, x: e.x, z: e.z, dx: e.dx / d, dz: e.dz / d, yaw: Math.atan2(-e.dx, -e.dz) };
        }
        vfx.sparks(at.setY(1.1), { count: 26, speed: 6, color: 0xdff4ff, to: 0x58c8ff, life: 0.45, size: 0.07 });
        vfx.debris(at, { count: 6, speed: 4, size: 0.06 });
        feel.trauma(0.2);
        feel.hitstop(55);
      } else if (e.type === 'armor') {
        vfx.debris(at.setY(1.2), { count: 8, speed: 5, size: 0.1 });
        vfx.sparks(at, { count: 30, speed: 8, life: 0.5 });
        feel.trauma(0.25);
      } else if (e.type === 'glass') {
        vfx.debris(at, { count: 22, speed: 6, size: 0.08 });
        vfx.sparks(at, { count: 16, speed: 4, color: 0xffffff, to: 0xaee8ff, life: 0.5, size: 0.05 });
        feel.trauma(0.15);
      } else if (e.type === 'mat') {
        vfx.smoke(at.setY(0.6), { size: 0.6, count: 4, life: 0.9, rise: 0.3, opacity: 0.35, color: 0xa8b0bc, to: 0xd0d4da });
      } else if (e.type === 'switch') {
        vfx.sparks(new THREE.Vector3(e.x, 1.15, e.z), { count: 20, speed: 4, color: 0xb0ffc8, to: 0x30ff70, life: 0.5, size: 0.06 });
      } else if (e.type === 'catch') {
        catchAnim = 1;
        feel.trauma(0.1);
      } else if (e.type === 'hostage') {
        vfx.flash(at, { color: 0xff3020, intensity: 14, distance: 6, life: 0.4 });
        feel.trauma(0.4);
      } else if (e.type === 'cleared') {
        for (let i = 0; i < 3; i++) vfx.sparks(new THREE.Vector3((Math.random() - 0.5) * 8, 2, -2 + Math.random() * 3), { count: 30, speed: 6, color: 0xffe08a, to: 0xff9a2a, life: 1, size: 0.08, gravity: 4 });
      }
    }
  }

  const startThrow = () => {
    throwAnim = 1;
  };

  // the angle from Cap to a point under the pointer (screen in NDC)
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.75);
  const angleAt = (nx, ny, room) => {
    ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const p = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, p)) return null;
    const [cx, cz] = room.def.cap;
    const a = Math.atan2(p.x - cx, -(p.z - cz));
    return Math.max(-1.55, Math.min(1.55, a));
  };
  const project = (x, y, z) => engine.project(v3.set(x, y, z));

  const resize = (w, h) => {
    engine.resize(w, h);
    fit();
  };

  return {
    engine,
    render,
    fx,
    startThrow,
    angleAt,
    project,
    resize,
    timeScale: (dt) => feel.scale(dt),
    info: engine.info,
    dispose() {
      vfx.dispose();
      engine.dispose();
    },
  };
}

// The flying lesson (quest 2, rules/flight.js’s lesson): Madam Hooch on the
// lawn, a school broom on the grass beside you. E, and “Up”: it jumps to
// your hand. E again: you’re on it. Three rings round the lawn, in order,
// gold, the next one bright and the rest waiting; then down again by her,
// and the broom is yours to borrow.
//
//   create(ctx, at) → { step(dt, input, pad, { rider, landed }), act(down),
//     state(), over, dispose() } (play/lessons.js runs it)

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { HOOCH, LESSON, lessonAct, lessonFly, lessonResult, newLesson, ringsRound } from '../../rules/flight';
import { makeProp } from '../props';
import { createSpellSounds } from '../spellSounds';

const WHO = 'Madam Hooch';
const GOLD = new THREE.Color(1, 0.78, 0.32);
const UP_TIME = 0.35; // s the broom takes to jump to your hand
const AFTER = 4; // s the lesson stays once done (her last word, the rings going)

const ahead = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)]; // (the walk’s yaw)

export function create(ctx, at) {
  const { scene, camera, house, rt, floorAt = () => 0, said, cards } = ctx;
  const [ax, , az] = at.p;
  const [fx, fz] = ahead(at.yaw);
  const group = new THREE.Group();
  group.name = 'hogwarts-lesson-flying';
  scene.add(group);
  const sounds = createSpellSounds(rt);

  // Madam Hooch, a few steps ahead, facing you
  const hp = new THREE.Vector3(ax + fx * 3.5, 0, az + fz * 3.5);
  hp.y = floorAt(hp.x, hp.z);
  const head = hp.clone().add(new THREE.Vector3(0, 2.1, 0));
  const hooch = ctx.figure?.('hooch', { height: 1.72 }) ?? null;
  if (hooch) {
    hooch.group.position.copy(hp);
    hooch.group.rotation.y = Math.atan2(-fx, -fz);
    group.add(hooch.group);
  }
  // the school broom on the grass at your right hand
  const broom = makeProp('broom', { house, rt });
  const rest = new THREE.Vector3(ax + fx * 1.4 - fz * 0.9, 0, az + fz * 1.4 + fx * 0.9);
  rest.y = floorAt(rest.x, rest.z) + 0.1;
  broom.position.copy(rest);
  broom.rotation.y = at.yaw + Math.PI / 2;
  group.add(broom);

  // three rings round the lawn ahead, each a gold hoop facing along the lap
  // (the lap’s middle far enough ahead that its first ring is twenty metres off)
  const centre = [ax + fx * 50, floorAt(ax + fx * 50, az + fz * 50), az + fz * 50];
  let l = newLesson(ringsRound(centre, { radius: 30, height: 7 }));
  const ringGeo = new THREE.TorusGeometry(LESSON.ringR, 0.14, 8, 48);
  const rings = l.rings.map((r) => {
    const m = new MeshBasicNodeMaterial({ color: GOLD.clone(), transparent: true, opacity: 0.5, depthWrite: false });
    m.fog = false;
    const mesh = new THREE.Mesh(ringGeo, m);
    mesh.position.set(...r.p);
    // (its hole faces along `yaw`: a torus lies in xy, so turned to face (sin, cos))
    mesh.rotation.y = r.yaw;
    group.add(mesh);
    return mesh;
  });

  let up = -1; // s into the broom’s jump, or −1
  let t = 0;
  let left = -1; // s left once done
  let prev = null;
  const say = (text) => said?.say(WHO, text, head);
  const tellStep = () => {
    if (l.step === 'up') ctx.objective('E · “Up”, over the broom');
    else if (l.step === 'mount') ctx.objective('E · Get on the broom');
    else if (l.step === 'rings') ctx.objective(`Fly through the rings · ${l.ring + 1} of ${l.rings.length}`);
    else if (l.step === 'land') ctx.objective('Land by Madam Hooch');
    else ctx.objective(null);
  };
  say(HOOCH.up);
  tellStep();

  const hand = new THREE.Vector3();
  const self = {
    over: false,
    act(down) {
      if (!down || (l.step !== 'up' && l.step !== 'mount')) return false;
      if (up >= 0 && up < UP_TIME) return true;
      const r = lessonAct(l);
      l = r.lesson;
      if (r.what === 'up') {
        up = 0;
        sounds.whoosh(1.2);
      } else if (r.what === 'mount') {
        broom.visible = false;
        ctx.fly?.();
      }
      say(r.says);
      tellStep();
      return true;
    },
    step(dt, input, pad, world = {}) {
      t += dt;
      // the broom jumping up to your hand, and held there
      if (up >= 0 && l.step === 'mount') {
        up = Math.min(UP_TIME, up + dt);
        // (held upright at your right, the handle up and leaning in, the twigs at your feet)
        hand.set(0.45, -0.25, -0.9).applyQuaternion(camera.quaternion).add(camera.position);
        const k = up / UP_TIME;
        broom.position.lerpVectors(rest, hand, k * k * (3 - 2 * k));
        broom.position.y += Math.sin(k * Math.PI) * 0.4;
        broom.quaternion.copy(camera.quaternion);
        broom.rotateX(-1.35 * k);
        broom.rotateY(0.25 * k);
        broom.translateZ(-0.55 * k);
      }
      // the rings: the next one bright and turning its light round, the
      // ones done fading, the ones to come waiting
      rings.forEach((mesh, i) => {
        const next = l.step === 'rings' && i === l.ring;
        const done = i < l.ring;
        const want = done ? 0 : next ? 1 : 0.35;
        mesh.material.opacity += (want - mesh.material.opacity) * Math.min(1, dt * 4);
        mesh.material.color.copy(GOLD).multiplyScalar(next ? 2.2 + Math.sin(t * 5) * 0.4 : 1);
        if (next && cards && Math.random() < dt * 40) {
          const a = Math.random() * Math.PI * 2;
          const r = l.rings[i];
          const c = Math.cos(r.yaw);
          const s = Math.sin(r.yaw);
          const x = Math.cos(a) * LESSON.ringR;
          cards.spawn({ p: [r.p[0] + x * c, r.p[1] + Math.sin(a) * LESSON.ringR, r.p[2] - x * s], v: [0, 0.2, 0], life: 0.7, size: 0.12, colour: GOLD.clone().multiplyScalar(2), drag: 1 });
        }
      });
      // through the rings, and down by her
      const rider = world.rider;
      if (rider && (l.step === 'rings' || l.step === 'land')) {
        const to = rider.p;
        if (prev) {
          const r = lessonFly(l, prev, to, false);
          l = r.lesson;
          if (r.what === 'ring') {
            sounds.hit('back');
            const g = l.rings[l.ring - 1];
            for (let k = 0; k < 30 && cards; k++) {
              const a = Math.random() * Math.PI * 2;
              cards.spawn({ p: [...g.p], v: [Math.cos(a) * 3, Math.sin(a) * 3, (Math.random() - 0.5) * 3], life: 0.8, size: 0.14, colour: GOLD.clone().multiplyScalar(2.4), drag: 2 });
            }
            say(r.says);
            tellStep();
          }
        }
        prev = [...to];
      } else prev = null;
      if (world.landed && l.step === 'land') {
        const [x, z] = world.landed;
        if (Math.hypot(x - hp.x, z - hp.z) <= LESSON.near) {
          const r = lessonFly(l, null, null, true);
          l = r.lesson;
          say(r.says);
          const res = lessonResult(l);
          ctx.points(res.points, 'flying');
          ctx.done();
          tellStep();
          left = AFTER;
        } else ctx.toast('Down by Madam Hooch, please. E by the broom to go up again.');
      }
      if (left > 0 && (left -= dt) <= 0) self.over = true;
      // (it has the keys only while the broom is jumping to you)
      return up >= 0 && up < UP_TIME;
    },
    state: () => ({ step: l.step, ring: l.ring, rings: l.rings.map((r) => r.p.map((v) => Math.round(v * 10) / 10)), hooch: [hp.x, hp.z].map((v) => Math.round(v * 10) / 10), broom: broom.position.toArray().map((v) => Math.round(v * 10) / 10) }),
    // the bot’s view (the check’s): the rings and where she stands
    get lesson() {
      return l;
    },
    dispose() {
      scene.remove(group);
      ringGeo.dispose();
      rings.forEach((m) => m.material.dispose());
      hooch?.dispose?.();
      broom.traverse((o) => o.geometry?.dispose?.());
    },
  };
  return self;
}

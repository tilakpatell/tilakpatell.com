// The Patronus (quest 11’s first step, rules/patronus.js): the boggart’s
// wardrobe again, and what comes out of it this time is a dementor, made to
// drift at you so you can learn the charm on something that can’t really
// hurt you. Expecto Patronum (9, or the wheel, then F) is tried on it: the
// first two are a silver mist that holds it back; the third is the
// Patronus itself, the wand’s own, and the boggart is back in the wardrobe
// with the door banging. If it reaches you, you go grey and come round on
// the floor, your tries kept. Learnt, the wand knows it from then on and
// the term hears it ('learnt' { spell: 'patronus' }).
//
//   create(ctx, at) → { step, act, state(), over, dispose() }

import * as THREE from 'three';
import { LINES, PATRONUS, drift, newLesson, tryCast } from '../../rules/patronus';
import { makeDementor } from '../../world/grounds/dementors';
import { createSpellSounds } from '../spellSounds';
import { createVeil, frame, furniture } from './kit';

const OUT = 1.4; // s it takes to come out of the wardrobe
const MIST = '#e6f2ff';

export function create(ctx, at) {
  const { scene, camera, house, rt, floorAt, cards, wand, walker, tell = () => {} } = ctx;
  const f = frame(at, floorAt);
  const group = new THREE.Group();
  group.name = 'hogwarts-lesson-patronus';
  scene.add(group);
  const sounds = createSpellSounds(rt);
  const veil = createVeil(scene);

  const wardrobe = furniture('wardrobe', { house, w: 1.3, d: 0.65, h: 2.2, colour: '#3e2b1c' });
  const home = f.put(0, PATRONUS.start + 0.6);
  wardrobe.position.copy(home);
  wardrobe.rotation.y = f.yaw;
  group.add(wardrobe);

  const figure = makeDementor({ house, rt });
  group.add(figure.group);

  let lesson = newLesson();
  let t = 0;
  let out = 0; // s since it came out
  let rattle = 1;
  let grey = 0; // the veil of going down, lifting
  let left = -1; // s to the end, once learnt
  let gone = 0; // its going back in, 0…1

  const objective = () => {
    if (lesson.learnt) ctx.objective(null);
    else ctx.objective(lesson.tries ? `9 then F · Expecto Patronum again (${lesson.tries} of ${PATRONUS.tries})` : '9 then F · Expecto Patronum');
  };
  const mist = (big) => {
    if (!cards) return;
    const tip = wand?.tip?.() ?? camera.position.clone();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    for (let i = 0; i < (big ? 70 : 40); i++)
      cards.spawn({ p: tip.toArray(), v: [dir.x * 2.2 + (Math.random() - 0.5), dir.y * 2 + Math.random() * 0.5, dir.z * 2.2 + (Math.random() - 0.5)], life: 1.8, size: big ? 0.16 : 0.12, colour: new THREE.Color(MIST).multiplyScalar(1.4), grow: 3, drag: 1.1 });
  };

  // the wand’s Expecto Patronum is the lesson’s until it takes: a mist and
  // the wand’s look and sound (taken), then on the third the real thing
  wand?.take?.((id) => {
    if (id !== 'patronum' || lesson.learnt || out < OUT) return false;
    const r = tryCast(lesson);
    lesson = r.lesson;
    ctx.toast(r.says);
    if (r.learnt) {
      wand.learn?.('patronus');
      wand.take(null);
      tell('learnt', { spell: 'patronus' });
      ctx.done();
      left = 4;
      sounds.notes?.();
      // (not taken: the wand casts it for real, and the Patronus runs at the thing)
      objective();
      return false;
    }
    mist(lesson.tries > 1);
    objective();
    return true;
  });
  ctx.toast(LINES.begin);
  objective();

  const self = {
    over: false,
    act() {
      return true;
    },
    step(dt) {
      t += dt;
      out += dt;
      rattle = Math.max(0, rattle - dt);
      wardrobe.rotation.z = rattle > 0 ? Math.sin(t * 60) * 0.02 : 0;
      if (out > OUT) {
        const r = drift(lesson, dt);
        lesson = r.lesson;
        for (const e of r.events) {
          if (e.type !== 'down') continue;
          ctx.toast(e.says);
          grey = 1;
          out = 0;
          rattle = 0.8;
          walker?.place?.([at.p[0], at.p[2]], at.yaw);
        }
      }
      // where it is: out of the wardrobe, then `at` metres off you; back in when it’s done
      if (lesson.learnt) gone = Math.min(1, gone + dt * 0.7);
      const k = Math.min(1, out / OUT);
      const p = lesson.learnt ? f.put(0, PATRONUS.start * (1 - gone) + (PATRONUS.start + 0.6) * gone) : home.clone().lerp(f.put(0, lesson.at), k * k * (3 - 2 * k));
      figure.group.position.set(p.x, p.y + 0.25 + Math.sin(t * 1.3) * 0.08, p.z);
      figure.group.rotation.y = f.yaw;
      figure.set({ t, fade: Math.min(k, 1 - gone), reach: lesson.learnt ? 0 : Math.max(0, Math.min(1, (3 - lesson.at) / 2)) });
      if (gone >= 1 && !rattle) rattle = 0.5;
      grey = Math.max(0, grey - dt * 0.4);
      veil.set(grey);
      veil.update(camera);
      if (left > 0 && (left -= dt) <= 0) self.over = true;
      return true;
    },
    // the bot: it casts whenever the wand is ready
    bot() {
      wand?.cast?.('patronum');
    },
    state: () => ({ tries: lesson.tries, at: Math.round(lesson.at * 100) / 100, learnt: lesson.learnt, downs: lesson.downs }),
    dispose() {
      wand?.take?.(null);
      veil.dispose();
      figure.dispose();
      scene.remove(group);
      wardrobe.geometry.dispose();
    },
  };
  return self;
}


// Charms, the feather (quest 3, rules/charms.js): your desk, a feather on
// it and Flitwick on his books at the front. Hold E for the swish while
// the ring round the feather fills, and let go on the flick as it closes
// (or draw it with the pointer: a swish across, a flick up); on the beat
// the feather rises, near it a little, off it it wobbles down, and between
// flicks it sinks. A jab sets it alight, and so does Incendio: five points
// and a fresh one from the jar. Up to the ceiling for ten.
//
//   create(ctx, at) → { step, act(down), state(), over, dispose() }

import * as THREE from 'three';
import { CHARMS, burn, charmsBot, gesture, newCharms, press, release, stepCharms } from '../../rules/charms';
import { makeProp } from '../props';
import { createSpellSounds } from '../spellSounds';
import { createGauge, frame, furniture } from './kit';

const WHO = 'Professor Flitwick';
const BLUE = new THREE.Color('#b9e4ff').multiplyScalar(2.2);
const FIRE = 2.5; // s the feather burns for

export function create(ctx, at) {
  const { scene, camera, house, rt, floorAt, said, cards, wand } = ctx;
  const f = frame(at, floorAt);
  const group = new THREE.Group();
  group.name = 'hogwarts-lesson-charms';
  scene.add(group);
  const sounds = createSpellSounds(rt);
  const gauge = cards ? createGauge(cards) : null;

  // your desk, a step ahead; the feather on it; Flitwick on his books beyond
  const desk = furniture('desk', { house, w: 1.2, d: 0.6, h: 0.76 });
  desk.position.copy(f.put(0, 2.2));
  desk.rotation.y = f.yaw;
  group.add(desk);
  const top = desk.position.clone().setY(desk.position.y + 0.8);
  const feather = makeProp('feather', { house, rt });
  feather.position.copy(top);
  feather.rotation.y = f.yaw + 0.4;
  feather.scale.setScalar(1.6); // (a quill you can see from your seat)
  group.add(feather);
  // (Incendio knows it: the wand can light it, and the lesson hears)
  wand?.add({ id: 'charms-feather', kind: 'feather', object: feather, r: 0.2, mid: 0.02 });
  const books = furniture('desk', { house, w: 0.5, d: 0.4, h: 0.9, colour: '#6a2a24' });
  books.position.copy(f.put(1.4, 5));
  books.rotation.y = f.yaw;
  group.add(books);
  const head = f.put(1.4, 5, 2.1);
  const flitwick = ctx.figure?.('flitwick', { height: 0.95 }) ?? null;
  if (flitwick) {
    flitwick.group.position.copy(f.put(1.4, 5, 0.94));
    flitwick.group.rotation.y = f.yaw;
    group.add(flitwick.group);
  }

  let c = newCharms();
  let t = 0;
  let left = -1;
  let burning = 0;
  let path = null; // the pointer’s stroke: [{ x, y, t }]
  let spin = 0;
  const look = new THREE.Vector3();
  const say = (text) => said?.say(WHO, text, head);
  const objective = () => ctx.objective(c.done ? null : `Hold E, let go as the ring closes · ${Math.round((c.h / CHARMS.ceiling) * 100)}% to the ceiling`);
  say('Swish and flick. Hold it for the swish, let go for the flick, and mind the beat.');
  objective();

  const setFire = () => {
    const b = burn(c);
    c = b.charms;
    burning = FIRE;
    ctx.points(b.points, 'charms');
    say(b.says);
    sounds.fizzle();
    objective();
  };
  const settle = (r) => {
    c = r.charms;
    if (r.grade === 'jab') {
      setFire();
      return;
    }
    if (r.grade) {
      sounds.cast({ kind: 'lift' });
      if (r.grade !== 'miss' && cards) for (let i = 0; i < 18; i++) cards.spawn({ p: feather.position.toArray(), v: [(Math.random() - 0.5) * 1.4, Math.random() * 1.2, (Math.random() - 0.5) * 1.4], life: 0.6, size: 0.05, colour: BLUE, drag: 2 });
      say(r.says);
    }
    if (r.points > 0) {
      ctx.points(r.points, 'charms');
      ctx.done();
      left = 4;
    }
    objective();
  };

  const self = {
    over: false,
    act(down) {
      if (c.done || burning > 0) return true;
      if (down) c = press(c, t);
      else settle(release(c, t));
      return true;
    },
    step(dt, input) {
      t += dt;
      // the pointer’s swish and flick
      const p = input?.pointer;
      if (p?.down) {
        if (!path) path = [];
        path.push({ x: p.x, y: p.y, t });
      } else if (path) {
        const g = gesture(path);
        path = null;
        if (g.ok && !c.done && burning <= 0) {
          if (g.jab) setFire();
          else settle(release({ ...c, pressAt: t - g.hold }, t));
        }
      }
      // Incendio at it
      const th = wand?.things?.get('charms-feather');
      if (th?.lit && burning <= 0) {
        th.lit = false;
        setFire();
      }
      c = stepCharms(c, dt);
      // the feather: up to its height over the desk, turning and bobbing
      // as it goes; on fire, gone to ash and a fresh one laid down
      burning = Math.max(0, burning - dt);
      spin += dt * (c.pressAt != null ? 3 : 0.8);
      const want = top.clone().setY(top.y + c.h + (c.h > 0 ? Math.sin(t * 2.4) * 0.04 : 0));
      feather.position.lerp(want, Math.min(1, dt * 5));
      feather.rotation.set(Math.sin(t * 1.7) * 0.2 * Math.min(1, c.h), f.yaw + spin, Math.sin(t * 2.3) * 0.25 * Math.min(1, c.h));
      feather.visible = burning <= FIRE * 0.5 || Math.random() < 0.6;
      // the charm’s light round it while it’s up, and your eyes on it
      if (cards && c.h > 0.05 && burning <= 0 && Math.random() < 0.5) cards.spawn({ p: feather.position.toArray(), v: [0, 0, 0], life: 0.2, size: 0.5, colour: BLUE.clone().multiplyScalar(0.12), grow: 0 });
      camera.getWorldDirection(look);
      const want2 = feather.position.clone().sub(camera.position).normalize();
      const pitchNow = Math.asin(Math.max(-1, Math.min(1, look.y)));
      const pitchWant = Math.asin(Math.max(-1, Math.min(1, want2.y)));
      camera.rotateX((pitchWant - pitchNow) * 0.75);
      if (burning > 0 && cards) {
        const hot = Math.random();
        cards.spawn({ p: feather.position.toArray(), v: [(Math.random() - 0.5) * 0.2, 0.6 + hot * 0.4, (Math.random() - 0.5) * 0.2], life: 0.5, size: 0.12, colour: new THREE.Color(hot > 0.5 ? '#ffb347' : '#ff5a1f').multiplyScalar(2.2), grow: -0.6 });
      }
      // the beat: a ring round the feather filling as you hold, bright at the beat
      if (gauge && c.pressAt != null && !c.done) {
        const k = Math.min(1, (t - c.pressAt) / CHARMS.beat);
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
        const on = Math.abs(t - c.pressAt - CHARMS.beat) <= CHARMS.perfect;
        gauge.ring(feather.position, 0.32, k, on ? new THREE.Color(1, 0.9, 0.5).multiplyScalar(2.6) : BLUE, [right, up]);
      }
      if (left > 0 && (left -= dt) <= 0) self.over = true;
      return true;
    },
    // the bot’s hands (the check’s): what charmsBot says, now
    bot() {
      const what = charmsBot(c, t);
      if (what === 'press') self.act(true);
      else if (what === 'release') self.act(false);
    },
    state: () => ({ h: Math.round(c.h * 100) / 100, flicks: c.flicks, burnt: c.burnt, done: c.done, holding: c.pressAt != null }),
    dispose() {
      wand?.remove?.('charms-feather');
      scene.remove(group);
      flitwick?.dispose?.();
      for (const m of [desk, books]) m.geometry.dispose();
      feather.traverse((o) => o.geometry?.dispose?.());
    },
  };
  return self;
}

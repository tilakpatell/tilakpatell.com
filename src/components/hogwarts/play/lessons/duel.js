// The duelling club (quest 8, rules/duel.js): the stage down the middle of
// the Defence classroom, Malfoy at the far end of it. Three rounds on the
// wand’s own keys: 6 Expelliarmus, 7 Stupefy, 8 Protego. His wand lights
// before every spell he lets go; Protego as his bolt arrives (its first
// part) sends it straight back. An Expelliarmus that lands takes the round;
// a Stupefy that lands puts the one it hits on the floor and loses them it.
// First to two rounds, twenty points; lose, and E has you up again.
//
//   create(ctx, at) → { step, act(down), state(), over, dispose() }

import * as THREE from 'three';
import { CASTS, DUEL, duelBot, newDuel, result, stepDuel } from '../../rules/duel';
import { spellById } from '../../rules/spells';
import { createBolt } from '../glow';
import { makeProp } from '../props';
import { createSpellSounds } from '../spellSounds';
import { createVeil, frame, furniture } from './kit';

const WHO = 'Malfoy';
const CHEST = 1.25; // m: where the bolts fly, over the floor
const NAMES = { you: 'You', foe: 'Malfoy' };

export function create(ctx, at) {
  const { scene, camera, house, rt, floorAt, said, cards, wand, feel } = ctx;
  const f = frame(at, floorAt);
  const group = new THREE.Group();
  group.name = 'hogwarts-lesson-duel';
  scene.add(group);
  const sounds = createSpellSounds(rt);
  const veil = createVeil(scene);

  // the stage between you, Malfoy at its far end facing you
  const stage = furniture('platform', { house, w: 1.3, d: DUEL.gap - 1.6, h: 0.5 });
  stage.position.copy(f.put(0, DUEL.gap / 2));
  stage.rotation.y = f.yaw;
  group.add(stage);
  const foeAt = f.put(0, DUEL.gap);
  const foe = ctx.figure?.('malfoy', { height: 1.45 }) ?? null;
  const stand = foe ? null : makeProp('student', { house, rt, tint: '#1a472a' });
  const body = foe?.group ?? stand;
  body.position.copy(foeAt);
  body.rotation.order = 'YXZ'; // (so he falls back, whichever way he faces)
  body.rotation.y = f.yaw;
  group.add(body);
  const foeTip = () =>
    foeAt
      .clone()
      .add(new THREE.Vector3(0, 0.95, 0))
      .add(new THREE.Vector3(Math.sin(f.yaw) * 0.45, 0, Math.cos(f.yaw) * 0.45));
  const head = foeAt.clone().setY(foeAt.y + 2.4); // (his bubble over his head, not on it)
  // his wand, for when it’s knocked out of his hand
  const foeWand = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.009, 0.3, 5).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#3a2a1f' }));
  foeWand.visible = false;
  group.add(foeWand);

  const along = (x) => f.put(0, x, CHEST); // a point on the duel’s line, x from you
  let d = newDuel({ seed: Math.floor(Math.random() * 1e6) });
  let pending = null; // a cast key pressed, for the next step
  let t = 0;
  let left = -1;
  let down = { you: 0, foe: 0 }; // s on the floor
  let flung = null; // { from, v, t }: a wand in the air
  const views = []; // a drawn bolt for each of the rules’ bolts
  const say = (text) => text && said?.say(WHO, text, head);
  const objective = () => {
    if (d.over) ctx.objective(d.winner === 'you' ? null : 'E · ask him for another');
    else ctx.objective(`Round ${d.round} · you ${d.wins.you}, Malfoy ${d.wins.foe} · 6 Expelliarmus · 7 Stupefy · 8 Protego`);
  };
  // the wand’s keys are the duel’s while it runs (its other spells are its own)
  wand?.setDuel?.(true);
  wand?.take?.((id) => {
    if (!CASTS.includes(id) || d.over) return false;
    pending = id;
    return true;
  });
  objective();

  const self = {
    over: false,
    act(isDown) {
      if (!isDown) return true;
      if (d.over && d.winner !== 'you') {
        d = newDuel({ seed: Math.floor(Math.random() * 1e6) });
        objective();
      }
      return true;
    },
    step(dt) {
      t += dt;
      const input = pending ? { cast: pending } : {};
      pending = null;
      d = stepDuel(d, input, dt);
      for (const e of d.ev) {
        if (e.type === 'line') say(e.text);
        else if (e.type === 'cast' && e.who === 'foe') {
          if (e.spell === 'protego') sounds.hum();
          else sounds.cast(spellById(e.spell));
        } else if (e.type === 'back' || e.type === 'blocked') sounds.hit(e.type === 'back' ? 'back' : 'blocked');
        else if (e.type === 'hit') {
          sounds.hit('hit');
          const p = e.on === 'you' ? along(0.6) : along(DUEL.gap - 0.4);
          if (cards)
            for (let i = 0; i < 26; i++)
              cards.spawn({ p: p.toArray(), v: [(Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4], life: 0.5, size: 0.08, colour: new THREE.Color(spellById(e.spell).colour).multiplyScalar(2.4), drag: 3 });
          if (e.on === 'you') feel?.trauma?.(0.6);
        } else if (e.type === 'knockdown') down[e.on] = DUEL.between;
        else if (e.type === 'disarmed' && e.on === 'foe') flung = { from: foeTip(), v: new THREE.Vector3(Math.sin(f.yaw) * -2 + (Math.random() - 0.5) * 2, 4.5, Math.cos(f.yaw) * -2), t: 0 };
        else if (e.type === 'disarmed' && e.on === 'you') wand?.visible?.(false);
        else if (e.type === 'round') {
          wand?.visible?.(true);
          objective();
        } else if (e.type === 'roundOver') objective();
        else if (e.type === 'over') {
          const r = result(d);
          if (r.won) {
            ctx.points(r.points, 'duel');
            ctx.done({ won: true });
            left = 5;
          }
          objective();
        }
      }
      // the bolts on the line, each its own colour, a trail behind it
      while (views.length < d.bolts.length) {
        const v = createBolt('#ffffff');
        group.add(v.group);
        views.push({ v, spell: null });
      }
      while (views.length > d.bolts.length) {
        const g = views.pop();
        group.remove(g.v.group);
        g.v.dispose();
      }
      d.bolts.forEach((b, i) => {
        if (views[i].spell !== b.spell) {
          group.remove(views[i].v.group);
          views[i].v.dispose();
          views[i] = { v: createBolt(spellById(b.spell).colour), spell: b.spell };
          group.add(views[i].v.group);
        }
        const p = along(b.x);
        views[i].v.group.position.copy(p);
        views[i].v.group.lookAt(along(b.x + b.dir));
        if (cards && Math.random() < 0.8) cards.spawn({ p: p.toArray(), v: [0, 0, 0], life: 0.3, size: 0.09, colour: new THREE.Color(spellById(b.spell).colour).multiplyScalar(2.2), grow: -0.5, drag: 0 });
      });
      // his wind-up: his wand tip lights in the colour of what’s coming
      if (d.foe.windup && cards) cards.spawn({ p: foeTip().toArray(), v: [0, 0, 0], life: 0.06, size: 0.18 + Math.sin(t * 30) * 0.04, colour: new THREE.Color(spellById(d.foe.windup.spell).colour).multiplyScalar(3), drag: 0 });
      // his shield, a dome round him while it’s up
      const sh = d.foe.shield != null && d.t - d.foe.shield < 1;
      if (sh && cards && Math.random() < 0.9) {
        const a = Math.random() * Math.PI * 2;
        const b = Math.random() * Math.PI * 0.5;
        cards.spawn({
          p: [foeAt.x + Math.cos(a) * Math.cos(b) * 1.1, foeAt.y + 0.9 + Math.sin(b) * 1.1, foeAt.z + Math.sin(a) * Math.cos(b) * 1.1],
          v: [0, 0, 0],
          life: 0.25,
          size: 0.1,
          colour: new THREE.Color('#cfe6ff').multiplyScalar(1.6),
          drag: 0,
        });
      }
      // on the floor (Stupefy), and up again
      for (const who of ['you', 'foe']) down[who] = Math.max(0, down[who] - dt);
      const lie = Math.min(1, down.foe * 3) * (down.foe > 0 ? 1 : 0);
      body.rotation.set(-lie * 1.45, f.yaw, 0);
      veil.set(down.you > 0 ? Math.min(0.7, down.you) : 0);
      veil.update(camera);
      if (flung) {
        flung.t += dt;
        const p = flung.from.clone().addScaledVector(flung.v, flung.t);
        p.y -= 4.9 * flung.t * flung.t;
        foeWand.visible = p.y > floorAt(p.x, p.z);
        foeWand.position.copy(p);
        foeWand.rotation.x += dt * 14;
        if (!foeWand.visible) flung = null;
      }
      if (left > 0 && (left -= dt) <= 0) self.over = true;
      return true;
    },
    // the bot’s hands: the beat for Protego, and its spell when it may
    bot() {
      const r = duelBot(d);
      if (r.cast) pending = r.cast;
      if (d.over && d.winner !== 'you') self.act(true);
    },
    state: () => ({ round: d.round, wins: { ...d.wins }, over: d.over, winner: d.winner, bolts: d.bolts.length, windup: d.foe.windup?.spell ?? null, names: NAMES }),
    dispose() {
      wand?.take?.(null);
      wand?.setDuel?.(false);
      wand?.visible?.(true);
      veil.dispose();
      for (const g of views) g.v.dispose();
      scene.remove(group);
      foe?.dispose?.();
      stand?.traverse((o) => o.geometry?.dispose?.());
      stage.geometry.dispose();
      foeWand.geometry.dispose();
    },
  };
  return self;
}

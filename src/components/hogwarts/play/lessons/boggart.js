// The boggart in the wardrobe (quest 9, rules/boggart.js): the wardrobe at
// the back of the Defence classroom rattles, and out comes what the class
// fears, three things in turn: a dementor, a spider the size of a cart,
// Professor Snape. Riddikulus is a joke, the right one by what the thing
// is: three are offered (1, 2 or 3, or a click), its own and two meant for
// the others. The right one and it goes ridiculous in a puff and the class
// laughs; a wrong one and it comes a step closer; three steps and you’ve
// backed out of the room (E to go in again). All three, ten points.
//
//   create(ctx, at) → { step, act(down), pick(n), state(), over, dispose() }
//   tells the page 'choices' { title, options: [{ n, text }] } (null when none)

import * as THREE from 'three';
import { BOGGART, THINGS, again, boggartBot, choices, choose, current, newBoggart } from '../../rules/boggart';
import { spellById } from '../../rules/spells';
import { makeProp } from '../props';
import { createSpellSounds } from '../spellSounds';
import { createVeil, frame, furniture } from './kit';

const STEP = 0.9; // m a wrong joke brings it on
const OUT = 1.2; // s it takes to come out of the wardrobe

// The boggart’s three shapes. It is a shape-shifter, not a person, so it
// is drawn here: the dementor a tattered robe with nothing in it, the
// spider a body and eight long knees; Snape is the cast lane’s figure
// when there is one (the stand-in student in black until then).
function shape(id, { house, rt, figure }) {
  const g = new THREE.Group();
  if (id === 'dementor') {
    const cloak = new THREE.ConeGeometry(0.55, 2.4, 14, 6, true);
    const p = cloak.attributes.position;
    for (let i = 0; i < p.count; i++) {
      // ragged at the hem, and narrowing to a hood
      const y = p.getY(i);
      const k = y < -0.9 ? 1 + 0.25 * Math.sin(i * 2.7) : 1;
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
    }
    cloak.computeVertexNormals();
    cloak.translate(0, 1.6, 0);
    const m = new THREE.Mesh(cloak, new THREE.MeshLambertMaterial({ color: '#16161a', side: THREE.DoubleSide }));
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8), new THREE.MeshBasicMaterial({ color: '#000000' }));
    hood.position.set(0, 2.75, 0.06);
    g.add(m, hood);
  } else if (id === 'spider') {
    const mat = new THREE.MeshLambertMaterial({ color: '#2a2420' });
    const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 10).scale(1, 0.75, 1.2), mat);
    abdomen.position.set(0, 1.1, -0.7);
    const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), mat);
    thorax.position.set(0, 1, 0.3);
    g.add(abdomen, thorax);
    // eight legs, each a knee up and a foot down
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? 1 : -1;
      const a = ((i % 4) - 1.5) * 0.45;
      const leg = new THREE.Group();
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.1, 5).translate(0, 0.55, 0), mat);
      upper.rotation.z = -side * 1.1;
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.4, 5).translate(0, -0.7, 0), mat);
      lower.position.set(side * 0.98, 0.5, 0);
      lower.rotation.z = side * 0.35;
      leg.add(upper, lower);
      leg.position.set(side * 0.25, 1, 0.3);
      leg.rotation.y = a * side;
      g.add(leg);
    }
  } else {
    const f = figure?.('snape', { height: 1.86 }) ?? null;
    if (f) {
      g.add(f.group);
      g.userData.figure = f;
    } else {
      const s = makeProp('student', { house, rt, tint: '#101012' });
      s.scale.setScalar(1.3);
      g.add(s);
    }
  }
  return g;
}

export function create(ctx, at) {
  const { scene, camera, house, rt, floorAt, cards, wand, walker, tell = () => {} } = ctx;
  const f = frame(at, floorAt);
  const group = new THREE.Group();
  group.name = 'hogwarts-lesson-boggart';
  scene.add(group);
  const sounds = createSpellSounds(rt);
  const veil = createVeil(scene);

  const wardrobe = furniture('wardrobe', { house, w: 1.3, d: 0.65, h: 2.2, colour: '#3e2b1c' });
  const home = f.put(0, 5);
  wardrobe.position.copy(home);
  wardrobe.rotation.y = f.yaw;
  group.add(wardrobe);

  let b = newBoggart({ seed: Math.floor(Math.random() * 1e6) });
  let thing = null; // { id, g, t, gone }
  let t = 0;
  let left = -1;
  let rattle = 0;
  let fade = 0; // the black of backing out, going
  // a shape gone: off the stage and its parts let go (a figure’s are its own)
  const drop = (g) => {
    group.remove(g);
    if (g.userData.figure) g.userData.figure.dispose?.();
    else
      g.traverse((o) => {
        o.geometry?.dispose?.();
        if (o.material && !o.material.vertexColors) o.material.dispose?.();
      });
  };
  const out = () => f.put(0, 5 - 1.2 - b.steps * STEP);

  const offer = () => {
    const now = current(b);
    if (!now || b.done) {
      tell('choices', null);
      return;
    }
    tell('choices', { title: `${now.name}. Riddikulus:`, options: choices(b).map((j, i) => ({ n: i + 1, text: j.text })) });
  };
  const objective = () => {
    if (b.done) ctx.objective(null);
    else if (b.fled) ctx.objective('E · go back in');
    else ctx.objective('1, 2 or 3 · the joke that fits what it is');
  };
  const comeOut = () => {
    const now = current(b);
    if (!now) return;
    if (thing) drop(thing.g);
    thing = { id: now.id, g: shape(now.id, { house, rt, figure: ctx.figure }), t: 0 };
    thing.g.position.copy(home);
    thing.g.rotation.y = f.yaw;
    group.add(thing.g);
    rattle = 0.8;
    ctx.toast(now.says);
    offer();
    objective();
  };
  // the cast keys 1 to 3 are the jokes’ while it’s out
  wand?.take?.((id) => {
    const n = spellById(id)?.key;
    if (!n || n > 3 || !current(b)) return false;
    self.pick(n);
    return true;
  });
  comeOut();

  const self = {
    over: false,
    act(down) {
      if (!down) return true;
      if (b.fled) {
        b = again(b);
        walker?.place?.([at.p[0], at.p[2]], at.yaw);
        comeOut();
      }
      return true;
    },
    pick(n) {
      const j = choices(b)[n - 1];
      if (!j || !thing || thing.gone || thing.t < OUT) return;
      wand?.flourish?.('alohomora');
      const r = choose(b, j.id);
      b = r.boggart;
      ctx.toast(r.says);
      if (r.right) {
        sounds.notes();
        thing.gone = 0.01;
        if (cards)
          for (let i = 0; i < 40; i++)
            cards.spawn({
              p: thing.g.position
                .clone()
                .setY(thing.g.position.y + 1.2)
                .toArray(),
              v: [(Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3],
              life: 0.9,
              size: 0.12,
              colour: new THREE.Color().setHSL(Math.random(), 0.8, 0.6).multiplyScalar(2),
              drag: 2,
            });
        if (b.done) {
          ctx.points(BOGGART.points, 'boggart');
          ctx.done();
          left = 5;
          tell('choices', null);
        }
      } else {
        sounds.hit('hit');
        if (b.fled) {
          // backed out: a step or three back from the wardrobe, the thing gone in again
          fade = 0.6;
          walker?.place?.([f.put(0, -2.5).x, f.put(0, -2.5).z], at.yaw);
          if (thing) drop(thing.g);
          thing = null;
          tell('choices', null);
        }
      }
      objective();
    },
    step(dt) {
      t += dt;
      rattle = Math.max(0, rattle - dt);
      wardrobe.rotation.z = rattle > 0 ? Math.sin(t * 60) * 0.02 : 0;
      if (thing) {
        thing.t += dt;
        // out of the wardrobe and up to where it stands, a step closer for each wrong joke
        const k = Math.min(1, thing.t / OUT);
        const want = home.clone().lerp(out(), k * k * (3 - 2 * k));
        thing.g.position.lerp(want, Math.min(1, dt * 6));
        if (thing.id === 'dementor') thing.g.position.y += 0.3 + Math.sin(t * 1.3) * 0.1;
        if (thing.id === 'dementor' && cards && Math.random() < dt * 30)
          cards.spawn({
            p: thing.g.position
              .clone()
              .add(new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 0.5, (Math.random() - 0.5) * 1.5))
              .toArray(),
            v: [0, -0.1, 0],
            life: 1.4,
            size: 0.5,
            colour: new THREE.Color(0.5, 0.6, 0.7).multiplyScalar(0.12),
            grow: 0.6,
            drag: 0.5,
          });
        // laughed off: it spins, shrinks and pops
        if (thing.gone) {
          thing.gone += dt;
          thing.g.rotation.y += dt * 14;
          thing.g.scale.setScalar(Math.max(0.01, 1 - thing.gone * 1.3));
          if (thing.gone > 0.8) {
            drop(thing.g);
            thing = null;
            if (!b.done) comeOut();
          }
        }
      }
      fade = Math.max(0, fade - dt * 0.5);
      veil.set(fade);
      veil.update(camera);
      if (left > 0 && (left -= dt) <= 0) self.over = true;
      return true;
    },
    // the bot: it knows what each thing is
    bot() {
      if (b.fled) return self.act(true);
      const id = boggartBot(b);
      const n = choices(b).findIndex((j) => j.id === id) + 1;
      if (n > 0) self.pick(n);
    },
    state: () => ({ at: b.at, steps: b.steps, fled: b.fled, done: b.done, thing: current(b)?.id ?? null, out: thing ? Math.min(1, thing.t / OUT) : 0, things: THINGS.length }),
    dispose() {
      wand?.take?.(null);
      tell('choices', null);
      veil.dispose();
      if (thing) drop(thing.g);
      scene.remove(group);
      wardrobe.geometry.dispose();
    },
  };
  return self;
}

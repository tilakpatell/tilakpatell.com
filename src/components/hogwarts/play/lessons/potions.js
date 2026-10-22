// Potions, a Cure for Boils (quest 4, rules/potions.js): a cauldron on its
// fire, the jars on the bench, the board with the recipe in chalk, Snape at
// the front. Look at a thing and E: a jar goes in, the cauldron gets a
// stir (clockwise), the fire is stoked while E is held and settles at the
// heat you let go on (a tap puts it out). The brew takes each step’s colour;
// a move off the board melts the cauldron, green-black and smoking, and
// Snape takes five points; the board followed to the end earns ten.
//
//   create(ctx, at) → { step, act(down), state(), over, dispose() }

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { CURE_FOR_BOILS, HEATS, INGREDIENTS, SNAPE, colourOf, move, newBrew, next, potionsBot } from '../../rules/potions';
import { makeProp } from '../props';
import { createSpellSounds } from '../spellSounds';
import { aimed, createBoard, frame, furniture } from './kit';

const WHO = 'Professor Snape';
const STOKE = 0.55; // s of E held a notch of heat
const JARS = ['eyes', 'nettles', 'slugs', 'quills', 'fangs', 'bezoar', 'mucus']; // (on the bench in this order: the board’s are not in its)

export function create(ctx, at) {
  const { scene, camera, house, houseName = 'gryffindor', rt, floorAt, said, cards } = ctx;
  const f = frame(at, floorAt);
  const group = new THREE.Group();
  group.name = 'hogwarts-lesson-potions';
  scene.add(group);
  const sounds = createSpellSounds(rt);
  const House = houseName[0].toUpperCase() + houseName.slice(1);

  // the cauldron a step and a half ahead, on its fire; the bench of jars to
  // your left; the board beyond the cauldron; Snape at it
  const cauldron = makeProp('cauldron', { house, rt });
  cauldron.position.copy(f.put(0, 2.1, 0.25));
  group.add(cauldron);
  const brew = cauldron.userData.parts?.brew ?? null;
  const fire = new THREE.Object3D();
  fire.position.copy(f.put(0, 2.1, 0.1));
  group.add(fire);
  const bench = furniture('bench', { house, w: 2.4, d: 0.55, h: 0.85 });
  bench.position.copy(f.put(-1.9, 1.4));
  bench.rotation.y = f.yaw + Math.PI / 2;
  group.add(bench);
  const glass = new MeshBasicNodeMaterial({ color: new THREE.Color(0.7, 0.8, 0.85), transparent: true, opacity: 0.35, depthWrite: false });
  const jarG = new THREE.CylinderGeometry(0.09, 0.09, 0.24, 12).translate(0, 0.12, 0);
  const fillG = new THREE.CylinderGeometry(0.08, 0.08, 0.16, 12).translate(0, 0.09, 0);
  const jars = JARS.map((id, i) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(jarG, glass));
    const fill = new THREE.Mesh(fillG, new MeshBasicNodeMaterial({ color: new THREE.Color(INGREDIENTS[id].colour).multiplyScalar(0.8) }));
    g.add(fill);
    g.position.copy(f.put(-1.9, 1.4 + (i - 3) * 0.32, 0.88));
    group.add(g);
    return { id, kind: 'jar', object: g, p: g.position.toArray(), r: 0.12 };
  });
  const board = createBoard({ w: 1.8, h: 1.25, title: CURE_FOR_BOILS.name });
  board.mesh.position.copy(f.put(0, 4.2, 1.6));
  board.mesh.rotation.y = f.yaw;
  group.add(board.mesh);
  const head = f.put(0.9, 3.8, 2.1);
  const snape = ctx.figure?.('snape', { height: 1.86 }) ?? null;
  if (snape) {
    snape.group.position.copy(f.put(0.9, 3.8));
    snape.group.rotation.y = f.yaw;
    group.add(snape.group);
  }
  const fireLight = new THREE.PointLight(0xff8a3a, 0, 6, 2);
  fireLight.position.copy(fire.position).add(new THREE.Vector3(0, 0.3, 0));
  group.add(fireLight);

  let b = newBrew(CURE_FOR_BOILS);
  let heat = 'off'; // the fire as it burns (the brew’s heat, or the one being stoked to)
  let stoke = null; // { t } while E is held on the fire
  let stir = 0; // the ladle’s turn, for the drawing
  let t = 0;
  let left = -1;
  let melted = 0; // s since the cauldron melted
  const lines = CURE_FOR_BOILS.board.map((s) => s.says);
  const say = (text) => text && said?.say(WHO, text.replace('{house}', House), head);
  const objective = () => {
    const want = next(b);
    ctx.objective(b.done ? null : b.melted ? 'E · a fresh cauldron' : want ? `Look at the jar, the cauldron or the fire, and E · ${want.says}` : null);
    board.draw(lines, b.step);
  };
  say('There will be no foolish wand-waving here. Read the board.');
  objective();

  const things = () => [
    ...jars,
    {
      id: 'cauldron',
      kind: 'cauldron',
      p: cauldron.position
        .clone()
        .setY(cauldron.position.y + 0.6)
        .toArray(),
      r: 0.45,
    },
    { id: 'fire', kind: 'fire', p: fire.position.toArray(), r: 0.35 },
  ];
  const apply = (m) => {
    const r = move(b, m);
    b = r.brew;
    if (r.melted) {
      melted = 0.01;
      sounds.hit('hit');
      ctx.points(r.points, 'potions');
      say(SNAPE.melted);
    } else if (r.ok) {
      if (m.do === 'add') sounds.cast({ kind: 'summon' });
      if (r.done) {
        sounds.notes();
        ctx.points(r.points, 'potions');
        ctx.done();
        say(SNAPE.done);
        left = 5;
      }
    }
    objective();
    return r;
  };

  const self = {
    over: false,
    act(down) {
      if (b.done) return true;
      if (b.melted) {
        if (down) {
          b = newBrew(CURE_FOR_BOILS);
          heat = 'off';
          melted = 0;
          objective();
        }
        return true;
      }
      const on = aimed(camera, things(), 4);
      if (down) {
        if (!on) return false;
        if (on.kind === 'jar') apply({ do: 'add', what: on.id });
        else if (on.kind === 'cauldron') {
          stir += Math.PI * 2;
          apply({ do: 'stir', dir: 'cw' });
        } else if (on.kind === 'fire') stoke = { t };
        return true;
      }
      // let go on the fire: a tap puts it out, a hold leaves it where it got to
      if (stoke) {
        const held = t - stoke.t;
        stoke = null;
        const to = held < STOKE * 0.5 ? 'off' : stokedTo(held);
        if (to !== b.heat) apply({ do: 'heat', to });
        heat = b.heat;
      }
      return true;
    },
    step(dt) {
      t += dt;
      // stoking: the flame climbs a notch every so long while E is held
      if (stoke) heat = stokedTo(t - stoke.t);
      const k = HEATS.indexOf(heat) / (HEATS.length - 1);
      fireLight.intensity = k * (2.2 + Math.sin(t * 13) * 0.3);
      if (cards && k > 0 && Math.random() < dt * 40 * k) {
        const hot = Math.random();
        cards.spawn({
          p: [fire.position.x + (Math.random() - 0.5) * 0.4, fire.position.y, fire.position.z + (Math.random() - 0.5) * 0.4],
          v: [0, 0.4 + hot * 0.5 * k, 0],
          life: 0.45,
          size: 0.1 + 0.1 * k,
          colour: new THREE.Color(hot > 0.5 ? '#ffb347' : '#ff5a1f').multiplyScalar(2),
          grow: -0.6,
        });
      }
      // the brew: its colour, its steam (and smoke once melted), the ladle’s stir
      if (brew) brew.material.color.lerp(new THREE.Color(colourOf(b)), Math.min(1, dt * 3));
      stir = Math.max(0, stir - dt * 9);
      if (brew) brew.rotation.y += Math.min(stir, 9) * dt;
      if (melted > 0) {
        melted += dt;
        cauldron.scale.set(1 + Math.min(0.2, melted * 0.1), Math.max(0.55, 1 - melted * 0.25), 1 + Math.min(0.2, melted * 0.1));
      } else cauldron.scale.setScalar(1);
      if (cards && Math.random() < dt * (melted > 0 ? 30 : 8)) {
        const top = cauldron.position.clone().setY(cauldron.position.y + 0.75);
        const c = melted > 0 ? new THREE.Color(0.2, 0.3, 0.12) : new THREE.Color(colourOf(b)).lerp(new THREE.Color(1, 1, 1), 0.6);
        cards.spawn({ p: [top.x + (Math.random() - 0.5) * 0.3, top.y, top.z + (Math.random() - 0.5) * 0.3], v: [0, 0.5, 0], life: 1.6, size: 0.25, colour: c.multiplyScalar(0.35), grow: 0.8, drag: 0.5 });
      }
      if (left > 0 && (left -= dt) <= 0) self.over = true;
      return true;
    },
    // the bot’s hands: the board’s next move, made straight
    bot() {
      const m = potionsBot(b);
      if (!m) return;
      apply(m);
      heat = b.heat;
    },
    state: () => ({ step: b.step, heat: b.heat, stirs: b.stirs, melted: b.melted, done: b.done, colour: colourOf(b) }),
    dispose() {
      scene.remove(group);
      snape?.dispose?.();
      board.dispose();
      for (const g of [jarG, fillG]) g.dispose();
      glass.dispose();
      bench.geometry.dispose();
      cauldron.traverse((o) => o.geometry?.dispose?.());
    },
  };
  return self;
}

// the heat a hold of E on the fire has stoked it to
function stokedTo(held) {
  const notch = Math.min(HEATS.length - 1, 1 + Math.floor(held / STOKE));
  return HEATS[notch];
}

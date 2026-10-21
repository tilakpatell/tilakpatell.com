// The wand in your hand and what comes out of it (the design’s §4.5): the
// rules are rules/spells.js’s, and this draws them. First person (there is
// no figure of you yet: the cast lane’s), so the wand is held low on the
// right of the view, flicked for a flick (Lumos, Leviosa, Alohomora,
// Protego) and thrust for a push (the rest), its tip a light that flashes
// on a cast and stays lit for Lumos, a trail of cards in the spell’s colour
// behind it. Leviosa lifts a thing and carries it on the wand’s line while
// the key is held, and drops it when it’s let go; Alohomora opens a chest or
// a door that may be opened; Accio pulls a thing to your hand; Incendio
// lights a brazier, a torch, a fire or a cauldron (a flame and a light);
// Expelliarmus and Stupefy are bolts, hit-tested against figures and
// shields; Protego is a dome round you for a second that throws a bolt back
// on the beat; Expecto Patronum runs out ahead of you in your house’s shape.
//
//   WAND_KEYS → the codes the wand binds, beside the walk’s
//   createWand({ rt, scene, camera, house, houseName, learnt, floorAt, tell, feel, people })
//     → { step(dt, input), cast(id, at), choose(id), place(things), add(thing),
//         things, state(), body(), take(fn), flourish(id), tip(), dispose() }
//   take(fn): a lesson that has the wand’s keys (the duel, the boggart): a
//     cast key pressed asks fn(id) first, and if it says it has it the
//     wand only flourishes (the move, the flash, the sound, Protego’s dome)
//     and the lesson does the rest; take(null) gives the keys back
//
// A thing: { id, kind, object (a THREE.Object3D, its feet at its
// position), r, locked, allowed, why, lit, fire (an Object3D, the flame’s
// seat) }. `people()` lists the figures a bolt can hit and a spell can be
// cast at: [{ id, p, r, h, shield }]. What it tells the page (`tell(type,
// data)`): 'spell' { id, word }, 'toast' { text }, 'points' { type:
// 'points', house, delta, why }, 'wand' { active, cooling, lit } a few
// times a second, 'wheel' { open }, and for the other lanes 'dropped' { id,
// kind, p }, 'pulled' { id, kind }, 'opened' { id }, 'lit' { id, kind },
// 'bolt' { spell, on, how, by }, 'patronus' { shape, p, dir }.

import * as THREE from 'three';
import { SHIELD, SPELLS, at, cast as castRule, kindsFor, newBolt, newWand, pick, release, shieldOf, spellById, spellByKey, stepBolt } from '../rules/spells';
import { createBolt, createCards, createDome, createFigure, createLights } from './glow';
import { SHAPES } from './silhouettes';
import { createSpellSounds } from './spellSounds';
import { wandGeometry } from './props';

export const WAND_KEYS = {
  ...Object.fromEntries(SPELLS.map((s) => [`spell${s.key}`, [`Digit${s.key}`, `Numpad${s.key}`]])),
  cast: ['KeyF'],
  wheel: ['KeyQ'],
};

const HOLD = { x: 0.22, y: -0.24, z: -0.5 }; // the wand’s grip in the camera’s frame
const CLICK = { px: 6, ms: 350 }; // a press and let go, not a drag: a cast
const READOUT = 0.12; // s between the wand’s word to the HUD
const RUN = 4.5; // s the Patronus runs
const PULL = 0.7; // s Accio takes
const GRAVITY = 9.81;

const col = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);

export function createWand({ rt, scene, camera, house, houseName = 'gryffindor', learnt = [], floorAt = () => 0, tell = () => {}, feel = null, people = () => [], wood } = {}) {
  let wand = newWand({ house: houseName, learnt });
  let t = 0;
  let active = 'lumos';
  let holding = null; // { id, code } while a cast key is down
  let wheel = false;
  let readout = 0;
  let click = null; // a press of the pointer that may be a click
  let touchHeld = false; // the touch Cast button, held
  let taker = null; // a lesson that has the cast keys: fn(id) → it took the cast
  const sounds = createSpellSounds(rt);
  const things = new Map();

  // the wand in the view
  const grip = new THREE.Group();
  const wandMesh = new THREE.Mesh(wandGeometry(wood), house?.material ? house.material({ vertexColors: true }) : new THREE.MeshLambertMaterial({ vertexColors: true }));
  wandMesh.rotation.set(0.14, Math.PI + 0.2, 0); // (its tip at +z: turned to point ahead, up a little and in, toward the middle of the view)
  grip.add(wandMesh);
  const tipLocal = new THREE.Vector3(0, 0, 0.255).applyEuler(wandMesh.rotation);
  scene.add(grip);
  const tipLight = new THREE.PointLight(0xfff1c9, 0, 16, 2);
  scene.add(tipLight);
  let move = null; // { kind: 'flick' | 'push', t }
  const tip = new THREE.Vector3();
  const eye = new THREE.Vector3();
  const aim = new THREE.Vector3();
  let flash = 0;
  let flashColour = new THREE.Color();

  const cards = createCards({ count: 900, parent: scene });
  const lights = createLights(scene, 3);
  const dome = createDome({ radius: 1.25 });
  scene.add(dome.mesh);
  let domeLeft = 0;
  let ripple = 2;
  const bolts = []; // { b (rules), view, light }
  const runs = []; // the Patronus: { fig, p, yaw, t, shape }
  const pulls = []; // { thing, from, t }
  const fires = []; // { thing, light, left }

  const say = (text) => text && tell('toast', { text });
  const kindAt = (id) => things.get(id) ?? null;
  const posOf = (th) => {
    const p = th.object.position;
    return [p.x, p.y + (th.mid ?? 0.2), p.z];
  };
  const listFor = (spell) => {
    const kinds = kindsFor(spell);
    const list = [];
    for (const th of things.values()) if (!th.gone && kinds.includes(th.kind)) list.push({ id: th.id, kind: th.kind, p: posOf(th), r: th.r ?? 0.3, locked: th.locked, allowed: th.allowed, why: th.why, lit: th.lit });
    if (kinds.includes('person')) for (const f of people()) list.push({ id: f.id, kind: 'person', p: [f.p[0], f.p[1] + 1.2, f.p[2]], r: 0.4 });
    return list;
  };

  // the cast’s trail: cards from the tip, in the spell’s colour
  const sparkle = (p, colour, n = 6, speed = 1.2, life = 0.45, size = 0.06) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI - Math.PI / 2;
      cards.spawn({ p: [p.x ?? p[0], p.y ?? p[1], p.z ?? p[2]], v: [Math.cos(a) * Math.cos(b) * speed, Math.sin(b) * speed + 0.3, Math.sin(a) * Math.cos(b) * speed], life: life * (0.6 + Math.random() * 0.6), size: size * (0.7 + Math.random() * 0.6), colour, drag: 2.5, grow: 0.5 });
    }
  };

  // the cast’s look and sound, nothing more: a lesson’s own spell
  function flourish(id) {
    const spell = spellById(id);
    if (!spell) return;
    active = id;
    move = { kind: spell.move, t: 0 };
    flash = 1;
    flashColour = col(spell.colour);
    sounds.cast(spell);
    tell('spell', { id, word: spell.word });
    if (spell.kind === 'shield') {
      camera.getWorldDirection(aim);
      domeLeft = SHIELD.up;
      ripple = 0;
      dome.set({ alpha: 1, ripple: 0, at: aim });
    }
  }

  function cast(id, target = undefined) {
    const spell = spellById(id);
    if (!spell) return null;
    if (taker && target === undefined && taker(id)) {
      flourish(id);
      return null;
    }
    active = id;
    camera.getWorldPosition(eye);
    camera.getWorldDirection(aim);
    // the target: given (the dev hook: a thing’s id or a point), or what the wand points at
    let tg = null;
    let point = null;
    if (typeof target === 'string') {
      const th = kindAt(target);
      if (th) tg = { id: th.id, kind: th.kind, p: posOf(th), r: th.r, locked: th.locked, allowed: th.allowed, why: th.why, lit: th.lit, dist: eye.distanceTo(new THREE.Vector3(...posOf(th))) };
      else {
        const f = people().find((x) => x.id === target);
        if (f) tg = { id: f.id, kind: 'person', p: [f.p[0], f.p[1] + 1.2, f.p[2]], dist: Math.hypot(f.p[0] - eye.x, f.p[1] + 1.2 - eye.y, f.p[2] - eye.z) };
      }
    } else if (Array.isArray(target)) point = target;
    else tg = pick(listFor(spell), eye.toArray(), aim.toArray(), { range: spell.range || 30, kinds: kindsFor(spell) });
    if (tg) point = tg.p;
    const r = castRule(at(wand, t), spell, tg);
    wand = r.wand;
    const ok = !r.effects.some((e) => e.type === 'fizzle');
    if (ok) {
      move = { kind: spell.move, t: 0 };
      flash = 1;
      flashColour = col(spell.colour);
      sounds.cast(spell);
      tell('spell', { id, word: r.effects.find((e) => e.type === 'light')?.word ?? spell.word });
    }
    for (const e of r.effects) effect(e, spell, tg, point);
    if (r.points < 0) tell('points', { type: 'points', house: houseName, delta: r.points, why: r.why });
    return r;
  }

  function effect(e, spell, tg, point) {
    const c = col(spell.colour, 2);
    switch (e.type) {
      case 'fizzle':
        sounds.fizzle();
        say(e.say);
        for (let i = 0; i < 5; i++) cards.spawn({ p: tip.toArray(), v: [(Math.random() - 0.5) * 0.3, 0.5, (Math.random() - 0.5) * 0.3], life: 0.9, size: 0.08, colour: col('#8a8a8a', 0.4), grow: 2, drag: 1 });
        break;
      case 'light':
        // (the light itself is stepped below; a burst of it as it comes)
        sparkle(tip, col(spell.colour, e.on ? 3 : 1), e.on ? 14 : 5, 0.8);
        break;
      case 'lift': {
        const th = kindAt(e.id);
        if (th) {
          th.held = true;
          th.reach = Math.min(8, Math.max(1.6, tg?.dist ?? 3));
          th.v = [0, 0, 0];
          sparkle(posOf(th), c, 16, 1.5);
        }
        break;
      }
      case 'drop':
        drop(e.id);
        break;
      case 'refuse':
        say(e.say);
        if (point) sparkle(point, col('#ff5a3a', 2), 10, 1);
        break;
      case 'open': {
        const th = kindAt(e.id);
        if (th) {
          th.locked = false;
          th.opening = 0;
          sparkle(posOf(th), col('#ffd36e', 3), 24, 1.6);
          tell('opened', { id: th.id, kind: th.kind });
        }
        break;
      }
      case 'pull': {
        const th = kindAt(e.id);
        if (th) {
          pulls.push({ thing: th, from: th.object.position.clone(), t: 0 });
          th.held = false;
          sounds.whoosh(1.4);
        }
        break;
      }
      case 'ignite': {
        const th = kindAt(e.id);
        if (th) light(th, e.lasts);
        break;
      }
      case 'bolt': {
        const to = point ?? [eye.x + aim.x * 30, eye.y + aim.y * 30, eye.z + aim.z * 30];
        const b = newBolt(spell, tip.toArray(), to, 'me');
        const view = createBolt(spell.colour);
        scene.add(view.group);
        bolts.push({ b, view, light: lights.take(), colour: col(spell.colour, 2.5) });
        feel?.punch?.(1.5);
        break;
      }
      case 'shield':
        // (it goes up from the wand: a ring of light running out over the dome from in front)
        domeLeft = SHIELD.up;
        ripple = 0;
        dome.set({ alpha: 1, ripple: 0, at: aim });
        sounds.hum();
        break;
      case 'patronus':
        patronus(e.shape);
        break;
      case 'wisp':
        say('Only a silver mist. You haven’t learnt that one yet.');
        for (let i = 0; i < 30; i++) cards.spawn({ p: tip.toArray(), v: [aim.x * 1.5 + (Math.random() - 0.5), aim.y * 1.5 + Math.random() * 0.4, aim.z * 1.5 + (Math.random() - 0.5)], life: 1.6, size: 0.12, colour: col('#e6f2ff', 1.4), grow: 3, drag: 1.2 });
        break;
      case 'flash':
        if (point) sparkle(point, c, 14, 1.4);
        break;
      case 'misdeed':
        say(`${e.say} ${Math.abs(e.cost)} points from ${houseName[0].toUpperCase()}${houseName.slice(1)}.`);
        break;
      default:
    }
  }

  function drop(id) {
    const th = kindAt(id);
    if (!th) return;
    th.held = false;
    th.falling = true;
    th.v = th.v ?? [0, 0, 0];
  }

  function light(th, lasts) {
    th.lit = true;
    const seat = th.fire ?? th.object;
    const l = lights.take();
    if (l) {
      l.color.set(0xff9a4a);
      l.distance = 12;
    }
    fires.push({ thing: th, seat, light: l, left: lasts });
    tell('lit', { id: th.id, kind: th.kind });
  }

  function patronus(shape) {
    const s = SHAPES[shape] ?? SHAPES.stag;
    const fig = createFigure(s, { parent: scene, colour: '#dcecff', size: shape === 'stag' ? 0.12 : 0.09 });
    const yaw = Math.atan2(aim.x, aim.z);
    const p = new THREE.Vector3(eye.x + aim.x * 1.2, 0, eye.z + aim.z * 1.2);
    p.y = floorAt(p.x, p.z);
    runs.push({ fig, p, yaw, t: 0, shape: s });
    tell('patronus', { shape, p: p.toArray(), dir: [Math.sin(yaw), 0, Math.cos(yaw)] });
  }

  // the body a foe’s bolt is tested against: you, under the camera
  const body = () => {
    camera.getWorldPosition(eye);
    return { id: 'me', p: [eye.x, eye.y - 1.55, eye.z], r: 0.35, h: 1.75, shield: shieldOf(at(wand, t)) };
  };

  function placeWand(dt) {
    // the grip off the camera, with the cast’s move and a little breathing
    let px = HOLD.x;
    let py = HOLD.y + Math.sin(t * 1.3) * 0.004;
    let pz = HOLD.z;
    let pitch = 0;
    let roll = 0;
    if (move) {
      move.t += dt;
      const k = move.t;
      if (move.kind === 'flick') {
        // up and back on the swish, then the snap down and out
        if (k < 0.16) pitch = (k / 0.16) * 0.55;
        else if (k < 0.26) pitch = 0.55 - ((k - 0.16) / 0.1) * 0.95;
        else pitch = -0.4 * Math.max(0, 1 - (k - 0.26) / 0.3);
        px -= Math.sin(Math.min(1, k / 0.3) * Math.PI) * 0.05;
        roll = Math.sin(Math.min(1, k / 0.3) * Math.PI) * 0.4;
      } else {
        const out = k < 0.1 ? k / 0.1 : Math.max(0, 1 - (k - 0.1) / 0.3);
        pz -= out * 0.14;
        py += out * 0.03;
        pitch = -out * 0.15;
      }
      if (k > 0.6) move = null;
    }
    grip.position.set(px, py, pz).applyQuaternion(camera.quaternion).add(camera.position);
    grip.quaternion.copy(camera.quaternion);
    grip.rotateX(pitch);
    grip.rotateZ(roll);
    grip.updateMatrixWorld(true);
    tip.copy(tipLocal).applyMatrix4(grip.matrixWorld);
  }

  function step(dt, input) {
    t += dt;
    wand = at(wand, t);
    // the keys: 1 to 9 a spell straight, F (or a click) the one on the wand, Q the wheel
    if (input) {
      for (const s of SPELLS) {
        const codes = WAND_KEYS[`spell${s.key}`];
        const code = codes.find((c) => input.pressed?.has?.(c));
        if (code) {
          cast(s.id);
          holding = { id: s.id, code };
        }
      }
      if (WAND_KEYS.cast.some((c) => input.pressed?.has?.(c))) {
        cast(active);
        holding = { id: active, code: 'KeyF' };
      }
      const p = input.pointer;
      if (p?.down && !click) click = { at: t, moved: 0 };
      if (click && p?.drag) click.moved += Math.abs(p.drag.dx) + Math.abs(p.drag.dy);
      if (click && !p?.down) {
        if (click.moved < CLICK.px && t - click.at < CLICK.ms / 1000) cast(active);
        click = null;
      }
      if (holding && !(holding.code === 'touch' ? touchHeld : input.keys?.has?.(holding.code))) {
        if (holding.id === 'leviosa' && wand.held) {
          const r = release(wand);
          wand = r.wand;
          for (const e of r.effects) effect(e, spellById('leviosa'), null, null);
        }
        holding = null;
      }
      const w = WAND_KEYS.wheel.some((c) => input.keys?.has?.(c));
      if (w !== wheel) {
        wheel = w;
        tell('wheel', { open: wheel });
      }
    }
    placeWand(dt);
    camera.getWorldPosition(eye);
    camera.getWorldDirection(aim);

    // the tip’s light: Lumos, and the flash of any cast
    flash = Math.max(0, flash - dt * 5);
    const lumos = wand.lit ? 3.2 : 0;
    tipLight.position.copy(tip);
    tipLight.intensity = lumos + flash * 4;
    if (flash > 0.01 && !wand.lit) tipLight.color.copy(flashColour).multiplyScalar(0.5);
    else tipLight.color.set(0xfff1c9);
    if (wand.lit && Math.random() < dt * 30) cards.spawn({ p: tip.toArray(), v: [0, 0.05, 0], life: 0.25, size: 0.07, colour: col('#fff1c9', 2.2), grow: 0.3 });
    if (move && move.t < 0.35) {
      const sp = spellById(active);
      cards.spawn({ p: tip.toArray(), v: [(Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2], life: 0.4, size: 0.05, colour: col(sp.colour, 2.4), grow: -0.5, drag: 3 });
    }

    stepThings(dt);
    stepBolts(dt);
    stepFires(dt);
    stepRuns(dt);

    // Protego’s dome, round your head and shoulders
    domeLeft = Math.max(0, domeLeft - dt);
    ripple = Math.min(2, ripple + dt * 3);
    dome.mesh.position.set(eye.x, eye.y - 0.4, eye.z);
    dome.set({ alpha: domeLeft > 0 ? Math.min(1, domeLeft * 4) * (shieldOf(wand) === 'beat' ? 1 : 0.6) : 0, ripple });

    cards.update(dt, camera);
    readout -= dt;
    if (readout <= 0) {
      readout = READOUT;
      tell('wand', { active, cooling: Object.fromEntries(SPELLS.map((s) => [s.id, Math.max(0, (wand.ready[s.id] ?? 0) - t) / s.cooldown])), lit: wand.lit, learnt: wand.learnt });
    }
  }

  function stepThings(dt) {
    for (const th of things.values()) {
      const o = th.object;
      if (th.held) {
        // carried on the wand’s line, bobbing, turning slowly
        const want = new THREE.Vector3().copy(eye).addScaledVector(aim, th.reach);
        want.y = Math.max(want.y, floorAt(want.x, want.z) + 0.3) - (th.mid ?? 0.2) + Math.sin(t * 2.2) * 0.05;
        o.position.lerp(want, Math.min(1, dt * 6));
        o.rotation.y += dt * 0.6;
        if (Math.random() < dt * 20) sparkle(posOf(th), col('#b9e4ff', 2), 1, 0.3, 0.6, 0.05);
        // the charm’s thread, tip to thing: motes along a line that sags a
        // little and shivers, and a faint halo round what it holds
        const at = posOf(th);
        for (let k = 0; k < 3; k++) {
          const f = Math.random();
          const sag = Math.sin(f * Math.PI) * 0.12;
          cards.spawn({ p: [tip.x + (at[0] - tip.x) * f, tip.y + (at[1] - tip.y) * f - sag, tip.z + (at[2] - tip.z) * f], v: [(Math.random() - 0.5) * 0.08, 0.04, (Math.random() - 0.5) * 0.08], life: 0.22, size: 0.035, colour: col('#b9e4ff', 2.4), grow: -1 });
        }
        if (Math.random() < dt * 12) cards.spawn({ p: at, v: [0, 0, 0], life: 0.5, size: (th.r ?? 0.3) * 3.2, colour: col('#9fd0ff', 0.16), grow: 0.3 });
      } else if (th.falling) {
        th.v[1] -= GRAVITY * dt;
        o.position.y += th.v[1] * dt;
        const floor = floorAt(o.position.x, o.position.z);
        if (o.position.y <= floor) {
          o.position.y = floor;
          const hard = -th.v[1];
          th.v[1] = hard > 2 ? hard * 0.25 : 0;
          if (th.v[1] === 0) {
            th.falling = false;
            tell('dropped', { id: th.id, kind: th.kind, p: o.position.toArray() });
          }
          if (hard > 3) sounds.hit('blocked');
        }
      }
      if (th.opening != null && th.opening < 1) {
        th.opening = Math.min(1, th.opening + dt * 1.6);
        const lid = th.object.userData.parts?.lid;
        if (lid) lid.rotation.x = -th.opening * 1.9;
      }
      // the Snitch’s wings beat whatever else it is doing
      const wings = o.userData.parts?.wings;
      if (wings) wings.forEach((w, i) => (w.rotation.x = Math.sin(t * 60 + i) * 0.9));
    }
    for (let i = pulls.length - 1; i >= 0; i--) {
      const pl = pulls[i];
      pl.t += dt / PULL;
      const k = Math.min(1, pl.t);
      const hand = new THREE.Vector3().copy(eye).addScaledVector(aim, 0.9);
      hand.y -= 0.35;
      const o = pl.thing.object;
      o.position.lerpVectors(pl.from, hand, k * k * (3 - 2 * k));
      o.position.y += Math.sin(k * Math.PI) * 1.2;
      if (Math.random() < dt * 30) sparkle(posOf(pl.thing), col('#8fd3ff', 2), 1, 0.3, 0.5, 0.05);
      if (k >= 1) {
        pulls.splice(i, 1);
        pl.thing.falling = true;
        pl.thing.v = [0, 0, 0];
        tell('pulled', { id: pl.thing.id, kind: pl.thing.kind });
      }
    }
  }

  function stepBolts(dt) {
    const bodies = [...people().map((f) => ({ id: f.id, p: f.p, r: f.r ?? 0.35, h: f.h ?? 1.7, shield: f.shield ?? null })), body()];
    for (let i = bolts.length - 1; i >= 0; i--) {
      const bo = bolts[i];
      const was = bo.b.p;
      const r = stepBolt(bo.b, dt, bodies);
      bo.b = r.bolt;
      const p = new THREE.Vector3(...bo.b.p);
      bo.view.group.position.copy(p);
      bo.view.group.lookAt(p.x + bo.b.v[0], p.y + bo.b.v[1], p.z + bo.b.v[2]);
      if (bo.light) {
        bo.light.position.copy(p);
        bo.light.color.copy(bo.colour).multiplyScalar(0.4);
        bo.light.intensity = 3;
        bo.light.distance = 8;
      }
      // the trail behind it
      for (let k = 0; k < 3; k++) {
        const f = k / 3;
        // (and a fainter, wider haze round the line)
        if (k === 0) cards.spawn({ p: [...bo.b.p], v: [0, 0, 0], life: 0.25, size: 0.4, colour: bo.colour.clone().multiplyScalar(0.18), grow: 0.5, drag: 0 });
        cards.spawn({ p: [was[0] + (bo.b.p[0] - was[0]) * f, was[1] + (bo.b.p[1] - was[1]) * f, was[2] + (bo.b.p[2] - was[2]) * f], v: [(Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4], life: 0.35, size: 0.09, colour: bo.colour, grow: -0.4, drag: 3 });
      }
      if (r.hit) {
        sparkle(r.hit.p, bo.colour, 24, 3, 0.5, 0.08);
        sounds.hit(r.hit.how);
        tell('bolt', { spell: bo.b.spell, on: r.hit.id, how: r.hit.how, by: bo.b.owner });
        if (r.hit.how === 'back' || (r.hit.id === 'me' && r.hit.how === 'blocked')) {
          ripple = 0;
          dome.set({ alpha: 1, ripple: 0, at: new THREE.Vector3(...r.hit.p).sub(dome.mesh.position) });
        }
        if (r.hit.id === 'me' && r.hit.how === 'hit') feel?.trauma?.(0.6);
        if (r.hit.how !== 'back') bo.b = { ...bo.b, life: 0 };
      }
      if (bo.b.life <= 0) {
        scene.remove(bo.view.group);
        bo.view.dispose();
        lights.give(bo.light);
        bolts.splice(i, 1);
      }
    }
  }

  function stepFires(dt) {
    const p = new THREE.Vector3();
    for (let i = fires.length - 1; i >= 0; i--) {
      const f = fires[i];
      f.left -= dt;
      f.seat.getWorldPosition(p);
      const dying = Number.isFinite(f.left) ? Math.min(1, f.left / 1.5) : 1;
      if (f.light) {
        f.light.position.set(p.x, p.y + 0.3, p.z);
        f.light.intensity = (2.4 + Math.sin(t * 17) * 0.4 + Math.sin(t * 7.3) * 0.3) * dying;
      }
      // the flame: cards rising off the seat, yellow at the root, red as they go
      const n = Math.random() < dt * 60 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const hot = Math.random();
        cards.spawn({ p: [p.x + (Math.random() - 0.5) * 0.2, p.y, p.z + (Math.random() - 0.5) * 0.2], v: [(Math.random() - 0.5) * 0.15, 0.6 + hot * 0.4, (Math.random() - 0.5) * 0.15], life: 0.55, size: (0.16 + hot * 0.1) * dying, colour: col(hot > 0.5 ? '#ffb347' : '#ff5a1f', 2.2 * dying), grow: -0.6, drag: 0.5, rise: 0.5 });
      }
      if (f.left <= 0) {
        f.thing.lit = false;
        lights.give(f.light);
        fires.splice(i, 1);
      }
    }
  }

  function stepRuns(dt) {
    for (let i = runs.length - 1; i >= 0; i--) {
      const r = runs[i];
      r.t += dt;
      const s = r.shape;
      r.p.x += Math.sin(r.yaw) * s.speed * dt;
      r.p.z += Math.cos(r.yaw) * s.speed * dt;
      const floor = floorAt(r.p.x, r.p.z);
      const gait = r.t * s.speed * 1.6;
      const bound = Math.abs(Math.sin(gait / 2)) * s.bound;
      r.fig.group.position.set(r.p.x, floor + bound, r.p.z);
      r.fig.group.rotation.y = r.yaw;
      const alpha = Math.min(1, r.t / 0.4) * Math.min(1, (RUN - r.t) / 1);
      r.fig.update(dt, camera, { gait, alpha: Math.max(0, alpha) });
      if (Math.random() < dt * 40) cards.spawn({ p: [r.p.x + (Math.random() - 0.5) * 0.6, floor + Math.random() * 1.2, r.p.z + (Math.random() - 0.5) * 0.6], v: [0, 0.3, 0], life: 1.2, size: 0.07, colour: col('#dcecff', 1.8 * Math.max(0, alpha)), drag: 1 });
      // (its silver haze, big and faint, round the body as it goes)
      if (Math.random() < dt * 25) cards.spawn({ p: [r.p.x, floor + bound + (s.hips[0].y + 0.2) * (0.6 + Math.random() * 0.6), r.p.z], v: [Math.sin(r.yaw) * s.speed * 0.6, 0, Math.cos(r.yaw) * s.speed * 0.6], life: 0.6, size: 1.6, colour: col('#bcd6ff', 0.12 * Math.max(0, alpha)), grow: 0.4, drag: 2 });
      if (r.t >= RUN) {
        r.fig.dispose();
        runs.splice(i, 1);
      }
    }
  }

  return {
    step,
    cast,
    choose(id) {
      if (spellById(id)) active = id;
    },
    // the touch Cast button: down casts the spell on the wand, up lets Leviosa go
    press(down) {
      touchHeld = down;
      if (down) {
        cast(active);
        holding = { id: active, code: 'touch' };
      }
    },
    // the things the wand can take hold of, placed: [{ id, kind, object, ... }]
    place(list) {
      for (const th of list) this.add(th);
    },
    add(th) {
      things.set(th.id, { r: 0.3, ...th });
      if (th.object && !th.object.parent) scene.add(th.object);
      if (th.lit) light(things.get(th.id), Infinity);
    },
    remove(id) {
      const th = things.get(id);
      if (!th) return;
      scene.remove(th.object);
      things.delete(id);
    },
    things,
    body,
    // the HUD’s and the checks’ view of it
    state: () => ({ active, lit: wand.lit, held: wand.held, shield: shieldOf(at(wand, t)), bolts: bolts.length, runs: runs.length, fires: fires.length, cards: cards.alive, cooling: Object.fromEntries(SPELLS.map((s) => [s.id, Math.round(Math.max(0, (wand.ready[s.id] ?? 0) - t) * 100) / 100])) }),
    get active() {
      return active;
    },
    learn(what) {
      if (!wand.learnt.includes(what)) wand = { ...wand, learnt: [...wand.learnt, what] };
    },
    setDuel(on) {
      wand = { ...wand, duel: on };
    },
    take(fn) {
      taker = fn ?? null;
    },
    flourish,
    // where the tip is now, in the world
    tip: () => tip.clone(),
    visible(on) {
      grip.visible = on;
    },
    spellByKey,
    dispose() {
      for (const bo of bolts) {
        scene.remove(bo.view.group);
        bo.view.dispose();
      }
      for (const r of runs) r.fig.dispose();
      for (const th of things.values()) scene.remove(th.object);
      cards.dispose();
      lights.dispose();
      dome.dispose();
      scene.remove(dome.mesh, grip, tipLight);
      wandMesh.geometry.dispose();
      sounds.dispose();
    },
  };
}

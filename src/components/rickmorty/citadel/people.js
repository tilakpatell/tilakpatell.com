// The Citadel's people, every one a Meshy figure (../portal/meshyCast.js,
// scripts/meshy.mjs) in the show's toon look, each on its animator: Rick
// C-137, the named cast about the concourse, the day care's Mortys, the
// Cop Ricks on red alert, the Council on its bench, the clerks at their
// consoles, the workers on Simple Rick's line, and the concourse's crowd
// about its day (./ambient.js). A figure whose model doesn't load is left
// out; nothing stands in for it.
//
// How each shows what it's doing (./bodies.js has the rules): the cast
// look at Rick with their heads as he comes by and turn to him only when
// he's well round, wave the first time, and talk with their hands while
// their line's up; the Day Care Rick reads his magazine at his desk, sat
// (base 'sit'), and looks up for Rick; the day care's Mortys run from him
// with a fright and cheer once they're penned; the Cop Ricks walk their
// rounds looking about, stare where they heard something, turn on Rick
// when they see him, sweep the concourse with their heads searching, and
// jab and gloat when they catch him (the watchers' modes, through body.js
// and COP_BODY); the Council sit through the hearing, each talking with
// his hands when it's his line and the others looking at him; the clerks
// work their consoles; the line's workers work the line and cheer a good
// wafer; and Rick himself takes a pull on his flask now and then, flinches
// when he's seen, takes a hit when he's caught, cheers when he's done
// something, and strikes the emote you pick (lib/emote.js). Every figure's
// feet are paced to the ground it covers (its motion from its steps), and
// animBudget.js says how often each is stepped.

import * as THREE from 'three';
import { createMeshyCast } from '../portal/meshyCast';
import { defaultLook } from '../wardrobe/looks';
import { CAST_INK } from './look';
import { bodyAsset, bodyKind, dress, whoOf, withWardrobe } from '../wardrobe/wear';
import { applyEmote } from '../../../lib/emote';
import { turn } from '../../../lib/three/gait';
import { seeded } from '../../../lib/seeded';
import { createConcourse } from './ambient';
import { COP_BODY, copStep, easeTurn, lookAhead, lookAt, moveFor, regard, sayFor, scanLook, stepBody, yawOf } from './bodies';
import { CAST, RICK, castFor } from './layout';

export { lookAt, yawOf } from './bodies';

// kind → the model and how tall it stands, in metres
const SHIRTS = [0xf3d84b, 0x7fc77a, 0xe0795a, 0xa98ad8, 0x63b5d9, 0xf0a0c0];
export const KINDS = {
  rick: { a: 'rick', h: 1.85 },
  cop: { a: 'cop', h: 1.85 },
  morty: { a: 'morty', h: 1.5 },
  daycare: { a: 'morty', h: 1.5, shirts: SHIRTS },
  evilmorty: { a: 'evilmorty', h: 1.5 },
  copmorty: { a: 'copmorty', h: 1.5 },
  meeseeks: { a: 'meeseeks', h: 1.95 },
  cowboyrick: { a: 'cowboyrick', h: 1.97 },
  factoryrick: { a: 'factoryrick', h: 1.85 },
  constructionrick: { a: 'constructionrick', h: 1.9 },
  sweaterrick: { a: 'sweaterrick', h: 1.85 },
  suitrick: { a: 'suitrick', h: 1.85 },
  detectiverick: { a: 'detectiverick', h: 1.92 },
  councila: { a: 'councilrick-a', h: 1.85 },
  councilb: { a: 'councilrick-b', h: 1.9 },
  councilc: { a: 'councilrick-c', h: 1.82 },
};
const RIGGED = new Set(['rick', 'cop', 'morty', 'evilmorty', 'copmorty', 'meeseeks', 'cowboyrick', 'factoryrick', 'constructionrick', 'sweaterrick', 'suitrick', 'detectiverick', 'councilrick-a', 'councilrick-b', 'councilrick-c']);
// those that sit (the Day Care Rick at his desk, the Council in its chairs)
const SITTERS = ['rick', 'councilrick-a', 'councilrick-b', 'councilrick-c'];
const ASSETS = [...new Set(Object.values(KINDS).map((k) => k.a))].filter((a) => !SITTERS.includes(a));
// the walking crowd's kinds, in turn (a Morty walks with the Rick before him)
const WALKERS = ['rick', 'constructionrick', 'daycare', 'suitrick', 'detectiverick', 'daycare', 'sweaterrick'];
// the crowd's kinds a live figure can be made of (./crowd.js promotes the nearest of them)
export const LIVE = new Set(['rick', 'cop', 'morty', 'copmorty', 'cowboyrick', 'factoryrick', 'constructionrick', 'sweaterrick', 'suitrick', 'detectiverick']);

const CROWD = { high: 7, mid: 4, low: 2 };
const EYES = 1.72; // Rick's eyes (m), for whoever looks at him
const GREET = { near: 6, rearm: 9 }; // the cast's: a wave inside, again only once he's been past
const NOTICE = 5.5; // the cast look round at Rick this near
const FLASK = { fidgets: ['drink'], every: [14, 34] }; // a Rick's pull on his flask, every so often

// a walker's heading (+x turned to (cos, -sin)) as a Meshy figure's turn
// (they face +z), eased: kept for ./townsfolk.js
export const turnTo = (a, b, k) => {
  let d = b - a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return a + d * Math.min(1, k);
};

// a point along a closed loop, `s` metres round it: [x, z, heading]
export function along(loop, lengths, total, s) {
  let d = ((s % total) + total) % total;
  for (let i = 0; i < loop.length; i++) {
    if (d <= lengths[i]) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      const k = lengths[i] ? d / lengths[i] : 0;
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, Math.atan2(-(b[1] - a[1]), b[0] - a[0])];
    }
    d -= lengths[i];
  }
  return [loop[0][0], loop[0][1], 0];
}

// places: { council: [{ x, y, z, face }], workers: [...] } in their rooms'
// own frames; parents: the concourse and the two rooms
// look: the wardrobe's Rick (looks.js), the one you walk about as; loader:
// another GLTFLoader (a test's)
export async function createPeople({ outdoors, factory, council, places, tier = 'high', look = null, loader = null }) {
  const meshy = createMeshyCast(withWardrobe({ kinds: KINDS, rigged: RIGGED, cull: true, ink: tier === 'low' ? 0 : CAST_INK, ...(loader ? { loader } : {}) }));
  let rickLook = look ?? defaultLook('rick');
  const loads = new Map(); // (a body's model, loaded once)
  const need = (asset, clips) => {
    if (!loads.has(asset)) loads.set(asset, meshy.load(null, [asset], { clips }));
    return loads.get(asset);
  };
  await Promise.all([...SITTERS.map((a) => need(a, ['idle', 'walk', 'run', 'sit'])), ...ASSETS.map((a) => need(a, ['idle', 'walk', 'run'])), need(bodyAsset(rickLook), ['idle', 'walk', 'run', 'sit'])]);

  const all = [];
  const make = (kind, parent, variant = 0) => {
    const f = meshy.make(kind, variant);
    if (!f) return null;
    f.group.traverse((o) => {
      if (o.isMesh) o.castShadow = false;
    });
    parent.add(f.group);
    f.rg = {};
    all.push(f);
    return f;
  };
  // sat down, on its own sat clip (base 'sit'), there at once
  const seat = (f) => {
    if (!f?.base) return;
    f.base('sit', { fade: 0 });
    f.sitting = true;
  };
  // a Rick's flask: his own body, taking a pull now and then as he stands
  const flask = (f, lk) => {
    if (f?.anim && whoOf(lk) === 'rick') f.anim.idles(FLASK);
  };

  // Rick C-137, as the wardrobe has him
  let rick = make(bodyKind(rickLook), outdoors) ?? make('rick', outdoors);
  let undress = dress(rick, rickLook);
  flask(rick, rickLook);
  const cast = new Map();
  for (const c of CAST) {
    const f = make(c.kind, outdoors);
    if (!f) continue;
    f.home = c;
    f.yaw = yawOf(c.face);
    f.group.position.set(c.x, 0, c.z);
    f.group.rotation.y = f.yaw;
    if (c.id === 'daycarerick') seat(f);
    cast.set(c.id, f);
  }
  const mortys = Array.from({ length: 6 }, (_, i) => make('daycare', outdoors, i)).filter(Boolean);
  const cops = Array.from({ length: 4 }, () => make('cop', outdoors)).filter(Boolean);
  const councilFigs = ['councila', 'councilb', 'councilc']
    .map((k, i) => {
      const f = make(k, council);
      const p = places.council[i];
      if (f && p) {
        f.group.position.set(p.x, p.y, p.z);
        f.group.rotation.y = yawOf(p.face);
        f.who = k;
        seat(f);
      }
      return f;
    })
    .filter(Boolean);
  // the clerks at the chamber's consoles
  const clerks = (places.clerks ?? [])
    .map((p, i) => {
      const f = make(i ? 'sweaterrick' : 'suitrick', council);
      if (f) {
        f.group.position.set(p.x, p.y, p.z);
        f.group.rotation.y = yawOf(p.face);
        f.busyIn = 2 + i * 2.5;
      }
      return f;
    })
    .filter(Boolean);
  const workers = places.workers
    .map((p, i) => {
      const f = make('factoryrick', factory);
      if (f) {
        f.group.position.set(p.x, p.y, p.z);
        f.group.rotation.y = yawOf(p.face);
        f.busyIn = 1 + i * 1.3;
      }
      return f;
    })
    .filter(Boolean);

  // the crowd: about their day (./ambient.js), the old loops where they start
  const n = CROWD[tier] ?? CROWD.high;
  const crowd = [];
  for (let i = 0; i < n; i++) {
    const f = make(WALKERS[i % WALKERS.length], outdoors, i);
    if (f) crowd.push(f);
  }
  const concourse = createConcourse({ kinds: crowd.map((f) => f.kind), seed: 7 });
  // (each where its brain starts it)
  crowd.forEach((f, i) => {
    const p = concourse.people[i];
    f.group.position.set(p.x, 0, p.z);
    f.group.rotation.y = p.yaw;
  });

  // the figures made for ./crowd.js's nearest few, and handed back
  const spare = new Map(); // kind → [figure…]
  const live = (kind) => {
    if (!LIVE.has(kind)) return null;
    const f = spare.get(kind)?.pop() ?? make(kind, outdoors);
    if (f) f.group.visible = true;
    return f;
  };
  const unlive = (f) => {
    if (!f) return;
    f.group.visible = false;
    lookAt(f, null);
    f.stop?.(0.1);
    (spare.get(f.kind) ?? spare.set(f.kind, []).get(f.kind)).push(f);
  };

  const tmp = new THREE.Vector3();
  const rickHead = new THREE.Vector3();
  const rand = seeded(0x417);
  const between = ([lo, hi]) => lo + (hi - lo) * rand();
  let lastT = null;
  let camera = null;
  let budget = null;
  let view = null;
  // step a figure's animation, as often as the budget says (its idle, walk
  // and run weighed from its pace, unless it's told)
  const animate = (f, t, { move = null, motion = null } = {}) => {
    let lodRate = 1;
    if (budget) {
      f.group.getWorldPosition(tmp);
      lodRate = budget.rate(tmp, camera, view ? view(tmp) : true);
    }
    f.update(t, move ?? (motion ? moveFor(Math.hypot(motion.speed, motion.side)) : 0), 0, { motion, lodRate });
  };
  // a figure walked from its last step to this one (motion from its steps)
  // (its body turned toward the step's yaw by time, put there after a jump)
  const stepTo = (f, x, z, yaw, dt, ease = 10, table) => {
    const step = { x, z, yaw };
    const jumped = !f.prev || Math.hypot(x - f.prev.x, z - f.prev.z) > 2.5;
    const body = stepBody(f.prev, step, dt, table ? { table } : undefined);
    f.prev = step;
    f.group.position.set(x, 0, z);
    f.yaw = f.yaw == null || jumped ? yaw : turn(f.yaw, yaw, dt, ease);
    f.group.rotation.y = f.yaw;
    return body;
  };
  // things to do in a moment: [{ at, fn }]
  const soon = [];
  const later = (t, s, fn) => soon.push({ at: t + s, fn });
  // the head of whoever: a figure's, at its height
  const headAt = (f, out = new THREE.Vector3()) => {
    f.group.getWorldPosition(out);
    out.y += (f.sitting ? 0.72 : 0.92) * f.height;
    return out;
  };

  // who's about in each mood, and who's in the chamber (made once, not a frame)
  const castHere = new Map();
  const chamber = [...councilFigs, ...clerks];
  const council3 = new Map(councilFigs.map((f) => [f.who, f]));
  let sayingAt = null; // the line a cast member was last asked to say
  let speechAt = null; // the Council's line, last
  let rickFull = false; // Rick's reaction on his whole body: cut when he moves

  // Something's happened (CitadelWorld.jsx's cues, through ./scene.js):
  // { type, id?, at? } as the world has it
  const cue = (c, t, state) => {
    const h = state.rick;
    const at = (x, z) => ({ x, y: EYES, z });
    if (c.type === 'seen') {
      const f = cops[c.id];
      if (f) f.react('alert', { t, target: at(h.x, h.z) });
      // Rick: a sharp look at whoever's seen him, and a flinch
      const w = state.cops?.[c.id];
      if (rick && w) rick.react('alert', { t, target: { x: w.x, y: EYES, z: w.z } });
    } else if (c.type === 'caught') {
      const f = cops[c.id];
      if (f) {
        f.react('caught', { t, target: at(h.x, h.z) });
        // and gloats: Evil Morty's Cop Ricks pound their chests
        later(t, 0.8, () => f.play('taunt', { layer: 'upper', lasts: 2.4 }));
      }
      const r = rick?.react('hit', { t, where: 'chest' });
      rickFull = r?.layer === 'full';
    } else if (c.type === 'won') {
      const r = rick?.react('win', { t });
      rickFull = r?.layer === 'full';
    } else if (c.type === 'penned') {
      const f = mortys[c.id];
      if (f) f.react('win', { t, moving: true });
    } else if (c.type === 'herdwon') {
      for (const f of mortys) f.react('win', { t, moving: false });
      cast.get('daycarerick')?.react('say', { t, target: at(h.x, h.z), hold: 2 });
    } else if (c.type === 'scatter') {
      for (const f of mortys) f.react('gunfire', { t, moving: true, target: at(h.x, h.z) });
    } else if (c.type === 'herdout') {
      // the Day Care Rick looks up from his magazine
      cast.get('daycarerick')?.react('say', { t, target: at(h.x, h.z), hold: 2.4 });
    } else if (c.type === 'good') {
      for (const f of workers) f.react('win', { t });
    }
  };

  // state: the world's render state (scene.js); t: seconds; cam: the
  // camera's world position; opts: { camera, budget, view(pos) → in view }
  const update = (state, t, cam, opts = {}) => {
    const dt = lastT == null ? 0 : Math.min(0.1, Math.max(0, t - lastT));
    lastT = t;
    camera = opts.camera ?? (cam ? { position: cam } : null);
    budget = opts.budget ?? null;
    view = opts.view ?? null;
    const outside = state.mode !== 'inside';
    const red = state.mood === 'red';
    const h = state.rick;
    rickHead.set(h.x, EYES, h.z);
    for (let i = soon.length - 1; i >= 0; i--)
      if (t >= soon[i].at) {
        const s = soon.splice(i, 1)[0];
        s.fn();
      }
    for (const c of state.cues ?? []) cue(c, t, state);

    if (rick) {
      rick.group.visible = outside && state.mode !== 'escape';
      if (rick.group.visible) {
        const body = stepTo(rick, h.x, h.z, yawOf(h.face), dt, 30);
        // his head on whoever he's talking to
        const who = state.where !== 'mortytown' && state.person ? cast.get(state.person) : state.mode === 'talk' && state.talking === 'ballot' ? cast.get('evilmorty') : null;
        lookAt(rick, who?.group.visible ? headAt(who, tmp) : null);
        // what you've picked off the wheel; and a reaction on his whole body cut as he moves
        rick.shown = applyEmote(rick, state.emote ?? null, rick.shown ?? null);
        if (rickFull && h.speed > 0.4) {
          rickFull = false;
          if (!rick.shown) rick.stop(0.15, 'full');
        }
        animate(rick, t, { move: Math.min(1, Math.hypot(body.motion.speed, body.motion.side) / RICK.run), motion: body.motion });
      }
    }
    // (in Mortytown, the concourse's people are out of sight: let them be)
    if (state.where === 'mortytown') return;
    let here = castHere.get(state.mood);
    if (!here) castHere.set(state.mood, (here = new Set(castFor(state.mood).map((c) => c.id))));
    // a line up in a bubble: its speaker talks with his hands, looking at Rick
    const saying = state.saying ?? null;
    const sayNew = saying && saying !== sayingAt;
    sayingAt = saying;
    for (const [id, f] of cast) {
      f.group.visible = outside && here.has(id);
      if (!f.group.visible) continue;
      const d = Math.hypot(h.x - f.home.x, h.z - f.home.z);
      const home = yawOf(f.home.face);
      if (f.sitting) {
        // the Day Care Rick: at his magazine, unless Rick's by the desk
        lookAt(f, d < NOTICE + 2 ? rickHead : { ...lookAhead(f.home.x, f.home.z, home, 0, 0.7), y: 0.55 });
      } else if (d < NOTICE && outside) {
        f.yaw = regard(f.yaw, Math.atan2(h.x - f.home.x, h.z - f.home.z), dt, f.rg);
        lookAt(f, rickHead);
      } else {
        f.rg.turning = false;
        f.yaw = easeTurn(f.yaw, home, dt, 2);
        lookAt(f, null);
      }
      f.group.rotation.y = f.yaw;
      // a wave the first time he comes by
      if (d > GREET.rearm) f.greeted = false;
      else if (d < GREET.near && !f.greeted) {
        f.greeted = true;
        if (!f.sitting) f.react('greet', { t, target: rickHead });
      }
      if (sayNew && saying.id === id) f.react('say', { t, target: rickHead, hold: saying.hold ?? sayFor(saying.line) });
      animate(f, t);
    }

    // the day care's Mortys: running from Rick with a fright, pottering in the pen
    const herd = state.mortys ?? [];
    mortys.forEach((f, i) => {
      const m = herd[i];
      f.group.visible = outside && Boolean(m);
      if (!m || !outside) return;
      const body = stepTo(f, m.x, m.z, yawOf(m.face), dt, 12);
      if (m.scared && !f.scared) f.react('gunfire', { t, moving: true, target: rickHead });
      f.scared = m.scared;
      // (looking back at him over a shoulder as it runs)
      lookAt(f, m.scared ? rickHead : null);
      animate(f, t, { motion: body.motion });
    });

    // the Cop Ricks, on red alert: the watchers' modes, through COP_BODY
    const watch = state.cops ?? [];
    cops.forEach((f, i) => {
      const w = watch[i];
      f.group.visible = outside && Boolean(w);
      if (!w || !outside) {
        f.prev = null;
        return;
      }
      const step = copStep(w, h);
      const body = stepTo(f, w.x, w.z, step.yaw, dt, 12, COP_BODY);
      lookAt(f, body.scan ? scanLook(w.x, w.z, f.yaw, t, i + 1) : body.look);
      animate(f, t, { motion: body.motion });
    });

    // the crowd about the concourse (gone on red alert)
    const out = outside && !red;
    if (crowd.length && out) {
      const people = concourse.step(t, dt, { rick: state.where === 'concourse' || state.where == null ? h : null, mood: state.mood });
      crowd.forEach((f, i) => {
        f.group.visible = true;
        const p = people[i];
        const body = stepTo(f, p.x, p.z, p.yaw, dt, 30);
        if (p.base !== (f.atBase ?? null)) {
          f.atBase = p.base;
          f.sitting = p.base === 'sit';
          f.base(p.base);
        }
        if (p.loop !== (f.atLoop ?? null)) {
          if (p.loop) f.play(p.loop, { layer: 'upper', loop: true });
          else f.stop(0.35, 'upper');
          f.atLoop = p.loop;
        }
        if (p.cue) f.play(p.cue, { layer: p.speed > 0.2 || p.base ? 'upper' : 'full' });
        if (p.wave) f.react('greet', { t, target: rickHead });
        if (p.shove) f.react('hit', { t, where: 'chest', moving: true });
        lookAt(f, p.wave || p.shove ? rickHead : p.look);
        animate(f, t, { motion: body.motion });
      });
    } else for (const f of crowd) f.group.visible = false;

    if (!outside && state.room === 'council') {
      // the hearing: whoever's line it is talks with his hands, at Rick (the
      // camera's where he stands); the rest look at him; and when they lean
      // together and mutter behind their hands, all three
      const sp = state.speech ?? null;
      const fresh = sp && sp.at !== speechAt;
      if (sp) speechAt = sp.at;
      const speaker = sp ? council3.get(sp.who) : null;
      const me = cam ?? camera?.position ?? null;
      if (fresh && speaker) speaker.react('say', { t, target: me, hold: sayFor(sp.line) });
      if (fresh && sp.at === 'dog')
        councilFigs.forEach((f, i) => {
          later(t, i * 0.35, () => f.play('talk', { layer: 'upper', loop: true, lasts: 3.2 }));
        });
      const mid = council3.get('councilb') ?? councilFigs[1];
      for (const f of councilFigs) {
        if (sp?.at === 'dog') lookAt(f, f === mid ? headAt(councilFigs[0], new THREE.Vector3()) : headAt(mid, new THREE.Vector3()));
        else lookAt(f, speaker && f !== speaker ? headAt(speaker, new THREE.Vector3()) : me);
      }
      // the clerks at their consoles, looking up at whoever speaks
      for (const f of clerks) {
        if ((f.busyIn -= dt) <= 0) {
          f.busyIn = between([5, 11]);
          f.play('interact');
        }
        lookAt(f, speaker ? headAt(speaker, new THREE.Vector3()) : null);
      }
      for (const f of chamber) animate(f, t);
    }
    if (!outside && state.room === 'factory') {
      // the line's workers: at it, every few seconds
      for (const f of workers) {
        if ((f.busyIn -= dt) <= 0) {
          f.busyIn = between([3.5, 7]);
          f.play('pickup');
        }
        animate(f, t);
      }
    }
  };

  // where a person's head is, in the world (for the speech bubble); the
  // same vector each time, to use at once
  const head = new THREE.Vector3();
  const headOf = (kind, id) => {
    const f = kind === 'cast' ? cast.get(id) : kind === 'council' ? councilFigs[id] : kind === 'rick' ? rick : null;
    if (!f || !f.group.visible) return null;
    f.group.getWorldPosition(head);
    head.y += f.height + 0.3;
    return head;
  };

  const dispose = () => {
    for (const f of all) {
      f.anim?.dispose();
      f.group.removeFromParent();
    }
    all.length = 0;
    meshy.dispose();
  };

  // a new look from the wardrobe: Rick made again in it, where he was
  const setRick = async (next) => {
    if (!next || JSON.stringify(next) === JSON.stringify(rickLook)) return;
    rickLook = next;
    await need(bodyAsset(next), ['idle', 'walk', 'run', 'sit']);
    if (rickLook !== next) return;
    const fresh = make(bodyKind(next), outdoors);
    if (!fresh) return;
    undress();
    if (rick) {
      fresh.group.position.copy(rick.group.position);
      fresh.group.rotation.copy(rick.group.rotation);
      fresh.group.visible = rick.group.visible;
      fresh.yaw = rick.yaw;
      fresh.prev = rick.prev;
      rick.anim?.dispose();
      rick.group.removeFromParent();
      all.splice(all.indexOf(rick), 1);
    }
    rick = fresh;
    undress = dress(rick, next);
    flask(rick, next);
  };

  // a Rick for someone else online here (the scene's ghosts): not one of the
  // cast, and posed by `step(t, move, motion)` (0 still … 1 running; motion
  // as their packet has it, in metres and radians a second, else none); its
  // mesh and materials are the cast's to dispose, not the ghost's
  const other = (kind = 'rick') => {
    const f = meshy.make(kind);
    if (!f) return null;
    return {
      f,
      step: (t, move, motion = null) => f.update(t, move, 0, { motion }),
      stop: () => {
        f.anim?.dispose();
        f.mixer?.stopAllAction();
      },
    };
  };

  return {
    get rick() {
      return rick;
    },
    other,
    setRick,
    cast,
    mortys,
    cops,
    council: councilFigs,
    clerks,
    workers,
    crowd,
    live,
    unlive,
    update,
    headOf,
    dispose,
  };
}

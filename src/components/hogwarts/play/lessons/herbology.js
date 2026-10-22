// Herbology, the Mandrakes (quest 5, rules/herbology.js): greenhouse
// three’s bench, four Mandrakes in their pots and four empty ones, the
// earmuffs on a post, Professor Sprout across the bench. Earmuffs on (look
// at them and E: E anywhere else pulls a Mandrake, on or not), then each pot: E
// pulls it up, purple and screaming, and a bar of light over the pot
// swings its marker; E again while it’s in the green and it goes into its
// new pot. Without the earmuffs the cry is through at once and you faint
// for ten seconds; with them it takes a while, so don’t dawdle.
//
//   create(ctx, at) → { step, act(down), state(), over, dispose() }

import * as THREE from 'three';
import { HERB, POTS, SAYS, act as actRule, herbologyBot, inGreen, marker, muffs, newHerbology, stepHerbology } from '../../rules/herbology';
import { makeProp } from '../props';
import { aimed, createGauge, createVeil, frame, furniture } from './kit';

const WHO = 'Professor Sprout';

// the Mandrake’s cry: a wail that wobbles, muffled to a whine through earmuffs
function createCry(rt) {
  let osc = null;
  let lfo = null;
  let gain = null;
  let filter = null;
  return {
    start(muffled) {
      const ac = rt?.audio?.context?.();
      const out = rt?.audio?.bus?.();
      if (!ac || !out || ac.state === 'closed' || osc) return;
      osc = ac.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 880;
      lfo = ac.createOscillator();
      lfo.frequency.value = 7;
      const depth = ac.createGain();
      depth.gain.value = 120;
      lfo.connect(depth).connect(osc.frequency);
      filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = muffled ? 600 : 5000;
      gain = ac.createGain();
      gain.gain.value = muffled ? 0.012 : 0.06;
      osc.connect(filter).connect(gain).connect(out);
      osc.start();
      lfo.start();
    },
    stop() {
      for (const o of [osc, lfo]) {
        try {
          o?.stop();
        } catch {
          // (already stopped)
        }
        o?.disconnect();
      }
      osc = lfo = null;
    },
  };
}

export function create(ctx, at) {
  const { scene, camera, house, rt, floorAt, said, cards } = ctx;
  const f = frame(at, floorAt);
  const group = new THREE.Group();
  group.name = 'hogwarts-lesson-herbology';
  scene.add(group);
  const gauge = cards ? createGauge(cards) : null;
  const veil = createVeil(scene);
  const cry = createCry(rt);

  // the bench across in front of you: the four Mandrakes on the left half,
  // their new pots on the right; the earmuffs on a post at your left hand
  const bench = furniture('bench', { house, w: 3.2, d: 0.7, h: 0.9 });
  bench.position.copy(f.put(0, 1.8));
  bench.rotation.y = f.yaw;
  group.add(bench);
  const right = new THREE.Vector3(Math.cos(at.yaw), 0, -Math.sin(at.yaw));
  const pots = POTS.map((_, i) => {
    const old = makeProp('mandrake', { house, rt });
    old.position.copy(f.put(-1.35 + i * 0.42, 1.8, 0.93));
    group.add(old);
    return { old, root: old.userData.parts?.root ?? null, home: f.put(0.25 + i * 0.42, 1.8, 0.93) };
  });
  // the new pots: the Mandrake stand-in’s pot without its root
  for (const p of pots) {
    const fresh = makeProp('mandrake', { house, rt });
    fresh.userData.parts?.root?.removeFromParent();
    fresh.position.copy(p.home);
    group.add(fresh);
  }
  const post = furniture('post', { house, w: 0.4, h: 1.6, colour: '#4a3626' });
  post.position.copy(f.put(-1.9, 0.6));
  post.rotation.y = f.yaw;
  group.add(post);
  const earmuffs = new THREE.Group();
  const pad = new THREE.SphereGeometry(0.07, 10, 8).scale(1, 1, 0.6);
  const padMat = new THREE.MeshLambertMaterial({ color: '#e07aa0' });
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(pad, padMat);
    m.position.x = s * 0.1;
    earmuffs.add(m);
  }
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 16, Math.PI), padMat);
  earmuffs.add(band);
  earmuffs.position.copy(f.put(-1.9, 0.6, 1.42));
  earmuffs.rotation.y = f.yaw;
  group.add(earmuffs);
  const head = f.put(0, 2.3, 2.2);
  const sprout = ctx.figure?.('sprout', { height: 1.6 }) ?? null;
  if (sprout) {
    sprout.group.position.copy(f.put(0, 2.3));
    sprout.group.rotation.y = f.yaw;
    group.add(sprout.group);
  }

  let h = newHerbology({ earmuffs: false });
  let t = 0;
  let left = -1;
  const say = (text) => text && said?.say(WHO, text, head);
  const objective = () => {
    if (h.done) ctx.objective(null);
    else if (h.faint > 0) ctx.objective(`Out cold · ${Math.ceil(h.faint)} s`);
    else if (!h.earmuffs) ctx.objective('Look at the earmuffs and E · put them on');
    else if (!h.out) ctx.objective(`E · pull up Mandrake ${h.pot + 1} of ${POTS.length}`);
    else ctx.objective('E · into its new pot while the marker’s in the green');
  };
  say('Earmuffs on, everyone. And I mean on. Firmly.');
  objective();
  const wear = (on) => {
    h = muffs(h, on);
    earmuffs.visible = !h.earmuffs;
    say(h.earmuffs ? SAYS.muffsOn : SAYS.muffsOff);
    objective();
  };

  const self = {
    over: false,
    act(down) {
      if (!down || h.done || h.faint > 0) return true;
      const on = aimed(camera, [{ id: 'earmuffs', kind: 'muffs', p: earmuffs.position.toArray(), r: 0.25 }], 3.5);
      if (!h.out && on) {
        wear(!h.earmuffs);
        return true;
      }
      const r = actRule(h);
      h = r.herb;
      if (r.what === 'pulled') cry.start(h.earmuffs);
      else if (r.what === 'potted') {
        cry.stop();
        const p = pots[h.pot - 1];
        if (p?.root) p.root.visible = false;
        if (cards)
          for (let i = 0; i < 14; i++)
            cards.spawn({
              p: p.home
                .clone()
                .setY(p.home.y + 0.3)
                .toArray(),
              v: [(Math.random() - 0.5) * 0.8, Math.random(), (Math.random() - 0.5) * 0.8],
              life: 0.6,
              size: 0.05,
              colour: new THREE.Color(0.5, 1.4, 0.4),
              drag: 2,
            });
        if (h.done) {
          ctx.points(HERB.points, 'herbology');
          ctx.done();
          left = 5;
        }
      }
      say(r.says);
      objective();
      return true;
    },
    step(dt) {
      t += dt;
      const was = h;
      const r = stepHerbology(h, dt);
      h = r.herb;
      if (r.what === 'fainted') {
        cry.stop();
        say(SAYS.fainted);
      } else if (r.what === 'woke') say(SAYS.woke);
      if (r.what || Math.ceil(was.faint) !== Math.ceil(h.faint)) objective();
      // the Mandrake out of its soil: held up, squirming; the bar over it
      pots.forEach((p, i) => {
        if (!p.root) return;
        const out = h.out && i === h.pot;
        const y = out ? 0.55 + Math.sin(t * 20) * 0.03 : 0.22;
        p.root.position.y += (y - p.root.position.y) * Math.min(1, dt * 12);
        p.root.rotation.z = out ? Math.sin(t * 17) * 0.4 : 0;
      });
      if (gauge && h.out) {
        const pot = POTS[h.pot];
        const over = pots[h.pot].old.position.clone().setY(pots[h.pot].old.position.y + 0.75);
        gauge.bar(over, right, 0.7, marker(h), [pot.at - pot.half, pot.at + pot.half], inGreen(h) ? new THREE.Color(1.6, 1.6, 0.6) : new THREE.Color(1.8, 0.5, 0.9));
      }
      // the faint: black for ten seconds, and coming round
      veil.set(h.faint > 0 ? Math.min(1, (HERB.faint - h.faint) * 3) * Math.min(1, h.faint * 0.8) : 0);
      veil.update(camera);
      if (left > 0 && (left -= dt) <= 0) self.over = true;
      return true;
    },
    // the bot’s hands: earmuffs, a pull, the push in the green’s middle
    bot() {
      const what = herbologyBot(h);
      if (what === 'muffs') wear(true);
      else if (what === 'act') self.act(true);
    },
    state: () => ({ pot: h.pot, out: h.out, earmuffs: h.earmuffs, cry: Math.round(h.cry), faint: Math.round(h.faint * 10) / 10, done: h.done, marker: Math.round(marker(h) * 100) / 100 }),
    dispose() {
      cry.stop();
      veil.dispose();
      scene.remove(group);
      sprout?.dispose?.();
      for (const m of [bench, post]) m.geometry.dispose();
      pad.dispose();
      band.geometry.dispose();
      padMat.dispose();
    },
  };
  return self;
}

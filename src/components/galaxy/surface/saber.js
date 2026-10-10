// A lightsaber in the hand of a figure on the 2017 game's rig, down on a
// world: lit and put out, swung in the hero's strokes from its stroke table
// (gameStance.js), held up to block, thrown and caught. What it does is the
// game's rules, run by lib/combat/saber2017.js (one engine for you and every
// duellist: each saber owns a sim of its hero's); this draws what it decides.
// The hilt sits in the game's weapon socket (`Wep_Root`) and the game's
// clips swing the socket and put both hands on it: nothing here poses the
// arms. A figure off the game's rig fences with nothing: createSaber gives it
// no saber (heldBlade.js's held blade is a lit prop).
//
// A stroke is a clip of the hero's own (its pack, the game's names), played
// full-body on the figure's animator (`fig.play`), its chest, arms and the
// socket laid here from the same clip at the same time so the hilt goes where
// the clip takes it. Its root travel (the stroke table's rows, the clip's
// extras) steps the figure unscaled, as the game moves a hero by its
// animation; over the wind-up the figure turns to the one the strike is
// locked on (given, or the engine's lunge pick: the records' aim assist).
// What it hits is the engine's query, inside the stroke's contact window;
// the blade's segment, swept between frames (lib/combat/blade.js), is where
// a hit lands on the target's capsules (the game's hero and soldier sets on
// the game's skeleton, `capsules`), and draws the trail. Hits go back through
// `hit(target, damage, at, { behind, region })` (damage the game's, landing
// its DelayInitialDamageTime after the query found it), a strike met on a
// block through `blocked(target, at)` (the stroke stops: its blocked
// reaction plays), a clash through `clash(target, at)`; sounds through
// `sound(name)`. The block lays the game's block for the side a cut comes in
// on while the engine holds it up (stamina lasting); its shield turns the
// bolts that come at its front (`guard`, for lib/combat/bolt.js's step).
//
//   createSaber(gp, { color, hilt, stance, parent, sound, fig, clips, tier, hero }) → null off the game's rig, else
//     { light(on), swing(now, { heavy, dir, lock, clip }), cancel(), block(on, side), throw(now, dir, how?),
//       stand(dt, now, move), update(dt, now, { forward, up, me, targets, hit, blocked, clash, broken, capsules, eye }),
//       guard(id, side) (the deflect's shield for the bolts' step: { id, side, test, base, tip, r } | null), deflected(damage, now)
//       (a bolt it turned: its stamina's cost), dash(now) (the engine's dodge: whether a charge was spent), view(now) (the
//       stamina and the dashes, for the HUD), sim (the engine's), lit, busy, swinging (the stroke: { name, clip, t0, speed,
//       contact, heavy, … } or null), thrown, charge (0…1 while F is held), setCharge(k), blades (lib/combat/blade.js's, the
//       main first), blockClip, dark(), dispose() }
//   hero: the rulebook's hero (saber2017.js's saberOf: a hero with no saber of its own stands in Luke's); by default
//   the one the figure's strikes are (saberGame.js's heroOfClips)
//   side: the side of it a cut comes in on ('left' | 'right' | null: blockSide.js's incomingSide)
//   fig: the figure that holds it ({ rig: 'walrus', bones, clips, hipsY?, play?, stop? })
//   tier: the device's (lib/device.js's, unless given): the lit blade lights the scene on high and ultra
//   (saberLight.js); update's `eye` (the camera's position) puts that light out past 12 m.
//   clips: { name: clip } in place of the figure's own (tests)
//   lock: a target (as `targets` hold them: { holder, fig?, spec? }); clip: a clip's name to play in place of the
//   one strokeFor picks (a peer's, as their packet says)
//   targets: as activity.js keeps them ({ holder, b?: { yaw }, blade?: { saber } (a duellist's), blocking?, down? }) or
//   asTarget()'s you ({ you, yaw, sim })

import * as THREE from 'three';
import { createBlade } from '../../../lib/combat/blade';
import { segSeg } from '../../../lib/combat/bolt';
import { hiltFit } from '../../../lib/combat/hiltFit';
import { createSaberSim, lungePick, saberOf, shieldHit } from '../../../lib/combat/saber2017';
import { device } from '../../../lib/device';
import { SOCKETS } from '../../../lib/three/walrusRig.js';
import { createTrail } from '../../../lib/three/combat/trail';
import { frameFrom, reach, setWorldQuaternion } from '../../../lib/three/ik';
import { capsuleOf } from './blaster';
import { BLOCK_CLIP, blockClipFor } from './blockSide';
import { stanceFor, strokeFor } from './gameStance';
import { gameClips, heroOfClips } from './saberGame';
import { rootAt } from './saberRoot';
import { createSaberLight } from './saberLight';

export { rootAt };
import { BLADE_OF, BLOCK_AT, SABER, throwAt } from './saberRules';
import { modelUrlFor } from './catalog';
import { loadGlb } from './placer';

const V = THREE.Vector3;
const _a = new V();
const _b = new V();
const _c = new V();
const _e = new V();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const LIGHT = 9; // how quick the blade comes out (per second)
const TRAIL = 8; // frames of the trail behind the blade (and the blade's memory of them)
const radiusOf = (t) => Math.max(0.45, (t.fig?.tall ?? 1.6) * (t.spec?.scale ?? 1) * 0.35);
// what a stroke lays from its clip: the chest and both arms, by the 2017
// game's names (lib/three/walrusRig.js), and Meshy's, whichever the figure has
export const ARMS = ['Spine02', 'Spine01', 'Spine2', 'Spine1', 'Neck', 'Spine', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand'];
const TURN = 0.4; // of the clip, the figure turning to its lock (drawn: the game's animation turns it)
const IN = 0.08; // seconds a stroke's arms take to come on
const OUT = 0.15; // and to go at its end
const SWITCH = 0.12; // seconds a block chosen again while it's up takes to ease over from the one before
const NO_CLIP = { duration: 0.6, contact: [0.2, 0.4] }; // (a stroke whose clip hasn't come: timed as one)
// (the pack's names for a stroke the hero's own set has no clip of: walrusClips.js's)
const PACK = { combo: ['sword.light.a', 'sword.light.b', 'sword.light.c', 'sword.a'], heavy: ['sword.heavy.a'], dir: ['sword.a'] };
const ease = (k) => k * k * (3 - 2 * k);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// a target as the engine sees it
const posOf = (t) => t.holder?.position ?? t;
const asEngine = (t) => {
  const p = posOf(t);
  return { id: t, x: p.x, z: p.z, y: p.y, yaw: t.b?.yaw ?? t.yaw ?? t.holder?.rotation?.y ?? null, sim: t.blade?.saber?.sim ?? t.sim ?? null, deflecting: Boolean(t.blocking), dead: Boolean(t.down || t.dead) };
};

export function createSaber(gp, { color = '#4aa8ff', hilt = null, stance = 'single', parent = null, sound = null, fig = null, clips: given = null, tier = null, hero = null } = {}) {
  // (one path: the game's rig, the hilt in the game's weapon socket)
  if (fig?.rig !== 'walrus' || !gp?.socket) return null;
  const gun = gp.gun;
  const { RightArm: upper, RightForeArm: fore, RightHand: hand } = gp.bones;
  const blade = gun.getObjectByName('blade');
  const sleeve = gun.getObjectByName('sleeve');
  const core = gun.getObjectByName('core');
  const local = { pos: gun.position.clone(), quat: gun.quaternion.clone(), scale: gun.scale.clone() }; // in the socket (attach() to the world rewrites all three)
  const gripInv = gun.quaternion.clone().invert();
  const own = given ?? fig.clips ?? {};
  const pack = heroOfClips(own);
  // (its strokes, the game's: its stroke table's chain, windows and cadence)
  const st_ = stanceFor(stance, { rig: 'walrus', pack });
  // (its rules, the game's: one engine)
  const rules = saberOf(hero ?? pack);
  const sim = createSaberSim(rules);
  const holder = gun.parent; // (the socket)
  dress(gun, color, hilt);
  // the game's hilt (heroes.js's HILTS `model`, a 2017 kind) in place of the
  // built one: modelled up +y about its grip, so it goes in unturned, scaled
  // to the hilt's length (hiltFit), and the blade comes out at its top (a
  // staff's second out of its bottom). Until it comes, or if it doesn't, the
  // built one stands in, dressed.
  let gone = false;
  const worn = [];
  if (hilt?.model)
    loadGlb(modelUrlFor(hilt.model, 'high')).then((gltf) => {
      if (!gltf || gone) return;
      const m = gltf.scene.clone(true);
      const box = new THREE.Box3().setFromObject(m);
      const fit = hiltFit({ min: box.min.toArray(), max: box.max.toArray() }, hilt.modelLength ?? hilt.length ?? 0.28);
      m.scale.setScalar(fit.scale);
      m.name = 'hilt-model';
      for (const o of [...gun.children]) if (o.isMesh && (o.name === 'grip' || o.name === 'metal' || o.name === 'trim' || o.name.startsWith('emitter'))) o.visible = false;
      gun.add(m);
      worn.push(m);
      // (out of the hilt's emitter as the game measured it, on the hilt's axis: BLADE_OF)
      const out = BLADE_OF[hilt.model];
      if (blade) out ? blade.position.fromArray(out.base).multiplyScalar(fit.scale) : (blade.position.y = fit.bladeY);
      const b2 = gun.getObjectByName('blade2');
      if (b2) out?.base2 ? b2.position.fromArray(out.base2).multiplyScalar(fit.scale) : (b2.position.y = box.min.y * fit.scale);
    });
  // the second blade: out of the pommel (a staff)
  const blades = [blade].filter(Boolean);
  const extra = [];
  if (blade && stance === 'double') {
    const b2 = blade.clone(true);
    b2.name = 'blade2';
    b2.rotation.z = Math.PI;
    b2.position.y = -0.16;
    gun.add(b2);
    blades.push(b2);
    extra.push(b2);
  }
  // each blade's segment, frame by frame (where its strokes land), and its trail from them
  const segs = blades.map(() => createBlade({ keep: TRAIL }));
  const trails = blades.map(() => createTrail(parent ?? gun.parent?.parent, { color, length: TRAIL }));
  // the clips: the figure's own, by the pack's names and the game's
  const clips = gameClips(own);
  const clipFor = (k) => clips[k.clip] ?? clips[k.site] ?? clips[PACK[k.kind]?.[k.i % PACK[k.kind].length]] ?? null;
  // (a clip by the name the figure's own pack has it under: what its animator plays)
  const packName = (clip) => Object.keys(own).find((n) => own[n] === clip) ?? clip.name;
  // each clip's arms and the weapon socket on this figure, to sample by hand
  const armsOf = new Map();
  const partsOf = (clip) => {
    if (!armsOf.has(clip))
      armsOf.set(
        clip,
        clip.tracks
          .map((tr) => {
            const i = tr.name.lastIndexOf('.');
            const name = tr.name.slice(0, i);
            const path = tr.name.slice(i + 1);
            if (name === SOCKETS.weapon && (path === 'quaternion' || path === 'position')) return { bone: gp.socket, path, at: tr.createInterpolant() };
            const bone = path === 'quaternion' && ARMS.includes(name) ? (fig.bones?.[name] ?? gp.bones[name] ?? null) : null;
            return bone && { bone, path, at: tr.createInterpolant() };
          })
          .filter(Boolean),
      );
    return armsOf.get(clip);
  };
  const lay = (clip, t, w) => {
    if (!clip || w <= 1e-3) return;
    for (const p of partsOf(clip)) {
      const v = p.at.evaluate(t);
      if (p.path === 'position') p.bone.position.lerp(_e.set(v[0], v[1], v[2]), Math.min(1, w));
      else p.bone.quaternion.slerp(_q.set(v[0], v[1], v[2], v[3]), Math.min(1, w));
    }
  };
  // the figure's hips over its toes in metres, against the clip's (for the root's travel)
  const hipsM = (() => {
    const h = fig.bones?.Hips ?? gp.bones.Hips;
    if (!h?.parent) return 0.92;
    h.parent.updateWorldMatrix(true, false);
    return (fig.hipsY ?? h.position.y) * h.parent.getWorldScale(_e).y;
  })();

  const st = {
    on: false,
    lit: 0,
    swing: null, // the stroke: strokeFor's, with { t0, dur, contact, root, rootHips, clip, lock, yaw0, was }
    last: null, // the stroke before, with its endedAt
    move: 0, // how much the figure's going (stand's): moving, the legs keep walking under a stroke
    blockW: 0, // the block clip's arms, coming on and going
    now: 0, // the last frame's time
    blocking: false,
    side: null, // the side the block was chosen for, and the game's block it lays (null: BLOCK_CLIP)
    blockClip: null,
    raises: 0, // (the variant's turn, and this raise's)
    raise: 0,
    blockWas: null, // (the block before, eased out from blockSwitch)
    blockSwitch: 0,
    recoils: 0, // (the blocked reaction's turn)
    thrown: null, // { t0, from, dir, hits }
    me: null,
    charge: 0,
  };
  for (const b of blades) {
    b.visible = false;
    b.scale.y = 0.001;
  }

  const fly = (dt, now, pose_, targets, hit) => {
    const th = st.thrown;
    const k = (now - th.t0) / th.how.dur;
    if (k >= 1) {
      // caught
      holder.add(gun);
      gun.position.copy(local.pos);
      gun.quaternion.copy(local.quat);
      gun.scale.copy(local.scale);
      st.thrown = null;
      sound?.('catch');
      return;
    }
    const at = throwAt(k);
    gun.position.copy(th.from).addScaledVector(th.dir, at.d);
    gun.position.y += Math.sin(k * Math.PI) * 0.4; // (a little lift at the far end)
    // spinning flat, the blade a disc
    const spun = _a.copy(th.dir).applyAxisAngle(pose_.up, at.spin);
    frameFrom(pose_.up, spun, _q);
    gun.quaternion.copy(_q);
    gun.updateWorldMatrix(true, true);
    for (const t of targets) {
      if (th.hits.has(t)) continue;
      const p = t.holder.position;
      if (Math.hypot(p.x - gun.position.x, p.z - gun.position.z) < th.how.radius + radiusOf(t) && Math.abs(p.y + 1 - gun.position.y) < 2.5) {
        th.hits.add(t);
        hit?.(t, th.how.damage, gun.position, { thrown: true });
      }
    }
    // the arm out after it, the hand open to take it back
    if (upper && fore && hand) {
      upper.updateWorldMatrix(true, false);
      const S = upper.getWorldPosition(new V());
      const target = _c.copy(th.dir).multiplyScalar(gp.armLen * 0.9).add(S);
      const right = _b.crossVectors(pose_.forward, pose_.up).normalize();
      const pole = new V().addScaledVector(pose_.up, -0.7).addScaledVector(right, 0.5).normalize();
      reach(upper, fore, hand, target, pole, 1);
      frameFrom(th.dir, pose_.up, _q2).multiply(gripInv);
      setWorldQuaternion(hand, _q2, 1);
    }
  };

  // each blade's segment this frame, from the hilt to the tip
  const _base = new V();
  const _tip = new V();
  // the lit blade lights what's round it (on high and ultra: saberLight.js)
  const light = parent ? createSaberLight({ scene: parent, color, tier: tier ?? device().tier }) : null;
  let eye = null;
  const ends = (b) => {
    b.updateWorldMatrix(true, false);
    _base.set(0, 0.1, 0).applyMatrix4(b.matrixWorld);
    _tip.set(0, 1, 0).applyMatrix4(b.matrixWorld);
  };
  const pushBlades = (now) => {
    blades.forEach((b, i) => {
      ends(b);
      segs[i].push(_base.toArray(), _tip.toArray(), now);
      if (i === 0) light?.update(_base, _tip, st.lit, eye);
    });
  };
  const drawTrails = (on) => trails.forEach((tr, i) => tr.sync(segs[i].history(), on && st.lit > 0.5));

  // where on them a strike the engine found lands: on the capsule the blade's
  // nearest (the game's set on the game's skeleton, else the one), the point
  // on the blade nearest it
  const landOn = (t, capsules) => {
    const caps = capsules?.(t) ?? [{ ...capsuleOf(t), region: 'chest' }];
    const f = segs[0]?.history().at(-1);
    if (!f || !caps.length) {
      const c = caps[0];
      return { at: c ? [(c.a[0] + c.b[0]) / 2, (c.a[1] + c.b[1]) / 2, (c.a[2] + c.b[2]) / 2] : null, region: c?.region ?? null, reaction: c?.reaction ?? null };
    }
    let best = null;
    for (const c of caps) {
      const m = segSeg(f.base, f.tip, c.a, c.b);
      if (!best || m.dist - c.r < best.d) best = { d: m.dist - c.r, c, at: [f.base[0] + (f.tip[0] - f.base[0]) * m.s, f.base[1] + (f.tip[1] - f.base[1]) * m.s, f.base[2] + (f.tip[2] - f.base[2]) * m.s], on: m };
    }
    // (inside the blade's reach the point on it; out of it the capsule's nearest point to the blade)
    if (best.d > 0) {
      const { c, on } = best;
      best.at = [c.a[0] + (c.b[0] - c.a[0]) * on.t, c.a[1] + (c.b[1] - c.a[1]) * on.t, c.a[2] + (c.b[2] - c.a[2]) * on.t];
    }
    return { at: best.at, region: best.c.region ?? null, reaction: best.c.reaction ?? null };
  };
  // its stroke stopped on a block or a clash: the hero's blocked reaction, its arms with it
  const recoil = (now) => {
    const sw = st.swing;
    if (!sw) return;
    st.last = { ...sw, endedAt: now };
    st.swing = null;
    const name = st_?.blocked?.length ? st_.blocked[st.recoils++ % st_.blocked.length] : null;
    if (name && clips[name] && sw.walk) fig.play?.(packName(clips[name]), { layer: 'full', fade: 0.06 });
    else if (sw.walk) fig.stop?.(0.2, 'full');
  };

  // the middle of the strike query's ring ahead of the striker (m): where a
  // strike's lunge leaves the one it goes for (the game's animation warps its
  // root to the target the query hands it; the site stops it there)
  const q = rules.query;
  const STOP = (q.hit.radius + q.hit.near) / 2 + q.anchor;
  // a stroke a frame on: the turn to the lock, the root's step, the clip's
  // arms, the blade through them
  const stroke = (dt, now, p) => {
    const sw = st.swing;
    const t = Math.min(sw.dur, (now - sw.t0) * sw.speed);
    const me = p.me;
    // (as it starts: with no lock, the records' aim assist picks one; and what its lunge stops short of, the lock or
    // the nearest ahead inside the lunge's near cone)
    if (!sw.picked && me) {
      sw.picked = true;
      const targets = (p.targets ?? []).filter((x) => x?.holder || x?.you).map(asEngine);
      sw.lock ??= lungePick(q, me, targets, { tired: sim.state.out })?.id ?? null;
      const ahead = targets.filter((x) => !x.dead && Math.hypot(x.x - me.x, x.z - me.z) <= q.lunge.radius && Math.abs(wrap(Math.atan2(x.x - me.x, x.z - me.z) - me.yaw)) <= (q.lunge.nearCone * Math.PI) / 180);
      sw.stop = sw.lock ?? ahead.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0]?.id ?? null;
    }
    // (the lock's feet, if it's still standing)
    const lock = sw.lock && !sw.lock.down ? posOf(sw.lock) : null;
    if (me && lock && t < sw.dur * TURN) {
      const want = Math.atan2(lock.x - me.x, lock.z - me.z);
      sw.yaw0 ??= me.yaw;
      me.yaw = sw.yaw0 + wrap(want - sw.yaw0) * ease(Math.min(1, t / (sw.dur * TURN)));
    }
    if (me && sw.walk) {
      // (the clip's own step, unscaled: the game moves a hero by its animation; sized to this figure)
      const [x, z] = rootAt(sw.root, t);
      const k = hipsM / (sw.rootHips || hipsM);
      const lx = (x - sw.was[0]) * k;
      let lz = (z - sw.was[1]) * k;
      sw.was = [x, z];
      // (no nearer the one it goes for than the middle of the query's ring)
      const to = sw.stop && !sw.stop.down ? posOf(sw.stop) : null;
      if (to && lz > 0) lz = Math.min(lz, Math.max(0, Math.hypot(to.x - me.x, to.z - me.z) - STOP));
      // (the figure's own +x is its left, +z ahead, turned by its yaw)
      me.x += Math.cos(me.yaw) * lx + Math.sin(me.yaw) * lz;
      me.z += -Math.sin(me.yaw) * lx + Math.cos(me.yaw) * lz;
    }
    // the clip's arms, eased on and off at the end
    const w = Math.min(1, (now - sw.t0) / IN, (sw.dur - t) / (sw.speed * OUT) + 0.0001);
    lay(sw.clip, t, w);
    pushBlades(now);
    drawTrails(true);
    if (t >= sw.dur) {
      st.last = { ...sw, endedAt: now };
      st.swing = null;
    }
  };

  // the engine a frame on, and what it decided handed back
  const decide = (dt, now, p) => {
    const me = p.me;
    const targets = (p.targets ?? []).filter((x) => x?.holder || x?.you).map(asEngine);
    if (st.lit <= 0.5 || !me) return;
    const events = sim.step(dt, now, { me, targets });
    for (const e of events) {
      const t = e.id;
      if (e.type === 'hit') {
        if (!t || t.down) continue;
        const land = landOn(t, p.capsules);
        p.hit?.(t, e.damage, land.at ? _c.fromArray(land.at) : posOf(t), { behind: e.behind, region: land.region, reaction: land.reaction });
      } else if (e.type === 'blocked' || e.type === 'clash') {
        const land = landOn(t, p.capsules);
        recoil(now);
        sound?.('clash');
        (e.type === 'blocked' ? p.blocked : p.clash)?.(t, land.at ? _c.fromArray(land.at) : posOf(t));
      } else if (e.type === 'broken') {
        st.blocking = false;
        p.broken?.();
      }
    }
    // (the engine stopped it: recoiling, staggered)
    if (st.swing && !sim.state.striking && now - st.swing.t0 < (st.swing.contact?.[1] ?? 0)) recoil(now);
  };

  return {
    stance: st_,
    sim,
    rules,
    get lit() {
      return st.lit > 0.5;
    },
    get busy() {
      return Boolean(st.swing || st.thrown);
    },
    get swinging() {
      return st.swing;
    },
    get thrown() {
      return Boolean(st.thrown);
    },
    blades: segs,
    get charge() {
      return st.charge;
    },
    setCharge(k) {
      st.charge = Math.max(0, Math.min(1, k));
    },
    light(on) {
      if (st.on === on) return;
      st.on = on;
      sound?.(on ? 'ignite' : 'off');
    },
    // a stroke: a way held, the heavy one, else the next of the chain
    // (strokeFor); one under way may be cut once its contact window's passed.
    // The engine may refuse it (recoiling, staggered): null then
    swing(now, { heavy = false, dir = null, lock = null, clip: named = null } = {}) {
      if (st.thrown || !st_) return null;
      const cur = st.swing;
      if (cur && (now - cur.t0) * cur.speed < cur.contact[1]) return null;
      const k = strokeFor(st_, { last: cur ? { ...cur, endedAt: now } : st.last, now, dir, heavy });
      // (one named outright, as a peer's packet names theirs: that clip, its own window)
      if (named && named !== k.clip) {
        k.clip = named;
        k.contact = [...st_.strokes, ...st_.heavies].find((s) => s.clip === named)?.contact;
      }
      const clip = clipFor(k);
      const x = clip?.userData ?? {};
      const dur = clip?.duration ?? NO_CLIP.duration;
      // (the stroke's own window where its table measured one)
      const contact = k.contact ?? x.contact ?? NO_CLIP.contact;
      if (!sim.strike(now, { contact, dur: st_.cadence?.[k.clip]?.dur ?? dur })) return null;
      if (cur) st.last = { ...cur, endedAt: now };
      this.light(true);
      st.swing = {
        ...k,
        name: k.clip, // (what goes out online)
        t0: now,
        dur,
        contact,
        root: x.root ?? null,
        rootHips: x.rootHips ?? null,
        clip,
        lock: lock ?? null,
        picked: false,
        stop: null,
        yaw0: null,
        was: [0, 0],
        // (moving, the legs keep walking and the walk does the stepping)
        walk: st.move < 0.3,
      };
      if (st.swing.walk && clip) fig.play?.(packName(clip), { layer: 'full', speed: k.speed, fade: 0.08 });
      // (the blade's memory starts with the stroke: its trail is this stroke's)
      for (const seg of segs) seg.clear();
      sound?.(k.heavy ? 'heavy' : 'swing');
      st.charge = 0;
      return st.swing;
    },
    // a stroke dropped where it is, its clip let go: a duellist whose mark is gone
    cancel() {
      const sw = st.swing;
      if (!sw) return;
      st.last = { ...sw, endedAt: st.now };
      st.swing = null;
      sim.state.striking = null;
      if (sw.walk) fig.stop?.(0.2, 'full');
    },
    // the game's block for the side a cut comes in on as it goes up, the next
    // variant each raise, and again only when a cut comes in on the other
    // side; up only while the engine holds it (stamina lasting)
    block(on, side = null) {
      const up = sim.block(on && !st.swing && !st.thrown, st.now);
      if (up && !st.blocking) this.light(true);
      if (up && (!st.blocking || (side && side !== st.side))) {
        const was = st.blockClip ?? BLOCK_CLIP;
        // (a raise takes its turn once: a block held before the cut keeps it when the cut's side comes)
        if (!st.blocking) st.raise = st.raises++;
        st.side = side;
        st.blockClip = blockClipFor(st_?.blocks, side, (n) => Boolean(clips[n]), st.raise);
        if (clips[st.blockClip ?? BLOCK_CLIP] !== clips[was] && st.blockW > 0) {
          st.blockWas = was;
          st.blockSwitch = st.now;
        }
      }
      st.blocking = up;
    },
    get blockClip() {
      return st.blockClip ?? BLOCK_CLIP;
    },
    // the deflect's shield as the bolts see it (lib/combat/bolt.js's `blades`):
    // its shell in front while the block's up, a bolt from behind passing it
    guard(id = 'you', side = 'you') {
      if (!sim.deflecting || st.lit <= 0.5 || st.swing || st.thrown || !st.me) return null;
      const f = segs[0]?.history().at(-1);
      const me = st.me;
      return { id, side, test: (a, b) => shieldHit(rules, me, a, b), base: f?.base ?? [me.x, 1, me.z], tip: f?.tip ?? [me.x, 2, me.z], r: rules.shield.radius };
    },
    // a bolt it turned: the stamina it costs (damage, the game's)
    deflected(damage, now = st.now) {
      sim.takeBolt(damage, now);
    },
    dash: (now) => sim.dash(now),
    view: (now = st.now) => sim.view(now),
    // (how: the throw's numbers, saberRules.js's SABER.throw unless a hero has its own: abilityRules.js's throwOf)
    throw(now, dir, how = SABER.throw) {
      if (st.thrown || st.swing || !holder || gun.parent !== holder) return false;
      this.light(true);
      gun.updateWorldMatrix(true, false);
      const from = gun.getWorldPosition(new V());
      const flat = new V(dir.x, 0, dir.z);
      if (flat.lengthSq() < 1e-6) flat.set(0, 0, 1);
      (parent ?? gun.parent.parent).attach(gun);
      st.thrown = { t0: now, from, dir: flat.normalize(), hits: new Set(), how };
      st.swing = null;
      sound?.('throw');
      return true;
    },
    // after the figure's clips, before what poses over them: how much it's
    // going (0…1, as the figure's update has it), for the next stroke
    stand(dt, now, move = 0) {
      st.move = move;
    },
    // after gp.set: the blade's length, the clip's arms, the throw's flight, the engine
    update(dt, now, p) {
      eye = p?.eye ?? null;
      st.me = p.me ?? st.me;
      st.now = now;
      const want = st.on ? 1 : 0;
      st.lit += Math.sign(want - st.lit) * Math.min(Math.abs(want - st.lit), dt * LIGHT);
      const flicker = 0.5 + 0.12 * Math.sin(now * 37) + 0.05 * Math.sin(now * 61);
      for (const b of blades) {
        b.visible = st.lit > 0.01;
        b.scale.y = Math.max(0.001, st.lit);
      }
      if (sleeve) sleeve.material.opacity = flicker + st.charge * 0.35;
      if (core) core.scale.set(1 + st.charge * 0.6, 1, 1 + st.charge * 0.6);
      gp.twist?.(0);
      if (st.thrown) {
        fly(dt, now, p, p.targets ?? [], p.hit);
        // (its light goes with it)
        if (light && st.thrown) {
          ends(blades[0]);
          light.update(_base, _tip, st.lit, eye);
        }
        drawTrails(false);
        return;
      }
      if (st.swing) stroke(dt, now, p);
      else {
        // between strokes: the block (the game's clips hold the guard)
        const block = clips[st.blockClip ?? BLOCK_CLIP];
        const up = st.blocking && sim.deflecting && st.lit > 0.05;
        st.blockW = Math.max(0, Math.min(1, st.blockW + (up ? dt : -dt) * 8));
        const bw = st.blockW * Math.min(1, st.lit * 2);
        // (a block chosen again while up: the one before eased out under it)
        const was = st.blockWas && now - st.blockSwitch < SWITCH ? clips[st.blockWas] : null;
        if (was) lay(was, was.duration * BLOCK_AT, bw);
        if (block) lay(block, block.duration * BLOCK_AT, bw * (was ? (now - st.blockSwitch) / SWITCH : 1));
        pushBlades(now);
        drawTrails(false);
      }
      decide(dt, now, p);
      if (!sim.deflecting) st.blocking = false;
    },
    dark() {
      light?.dark();
    },
    dispose() {
      gone = true;
      if (st.thrown && holder) {
        holder.add(gun);
        gun.position.copy(local.pos);
        gun.quaternion.copy(local.quat);
        gun.scale.copy(local.scale);
      }
      for (const b of extra) b.removeFromParent();
      for (const m of worn) m.removeFromParent();
      for (const tr of trails) tr.dispose();
      light?.dispose();
    },
  };
}

// the blade's colour and the hilt's look, on the built hilt
export function dress(gun, color, hilt) {
  const sleeve = gun.getObjectByName('sleeve');
  if (sleeve) sleeve.material.color.set(color);
  if (!hilt) return;
  gun.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === 'grip' || o.name === 'metal' || o.name.startsWith('emitter')) o.material.color.set(hilt.metal);
    if (o.name === 'trim') o.material.color.set(hilt.trim);
    if (o.name.startsWith('emitter-')) o.visible = o.name === `emitter-${hilt.emitter}`;
  });
  // a curved hilt: the pommel's end bent back for the wrist
  const bend = hilt.grip === 'curved' ? 0.3 : 0;
  const stretch = (hilt.length ?? 0.28) - 0.28;
  gun.children.forEach((o) => {
    if (o.name === 'trim' && o.position.y < -0.08) {
      o.rotation.z = bend;
      o.position.x = bend * 0.03;
      o.position.y = Math.min(o.position.y, o.position.y - stretch);
    }
  });
}

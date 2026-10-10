// The other pilots down on the same world (online: universe/online/, each
// one's crew sent as protocol.js's walk): their two walking about where
// they are (or one of them riding what they're riding), eased toward each
// new place as it comes in so they don't jump, with the pilot's callsign
// over the one they're playing. Anyone who's taken off, gone to another
// world or gone quiet goes. A newer pilot's message says how each of them
// moves (protocol.js's `motion`: their clips paced to it, as yours are, so
// their feet don't skate) and what the lead's doing (an `emote`, timed from
// when it came in and played once: lib/emote.js); an older pilot's, without
// them, walks as it always did.
//
// createPeers({ parent, placer, getCast, rides?, models? }) → { update(net, siteId, dt, eye),
// dispose() } (eye: the camera's position, their lit blades' light out past
// 12 m of it: saberLight.js)

import * as THREE from 'three';
import { PARTY, loadPartyFigure } from '../../universe/footScene';
import { HEROES, heroSpec } from '../heroes';
import { readLooks } from '../../rickmorty/wardrobe/looks';
import { METRE } from '../../universe/foot';
import { RIDES as GALAXY_RIDES } from './rides';
import { SEATS, poseRider } from './riders';
import { buildFigure } from './figures';
import { modelFigure } from './actors';
import { createGunplay } from '../../universe/gunplay';
import { createSaber } from './saber';
import { HILTS } from '../heroes';
import { sharpen } from '../../../lib/three/textures';
import { applyEmote, heardEmote, readEmote } from '../../../lib/emote';

const CREW_MODELS = { artoo: 'r2d2' }; // (scene.js's)

const QUIET = 3000; // ms with nothing from them: gone
// (the crews, and the heroes anyone may be playing as: heroes.js)
const SPECS = Object.fromEntries([...Object.values(PARTY).flat(), ...HEROES.map((h) => heroSpec({ id: h.id, color: h.saber?.color ?? 'blue', hilt: h.saber?.hilt ?? 'skywalker' }))].map((s) => [s.id, s]));

function nameTag(text) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.font = '600 30px system-ui, sans-serif';
  const w = Math.min(248, g.measureText(text).width + 28);
  g.fillStyle = 'rgba(6, 8, 14, 0.62)';
  g.beginPath();
  g.roundRect((256 - w) / 2, 10, w, 44, 22);
  g.fill();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 33);
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
  s.scale.set(2.2, 0.55, 1);
  s.renderOrder = 10;
  return s;
}

export function createPeers({ parent, placer, getCast, rides: RIDES = GALAXY_RIDES, models = undefined, only = false }) {
  const group = new THREE.Group();
  group.name = 'peers';
  parent.add(group);
  const shown = new Map(); // peer id → { walkers: [{ who, holder, fig, st }], ride, tag, name }
  let dead = false;

  // (looks: how that pilot dresses their Rick and Morty; the show's if they've sent none)
  // (arms: what the packet says is in their hand, { gun, lit, color, stance, swing }; the spec's own gun without it)
  const walker = (who, looks = null, arms = null) => {
    const holder = new THREE.Group();
    group.add(holder);
    const w = { who, holder, fig: null, gp: null, saber: null, st: null, gun: arms?.gun ?? SPECS[who]?.gun ?? null, swung: false };
    const spec = SPECS[who];
    if (spec)
      (async () => {
        const own = CREW_MODELS[who] ? await modelFigure(CREW_MODELS[who]).catch(() => null) : null;
        if (!own && spec.src.meshy) await getCast()?.load(null, [spec.src.meshy]).catch(() => {});
        const fig = own ?? (await loadPartyFigure(spec, getCast(), looks ?? readLooks(null)).catch(() => null));
        if (!fig || dead || !holder.parent) return;
        const inner = new THREE.Group();
        if (!own) inner.scale.setScalar(1 / METRE);
        inner.add(fig.model);
        holder.add(inner);
        w.fig = fig;
        w.own = Boolean(own);
        // their gun, in the hand (up as far as they say theirs is); a saber lit as theirs is
        if (w.gun && !own) {
          holder.updateMatrixWorld(true);
          w.gp = createGunplay(fig, fig.gun ?? w.gun, { unit: 1, who: fig.built ? 'built' : who });
          if (w.gun === 'saber' && w.gp) w.saber = createSaber(w.gp, { color: arms?.color || spec.saber?.color || '#4aa8ff', hilt: HILTS.find((h) => h.id === spec.saber?.hilt?.id) ?? spec.saber?.hilt ?? null, stance: arms?.stance ?? spec.saber?.stance ?? 'single', parent: group, fig });
        }
      })();
    return w;
  };
  const drop = (id) => {
    const e = shown.get(id);
    if (!e) return;
    for (const w of e.walkers) {
      w.saber?.dispose();
      w.gp?.dispose();
      w.fig?.dispose?.();
      w.holder.removeFromParent();
    }
    e.ride?.holder.removeFromParent();
    e.ride?.fig?.dispose?.();
    e.tag.material.map.dispose();
    e.tag.material.dispose();
    e.tag.removeFromParent();
    shown.delete(id);
  };
  const rideOf = (kind) => {
    const holder = new THREE.Group();
    group.add(holder);
    const r = { kind, holder, fig: null };
    const spec = RIDES[kind];
    if (spec?.figure) {
      // (a world that takes models only waits for the model: cast.js)
      r.fig = only ? null : buildFigure(spec.figure);
      if (r.fig) holder.add(r.fig.model);
      // (its catalogue model once it's here, as yours is: the seat's measured on it)
      modelFigure(spec.figure, models)
        .then((m) => {
          if (!m || dead || !holder.parent) return;
          if (r.fig) holder.remove(r.fig.model);
          r.fig?.dispose?.();
          holder.add(m.model);
          r.fig = m;
        })
        .catch(() => {});
    } else
      placer.put({ kind, at: [0, 0], abs: true, solid: false }).then((o) => {
        if (!o || dead || !holder.parent) return;
        o.position.set(0, 0, 0);
        o.rotation.set(0, 0, 0);
        holder.add(o);
      });
    return r;
  };

  const ease = (st, to, dt) => {
    const k = 1 - Math.exp(-dt * 10);
    if (!st.x && st.x !== 0) Object.assign(st, to);
    st.x += (to.x - st.x) * k;
    st.y += (to.y - st.y) * k;
    st.z += (to.z - st.z) * k;
    st.yaw += Math.atan2(Math.sin(to.yaw - st.yaw), Math.cos(to.yaw - st.yaw)) * k;
    st.speed = to.speed;
    st.aim = to.aim ?? 0;
  };
  const UP = new THREE.Vector3(0, 1, 0);
  const fwd = new THREE.Vector3();

  return {
    group,
    update(net, siteId, dt, eye = null) {
      const now = performance.now();
      const live = new Set();
      for (const p of net?.peers?.values?.() ?? []) {
        const w = p.walk;
        if (p.blocked || !w || w.world !== siteId || now - w.at > QUIET) continue;
        live.add(p.id);
        let e = shown.get(p.id);
        if (!e) {
          e = { walkers: [], ride: null, tag: nameTag(p.name ?? 'Pilot'), name: p.name };
          group.add(e.tag);
          shown.set(p.id, e);
        }
        const want = [w.lead, w.mate].filter(Boolean);
        // (a new crew, or a swap: the figures follow who's who)
        want.forEach((s, i) => {
          // (a new crew, a swap, or a different gun in the hand: the figure's made again)
          if (e.walkers[i]?.who !== s.who || (s.arms && e.walkers[i]?.gun !== s.arms.gun)) {
            if (e.walkers[i]) {
              e.walkers[i].holder.removeFromParent();
              e.walkers[i].saber?.dispose();
              e.walkers[i].gp?.dispose();
              e.walkers[i].fig?.dispose?.();
            }
            e.walkers[i] = walker(s.who, p.looks, s.arms);
            e.walkers[i].st = { ...s };
          }
          const wk = e.walkers[i];
          ease(wk.st, s, dt);
          wk.holder.position.set(wk.st.x, wk.st.y, wk.st.z);
          wk.holder.rotation.y = wk.st.yaw;
          const going = i === 0 && w.ride ? 0 : Math.min(1, Math.abs(wk.st.speed) / 7.4);
          // (how they say they're moving, in metres a second, to locomotion.js
          // in the map's units as yours goes; an older pilot's, a rider's, or
          // a droid's own model: the old pace)
          const m = s.motion && !(i === 0 && w.ride) && !wk.own ? { speed: s.motion.speed * METRE, side: s.motion.side * METRE, turn: s.motion.turn, air: 0 } : null;
          if (m) wk.fig?.update(dt, going, m);
          else wk.fig?.update(dt, going);
          if (!(i === 0 && w.ride)) wk.saber?.stand(dt, now / 1000, going); // (how much they go: walking, a stroke leaves their legs to the walk)
          if (m && wk.fig?.after) {
            wk.holder.updateMatrixWorld(true);
            wk.fig.after(dt, m, { forward: fwd.set(Math.sin(wk.st.yaw), 0, Math.cos(wk.st.yaw)), up: UP });
            const drop = wk.fig.loco?.drop ?? 0;
            if (drop > 1e-7) wk.holder.position.y -= drop / METRE;
          }
          // what they're doing: an emote, timed from when its message came in, played once (none riding)
          wk.emote = heardEmote(s.emote ?? null, w.at / 1000, wk.emote);
          wk.shown = applyEmote(wk.fig, i === 0 && w.ride ? null : readEmote(wk, now / 1000), wk.shown);
          if (wk.gp) {
            const riding = i === 0 && Boolean(w.ride);
            wk.gp.gun.visible = !riding;
            if (!riding) {
              wk.holder.updateMatrixWorld(true);
              const lit = Boolean(s.arms?.lit);
              wk.gp.set(dt, { aim: wk.saber && lit ? Math.max(wk.st.aim ?? 0, 0.75) : (wk.st.aim ?? 0), forward: fwd.set(Math.sin(wk.st.yaw), 0, Math.cos(wk.st.yaw)), up: UP });
              if (wk.saber) {
                // their blade as they say it is: lit or not, and a stroke each time the packet says one's on
                wk.saber.light(lit);
                // (a new stroke when they start swinging, or chain on to another clip: the one they're playing)
                if (s.arms?.swing && (!wk.swung || (s.arms.stroke && s.arms.stroke !== wk.stroke))) wk.saber.swing(now / 1000, { clip: s.arms.stroke ?? null });
                wk.swung = Boolean(s.arms?.swing);
                wk.stroke = s.arms?.stroke ?? null;
                wk.saber.update(dt, now / 1000, { forward: fwd, up: UP, me: { x: wk.st.x, z: wk.st.z, yaw: wk.st.yaw }, targets: [], eye });
              }
            } else wk.saber?.dark(); // (put away to ride: its light goes)
          }
        });
        for (let i = want.length; i < e.walkers.length; i++) {
          e.walkers[i].holder.removeFromParent();
          e.walkers[i].saber?.dispose();
          e.walkers[i].gp?.dispose();
          e.walkers[i].fig?.dispose?.();
        }
        e.walkers.length = want.length;
        // what they're riding, under the one riding it
        if ((e.ride?.kind ?? null) !== w.ride) {
          e.ride?.holder.removeFromParent();
          e.ride = w.ride ? rideOf(w.ride) : null;
        }
        const lead = e.walkers[0];
        if (e.ride && lead) {
          // (riding, where they are is where what they ride is: they sit on it)
          const spec = RIDES[e.ride.kind];
          const { x, y, z, yaw } = lead.st;
          e.ride.holder.position.set(x, y, z);
          e.ride.holder.rotation.y = yaw;
          e.ride.fig?.update(dt, Math.min(1, Math.abs(lead.st.speed) / 6));
          const [sx, sy, sz] = spec.seat;
          lead.holder.position.set(x + sx * Math.cos(yaw) + sz * Math.sin(yaw), y + sy - 0.55, z - sx * Math.sin(yaw) + sz * Math.cos(yaw));
          // sat in it as you are (riders.js): its sat clip, then the hips on
          // its seat and the hands and feet on its controls
          if (lead.fig && lead.seat !== e.ride.kind) {
            lead.seat = e.ride.kind;
            lead.fig.base?.(spec.hover > 0 || spec.fly ? 'drive' : 'sit')?.catch?.(() => {});
          }
          if (SEATS[e.ride.kind] && lead.fig) {
            e.ride.holder.updateMatrixWorld(true);
            poseRider(lead.fig, lead.holder, e.ride.holder.matrixWorld, SEATS[e.ride.kind]);
          }
        } else if (lead?.seat) {
          lead.seat = null;
          lead.fig?.base?.(null)?.catch?.(() => {});
        }
        if (lead) e.tag.position.set(lead.st.x, lead.st.y + 2.45, lead.st.z);
      }
      for (const id of [...shown.keys()]) if (!live.has(id)) drop(id);
    },
    dispose() {
      dead = true;
      for (const id of [...shown.keys()]) drop(id);
      group.removeFromParent();
    },
  };
}

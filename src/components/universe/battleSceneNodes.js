// A battle at the front, drawn (battleScene.js) on the node renderer: the
// same scene from the same calls, line for line, but for what it draws
// with. The bolts, the engine glows, the defender’s shield, the markers
// and the fires are battleFxNodes.js’s, and the explosions the galaxy’s
// flashes on nodes (galaxy/nodes/fx.js). What the plan lays out in the open
// is battleProps.js’s, as before: it has no shader of its own, and the node
// renderer draws its standard and basic materials as their node twins.
//
// The broken flagship’s halves are each cut by a ClippingGroup holding the
// plane: the node renderer reads no material’s clippingPlanes (three r186
// clips by the group alone), so each half is put in a group of its own,
// at the parent’s origin, and its materials keep the plane too.
//
// createBattleScene(parent, { models, small, reduced, metres }) → { show(battle,
//   war), hide(), update(dt, t, camera, camLocal, events, youTeam, extra) → busy,
//   halves, flash(at, opts), burn(at, size), dispose() }
// `extra`: more markers ({ key, pos, title, sub?, hp?, colour }), the set
// pieces’ (galaxy/warpieces/); flash and burn are theirs too.
// Everything is in `parent`’s space (the map’s).

import * as THREE from 'three';
import { ClippingGroup } from 'three/webgpu';
import { createFlashes } from '../galaxy/nodes/fx';
import { GLOW, createBoltDraw, createFires, createGlows, createMarkers, createShield, glowAt } from './battleFxNodes';
import { createProps } from './battleProps';
import { titleOf } from './battleObjectives';
import { basisOf, bobOf } from '../../lib/combat/pose';

const NAMES = { shieldgen: 'Shield generator', bridge: 'Bridge', reactor: 'Reactor' };
// a runner, as its marker names it (and its number in the battle)
const RUNNERS = { transport: 'transport', corvette: 'corvette', gozanti: 'Gozanti', nubian: 'Nubian', shuttle: 'shuttle' };
const METRES = 40; // a map unit, in metres (an X-wing's about a third of a unit; the galaxy's is 53)
const far = (a, b, metres = METRES) => {
  const m = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) * metres;
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`;
};
const ATTACK = '#ffb347';
const DEFEND = '#7cc8ff';
const clockOf = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function createBattleScene(parent, { models, small = false, reduced = false, metres = METRES } = {}) {
  const flashes = createFlashes(parent, { count: small ? 40 : 96 });
  const bolts = createBoltDraw(parent, { count: 320 });
  const glows = createGlows(parent, { count: 96 });
  const shield = createShield(parent);
  const markers = createMarkers(parent);
  const fires = createFires(parent);
  const props = createProps(parent);
  const slots = new Map(); // a ship (battle.js's fighter or capital) → its slot
  const halves = []; // the broken flagship's two halves
  let battle = null;
  let war = null;
  let chain = 0; // seconds to the next explosion down a dying ship
  let seenRunners = 0; // the battle's runners given slots, so far
  let seenFighters = 0; // and its fighters (a bomber wave's come later)
  const basis = new THREE.Matrix4();
  const vx = new THREE.Vector3();
  const vy = new THREE.Vector3();
  const vz = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const pt = new THREE.Vector3();

  // a slot turned to fly along `fwd`, its top toward `up`, banked by `bank`
  // (combat/pose.js's axes: the hull tests turn a ship the same way)
  const orient = (holder, fwd, up, bank = 0) => {
    const b = basisOf(fwd, up, bank);
    vx.set(b[0], b[1], b[2]);
    vy.set(b[3], b[4], b[5]);
    vz.set(b[6], b[7], b[8]);
    basis.makeBasis(vx, vy, vz);
    holder.quaternion.setFromRotationMatrix(basis);
  };

  const slotFor = (ship, kind, size) => {
    let s = slots.get(ship);
    if (!s) {
      s = models.slot(kind, size);
      parent.add(s.holder);
      slots.set(ship, s);
    }
    return s;
  };

  // a side's shots and engines at the battle's brightness (battleFx's GLOW,
  // the same on every side), worked out once a side
  const hot = new WeakMap();
  const hotOf = (side) => {
    let h = hot.get(side);
    if (!h) {
      const [r, g, b] = side.laser;
      h = {
        laser: glowAt(side.laser, GLOW.laser),
        turbo: glowAt(side.turbo, GLOW.turbo),
        flak: glowAt([r * 0.8 + 1.2, g * 0.6 + 0.8, b * 0.4 + 0.2], GLOW.flak),
        engine: glowAt([r * 0.35 + 0.5, g * 0.35 + 0.35, b * 0.35 + 0.25], GLOW.engine),
      };
      hot.set(side, h);
    }
    return h;
  };
  const colourOf = (b) => {
    const h = hotOf(war.sides[b.team]);
    return b.kind === 'turbo' ? h.turbo : b.kind === 'flak' ? h.flak : h.laser;
  };

  // a random point on a capital's hull (one of its spheres' surfaces)
  const onHull = (cap, out) => {
    const sp = cap.spheres[Math.floor(Math.random() * cap.spheres.length)];
    tmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    return out.set(sp.c.x + tmp.x * sp.r, sp.c.y + tmp.y * sp.r * 0.6, sp.c.z + tmp.z * sp.r);
  };

  // the flagship broken in two: its model copied twice, each cut by a plane
  // through the middle and drifting off its own way
  const breakUp = (cap, slot) => {
    const fwd = new THREE.Vector3(cap.fwd.x, cap.fwd.y, cap.fwd.z);
    for (const sign of [1, -1]) {
      const g = slot.holder.clone(true);
      const plane = new THREE.Plane();
      const owned = [];
      g.traverse((o) => {
        if (!o.isMesh) return;
        const swap = (m) => {
          const n = m.clone();
          n.clippingPlanes = [plane];
          n.side = THREE.DoubleSide; // (the inside shows through the cut)
          owned.push(n);
          return n;
        };
        o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
      });
      const clip = new ClippingGroup();
      clip.clippingPlanes = [plane];
      clip.add(g);
      parent.add(clip);
      const axis = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
      halves.push({ g, clip, plane, sign, owned, vel: fwd.clone().multiplyScalar(0.5 * sign).add(new THREE.Vector3(0, -0.12 * sign, 0)), axis, spin: 0.035 * sign, cut: new THREE.Vector3(cap.pos.x, cap.pos.y, cap.pos.z), size: cap.size });
    }
    slot.holder.visible = false;
    // fire along the break
    for (let i = 0; i < 5; i++) fires.add({ x: cap.pos.x + (Math.random() - 0.5) * cap.size * 0.2, y: cap.pos.y + (Math.random() - 0.5) * cap.size * 0.05, z: cap.pos.z + (Math.random() - 0.5) * cap.size * 0.2 }, cap.size * 0.05);
    flashes.at(pt.set(cap.pos.x, cap.pos.y, cap.pos.z), { size: Math.min(cap.size * 0.4, 20), life: 2.6, color: [2.8, 1.4, 0.5] });
  };
  const moveHalves = (dt) => {
    for (const h of halves) {
      h.g.position.addScaledVector(h.vel, dt);
      h.g.rotateOnWorldAxis(h.axis, h.spin * dt);
      h.cut.addScaledVector(h.vel, dt);
      // the plane in the world, through the half's own cut, keeping its own side
      h.g.updateMatrixWorld(true);
      vz.set(0, 0, 1).transformDirection(h.g.matrixWorld).multiplyScalar(h.sign);
      parent.localToWorld(pt.copy(h.cut));
      h.plane.setFromNormalAndCoplanarPoint(vz, pt);
    }
  };

  const onEvent = (e) => {
    if (e.type === 'down') flashes.at(pt.set(e.at.x, e.at.y, e.at.z), { size: 1.5, life: 0.9 });
    else if (e.type === 'turret') {
      flashes.at(pt.set(e.at.x, e.at.y, e.at.z), { size: 2.2, life: 1, color: [2.8, 1.5, 0.5] });
      fires.add(e.at, 0.4);
    } else if (e.type === 'disabled') {
      // an ion cannon's hit: a blue crackle over the ship
      for (let i = 0; i < 4; i++) flashes.at(pt.set(e.at.x + (Math.random() - 0.5) * e.size * 0.6, e.at.y + (Math.random() - 0.2) * e.size * 0.15, e.at.z + (Math.random() - 0.5) * e.size * 0.6), { size: e.size * 0.18, life: 1.2, color: [0.6, 1.4, 3.4] });
    } else if (e.type === 'escaped') flashes.at(pt.set(e.at.x, e.at.y, e.at.z), { size: 6, life: 0.7, color: [1.2, 1.8, 3.2] });
    else if (e.type === 'runner') {
      flashes.at(pt.set(e.at.x, e.at.y, e.at.z), { size: 5, life: 1.4, bright: 1.2 });
      const r = battle.runners.find((o) => o.id === e.id);
      const slot = r && slots.get(r);
      if (slot) slot.holder.visible = false;
    }
    else if (e.type === 'arrive') flashes.at(pt.set(e.at.x, e.at.y, e.at.z), { size: 0.9, life: 0.45, color: [0.7, 1.0, 2.2] });
    else if (e.type === 'impact') {
      flashes.at(pt.set(e.at.x, e.at.y, e.at.z), { size: e.size * (e.shield ? 0.8 : 1.2), life: e.shield ? 0.5 : 0.8, color: e.shield ? [0.5, 1.2, 2.6] : [2.6, 1.3, 0.4] });
      if (e.shield) shield.hit(e.at);
    } else if (e.type === 'shield') shield.drop();
    else if (e.type === 'sub') {
      flashes.at(pt.set(e.at.x, e.at.y, e.at.z), { size: 6, life: 1.6, bright: 1.3 });
      fires.add(e.at, 1.2);
    } else if (e.type === 'jumped') {
      // gone to hyperspace: a white-blue streak of light where it was (none for one gone before you came)
      const cap = battle.capitals.find((c) => c.id === e.id);
      const slot = cap && slots.get(cap);
      if (slot) slot.holder.visible = false;
      if (!e.late) {
        flashes.at(pt.set(e.at.x, e.at.y, e.at.z), { size: Math.min(e.size * 0.5, 20), life: 0.6, color: [1.6, 2.2, 3.6] });
        if (cap) flashes.at(pt.set(e.at.x + cap.fwd.x * e.size * 0.6, e.at.y + cap.fwd.y * e.size * 0.6, e.at.z + cap.fwd.z * e.size * 0.6), { size: e.size * 0.25, life: 0.8, color: [1.2, 1.8, 3.4] });
      }
    } else if (e.type === 'capital') {
      const cap = battle.capitals.find((c) => c.id === e.id);
      const slot = cap && slots.get(cap);
      if (!cap || !slot) return;
      if (cap.role === 'flagship' && cap.team === battle.defender) breakUp(cap, slot);
      else {
        flashes.at(pt.set(cap.pos.x, cap.pos.y, cap.pos.z), { size: Math.min(cap.size * 0.45, 24), life: 2 });
        slot.holder.visible = false;
      }
    }
  };

  return {
    show(b, w) {
      this.hide();
      battle = b;
      war = w;
      models.want([...new Set([...b.capitals.map((c) => c.kind), ...b.fighters.map((f) => f.kind)])]);
      for (const cap of b.capitals) {
        const s = slotFor(cap, cap.kind, cap.size);
        s.holder.position.set(cap.pos.x, cap.pos.y, cap.pos.z);
        orient(s.holder, cap.fwd, cap.up);
      }
      for (const f of b.fighters) slotFor(f, f.kind, f.size);
      seenFighters = b.fighters.length;
      seenRunners = 0;
      // (the ship the objectives are on: the defender's flagship, or an
      // interdiction's Interdictor; shielded while its shield's up, which
      // with a plan is while a stage that shields it stands)
      const obj = b.capitals.find((c) => c.objective);
      if (obj && (b.shieldUp ?? b.phase === 1)) shield.show(obj, null);
      props.show(b.objectives ?? []);
    },

    hide() {
      for (const s of slots.values()) models.drop(s);
      slots.clear();
      for (const h of halves) {
        h.clip.removeFromParent();
        for (const m of h.owned) m.dispose();
      }
      halves.length = 0;
      shield.hide();
      markers.hide();
      props.hide();
      fires.clear();
      bolts.sync([], colourOf);
      glows.begin();
      glows.end();
      battle = null;
    },

    get halves() {
      return halves.length;
    },
    // a ship hidden or shown (the set pieces': the Executor gone into the Death Star)
    setVisible(ship, on) {
      const s = slots.get(ship);
      if (s) s.holder.visible = on;
    },
    // the set pieces' own (galaxy/warpieces/): a burst of light, and something left burning
    flash(at, opts) {
      flashes.at(pt.set(at.x, at.y, at.z), opts);
    },
    burn(at, size) {
      fires.add(at, size);
    },

    // events: what battle.update said this frame; youTeam: the side you fly
    // for (null: not joined yet)
    update(dt, t, camera, camLocal, events = [], youTeam = null, extra = null) {
      if (!battle) return false;
      // runners and fighters added since (the set pieces add runners as the battle goes, a plan its bomber waves)
      while (seenRunners < battle.runners.length) {
        const r = battle.runners[seenRunners++];
        slotFor(r, r.kind, r.size);
      }
      while (seenFighters < battle.fighters.length) {
        const f = battle.fighters[seenFighters++];
        slotFor(f, f.kind, f.size);
      }
      for (const e of events) onEvent(e);
      // the capital ships (riding a little at anchor), and a dying one's explosions
      chain -= dt;
      for (const cap of battle.capitals) {
        const s = slots.get(cap);
        if (!s || !s.holder.visible || cap.gone || cap.jumped) continue;
        const bob = bobOf(cap, t, reduced);
        s.holder.position.set(cap.pos.x, cap.pos.y + bob, cap.pos.z);
        if (cap.moved) orient(s.holder, cap.fwd, cap.up); // (turned by a set piece, the Scarif ram, the Executor's dive, or the fleet's push)
        if (cap.dying > 0 && chain <= 0) flashes.at(onHull(cap, pt), { size: 1.5 + Math.random() * cap.size * 0.08, life: 0.9 + Math.random() * 0.6 });
      }
      if (chain <= 0) chain = 0.12;
      // the fighters, and their engines (where the battle has them by now: its
      // step's 1/30 s, so each is carried on from its last step, `seen`)
      glows.begin();
      for (const f of battle.fighters) {
        const s = slots.get(f);
        if (!s) continue;
        s.holder.visible = f.alive;
        if (!f.alive) continue;
        const p = f.seen ?? f.pos;
        s.holder.position.set(p.x, p.y, p.z);
        orient(s.holder, f.fwd, { x: 0, y: 1, z: 0 }, f.bank);
        glows.add({ x: p.x - f.fwd.x * f.size * 0.55, y: p.y - f.fwd.y * f.size * 0.55, z: p.z - f.fwd.z * f.size * 0.55 }, hotOf(war.sides[f.team]).engine, f.size * 0.4);
      }
      for (const r of battle.runners) {
        const s = slots.get(r);
        if (!s) continue;
        s.holder.visible = r.alive;
        if (!r.alive) continue;
        const p = r.seen ?? r.pos;
        s.holder.position.set(p.x, p.y, p.z);
        orient(s.holder, r.fwd, { x: 0, y: 1, z: 0 });
        glows.add({ x: p.x - r.fwd.x * r.size * 0.5, y: p.y - r.fwd.y * r.size * 0.5, z: p.z - r.fwd.z * r.size * 0.5 }, [1.6, 2.2, 3.4], r.size * 0.35);
      }
      // (a glow's size in map units: the canvas's height over the view's height a unit off)
      const high = typeof window !== 'undefined' ? window.innerHeight : 800;
      glows.end(camera?.isPerspectiveCamera ? high / (2 * Math.tan((camera.fov * Math.PI) / 360)) : 600);
      bolts.sync(battle.bolts, colourOf, camLocal, battle.ahead ?? 0);
      flashes.update(dt, camera);
      shield.update(dt, t);
      fires.update(dt, t);
      props.update(dt, t, battle, youTeam);
      moveHalves(dt);
      // the objectives of the phase, marked (to destroy, if you attack; to
      // hold, if you defend), the attacker's flagship for a defender, and the runners
      const list = [];
      if (youTeam !== null && !battle.over) {
        const obj = battle.capitals.find((c) => c.objective);
        const attack = youTeam === battle.attacker;
        let n = 0;
        if (battle.objectives) {
          // a plan's: the stage that's on, in the plan's words (or, behind its gate, what's next and when)
          for (const o of battle.objectives) {
            if (!o.alive || o.hidden || o.phase !== battle.phase) continue;
            const open = battle.stageOpen !== false;
            if (open && o.after && battle.isOpen && !battle.isOpen(o)) continue; // (the dock, till the engines it waits on are down)
            const title = open ? titleOf(o, attack) : `Next: ${o.name}`;
            const sub = open ? far(o.pos, camLocal, metres) : `opens in ${clockOf(battle.opensIn ?? 0)} · ${far(o.pos, camLocal, metres)}`;
            list.push({ key: o.key, pos: o.pos, title, sub, hp: o.hp / o.hpMax, colour: attack ? ATTACK : DEFEND, under: n++ % 2 === 1 });
          }
        } else
          for (const sub of obj?.subs ?? []) {
            if (!sub.alive || sub.phase !== battle.phase) continue;
            // (the two generators sit close: the second's card hangs under its point, not over it)
            list.push({ key: sub.id, pos: sub.pos, title: `${attack ? 'Destroy' : 'Defend'}: ${NAMES[sub.kind]}`, sub: far(sub.pos, camLocal, metres), hp: sub.hp / sub.hpMax, colour: attack ? ATTACK : DEFEND, under: n++ % 2 === 1 });
          }
        if (!attack) {
          const theirs = battle.capitals.find((c) => c.team === battle.attacker && c.role === 'flagship' && c.alive);
          if (theirs) list.push({ key: 'their-flag', pos: { x: theirs.pos.x, y: theirs.pos.y + theirs.size * 0.15, z: theirs.pos.z }, title: 'Destroy: their flagship', sub: far(theirs.pos, camLocal, metres), hp: theirs.hull / theirs.hullMax, colour: ATTACK });
        }
        // the runners for the jump, every battle's (an evacuation's, a
        // blockade's, the set pieces'), where they're drawn: yours to cover,
        // theirs to stop
        battle.runners.forEach((r, i) => {
          if (!r.alive) return;
          const ours = r.team === youTeam;
          const p = r.seen ?? r.pos;
          list.push({ key: `runner-${r.id}`, pos: p, title: `${ours ? 'Protect' : 'Stop'}: ${RUNNERS[r.kind] ?? r.kind} ${(r.slot ?? i) + 1}`, sub: far(p, camLocal, metres), hp: r.hp / r.hpMax, colour: ours ? DEFEND : ATTACK });
        });
      }
      if (extra) for (const m of extra) list.push({ ...m, sub: m.sub ?? far(m.pos, camLocal, metres) });
      markers.sync(list);
      models.update?.(t);
      return true;
    },

    dispose() {
      this.hide();
      flashes.dispose();
      bolts.dispose();
      glows.dispose();
      shield.dispose();
      markers.dispose();
      fires.dispose();
      props.dispose();
    },
  };
}

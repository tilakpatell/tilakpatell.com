// The Battle of Endor's set pieces (Return of the Jedi):
// - The second Death Star's shield is up, held by its generator on the
//   forest moon's surface, under the station: a bunker and its dish, its
//   anti-air guns firing at anyone who comes down to it. Knock it out and the
//   shield drops (world.js's war.holdShield).
// - The Death Star's superlaser is operational: every minute and a bit it
//   fires on one of the Rebel cruisers, and that cruiser's gone.
// - When the Executor's bridge goes it loses control, turns, and dives into
//   the Death Star.
// - With the shield down, the reactor run: in through the superstructure
//   (run.js), down to the main reactor, shoot it, and out before the station
//   goes up. When it goes, the Rebellion's won.
//
// The generator and the reactor are the Rebellion's to take (team 0's),
// whether it's attacking Endor or holding it: only its pilots' shots count
// on them (ctx.mineAs), and the station's fall ends the battle only when
// it's the Empire the Rebellion's fighting there.
//
// In the battle every pilot shares (the Rebellion attacking: the films'
// plan, pinned, galaxy/battlePlans.js), the generator and the reactor are
// the plan's objectives: their hp, their fall and when the run opens (the
// Executor's bridge down, its gate passed) are the director's
// (ctx.objective), and so is the battle's end: the station going up is the
// end the director's already called, not one of its own. The superlaser's
// shots are the plan's too, whoever's attacking (its losses `by` the
// superlaser, ctx.losses, on the shared clock, ctx.clock): the beam is fired
// to meet the cruiser the plan loses as it loses it, so every pilot sees the
// same ships go when they do, and one who comes late sees no shot at a ship
// long gone.
//
// createEndor(ctx) → { update(dt, t, live, events), hit, targets,
//   markers(live), dispose() }

import * as THREE from 'three';
import { sweptHit } from '../../../lib/combat/flight/targeting';
import { GCW, seeded } from '../gcw';
import { tunnelPath } from '../tunnel';
import { createRun } from './run';
import { buildBeam, createShockwave } from '../stationFx';

const REBELS = 0;
const EMPIRE = 1;
const GEN_HP = 26;
const BEAM_HIT = 1.9; // seconds from the superlaser's charge to the ship it's on gone
const ZERO = { x: 0, y: 0, z: 0 };
const v = (x, y, z) => ({ x, y, z });
const len = (a) => Math.hypot(a.x, a.y, a.z);
const unit = (a) => {
  const l = len(a) || 1;
  return v(a.x / l, a.y / l, a.z / l);
};

// the shield generator: a bunker, a dish on a mast, a light on top
function buildGenerator() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#7c8079', roughness: 0.75, metalness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: '#3a3d39', roughness: 0.9, metalness: 0.2 });
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.2, 0.5), toneMapped: false });
  const geos = [new THREE.BoxGeometry(3.4, 1, 2.2), new THREE.CylinderGeometry(0.18, 0.24, 2.2, 8), new THREE.SphereGeometry(1.7, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), new THREE.SphereGeometry(0.16, 8, 6), new THREE.BoxGeometry(0.9, 0.5, 0.9)];
  const bunker = new THREE.Mesh(geos[0], dark);
  bunker.position.y = 0.5;
  const mast = new THREE.Mesh(geos[1], metal);
  mast.position.y = 2;
  const dish = new THREE.Mesh(geos[2], metal);
  dish.material = metal;
  dish.rotation.x = Math.PI; // (open to the sky)
  dish.position.y = 3.6;
  dish.scale.y = 0.5;
  const light = new THREE.Mesh(geos[3], glow);
  light.position.y = 3.4;
  group.add(bunker, mast, dish, light);
  for (const [x, z] of [
    [-2.6, 1.6],
    [2.6, -1.6],
  ]) {
    const gun = new THREE.Mesh(geos[4], dark);
    gun.position.set(x, 0.25, z);
    group.add(gun);
  }
  return { group, dispose: () => (geos.forEach((g) => g.dispose()), metal.dispose(), dark.dispose(), glow.dispose()) };
}

export function createEndor(ctx) {
  const { battle, sys, world } = ctx;
  const ds = sys.pieces.find((p) => p.type === 'station' && p.kind === 'deathstar2');
  const D = v(...ds.at);
  const R = ds.size * 0.47;
  const moonR = sys.body.r;
  const rand = seeded(`${ctx.on.id}-endor`);
  // the shield held up till its generator's gone
  world?.war?.holdShield(true);
  // (the plan's objectives, if it's the battle every pilot shares)
  const planned = (id) => ctx.objective?.(id) ?? null;
  const shared = Boolean(planned('moon-gen'));
  const genLeft = () => (shared ? planned('moon-gen').hp : Math.max(0, GEN_HP - ctx.shared('moon-gen')));
  const genMax = shared ? planned('moon-gen').hpMax : GEN_HP;
  const genGone = () => (shared ? planned('moon-gen').down : ctx.shared('moon-gen') >= GEN_HP);

  // ── the shield generator, on the moon under the station ──
  const up = unit(v(D.x + moonR * 0.25, D.y, D.z - moonR * 0.15));
  const genAt = v(up.x * (moonR + 0.2), up.y * (moonR + 0.2), up.z * (moonR + 0.2));
  const genTop = v(genAt.x + up.x * 2, genAt.y + up.y * 2, genAt.z + up.z * 2);
  const gen = buildGenerator();
  gen.group.position.set(genAt.x, genAt.y, genAt.z);
  gen.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(up.x, up.y, up.z));
  ctx.scene?.add(gen.group);
  let genDown = false;
  let flak = 0;
  const genTgt = { id: 5.1e6, at: genTop, vel: ZERO, size: 1.8, kind: 'shieldgen', name: 'Shield generator', hp: genMax, hpMax: genMax, threat: 0 };
  const knockOut = (mine) => {
    if (genDown) return;
    genDown = true;
    world?.war?.holdShield(false);
    ctx.draw?.flash(genTop, { size: 9, life: 2, color: [3, 1.5, 0.5], bright: 1.4 });
    ctx.draw?.burn(genAt, 1.6);
    gen.group.visible = false;
    ctx.event('gcw-shieldgen');
    if (mine) ctx.points(GCW.points.objective);
  };

  // ── the superlaser ──
  // (its spin held while the war's on, turned so its dish faces the Rebel
  // fleet: world.js's face, the dish's place on the model stationFx.js's)
  const fleet = battle.capitals.filter((c) => c.team === REBELS);
  if (fleet.length) world?.war?.face?.('deathstar2', v(fleet.reduce((a, c) => a + c.pos.x, 0) / fleet.length, fleet.reduce((a, c) => a + c.pos.y, 0) / fleet.length, fleet.reduce((a, c) => a + c.pos.z, 0) / fleet.length));
  const beam = buildBeam();
  ctx.scene?.add(beam.mesh);
  // (and when it goes up, a ring of fire running out round its equator)
  const shock = ctx.scene ? createShockwave(ctx.scene) : null;
  let nextShot = 50 + rand() * 30;
  let shot = null; // { target, age, from? }
  // (in the battle every pilot shares, its shots are the plan's losses: each
  // cruiser it takes, and when, the same for everyone, the beam fired to
  // meet it, not on a timer of its own from when you came)
  const scheduled = Boolean(ctx.losses?.());
  const fired = new Set();
  const capOf = (l) => battle.capitals.filter((c) => c.team === l.team)[l.index] ?? null;
  const nextScheduled = () => {
    const now = ctx.clock();
    for (const l of ctx.losses() ?? []) {
      const key = `${l.team}:${l.index}`;
      if (l.by !== 'superlaser' || fired.has(key) || now < l.at - BEAM_HIT || now > l.at + 1) continue;
      fired.add(key);
      const target = capOf(l);
      if (target?.alive && target.dying <= 0) return { target, age: now - (l.at - BEAM_HIT), from: l.at - BEAM_HIT };
    }
    return null;
  };
  const dish = new THREE.Vector3();
  const aim = new THREE.Vector3();

  // ── the Executor, its bridge gone ──
  const exec = battle.capitals.find((c) => c.team === EMPIRE && c.role === 'flagship');
  // (the Death Star's the Empire's: its fall is the Rebellion's win only against the Empire)
  const againstEmpire = (ctx.on?.sides?.[EMPIRE] ?? 'empire') === 'empire';
  let dive = null; // { age }

  // ── the reactor run ──
  let blown = false;
  const C = v(...ctx.laid.at);
  const out = unit(v(C.x - D.x, C.y - D.y, C.z - D.z));
  const mouth = [D.x + out.x * R * 0.98, D.y + out.y * R * 0.98, D.z + out.z * R * 0.98];
  const run = createRun(ctx, {
    id: 5.15e6,
    key: 'ds2-core',
    team: REBELS,
    name: 'the main reactor',
    wayIn: 'Fly in: the main reactor',
    mouth,
    inward: [-out.x, -out.y, -out.z],
    up: [0, 1, 0],
    path: tunnelPath(`${ctx.on.id}-ds2`, { length: R * 1.05, turns: 4, bend: 0.45 }),
    radius: 2.2,
    chamber: 8,
    look: 'ds2',
    hp: 40,
    escape: 25,
    speed: 10,
    drawWithin: 500,
    markWithin: 600,
    open: () => (shared ? Boolean(planned('ds2-core')?.open) : genDown),
    ...(shared ? { down: () => Boolean(planned('ds2-core')?.down), left: () => planned('ds2-core').hp / planned('ds2-core').hpMax } : {}),
    solidsOff: (off) => ctx.solid('deathstar2', !off),
    enter: () => ctx.event('gcw-run'),
    onBlown: (mine) => {
      blown = true;
      beam.hide();
      ctx.draw?.flash(D, { size: ds.size * 0.5, life: 3.5, color: [2.6, 2, 1.2] });
      shock?.at(new THREE.Vector3(D.x, D.y, D.z), R);
      for (let i = 0; i < 8; i++) ctx.draw?.flash(v(D.x + (rand() - 0.5) * R * 1.4, D.y + (rand() - 0.5) * R * 1.4, D.z + (rand() - 0.5) * R * 1.4), { size: R * 0.3, life: 1.6 + i * 0.35, color: [2.8, 1.4, 0.5] });
      world?.war?.station('deathstar2', false);
      ctx.event('gcw-ds2');
      if (mine || ctx.tookPart()) ctx.points(GCW.points.objective * 3);
      if (!battle.over && againstEmpire && !shared) battle.end(REBELS, 'deathstar');
    },
  });

  return {
    run, // (for the browser checks)
    update(dt, t, live, events) {
      const res = {};
      shock?.update(dt);
      // what's been done to the generator, here and by the pilots in the system
      if (!genDown && genGone()) knockOut(false);
      // its guns, at anyone who comes down to it
      if (!genDown && live) {
        const d = Math.hypot(live.x - genTop.x, live.y - genTop.y, live.z - genTop.z);
        flak -= dt;
        if (d < 70 && flak <= 0) {
          flak = 0.45 + rand() * 0.3;
          battle.fire(EMPIRE, genTop, v(live.x - genTop.x + (rand() - 0.5) * 3, live.y - genTop.y + (rand() - 0.5) * 3, live.z - genTop.z + (rand() - 0.5) * 3), 'flak');
          if (rand() < 0.25) res.hurt = 3;
        }
      }
      // the superlaser, on a Rebel cruiser
      if (!blown && scheduled) {
        if (!shot && !battle.over) {
          shot = nextScheduled();
          if (shot) ctx.event('gcw-superlaser');
        }
      } else if (!blown) {
        nextShot -= dt;
        if (!shot && nextShot <= 0 && !battle.over) {
          const cruisers = battle.capitals.filter((c) => c.team === REBELS && c.role !== 'flagship' && c.alive && c.dying <= 0 && c.size > 4);
          if (cruisers.length) {
            shot = { target: cruisers[Math.floor(rand() * cruisers.length)], age: 0 };
            ctx.event('gcw-superlaser');
          }
          nextShot = 70 + rand() * 25;
        }
      }
      if (!blown && shot) {
        shot.age = shot.from !== undefined ? ctx.clock() - shot.from : shot.age + dt;
        const tp = shot.target.pos;
        const at = world?.war?.dish?.('deathstar2');
        if (at) dish.copy(at);
        else dish.set(D.x, D.y, D.z).addScaledVector(aim.set(tp.x - D.x, tp.y - D.y + R * 0.35, tp.z - D.z).normalize(), R * 1.02);
        // the charge (a glow at the dish), the beam, the ship gone
        if (shot.age < 1.6) {
          if (rand() < dt * 12) ctx.draw?.flash(dish, { size: 6 + shot.age * 6, life: 0.5, color: [0.8, 3.5, 0.9] });
          beam.hide();
        } else if (shot.age < 3) {
          beam.lay(dish, aim.set(tp.x, tp.y, tp.z), 1.4 + Math.sin(t * 40) * 0.3);
          if (!shot.hit && shot.age > BEAM_HIT) {
            shot.hit = true;
            battle.wreck(shot.target.id);
            ctx.draw?.flash(tp, { size: shot.target.size * 1.4, life: 2.4, color: [2.4, 3.2, 1.2], bright: 1.6 });
          }
        } else {
          beam.hide();
          shot = null;
        }
      }
      // the Executor's bridge gone: it turns, and dives into the station
      // (its own bridge: with the Empire attacking, the objectives are the Rebels')
      if (!dive && exec?.objective && events.some((e) => e.type === 'sub' && e.kind === 'bridge')) {
        dive = { age: 0, speed: 1 };
        for (const s of exec.subs) if (s.phase === 3) s.hidden = true; // (its reactor's not the way now: the Death Star's is)
        exec.disabled = 1e9;
        ctx.event('gcw-executor');
      }
      if (dive && !exec.gone) {
        dive.age += dt;
        dive.speed = Math.min(16, dive.speed + dt * 1.2);
        const to = unit(v(D.x - exec.pos.x, D.y - exec.pos.y, D.z - exec.pos.z));
        const f = exec.fwd;
        const ax = v(f.y * to.z - f.z * to.y, f.z * to.x - f.x * to.z, f.x * to.y - f.y * to.x);
        const turn = Math.acos(Math.max(-1, Math.min(1, f.x * to.x + f.y * to.y + f.z * to.z)));
        if (len(ax) > 1e-6 && turn > 1e-3) battle.turnCapital(exec, ax, Math.min(turn, 0.12 * dt));
        battle.moveCapital(exec, v(exec.fwd.x * dive.speed * dt, exec.fwd.y * dive.speed * dt, exec.fwd.z * dive.speed * dt));
        ctx.moveHull(exec);
        // into it
        if (Math.hypot(exec.pos.x - D.x, exec.pos.y - D.y, exec.pos.z - D.z) < R + exec.size * 0.3) {
          exec.gone = true;
          ctx.draw?.setVisible(exec, false);
          ctx.setHull(exec.id, false);
          for (let i = 0; i < 5; i++) ctx.draw?.flash(v(exec.pos.x + exec.fwd.x * (i - 2) * exec.size * 0.15, exec.pos.y, exec.pos.z + exec.fwd.z * (i - 2) * exec.size * 0.15), { size: exec.size * 0.4, life: 2 + i * 0.4, color: [3, 1.5, 0.5], bright: 1.5 });
        }
      }
      const r = run.update(dt, t, live);
      return { ...r, hurt: (r.hurt ?? 0) + (res.hurt ?? 0) || undefined };
    },
    hit(from, to, damage) {
      if (!genDown && sweptHit(from, to, genTop, genTop, 2) !== null) {
        if (!shared || planned('moon-gen').open) ctx.mineAs(REBELS, 'moon-gen', damage);
        if (genGone()) knockOut(true);
        return { id: genTgt.id, kind: 'shieldgen', at: { ...genTop }, size: 1, down: genDown, sub: 'moon-gen' };
      }
      return run.hit(from, to, damage);
    },
    get targets() {
      const list = run.targets;
      if (!genDown) {
        genTgt.hp = genLeft();
        list.push(genTgt);
      }
      return list;
    },
    markers(live) {
      const list = run.markers(live);
      if (!genDown) list.push({ key: 'moon-gen', pos: genTop, title: 'Destroy: the shield generator', hp: genLeft() / genMax, colour: '#ffb347' });
      return list;
    },
    dispose() {
      run.dispose();
      gen.group.removeFromParent();
      gen.dispose();
      beam.mesh.removeFromParent();
      beam.dispose();
      shock?.dispose();
      world?.war?.face?.('deathstar2', null);
    },
  };
}

// The ground war's bodies: a figure for each soldier the population makes
// (actors.js's anyFigure, the one resolver), pooled by kind so a soldier
// dropped behind you hands its figure to the next of its kind; one made a
// frame; walked, looked and crouched by hostiles.js's hostileBody on the
// site's animator, rated by lib/three/animBudget; a gun in the hand where
// the figure has one (universe/gunplay); a health bar and '?' / '!' over
// its head (activity.js's); a flinch where it's hit and a fall the way the
// shot went, lying a while and sinking, as the quests' hostiles do. The
// design: docs/superpowers/specs/2026-10-08-ground-factions-design.md,
// section 10.
//
// createPool({ make }) → { take(kind, id) → Promise<fig | null>, give(id),
//   free(kind), made() }: pure bookkeeping
// createFigures({ parent, world, warm, kit, tier, only, uniforms }) → { add(s) → t, remove(id),
//   get(id), all(), body(t, step, dt, time, { you, rate, live }), dying(t, dt),
//   flinch(t, at), fell(t, { push, from }), fire(t, aim) → muzzle | null,
//   frame(), dispose() }
//   t: { id, soldier, holder, fig, spec, hp (getter), down, aim, hostile }

import * as THREE from 'three';
import { anyFigure } from '../actors';
import { DEATH, fallen, healthBar, markMaterials } from '../activity';
import { HOSTILE_BODY, createPosture, fallOf, hostileBody, whereHit } from '../hostiles';
import { groundAt, pushOut } from '../walker';
import { rigRagdoll } from '../../../../lib/three/ragdollPhysics';
import { ARMS, dressOf } from './troops';
import { createGunplay } from '../../../universe/gunplay';
import { budgetClock, createAnimBudget } from '../../../../lib/three/animBudget';
import { POP } from './population';

export const RAGDOLLS = 4; // falling as ragdolls at once, at most (a fifth takes its clip)
export const GROUND_BODY = {
  ...HOSTILE_BODY,
  patrol: { base: null },
  post: { scan: true },
  advance: { look: 'belief' },
};
const UP = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _from = new THREE.Vector3();
const STOOD = { speed: 0, side: 0, turn: 0 };

export function createPool({ make }) {
  const free = new Map(); // kind → [fig]
  const held = new Map(); // id → { kind, fig | null, gone }
  let made = 0;
  const shelve = (kind, fig) => {
    if (!free.has(kind)) free.set(kind, []);
    free.get(kind).push(fig);
  };
  return {
    async take(kind, id) {
      const spare = free.get(kind)?.pop();
      const entry = { kind, fig: spare ?? null, gone: false };
      held.set(id, entry);
      if (spare) return spare;
      const fig = await Promise.resolve(make(kind)).catch(() => null);
      if (fig) made++;
      // (dropped while it was being made: it waits in the pool for the next of its kind)
      if (entry.gone || held.get(id) !== entry) {
        if (fig) shelve(kind, fig);
        return null;
      }
      entry.fig = fig;
      return fig;
    },
    give(id) {
      const e = held.get(id);
      if (!e) return;
      held.delete(id);
      e.gone = true;
      if (e.fig) shelve(e.kind, e.fig);
    },
    // (forgotten, not shelved: a figure a ragdoll has had is the caller's to let go of)
    drop(id) {
      const e = held.get(id);
      held.delete(id);
      if (e) e.gone = true;
      return e?.fig ?? null;
    },
    free: (kind) => free.get(kind)?.length ?? 0,
    made: () => made,
    // every figure there is, held or free (to let go of at the end)
    each(fn) {
      for (const list of free.values()) list.forEach(fn);
      for (const e of held.values()) if (e.fig) fn(e.fig);
    },
  };
}

export function createFigures({ parent, world, warm = (o) => Promise.resolve(o), kit = null, tier = 'high', only = false, uniforms = null }) {
  const group = new THREE.Group();
  group.name = 'ground';
  parent.add(group);
  const budget = createAnimBudget({
    near: 12,
    far: 40,
    max: POP[tier] ?? POP.high,
  });
  const marks = markMaterials();
  // (each in the world's own kit, and on a world that takes models only, a model or nothing: surface/cast.js)
  const pool = createPool({ make: (kind) => anyFigure(dressOf(kind, uniforms), {}, kit, 0, undefined, { only }) });
  const records = new Map(); // id → t
  const queue = []; // ids waiting for a figure
  let making = false;
  let dead = false;
  let n = 0;
  let ragdolls = 0; // (falling as ragdolls now)
  // what a ragdoll lands on: the ground under it, and the sides of what's solid
  const collide = (p, r) => {
    let on = false;
    const g = groundAt(world, p.x, p.z, p.y + 0.5);
    if (p.y < g + r) {
      p.y = g + r;
      on = true;
    }
    for (const sol of world.solids?.near?.(p.x, p.z, r + 0.5) ?? []) {
      if (sol.top != null && p.y > sol.top + r) continue;
      const q = pushOut(sol, p.x, p.z, r);
      if (q) {
        p.x += q[0];
        p.z += q[1];
      }
    }
    return on;
  };

  const attach = (t, fig) => {
    t.fig = fig;
    fig.stop?.(0, 'full');
    fig.stop?.(0, 'upper');
    fig.base?.(null);
    fig.look?.(null);
    fig.model.visible = true;
    t.holder.add(fig.model);
    const gun = ARMS[t.soldier.kind];
    if (gun && fig.model.getObjectByName('RightHand')?.isBone) {
      t.holder.updateMatrixWorld(true);
      t.gp = createGunplay({ model: fig.model, bones: fig.bones, sockets: fig.sockets, stance: fig.stance, aimAt: fig.aimAt }, gun, {
        unit: 1,
        who: t.soldier.kind,
      });
    }
    // (arriving: the gun brought up as the game's soldiers do, where it has the soldiers' set)
    if (fig.clips?.['spawn.deploy']) fig.play?.('spawn.deploy', { layer: 'upper' });
    warm(t.holder).then(() => {
      if (records.get(t.id) === t) t.holder.visible = true;
    });
  };
  const makeNext = () => {
    if (making || !queue.length) return;
    const id = queue.shift();
    const t = records.get(id);
    if (!t || t.fig) return;
    making = true;
    pool
      .take(t.soldier.kind, id)
      .then((fig) => {
        making = false;
        // (no model, on a world that takes models only: it stays out of the fight, groundScene.js)
        if (!fig && only && records.get(id) === t) t.faceless = true;
        if (!fig || dead) return;
        if (records.get(id) !== t) return pool.give(id);
        attach(t, fig);
      })
      .catch(() => (making = false));
  };

  const api = {
    group,
    add(s) {
      const holder = new THREE.Group();
      holder.visible = false;
      holder.position.set(s.b.x, groundAt(world, s.b.x, s.b.z), s.b.z);
      holder.rotation.y = s.b.yaw;
      group.add(holder);
      const t = {
        id: s.id,
        soldier: s,
        holder,
        fig: null,
        spec: { kind: s.kind, scale: 1 },
        hostile: false,
        aim: null,
        down: 0,
        death: null,
        posture: createPosture({ seed: n * 7919 }),
        tick: budgetClock(n++),
        pose: null,
        gp: null,
        bar: null,
        barAt: null,
        mark: null,
        looked: null,
        based: null,
        flinch: 0,
        reacted: false,
        get hp() {
          return s.hp;
        },
      };
      records.set(s.id, t);
      queue.push(s.id);
      return t;
    },
    remove(id) {
      const t = records.get(id);
      if (!t) return;
      records.delete(id);
      t.bar?.dispose();
      t.gp?.dispose?.();
      if (t.fig) {
        t.fig.model.removeFromParent();
        t.fig.model.position.set(0, 0, 0);
        t.fig.model.quaternion.identity();
      }
      t.holder.removeFromParent();
      if (t.rag) {
        if (!t.rag.settled) ragdolls--;
        pool.drop(id)?.dispose?.();
      } else pool.give(id);
    },
    get: (id) => records.get(id),
    all: () => records.values(),
    frame() {
      budget.frame();
      makeNext();
    },
    // its body for its brain's step, stepped at the rate its distance and the budget give it
    body(t, step, dt, time, { you = null, camera = null, live = true } = {}) {
      const s = t.soldier;
      const fig = t.fig;
      const pose = hostileBody(t.posture, step, dt, {
        t: time,
        firing: step.fire || time - (t.firedAt ?? -9) < 0.9,
        table: GROUND_BODY,
      });
      t.pose = pose;
      t.holder.position.set(s.b.x, groundAt(world, s.b.x, s.b.z), s.b.z);
      t.holder.rotation.y = s.b.yaw;
      if (t.flinch > 0) {
        t.flinch -= dt;
        t.holder.rotation.z = t.reacted ? 0 : Math.sin(t.flinch * 60) * t.flinch * 0.3;
      } else t.holder.rotation.z = 0;
      const dYou = you ? Math.hypot(you.x - s.b.x, you.z - s.b.z) : Infinity;
      api.overhead(t, pose, dYou, time);
      if (!fig || !live) return;
      // (a full-fidelity 2017 kind: the cut its distance wants, crew.js)
      if (you) fig.cutAt?.(dYou);
      const by = t.tick(budget.rate(t.holder.position, camera), dt);
      if (!(by > 0)) return;
      if (pose.base !== t.based) {
        t.based = pose.base;
        fig.base?.(pose.base);
      }
      const p = pose.look;
      const want = p
        ? {
            x: p.x,
            y: step.aim && you && step.target === 'you' ? (you.y ?? 0) + 1.5 : undefined,
            z: p.z,
          }
        : null;
      const was = t.looked;
      if (!want !== !was || (want && (Math.hypot(want.x - was.x, want.z - was.z) > 0.25 || Math.abs((want.y ?? 0) - (was.y ?? 0)) > 0.2))) {
        t.looked = want;
        fig.look?.(want);
      }
      if (pose.alert && fig.anim) fig.react?.('alert', { target: want });
      fig.update(by, step.moving ? 0.6 : 0, pose.motion);
      _fwd.set(Math.sin(s.b.yaw), 0, Math.cos(s.b.yaw));
      if (fig.anim || fig.after || t.gp) t.holder.updateMatrixWorld(true);
      fig.after?.(by, pose.motion, { forward: _fwd, up: UP });
      if (t.gp) {
        const tall = fig.tall ?? 1.8;
        _from.set(s.b.x, t.holder.position.y + tall * 0.78, s.b.z);
        const dir = want
          ? _dir
              .set(want.x, want.y ?? _from.y, want.z)
              .sub(_from)
              .normalize()
          : null;
        t.gp.set(by, {
          aim: pose.aim,
          look: dir ? 1 : 0,
          dir,
          forward: _fwd,
          up: UP,
        });
      }
    },
    // its health while you're near and it's hurt, and its '?' or '!'
    overhead(t, pose, dYou, time) {
      const s = t.soldier;
      const tall = t.fig?.tall ?? 1.6;
      const show = dYou < 45 && (s.hp < s.hpMax || (dYou < 16 && t.aim && pose.mark));
      if (show) {
        if (!t.bar) {
          t.bar = healthBar();
          t.holder.add(t.bar.sprite);
        }
        t.bar.sprite.visible = true;
        t.bar.sprite.position.y = tall + 0.45;
        const key = `${s.hp}/${s.hpMax}`;
        if (key !== t.barAt) {
          t.barAt = key;
          t.bar.draw(Math.max(0, s.hp) / s.hpMax, 0, 0);
        }
      } else if (t.bar) t.bar.sprite.visible = false;
      const mark = dYou < 60 && t.watchesYou ? pose.mark : null;
      if (mark && !t.mark) {
        t.mark = new THREE.Sprite(marks.of(mark));
        t.mark.scale.setScalar(0.42);
        t.mark.renderOrder = 5;
        t.holder.add(t.mark);
      }
      if (t.mark) {
        t.mark.visible = Boolean(mark);
        if (mark) {
          t.mark.material = marks.of(mark);
          t.mark.position.y = tall + 0.8 + Math.sin(time * 3 + t.id.length) * 0.05;
        }
      }
    },
    flinch(t, at = null) {
      if (t.down) return;
      t.flinch = 0.25;
      const tall = t.fig?.tall ?? 1.8;
      t.reacted = Boolean(
        t.fig?.react?.('hit', {
          where: whereHit(at?.y, t.holder.position.y, tall),
          moving: true,
        }),
      );
    },
    // ragdoll: whether it may fall as one (near, a tier that can, few falling); speed: how hard it was hit
    fell(t, { push = null, from = null, ragdoll = false, speed = 4 } = {}) {
      if (t.down) return;
      t.down = 0.001;
      const hips = ragdoll && ragdolls < RAGDOLLS && t.fig?.anim ? t.fig.model.getObjectByName('Hips') : null;
      if (hips?.isBone) {
        const bones = {};
        t.fig.model.traverse((o) => o.isBone && (bones[o.name] = o));
        t.fig.stop?.(0, 'upper');
        t.holder.updateMatrixWorld(true);
        const dir = fallOf({ push, from, at: t.soldier.b, yaw: t.soldier.b.yaw });
        const v = t.soldier.vel ?? [0, 0];
        t.rag = rigRagdoll(bones, { collide, push: { x: dir.x, y: 0, z: dir.z }, speed, velocity: { x: v[0] ?? 0, y: 0, z: v[1] ?? 0 } });
        ragdolls++;
      }
      t.death = {
        dir: fallOf({ push, from, at: t.soldier.b, yaw: t.soldier.b.yaw }),
        force: 0.3,
        clip: null,
        started: false,
        y: null,
      };
    },
    // going down by the way it was struck (react.js's down), or tipped over
    // about its feet with no clip; lying a while, then into the ground.
    // → true once it's gone
    dying(t, dt) {
      const d = t.death;
      const fig = t.fig;
      t.down += dt;
      if (t.rag) {
        // falling the way it was hit, onto the ground it stood on; settled, its pose frozen, lying, then into the ground
        if (t.bar) t.bar.sprite.visible = false;
        if (t.mark) t.mark.visible = false;
        if (!t.rag.settled) {
          t.rag.step(dt);
          if (t.rag.settled) {
            ragdolls--;
            d.settledAt = t.down;
          }
          return false;
        }
        const since = t.down - d.settledAt;
        if (since > DEATH.lie) t.holder.position.y -= (DEATH.deep / DEATH.sink) * dt;
        return since > DEATH.lie + DEATH.sink;
      }
      if (!d.started) {
        d.started = true;
        if (t.bar) t.bar.sprite.visible = false;
        if (t.mark) t.mark.visible = false;
        t.holder.rotation.set(0, t.soldier.b.yaw, 0);
        if (t.based) fig?.base?.(null);
        t.based = null;
        fig?.stop?.(0.15, 'upper');
        fig?.look?.(null);
        t.gp?.set?.(0, {
          aim: 0,
          look: 0,
          dir: null,
          forward: _fwd.set(0, 0, 1),
          up: UP,
        });
        d.clip =
          fig?.react?.('down', {
            dir: d.dir,
            yaw: t.soldier.b.yaw,
            force: d.force,
          })?.clip ?? null;
        d.y = groundAt(world, t.soldier.b.x, t.soldier.b.z);
      }
      if (d.clip && fig?.anim && t.down > 1.5 && fig.anim.playing?.('full') !== d.clip) {
        d.clip = null;
        d.tipAt = t.down;
        fig.stop?.(0.1, 'full');
      }
      const f = d.clip ? fallen(t.down, fig.anim?.actions?.[d.clip]?.getClip().duration ?? 2) : fallen(t.down - (d.tipAt ?? 0));
      _fwd.set(Math.sin(t.soldier.b.yaw), 0, Math.cos(t.soldier.b.yaw));
      if (d.clip) {
        fig.update(dt, 0, STOOD);
        t.holder.updateMatrixWorld(true);
        fig.after?.(dt, STOOD, { forward: _fwd, up: UP });
      } else {
        const k = f.k;
        t.holder.rotation.set(0, t.soldier.b.yaw, 0);
        t.holder.rotateOnWorldAxis(_dir.set(d.dir.z, 0, -d.dir.x).normalize(), (k * Math.PI) / 2);
      }
      t.holder.position.set(t.soldier.b.x, d.y - f.sink, t.soldier.b.z);
      return f.gone;
    },
    // a shot: from the muzzle of a gun that's up (kicking), else from its chest
    fire(t, time) {
      t.firedAt = time;
      if (t.gp?.aim > 0.5) {
        const m = t.gp.fire().muzzle;
        return [m.x, m.y, m.z];
      }
      return [t.soldier.b.x, t.holder.position.y + (t.fig?.tall ?? 1.8) * 0.78, t.soldier.b.z];
    },
    lie: DEATH.lie,
    dispose() {
      dead = true;
      for (const id of [...records.keys()]) api.remove(id);
      pool.each((fig) => fig.dispose?.());
      marks.dispose();
      group.removeFromParent();
    },
  };
  return api;
}

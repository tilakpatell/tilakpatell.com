// The named characters, drawn: each one's ship from the fleet (the same
// built models and loaded ones the traffic and the hunters fly), turned the
// way it's going and banked into its turns, and its shots as short bright
// tracers from it to whatever it fired at. What each does is npcRules.js's
// (plain rules, tested); who they are is npcs/index.js's. The scene voices
// their events and puts their hits where they land.
//
// createNpcs(parent, { fleet, rand, memory, schedule, trace }) → { add(npc, at) → id | null,
//   update(dt, t, world) → events (npcRules.js's), hit(from, to, damage) →
//   { id, kind, at (a Vector3), size, down } | null, targets, live, count,
//   ai: { schedule, trace, hunters, stats() }, clear(), dispose() }
// Everything is in `parent`'s space (the map's).
//
// The brains sense and think on a schedule (lib/ai/schedule: by how near
// you they are, 20 Hz senses and 10 Hz choices at the most, half the
// tier's budget a frame: scheduleBudget) and fly every frame on what they
// last chose; what each chose and why goes in `trace` (lib/ai/trace).
// Both are made here when the scene doesn't bring its own, from the
// visit's seed (seed.js), as `rand` is (the visit's 'npcs' stream). In
// development, or with ?ai=1, they're put on the inspector (lib/ai/inspect,
// as 'universe') and on
// `window.__universeDebug.ai`, beside the hunters' (`ai.hunters`); stats()
// is the two schedules' frame together.

import * as THREE from 'three';
import { createFleet } from './glbFleet';
import { createBrains } from './npcRules';
import { sweptHit } from './targeting';
import { seedOf } from './seed';
import { streams } from '../../lib/seeded';
import { byDistance, createSchedule } from '../../lib/ai/schedule';
import { createTrace } from '../../lib/ai/trace';
import { flags, register, unregister } from '../../lib/ai/inspect';
import { device } from '../../lib/device';

const TRACER = { speed: 60, length: 0.4 }; // map units a second; how long one's drawn
// how far off you a brain still counts for something to the schedule (past
// this it's paused, flying on what it last chose, till it comes nearer or is
// let go of at NPC.far for NPC.forget seconds)
export const VIEW_RANGE = 300;

// The brains' milliseconds a frame on a tier (lib/device's), shared by the
// two schedules, the characters' (here) and the hunters' (hunters.js): each
// is given half, so the two together spend the tier's, not twice it.
const AI_MS = { low: 0.5, mid: 1, high: 2 };
export const scheduleBudget = (tier) => ({ ms: (AI_MS[tier] ?? 1) / 2 });

// two schedules' frames as one (the characters' and the hunters')
export function joinStats(a, b) {
  if (!b) return a;
  const worst = !a.worst ? b.worst : !b.worst ? a.worst : b.worst.ms > a.worst.ms ? b.worst : a.worst;
  return { agents: a.agents + b.agents, sensed: a.sensed + b.sensed, thought: a.thought + b.thought, ms: a.ms + b.ms, skipped: a.skipped + b.skipped, worst };
}

export function createNpcs(parent, { fleet = createFleet(), rand = null, memory = {}, schedule = null, trace = null } = {}) {
  const seed = rand && schedule ? null : seedOf();
  rand ??= streams(seed).fork('npcs');
  schedule ??= createSchedule({ significance: byDistance, seed, budget: scheduleBudget(device().tier) });
  trace ??= createTrace();
  const brains = createBrains({ rand, memory, trace }); // (memory: what each character remembers of you, kept by the scene for the visit)
  const scheduled = new Set(); // the brains the schedule has
  const timed = (me) => schedule.done(me);
  const dueNow = new Map(); // number → the schedule's entry, this frame
  const ai = {
    schedule,
    trace,
    hunters: null, // ({ schedule, trace }: the hunters', once the debug hook has both)
    stats: () => joinStats(schedule.stats(), ai.hunters?.schedule?.stats() ?? null),
  };
  const debugging = Boolean(import.meta.env?.DEV) || flags().ai;
  if (debugging) register('universe', { trace, schedule, agents: () => brains.live.map((m) => ({ id: m.n, kind: m.npc.brain, at: m.pos, mode: m.leaving ? 'leaving' : (m.mind.mode ?? null) })) });
  const enrol = () => {
    for (const me of brains.live) {
      if (me.delegated || scheduled.has(me)) continue;
      scheduled.add(me);
      schedule.add(me, { id: me.n });
    }
  };
  const unenrol = () => {
    const live = new Set(brains.live); // (once a frame: a search of the list for each would be n²)
    for (const me of scheduled) {
      if (!me.delegated && live.has(me)) continue;
      scheduled.delete(me);
      schedule.drop(me);
    }
  };
  const views = new Map(); // id → { model, prev, bank }
  const look = new THREE.Vector3();
  const tracerGeo = new THREE.CylinderGeometry(0.012, 0.012, TRACER.length, 5).rotateX(Math.PI / 2);
  const mats = new Map(); // colour → material
  const matFor = (rgb) => {
    const key = rgb.join(',');
    if (!mats.has(key)) mats.set(key, new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    return mats.get(key);
  };
  const tracers = Array.from({ length: 12 }, () => {
    const m = new THREE.Mesh(tracerGeo, matFor([5, 5, 5]));
    m.visible = false;
    m.frustumCulled = false;
    m.userData = { from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, len: 1 };
    parent.add(m);
    return m;
  });
  const drop = (id) => {
    const v = views.get(id);
    if (!v) return;
    v.model.group.removeFromParent();
    v.model.dispose();
    views.delete(id);
  };

  return {
    // a character comes in at `at` ({ x, y, z }); its number, or null
    add(npc, at) {
      const id = brains.add(npc, at);
      if (id === null) return null;
      enrol();
      fleet.want([npc.ship]);
      // (a delegated one, a wingman or a bounty hunter, is the wing's or the hunt's to draw)
      if (npc.brain !== 'wingman' && npc.brain !== 'bounty') {
        const model = fleet.make(npc.ship);
        model.fit ??= 1 / Math.max(model.size?.x ?? 1, model.size?.y ?? 1, model.size?.z ?? 1);
        parent.add(model.group);
        views.set(id, { model, prev: { ...at }, bank: 0, npc });
      }
      return id;
    },

    update(dt, t, world) {
      for (const me of brains.live) {
        const v = views.get(me.n);
        if (v) {
          v.prev.x = me.pos.x;
          v.prev.y = me.pos.y;
          v.prev.z = me.pos.z;
        }
      }
      // the ones due to sense and think this frame, nearest you first; the
      // rest fly on (the view is you, when you're flying)
      enrol();
      world.t = t;
      const { due } = schedule.frame(dt, world.you ? { at: world.you, range: VIEW_RANGE } : null, t);
      dueNow.clear();
      for (const d of due) if (d.agent) dueNow.set(d.agent.n, d);
      const { events } = brains.update(dt, world, { due: dueNow, done: timed });
      unenrol();
      if (debugging && typeof window !== 'undefined' && window.__universeDebug) {
        const d = window.__universeDebug;
        if (d.ai !== ai) d.ai = ai;
        ai.hunters = d.hunters?.ai ?? null;
      }
      parent.updateWorldMatrix(true, false);
      const alive = new Set(brains.live.map((m) => m.n));
      for (const id of [...views.keys()]) if (!alive.has(id)) drop(id);
      for (const me of brains.live) {
        const v = views.get(me.n);
        if (!v) continue;
        const g = v.model.group;
        g.position.set(me.pos.x, me.pos.y, me.pos.z);
        const { x, y, z } = me.vel;
        if (x * x + y * y + z * z > 0.04) {
          // (banked into the turn: how fast the way it's going swings round)
          const yaw = Math.atan2(x, z);
          const turn = v.yaw === undefined ? 0 : Math.atan2(Math.sin(yaw - v.yaw), Math.cos(yaw - v.yaw)) / Math.max(dt, 1e-3);
          v.yaw = yaw;
          v.bank += (Math.max(-1, Math.min(1, turn * 0.4)) - v.bank) * Math.min(1, dt * 3);
          g.lookAt(parent.localToWorld(look.set(me.pos.x + x, me.pos.y + y, me.pos.z + z)));
          g.rotateZ(-v.bank);
        }
        g.scale.setScalar((v.npc.size ?? 0.4) * v.model.fit);
        v.model.update(t);
      }
      // the shots, as tracers flying from the shooter to what it fired at
      for (const e of events) {
        if (e.type !== 'shot') continue;
        const m = tracers.find((o) => !o.visible) ?? tracers[0];
        const npc = views.get(e.n)?.npc;
        m.material = matFor(npc?.bolt ?? [5, 5, 5]);
        m.userData.from.set(e.from.x, e.from.y, e.from.z);
        m.userData.to.set(e.to.x, e.to.y, e.to.z);
        // (one that misses goes on past, a little wide)
        // (drawing, not a rule: the scatter's its own, off the visit's stream)
        if (!e.hit) m.userData.to.add(look.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2.5));
        m.userData.len = Math.max(0.5, m.userData.from.distanceTo(m.userData.to));
        m.userData.t = 0;
        m.visible = true;
      }
      for (const m of tracers) {
        if (!m.visible) continue;
        const d = m.userData;
        d.t += (dt * TRACER.speed) / d.len;
        if (d.t >= 1) {
          m.visible = false;
          continue;
        }
        m.position.lerpVectors(d.from, d.to, d.t);
        m.lookAt(parent.localToWorld(look.copy(d.to)));
      }
      return events;
    },

    // a shot of yours from `from` to `to` this frame: the one it hit, if any
    // (anyone drawn: the guns lock on to enemies alone, but a stray shot
    // hits a friend too, and they remember it)
    hit(from, to, damage = 1) {
      let best = null;
      let first = Infinity;
      for (const me of brains.live) {
        const v = views.get(me.n);
        if (!v || me.delegated) continue;
        const k = sweptHit(from, to, v.prev, me.pos, (me.npc.size ?? 0.4) * 0.9 + 0.12);
        if (k !== null && k < first) {
          first = k;
          best = me;
        }
      }
      if (!best) return null;
      const r = brains.hit(best.n, damage);
      return r && { ...r, at: new THREE.Vector3(r.at.x, r.at.y, r.at.z) };
    },
    remove: (id) => {
      brains.remove(id);
      drop(id);
      unenrol();
    },
    ai,

    get targets() {
      return brains.targets;
    },
    get live() {
      return brains.live;
    },
    get count() {
      return brains.live.length;
    },
    clear() {
      for (const me of [...brains.live]) brains.remove(me.n);
      for (const id of [...views.keys()]) drop(id);
      for (const m of tracers) m.visible = false;
      unenrol();
    },
    dispose() {
      this.clear();
      if (debugging) unregister('universe');
      if (typeof window !== 'undefined' && window.__universeDebug?.ai === ai) delete window.__universeDebug.ai;
      for (const m of tracers) m.removeFromParent();
      tracerGeo.dispose();
      for (const m of mats.values()) m.dispose();
    },
  };
}

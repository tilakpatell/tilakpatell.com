// The galaxy surface's effects (./gameFx.js says what they are), without
// their looks: the plan, the pools and what each part answers, with the
// sheets' and the push's makers handed in, { createSheetFx, createPush }:
// marks.js's and push.js's GLSL (gameFx.js), or their node twins
// (gameFxNodes.js).
//
// createGameFxWith({ createSheetFx, createPush }, parent, { level, groundAt, site, lit, look }) → gameFx.js's

import * as THREE from 'three';
import { createDebris } from './debris';
import { blastPlan, familySurface, impactPlan, surfaceOf } from './fxPlan';
import { loadLook } from './gameLook';

const SHEETS = ['impact', 'scorch.metal', 'blast', 'glow', 'ramp.blackbody'];
const SCORCH_LIFE = 18; // s a mark stays

const rgb = (c) => {
  const col = new THREE.Color(c ?? '#ffd0a0');
  return [col.r, col.g, col.b];
};

export function createGameFxWith({ createSheetFx, createPush }, parent, { level = 'high', groundAt = () => 0, site = null, lit = true, look = 'game' } = {}) {
  const group = new THREE.Group();
  group.name = 'fx-game';
  parent.add(group);
  const off = look === 'site';
  const debris = createDebris(group, { level, groundAt, lit });
  const pusher = off ? null : createPush(group);
  const k = {}; // the drawn kinds, by part
  let gone = false;
  const scale = level === 'low' ? 0.25 : level === 'mid' ? 0.5 : 1;
  const n = (x) => Math.max(4, Math.round(x * scale));

  const ready = off
    ? Promise.resolve(false)
    : Promise.all(SHEETS.map((s) => loadLook(s, { level }).then((t) => [s, t]))).then((pairs) => {
        if (gone) return false;
        const t = Object.fromEntries(pairs);
        const ramp = t['ramp.blackbody'];
        if (t.impact) {
          k.scorch = createSheetFx(group, { texture: t.impact, mode: 'decal', channel: 'r', count: n(40), life: SCORCH_LIFE });
          k.burst = createSheetFx(group, { texture: t.impact, ramp, mode: 'sprite', channel: 'g', count: n(24), life: 0.3 });
          k.ring = createSheetFx(group, { texture: t.impact, ramp, mode: 'glow', channel: 'b', count: n(8), life: 0.9 });
        }
        if (t['scorch.metal']) k.metal = createSheetFx(group, { texture: t['scorch.metal'], mode: 'decal-colour', count: n(40), life: SCORCH_LIFE });
        if (t.blast) k.ember = createSheetFx(group, { texture: t.blast, ramp, mode: 'glow', channel: 'r', count: n(24), life: 0.9 });
        if (t.glow) k.glow = createSheetFx(group, { texture: t.glow, ramp, mode: 'sprite', channel: 'r', count: n(12), life: 0.8 });
        // the chunks, loaded before the first fight so the first hit throws them
        debris.preload(['debris.rock', 'debris.metal', 'debris.snow', 'debris.sand']);
        return true;
      });

  const v = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  return {
    group,
    ready,
    has(part) {
      return Boolean(k[part]);
    },
    // a bolt landing: `ground` whether it hit the ground (else a wall or a
    // prop), `colour` the bolt's
    impact(at, normal = UP, { ground = true, colour = null, surface = null, family = null } = {}) {
      if (off) return { mark: false, debris: 0 };
      const plan = impactPlan(familySurface(family) ?? surface ?? surfaceOf(site, ground), level);
      const sheet = plan.mark.sheet === 'scorch.metal' ? k.metal : k.scorch;
      // (a touch off the ground: the drawn snow and sand sit over the height the rules read)
      v.copy(at).addScaledVector(normal, 0.06);
      const mark = Boolean(sheet?.add(v, normal, { size: plan.mark.size * (0.8 + Math.random() * 0.4), frame: (Math.random() * plan.mark.frames) | 0, tint: plan.mark.tint, bright: 0.85 }));
      // the bolt's heat in what it hit (its flash is the bolts' own: lib/three/combat/bolts.js)
      k.ember?.add(v, normal, { size: 0.45, frame: (Math.random() * 4) | 0, tint: rgb(colour), bright: 1.3, life: 0.7 });
      const thrown = debris.throw(at, { ...plan.debris, up: ground ? 0.75 : 0.4 });
      return { mark, debris: thrown };
    },
    // something going up: `cls` grenade | speeder | fighter | walker
    explode(at, cls = 'grenade', { tint = null } = {}) {
      if (off || !k.burst) return false;
      const plan = blastPlan(cls, level);
      const c = tint ? rgb(tint) : [1, 1, 1];
      // (its core over the bloom's 1.4 for its first tenth of a second, then
      // under; held up off the ground by a third of its size, so the ground
      // never cuts the sprite flat)
      v.copy(at).addScaledVector(UP, plan.size * 0.3);
      k.burst.add(v, UP, { size: plan.size * 0.8, tint: c, bright: 1.7, life: 0.4, grow: 0.7 });
      k.glow?.add(v, UP, { size: plan.size * 0.45, tint: c, bright: 0.9, life: plan.life * 0.5, grow: 0.3 });
      const g = groundAt(at.x, at.z);
      const onGround = at.y - g < plan.size * 0.6;
      if (onGround) {
        v.set(at.x, g + 0.06, at.z);
        if (plan.ring) k.ring?.add(v, UP, { size: plan.size * 0.8, tint: c, bright: 1.1, life: 0.9, grow: 3 });
        k.scorch?.add(v, UP, { size: plan.size * 0.9, tint: impactPlan(surfaceOf(site, true)).mark.tint, bright: 0.95 });
      }
      debris.throw(at, plan.debris);
      return true;
    },
    push(from, dir, opts) {
      return Boolean(pusher?.push(from, dir, opts));
    },
    update(dt) {
      for (const x of Object.values(k)) x.update(dt);
      debris.update(dt);
      pusher?.update(dt);
    },
    // (for the warm-up: every kind's shader made before the first fight)
    get meshes() {
      return Object.values(k).map((x) => x.mesh);
    },
    get busy() {
      return Object.values(k).reduce((a, x) => a + x.busy, 0) + debris.busy;
    },
    clear() {
      for (const x of Object.values(k)) x.clear();
      debris.clear();
    },
    dispose() {
      gone = true;
      for (const x of Object.values(k)) x.dispose();
      debris.dispose();
      pusher?.dispose();
      group.removeFromParent();
    },
  };
}

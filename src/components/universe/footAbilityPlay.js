// The crew's abilities played on the universe map's planets (footAbilities.js
// has the rules; footScene.js hands in its pieces and calls this at G and V,
// each frame, and at the end), so the scene grows only by the calls: as the
// galaxy's worlds play them (galaxy/surface/scene.js's power()), on the
// planet. Each crew member keeps their own cooldowns.
//
// - The Force, out (Luke's push in a cone, his repulse all round; Chewie's
//   leap is a repulse): everyone in reach hurt by the card's hit and shoved
//   off their feet, a rush of sparks out from you.
// - A thrown charge (Han's detonite, Walt's fulminate): lobbed along the way
//   you face, off at its fuse or as it lands; whoever's in its radius is hurt
//   by how near and thrown, you and your mate too if you're that close.
// - Overcharge (Rick's, Walt's, Jesse's, Han's sharpshooter, Chewie's furious
//   bowcaster): no heat and a hit harder for a while (footArms.js's `hot`).
// - Sprint (Morty's, Jesse's): half again as fast for a few seconds.
// - Medpack (Morty's, Artoo's patch-up): a third of your health back.
// - The portal hop (Rick's): a portal a few metres on, and you through it,
//   green flashes at both ends; shorter, or none, if the far end's blocked.
// - The jetpack (Artoo's booster rockets): G held, up while there's fuel, a
//   plume under him; the tank refills on the ground.
//
// createFootAbilities({ root, fx, puff, metre }) → { pairOf(who), press(slot, ctx) → the kind played or false,
//   step(dt, ctx), overcharged(who, now), sprint(who, now), tiles(who, now), clear(), dispose() }
// ctx: { who (the crew member you're playing), me (their record), mate, R, now, troops (the live list),
//   strike(t, damage, dir), shove(t, shove, lift), hurt(n, dir), hurtMate(n, dir), heal(n), place(to) (you, put there),
//   clear(to) (the hop's far end free), held (G down), emit(e) }

import * as THREE from 'three';
import { BLAST, blastOn, hopTo, inReach, knockOf, damageOf, lift, newAbilities, overcharged, pairOf, shoveOf, sprintOf, throwOf, throwStep, spend, tilesOf } from './footAbilities';
import { vec } from './foot';

const GREEN = '#8dff5a';

export function createFootAbilities({ root, fx, puff, metre }) {
  const states = new Map(); // who → newAbilities()
  const of = (who) => {
    let st = states.get(who);
    if (!st) states.set(who, (st = newAbilities()));
    return st;
  };
  const pairs = new Map();
  const pair = (who) => {
    let p = pairs.get(who);
    if (!p) pairs.set(who, (p = pairOf(who)));
    return p;
  };
  // the thrown charges: a small grey sphere with a red light in it, blinking faster as its fuse runs down
  const bombGeo = new THREE.SphereGeometry(0.09 * metre, 10, 8);
  const bombMat = new THREE.MeshStandardMaterial({ color: '#8a9aa8', emissive: new THREE.Color('#ff3b30'), emissiveIntensity: 1.2, metalness: 0.7, roughness: 0.3 });
  let bombs = []; // { g (footAbilities.js's throwOf), mesh, by }

  const v3 = (a) => new THREE.Vector3(...a);
  const up = (w, R, h = 1) => v3(vec.add(vec.scale(w.n, R + (w.h ?? 0)), w.n, h * metre));
  const burst = (at, n, color, count, spread = 6) => {
    for (let k = 0; k < count; k++) fx.sparks(at, n.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).multiplyScalar(0.6)).normalize(), color, spread);
  };

  function force(card, ctx) {
    const f = knockOf(card);
    const hit = damageOf(card);
    let any = 0;
    for (const t of ctx.troops) {
      if (!t.alive) continue;
      const r = inReach(ctx.me, t, ctx.R, f, metre);
      if (!r.hit) continue;
      any++;
      const shove = shoveOf(ctx.me, t, f.force * r.k * metre);
      ctx.shove(t, shove, f.lift * r.k * metre);
      if (hit) ctx.strike(t, hit, shove.dir);
    }
    // a rush of sparks out from you, the way the Force went
    const from = up(ctx.me, ctx.R);
    const n = v3(ctx.me.n);
    for (let k = 0; k < 10; k++) {
      const a = (Math.random() - 0.5) * 2 * Math.min(f.cone, Math.PI);
      const dir = v3(ctx.me.f).applyAxisAngle(n, a);
      fx.sparks(from.clone().addScaledVector(dir, (1.5 + Math.random() * 3) * metre), dir.addScaledVector(n, 0.3).normalize(), '#c8d8ff', 4);
    }
    puff([from.x, from.y, from.z], '#c8d8ff', 2.4);
    return any;
  }

  function hop(card, ctx) {
    const to = hopTo(ctx.me, card, ctx.R, ctx.clear, metre);
    if (!to) return false;
    const here = up(ctx.me, ctx.R);
    fx.flash(here, v3(ctx.me.n), { color: GREEN, size: 1.4 });
    burst(here, v3(ctx.me.n), GREEN, 8);
    ctx.place(to);
    const there = up({ ...ctx.me, n: to.n, h: 0 }, ctx.R);
    fx.flash(there, v3(to.n), { color: GREEN, size: 1.4 });
    burst(there, v3(to.n), GREEN, 8);
    return true;
  }

  function boom(b, ctx) {
    const card = b.g.card;
    const p = b.g.p;
    const n = vec.unit(p);
    const at = { n, h: Math.max(0, vec.len(p) - ctx.R) };
    for (const t of ctx.troops) {
      if (!t.alive) continue;
      const d = vec.len(vec.add(vec.scale(t.n, ctx.R + (t.h ?? 0)), p, -1));
      const r = blastOn(d, card, metre);
      if (!r.hit) continue;
      const shove = shoveOf(at, t, BLAST.shove * r.k * metre);
      ctx.shove(t, shove, BLAST.lift * r.k * metre);
      ctx.strike(t, r.damage, shove.dir);
    }
    // (you and your mate too, if you're that close: as hard, by how close)
    const nearly = (w) => (w ? vec.len(vec.add(vec.scale(w.n, ctx.R + (w.h ?? 0)), p, -1)) : Infinity);
    const dYou = nearly(ctx.me);
    if (dYou < card.radius * metre * 0.8) ctx.hurt(Math.round(BLAST.you * (1 - dYou / (card.radius * metre))), vec.unit(vec.add(vec.scale(ctx.me.n, ctx.R), p, -1)));
    const dMate = nearly(ctx.mate);
    if (dMate < card.radius * metre * 0.8) ctx.hurtMate(Math.round(BLAST.you * (1 - dMate / (card.radius * metre))), vec.unit(vec.add(vec.scale(ctx.mate.n, ctx.R), p, -1)));
    const where = v3(p);
    const normal = v3(n);
    fx.flash(where, normal, { color: '#ffb060', size: 1.6 });
    for (let k = 0; k < 6; k++) burst(where, normal, k % 2 ? '#ffd36b' : '#ff6a3d', 2, 14);
    fx.scorch(v3(vec.scale(n, ctx.R)), normal);
    puff(p, '#ffb060', 3.2);
    ctx.emit({ type: 'foot', id: 'boom', near: Math.max(0, 1 - dYou / (40 * metre)) });
  }

  return {
    pairOf: pair,
    // G or V pressed: the card played, by its kind; false if it can't be now
    press(slot, ctx) {
      const id = pair(ctx.who)[slot];
      const r = spend(of(ctx.who), slot, id, ctx.now);
      if (!r.ok) return false;
      const { kind, card } = r;
      if (kind === 'push' || kind === 'repulse') force(card, ctx);
      else if (kind === 'detonator' || kind === 'fulminate') {
        const mesh = new THREE.Mesh(bombGeo, bombMat);
        const g = throwOf(ctx.me, card, ctx.R, metre);
        mesh.position.set(...g.p);
        root.add(mesh);
        bombs.push({ g, mesh, by: ctx.who });
      } else if (kind === 'medpack') {
        ctx.heal(card.heal);
        const at = up(ctx.me, ctx.R);
        fx.flash(at, v3(ctx.me.n), { color: '#8dff9a', size: 0.9 });
        puff([at.x, at.y, at.z], '#8dff9a', 1.4);
      } else if (kind === 'hop') {
        if (!hop(card, ctx)) {
          of(ctx.who).cool[slot] = ctx.now; // (nowhere to go: nothing spent)
          return false;
        }
      } else if (kind === 'overcharge' || kind === 'sprint') puff([...up(ctx.me, ctx.R).toArray()], kind === 'sprint' ? '#9fd8ff' : '#ffffff', 1.6);
      ctx.emit({ type: 'foot', id: 'ability', kind, name: card.name, who: ctx.who });
      return kind;
    },
    // a frame on: the jetpack while G's held (its record lifted, a plume under it), and the charges in the air
    step(dt, ctx) {
      const st = of(ctx.who);
      const card = pair(ctx.who).power;
      if (card === 'artooRockets' || st.jet.on || st.jet.fuel < 2.2) {
        const was = ctx.me;
        const w = card === 'artooRockets' ? lift(st, was, ctx.held, dt, metre) : was;
        if (w !== was) ctx.place(w, true);
        if (st.jet.on && Math.random() < dt * 40) puff([...up(w, ctx.R, 0.2).toArray()], Math.random() < 0.5 ? '#ffd36b' : '#ff8a3d', 0.6);
      }
      if (!bombs.length) return;
      const keep = [];
      for (const b of bombs) {
        b.g = throwStep(b.g, dt, ctx.R, metre);
        b.mesh.position.set(...b.g.p);
        b.mesh.rotation.x += dt * 9;
        bombMat.emissiveIntensity = 1 + Math.sin(b.g.age * (8 + b.g.age * 10)) * 0.8;
        if (!b.g.boom) {
          keep.push(b);
          continue;
        }
        root.remove(b.mesh);
        boom(b, ctx);
      }
      bombs = keep;
    },
    overcharged: (who, now) => overcharged(of(who), now),
    sprint: (who, now) => sprintOf(of(who), now),
    tiles: (who, now) => tilesOf(of(who), pair(who), now),
    // (lifting off, or the walk's end: the charges gone, the cooldowns kept for the next landing)
    clear() {
      for (const b of bombs) root.remove(b.mesh);
      bombs = [];
      for (const st of states.values()) {
        st.jet.on = false;
        st.hot = 0;
        st.fast = 0;
      }
    },
    dispose() {
      for (const b of bombs) root.remove(b.mesh);
      bombs = [];
      bombGeo.dispose();
      bombMat.dispose();
    },
  };
}

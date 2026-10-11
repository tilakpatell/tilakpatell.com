// The surface's bolts, each frame: who's in the way (you, your mate, the
// soldiers, the quests' figures, as capsules), your raised blade, and what
// the one step (blaster.js on lib/combat/bolt.js) said happened, handed to
// the scene. And their shots at you: only along a clear line from the
// muzzle (no shot through a wall, however sure they are where you went),
// scattered as a person shoots (lib/combat/accuracy.js: wider the first
// time at you, never three in a row). Wiring beside scene.js, kept apart so
// that file doesn't grow.
//
// A figure on the game's skeleton (lane 1's heroes) is hit where the game's
// capsules say (lib/physics/boneCapsules.js over bones.json, fetched the
// first time such a figure is in the way); any other keeps the one capsule
// blaster.js's capsuleOf gives it. A hit's `e.body.region` and `reaction`
// name the bone and the game's hit reaction then.
//
// createBoltPlay({ blaster, ground, rng, boneSets }) → { enemy(s, you) →
// bolt | null, step(dt, ctx, on) } (boneSets: bones.json's contents, else
// fetched when first wanted)
//   s: a shot at you, { from, to: [x, z] | null, spread, damage, color, who,
//     side }; you: your walker state
//   ctx: { you (your walker state, or null while nothing can hit you), mate
//     (its, or null), allies (sides whose bolts pass you by), targets (the
//     quests' or the battle's figures), guard (your block's shield, the game's
//     deflect: saber.js's guard(), which tests a bolt by its own shape) }
//   capsules(t) → where a target is hit, as the bolts see it: the game's
//     capsules on a figure on the game's skeleton (with each's region and hit
//     reaction), else its one capsule (saber.js lands a strike on them)
//   on: { yours(e), hurt(damage, from), mate(damage, from), other(e),
//     deflect(e), home(e) (a bolt your blade turned, into someone: e.damage
//     is what it was fired with, so a trooper's own bolt fells him),
//     landed(e) } (e: the step's event)

import { FIRST, freshAim, missBy, shotStep } from '../../../lib/combat/accuracy';
import { capsulesOf, isGameSkeleton } from '../../../lib/physics/boneCapsules';
import { capsuleOf } from './blaster';

const CHEST = 1.1; // m over your feet: where they aim
const FRESH = 6; // s without a shot at you and you're a fresh target again
const CLEAR = 0.9; // of the way to you a line must be clear for a shot

// you (or your mate) as the bolts see you
const personAt = (id, st, allies) => ({ id, a: [st.x, st.y + 0.4, st.z], b: [st.x, st.y + 1.45, st.z], r: 0.4, side: 'you', allies });

export function createBoltPlay({ blaster, ground = null, rng = Math.random, boneSets = null }) {
  const aims = new WeakMap(); // who → { streak, fresh, wide, at }
  const bodies = [];
  const blades = [];
  const kept = new Map();
  const bodyOf = (t) => {
    let b = kept.get(t);
    if (!b) kept.set(t, (b = { id: t, ref: t }));
    Object.assign(b, capsuleOf(t));
    b.side = t.spec?.side === 'yours' ? 'you' : (t.side ?? 'them');
    return b;
  };
  // the game's capsules on a figure on the game's skeleton (a hero's set for a hero), once fetched
  let sets = boneSets;
  let asked = !!boneSets;
  const gameBodies = (t, out) => {
    // (a droid or beast on a rig of its own, ownRig.js, takes its rig's own
    // set where the game has one (the B2's; lane V's walkers, the droideka
    // among them, name no skeleton and keep their one capsule); else the one
    // capsule of a figure the game has none for)
    const own = t.fig?.rig === 'own' ? t.fig.skeleton : null;
    if (t.fig?.rig === 'own' && !own) return false;
    if (!own && !isGameSkeleton(t.fig?.bones)) return false;
    if (!asked) {
      asked = true;
      import('../../../data/bf2017/physics/bones.json').then((m) => (sets = m.default ?? m)).catch(() => {});
    }
    const id = t.hero || t.spec?.hero ? 'defaultsoldierbonecollision_hero' : 'defaultsoldierbonecollision';
    const set = own ? sets?.sets?.find((x) => x.skeleton?.endsWith(`/${own}`)) : sets?.sets?.find((x) => x.id === id);
    const caps = set ? capsulesOf(t.fig.bones, set) : [];
    if (!caps.length) return false;
    const side = bodyOf(t).side;
    for (const c of caps) out.push({ id: t, ref: t, side, ...c });
    return true;
  };

  return {
    capsules(t) {
      const out = [];
      return gameBodies(t, out) ? out : [{ ...capsuleOf(t), region: 'chest' }];
    },
    // their shot at you: none without a clear line; else scattered as a person shoots
    enemy(s, you, now = 0) {
      const to = s.to ? [s.to[0], you.y + CHEST, s.to[1]] : [you.x, you.y + CHEST, you.z];
      const wall = blaster.solids(s.from, to);
      if (wall) {
        const all = Math.hypot(to[0] - s.from[0], to[1] - s.from[1], to[2] - s.from[2]);
        const got = Math.hypot(wall.at[0] - s.from[0], wall.at[1] - s.from[1], wall.at[2] - s.from[2]);
        if (got < all * CLEAR) return null;
      }
      const who = s.who && typeof s.who === 'object' ? s.who : null;
      // (a shot from no one in particular, a battle's: no telegraph, no streak)
      let a = who ? aims.get(who) : { streak: 0, fresh: false, wide: false, at: now };
      if (!a || now - a.at > FRESH) a = freshAim();
      a.at = now;
      if (who) aims.set(who, a);
      const range = Math.hypot(to[0] - s.from[0], to[2] - s.from[2]);
      const spread = (s.spread ?? 0.06) * (a.fresh ? FIRST : 1);
      const min = a.wide ? missBy(range) : 0;
      a.fresh = false;
      a.wide = false;
      return blaster.enemy(s.from, to, Math.max(spread, min * 1.5), s.color ?? '#ff4a3d', s.damage ?? 8, { side: s.side ?? 'them', owner: who?.ground ? who.id : who, rng, min, tag: { atYou: true, who } });
    },

    step(dt, ctx, on) {
      bodies.length = 0;
      blades.length = 0;
      const allies = ctx.allies ?? [];
      if (ctx.you) bodies.push(personAt('you', ctx.you, allies));
      if (ctx.mate) bodies.push(personAt('mate', ctx.mate, allies));
      if (ground) for (const b of ground.bodies()) bodies.push(b);
      for (const t of ctx.targets ?? []) if (t?.holder && !t.down && !t.ground && !gameBodies(t, bodies)) bodies.push(bodyOf(t));
      if (ctx.guard) blades.push(ctx.guard);
      for (const e of blaster.update(dt, { bodies, blades })) {
        ground?.bolt(e);
        const b = e.bolt;
        const tag = b.tag;
        // (their aim at you: a hit or a miss, for the streak)
        if (tag?.atYou && e.type !== 'deflect') {
          const a = aims.get(tag.who);
          if (a) Object.assign(a, shotStep(a, { hit: e.type === 'hit' && e.body.id === 'you' }), { at: a.at });
          tag.atYou = false;
        }
        if (e.type === 'deflect') on.deflect?.(e);
        else if (e.type === 'hit') {
          const from = { x: b.from[0], z: b.from[2] };
          if (e.body.id === 'you') on.hurt?.(b.damage, from);
          else if (e.body.id === 'mate') on.mate?.(b.damage, from);
          else if (b.side === 'you' && b.deflected && on.home) on.home({ ...e, damage: b.damage });
          else if (b.side === 'you') on.yours?.(e);
          else if (!e.body.ref?.ground) on.other?.(e);
        } else if (e.type === 'solid' && b.side === 'you') on.landed?.(e);
      }
    },
  };
}

// A planned battle's objectives in the sim (battle.js fights the battle,
// battleDirector.js says how it's going, battlePlan.js says what's in it):
// the plan's objectives put where it has them, and each step what the
// director says of them taken in. Pure (no three.js), tested in Node
// through battle.js.
//
// With a director the battle doesn't decide its objectives itself: each
// one's hp is the director's, so every pilot in the system sees the same;
// the stage it's in is the director's, open once the stage before it is
// down and its gate's passed (till then its objectives are shielded); the
// shield over the objective ship stands while a stage that shields it
// does. Your shots on an open stage's objectives count a punch of its hp
// each (told through onMine, for the tally), and the AI's fire on them only
// lights them up: the AI's part in them is the director's pressure curve.
//
// Where an objective is (its `on`, battlePlan.js): a subsystem of the
// objective ship's (one the plan doesn't use is hidden, not there to
// shoot); one of a ship's batteries (its own few hits no longer take it:
// the director's hp does); a point by one of the defender's ships (laid in
// its frame and moved with it, `props`); a point in the battle (`field`:
// toward the defender's line, across it, toward the planet); a level's own
// point, in the battle's frame (`point`: a space level's mines and
// nodules, galaxy/surface/missions/starfighter.js); on the planet
// below (`planet`); or a set piece's own (`piece`: the piece draws and
// takes it). A zone's a place to hold (warfront.js counts who's in it), not
// a target.
//
// And the plan's side objectives: an ace in the fight from its time, its
// hull the director's (the AI can't bring it down; the pilots' shots are
// told, `ace:<team>`); a bomber wave put up at its time, one life each,
// what's left of it gone home once it's struck; the defender's reserve
// squadron put up at the final push (the plan's escalations). When the droid control
// relay falls (an objective's `effect.freeze`), the defender's droid
// fighters drift dead in space for that many seconds; while a stage that
// interdicts stands (an Interdictor's gravity wells), the battle's
// `interdicted`.
//
// createStages(k, plan, director) → { sync(out), hit(objective, damage,
// mine, out) → whether it took it, hitAce(fighter, damage, out) → whether
// it's down, free(p0, p1) → the nearest free objective a segment meets
// ({ o, k } | null) }, and gives the battle objectives, stageOpen, opensIn,
// shieldUp and interdicted. `k` is the battle's inner context: { b, C, A,
// S, lines, planet, defender, newId(), objOf(), onMine };
// `director.state()` is the director's state now.

import { sweptHit } from './targeting';
import { BATTLE, copy, len, set, v3 } from './battleKit';
import { addReserve, addWave, spawn } from './battleAi';
import { place } from './battleCapitals';

// how big each kind of objective laid out in the open is, unless the plan says
const SIZES = { satellite: 1, platform: 3, beacon: 0.8, relay: 1.6, well: 0.8, cannon: 2.4, projector: 0.9, engines: 0.8, droidrelay: 1.2, dock: 1 };
// the fighters a droid control relay controls
const DROIDS = new Set(['vulture', 'trifighter']);

export function createStages(k, plan, director) {
  const { b, C, A, S, lines } = k;
  const ship = k.objOf();
  const fleet = b.capitals.filter((c) => c.team === k.defender); // (in the order of its line)
  const all = []; // every planned objective the battle has in it
  const shipOf = (on) => (on.ship === undefined || on.ship === 'objective' ? ship : fleet[on.ship]);
  // where in the battle a point of the plan's is
  const toward = v3(A.x * (k.defender === 0 ? -1 : 1), 0, A.z * (k.defender === 0 ? -1 : 1));
  const planet = k.planet ? v3(...k.planet.at) : null;
  const down = planet ? set(v3(), planet.x - C.x, planet.y - C.y, planet.z - C.z) : v3(0, -1, 0);
  const dl = len(down) || 1;
  set(down, down.x / dl, down.y / dl, down.z / dl);
  const pointOf = (on) => {
    if (on.point) return v3(...on.point);
    if (on.field) {
      const [a, s, d] = on.field;
      return v3(C.x + toward.x * a * lines + S.x * s + down.x * d, C.y + toward.y * a * lines + S.y * s + down.y * d, C.z + toward.z * a * lines + S.z * s + down.z * d);
    }
    // (on the planet's surface under the battle, a little above it)
    const h = (k.planet?.r ?? 0) + on.planet;
    return planet ? v3(planet.x - down.x * h, planet.y - down.y * h, planet.z - down.z * h) : v3(C.x, C.y - lines, C.z);
  };

  plan.stages.forEach((stage, si) =>
    stage.objectives.forEach((o) => {
      const on = o.on ?? {};
      const mark = { phase: si + 1, key: o.id, type: o.type, name: o.name, ...(o.verbs ? { verbs: o.verbs } : {}), hp: o.hp, hpMax: o.hp, planned: true, after: o.after ?? null, effect: o.effect ?? null, sinks: Boolean(o.sinks) };
      if (on.piece) return; // (the set piece's to draw and take)
      if (on.sub) {
        const s = ship?.subs.find((x) => x.id === on.sub);
        if (s) all.push(Object.assign(s, mark));
        return;
      }
      if (on.turret !== undefined) {
        const tu = shipOf(on)?.turrets[on.turret];
        if (tu) all.push(Object.assign(tu, mark, { pos: tu.at, kind: 'battery' }));
        return;
      }
      const cap = on.at ? shipOf(on) : null;
      const pos = cap ? place(cap, on.at) : pointOf(on);
      const it = { ...mark, num: k.newId(), kind: o.kind, pos, r: o.r ?? SIZES[o.kind] ?? 1, alive: true, free: true, cap, zone: o.type === 'zone' ? (o.zone ?? 12) : 0 };
      if (cap) cap.props.push(it);
      all.push(it);
    }),
  );
  for (const s of ship?.subs ?? []) if (!s.planned) s.hidden = true;
  b.objectives = all;
  b.stageOpen = true;
  b.opensIn = 0;
  b.shieldUp = plan.stages.some((s) => s.shields);
  b.interdicted = plan.stages.some((s) => s.interdicts);
  // (the objective ship breaks up when the chain ends on it: its reactor)
  const breaks = Boolean(plan.stages.at(-1)?.breaks);

  // the side objectives: the aces (in the fight from their time) and the waves
  const aces = (plan.side ?? []).filter((o) => o.type === 'ace').map((a) => ({ a, f: b.fighters.find((f) => f.ace && f.team === a.team) ?? null, gone: false }));
  for (const { f } of aces)
    if (f) {
      f.alive = false;
      f.respawn = Infinity;
    }
  const waves = (plan.side ?? []).filter((o) => o.type === 'wave').map((w) => ({ w, up: false, home: false, fighters: [] }));
  // (and the defender's reserve squadron, at the final push)
  const reserves = (plan.escalations ?? []).filter((e) => e.type === 'reserve').map((e) => ({ e, up: false }));
  let first = true;

  const objective = (st, o) => st.objectives.find((x) => x.id === o.key);
  // an objective down, said as a subsystem is, whatever it is (a battery, a satellite…)
  // (one that `sinks` its ship takes it with it: a space level's corvette)
  const fell = (o, mine) => {
    o.alive = false;
    if (o.sinks && o.cap && o.cap !== ship) b.wreck?.(o.cap.id);
    return { type: 'sub', sub: o.key, kind: o.kind, phase: o.phase, at: copy(v3(), o.pos), mine };
  };
  // whether an objective's open to be taken: its stage open, and whatever it waits on down
  const open = (o) => o.phase === b.phase && b.stageOpen && (!o.after || !all.find((x) => x.key === o.after)?.alive);

  return {
    // what the director says now, taken in: the objectives, the stage, the shield, the side objectives
    sync(out) {
      const st = director.state();
      for (const o of all) {
        const s = objective(st, o);
        if (!s) continue;
        o.hp = s.hp;
        if (!o.alive || !s.down) continue;
        out.push(fell(o, false));
        // (the droid control relay: its droids stopped dead)
        if (o.effect?.freeze && !first) for (const f of b.fighters) if (f.alive && f.team === k.defender && DROIDS.has(f.kind)) f.frozen = o.effect.freeze;
      }
      if (b.shieldUp && !st.shield) {
        b.shieldUp = false;
        out.push({ type: 'shield', down: true });
      }
      while (b.phase < st.stage + 1) {
        b.phase += 1;
        if (b.phase <= plan.stages.length) out.push({ type: 'phase', phase: b.phase });
      }
      b.stageOpen = st.open;
      b.opensIn = st.opensIn;
      b.interdicted = plan.stages.some((s, i) => s.interdicts && !st.stages[i]?.done);
      if (breaks && st.stage >= plan.stages.length && ship?.alive && ship.dying <= 0) ship.dying = BATTLE.dying;
      // the aces: up from their time, their hull the director's, and down when it says
      aces.forEach((x, i) => {
        const s = st.aces[i];
        if (!x.f || !s || x.gone) return;
        if (s.down) {
          x.gone = true;
          if (x.f.alive) {
            x.f.alive = false;
            out.push({ type: 'down', team: x.f.team, kind: x.f.kind, role: x.f.role, at: copy(v3(), x.f.pos), mine: false, ace: true });
          }
          return;
        }
        if (s.launched && !x.f.alive) {
          spawn(k, x.f, false);
          out.push({ type: 'arrive', team: x.f.team, kind: x.f.kind, at: copy(v3(), x.f.pos) });
        }
        if (x.f.alive) x.f.hp = s.hp;
      });
      // the waves: put up at their time (what the AI hasn't brought down already), home once they've struck
      waves.forEach((x, i) => {
        const s = st.waves[i];
        if (!s) return;
        if (!x.up && s.launched && !s.arrived && s.left > 0) {
          x.up = true;
          x.fighters = addWave(k, x.w.team, s.left, x.w.id);
          for (const f of x.fighters) out.push({ type: 'arrive', team: f.team, kind: f.kind, at: copy(v3(), f.pos) });
        }
        x.up ||= s.launched;
        if (!x.home && st.t >= s.arriveAt + 20) {
          x.home = true;
          for (const f of x.fighters)
            if (f.alive) {
              f.alive = false;
              out.push({ type: 'arrive', team: f.team, kind: f.kind, at: copy(v3(), f.pos) });
            }
        }
      });
      for (const x of reserves) {
        if (x.up || st.t < x.e.at) continue;
        x.up = true;
        for (const f of addReserve(k, x.e.team, x.e.n)) out.push({ type: 'arrive', team: f.team, kind: f.kind, at: copy(v3(), f.pos) });
      }
      first = false;
    },
    // a shot on one of them: yours counted, if it's open to be taken (and
    // the director asked straight away whether that was the one that took it)
    hit(o, dmg, mine, out) {
      if (!o.planned || !open(o) || !mine) return false;
      if (o.cap?.disabled > 0) dmg *= BATTLE.ionSubs;
      k.onMine?.(o.key, dmg);
      const s = objective(director.state(), o);
      if (s) o.hp = s.hp;
      if (s?.down && o.alive) out.push(fell(o, true));
      return true;
    },
    // your shot on an ace: told, its hull the director's
    hitAce(f, dmg, out) {
      const i = aces.findIndex((x) => x.f === f);
      if (i < 0) return false;
      k.onMine?.(`ace:${f.team}`, dmg);
      const s = director.state().aces[i];
      if (s) f.hp = s.hp;
      if (s?.down && f.alive) {
        f.alive = false;
        aces[i].gone = true;
        out.push({ type: 'down', team: f.team, kind: f.kind, role: f.role, at: copy(v3(), f.pos), mine: true, ace: true });
      }
      return !f.alive;
    },
    // the nearest of the objectives laid out in the open (not a zone) a segment meets
    free(p0, p1) {
      let best = null;
      for (const o of all) {
        if (!o.free || o.zone || !o.alive) continue;
        const kk = sweptHit(p0, p1, o.pos, o.pos, o.r);
        if (kk !== null && (!best || kk < best.k)) best = { o, k: kk };
      }
      return best;
    },
    open,
    isAce: (f) => aces.some((x) => x.f === f),
  };
}

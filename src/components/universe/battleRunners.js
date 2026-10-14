// A battle's runners for the jump (battle.js fights the battle; this flies
// its runners): ships making for a point beyond the fight, gone after by
// the other side's fighters and by you. Some are the set pieces' own (Hoth's
// transports: addRunner); some decide the battle (an evacuation's or a
// blockade's, `runners` { team, kind, size, hp, count, need, speed, every,
// route (or from, to), spread }: one launched every `every` seconds about
// the start of its way, flying it point by point; `need` of them out wins
// it for their side, all of them down with fewer out loses it). Pure (no
// three.js), tested in Node through battle.js.
//
// In the galaxy the battle's runners are the director's (battleDirector.js;
// `shared`: the plan's runners and the director's state now). Each is in
// the battle from its launch, at the second of the battle the plan has it
// launched whenever you came, where the shared clock has it along its way,
// as worn as the director says, and out or down when the director says, so
// every pilot sees the same runners get away. Your shots on one of the
// other side's are told for the tally (`r:<i>`, through onMine); the AI's
// fire on one only lights it up.
//
// createRunners(k, runners, shared) → { launch(dt), fly(dt, out), judge(out,
// from), sync(out), hit(runner, damage, out) → whether it's down }, and gives
// the battle addRunner({ team, kind, size, hp, from, to, route?, speed }).
// `k` is the battle's inner context (battle.js's createBattle makes it):
// { b, rand, S, newId(), finish(winner, why, out), onMine, decides }.

import { NAMES } from './wars';
import { copy, len, seededRand, set, v3 } from './battleKit';

const tmp = v3();
const P = (p) => (Array.isArray(p) ? v3(p[0], p[1], p[2]) : v3(p.x, p.y, p.z));

export function createRunners(k, runners, shared = null) {
  const { b, rand } = k;
  const run = runners && !shared ? { ...runners, launched: 0, out: 0, wait: 0 } : null;

  b.addRunner = ({ team, kind, size, hp, from, to, route = null, speed }) => {
    const way = (route ?? [to]).map(P);
    const r = { id: k.newId(), team, kind, size, hp, hpMax: hp, role: 'runner', pos: P(from), prev: P(from), seen: P(from), vel: v3(), fwd: v3(0, 0, 1), to: way.at(-1), way, leg: 0, speed, alive: true, escaped: false, hitBy: 0, chased: -1 };
    r.tgt = { id: r.id, at: r.seen, vel: r.vel, size, kind, name: NAMES[kind] ?? kind, hp, hpMax: hp, threat: 0 };
    b.runners.push(r);
    return r;
  };

  // ── the director's: along their way by the shared clock ──
  const R = shared?.plan ?? null;
  const way = R ? R.route.map(P) : [];
  const legs = way.slice(1).map((p, i) => Math.hypot(p.x - way[i].x, p.y - way[i].y, p.z - way[i].z));
  const total = legs.reduce((a, l) => a + l, 0) || 1;
  // (each a little off the others, the same for every pilot)
  const offsets = R
    ? Array.from({ length: R.count }, (_, i) => {
        const r = seededRand(`runner-${i}`);
        const sp = R.spread ?? 10;
        const across = (r() - 0.5) * sp;
        return v3(k.S.x * across + (r() - 0.5) * sp * 0.3, (r() - 0.5) * sp * 0.4, k.S.z * across + (r() - 0.5) * sp * 0.3);
      })
    : [];
  const bySlot = new Map(); // the director's runner i → its runner here
  const seen = new Set(); // (and the ones heard of: one out or down before you came isn't news)
  // runner i, `along` (0..1) its way
  const place = (r, i, along) => {
    let d = along * total;
    let n = 0;
    while (n < legs.length - 1 && d > legs[n]) d -= legs[n++];
    const a = way[n];
    const c = way[n + 1];
    const f = legs[n] ? Math.min(1, d / legs[n]) : 1;
    copy(r.prev, r.pos);
    set(r.pos, a.x + (c.x - a.x) * f + offsets[i].x, a.y + (c.y - a.y) * f + offsets[i].y, a.z + (c.z - a.z) * f + offsets[i].z);
    set(tmp, c.x - a.x, c.y - a.y, c.z - a.z);
    const l = len(tmp) || 1;
    set(r.fwd, tmp.x / l, tmp.y / l, tmp.z / l);
    const speed = total / R.duration;
    set(r.vel, r.fwd.x * speed, r.fwd.y * speed, r.fwd.z * speed);
  };
  const told = (r, type, mine) => ({ type, id: r.id, team: r.team, kind: r.kind, at: copy(v3(), r.pos), ...(mine ? { mine: true } : {}) });

  return {
    // the battle's own, one every `every` seconds
    launch(dt) {
      if (!run || b.over || run.launched >= run.count) return;
      run.wait -= dt;
      if (run.wait > 0) return;
      run.wait = run.every;
      const sp = run.spread ?? 6;
      const jitter = (p) => ({ x: p[0] + (rand() - 0.5) * sp, y: p[1] + (rand() - 0.5) * sp * 0.4, z: p[2] + (rand() - 0.5) * sp });
      const points = (run.route ?? [run.from, run.to]).map(jitter);
      b.addRunner({ team: run.team, kind: run.kind, size: run.size, hp: run.hp, from: points[0], route: points.slice(1), speed: run.speed });
      run.launched += 1;
    },
    // each for the next point of its way, and gone when it's at the last
    // (the director's are where the director has them: sync)
    fly(dt, out) {
      for (const r of b.runners) {
        if (!r.alive || r.shared) continue;
        copy(r.prev, r.pos);
        let step = r.speed * dt;
        for (;;) {
          const to = r.way[r.leg];
          set(tmp, to.x - r.pos.x, to.y - r.pos.y, to.z - r.pos.z);
          const d = len(tmp);
          if (d > step) {
            set(r.fwd, tmp.x / d, tmp.y / d, tmp.z / d);
            break;
          }
          copy(r.pos, to);
          step -= d;
          if (r.leg < r.way.length - 1) {
            r.leg += 1;
            continue;
          }
          r.alive = false;
          r.escaped = true;
          out.push(told(r, 'escaped'));
          break;
        }
        if (!r.alive) continue;
        set(r.vel, r.fwd.x * r.speed, r.fwd.y * r.speed, r.fwd.z * r.speed);
        r.pos.x += r.fwd.x * step;
        r.pos.y += r.fwd.y * step;
        r.pos.z += r.fwd.z * step;
      }
    },
    // the battle's own decide it: enough of them out, or all of them down (events from `from` on: this step's)
    judge(out, from) {
      if (!run || b.over || k.decides === false) return;
      for (let i = from; i < out.length; i++) if (out[i].type === 'escaped' && out[i].team === run.team) run.out += 1;
      if (run.out >= run.need) k.finish(run.team, 'runners', out);
      else if (run.launched >= run.count && !b.runners.some((r) => r.alive && r.team === run.team)) k.finish(1 - run.team, 'runners', out);
    },
    // the director's, as it has them now: launched, along their way, worn, out or down
    sync(out) {
      if (!R) return;
      const list = shared.state().runners ?? [];
      list.forEach((s, i) => {
        let r = bySlot.get(i);
        if (!r) {
          if (!s.launched || seen.has(i)) return;
          seen.add(i);
          if (s.out || s.down) return;
          // (`shared`: its hull the director's, not its kind's record: battle.js)
          r = b.addRunner({ team: R.team, kind: R.kind, size: R.size, hp: R.hp, from: way[0], route: way.slice(1), speed: total / R.duration, shared: true });
          Object.assign(r, { slot: i, shared: true });
          bySlot.set(i, r);
          place(r, i, s.k);
          copy(r.prev, r.pos);
        }
        if (!r.alive) return;
        place(r, i, s.k);
        r.hp = s.hp;
        if (s.down) {
          r.alive = false;
          out.push(told(r, 'runner'));
        } else if (s.out) {
          r.alive = false;
          r.escaped = true;
          out.push(told(r, 'escaped'));
        }
      });
    },
    // your shot on one of the director's: told, and whether that's taken it down
    hit(r, damage, out) {
      k.onMine?.(`r:${r.slot}`, damage);
      const s = shared.state().runners?.[r.slot];
      if (s) r.hp = s.hp;
      if (s?.down && r.alive) {
        r.alive = false;
        out.push(told(r, 'runner', true));
      }
      return !r.alive;
    },
  };
}

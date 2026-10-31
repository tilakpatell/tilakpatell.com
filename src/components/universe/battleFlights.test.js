import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createBattle } from './battle';
import { seededRand } from './battleKit';
import { FLIGHTS } from './battleFlights';
import { createDirector } from './battleDirector';
import { PLAN, planFor } from './battlePlan';
import { WARS } from './wars';

// The galaxy's fighters fly in flights of three (battleFlights.js, under
// createBattle's `tactics`): a leader who picks the target and wingmen who
// take it, in formation on the way; an escort flight with each flight of
// bombers; the defender's interceptors flying cover over the ship the
// objectives are on; a fighter badly hurt or a flight outnumbered three to
// one going home to its carrier, and back in when it's patched up; and the
// fighters shot down coming back together, in waves on the battle's clock.
const war = WARS.starwars;
const make = (o = {}) => createBattle({ war, attacker: 0, at: [0, 0, 0], axis: [1, 0], perSide: 12, rand: seededRand('flights'), tickets: false, tactics: true, ...o });
const step = 1 / 30;
const watch = (b, seconds, look) => {
  for (let i = 0, n = Math.round(seconds / step); i < n && !b.over; i++) {
    const out = b.update(step, null);
    look?.(b, b.clock, out);
  }
};
const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
const flightsOf = (b) => [...new Set(b.fighters.map((f) => f.flight).filter(Boolean))];
const leaderOf = (fl) => fl.members.find((m) => m.alive && m.mode !== 'rtb') ?? null;

describe('flights of three', () => {
  it('puts each side up in flights of three, a leader and two wingmen of a kind', () => {
    const b = make();
    for (const team of [0, 1]) {
      const own = flightsOf(b).filter((fl) => fl.team === team);
      expect(own.length).toBe(Math.ceil(12 / FLIGHTS.size));
      for (const fl of own) {
        expect(fl.members.length).toBeLessThanOrEqual(FLIGHTS.size);
        expect(new Set(fl.members.map((m) => m.kind)).size).toBe(1);
      }
    }
  });

  it('fights as one: the leader picks the target and the wingmen take it (seven in ten of a flight on its leader’s, or on whoever’s on the leader’s tail)', () => {
    const b = make();
    let on = 0;
    let all = 0;
    let next = 1;
    watch(b, 60, (bb, t) => {
      if (t < next) return;
      next += 1;
      for (const fl of flightsOf(bb)) {
        const lead = leaderOf(fl);
        const wing = fl.members.filter((m) => m.alive && m.mode !== 'rtb' && m !== lead);
        if (!lead || !wing.length || !lead.target) continue;
        for (const m of [lead, ...wing]) {
          all += 1;
          if (m.target === lead.target || (m.target && m.target === lead.chaser)) on += 1;
        }
      }
    });
    expect(all).toBeGreaterThan(100);
    expect(on / all).toBeGreaterThanOrEqual(0.7);
  });

  it('holds formation on the way in: a wingman far from the target keeps to its slot off its leader’s wing', () => {
    // (lines far apart, so there's a way to fly in on)
    const b = make({ perSide: 9, lines: 160, radius: 260 });
    const gaps = [];
    watch(b, 8, (bb) => {
      for (const fl of flightsOf(bb)) {
        const lead = leaderOf(fl);
        if (!lead?.target || lead.role === 'bomber' || d(lead.pos, lead.target.pos ?? bb.you.pos) < FLIGHTS.transit + 10) continue;
        for (const m of fl.members) if (m !== lead && m.alive && m.mode !== 'rtb') gaps.push(d(m.pos, lead.pos));
      }
    });
    expect(gaps.length).toBeGreaterThan(50);
    gaps.sort((p, q) => p - q);
    expect(gaps[Math.floor(gaps.length / 2)]).toBeLessThan(8);
  });

  it('flies an escort flight with each flight of bombers, and keeps it near them', () => {
    const b = make();
    const bombers = flightsOf(b).filter((fl) => fl.role === 'bomber');
    expect(bombers.length).toBeGreaterThan(0);
    for (const fl of bombers) {
      expect(fl.escort).toBeTruthy();
      expect(fl.escort.role).not.toBe('bomber');
      expect(fl.escort.escorting).toBe(fl);
    }
    const gaps = [];
    watch(b, 30, () => {
      for (const fl of bombers) {
        const lead = leaderOf(fl);
        const esc = fl.escort && leaderOf(fl.escort);
        if (lead && esc) gaps.push(d(lead.pos, esc.pos));
      }
    });
    gaps.sort((p, q) => p - q);
    expect(gaps[Math.floor(gaps.length / 2)]).toBeLessThan(45);
  });

  it('flies the defender’s interceptors as cover over the ship the objectives are on', () => {
    const b = make({ perSide: 15 });
    const ship = b.capitals.find((c) => c.objective);
    const cap = flightsOf(b).filter((fl) => fl.cap);
    expect(cap.length).toBeGreaterThan(0);
    for (const fl of cap) expect(fl).toMatchObject({ team: b.defender, role: 'interceptor' });
    let sum = 0;
    let n = 0;
    watch(b, 90, (bb, t) => {
      if (t < 30) return;
      for (const fl of cap)
        for (const m of fl.members)
          if (m.alive && m.mode !== 'rtb') {
            sum += d(m.pos, ship.pos);
            n += 1;
          }
    });
    expect(n).toBeGreaterThan(100);
    expect(sum / n).toBeLessThan(60);
  });

  it('weighs the enemy round the most threatened objective twice for the defender', () => {
    const b = make({ perSide: 3 });
    const ship = b.capitals.find((c) => c.objective);
    const [f] = b.fighters.filter((x) => x.team === b.defender);
    const foes = b.fighters.filter((x) => x.team === b.attacker);
    for (const x of b.fighters) if (x !== f && !foes.slice(0, 2).includes(x)) (x.alive = false), (x.respawn = Infinity);
    // one attacker by the objective ship, one a little nearer the defender but nowhere near it
    Object.assign(f.pos, { x: ship.pos.x - 60, y: ship.pos.y + 40, z: ship.pos.z });
    Object.assign(foes[0].pos, { x: ship.pos.x - 10, y: ship.pos.y + 12, z: ship.pos.z });
    const dd = d(f.pos, foes[0].pos);
    Object.assign(foes[1].pos, { x: f.pos.x - dd * 0.85, y: f.pos.y, z: f.pos.z });
    for (const x of [f, ...foes]) (x.target = null), (x.retarget = 0), (x.vel.x = x.vel.y = x.vel.z = 0);
    b.tactics.sense();
    b.tactics.think(f, step);
    expect(f.target).toBe(foes[0]);
  });
});

describe('home and back', () => {
  it('sends a fighter at a third of its hull home to its carrier’s hangar, and back in at full hull without a ticket spent', () => {
    const b = make({ perSide: 6, tickets: true });
    const f = b.fighters.find((x) => x.team === 0 && x.role !== 'bomber');
    for (const x of b.fighters) if (x !== f) (x.alive = false), (x.respawn = Infinity);
    f.hp = Math.floor(f.type.hp * 0.3);
    const tickets = b.teams[0].tickets;
    let home = null;
    let healed = null;
    let lost = false;
    watch(b, 90, (bb, t) => {
      if (healed !== null) return;
      lost ||= !f.alive;
      if (f.mode === 'rtb' && f.station && d(f.pos, f.station) < FLIGHTS.dock) home ??= t;
      if (home !== null && f.hp === f.type.hp && f.mode !== 'rtb') healed = t;
    });
    expect(home).not.toBeNull();
    expect(healed).not.toBeNull();
    expect(healed - home).toBeGreaterThanOrEqual(FLIGHTS.docked - 0.1);
    expect(lost).toBe(false);
    expect(b.teams[0].tickets).toBe(tickets);
  });

  it('breaks a flight for home when it’s outnumbered three to one', () => {
    const b = make({ perSide: 4 });
    const lone = b.fighters.find((x) => x.team === 0 && x.flight.members.length === 1) ?? b.fighters.filter((x) => x.team === 0).at(-1);
    // (alone: its flight and the rest of its side's fighters down)
    for (const m of b.fighters) if (m.team === 0 && m !== lone) (m.alive = false), (m.respawn = Infinity);
    const foes = b.fighters.filter((x) => x.team === 1).slice(0, 3);
    foes.forEach((x, i) => Object.assign(x.pos, { x: lone.pos.x + 8 + i * 3, y: lone.pos.y, z: lone.pos.z + i }));
    b.tactics.sense();
    b.tactics.nerve(lone.flight);
    expect(lone.mode).toBe('rtb');
    expect(lone.panicked).toBe(true);
  });
});

describe('waves', () => {
  it('brings the fighters shot down back together, on the battle’s clock: the attacker’s every 20 s, the defender’s every 30 s', () => {
    const arrivals = () => {
      const b = make();
      const at = [[], []];
      watch(b, 150, (bb, t, out) => {
        for (const e of out) if (e.type === 'arrive' && !e.wave) at[e.team].push(+t.toFixed(4));
      });
      return at;
    };
    const one = arrivals();
    for (const team of [0, 1]) {
      const period = FLIGHTS.waves[team === 0 ? 'attacker' : 'defender'];
      expect(one[team].length, `team ${team}`).toBeGreaterThan(0);
      for (const t of one[team]) {
        const off = t - Math.round(t / period) * period;
        expect(Math.abs(off), `team ${team} at ${t}`).toBeLessThanOrEqual(step + 1e-6);
      }
    }
    expect(arrivals()).toEqual(one);
  });

  it('marks a wave launched out of a carrier’s hangar as one (drawn with no flash: battleScene.js), and one with its side’s carriers gone as out in the open', () => {
    // (with tactics, every arrival is a wave's: no plan's stages, no fighter back on its own)
    const hangars = (gone) => {
      const b = make();
      for (const c of b.capitals) if (c.team === gone && FLIGHTS.carriers.includes(c.kind)) c.alive = false;
      expect(b.capitals.some((c) => c.team === 1 - gone && c.alive && FLIGHTS.carriers.includes(c.kind))).toBe(true);
      const seen = [[], []];
      watch(b, 50, (bb, t, out) => {
        for (const e of out) if (e.type === 'arrive') seen[e.team].push(e.hangar);
      });
      return seen;
    };
    for (const gone of [0, 1]) {
      const seen = hangars(gone);
      expect(new Set(seen[1 - gone]), `team ${1 - gone}, its carriers up`).toEqual(new Set([true]));
      expect(new Set(seen[gone]), `team ${gone}, its carriers gone`).toEqual(new Set([false]));
    }
  });

  it('puts a reserve squadron up for the defender at the final push, from the plan’s escalations', () => {
    const plan = planFor({ id: 'flights.reserve', kind: 'assault', attacker: 0 });
    expect(plan.escalations.map((e) => e.type)).toContain('reserve');
    expect(plan.escalations.find((e) => e.type === 'reserve')).toMatchObject({ at: PLAN.push, team: 1 });
    const times = plan.escalations.map((e) => e.at);
    expect(times).toEqual([...times].sort((p, q) => p - q));
    const dir = createDirector({ plan, seed: plan.id });
    const clock = { t: PLAN.push - 2 };
    const b = make({ plan, director: { state: () => dir.state(clock.t, () => 0) }, elapsed: PLAN.push - 2 });
    const before = b.fighters.filter((f) => f.team === 1).length;
    watch(b, 1);
    expect(b.fighters.filter((f) => f.team === 1).length).toBe(before);
    clock.t = PLAN.push + 0.5;
    watch(b, 0.5);
    const reserve = b.fighters.filter((f) => f.team === 1 && f.reserve);
    expect(reserve.length).toBe(plan.escalations.find((e) => e.type === 'reserve').n);
    expect(reserve.every((f) => f.alive && f.flight)).toBe(true);
  });

  it('stays under the health check’s warning line', () => {
    const lines = readFileSync(new URL('./battleFlights.js', import.meta.url), 'utf8').split('\n').length;
    expect(lines).toBeLessThan(800);
  });
});

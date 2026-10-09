import { describe, expect, it } from 'vitest';
import { createBattle } from '../universe/battle';
import { createDirector } from '../universe/battleDirector';
import { TYPES } from '../universe/battleObjectives';
import { PLAN } from '../universe/battlePlan';
import { MENUS, planOf } from './battlePlans';
import { BATTLE_KINDS, layBattle } from './battles';
import { WAR_SYSTEMS, teamsOf } from './gcw';
import { WARS } from './sides';
import { systemById } from './systems';

const KEY = /^[a-z0-9][a-z0-9:._-]{0,47}$/;
// a battle as gcw.js's battleAt has it, its id numbered
const battleOf = (sys, attacker, defender, war, n = 3, kind = null) => {
  const sides = teamsOf(attacker, defender);
  return { id: `c0.${war}.${sys}.${n}`, war, sys, step: n, seed: n, attacker, defender, sides, attackerTeam: sides.indexOf(attacker), start: 0, fightEnd: 600e3, end: 720e3, fighting: true, ...(kind ? { kind } : {}) };
};
const planAt = (sys, attacker, defender, war = 'gcw', n = 3, kind = null) => {
  const b = battleOf(sys, attacker, defender, war, n, kind);
  const laid = layBattle(systemById(sys), b);
  return { plan: planOf(systemById(sys), b, laid), laid, b };
};
// a battle of each kind somewhere, in each war, both ways round
const everyBattle = function* (seeds = 1) {
  for (const war of Object.values(WARS))
    for (const kind of Object.keys(BATTLE_KINDS))
      for (const [att, def] of [
        [war.liberator, war.raider],
        [war.raider, war.liberator],
      ])
        for (let n = 0; n < seeds; n++) yield { war: war.id, kind, att, def, n, ...planAt(WAR_SYSTEMS[n % WAR_SYSTEMS.length], att, def, war.id, n, kind) };
};

describe('the plans’ menus', () => {
  it('have a menu for every kind of battle', () => {
    for (const kind of Object.keys(BATTLE_KINDS)) expect(MENUS[kind]?.stages?.length, kind).toBe(PLAN.gates.length);
  });
});

describe('planOf', () => {
  it('is pure: the same battle, the same plan', () => {
    expect(planAt('yavin', 'rebel', 'empire').plan).toEqual(planAt('yavin', 'rebel', 'empire').plan);
  });

  it('draws a different first stage for different battles of a kind: at least two kinds of objective across fifty', () => {
    for (const kind of Object.keys(BATTLE_KINDS)) {
      const types = new Set();
      const ids = new Set();
      for (let n = 0; n < 50; n++) {
        const id = WAR_SYSTEMS[n % WAR_SYSTEMS.length];
        const war = ['gcw', 'clone', 'remnant'][n % 3];
        const w = WARS[war];
        const { plan } = planAt(id, n % 2 ? w.raider : w.liberator, n % 2 ? w.liberator : w.raider, war, n, kind);
        types.add(plan.stages[0].type);
        ids.add(plan.stages[0].id);
      }
      expect(types.size, kind).toBeGreaterThanOrEqual(2);
      expect(ids.size, kind).toBeGreaterThanOrEqual(2);
    }
  });

  it('every kind of objective there is turns up in some plan', () => {
    const seen = new Set();
    for (const { plan } of everyBattle(6)) {
      for (const s of plan.stages) {
        seen.add(s.type);
        for (const o of s.objectives) seen.add(o.type);
      }
      for (const o of plan.side) seen.add(o.type);
      if (plan.runners) seen.add(plan.runners.type);
    }
    seen.add(planAt('endor', 'rebel', 'empire').plan.stages.at(-1).type);
    for (const type of Object.keys(TYPES)) expect(seen.has(type), type).toBe(true);
  });

  it('opens each stage on its gate, every objective with hp, every key one the tally takes, eighty at most a battle', () => {
    for (const { plan, war, kind, att } of everyBattle(3)) {
      const what = `${war} ${kind} ${att}`;
      expect(plan.stages.map((s) => s.opensAt), what).toEqual(PLAN.gates);
      for (const s of plan.stages) {
        expect(s.objectives.length, what).toBeGreaterThan(0);
        expect(s.need ?? s.objectives.length, what).toBeLessThanOrEqual(s.objectives.length);
        for (const o of s.objectives) {
          expect(o.hp, `${what} ${o.id}`).toBeGreaterThan(0);
          expect(o.name, `${what} ${o.id}`).toMatch(/\S/);
          expect(o.on, `${what} ${o.id}`).toBeTruthy();
        }
      }
      const keys = createDirector({ plan, seed: plan.id }).keys();
      // (and the hangar runs' reactors, one a Star Destroyer: warpieces/hangar.js)
      const all = [...keys, ...Array.from({ length: 8 }, (_, i) => `core-${i}`)];
      for (const k of all) expect(k, what).toMatch(KEY);
      expect(new Set(keys).size, what).toBe(keys.length);
      expect(all.length, what).toBeLessThanOrEqual(80);
      for (const t of plan.side) expect(t.at, what).toBeLessThan(plan.length);
    }
  });

  it('keeps each stage worth its share of the battle, whatever’s in it', () => {
    for (const { plan, war, kind } of everyBattle(2))
      plan.stages.forEach((s, i) => {
        const need = s.need ?? s.objectives.length;
        const ai = [...s.objectives].slice(0, need).reduce((a, o) => a + o.hp, 0);
        expect(ai, `${war} ${kind} ${s.id}`).toBeGreaterThan(PLAN.stageHp[i] * 0.85);
        expect(ai, `${war} ${kind} ${s.id}`).toBeLessThan(PLAN.stageHp[i] * 1.15);
      });
  });

  it('pins Endor: the moon’s shield generator, then the Executor’s bridge, then the run on the Death Star’s reactor', () => {
    const { plan } = planAt('endor', 'rebel', 'empire');
    expect(plan.stages.map((s) => s.objectives.map((o) => o.id))).toEqual([['moon-gen'], ['bridge'], ['ds2-core']]);
    expect(plan.stages[0].objectives[0].on).toEqual({ piece: 'endor' });
    expect(plan.stages[2]).toMatchObject({ type: 'run', why: 'deathstar' });
    expect(plan.stages[1].objectives[0].name).toMatch(/Executor/);
    // (the other way round, the Empire attacking, it's a siege like any other)
    expect(planAt('endor', 'empire', 'rebel').plan.stages[0].objectives[0].id).not.toBe('moon-gen');
  });

  it('pins Scarif’s gate and Hoth’s ion cannon and transports', () => {
    const scarif = planAt('scarif', 'rebel', 'empire').plan;
    expect(scarif.stages.at(-1).objectives[0]).toMatchObject({ id: 'gate', on: { piece: 'scarif' } });
    expect(scarif.stages.at(-1).why).toBe('gate');
    const hoth = planAt('hoth', 'empire', 'rebel').plan;
    expect(hoth.stages[0].objectives[0]).toMatchObject({ id: 'ion-cannon', on: { piece: 'hoth' } });
    expect(hoth.runners).toMatchObject({ kind: 'transport', type: 'intercept' });
  });

  it('flies each war’s own: the Separatists’ droid control relay, Gideon’s TIE fighter, the Tantive IV boarded at Tatooine and Scarif', () => {
    const relays = new Set();
    for (let n = 0; n < 40; n++) {
      const { plan } = planAt('kashyyyk', 'republic', 'separatists', 'clone', n, 'assault');
      for (const s of plan.stages) for (const o of s.objectives) if (o.kind === 'droidrelay') relays.add(o.effect?.freeze);
    }
    expect([...relays]).toEqual([30]);
    const remnant = planAt('nevarro', 'newrepublic', 'remnant', 'remnant').plan;
    expect(remnant.side.find((o) => o.type === 'ace' && o.team === 1)).toMatchObject({ kind: 'tie', name: 'Moff Gideon’s TIE fighter' });
    for (const sys of ['tatooine', 'scarif']) {
      let boarded = null;
      for (let n = 0; n < 40 && !boarded; n++) {
        const { plan } = planAt(sys, 'empire', 'rebel', 'gcw', n);
        boarded = plan.stages.find((s) => s.type === 'board' && /Tantive IV/.test(s.objectives[1].name)) ?? null;
      }
      expect(boarded, sys).toBeTruthy();
      expect(boarded.objectives.map((o) => o.type)).toEqual(['destroy', 'zone']);
    }
  });

  it('keeps the gravity wells of an interdiction’s Interdictor among its objectives, and says the battle’s interdicted while they stand', () => {
    let wells = null;
    for (let n = 0; n < 30 && !wells; n++) {
      const { plan } = planAt('mandalore', 'rebel', 'empire', 'gcw', n);
      wells = plan.stages.find((s) => s.id === 'wells') ?? null;
    }
    expect(wells).toBeTruthy();
    expect(wells).toMatchObject({ interdicts: true, need: 4, shields: true });
    expect(wells.objectives).toHaveLength(4);
  });

  it('loses a few of each side’s escorts along the way, never the ships the objectives are on', () => {
    let lost = 0;
    for (const { plan, laid } of everyBattle(2)) {
      for (const l of plan.losses) {
        const cap = laid.war.sides[l.team].capitals[l.index];
        expect(cap.role).toBe('escort');
        expect(l.at).toBeGreaterThan(0);
        expect(l.at).toBeLessThan(plan.length);
        const on = plan.stages.flatMap((s) => s.objectives.map((o) => o.on));
        expect(on.some((o) => o.ship === l.index && l.team === plan.defender)).toBe(false);
        const objective = laid.objectivesOn === 'interdictor' ? laid.war.sides[plan.defender].capitals.findIndex((c) => c.kind === 'interdictor') : 0;
        expect(l.team === plan.defender && l.index === objective).toBe(false);
        // (a set piece's own losses may take a named ship, as the films did: the superlaser the Liberty)
        if (!l.by) expect(cap.name ?? null).toBeNull();
        lost += 1;
      }
    }
    expect(lost).toBeGreaterThan(10);
  });

  it('has the Death Star’s superlaser take the Rebel cruisers at Endor, on the shared clock, whoever’s attacking, and nowhere else', () => {
    for (const [att, def] of [
      ['rebel', 'empire'],
      ['empire', 'rebel'],
    ]) {
      const { plan, laid } = planAt('endor', att, def);
      const shots = plan.losses.filter((l) => l.by === 'superlaser');
      expect(shots.length, att).toBeGreaterThanOrEqual(3);
      expect(shots[0].at).toBeGreaterThanOrEqual(50);
      shots.forEach((l, i) => {
        const cap = laid.war.sides[0].capitals[l.index];
        expect(l.team).toBe(0);
        expect(cap.role).toBe('escort');
        expect(cap.size).toBeGreaterThan(4);
        expect(l.at).toBeLessThan(plan.length);
        if (i) expect(l.at - shots[i - 1].at).toBeGreaterThanOrEqual(70);
      });
      // (and no ship's lost twice, to the superlaser and along the way)
      expect(new Set(plan.losses.map((l) => `${l.team}:${l.index}`)).size).toBe(plan.losses.length);
    }
    expect(planAt('endor', 'republic', 'separatists', 'clone').plan.losses.some((l) => l.by)).toBe(false);
    expect(planAt('yavin', 'rebel', 'empire').plan.losses.some((l) => l.by)).toBe(false);
  });
});

describe('every objective a plan lays out', () => {
  // a director that has the battle at stage `at.si`, open, nothing down yet
  const opened = (plan, at) => ({
    state: () => ({
      t: 0,
      stage: at.si,
      open: true,
      opensIn: 0,
      shield: false,
      target: null,
      stages: plan.stages.map((st, i) => ({ id: st.id, opensAt: st.opensAt, open: i === at.si, done: i < at.si })),
      objectives: plan.stages.flatMap((st, i) => st.objectives.map((o) => ({ id: o.id, stage: i, kind: o.kind, type: o.type, hp: o.hp, hpMax: o.hp, down: false }))),
      runners: null,
      waves: [],
      aces: [],
      losses: [],
      winner: null,
      why: null,
      endsAt: null,
    }),
  });
  // (as battles.test.js has the flagships' subsystems: a fair share of the
  // bolts from round its outer side that meet anything near it meet it)
  const reached = (b, o) => {
    const from = o.cap ? o.cap.pos : b.planet && o.kind === 'cannon' ? { x: 0, y: 0, z: 0 } : null;
    const out = from ? { x: o.pos.x - from.x, y: o.pos.y - from.y, z: o.pos.z - from.z } : null;
    let hit = 0;
    let stopped = 0;
    let seed = 11;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let n = 0; n < 40; n++) {
      let d;
      do d = { x: rand() * 2 - 1, y: rand() * 2 - 1, z: rand() * 2 - 1 };
      while (Math.hypot(d.x, d.y, d.z) > 1 || (out && d.x * out.x + d.y * out.y + d.z * out.z <= 0));
      const l = Math.hypot(d.x, d.y, d.z);
      let p = { x: o.pos.x + (d.x / l) * 40, y: o.pos.y + (d.y / l) * 40, z: o.pos.z + (d.z / l) * 40 };
      let h = null;
      for (let f = 0; f < 30 && !h; f++) {
        const q = { x: p.x - (d.x / l) * 2, y: p.y - (d.y / l) * 2, z: p.z - (d.z / l) * 2 };
        h = b.hit(p, q, 0);
        p = q;
      }
      if (h?.sub === o.key) hit += 1;
      else if (h) stopped += 1;
    }
    return hit / Math.max(1, hit + stopped);
  };
  it('can be shot from outside, and a zone flown into: none buried in a hull or the planet', () => {
    const seen = new Set();
    let n = 0;
    for (const { plan, laid, war, kind, att } of everyBattle(4)) {
      const objectives = plan.stages.flatMap((st, si) => st.objectives.map((o) => ({ o, si })));
      for (const { o, si } of objectives) {
        if (o.on.piece) continue;
        const key = `${o.kind}:${o.on.sub ?? ''}:${JSON.stringify(o.on.at ?? o.on.field ?? o.on.planet ?? o.on.turret)}:${laid.war.sides[plan.defender].capitals[o.on.ship === undefined || o.on.ship === 'objective' ? 0 : o.on.ship]?.kind}:${laid.objectivesOn}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const at = { si };
        const b = createBattle({ ...laid, perSide: 0, plan, director: opened(plan, at) });
        b.setYou(plan.attacker);
        b.update(0.05, null);
        const it = b.objectives.find((x) => x.key === o.id);
        expect(it, `${war} ${kind} ${att} ${o.id}`).toBeTruthy();
        if (it.zone) {
          for (const c of b.capitals) for (const sp of c.spheres) expect(Math.hypot(it.pos.x - sp.c.x, it.pos.y - sp.c.y, it.pos.z - sp.c.z), `${war} ${kind} ${o.id} in ${c.kind}`).toBeGreaterThan(sp.r);
        } else expect(reached(b, it), `${war} ${kind} ${att} ${o.id} (${o.kind})`).toBeGreaterThan(0.25);
        for (const a of laid.avoid) expect(Math.hypot(it.pos.x - a.c.x, it.pos.y - a.c.y, it.pos.z - a.c.z), `${war} ${kind} ${o.id} in the planet`).toBeGreaterThan(it.kind === 'cannon' ? laid.planet.r : a.r);
        n += 1;
      }
    }
    expect(n).toBeGreaterThan(20);
  }, 20000);
});
